import { supabase, SUPABASE_URL } from '../supabase'
import { Customer } from '@/types'

export interface CreateCustomerInput {
  ragione_sociale: string
}

export interface UpdateCustomerInput {
  ragione_sociale?: string
  is_active?: boolean
}

export interface CustomerFilters {
  search?: string
  is_active?: boolean
  page?: number
  pageSize?: number
}

export interface CustomersResponse {
  data: Customer[]
  count: number
  page: number
  pageSize: number
  totalPages: number
}

export const customersApi = {
  // Get all customers with optional search and filters (with pagination)
  getAll: async (filters?: CustomerFilters): Promise<CustomersResponse> => {
    const page = filters?.page || 0
    const pageSize = filters?.pageSize || 50
    const from = page * pageSize
    const to = from + pageSize - 1

    // First, get the total count
    let countQuery = supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })

    // Filter by active status (default to true)
    const isActive = filters?.is_active !== undefined ? filters.is_active : true
    countQuery = countQuery.eq('is_active', isActive)

    // Apply search filter if provided
    if (filters?.search && filters.search.trim().length > 0) {
      const searchTerm = filters.search.trim()
      countQuery = countQuery.ilike('ragione_sociale', `%${searchTerm}%`)
    }

    const { count, error: countError } = await countQuery

    if (countError) {
      console.error('Error counting customers:', countError)
      throw new Error(`Errore nel conteggio dei clienti: ${countError.message}`)
    }

    // Then, get the paginated data
    let query = supabase
      .from('customers')
      .select('*')
      .order('ragione_sociale')

    query = query.eq('is_active', isActive)

    if (filters?.search && filters.search.trim().length > 0) {
      const searchTerm = filters.search.trim()
      query = query.ilike('ragione_sociale', `%${searchTerm}%`)
    }

    // Apply pagination
    query = query.range(from, to)

    const { data, error } = await query

    if (error) {
      console.error('Error fetching customers:', error)
      throw new Error(`Errore nel caricamento dei clienti: ${error.message}`)
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

  // Get single customer by ID
  getById: async (id: string): Promise<Customer> => {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching customer:', error)
      throw new Error(`Errore nel caricamento del cliente: ${error.message}`)
    }

    return data
  },

  // Create new customer
  create: async (input: CreateCustomerInput): Promise<Customer> => {
    // Trim and validate ragione_sociale
    const ragione_sociale = input.ragione_sociale.trim()

    if (!ragione_sociale || ragione_sociale.length === 0) {
      throw new Error('La ragione sociale non può essere vuota')
    }

    const { data, error } = await supabase
      .from('customers')
      .insert({
        ragione_sociale,
        is_active: true,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating customer:', error)
      throw new Error(`Errore nella creazione del cliente: ${error.message}`)
    }

    return data
  },

  // Update customer
  update: async (id: string, input: UpdateCustomerInput): Promise<Customer> => {
    const updateData: any = {}

    if (input.ragione_sociale !== undefined) {
      const ragione_sociale = input.ragione_sociale.trim()
      if (!ragione_sociale || ragione_sociale.length === 0) {
        throw new Error('La ragione sociale non può essere vuota')
      }
      updateData.ragione_sociale = ragione_sociale
    }

    if (input.is_active !== undefined) {
      updateData.is_active = input.is_active
    }

    const { data, error } = await supabase
      .from('customers')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating customer:', error)
      throw new Error(`Errore nell'aggiornamento del cliente: ${error.message}`)
    }

    return data
  },

  // Soft delete customer (set is_active to false)
  delete: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('customers')
      .update({ is_active: false })
      .eq('id', id)

    if (error) {
      console.error('Error deleting customer:', error)
      throw new Error(`Errore nell'eliminazione del cliente: ${error.message}`)
    }
  },

  // Hard delete customer (use with caution - may fail if referenced by requests)
  hardDelete: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error hard deleting customer:', error)
      throw new Error(`Impossibile eliminare il cliente: ${error.message}. Potrebbe essere referenziato da richieste esistenti.`)
    }
  },

  // Find potential duplicates using database function
  findDuplicates: async (customerName: string, threshold: number = 0.6): Promise<Array<Customer & { similarity_score: number }>> => {
    const { data, error } = await supabase
      .rpc('find_duplicate_customers', {
        customer_name: customerName,
        threshold: threshold,
      })

    if (error) {
      console.error('Error finding duplicates:', error)
      throw new Error(`Errore nella ricerca duplicati: ${error.message}`)
    }

    return data || []
  },

  // Merge duplicate customers
  merge: async (keepId: string, mergeIds: string[]): Promise<void> => {
    // Update all requests pointing to merged customers to point to the kept customer
    for (const mergeId of mergeIds) {
      const { error: updateError } = await supabase
        .from('requests')
        .update({ customer_id: keepId })
        .eq('customer_id', mergeId)

      if (updateError) {
        console.error('Error merging customer requests:', updateError)
        throw new Error(`Errore nel merge delle richieste: ${updateError.message}`)
      }

      // Soft delete the merged customer
      await customersApi.delete(mergeId)
    }
  },

  // Sync customers from external Supabase project (calls Edge Function)
  syncFromExternal: async (): Promise<{ success: boolean; inserted: number; errors: number; message?: string }> => {
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      throw new Error('Devi essere autenticato per sincronizzare i clienti')
    }

    const response = await fetch(`${SUPABASE_URL}/functions/v1/sync-customers`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Errore nella sincronizzazione dei clienti')
    }

    const result = await response.json()
    return result
  },
}
