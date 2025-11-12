import { supabase } from '../supabase'
import type { FeatureFlag } from '../../types'

/**
 * API Service per Feature Flags
 */
export const featureFlagsApi = {
  /**
   * Ottiene il valore di un singolo feature flag
   * @param flagName Nome del feature flag
   * @returns true se abilitato, false altrimenti
   */
  async isEnabled(flagName: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('feature_flags')
        .select('is_enabled')
        .eq('flag_name', flagName)
        .single()

      if (error) {
        console.error(`Error fetching feature flag ${flagName}:`, error)
        return false // Default: feature disabilitata in caso di errore
      }

      return data?.is_enabled ?? false
    } catch (error) {
      console.error(`Exception fetching feature flag ${flagName}:`, error)
      return false
    }
  },

  /**
   * Ottiene tutti i feature flags
   * @returns Array di FeatureFlag
   */
  async getAll(): Promise<FeatureFlag[]> {
    const { data, error } = await supabase
      .from('feature_flags')
      .select('*')
      .order('flag_name')

    if (error) {
      console.error('Error fetching feature flags:', error)
      throw error
    }

    return data || []
  },

  /**
   * Ottiene un singolo feature flag per nome
   * @param flagName Nome del feature flag
   * @returns FeatureFlag o null se non trovato
   */
  async getByName(flagName: string): Promise<FeatureFlag | null> {
    const { data, error } = await supabase
      .from('feature_flags')
      .select('*')
      .eq('flag_name', flagName)
      .single()

    if (error) {
      console.error(`Error fetching feature flag ${flagName}:`, error)
      return null
    }

    return data
  },

  /**
   * Aggiorna lo stato di un feature flag (solo admin)
   * @param flagName Nome del feature flag
   * @param isEnabled Nuovo stato
   * @returns FeatureFlag aggiornato
   */
  async update(flagName: string, isEnabled: boolean): Promise<FeatureFlag> {
    const { data, error } = await supabase
      .from('feature_flags')
      .update({ is_enabled: isEnabled })
      .eq('flag_name', flagName)
      .select()
      .single()

    if (error) {
      console.error(`Error updating feature flag ${flagName}:`, error)
      throw error
    }

    return data
  },

  /**
   * Crea un nuovo feature flag (solo admin)
   * @param flagName Nome del feature flag
   * @param description Descrizione
   * @param isEnabled Stato iniziale (default: false)
   * @returns FeatureFlag creato
   */
  async create(
    flagName: string,
    description?: string,
    isEnabled: boolean = false
  ): Promise<FeatureFlag> {
    const { data, error } = await supabase
      .from('feature_flags')
      .insert({
        flag_name: flagName,
        description,
        is_enabled: isEnabled,
      })
      .select()
      .single()

    if (error) {
      console.error(`Error creating feature flag ${flagName}:`, error)
      throw error
    }

    return data
  },

  /**
   * Elimina un feature flag (solo admin)
   * @param flagName Nome del feature flag
   */
  async delete(flagName: string): Promise<void> {
    const { error } = await supabase
      .from('feature_flags')
      .delete()
      .eq('flag_name', flagName)

    if (error) {
      console.error(`Error deleting feature flag ${flagName}:`, error)
      throw error
    }
  },

  /**
   * Ottiene mappa di feature flags per accesso rapido
   * @returns Map<flagName, isEnabled>
   */
  async getAllAsMap(): Promise<Map<string, boolean>> {
    const flags = await this.getAll()
    const map = new Map<string, boolean>()

    flags.forEach(flag => {
      map.set(flag.flag_name, flag.is_enabled)
    })

    return map
  },
}
