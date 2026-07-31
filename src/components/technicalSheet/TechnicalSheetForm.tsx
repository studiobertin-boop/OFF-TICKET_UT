import { useForm, FormProvider } from 'react-hook-form'
import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Button,
} from '@mui/material'
import {
  AutoFixHigh as AutoFixHighIcon,
} from '@mui/icons-material'
import { DatiGeneraliSection } from './DatiGeneraliSection'
import { DatiImpiantoSection } from './DatiImpiantoSection'
import { UnifiedEquipmentTable } from './table/UnifiedEquipmentTable'
import { AltriApparecchiSection } from './AllEquipmentSections'
import { BatchOCRDialog } from './BatchOCRDialog'
import { UpdateCatalogDialog } from './UpdateCatalogDialog'
import { useEquipmentCatalogUpdate } from '@/hooks/useEquipmentCatalogUpdate'
import type { SchedaDatiCompleta } from '@/types'
import type { BatchOCRResult, BatchOCRItem } from '@/types/ocr'
import type { EquipmentCatalogType } from '@/types'
import { EQUIPMENT_LIMITS } from '@/types'
import { normalizeSchedaCodes } from '@/utils/equipmentCodes'

interface TechnicalSheetFormProps {
  defaultValues?: Partial<SchedaDatiCompleta>
  onSubmit: (data: SchedaDatiCompleta) => void
  onAutoSave?: (data: SchedaDatiCompleta) => void
  customerName?: string
  sedeLegale?: string
  readOnly?: boolean
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
  readOnly = false,
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
    formState: { errors },
    watch,
    setValue,
    getValues,
    reset,
  } = methods

  // State per Batch OCR Dialog
  const [batchOCRDialogOpen, setBatchOCRDialogOpen] = useState(false)

  // ✅ Hook per gestione aggiornamenti catalogo
  const catalogUpdate = useEquipmentCatalogUpdate()

  // State per gestire submit dopo conferma catalog update
  const [pendingSubmitData, setPendingSubmitData] = useState<SchedaDatiCompleta | null>(null)

  // Esponi metodi al componente parent
  useImperativeHandle(ref, () => ({
    getFormData: () => methods.getValues() as SchedaDatiCompleta,
    submitForm: async () => {
      // Intercetta submit per check catalog updates
      const formData = methods.getValues() as SchedaDatiCompleta

      // Raccoglie updates necessari
      const updates = catalogUpdate.collectUpdates(formData)

      if (updates.length > 0) {
        // Ci sono aggiornamenti da proporre
        console.log('📋 Found catalog updates, showing dialog...')
        setPendingSubmitData(formData)
        catalogUpdate.promptUpdates(updates)
        // NON chiamare onSubmit qui, aspettiamo conferma dialog
      } else {
        // Nessun update, procedi normalmente
        await methods.handleSubmit(onSubmit)()
      }
    }
  }))

  // ✅ Callback per conferma aggiornamento catalogo
  const handleCatalogUpdateConfirm = async () => {
    await catalogUpdate.confirmUpdates()

    // Dopo aggiornamento catalogo, procedi con save scheda
    if (pendingSubmitData) {
      await methods.handleSubmit(onSubmit)()
      setPendingSubmitData(null)
    }
  }

  // ✅ Callback per annullamento aggiornamento catalogo
  const handleCatalogUpdateCancel = () => {
    catalogUpdate.cancelUpdate()

    // Procedi comunque con save scheda (senza aggiornare catalogo)
    if (pendingSubmitData) {
      onSubmit(pendingSubmitData)
      setPendingSubmitData(null)
    }
  }

  // Autosave con debounce
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const watchedData = watch()

  useEffect(() => {
    if (!onAutoSave || readOnly) return

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
  }, [watchedData, onAutoSave, readOnly])


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

    /** Le apparecchiature dipendenti si applicano dopo i padri: il controllo di esistenza del padre
     *  deve vedere anche quelli creati dallo stesso batch, qualunque sia l'ordine dei file (in
     *  ordine alfabetico "C1.1.jpg" precede "C1.jpg"). `sort` è stabile: a parità l'ordine resta. */
    const isDependent = (i: BatchOCRItem) => {
      const field = i.parsedType ? TYPE_TO_FIELD[i.parsedType as EquipmentCatalogType] : ''
      return !!field && !!CHILD_REF_FIELD[field] && i.parsedComponentType !== 'valvola_sicurezza'
    }
    const orderedItems = [...completedItems].sort((a, b) => Number(isDependent(a)) - Number(isDependent(b)))

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
        console.log(`🔐 Popolando valvola per ${fieldName}[${item.parsedIndex}]`)

        // Usa valori normalizzati se disponibili
        const marca = item.normalizedMarca?.normalizedValue || data.marca || ''
        const modello = item.normalizedModello?.normalizedValue || data.modello || ''

        const basePath = `${fieldName}.${item.parsedIndex}.valvola_sicurezza`
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
    const { scheda: normalized, changed } = normalizeSchedaCodes(getValues())
    if (changed) reset(normalized)

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
        {/* Sezione 1: Informazioni Pratica */}
        <Card sx={{ mb: 1.5 }}>
          <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>1 · Informazioni Pratica</Typography>
              <Chip label="Obbligatorio" size="small" color="error" sx={{ height: 18, fontSize: '0.65rem' }} />
            </Box>
            <DatiGeneraliSection
              control={control}
              errors={errors}
              defaultCustomer={customerName}
            />
          </CardContent>
        </Card>

        {/* Sezione 2: Dati Sala Compressori */}
        <Card sx={{ mb: 1.5 }}>
          <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>2 · Dati Sala Compressori</Typography>
              <Chip label="Obbligatorio" size="small" color="error" sx={{ height: 18, fontSize: '0.65rem' }} />
            </Box>
            <DatiImpiantoSection control={control} errors={errors} sedeLegale={sedeLegale} />
          </CardContent>
        </Card>

        {/* Sezione 3: Dati Apparecchiature */}
        <Card sx={{ mb: 1.5 }}>
          <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.25 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>3 · Dati Apparecchiature</Typography>
              <Button
                size="small"
                variant="contained"
                startIcon={<AutoFixHighIcon />}
                onClick={() => setBatchOCRDialogOpen(true)}
                disabled={readOnly}
              >
                Riconosci Automaticamente
              </Button>
            </Box>

            <UnifiedEquipmentTable control={control} errors={errors} />

            {/* AA - Altri Apparecchi (campo libero) */}
            <Box sx={{ mt: 1.5 }}>
              <AltriApparecchiSection control={control} errors={errors} />
            </Box>
          </CardContent>
        </Card>

        {/* Batch OCR Dialog */}
        <BatchOCRDialog
          open={batchOCRDialogOpen}
          onClose={() => setBatchOCRDialogOpen(false)}
          onComplete={handleBatchOCRComplete}
        />

        {/* ✅ Update Catalog Dialog */}
        <UpdateCatalogDialog
          open={catalogUpdate.dialogOpen}
          updates={catalogUpdate.pendingUpdates}
          onConfirm={handleCatalogUpdateConfirm}
          onCancel={handleCatalogUpdateCancel}
          loading={catalogUpdate.loading}
          error={catalogUpdate.error}
        />
      </Box>
    </FormProvider>
  )
})
