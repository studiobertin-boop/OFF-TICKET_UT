import { useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControlLabel,
  Switch,
  Box,
  Alert,
  CircularProgress,
} from '@mui/material'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { RequestType } from '../../types'
import FieldSchemaBuilder from './FieldSchemaBuilder'

const fieldSchemaSchema = z.object({
  name: z
    .string()
    .min(1, 'Nome campo obbligatorio')
    .regex(/^[a-z_]+$/, 'Solo lettere minuscole e underscore'),
  type: z.enum(['text', 'textarea', 'boolean', 'select', 'multiselect', 'file', 'date', 'autocomplete']),
  label: z.string().min(1, 'Etichetta obbligatoria'),
  required: z.boolean(),
  hidden: z.boolean().optional(),
  options: z.array(z.string()).optional(),
  dataSource: z.string().optional(),
  displayField: z.string().optional(),
  valueField: z.string().optional(),
})

const requestTypeSchema = z.object({
  name: z.string().min(1, 'Nome tipo richiesta obbligatorio'),
  is_active: z.boolean(),
  fields_schema: z
    .array(fieldSchemaSchema)
    .min(1, 'Aggiungi almeno un campo')
    .refine(
      (fields) => {
        const names = fields.map((f) => f.name)
        return new Set(names).size === names.length
      },
      { message: 'Nomi dei campi duplicati. Ogni campo deve avere un nome univoco.' }
    ),
})

type RequestTypeFormData = z.infer<typeof requestTypeSchema>

interface RequestTypeDialogProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: RequestTypeFormData) => Promise<void>
  requestType?: RequestType | null
  isLoading?: boolean
}

export default function RequestTypeDialog({
  open,
  onClose,
  onSubmit,
  requestType,
  isLoading = false,
}: RequestTypeDialogProps) {
  const isEditing = !!requestType

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RequestTypeFormData>({
    resolver: zodResolver(requestTypeSchema),
    defaultValues: {
      name: '',
      is_active: true,
      fields_schema: [],
    },
  })

  useEffect(() => {
    if (requestType) {
      reset({
        name: requestType.name,
        is_active: requestType.is_active,
        fields_schema: requestType.fields_schema.map((field) => ({
          ...field,
          // Converti options da string array a string per textarea (gestito da setValueAs)
          options: field.options || [],
        })),
      })
    } else {
      reset({
        name: '',
        is_active: true,
        fields_schema: [],
      })
    }
  }, [requestType, reset, open])

  const handleFormSubmit = async (data: RequestTypeFormData) => {
    try {
      await onSubmit(data)
      reset()
    } catch (error) {
      console.error('Errore nel salvataggio:', error)
    }
  }

  const handleClose = () => {
    if (!isSubmitting) {
      reset()
      onClose()
    }
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        component: 'form',
        onSubmit: handleSubmit(handleFormSubmit),
      }}
    >
      <DialogTitle>
        {isEditing ? 'Modifica Tipo Richiesta' : 'Nuovo Tipo Richiesta'}
      </DialogTitle>

      <DialogContent>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
            <TextField
              label="Nome Tipo Richiesta"
              placeholder="es: Supporto IT, Manutenzione, DM329"
              {...register('name')}
              error={!!errors.name}
              helperText={errors.name?.message}
              fullWidth
              autoFocus
            />

            <FormControlLabel
              control={<Switch {...register('is_active')} defaultChecked />}
              label="Tipo richiesta attivo"
            />

            {errors.fields_schema?.root && (
              <Alert severity="error">{errors.fields_schema.root.message}</Alert>
            )}

            <FieldSchemaBuilder control={control} register={register} errors={errors} watch={watch} />
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={isSubmitting}>
          Annulla
        </Button>
        <Button
          type="submit"
          variant="contained"
          disabled={isSubmitting || isLoading}
        >
          {isSubmitting ? 'Salvataggio...' : isEditing ? 'Salva Modifiche' : 'Crea'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
