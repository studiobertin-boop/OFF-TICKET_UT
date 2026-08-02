import { z } from 'zod'
import type { EquipmentCatalogType } from '@/types'
import {
  CANONICAL_SPECS,
  parseModello,
  type CanonicalSpecDef,
} from '@/services/equipmentAudit'

/**
 * Validazione e normalizzazione delle voci di catalogo.
 *
 * Segue il modello di `installerValidation.ts`: schemi Zod, normalizzatori,
 * etichette dei campi. La regola più importante non è formale ma sostanziale —
 * il nome del modello non deve contenere la pressione — ed è ciò che impedisce
 * al catalogo di riformare la frattura che il modulo serve a sanare.
 */

export const EQUIPMENT_CATALOG_TYPES: readonly EquipmentCatalogType[] = [
  'Serbatoi',
  'Compressori',
  'Disoleatori',
  'Essiccatori',
  'Scambiatori',
  'Filtri',
  'Separatori',
  'Recipienti filtro',
  'Valvole di sicurezza',
  'Altro',
]

/** Spazi multipli collassati: due voci che differiscono solo per spaziatura sono la stessa. */
const collapse = (v: string) => v.trim().replace(/\s{2,}/g, ' ')

export const normalizeMarca = (v: string): string => collapse(v)
export const normalizeModello = (v: string): string => collapse(v)

const marcaSchema = z
  .string()
  .trim()
  .min(2, 'La marca deve avere almeno 2 caratteri')
  .max(120, 'La marca non può superare 120 caratteri')

const modelloSchema = z
  .string()
  .trim()
  .min(1, 'Il modello è obbligatorio')
  .max(120, 'Il modello non può superare 120 caratteri')
  .refine(v => parseModello(v).pattern === 'plain', {
    message:
      'La pressione va nei dati tecnici, non nel nome: toglila dal modello e compila «Pressione di esercizio»',
  })

export const createEquipmentSchema = z.object({
  tipo_apparecchiatura: z.enum(
    EQUIPMENT_CATALOG_TYPES as [EquipmentCatalogType, ...EquipmentCatalogType[]],
    { errorMap: () => ({ message: 'Seleziona il tipo di apparecchiatura' }) }
  ),
  marca: marcaSchema,
  modello: modelloSchema,
  specs: z.record(z.union([z.number(), z.string()])).optional(),
  aliases: z.array(z.string()).optional(),
})

export const updateEquipmentSchema = createEquipmentSchema.partial()

export type CreateEquipmentInput = z.infer<typeof createEquipmentSchema>
export type UpdateEquipmentInput = z.infer<typeof updateEquipmentSchema>

/**
 * Schema dei dati tecnici del tipo scelto, generato dal contratto canonico:
 * i campi del form e le regole di validazione restano così una cosa sola.
 */
export function specsSchemaFor(tipo: EquipmentCatalogType) {
  const shape: Record<string, z.ZodTypeAny> = {}

  for (const def of CANONICAL_SPECS[tipo] ?? []) {
    let field: z.ZodTypeAny

    if (def.kind === 'number') {
      let n = z.number({ invalid_type_error: `${def.label} deve essere un numero` })
      if (def.min !== undefined) n = n.min(def.min, `${def.label}: minimo ${def.min}`)
      if (def.max !== undefined) n = n.max(def.max, `${def.label}: massimo ${def.max}`)
      field = n
    } else if (def.kind === 'enum' && def.options?.length) {
      field = z.enum(def.options as [string, ...string[]])
    } else {
      field = z.string().max(120)
    }

    shape[def.key] = field.optional().nullable()
  }

  return z.object(shape)
}

export const EQUIPMENT_FIELD_LABELS: Record<string, string> = {
  tipo_apparecchiatura: 'Tipo',
  marca: 'Marca',
  modello: 'Modello',
  aliases: 'Nomi alternativi',
}

export function validateEquipmentInput(input: unknown): string[] {
  const result = createEquipmentSchema.safeParse(input)
  if (result.success) return []
  return result.error.errors.map(e => {
    const campo = EQUIPMENT_FIELD_LABELS[String(e.path[0])] ?? String(e.path[0])
    return `${campo}: ${e.message}`
  })
}

/**
 * Definizioni dei dati tecnici del tipo, per generare i campi del form.
 *
 * `specs` serve ai campi che dipendono da un altro dato della stessa riga: la regolazione dei
 * giri compare solo sui compressori rotativi a vite. Omettendolo si ottengono tutti i campi.
 */
export function specsFieldsFor(
  tipo: EquipmentCatalogType | null,
  specs?: Record<string, unknown> | null
): readonly CanonicalSpecDef[] {
  const defs = tipo ? CANONICAL_SPECS[tipo] ?? [] : []
  if (!specs) return defs
  return defs.filter(d => !d.appliesWhen || d.appliesWhen(specs))
}
