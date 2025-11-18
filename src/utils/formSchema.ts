import { z } from 'zod'
import { FieldSchema } from '@/types'

/**
 * Generates a Zod schema dynamically from field definitions
 */
export const generateZodSchema = (fields: FieldSchema[]) => {
  const schemaFields: Record<string, z.ZodTypeAny> = {}

  fields.forEach(field => {
    let fieldSchema: z.ZodTypeAny

    switch (field.type) {
      case 'text':
        if (field.required) {
          fieldSchema = z.string().min(1, `${field.label} è obbligatorio`)
        } else {
          fieldSchema = z.string()
        }
        break

      case 'textarea':
        if (field.required) {
          fieldSchema = z.string().min(1, `${field.label} è obbligatorio`)
        } else {
          fieldSchema = z.string()
        }
        break

      case 'boolean':
        fieldSchema = z.boolean()
        break

      case 'select':
        if (field.options && field.options.length > 0) {
          if (field.required) {
            const enumSchema = z.enum(field.options as [string, ...string[]])
            fieldSchema = enumSchema.refine(val => val !== '', {
              message: `${field.label} è obbligatorio`,
            })
          } else {
            // Per campi non obbligatori, permetti stringa vuota o uno dei valori enum
            fieldSchema = z.union([
              z.literal(''),
              z.enum(field.options as [string, ...string[]])
            ])
          }
        } else {
          fieldSchema = z.string()
        }
        break

      case 'multiselect':
        if (field.required) {
          fieldSchema = z.array(z.string()).min(1, `Seleziona almeno una opzione per ${field.label}`)
        } else {
          fieldSchema = z.array(z.string())
        }
        break

      case 'file':
        fieldSchema = z.any() // File handling will be done separately
        break

      case 'date':
        if (field.required) {
          fieldSchema = z.string().min(1, `${field.label} è obbligatorio`)
        } else {
          fieldSchema = z.string()
        }
        break

      case 'number':
        let numberSchema = z.number({
          invalid_type_error: `${field.label} deve essere un numero`,
        })

        if (field.min !== undefined) {
          numberSchema = numberSchema.min(field.min as number, `${field.label} deve essere >= ${field.min}`)
        }
        if (field.max !== undefined) {
          numberSchema = numberSchema.max(field.max as number, `${field.label} deve essere <= ${field.max}`)
        }

        if (field.required) {
          fieldSchema = numberSchema
        } else {
          fieldSchema = numberSchema.optional()
        }
        break

      case 'datetime-local':
        if (field.required) {
          fieldSchema = z.string().min(1, `${field.label} è obbligatorio`)
        } else {
          fieldSchema = z.string()
        }
        break

      case 'autocomplete':
        // Autocomplete returns an object with id and other fields
        const customerSchema = z.object({
          id: z.string().uuid(),
          ragione_sociale: z.string(),
          is_active: z.boolean().optional(),
          external_id: z.string().nullable().optional(),
          created_at: z.string().optional(),
          updated_at: z.string().optional(),
          created_by: z.string().nullable().optional(),
        })

        if (field.required) {
          fieldSchema = customerSchema.refine(val => !!val?.id, {
            message: `${field.label} è obbligatorio`,
          })
        } else {
          fieldSchema = customerSchema.nullable()
        }
        break

      case 'address-autocomplete':
        // Address autocomplete can be either a string or an object
        const addressSchema = z.union([
          z.string(),
          z.object({
            address: z.string(),
            formatted: z.object({
              place_id: z.string(),
              formatted_address: z.string(),
            }).nullable().optional(),
          }),
        ])

        if (field.required) {
          fieldSchema = addressSchema.refine(
            val => {
              if (typeof val === 'string') return val.length > 0
              return val?.address && val.address.length > 0
            },
            {
              message: `${field.label} è obbligatorio`,
            }
          )
        } else {
          fieldSchema = addressSchema.optional()
        }
        break

      default:
        fieldSchema = z.any()
    }

    // Make field optional if not required
    if (!field.required) {
      fieldSchema = fieldSchema.optional()
    }

    schemaFields[field.name] = fieldSchema
  })

  return z.object(schemaFields)
}

/**
 * Get default values for a form based on field schema
 */
export const getDefaultValues = (fields: FieldSchema[]): Record<string, any> => {
  const defaults: Record<string, any> = {}

  fields.forEach(field => {
    switch (field.type) {
      case 'text':
      case 'textarea':
      case 'select':
      case 'date':
      case 'datetime-local':
        defaults[field.name] = ''
        break
      case 'number':
        defaults[field.name] = field.min || 0
        break
      case 'boolean':
        defaults[field.name] = false
        break
      case 'multiselect':
        defaults[field.name] = []
        break
      case 'file':
        defaults[field.name] = null
        break
      case 'autocomplete':
        defaults[field.name] = null
        break
      case 'address-autocomplete':
        defaults[field.name] = ''
        break
      case 'repeatable_group':
        defaults[field.name] = []
        break
      default:
        defaults[field.name] = ''
    }
  })

  return defaults
}

/**
 * Generates a Zod schema with custom validations for specific request types
 */
export const generateZodSchemaWithValidations = (
  fields: FieldSchema[],
  requestTypeName?: string
) => {
  const baseSchema = generateZodSchema(fields)

  // Apply custom validations based on request type
  if (requestTypeName === 'DISEGNO_SALA_SCHEMA' || requestTypeName === 'DISEGNO_SALA_LAYOUT') {
    // Obbligatorietà alternativa: file_attachment OR lista_apparecchi
    return baseSchema.refine(
      data => {
        const hasFile = data.file_attachment && (
          (Array.isArray(data.file_attachment) && data.file_attachment.length > 0) ||
          (!Array.isArray(data.file_attachment) && data.file_attachment !== null)
        )
        const hasListaApparecchi = data.lista_apparecchi &&
          typeof data.lista_apparecchi === 'string' &&
          data.lista_apparecchi.trim().length > 0

        return hasFile || hasListaApparecchi
      },
      {
        message: 'Compilare almeno uno tra File Attachment e Lista Apparecchi',
        path: ['file_attachment'],
      }
    )
  }

  // Validazione cross-field per date
  return baseSchema.refine(
    data => {
      // data_fine >= data_inizio
      if (data.data_inizio && data.data_fine) {
        return new Date(data.data_fine) >= new Date(data.data_inizio)
      }
      return true
    },
    {
      message: 'La data fine deve essere successiva o uguale alla data inizio',
      path: ['data_fine'],
    }
  ).refine(
    data => {
      // rilevate_perdite_a >= rilevate_perdite_da
      if (data.rilevate_perdite_da && data.rilevate_perdite_a) {
        return new Date(data.rilevate_perdite_a) >= new Date(data.rilevate_perdite_da)
      }
      return true
    },
    {
      message: 'La data/ora fine deve essere successiva o uguale alla data/ora inizio',
      path: ['rilevate_perdite_a'],
    }
  )
}
