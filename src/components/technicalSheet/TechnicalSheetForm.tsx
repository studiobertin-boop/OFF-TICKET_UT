import { useForm, FormProvider } from 'react-hook-form'
import { useEffect, useRef, useState } from 'react'
import {
  Box,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  Chip,
  Button,
} from '@mui/material'
import {
  ExpandMore as ExpandMoreIcon,
  AutoFixHigh as AutoFixHighIcon,
} from '@mui/icons-material'
import { DatiGeneraliSection } from './DatiGeneraliSection'
import { DatiImpiantoSection } from './DatiImpiantoSection'
import { SerbatoiSection } from './SerbatoiSection'
import {
  CompressoriSection,
  DisoleatoriSection,
  EssiccatoriSection,
  ScambiatoriSection,
  FiltriSection,
  SeparatoriSection,
  AltriApparecchiSection,
} from './AllEquipmentSections'
import { BatchOCRDialog } from './BatchOCRDialog'
import type { SchedaDatiCompleta } from '@/types'
import type { BatchOCRResult } from '@/types/ocr'

interface TechnicalSheetFormProps {
  defaultValues?: Partial<SchedaDatiCompleta>
  onSubmit: (data: SchedaDatiCompleta) => void
  onAutoSave?: (data: SchedaDatiCompleta) => void
  customerName?: string
  readOnly?: boolean
}

/**
 * Form completo SCHEDA DATI DM329
 * Organizzato in sezioni collassabili (Accordion)
 */
export const TechnicalSheetForm = ({
  defaultValues,
  onSubmit,
  onAutoSave,
  customerName,
  readOnly = false,
}: TechnicalSheetFormProps) => {
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
        raccolta_condense: [],
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
  } = methods

  // Watch per sezioni dipendenti
  const compressori = watch('compressori') || []
  const essiccatori = watch('essiccatori') || []

  // State per Batch OCR Dialog
  const [batchOCRDialogOpen, setBatchOCRDialogOpen] = useState(false)

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


  const handleBatchOCRComplete = (results: BatchOCRResult) => {
    console.log('✅ Batch OCR completato:', results)

    // TODO: Applicare risultati al form
    // Per ora mostriamo solo un summary
    alert(
      `Batch OCR completato!\n\n` +
      `Totale: ${results.total}\n` +
      `Completati: ${results.completed}\n` +
      `Errori: ${results.errors}\n` +
      `Normalizzati: ${results.normalized}`
    )

    setBatchOCRDialogOpen(false)
  }

  return (
    <FormProvider {...methods}>
      <Box component="form" onSubmit={handleSubmit(onSubmit)}>
        {/* Sezione 1: Dati Generali */}
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
              <Typography variant="h6">1. Dati Generali</Typography>
              <Chip label="Obbligatorio" size="small" color="error" />
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <DatiGeneraliSection
              control={control}
              errors={errors}
              defaultCustomer={customerName}
            />
          </AccordionDetails>
        </Accordion>

        {/* Sezione 2: Dati Impianto */}
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
              <Typography variant="h6">2. Dati Impianto</Typography>
              <Chip label="Obbligatorio" size="small" color="error" />
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <DatiImpiantoSection control={control} errors={errors} />
          </AccordionDetails>
        </Accordion>

        {/* Header Sezione Apparecchiature con bottone Batch OCR */}
        <Box
          sx={{
            mt: 3,
            mb: 2,
            p: 2,
            bgcolor: 'background.paper',
            borderRadius: 1,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Typography variant="h6">3. Apparecchiature</Typography>
          <Button
            variant="contained"
            startIcon={<AutoFixHighIcon />}
            onClick={() => setBatchOCRDialogOpen(true)}
            disabled={readOnly}
          >
            Riconosci Automaticamente
          </Button>
        </Box>

        {/* Sezione 3: Serbatoi */}
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">3. Serbatoi</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <SerbatoiSection control={control} errors={errors} />
          </AccordionDetails>
        </Accordion>

        {/* Sezione 4: Compressori */}
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">4. Compressori</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <CompressoriSection control={control} errors={errors} />
          </AccordionDetails>
        </Accordion>

        {/* Sezione 5: Disoleatori */}
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">5. Disoleatori</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <DisoleatoriSection
              control={control}
              errors={errors}
              compressori={compressori}
            />
          </AccordionDetails>
        </Accordion>

        {/* Sezione 6: Essiccatori */}
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">6. Essiccatori</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <EssiccatoriSection control={control} errors={errors} />
          </AccordionDetails>
        </Accordion>

        {/* Sezione 7: Scambiatori */}
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">7. Scambiatori</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <ScambiatoriSection
              control={control}
              errors={errors}
              essiccatori={essiccatori}
            />
          </AccordionDetails>
        </Accordion>

        {/* Sezione 8: Filtri */}
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">8. Filtri</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <FiltriSection control={control} errors={errors} />
          </AccordionDetails>
        </Accordion>

        {/* Sezione 9: Separatori */}
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">9. Separatori</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <SeparatoriSection control={control} errors={errors} />
          </AccordionDetails>
        </Accordion>

        {/* Sezione 10: Altri Apparecchi */}
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">10. Altri Apparecchi</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <AltriApparecchiSection control={control} errors={errors} />
          </AccordionDetails>
        </Accordion>

        {/* Batch OCR Dialog */}
        <BatchOCRDialog
          open={batchOCRDialogOpen}
          onClose={() => setBatchOCRDialogOpen(false)}
          onComplete={handleBatchOCRComplete}
        />
      </Box>
    </FormProvider>
  )
}
