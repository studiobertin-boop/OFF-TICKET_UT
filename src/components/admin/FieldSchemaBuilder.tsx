import {
  Box,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormControlLabel,
  Checkbox,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  Alert,
} from '@mui/material'
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  ExpandMore as ExpandMoreIcon,
  DragIndicator as DragIcon,
} from '@mui/icons-material'
import { useFieldArray, Control, UseFormRegister, FieldErrors, UseFormWatch } from 'react-hook-form'
import { FieldSchema } from '../../types'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface FieldSchemaBuilderProps {
  control: Control<any>
  register: UseFormRegister<any>
  errors: FieldErrors
  watch: UseFormWatch<any>
}

interface SortableFieldItemProps {
  field: FieldSchema & { id: string }
  index: number
  register: UseFormRegister<any>
  errors: FieldErrors
  watch: UseFormWatch<any>
  onRemove: () => void
  onDuplicate: () => void
}

const FIELD_TYPES = [
  { value: 'text', label: 'Testo breve' },
  { value: 'textarea', label: 'Testo lungo' },
  { value: 'boolean', label: 'Checkbox' },
  { value: 'select', label: 'Selezione singola' },
  { value: 'multiselect', label: 'Selezione multipla' },
  { value: 'file', label: 'File upload' },
  { value: 'date', label: 'Data' },
  { value: 'autocomplete', label: 'Selezione con ricerca (Clienti)' },
] as const

function SortableFieldItem({ field, index, register, errors, watch, onRemove, onDuplicate }: SortableFieldItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  // Watch per rendere il tipo campo reattivo
  const fieldType = watch(`fields_schema.${index}.type`) || field.type || 'text'
  const showOptions = fieldType === 'select' || fieldType === 'multiselect'

  return (
    <div ref={setNodeRef} style={style}>
      <Accordion defaultExpanded={index === 0}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
            <IconButton
              size="small"
              {...attributes}
              {...listeners}
              sx={{ cursor: 'grab', '&:active': { cursor: 'grabbing' } }}
            >
              <DragIcon />
            </IconButton>
            <Typography sx={{ flexGrow: 1 }}>
              {field.label || `Campo ${index + 1}`}
              {field.required && <Typography component="span" color="error"> *</Typography>}
              {field.hidden && <Typography component="span" color="text.secondary"> (nascosto)</Typography>}
            </Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Nome campo (snake_case)"
              placeholder="es: nome_cliente"
              {...register(`fields_schema.${index}.name`, {
                required: 'Nome campo obbligatorio',
                pattern: {
                  value: /^[a-z_]+$/,
                  message: 'Solo lettere minuscole e underscore',
                },
              })}
              error={!!errors.fields_schema?.[index]?.name}
              helperText={errors.fields_schema?.[index]?.name?.message as string}
              fullWidth
            />

            <TextField
              label="Etichetta campo"
              placeholder="es: Nome Cliente"
              {...register(`fields_schema.${index}.label`, {
                required: 'Etichetta obbligatoria',
              })}
              error={!!errors.fields_schema?.[index]?.label}
              helperText={errors.fields_schema?.[index]?.label?.message as string}
              fullWidth
            />

            <FormControl fullWidth>
              <InputLabel>Tipo campo</InputLabel>
              <Select
                label="Tipo campo"
                defaultValue={fieldType}
                {...register(`fields_schema.${index}.type`, {
                  required: 'Tipo obbligatorio',
                })}
              >
                {FIELD_TYPES.map((type) => (
                  <MenuItem key={type.value} value={type.value}>
                    {type.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {showOptions && (
              <TextField
                label="Opzioni (separate da virgola)"
                placeholder="es: Opzione 1, Opzione 2, Opzione 3"
                multiline
                rows={3}
                defaultValue={
                  Array.isArray(field.options)
                    ? field.options.join(', ')
                    : field.options || ''
                }
                {...register(`fields_schema.${index}.options`, {
                  required: showOptions ? 'Opzioni obbligatorie per select' : false,
                  setValueAs: (value: string | string[]) => {
                    // Se è già un array (durante la modifica), restituiscilo
                    if (Array.isArray(value)) return value
                    // Altrimenti convertilo da stringa
                    if (!value || typeof value !== 'string') return []
                    return value.split(',').map((v) => v.trim()).filter((v) => v.length > 0)
                  },
                })}
                error={!!errors.fields_schema?.[index]?.options}
                helperText={errors.fields_schema?.[index]?.options?.message as string}
                fullWidth
              />
            )}

            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    defaultChecked={field.required}
                    {...register(`fields_schema.${index}.required`)}
                  />
                }
                label="Campo obbligatorio"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    defaultChecked={field.hidden}
                    {...register(`fields_schema.${index}.hidden`)}
                  />
                }
                label="Nascosto nei nuovi form"
              />
            </Box>

            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
              <Button
                size="small"
                startIcon={<CopyIcon />}
                onClick={onDuplicate}
              >
                Duplica
              </Button>
              <Button
                size="small"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={onRemove}
              >
                Rimuovi
              </Button>
            </Box>
          </Box>
        </AccordionDetails>
      </Accordion>
    </div>
  )
}

export default function FieldSchemaBuilder({ control, register, errors, watch }: FieldSchemaBuilderProps) {
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: 'fields_schema',
  })

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = fields.findIndex((field) => field.id === active.id)
      const newIndex = fields.findIndex((field) => field.id === over.id)
      move(oldIndex, newIndex)
    }
  }

  const handleAddField = () => {
    append({
      name: '',
      type: 'text',
      label: '',
      required: false,
      hidden: false,
    })
  }

  const handleDuplicateField = (index: number) => {
    const fieldToDuplicate = fields[index] as any
    append({
      ...fieldToDuplicate,
      name: `${fieldToDuplicate.name}_copy`,
      label: `${fieldToDuplicate.label} (copia)`,
    })
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Campi del form</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAddField}
        >
          Aggiungi Campo
        </Button>
      </Box>

      {fields.length === 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Nessun campo configurato. Aggiungi almeno un campo per creare il tipo di richiesta.
        </Alert>
      )}

      {errors.fields_schema?.root && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errors.fields_schema.root.message as string}
        </Alert>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={fields.map((f) => f.id)}
          strategy={verticalListSortingStrategy}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {fields.map((field, index) => (
              <SortableFieldItem
                key={field.id}
                field={field as any}
                index={index}
                register={register}
                errors={errors}
                watch={watch}
                onRemove={() => remove(index)}
                onDuplicate={() => handleDuplicateField(index)}
              />
            ))}
          </Box>
        </SortableContext>
      </DndContext>
    </Box>
  )
}
