/**
 * Manufacturers API Service
 *
 * Service layer per CRUD operations sui costruttori/marche.
 * Pattern identico a customers.ts con gestione discriminata italiani/esteri.
 */

import { supabase } from '../supabase'
import {
  Manufacturer,
  ManufacturerCompleteness,
  ManufacturerFilters,
  ManufacturersResponse,
  CreateManufacturerInput,
  UpdateManufacturerInput,
} from '@/types/manufacturer'
import {
  validateManufacturerInput,
  normalizeTelefono,
  normalizeProvincia,
  normalizePartitaIva,
  normalizeCap,
  formatFullAddress,
  formatManufacturerDisplay,
  getMissingManufacturerFields,
} from '@/utils/manufacturerValidation'

export const manufacturersApi = {
  /**
   * Get all manufacturers with pagination, search, and filters
   */
  getAll: async (filters?: ManufacturerFilters): Promise<ManufacturersResponse> => {
    const page = filters?.page || 0
    const pageSize = filters?.pageSize || 50
    const from = page * pageSize
    const to = from + pageSize - 1

    // First, get the total count
    let countQuery = supabase
      .from('manufacturers')
      .select('*', { count: 'exact', head: true })

    // Filter by active status (default to true)
    const isActive = filters?.is_active !== undefined ? filters.is_active : true
    countQuery = countQuery.eq('is_active', isActive)

    // Filter by tipo (italiano/estero)
    if (filters?.is_estero !== undefined) {
      countQuery = countQuery.eq('is_estero', filters.is_estero)
    }

    // Apply search filter if provided (fuzzy search on nome)
    if (filters?.search && filters.search.trim().length > 0) {
      const searchTerm = filters.search.trim()
      countQuery = countQuery.ilike('nome', `%${searchTerm}%`)
    }

    const { count, error: countError } = await countQuery

    if (countError) {
      console.error('Error counting manufacturers:', countError)
      throw new Error(`Errore nel conteggio dei costruttori: ${countError.message}`)
    }

    // Then, get the paginated data
    let query = supabase
      .from('manufacturers')
      .select('*')
      .order('usage_count', { ascending: false }) // Più usati prima
      .order('nome') // Secondary sort by name

    query = query.eq('is_active', isActive)

    if (filters?.is_estero !== undefined) {
      query = query.eq('is_estero', filters.is_estero)
    }

    if (filters?.search && filters.search.trim().length > 0) {
      const searchTerm = filters.search.trim()
      query = query.ilike('nome', `%${searchTerm}%`)
    }

    // Apply pagination
    query = query.range(from, to)

    const { data, error } = await query

    if (error) {
      console.error('Error fetching manufacturers:', error)
      throw new Error(`Errore nel caricamento dei costruttori: ${error.message}`)
    }

    const totalCount = count || 0
    const totalPages = Math.ceil(totalCount / pageSize)

    return {
      data: data || [],
      count: totalCount,
      page,
      pageSize,
      totalPages,
    }
  },

  /**
   * Get single manufacturer by ID
   */
  getById: async (id: string): Promise<Manufacturer> => {
    const { data, error } = await supabase
      .from('manufacturers')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching manufacturer:', error)
      throw new Error(`Errore nel caricamento del costruttore: ${error.message}`)
    }

    return data
  },

  /**
   * Get manufacturers by nome (for autocomplete)
   */
  getByNome: async (nome: string): Promise<Manufacturer[]> => {
    const { data, error } = await supabase
      .from('manufacturers')
      .select('*')
      .ilike('nome', `%${nome}%`)
      .eq('is_active', true)
      .order('usage_count', { ascending: false })
      .limit(20)

    if (error) {
      console.error('Error fetching manufacturers by nome:', error)
      throw new Error(`Errore nella ricerca costruttori: ${error.message}`)
    }

    return data || []
  },

  /**
   * Create new manufacturer
   * Validates input and normalizes data based on is_estero
   */
  create: async (input: CreateManufacturerInput): Promise<Manufacturer> => {
    // Validate input with Zod discriminated union
    const errors = validateManufacturerInput(input)
    if (errors.length > 0) {
      throw new Error(`Dati costruttore non validi:\n${errors.join('\n')}`)
    }

    // Prepare insert data based on type
    const insertData: any = {
      nome: input.nome.trim(),
      is_estero: input.is_estero,
      is_active: true,
      usage_count: 0,
    }

    if (input.is_estero === false) {
      // Italian manufacturer
      insertData.partita_iva = normalizePartitaIva(input.partita_iva)
      insertData.telefono = normalizeTelefono(input.telefono)
      insertData.via = input.via.trim()
      insertData.numero_civico = input.numero_civico.trim()
      insertData.cap = normalizeCap(input.cap)
      insertData.comune = input.comune.trim()
      insertData.provincia = normalizeProvincia(input.provincia)
      insertData.paese = null
    } else {
      // Foreign manufacturer
      insertData.paese = input.paese.trim()
      // All Italian fields NULL
      insertData.partita_iva = null
      insertData.telefono = null
      insertData.via = null
      insertData.numero_civico = null
      insertData.cap = null
      insertData.comune = null
      insertData.provincia = null
    }

    const { data, error } = await supabase
      .from('manufacturers')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      console.error('Error creating manufacturer:', error)

      // Handle unique constraint violation
      if (error.code === '23505') {
        throw new Error(`Un costruttore con nome "${input.nome}" esiste già`)
      }

      throw new Error(`Errore nella creazione del costruttore: ${error.message}`)
    }

    return data
  },

  /**
   * Update manufacturer
   * Allows partial updates with proper normalization
   */
  update: async (id: string, input: UpdateManufacturerInput): Promise<Manufacturer> => {
    const updateData: any = {}

    // Nome update
    if (input.nome !== undefined) {
      const nome = input.nome.trim()
      if (!nome || nome.length === 0) {
        throw new Error('Il nome del costruttore non può essere vuoto')
      }
      updateData.nome = nome
    }

    // is_estero update (careful - changes required fields!)
    if (input.is_estero !== undefined) {
      updateData.is_estero = input.is_estero

      // When switching from estero to italiano, clear paese
      if (input.is_estero === false) {
        updateData.paese = null
      }

      // When switching from italiano to estero, clear Italian fields
      if (input.is_estero === true) {
        updateData.partita_iva = null
        updateData.telefono = null
        updateData.via = null
        updateData.numero_civico = null
        updateData.cap = null
        updateData.comune = null
        updateData.provincia = null
      }
    }

    // Italian fields (only process if not already cleared by is_estero switch)
    if ('partita_iva' in input && updateData.is_estero !== true) {
      updateData.partita_iva = input.partita_iva ? normalizePartitaIva(input.partita_iva) : null
    }

    if ('telefono' in input && updateData.is_estero !== true) {
      updateData.telefono = input.telefono ? normalizeTelefono(input.telefono) : null
    }

    if ('via' in input && updateData.is_estero !== true) {
      updateData.via = input.via ? input.via.trim() : null
    }

    if ('numero_civico' in input && updateData.is_estero !== true) {
      updateData.numero_civico = input.numero_civico ? input.numero_civico.trim() : null
    }

    if ('cap' in input && updateData.is_estero !== true) {
      updateData.cap = input.cap ? normalizeCap(input.cap) : null
    }

    if ('comune' in input && updateData.is_estero !== true) {
      updateData.comune = input.comune ? input.comune.trim() : null
    }

    if ('provincia' in input && updateData.is_estero !== true) {
      updateData.provincia = input.provincia ? normalizeProvincia(input.provincia) : null
    }

    // Foreign field (only process if not already cleared by is_estero switch)
    if ('paese' in input && updateData.is_estero !== false) {
      updateData.paese = input.paese ? input.paese.trim() : null
    }

    console.log('Update data being sent:', JSON.stringify(updateData, null, 2))

    const { data, error } = await supabase
      .from('manufacturers')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating manufacturer:', error)
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      })

      // Handle unique constraint violation
      if (error.code === '23505') {
        throw new Error(`Un costruttore con questo nome esiste già`)
      }

      throw new Error(`Errore nell'aggiornamento del costruttore: ${error.message}`)
    }

    console.log('Update successful:', data)
    return data
  },

  /**
   * Soft delete manufacturer (set is_active to false)
   */
  delete: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('manufacturers')
      .update({ is_active: false })
      .eq('id', id)

    if (error) {
      console.error('Error deleting manufacturer:', error)
      throw new Error(`Errore nell'eliminazione del costruttore: ${error.message}`)
    }
  },

  /**
   * Hard delete manufacturer (use with caution)
   * Will fail if manufacturer is referenced by equipment
   */
  hardDelete: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('manufacturers')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error hard deleting manufacturer:', error)
      throw new Error(
        `Impossibile eliminare il costruttore: ${error.message}. ` +
        `Potrebbe essere referenziato da apparecchiature esistenti.`
      )
    }
  },

  /**
   * Check if manufacturer has all required fields populated
   * Uses database function for server-side validation
   */
  checkCompleteness: async (manufacturerId: string): Promise<ManufacturerCompleteness> => {
    const { data, error } = await supabase
      .rpc('check_manufacturer_completeness', { manufacturer_id_param: manufacturerId })

    if (error) {
      console.error('Error checking manufacturer completeness:', error)
      throw new Error(`Errore verifica completezza: ${error.message}`)
    }

    // Handle error response from function
    if (data.error) {
      throw new Error(data.error)
    }

    if (data.is_complete === true) {
      return { isComplete: true, missingFields: [] }
    }

    // If not complete, fetch manufacturer to identify missing fields with labels
    const manufacturer = await manufacturersApi.getById(manufacturerId)
    const missingFields = getMissingManufacturerFields(manufacturer)

    return { isComplete: false, missingFields }
  },

  /**
   * Find potential duplicate manufacturers using fuzzy matching
   * Uses pg_trgm similarity
   */
  findDuplicates: async (
    manufacturerName: string,
    _threshold: number = 0.6
  ): Promise<Array<Manufacturer & { similarity_score: number }>> => {
    // For now, use simple ILIKE search
    // TODO: Implement proper fuzzy search with similarity function using _threshold
    const { data, error } = await supabase
      .from('manufacturers')
      .select('*')
      .ilike('nome', `%${manufacturerName}%`)
      .limit(10)

    if (error) {
      console.error('Error finding duplicate manufacturers:', error)
      throw new Error(`Errore nella ricerca duplicati: ${error.message}`)
    }

    // Add dummy similarity_score for compatibility
    return (data || []).map(m => ({ ...m, similarity_score: 0.8 }))
  },

  /**
   * Increment usage_count when manufacturer is used in equipment
   */
  incrementUsageCount: async (id: string): Promise<void> => {
    const { error } = await supabase
      .rpc('increment', {
        table_name: 'manufacturers',
        row_id: id,
        column_name: 'usage_count',
      })

    if (error) {
      console.error('Error incrementing usage count:', error)
      // Non-blocking error - log but don't throw
    }
  },

  /**
   * Utility: Format manufacturer's complete address
   * For Italian: "Via Numero, CAP Comune (PR)"
   * For Foreign: "Paese"
   */
  formatFullAddress,

  /**
   * Utility: Format manufacturer display with country if foreign
   * "Nome Costruttore" or "Nome Costruttore (Paese)"
   */
  formatDisplay: formatManufacturerDisplay,
}
