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

    completedItems.forEach(item => {
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

      // Mappa tipo → field array name
      const typeToFieldMap: Record<EquipmentCatalogType, string> = {
        'Serbatoi': 'serbatoi',
        'Compressori': 'compressori',
        'Disoleatori': 'disoleatori',
        'Essiccatori': 'essiccatori',
        'Scambiatori': 'scambiatori',
        'Filtri': 'filtri',
        'Separatori': 'separatori',
        'Recipienti filtro': 'recipienti_filtro',
        'Altro': 'altri_apparecchi',
        'Valvole di sicurezza': '' // Non applicabile
      }

      const fieldName = typeToFieldMap[equipmentType]
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

      // Inserisci nell'array all'indice corretto
      const newArray = [...currentArray]

      // Assicurati che l'array sia abbastanza grande
      while (newArray.length <= item.parsedIndex) {
        newArray.push({})
      }

      newArray[item.parsedIndex] = newEquipment

      console.log(`💾 Salvando in ${fieldName}[${item.parsedIndex}]:`, newEquipment)
      console.log(`📊 Nuovo array ${fieldName}:`, newArray)
      setValue(fieldName as any, newArray, { shouldValidate: true, shouldDirty: true })
    })

    alert(
      `Batch OCR completato!\n\n` +
      `Totale: ${results.total}\n` +
      `Completati: ${results.completed}\n` +
      `Errori: ${results.errors}\n` +
      `Normalizzati: ${results.normalized}\n\n` +
      `${completedItems.length} apparecchiature aggiunte al form.`
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
