import { useCallback, useState } from 'react'
import { useFormContext, useFormState } from 'react-hook-form'
import { useEquipmentCatalogContext } from '@/components/technicalSheet/EquipmentCatalogContext'
import { equipmentCatalogApi } from '@/services/api/equipmentCatalog'
import { compareSpecs, formFieldsFor } from '@/utils/equipmentSpecsComparison'
import { readSheetPressure } from '@/services/equipmentAudit'
import type { EquipmentCatalogType } from '@/types'
import type { ScelteCampi, UpdateData } from '@/types/equipmentUpdate'

/** Legge un valore annidato da un percorso a punti, senza dipendenze esterne. */
const atPath = (obj: any, path: string): any =>
  path.split('.').reduce((acc, k) => (acc == null ? undefined : acc[k]), obj)

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
 */
export function useRowCatalogDivergence() {
  const { control, getValues, setValue } = useFormContext()
  const { getOrigine } = useEquipmentCatalogContext()

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

    const comparison = compareSpecs(origine.appliedSpecs, riga as any, tipo)
    if (!comparison.hasChanges) return

    // Solo i campi davvero modificati adesso: `dirtyFields` distingue la modifica dell'utente
    // dallo scostamento già presente nella scheda salvata.
    const sporco = (canonicalKey: string) =>
      formFieldsFor(tipo, canonicalKey).some((f) => Boolean(atPath(dirtyFields, `${base}.${f}`)))

    const modifiedFields = Object.fromEntries(
      Object.entries(comparison.modifiedFields).filter(([k]) => sporco(k))
    )
    const newFields = Object.fromEntries(
      Object.entries(comparison.newFields).filter(([k]) => sporco(k))
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

    try {
      for (const [campo, { oldValue }] of Object.entries(pending.comparison.modifiedFields)) {
        const scelta = scelte[campo] ?? 'solo_qui'
        if (scelta === 'default' && pending.basePath) {
          for (const f of formFieldsFor(pending.equipmentType, campo)) {
            if (atPath(getValues(pending.basePath), f) !== undefined) {
              setValue(`${pending.basePath}.${f}`, oldValue, { shouldDirty: true })
            }
          }
        }
        if (scelta === 'catalogo') daScrivere[campo] = pending.comparison.modifiedFields[campo].newValue
      }

      for (const [campo, valore] of Object.entries(pending.comparison.newFields)) {
        if ((scelte[campo] ?? 'solo_qui') === 'catalogo') daScrivere[campo] = valore
      }

      if (Object.keys(daScrivere).length > 0) {
        // `catalogData` è la voce di catalogo registrata nella provenienza della riga, la stessa
        // da cui vengono `appliedSpecs`: il suo id individua la riga da aggiornare senza passare
        // dalla pressione, che da sola può non bastare più a distinguerla. `variante` resta solo
        // come ripiego, per quando l'id manca.
        await equipmentCatalogApi.updateEquipmentSpecs(
          pending.equipmentType, pending.marca, pending.modello, daScrivere,
          { catalogItemId: pending.catalogData?.id, variante: pending.variante }
        )
      }

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
  }, [pending, getValues, setValue])

  return { pending, verificaRiga, conferma, annulla, loading, error }
}
