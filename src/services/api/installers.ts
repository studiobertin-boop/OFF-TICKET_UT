/**
 * Installers API Service
 *
 * Service layer per CRUD operations sugli installatori.
 * Pattern identico a manufacturers.ts ma più semplice (solo italiani)
 */

import { supabase } from '../supabase'
import {
  Installer,
  InstallerCompleteness,
  InstallerFilters,
  InstallersResponse,
  CreateInstallerInput,
  UpdateInstallerInput,
} from '@/types/installer'
import {
  validateInstallerInput,
  normalizeProvincia,
  normalizePartitaIva,
  normalizeCap,
  formatFullAddress,
  formatInstallerDisplay,
  getMissingInstallerFields,
} from '@/utils/installerValidation'

export const installersApi = {
  /**
   * Get all installers with pagination, search, and filters
   */
  getAll: async (filters?: InstallerFilters): Promise<InstallersResponse> => {
    const page = filters?.page || 0
    const pageSize = filters?.pageSize || 50
    const from = page * pageSize
    const to = from + pageSize - 1

    // First, get the total count
    let countQuery = supabase
      .from('installers')
      .select('*', { count: 'exact', head: true })

    // Filter by active status (default to true)
    const isActive = filters?.is_active !== undefined ? filters.is_active : true
    countQuery = countQuery.eq('is_active', isActive)

    // Apply search filter if provided (fuzzy search on nome)
    if (filters?.search && filters.search.trim().length > 0) {
      const searchTerm = filters.search.trim()
      countQuery = countQuery.ilike('nome', `%${searchTerm}%`)
    }

    const { count, error: countError } = await countQuery

    if (countError) {
      console.error('Error counting installers:', countError)
      throw new Error(`Errore nel conteggio degli installatori: ${countError.message}`)
    }

    // Then, get the paginated data
    let query = supabase
      .from('installers')
      .select('*')
      .order('usage_count', { ascending: false }) // Più usati prima
      .order('nome') // Secondary sort by name

    query = query.eq('is_active', isActive)

    if (filters?.search && filters.search.trim().length > 0) {
      const searchTerm = filters.search.trim()
      query = query.ilike('nome', `%${searchTerm}%`)
    }

    // Apply pagination
    query = query.range(from, to)

    const { data, error } = await query

    if (error) {
      console.error('Error fetching installers:', error)
      throw new Error(`Errore nel caricamento degli installatori: ${error.message}`)
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
   * Get single installer by ID
   */
  getById: async (id: string): Promise<Installer> => {
    const { data, error } = await supabase
      .from('installers')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching installer:', error)
      throw new Error(`Errore nel caricamento dell'installatore: ${error.message}`)
    }

    return data
  },

  /**
   * Get installers by nome (for autocomplete)
   */
  getByNome: async (nome: string): Promise<Installer[]> => {
    const { data, error } = await supabase
      .from('installers')
      .select('*')
      .ilike('nome', `%${nome}%`)
      .eq('is_active', true)
      .order('usage_count', { ascending: false })
      .limit(20)

    if (error) {
      console.error('Error fetching installers by nome:', error)
      throw new Error(`Errore nella ricerca installatori: ${error.message}`)
    }

    return data || []
  },

  /**
   * Create new installer
   * Validates input and normalizes data
   */
  create: async (input: CreateInstallerInput): Promise<Installer> => {
    // Validate input with Zod
    const errors = validateInstallerInput(input)
    if (errors.length > 0) {
      throw new Error(`Dati installatore non validi:\n${errors.join('\n')}`)
    }

    // Prepare insert data with normalization
    const insertData: any = {
      nome: input.nome.trim(),
      partita_iva: normalizePartitaIva(input.partita_iva),
      via: input.via.trim(),
      numero_civico: input.numero_civico.trim(),
      cap: normalizeCap(input.cap),
      comune: input.comune.trim(),
      provincia: normalizeProvincia(input.provincia),
      is_active: true,
      usage_count: 0,
    }

    const { data, error } = await supabase
      .from('installers')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      console.error('Error creating installer:', error)

      // Handle unique constraint violation
      if (error.code === '23505') {
        throw new Error(`Un installatore con nome "${input.nome}" esiste già`)
      }

      throw new Error(`Errore nella creazione dell'installatore: ${error.message}`)
    }

    return data
  },

  /**
   * Update installer
   * Allows partial updates with proper normalization
   */
  update: async (id: string, input: UpdateInstallerInput): Promise<Installer> => {
    const updateData: any = {}

    // Nome update
    if (input.nome !== undefined) {
      const nome = input.nome.trim()
      if (!nome || nome.length === 0) {
        throw new Error("Il nome dell'installatore non può essere vuoto")
      }
      updateData.nome = nome
    }

    // P.IVA update
    if ('partita_iva' in input) {
      updateData.partita_iva = input.partita_iva ? normalizePartitaIva(input.partita_iva) : null
    }

    // Via update
    if ('via' in input) {
      updateData.via = input.via ? input.via.trim() : null
    }

    // Numero civico update
    if ('numero_civico' in input) {
      updateData.numero_civico = input.numero_civico ? input.numero_civico.trim() : null
    }

    // CAP update
    if ('cap' in input) {
      updateData.cap = input.cap ? normalizeCap(input.cap) : null
    }

    // Comune update
    if ('comune' in input) {
      updateData.comune = input.comune ? input.comune.trim() : null
    }

    // Provincia update
    if ('provincia' in input) {
      updateData.provincia = input.provincia ? normalizeProvincia(input.provincia) : null
    }

    const { data, error } = await supabase
      .from('installers')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating installer:', error)

      // Handle unique constraint violation
      if (error.code === '23505') {
        throw new Error(`Un installatore con questo nome esiste già`)
      }

      throw new Error(`Errore nell'aggiornamento dell'installatore: ${error.message}`)
    }

    return data
  },

  /**
   * Soft delete installer (set is_active to false)
   */
  delete: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('installers')
      .update({ is_active: false })
      .eq('id', id)

    if (error) {
      console.error('Error deleting installer:', error)
      throw new Error(`Errore nell'eliminazione dell'installatore: ${error.message}`)
    }
  },

  /**
   * Hard delete installer (use with caution)
   * Will fail if installer is referenced by requests
   */
  hardDelete: async (id: string): Promise<void> => {
    const { error } = await supabase.from('installers').delete().eq('id', id)

    if (error) {
      console.error('Error hard deleting installer:', error)
      throw new Error(
        `Impossibile eliminare l'installatore: ${error.message}. ` +
          `Potrebbe essere referenziato da richieste esistenti.`
      )
    }
  },

  /**
   * Check if installer has all required fields populated
   * Uses database function for server-side validation
   */
  checkCompleteness: async (installerId: string): Promise<InstallerCompleteness> => {
    const { data, error } = await supabase.rpc('check_installer_completeness', {
      installer_id_param: installerId,
    })

    if (error) {
      console.error('Error checking installer completeness:', error)
      throw new Error(`Errore verifica completezza: ${error.message}`)
    }

    // Handle error response from function
    if (data.error) {
      throw new Error(data.error)
    }

    if (data.is_complete === true) {
      return { isComplete: true, missingFields: [] }
    }

    // If not complete, fetch installer to identify missing fields with labels
    const installer = await installersApi.getById(installerId)
    const missingFields = getMissingInstallerFields(installer)

    return { isComplete: false, missingFields }
  },

  /**
   * Find potential duplicate installers using fuzzy matching
   * Uses pg_trgm similarity
   */
  findDuplicates: async (
    installerName: string,
    _threshold: number = 0.6
  ): Promise<Array<Installer & { similarity_score: number }>> => {
    // For now, use simple ILIKE search
    // TODO: Implement proper fuzzy search with similarity function using _threshold
    const { data, error } = await supabase
      .from('installers')
      .select('*')
      .ilike('nome', `%${installerName}%`)
      .limit(10)

    if (error) {
      console.error('Error finding duplicate installers:', error)
      throw new Error(`Errore nella ricerca duplicati: ${error.message}`)
    }

    // Add dummy similarity_score for compatibility
    return (data || []).map((i) => ({ ...i, similarity_score: 0.8 }))
  },

  /**
   * Increment usage_count when installer is used in requests
   */
  incrementUsageCount: async (id: string): Promise<void> => {
    const { error } = await supabase.rpc('increment', {
      table_name: 'installers',
      row_id: id,
      column_name: 'usage_count',
    })

    if (error) {
      console.error('Error incrementing usage count:', error)
      // Non-blocking error - log but don't throw
    }
  },

  /**
   * Utility: Format installer's complete address
   * "Via Numero, CAP Comune (PR)"
   */
  formatFullAddress,

  /**
   * Utility: Format installer display with P.IVA
   * "Nome Installatore (P.IVA: XXXXXXXXXXX)"
   */
  formatDisplay: formatInstallerDisplay,
}
