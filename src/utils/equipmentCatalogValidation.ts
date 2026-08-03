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
      'La pressione va nei dati tecnici, non nel nome: toglila dal modello e compilala fra i dati tecnici',
  })

/**
 * Un dato tecnico non compilato non è un valore: la chiave si toglie prima di validare.
 *
 * Il form ne produce sempre — i campi svuotati valgono `null`, quelli mai toccati
 * `undefined`, e chi sparisce al cambio di tipologia costruttiva (la regolazione dei
 * giri quando il compressore non è a vite) lascia la propria chiave dietro di sé.
 * Ripulire qui, e non in ogni punto che salva, è ciò che impedisce a una scheda
 * compilata correttamente di essere respinta perché un campo che non la riguarda
 * è rimasto vuoto.
 */
const rimuoviSpecsVuote = (v: unknown): unknown => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return v
  return Object.fromEntries(
    Object.entries(v as Record<string, unknown>).filter(
      ([, valore]) => valore !== null && valore !== undefined && valore !== ''
    )
  )
}

export const createEquipmentSchema = z.object({
  tipo_apparecchiatura: z.enum(
    EQUIPMENT_CATALOG_TYPES as [EquipmentCatalogType, ...EquipmentCatalogType[]],
    { errorMap: () => ({ message: 'Seleziona il tipo di apparecchiatura' }) }
  ),
  marca: marcaSchema,
  modello: modelloSchema,
  specs: z.preprocess(
    rimuoviSpecsVuote,
    z.record(z.union([z.number(), z.string()])).optional()
  ),
  aliases: z.array(z.string()).optional(),
})

export const updateEquipmentSchema = createEquipmentSchema.partial()

export type CreateEquipmentInput = z.infer<typeof createEquipmentSchema>
export type UpdateEquipmentInput = z.infer<typeof updateEquipmentSchema>

/**
 * Schema dei dati tecnici del tipo scelto, generato dal contratto canonico:
 * i campi del form e le regole di validazione restano così una cosa sola.
 *
 * A differenza di `specsFieldsFor`, qui **non** si filtrano le definizioni `isInternal`. Non è
 * una svista: `pressione_esercizio` sui compressori è interna all'interfaccia — non si mostra,
 * non si modifica — ma è comunque un dato che una riga porta con sé e che questo schema deve
 * saper validare quando la riga si salva. Se questo filtro venisse aggiunto, per uniformarlo a
 * `specsFieldsFor`, il parse scarterebbe silenziosamente `pressione_esercizio` da ogni scrittura
 * fatta dal form del catalogo: la chiave dell'indice unico sparirebbe al primo salvataggio e le
 * varianti dello stesso modello collasserebbero l'una nell'altra.
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
    // Il percorso completo, non solo la radice: «specs: Invalid input» non dice
    // quale dato tecnico sia stato rifiutato, ed è un messaggio che non aiuta
    // né chi compila né chi dovrà capire perché il salvataggio non è passato.
    const [radice, ...resto] = e.path.map(String)
    const campo = EQUIPMENT_FIELD_LABELS[radice] ?? radice
    return `${[campo, ...resto].join(' › ')}: ${e.message}`
  })
}

/**
 * Definizioni dei dati tecnici del tipo che l'interfaccia deve mostrare.
 *
 * È l'unico filtro di visibilità del catalogo: lo usano sia i campi del form sia le chip
 * della tabella, così le due non possono divergere. Esclude le definizioni interne — dati
 * che servono al funzionamento ma non si mostrano — e quelle che non si applicano alla
 * riga: la regolazione dei giri compare solo sui compressori rotativi a vite.
 *
 * `specs` serve a valutare le condizioni; omettendolo si ottengono tutte le definizioni
 * non interne.
 */
export function specsFieldsFor(
  tipo: EquipmentCatalogType | null,
  specs?: Record<string, unknown> | null
): readonly CanonicalSpecDef[] {
  const defs = (tipo ? CANONICAL_SPECS[tipo] ?? [] : []).filter(d => !d.isInternal)
  if (!specs) return defs
  return defs.filter(d => !d.appliesWhen || d.appliesWhen(specs))
}
