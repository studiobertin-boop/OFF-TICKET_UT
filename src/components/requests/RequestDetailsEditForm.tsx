import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Box, Grid, Button, Typography } from '@mui/material'
import { Save as SaveIcon, Close as CloseIcon } from '@mui/icons-material'
import { DynamicFormField } from './DynamicFormField'
import { generateZodSchemaWithValidations, getDefaultValues } from '@/utils/formSchema'
import type { Request } from '@/types'

/**
 * Campi non modificabili da questo form perché mostrati/gestiti altrove
 * (note, dati cliente, campi tecnici/interni). Deve restare allineato ai filtri
 * della sezione "Dettagli Richiesta" in RequestDetail.
 */
const EXCLUDED_FIELDS = new Set([
  'note',
  'cliente',
  'sede_legale',
  'telefono',
  'pec',
  'descrizione_attivita',
  'indirizzo_immobile',
  'original_csv_row',
  'assignment_category',
  'workflow_dates',
])

interface RequestDetailsEditFormProps {
  request: Request
  saving: boolean
  onSave: (customFields: Record<string, any>) => void | Promise<void>
  onCancel: () => void
}

/**
 * Form di modifica dei campi dinamici (custom_fields) di una richiesta "normale"
 * (non DM329), generato dal fields_schema del tipo di richiesta.
 * Monta solo in modalità edit, così useForm si inizializza con schema e valori corretti.
 */
export const RequestDetailsEditForm = ({
  request,
  saving,
  onSave,
  onCancel,
}: RequestDetailsEditFormProps) => {
  const fields = (request.request_type?.fields_schema || []).filter(
    (f) => !f.hidden && !EXCLUDED_FIELDS.has(f.name)
  )

  // Valori iniziali: default dello schema, sovrascritti dai valori attuali della richiesta
  const defaultValues: Record<string, any> = { ...getDefaultValues(fields) }
  for (const f of fields) {
    if (request.custom_fields?.[f.name] !== undefined) {
      defaultValues[f.name] = request.custom_fields[f.name]
    }
  }

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(
      generateZodSchemaWithValidations(fields, request.request_type?.name || '')
    ),
    defaultValues,
  })

  const submit = handleSubmit((values) => {
    // Preserva gli altri custom_fields (esclusi/non gestiti) e applica le modifiche
    onSave({ ...request.custom_fields, ...values })
  })

  if (fields.length === 0) {
    return (
      <Box sx={{ mb: 3, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
        <Typography variant="body2" color="text.secondary">
          Nessun campo modificabile per questo tipo di richiesta.
        </Typography>
        <Box sx={{ mt: 2 }}>
          <Button variant="outlined" startIcon={<CloseIcon />} onClick={onCancel}>
            Chiudi
          </Button>
        </Box>
      </Box>
    )
  }

  return (
    <Box sx={{ mb: 3, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
      <Grid container spacing={2}>
        {fields.map((field) => (
          <Grid item xs={12} md={field.type === 'textarea' ? 12 : 6} key={field.name}>
            <DynamicFormField field={field} control={control} error={errors[field.name]} />
          </Grid>
        ))}
      </Grid>
      <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={submit}
          disabled={saving}
        >
          Salva
        </Button>
        <Button
          variant="outlined"
          startIcon={<CloseIcon />}
          onClick={onCancel}
          disabled={saving}
        >
          Annulla
        </Button>
      </Box>
    </Box>
  )
}
