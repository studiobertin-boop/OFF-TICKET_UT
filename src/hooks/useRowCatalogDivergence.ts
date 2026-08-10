import { useCallback, useState } from 'react'
import { useFormContext, useFormState } from 'react-hook-form'
import { useEquipmentCatalogContext } from '@/components/technicalSheet/EquipmentCatalogContext'
import { equipmentCatalogApi, type EsitoAggiornamentoSpecs } from '@/services/api/equipmentCatalog'
import { areValuesEqual, compareSpecs, formFieldsFor } from '@/utils/equipmentSpecsComparison'
import { stessaVoceCatalogo } from '@/utils/equipmentVarianti'
import { readSheetPressure } from '@/services/equipmentAudit'
import type { EquipmentCatalogType } from '@/types'
import type { ScelteCampi, UpdateData } from '@/types/equipmentUpdate'

/** Legge un valore annidato da un percorso a punti, senza dipendenze esterne. */
const atPath = (obj: any, path: string): any =>
  path.split('.').reduce((acc, k) => (acc == null ? undefined : acc[k]), obj)

/**
 * Cosa dire quando la scrittura a catalogo non è avvenuta.
 *
 * Rinunciare in silenzio è la cosa peggiore: chi ha scelto «aggiorna il catalogo» e ha visto il
 * dialog chiudersi dà per fatto un aggiornamento che non c'è stato, e il dato sbagliato resta a
 * catalogo per la prossima pratica. In entrambi i casi la scheda in corso non perde nulla — il
 * valore digitato resta dov'è — ed è la prima cosa da dire.
 */
const MESSAGGIO_MANCATO_AGGIORNAMENTO: Record<Exclude<EsitoAggiornamentoSpecs, 'aggiornato'>, string> = {
  variante_ambigua:
    'Il catalogo non è stato aggiornato: di questo modello esistono più varianti a questa ' +
    'pressione e non è possibile stabilire quale aggiornare. La modifica resta in questa scheda; ' +
    'il catalogo va sistemato dal modulo di gestione apparecchiature.',
  riga_non_trovata:
    'Il catalogo non è stato aggiornato: la voce di partenza non è più raggiungibile, ' +
    'probabilmente è stata rimossa. La modifica resta in questa scheda.',
}

interface VerificaRiga {
  tipo: EquipmentCatalogType
  /** Percorso della riga nel form, es. `compressori.0`. */
  base: string
  /** Chiave della riga nella mappa delle provenienze. */
  rowKey: string
  /** Codice mostrato all'utente, per il titolo del dialog. */
  codice: string
}

/**
 * Rileva che l'utente ha scostato dai dati di catalogo una riga che da lì era stata precompilata,
 * e propone cosa farne.
 *
 * Due condizioni, entrambe necessarie:
 *
 * 1. **La riga ha una provenienza.** Il confronto è contro `appliedSpecs`, la fotografia dei dati
 *    così come sono arrivati dal catalogo — non contro il catalogo di adesso. Una riga compilata
 *    a mano, senza voce di catalogo dietro, non ha nulla da cui scostarsi e non apre nulla.
 * 2. **Il campo è stato toccato in questa sessione** (`dirtyFields`). Senza, riaprire una scheda
 *    in cui uno scostamento era stato deciso tempo fa farebbe ricomparire la domanda a ogni
 *    passaggio sulla riga.
 * 3. **Su quel valore non si è già deciso** (`risolti`). Confermare il dialog non toglie lo
 *    scostamento — «solo per questa volta» lo lascia lì apposta, e anche «aggiorna il catalogo»
 *    lascia intatta la fotografia da cui la riga era partita — quindi senza memoria della scelta
 *    la stessa domanda tornerebbe alla prima uscita utile dalla riga, tipicamente appena si passa
 *    all'apparecchiatura successiva.
 */
export function useRowCatalogDivergence() {
  const { control, getValues, setValue } = useFormContext()
  const { getOrigine, segnaRisolti } = useEquipmentCatalogContext()

  /**
   * `useFormState` e non `formState` di `useFormContext`: quest'ultimo è un Proxy che si
   * sottoscrive ai soli campi letti **durante il render**, e qui `dirtyFields` serve dentro una
   * callback. Senza sottoscrizione resterebbe vuoto e nessuna modifica risulterebbe mai fatta
   * dall'utente.
   */
  const { dirtyFields } = useFormState({ control })

  const [pending, setPending] = useState<UpdateData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const verificaRiga = useCallback(({ tipo, base, rowKey, codice }: VerificaRiga) => {
    if (pending) return

    const origine = getOrigine(rowKey)
    if (!origine) return

    const riga = getValues(base) as Record<string, any> | undefined
    if (!riga?.marca || !riga?.modello) return

    // La provenienza vale per la marca/modello con cui è stata registrata. Se il tecnico corregge
    // l'una o l'altro dall'autocomplete — che per i tipi indicizzati per variante non richiama
    // `handleSelected` — la provenienza resta quella del modello precedente: aprire il dialog
    // confronterebbe la riga corretta con `appliedSpecs` di un'altra apparecchiatura, e «aggiorna
    // il catalogo» scriverebbe su quella. Meglio trattarla come riga senza provenienza: niente
    // dialog, invece di un dialog che mostra e scrive i dati sbagliati.
    if (!stessaVoceCatalogo(origine.catalogItem, riga.marca, riga.modello)) return

    const comparison = compareSpecs(origine.appliedSpecs, riga as any, tipo)
    if (!comparison.hasChanges) return

    // Solo i campi davvero modificati adesso: `dirtyFields` distingue la modifica dell'utente
    // dallo scostamento già presente nella scheda salvata.
    const sporco = (canonicalKey: string) =>
      formFieldsFor(tipo, canonicalKey).some((f) => Boolean(atPath(dirtyFields, `${base}.${f}`)))

    // La decisione vale per il valore su cui è stata presa: se il tecnico ci ripensa e digita
    // un terzo valore, quello è uno scostamento nuovo e la domanda torna a essere legittima.
    const giaDeciso = (canonicalKey: string, valore: unknown) =>
      origine.risolti !== undefined &&
      canonicalKey in origine.risolti &&
      areValuesEqual(origine.risolti[canonicalKey], valore)

    const daChiedere = (k: string, valore: unknown) => sporco(k) && !giaDeciso(k, valore)

    const modifiedFields = Object.fromEntries(
      Object.entries(comparison.modifiedFields).filter(([k, { newValue }]) => daChiedere(k, newValue))
    )
    const newFields = Object.fromEntries(
      Object.entries(comparison.newFields).filter(([k, v]) => daChiedere(k, v))
    )
    if (Object.keys(modifiedFields).length === 0 && Object.keys(newFields).length === 0) return

    setPending({
      equipmentType: tipo,
      marca: riga.marca,
      modello: riga.modello,
      codice,
      newSpecs: {},
      comparison: { ...comparison, modifiedFields, newFields },
      catalogData: origine.catalogItem,
      variante: readSheetPressure(tipo, origine.appliedSpecs) ?? undefined,
      basePath: base,
      rowKey,
    })
  }, [pending, getOrigine, getValues, dirtyFields])

  const annulla = useCallback(() => {
    setPending(null)
    setError(null)
  }, [])

  /**
   * Applica le scelte: riporta indietro i valori rifiutati e scrive a catalogo quelli confermati.
   * «Modifica solo per questa volta» non fa niente, ed è appunto il suo scopo.
   */
  const conferma = useCallback(async (scelte: ScelteCampi) => {
    if (!pending) return
    setLoading(true)
    setError(null)

    const daScrivere: Record<string, any> = {}
    // Valore su cui la domanda si chiude, campo per campo: è quello che resta in scheda.
    // Con «valore di default» torna quello di catalogo e lo scostamento sparisce da sé, quindi
    // non c'è niente da annotare.
    const decisi: Record<string, unknown> = {}

    try {
      for (const [campo, { oldValue, newValue }] of Object.entries(pending.comparison.modifiedFields)) {
        const scelta = scelte[campo] ?? 'solo_qui'
        if (scelta === 'default' && pending.basePath) {
          for (const f of formFieldsFor(pending.equipmentType, campo)) {
            if (atPath(getValues(pending.basePath), f) !== undefined) {
              setValue(`${pending.basePath}.${f}`, oldValue, { shouldDirty: true })
            }
          }
        } else {
          decisi[campo] = newValue
        }
        if (scelta === 'catalogo') daScrivere[campo] = newValue
      }

      for (const [campo, valore] of Object.entries(pending.comparison.newFields)) {
        decisi[campo] = valore
        if ((scelte[campo] ?? 'solo_qui') === 'catalogo') daScrivere[campo] = valore
      }

      if (Object.keys(daScrivere).length > 0) {
        // `catalogData` è la voce di catalogo registrata nella provenienza della riga, la stessa
        // da cui vengono `appliedSpecs`: il suo id individua la riga da aggiornare senza passare
        // dalla pressione, che da sola può non bastare più a distinguerla. `variante` resta solo
        // come ripiego, per quando l'id manca.
        const esito = await equipmentCatalogApi.updateEquipmentSpecs(
          pending.equipmentType, pending.marca, pending.modello, daScrivere,
          { catalogItemId: pending.catalogData.id, variante: pending.variante }
        )

        // Il dialog resta aperto: chiuderlo qui equivarrebbe a dire che si è scritto.
        if (esito !== 'aggiornato') {
          setError(MESSAGGIO_MANCATO_AGGIORNAMENTO[esito])
          return
        }
      }

      // Solo a scritture riuscite: se il catalogo non ha accettato, la scelta non è chiusa.
      segnaRisolti(pending.rowKey, decisi)
      setPending(null)
    } catch (err: any) {
      console.error('Errore aggiornamento catalogo:', err)
      setError(
        err?.code === 'PGRST301' || err?.message?.includes('permission')
          ? 'Non hai i permessi per aggiornare il catalogo. Contatta un amministratore.'
          : err?.message || 'Errore durante l\'aggiornamento del catalogo'
      )
    } finally {
      setLoading(false)
    }
  }, [pending, getValues, setValue, segnaRisolti])

  return { pending, verificaRiga, conferma, annulla, loading, error }
}
