import { supabase } from '../supabase'
import type { EquipmentCatalogItem, EquipmentCatalogType } from '@/types'
import type { CatalogRow, FindingFix } from '@/services/equipmentAudit'
import { missingCanonicalSpecs } from '@/services/equipmentAudit'
import {
  createEquipmentSchema,
  normalizeMarca,
  normalizeModello,
  updateEquipmentSchema,
  validateEquipmentInput,
  type CreateEquipmentInput,
  type UpdateEquipmentInput,
} from '@/utils/equipmentCatalogValidation'

/**
 * Gestione del catalogo apparecchiature.
 *
 * Separato da `equipmentCatalog.ts`, che serve la scheda dati in sola lettura:
 * qui vivono le operazioni del modulo di amministrazione, comprese quelle di
 * massa che passano dalla funzione transazionale `apply_equipment_fixes`.
 */

export interface CatalogFilters {
  /** Ricerca su marca e modello. */
  search?: string
  tipo?: EquipmentCatalogType
  marca?: string
  /** `'all'` include anche le voci disattivate. */
  isActive?: boolean | 'all'
  /** Solo voci a cui mancano dati tecnici obbligatori (filtro applicato a valle). */
  soloIncompleti?: boolean
  page?: number
  pageSize?: number
  orderBy?: 'marca' | 'modello' | 'usage_count' | 'updated_at'
  orderDir?: 'asc' | 'desc'
}

export interface CatalogListResponse {
  data: EquipmentCatalogItem[]
  count: number
  page: number
  pageSize: number
  totalPages: number
}

/** PostgREST non restituisce più di 1000 righe per chiamata. */
const PAGE_LIMIT = 1000

const SELECT_FIELDS =
  'id, tipo, tipo_apparecchiatura, marca, modello, aliases, specs, is_active, is_user_defined, usage_count, created_at, updated_at, created_by'

function describeError(error: { code?: string; message: string }, azione: string): Error {
  if (error.code === '23505') {
    return new Error(
      'Esiste già una voce con questi tipo, marca, modello e pressione. ' +
        'Se non compare in elenco potrebbe essere disattivata: mostra anche le voci disattivate e riattivala.'
    )
  }
  return new Error(`${azione}: ${error.message}`)
}

/** Riga di catalogo nella forma attesa dal motore di verifica. */
export function toCatalogRow(item: EquipmentCatalogItem): CatalogRow {
  return {
    id: item.id,
    tipoLegacy: item.tipo ?? null,
    tipoApparecchiatura: item.tipo_apparecchiatura ?? null,
    marca: item.marca,
    modello: item.modello,
    specs: (item.specs ?? {}) as Record<string, unknown>,
    isActive: item.is_active,
    usageCount: item.usage_count ?? 0,
  }
}

export const equipmentCatalogAdminApi = {
  async list(filters: CatalogFilters = {}): Promise<CatalogListResponse> {
    const page = filters.page ?? 0
    const pageSize = filters.pageSize ?? 50
    const orderBy = filters.orderBy ?? 'marca'
    const orderDir = filters.orderDir ?? 'asc'

    // Il filtro «solo incompleti» dipende dai dati tecnici, che vanno letti
    // tollerando entrambi i formati: non è esprimibile in una query e si applica
    // dopo, su tutto l'insieme filtrato.
    if (filters.soloIncompleti) {
      const tutte = await this.listAll(filters)
      const incomplete = tutte.filter(
        r => missingCanonicalSpecs(r.tipo_apparecchiatura ?? null, r.specs).length > 0
      )
      const from = page * pageSize
      return {
        data: incomplete.slice(from, from + pageSize),
        count: incomplete.length,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(incomplete.length / pageSize)),
      }
    }

    // `count: 'exact'` sulla stessa query evita la chiamata separata di conteggio:
    // il totale è quello dei filtri, indipendente dalla pagina richiesta.
    let query = supabase
      .from('equipment_catalog')
      .select(SELECT_FIELDS, { count: 'exact' })

    if (filters.isActive !== 'all') query = query.eq('is_active', filters.isActive ?? true)
    if (filters.tipo) query = query.eq('tipo_apparecchiatura', filters.tipo)
    if (filters.marca) query = query.eq('marca', filters.marca)
    const search = filters.search?.trim()
    if (search) query = query.or(`marca.ilike.%${search}%,modello.ilike.%${search}%`)

    const from = page * pageSize
    const { data, count, error } = await query
      .order(orderBy, { ascending: orderDir === 'asc' })
      .order('modello', { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) throw describeError(error, 'Errore nel caricamento delle apparecchiature')

    const totalCount = count ?? 0
    return {
      data: (data ?? []) as EquipmentCatalogItem[],
      count: totalCount,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
    }
  },

  /** Tutte le righe che soddisfano i filtri, paginando oltre il limite di PostgREST. */
  async listAll(filters: CatalogFilters = {}): Promise<EquipmentCatalogItem[]> {
    const out: EquipmentCatalogItem[] = []

    for (let offset = 0; ; offset += PAGE_LIMIT) {
      let q = supabase.from('equipment_catalog').select(SELECT_FIELDS)
      if (filters.isActive !== 'all') q = q.eq('is_active', filters.isActive ?? true)
      if (filters.tipo) q = q.eq('tipo_apparecchiatura', filters.tipo)
      if (filters.marca) q = q.eq('marca', filters.marca)
      const search = filters.search?.trim()
      if (search) q = q.or(`marca.ilike.%${search}%,modello.ilike.%${search}%`)

      const { data, error } = await q.order('id').range(offset, offset + PAGE_LIMIT - 1)
      if (error) throw describeError(error, 'Errore nel caricamento del catalogo')

      out.push(...((data ?? []) as EquipmentCatalogItem[]))
      if (!data || data.length < PAGE_LIMIT) break
    }

    return out
  },

  /**
   * Catalogo completo per la verifica di coerenza.
   *
   * Include le voci disattivate: gli indici di unicità non le escludono, quindi
   * una voce disattivata continua a impedire di ricrearne una identica ed è un
   * caso che la verifica deve poter vedere.
   */
  async listAllForAudit(): Promise<CatalogRow[]> {
    const rows = await this.listAll({ isActive: 'all' })
    return rows.map(toCatalogRow)
  },

  async getById(id: string): Promise<EquipmentCatalogItem> {
    const { data, error } = await supabase
      .from('equipment_catalog')
      .select(SELECT_FIELDS)
      .eq('id', id)
      .single()

    if (error) throw describeError(error, 'Errore nel caricamento dell’apparecchiatura')
    return data as EquipmentCatalogItem
  },

  /** Marche presenti, opzionalmente ristrette a un tipo. */
  async getMarche(tipo?: EquipmentCatalogType): Promise<string[]> {
    let q = supabase.from('equipment_catalog').select('marca')
    if (tipo) q = q.eq('tipo_apparecchiatura', tipo)

    const { data, error } = await q.order('marca')
    if (error) throw describeError(error, 'Errore nel caricamento delle marche')

    return [...new Set((data ?? []).map(r => r.marca as string))].filter(Boolean)
  },

  async create(input: CreateEquipmentInput): Promise<EquipmentCatalogItem> {
    const errors = validateEquipmentInput(input)
    if (errors.length > 0) throw new Error(errors.join('; '))

    const parsed = createEquipmentSchema.parse(input)
    const { data: session } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from('equipment_catalog')
      .insert({
        // Colonna storica, mantenuta allineata al tipo strutturato.
        tipo: parsed.tipo_apparecchiatura,
        tipo_apparecchiatura: parsed.tipo_apparecchiatura,
        marca: normalizeMarca(parsed.marca),
        modello: normalizeModello(parsed.modello),
        specs: parsed.specs ?? {},
        aliases: parsed.aliases ?? null,
        is_user_defined: true,
        created_by: session.user?.id ?? null,
      })
      .select(SELECT_FIELDS)
      .single()

    if (error) throw describeError(error, 'Errore nella creazione dell’apparecchiatura')
    return data as EquipmentCatalogItem
  },

  async update(id: string, input: UpdateEquipmentInput): Promise<EquipmentCatalogItem> {
    const parsed = updateEquipmentSchema.parse(input)
    const patch: Record<string, unknown> = {}

    if (parsed.tipo_apparecchiatura !== undefined) {
      patch.tipo_apparecchiatura = parsed.tipo_apparecchiatura
      patch.tipo = parsed.tipo_apparecchiatura
    }
    if (parsed.marca !== undefined) patch.marca = normalizeMarca(parsed.marca)
    if (parsed.modello !== undefined) patch.modello = normalizeModello(parsed.modello)
    if (parsed.specs !== undefined) patch.specs = parsed.specs
    if (parsed.aliases !== undefined) patch.aliases = parsed.aliases

    const { data, error } = await supabase
      .from('equipment_catalog')
      .update(patch)
      .eq('id', id)
      .select(SELECT_FIELDS)
      .single()

    if (error) throw describeError(error, 'Errore nell’aggiornamento dell’apparecchiatura')
    return data as EquipmentCatalogItem
  },

  /** Disattivazione: la voce sparisce dai menu ma resta leggibile dalle pratiche che la citano. */
  async setActive(id: string, isActive: boolean): Promise<void> {
    const { error } = await supabase
      .from('equipment_catalog')
      .update({ is_active: isActive })
      .eq('id', id)

    if (error) throw describeError(error, 'Errore nel cambio di stato dell’apparecchiatura')
  },

  async hardDelete(id: string): Promise<void> {
    const { error } = await supabase.from('equipment_catalog').delete().eq('id', id)
    if (error) throw describeError(error, 'Errore nell’eliminazione dell’apparecchiatura')
  },

  /**
   * Quante schede dati citano questa voce.
   *
   * Le schede riferiscono il catalogo per marca e modello, non per identificativo:
   * il conteggio si fa quindi confrontando le stringhe, ed è ciò che va mostrato
   * prima di eliminare o rinominare.
   */
  async countSheetReferences(marca: string, modello: string): Promise<number> {
    const { data, error } = await supabase
      .from('dm329_technical_data')
      .select('equipment_data')
      .not('equipment_data', 'eq', '{}')

    if (error) throw describeError(error, 'Errore nel conteggio dei riferimenti')

    const cerca = (node: unknown): number => {
      if (Array.isArray(node)) return node.reduce<number>((n, v) => n + cerca(v), 0)
      if (!node || typeof node !== 'object') return 0

      const obj = node as Record<string, unknown>
      const combacia = obj.marca === marca && obj.modello === modello
      return (
        (combacia ? 1 : 0) + Object.values(obj).reduce<number>((n, v) => n + cerca(v), 0)
      )
    }

    return (data ?? []).reduce<number>((n, r) => n + cerca(r.equipment_data), 0)
  },

  /**
   * Applica le correzioni proposte dal motore, in un'unica transazione.
   *
   * Passa dalla funzione `apply_equipment_fixes` invece che da tante scritture
   * separate: normalizzare l'intero catalogo sono oltre mille aggiornamenti, e
   * un'interruzione a metà lo lascerebbe in uno stato misto.
   */
  async applyFixes(fixes: FindingFix[]): Promise<number> {
    const applicabili = fixes.filter(f => f.kind !== 'manual')
    if (applicabili.length === 0) return 0

    const { data, error } = await supabase.rpc('apply_equipment_fixes', {
      fixes: applicabili,
    })

    if (error) {
      if (error.code === '42501') {
        throw new Error('Non hai i permessi per correggere il catalogo apparecchiature')
      }
      throw describeError(error, 'Errore nell’applicazione delle correzioni')
    }

    return (data as { applied?: number } | null)?.applied ?? applicabili.length
  },
}
