import { supabase } from '../supabase'
import { RequestType } from '@/types'

export const requestTypesApi = {
  // Get all active request types
  getAll: async (): Promise<RequestType[]> => {
    const { data, error } = await supabase
      .from('request_types')
      .select('*')
      .eq('is_active', true)
      .order('name')

    if (error) throw error
    return data || []
  },

  // Admin only: Get ALL request types (active and inactive)
  getAllForAdmin: async (): Promise<RequestType[]> => {
    const { data, error } = await supabase
      .from('request_types')
      .select('*')
      .order('name')

    if (error) throw error
    return data || []
  },

  // Get single request type by ID
  getById: async (id: string): Promise<RequestType> => {
    const { data, error } = await supabase
      .from('request_types')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  },

  // Admin only: Create new request type
  create: async (requestType: Omit<RequestType, 'id' | 'created_at' | 'updated_at'>): Promise<RequestType> => {
    const { data, error } = await supabase
      .from('request_types')
      .insert(requestType)
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Admin only: Update request type
  update: async (id: string, updates: Partial<RequestType>): Promise<RequestType> => {
    const { data, error } = await supabase
      .from('request_types')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Admin only: Delete (deactivate) request type
  deactivate: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('request_types')
      .update({ is_active: false })
      .eq('id', id)

    if (error) throw error
  },
}
