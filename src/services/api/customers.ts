import { supabase, SUPABASE_URL } from '../supabase'
import { Customer, CustomerCompleteness } from '@/types'
import { validateCustomerInput, normalizeTelefono, normalizePec, normalizeProvincia, normalizeIdentificativo } from '@/utils/customerValidation'

// True se l'errore Supabase è una violazione di unicità sul codice cliente (identificativo)
const isDuplicateCodeError = (error: any): boolean =>
  error?.code === '23505' &&
  /identificativo|codice_cliente_num/i.test(`${error?.message ?? ''} ${error?.details ?? ''}`)

// Messaggio chiaro per codice duplicato, con il prossimo numero disponibile
const duplicateCodeMessage = async (): Promise<string> => {
  let next: number | null = null
  try { next = await customersApi.getNextCode() } catch { /* fallback senza numero */ }
  const suffix = next != null ? ` Prossimo numero disponibile: ${String(next).padStart(3, '0')}.` : ''
  return `Codice cliente già assegnato a un altro cliente.${suffix}`
}

export interface CreateCustomerInput {
  ragione_sociale: string
  identificativo?: string  // Optional, auto-generated if omitted
  telefono?: string
  pec?: string
  descrizione_attivita?: string
  via?: string
  numero_civico?: string
  cap?: string
  comune?: string
  provincia?: string
}

export interface UpdateCustomerInput {
  ragione_sociale?: string
  identificativo?: string
  telefono?: string
  pec?: string
  descrizione_attivita?: string
  via?: string | null
  numero_civico?: string | null
  cap?: string | null
  comune?: string | null  // Renamed from 'citta'
  provincia?: string | null
  is_active?: boolean
}

export interface CustomerFilters {
  search?: string
  is_active?: boolean
  page?: number
  pageSize?: number
  sortBy?: 'nome' | 'codice'
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

    // Then, get the paginated data.
    // Sort by numeric client code (codice_cliente_num) when requested; default by name so the
    // ~22k code-less MAGO anagrafica rows aren't pushed to the bottom of the default view.
    let query = supabase
      .from('customers')
      .select('*')

    query = filters?.sortBy === 'codice'
      ? query.order('codice_cliente_num', { ascending: true, nullsFirst: false })
      : query.order('ragione_sociale')

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

  // Prossimo codice cliente numerico che l'auto-generazione assegnerebbe
  getNextCode: async (): Promise<number> => {
    const { data, error } = await supabase.rpc('get_next_customer_code')
    if (error) {
      console.error('Error fetching next customer code:', error)
      throw new Error(`Errore nel calcolo del prossimo codice: ${error.message}`)
    }
    return data as number
  },

  // Create new customer
  create: async (input: CreateCustomerInput): Promise<Customer> => {
    // Validate input with Zod schema
    const errors = validateCustomerInput(input)
    if (errors.length > 0) {
      throw new Error(`Dati cliente non validi:\n${errors.join('\n')}`)
    }

    const { data, error } = await supabase
      .from('customers')
      .insert({
        ragione_sociale: input.ragione_sociale.trim(),
        // Managed (app-UI) create: send an explicit normalized code if typed, otherwise the
        // 'AUTO' sentinel so the DB trigger assigns the next numeric code. Blank -> auto.
        identificativo: input.identificativo?.trim()
          ? normalizeIdentificativo(input.identificativo)
          : 'AUTO',
        // Campi opzionali: converti stringhe vuote/undefined in NULL per non violare i CHECK constraint
        telefono: input.telefono?.trim() ? normalizeTelefono(input.telefono) : null,
        pec: input.pec?.trim() ? normalizePec(input.pec) : null,
        descrizione_attivita: input.descrizione_attivita?.trim() || null,
        via: input.via?.trim() || null,
        numero_civico: input.numero_civico?.trim() || null,
        cap: input.cap?.trim() || null,
        comune: input.comune?.trim() || null,
        provincia: input.provincia?.trim() ? normalizeProvincia(input.provincia) : null,
        is_active: true,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating customer:', error)
      if (isDuplicateCodeError(error)) throw new Error(await duplicateCodeMessage())
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

    // Non sovrascrivere l'identificativo (auto-generato) con una stringa vuota.
    // Quando valorizzato, normalizza al formato numerico canonico (zero-pad min 3 cifre).
    if (input.identificativo !== undefined && input.identificativo.trim()) {
      updateData.identificativo = normalizeIdentificativo(input.identificativo)
    }

    // Campi opzionali: converti stringhe vuote in NULL per non violare i CHECK constraint
    if (input.telefono !== undefined) {
      updateData.telefono = input.telefono.trim() ? normalizeTelefono(input.telefono) : null
    }

    if (input.pec !== undefined) {
      updateData.pec = input.pec.trim() ? normalizePec(input.pec) : null
    }

    if (input.descrizione_attivita !== undefined) {
      updateData.descrizione_attivita = input.descrizione_attivita.trim() || null
    }

    if (input.via !== undefined) {
      updateData.via = input.via ? input.via.trim() : null
    }

    if (input.numero_civico !== undefined) {
      updateData.numero_civico = input.numero_civico ? input.numero_civico.trim() : null
    }

    if (input.cap !== undefined) {
      updateData.cap = input.cap ? input.cap.trim() : null
    }

    if (input.comune !== undefined) {
      updateData.comune = input.comune ? input.comune.trim() : null
    }

    if (input.provincia !== undefined) {
      updateData.provincia = input.provincia ? normalizeProvincia(input.provincia) : null
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
      if (isDuplicateCodeError(error)) throw new Error(await duplicateCodeMessage())
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

  // Check if customer has all required fields populated
  checkCompleteness: async (customerId: string): Promise<CustomerCompleteness> => {
    const { data, error } = await supabase
      .rpc('is_customer_complete', { customer_id: customerId })

    if (error) {
      console.error('Error checking customer completeness:', error)
      throw new Error(`Errore verifica completezza: ${error.message}`)
    }

    if (data === true) {
      return { isComplete: true, missingFields: [] }
    }

    // If not complete, fetch customer to identify missing fields
    const customer = await customersApi.getById(customerId)
    const { getMissingCustomerFields } = await import('@/utils/customerValidation')
    const missingFields = getMissingCustomerFields(customer)

    return { isComplete: false, missingFields }
  },

  // Format customer's complete address from separate fields
  formatFullAddress: (customer: Customer): string => {
    const parts: string[] = []

    // Via + numero civico
    if (customer.via) {
      const address = customer.numero_civico
        ? `${customer.via}, ${customer.numero_civico}`
        : customer.via
      parts.push(address)
    }

    // CAP + Comune
    if (customer.cap && customer.comune) {
      parts.push(`${customer.cap} ${customer.comune}`)
    } else if (customer.comune) {
      parts.push(customer.comune)
    } else if (customer.cap) {
      parts.push(customer.cap)
    }

    // Provincia (tra parentesi)
    if (customer.provincia) {
      parts.push(`(${customer.provincia})`)
    }

    return parts.join(', ')
  },
}
