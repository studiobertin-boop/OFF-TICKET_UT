import { useForm, FormProvider } from 'react-hook-form'
import { useEffect, useMemo, useRef, useState, useImperativeHandle, forwardRef, type ReactNode } from 'react'
import {
  Box,
  Divider,
} from '@mui/material'
import {
  AutoFixHigh as AutoFixHighIcon,
} from '@mui/icons-material'
import { DatiGeneraliSection } from './DatiGeneraliSection'
import { DatiImpiantoSection } from './DatiImpiantoSection'
import { SchedaSection } from './SchedaSection'
import { UnifiedEquipmentTable } from './table/UnifiedEquipmentTable'
import { AltriApparecchiSection } from './AllEquipmentSections'
import { BatchOCRDialog } from './BatchOCRDialog'
import { AzioneIcona, CompletenessBar, SectionLabel } from '@/components/common'
import { radii } from '@/theme/tokens'
import {
  completezzaApparecchiature, completezzaDatiGenerali, completezzaDatiImpianto,
  eCompleta, righeComplete, somma, type Completezza,
} from '@/utils/schedaCompleteness'
import { useHydrateCatalogOrigini } from '@/hooks/useHydrateCatalogOrigini'
import { type MovimentoPratica } from '@/services/fascicolo/scadenza'
import type { SchedaDatiCompleta } from '@/types'
import type { BatchOCRResult, BatchOCRItem } from '@/types/ocr'
import type { EquipmentCatalogType } from '@/types'
import { EQUIPMENT_LIMITS } from '@/types'
import { codeForArrayIndex, normalizeSchedaCodes } from '@/utils/equipmentCodes'

interface TechnicalSheetFormProps {
  defaultValues?: Partial<SchedaDatiCompleta>
  onSubmit: (data: SchedaDatiCompleta) => void
  onAutoSave?: (data: SchedaDatiCompleta) => void
  customerName?: string
  sedeLegale?: string
  /** Codice pratica: entra nel nome dei fascicoli generati dalle apparecchiature. */
  codicePratica?: string
  /** Pratica a cui appartengono i fascicoli: serve a salvarne i documenti. */
  requestId?: string
  /** Stato e date della pratica: da qui si ricava quando i documenti dei fascicoli scadono. */
  movimenti?: MovimentoPratica
  /**
   * Barra agganciata della pagina. La disegna il chiamante (che ha stato di
   * salvataggio e permessi) ma la rende il form, perché la completezza si calcola
   * dai valori osservati: passarla al genitore rimonterebbe l'intero form a ogni
   * tasto premuto.
   */
  header?: (completezza: Completezza) => ReactNode
}

/**
 * Bande che identificano le due sezioni della scheda.
 *
 * Prese dalla palette del tema (`primary` e `secondary`) e scelte fra i colori che nella
 * pagina non significano già qualcos'altro: il verde dice «completo», l'ambra «incompleto»,
 * il rosso «errore», e i colori dei tipi di apparecchiatura sono impegnati nella tabella.
 */
const BANDA_CONTESTO = '#6fb0ef'
const BANDA_APPARECCHIATURE = '#ce93d8'

/**
 * La data di sopralluogo è memorizzata come la scrive un `input[type=date]`
 * (`2026-07-01`): nel riepilogo va letta come la legge chi compila.
 */
const dataItaliana = (iso?: string) => {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('it-IT')
}

export interface TechnicalSheetFormRef {
  getFormData: () => SchedaDatiCompleta
  submitForm: () => Promise<void>
}

/** Campo di riferimento al padre, per gli array dipendenti. */
const CHILD_REF_FIELD: Record<string, string> = {
  disoleatori: 'compressore_associato',
  scambiatori: 'essiccatore_associato',
  recipienti_filtro: 'filtro_associato',
}

/** Tipo riconosciuto dal nome del file → field array del form. */
const TYPE_TO_FIELD: Record<EquipmentCatalogType, string> = {
  'Serbatoi': 'serbatoi',
  'Compressori': 'compressori',
  'Disoleatori': 'disoleatori',
  'Essiccatori': 'essiccatori',
  'Scambiatori': 'scambiatori',
  'Filtri': 'filtri',
  'Separatori': 'separatori',
  'Recipienti filtro': 'recipienti_filtro',
  'Altro': 'altri_apparecchi',
  'Valvole di sicurezza': '', // Non applicabile
}

/** Array del padre, per gli array dipendenti. */
const CHILD_PARENT_ARRAY: Record<string, string> = {
  disoleatori: 'compressori',
  scambiatori: 'essiccatori',
  recipienti_filtro: 'filtri',
}

/**
 * Valore che l'OCR non ha saputo leggere: non deve sovrascrivere quello già presente nel record.
 * Comprende gli oggetti vuoti (`valvola_sicurezza: {}`), usati come default quando manca il dato.
 */
const isEmptyOcrValue = (v: unknown) =>
  v === undefined ||
  v === null ||
  v === '' ||
  (typeof v === 'object' && !Array.isArray(v) && Object.keys(v as object).length === 0)

/**
 * Sovrascrive con i dati OCR solo i campi effettivamente letti: rileggere una targhetta aggiorna la
 * scheda senza cancellare quello che l'OCR non recupera (categoria PED scelta a mano, note, ecc.).
 */
const mergeOcrData = (existing: any, incoming: Record<string, any>) => {
  const out = { ...existing }
  for (const [key, value] of Object.entries(incoming)) {
    if (isEmptyOcrValue(value)) continue
    out[key] = value
  }
  return out
}

/**
 * Form completo SCHEDA DATI DM329
 * Organizzato in sezioni collassabili (Accordion)
 */
export const TechnicalSheetForm = forwardRef<TechnicalSheetFormRef, TechnicalSheetFormProps>(({
  defaultValues,
  onSubmit,
  onAutoSave,
  customerName,
  sedeLegale,
  codicePratica = '',
  requestId = '',
  movimenti,
  header,
}, ref) => {
  const methods = useForm<SchedaDatiCompleta>({
    defaultValues: {
      stato: 'bozza',
      dati_generali: {
        data_sopralluogo: '',
        nome_tecnico: '',
        cliente: customerName || '',
        note_generali: '',
      },
      dati_impianto: {
        indirizzo_impianto: '',
        raccolta_condense: 'Nessuna',
      },
      serbatoi: [],
      compressori: [],
      disoleatori: [],
      essiccatori: [],
      scambiatori: [],
      filtri: [],
      separatori: [],
      altri_apparecchi: {},
      ...defaultValues,
    },
    mode: 'onBlur',
  })

  const {
    control,
    handleSubmit,
    formState: { errors, isDirty },
    watch,
    setValue,
    getValues,
    reset,
  } = methods

  // Aggancia le righe già compilate alle voci di catalogo da cui provengono: senza, riaprendo
  // una scheda salvata non si saprebbe da dove vengono i dati né si potrebbe riportarli a catalogo.
  useHydrateCatalogOrigini(defaultValues as SchedaDatiCompleta | undefined)

  // State per Batch OCR Dialog
  const [batchOCRDialogOpen, setBatchOCRDialogOpen] = useState(false)

  // Esponi metodi al componente parent
  useImperativeHandle(ref, () => ({
    getFormData: () => methods.getValues() as SchedaDatiCompleta,
    submitForm: async () => { await methods.handleSubmit(onSubmit)() },
  }))

  // Autosave con debounce
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const watchedData = watch()

  /**
   * Completezza, ricalcolata a ogni modifica osservata. È un conteggio su oggetti già
   * in memoria: non tocca il form né la rete, e non entra in quello che si salva.
   *
   * Niente `useMemo` sulle singole bande. React Hook Form muta i propri valori sul posto e
   * `watch()` ne restituisce solo una copia superficiale: `watchedData.dati_generali` è
   * sempre lo *stesso* oggetto, riempito man mano. Una memoizzazione su quella referenza non
   * si invalida mai, e le due bande del contesto restavano ferme al conteggio del primo
   * render — «1 di 4» e «5 di 12» su una scheda compilata per intero. Le apparecchiature si
   * salvavano perché contate sulla radice, che la copia superficiale rinnova a ogni giro.
   */
  const compGenerali = completezzaDatiGenerali(watchedData?.dati_generali)
  const compImpianto = completezzaDatiImpianto(watchedData?.dati_impianto)
  const compApparecchi = useMemo(() => completezzaApparecchiature(watchedData), [watchedData])
  const righe = useMemo(() => righeComplete(watchedData), [watchedData])
  const compContesto = somma([compGenerali, compImpianto])
  const compTotale = somma([compContesto, compApparecchi])

  /** Righe principali: le valvole non si contano, sono un componente del recipiente. */
  const principali = [
    watchedData?.serbatoi, watchedData?.compressori, watchedData?.essiccatori,
    watchedData?.filtri, watchedData?.separatori,
  ].reduce((n, a) => n + (a?.length ?? 0), 0)

  /** Riepilogo del contesto nella testata della sua sezione: la dice anche da chiusa. */
  const riepilogoContesto = [
    dataItaliana(watchedData?.dati_generali?.data_sopralluogo),
    watchedData?.dati_generali?.nome_tecnico,
    (watchedData?.dati_impianto?.aria_aspirata ?? []).join(', '),
    watchedData?.dati_impianto?.raccolta_condense,
    watchedData?.dati_impianto?.locale_dedicato ? 'locale dedicato' : '',
  ].filter(Boolean).join(' · ')

  /**
   * Apertura delle due sezioni.
   *
   * Il contesto si compila una volta sola, all'inizio del sopralluogo, mentre la tabella si
   * compila per tutto il resto: quando il contesto è pieno si ripiega da sé sulla propria
   * riga di riepilogo e lascia la pagina alle apparecchiature. Una scheda riaperta a
   * contesto già completo parte quindi con quella sezione chiusa.
   *
   * Resta una proposta, non una regola: riaperto a mano, il contesto non si richiude più da
   * solo finché la sezione non torna incompleta e viene completata di nuovo.
   */
  const [contestoAperto, setContestoAperto] = useState(
    () => !eCompleta(somma([
      completezzaDatiGenerali(defaultValues?.dati_generali),
      completezzaDatiImpianto(defaultValues?.dati_impianto),
    ]))
  )
  const [apparecchiatureAperte, setApparecchiatureAperte] = useState(true)

  const contestoPieno = eCompleta(compContesto)
  const contestoEraPieno = useRef(contestoPieno)
  useEffect(() => {
    if (contestoPieno && !contestoEraPieno.current) setContestoAperto(false)
    contestoEraPieno.current = contestoPieno
  }, [contestoPieno])

  /**
   * Il gate su `isDirty` non è un'ottimizzazione: la scheda resta modificabile anche dopo il
   * completamento, quindi senza di esso la sola apertura in consultazione la riscriverebbe
   * dopo 120 secondi. `watch()` cambia a ogni render, `isDirty` solo su modifica reale.
   */
  useEffect(() => {
    if (!onAutoSave || !isDirty) return

    // Clear existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current)
    }

    // Set new timeout for autosave (120 secondi dopo l'ultima modifica)
    autoSaveTimeoutRef.current = setTimeout(() => {
      onAutoSave(watchedData as SchedaDatiCompleta)
    }, 120000)

    // Cleanup
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }
    }
  }, [watchedData, onAutoSave, isDirty])


  const handleBatchOCRComplete = (results: BatchOCRResult, items: BatchOCRItem[]) => {
    console.log('✅ Batch OCR completato:', results, items)

    // Debug: mostra stato di ogni item PRIMA del filtro
    items.forEach((item, idx) => {
      console.log(`📋 Item ${idx} (${item.filename}):`, {
        status: item.status,
        hasResult: !!item.result,
        hasData: !!item.result?.data,
        dataContent: item.result?.data, // 🔍 CONTENUTO COMPLETO di data
        dataKeys: item.result?.data ? Object.keys(item.result.data) : [],
        result: item.result,
        parsedType: item.parsedType,
        parsedComponentType: item.parsedComponentType
      })
    })

    // Applica risultati al form
    const completedItems = items.filter(i => i.status === 'completed' && i.result?.data)
    console.log('📦 Items completati da processare:', completedItems.length)

    /** File non applicati al form, con il motivo: da mostrare al tecnico a fine batch. */
    const skipped: string[] = []

    /**
     * Ordine di applicazione: prima i record principali, poi i dipendenti, infine le valvole.
     * Ogni gruppo si aggancia a qualcosa che il gruppo precedente ha già creato — un disoleatore al
     * suo compressore, una valvola al serbatoio o al disoleatore che la porta — e l'ordine dei file
     * non lo garantisce (in ordine alfabetico "C1.1.jpg" precede "C1.jpg" e "S1.1.jpg" precede
     * "S1.jpg"). `sort` è stabile: a parità di gruppo l'ordine di caricamento resta.
     */
    const applyOrder = (i: BatchOCRItem) => {
      if (i.parsedComponentType === 'valvola_sicurezza') return 2
      const field = i.parsedType ? TYPE_TO_FIELD[i.parsedType as EquipmentCatalogType] : ''
      return field && CHILD_REF_FIELD[field] ? 1 : 0
    }
    const orderedItems = [...completedItems].sort((a, b) => applyOrder(a) - applyOrder(b))

    orderedItems.forEach(item => {
      console.log('🔍 Item RAW:', {
        filename: item.filename,
        parsedType: item.parsedType,
        parsedIndex: item.parsedIndex,
        parsedComponentType: item.parsedComponentType,
        hasData: !!item.result?.data
      })

      if (!item.parsedType || !item.result?.data) {
        console.warn('⏭️ Skipping item:', item.filename)
        return
      }

      const data = item.result.data
      const equipmentType = item.parsedType as EquipmentCatalogType

      console.log(`🔧 Processando ${equipmentType} index ${item.parsedIndex}:`, data)

      const fieldName = TYPE_TO_FIELD[equipmentType]
      if (!fieldName) {
        console.warn('⚠️ Tipo non mappato:', equipmentType)
        return
      }

      // Gestione componente nested (valvola)
      if (item.parsedComponentType === 'valvola_sicurezza') {
        // La valvola appartiene a un'apparecchiatura precisa, individuata dal codice: scrivere in
        // `${fieldName}.${parsedIndex}` colpirebbe il record sbagliato appena codici e posizioni
        // divergono (con [S1, S3], "S2.1.jpg" sovrascriverebbe la valvola di S3) e, se la posizione
        // non esiste, creerebbe un record fantasma privo di codice.
        const ownerCode = codeForArrayIndex(fieldName, item.parsedIndex)
        const ownerArray = (watch(fieldName as any) || []) as any[]
        const ownerIndex = ownerCode ? ownerArray.findIndex((r: any) => r?.codice === ownerCode) : -1
        if (ownerIndex < 0) {
          skipped.push(`${item.filename}: ${ownerCode ?? 'l\'apparecchiatura'} non è presente nella scheda`)
          return
        }
        console.log(`🔐 Popolando la valvola di ${ownerCode}`)

        // Usa valori normalizzati se disponibili
        const marca = item.normalizedMarca?.normalizedValue || data.marca || ''
        const modello = item.normalizedModello?.normalizedValue || data.modello || ''

        const basePath = `${fieldName}.${ownerIndex}.valvola_sicurezza`
        setValue(`${basePath}.marca` as any, marca)
        setValue(`${basePath}.modello` as any, modello)
        if (data.n_fabbrica) setValue(`${basePath}.n_fabbrica` as any, data.n_fabbrica)
        if (data.diametro_pressione) setValue(`${basePath}.diametro_pressione` as any, data.diametro_pressione)

        console.log(`✅ Valvola popolata: ${marca} ${modello}`)
        return
      }

      // Ottieni array corrente
      const currentArray = watch(fieldName as any) || []
      console.log(`📋 Array corrente ${fieldName}:`, currentArray.length, 'items')

      // Usa valori normalizzati se disponibili, altrimenti usa raw OCR
      const marca = item.normalizedMarca?.normalizedValue || data.marca || ''
      const modello = item.normalizedModello?.normalizedValue || data.modello || ''

      // Crea nuova apparecchiatura o aggiorna esistente
      const newEquipment: any = {
        marca,
        modello,
        n_fabbrica: data.n_fabbrica || '',
        anno: data.anno || undefined,
        volume: data.volume || undefined,
        pressione_max: data.pressione_max || undefined,
        materiale_n: data.materiale_n || undefined,
      }

      // Aggiungi dati specifici per serbatoi
      if (equipmentType === 'Serbatoi') {
        newEquipment.valvola_sicurezza = data.valvola_sicurezza || {}
        newEquipment.manometro = data.manometro || {}
      }

      // Aggiungi dati specifici per disoleatori
      if (equipmentType === 'Disoleatori') {
        newEquipment.valvola_sicurezza = data.valvola_sicurezza || {}
      }

      // Il nome del file individua l'apparecchiatura per codice, non per posizione: "S3.jpg" ⇒ il
      // record che ha codice S3, ovunque si trovi nell'array.
      const limits = (EQUIPMENT_LIMITS as Record<string, { prefix: string; max: number }>)[fieldName]
      const refField = limits ? CHILD_REF_FIELD[fieldName] : undefined
      /** Codice atteso per gli array principali; per i dipendenti si deriva dal padre. */
      let targetCode: string | undefined

      if (limits && refField) {
        // Array dipendente: il codice deriva dal padre, es. disoleatore di C1 ⇒ C1.1. Il padre va
        // risolto sui codici realmente presenti: senza questo controllo nascerebbe un figlio orfano,
        // che la tabella non renderizza e la normalizzazione non sa correggere.
        // `parsedParentIndex` è sempre valorizzato dal filenameParser per le forme "C1.1"/"E1.1":
        // nessun ripiego sull'indice del figlio, che aggancerebbe il record al padre sbagliato.
        if (item.parsedParentIndex === undefined) {
          skipped.push(`${item.filename}: il nome del file non indica l'apparecchiatura padre`)
          return
        }
        const parentCode = `${limits.prefix}${item.parsedParentIndex + 1}`
        const parentArray = (watch(CHILD_PARENT_ARRAY[fieldName] as any) || []) as any[]
        if (!parentArray.some((p: any) => p?.codice === parentCode)) {
          skipped.push(`${item.filename}: ${parentCode} non è presente nella scheda`)
          return
        }
        targetCode = `${parentCode}.1`
        newEquipment.codice = targetCode
        newEquipment[refField] = parentCode
      } else if (limits) {
        targetCode = `${limits.prefix}${item.parsedIndex + 1}`
        newEquipment.codice = targetCode
      }

      // Inserisci nell'array
      const newArray = [...currentArray]

      // Il record si individua dall'identità (riferimento al padre per i dipendenti, codice per i
      // principali), mai dalla posizione: scrivere per indice sovrascriverebbe l'apparecchiatura
      // sbagliata appena i codici non coincidono più con le posizioni (es. S2 eliminato).
      const existing = refField
        ? newArray.findIndex((r: any) => r?.[refField] === newEquipment[refField])
        : targetCode !== undefined
          ? newArray.findIndex((r: any) => r?.codice === targetCode)
          : -1
      if (existing >= 0) newArray[existing] = mergeOcrData(newArray[existing], newEquipment)
      else newArray.push(newEquipment)
      console.log(`💾 Salvando in ${fieldName} ${targetCode ?? '(senza codice)'}:`, newEquipment)

      console.log(`📊 Nuovo array ${fieldName}:`, newArray)
      setValue(fieldName as any, newArray, { shouldValidate: true, shouldDirty: true })
    })

    // Nessun record nasce più privo di codice: ogni inserimento porta con sé il proprio. Resta però
    // il caso fuori range — "F9.jpg" con `filtri.max = 8` accoda un record con codice F9 — che la
    // normalizzazione riporta al numero libero più basso. `reset` riscrive nel form la scheda
    // normalizzata, che è un oggetto nuovo, in un colpo solo invece di un setValue per array.
    //
    // Il reset è incondizionato: gli array sono stati riscritti con `setValue`, che non rigenera
    // gli id di `useFieldArray`. Senza reset `fields` e valori possono divergere in lunghezza, e
    // la tabella — che legge il codice da `values[i]` con `i` preso da `fields` — mostrerebbe i
    // dati di una riga sotto un'altra.
    const { scheda: normalized } = normalizeSchedaCodes(getValues())
    reset(normalized, { keepDirty: true })

    const applicati = completedItems.length - skipped.length
    alert(
      `Batch OCR completato!\n\n` +
      `Totale: ${results.total}\n` +
      `Completati: ${results.completed}\n` +
      `Errori: ${results.errors}\n` +
      `Normalizzati: ${results.normalized}\n\n` +
      `${applicati} apparecchiature aggiunte al form.` +
      (skipped.length
        ? `\n\n${skipped.length} file non applicati:\n${skipped.map((s) => `• ${s}`).join('\n')}`
        : '')
    )

    setBatchOCRDialogOpen(false)
  }

  return (
    <FormProvider {...methods}>
      <Box component="form" onSubmit={handleSubmit(onSubmit)}>
        {header?.(compTotale)}

        {/* Le due sezioni stanno una sotto l'altra e restano staccate: prima erano
            linguette, e passare dal contesto alle apparecchiature costava un cambio di
            pagina proprio mentre si compilava. Il contesto viene per primo perché è il
            primo passo del sopralluogo. */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
          <SchedaSection
            titolo="Contesto"
            colore={BANDA_CONTESTO}
            aperta={contestoAperto}
            onToggle={() => setContestoAperto((v) => !v)}
            completezza={compContesto}
            riepilogo={riepilogoContesto}
          >
            {/* Due bande separate da un filetto: cinque campi non meritano una card
                propria, e due card affiancate non si allineavano. */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mb: 1.5 }}>
              <SectionLabel>Sopralluogo</SectionLabel>
              <CompletenessBar completezza={compGenerali} mostraMancanti />
            </Box>
            <DatiGeneraliSection
              control={control}
              errors={errors}
              defaultCustomer={customerName}
            />

            <Divider sx={{ my: 2.5 }} />

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mb: 1.5 }}>
              <SectionLabel>Sala compressori</SectionLabel>
              <CompletenessBar completezza={compImpianto} mostraMancanti />
            </Box>
            <DatiImpiantoSection control={control} errors={errors} sedeLegale={sedeLegale} />
          </SchedaSection>

          <SchedaSection
            titolo="Apparecchiature"
            colore={BANDA_APPARECCHIATURE}
            aperta={apparecchiatureAperte}
            onToggle={() => setApparecchiatureAperte((v) => !v)}
            completezza={compApparecchi}
            contatore={`${principali} principali`}
            riepilogo={`${righe.complete} di ${righe.totali} righe complete`}
          >
            <UnifiedEquipmentTable
              control={control}
              errors={errors}
              completezza={compApparecchi}
              righeComplete={righe}
              codicePratica={codicePratica}
              requestId={requestId}
              movimenti={movimenti}
              ragioneSociale={customerName}
              azioni={
                <AzioneIcona
                  icona={<AutoFixHighIcon fontSize="small" />}
                  testo="Riconosci automaticamente"
                  onClick={() => setBatchOCRDialogOpen(true)}
                />
              }
            />

            {/* Gli altri apparecchi non hanno una riga di tabella propria — sono un campo
                libero — ma sono apparecchiature: stanno in coda alla loro sezione invece
                che in una terza banda tutta per un campo di testo. */}
            <Box sx={{ mt: 2, p: 2, border: '1px dashed', borderColor: 'divider', borderRadius: `${radii.card}px` }}>
              <Box sx={{ mb: 1 }}>
                <SectionLabel>Altri apparecchi</SectionLabel>
              </Box>
              <AltriApparecchiSection control={control} errors={errors} />
            </Box>
          </SchedaSection>
        </Box>

        {/* Batch OCR Dialog */}
        <BatchOCRDialog
          open={batchOCRDialogOpen}
          onClose={() => setBatchOCRDialogOpen(false)}
          onComplete={handleBatchOCRComplete}
        />

      </Box>
    </FormProvider>
  )
})
