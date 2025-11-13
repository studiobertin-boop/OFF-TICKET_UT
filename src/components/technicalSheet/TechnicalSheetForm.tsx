import { useForm, FormProvider } from 'react-hook-form'
import {
  Box,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  Chip,
  LinearProgress,
} from '@mui/material'
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material'
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
import type { SchedaDatiCompleta } from '@/types'

interface TechnicalSheetFormProps {
  defaultValues?: Partial<SchedaDatiCompleta>
  onSubmit: (data: SchedaDatiCompleta) => void
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

  const sections = [
    { id: 1, title: 'Dati Generali', required: true },
    { id: 2, title: 'Dati Impianto', required: true },
    { id: 3, title: 'Serbatoi', required: false },
    { id: 4, title: 'Compressori', required: false },
    { id: 5, title: 'Disoleatori', required: false },
    { id: 6, title: 'Essiccatori', required: false },
    { id: 7, title: 'Scambiatori', required: false },
    { id: 8, title: 'Filtri', required: false },
    { id: 9, title: 'Separatori', required: false },
    { id: 10, title: 'Altri Apparecchi', required: false },
  ]

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
      </Box>
    </FormProvider>
  )
}
