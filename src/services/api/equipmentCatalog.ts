import { supabase } from '../supabase'
import type { EquipmentCatalogType, EquipmentCatalogItem, EquipmentSearchResult } from '@/types'

/**
 * API Service per Equipment Catalog
 * Gestisce filtri cascata TIPO → MARCA → MODELLO
 * e aggiunta nuove associazioni al catalogo
 */

export const equipmentCatalogApi = {
  /**
   * Ottiene tutte le tipologie disponibili
   */
  async getTipi(): Promise<EquipmentCatalogType[]> {
    const { data, error } = await supabase
      .from('equipment_catalog')
      .select('tipo_apparecchiatura')
      .eq('is_active', true)
      .not('tipo_apparecchiatura', 'is', null)

    if (error) throw error

    // Estrai valori unici
    const uniqueTipi = [...new Set(data.map(item => item.tipo_apparecchiatura))].filter(Boolean)
    return uniqueTipi as EquipmentCatalogType[]
  },

  /**
   * Ottiene marche filtrate per tipo
   * Ordinate per usage_count (popolarità)
   */
  async getMarcheByTipo(tipo: EquipmentCatalogType): Promise<string[]> {
    const { data, error } = await supabase
      .from('equipment_catalog')
      .select('marca')
      .eq('tipo_apparecchiatura', tipo)
      .eq('is_active', true)
      .not('marca', 'is', null)
      .neq('marca', '')

    if (error) throw error

    // Raggruppa per marca e conta occorrenze
    const marcaCount = data.reduce((acc: Record<string, number>, item) => {
      const marca = item.marca
      acc[marca] = (acc[marca] || 0) + 1
      return acc
    }, {})

    // Ordina per count DESC, poi alfabeticamente
    return Object.entries(marcaCount)
      .sort(([a, countA], [b, countB]) => {
        if (countB !== countA) return countB - countA
        return a.localeCompare(b)
      })
      .map(([marca]) => marca)
  },

  /**
   * Ottiene modelli filtrati per tipo + marca
   * Ordinati per usage_count (popolarità)
   */
  async getModelliByTipoMarca(
    tipo: EquipmentCatalogType,
    marca: string
  ): Promise<string[]> {
    const { data, error } = await supabase
      .from('equipment_catalog')
      .select('modello, usage_count')
      .eq('tipo_apparecchiatura', tipo)
      .eq('marca', marca)
      .eq('is_active', true)
      .not('modello', 'is', null)
      .neq('modello', '')
      .order('usage_count', { ascending: false })
      .order('modello', { ascending: true })

    if (error) throw error

    // Rimuovi duplicati mantenendo l'ordine
    const uniqueModelli = [...new Set(data.map(item => item.modello))]
    return uniqueModelli
  },

  /**
   * Ottiene i dati completi (con specs) di un'apparecchiatura specifica
   * Usato per popolare i campi tecnici quando si seleziona dal catalogo
   */
  async getEquipmentByTipoMarcaModello(
    tipo: EquipmentCatalogType,
    marca: string,
    modello: string
  ): Promise<EquipmentCatalogItem | null> {
    const { data, error } = await supabase
      .from('equipment_catalog')
      .select('*')
      .eq('tipo_apparecchiatura', tipo)
      .eq('marca', marca)
      .eq('modello', modello)
      .eq('is_active', true)
      .maybeSingle()

    if (error) throw error

    return data as EquipmentCatalogItem | null
  },

  /**
   * Aggiunge nuova associazione TIPO-MARCA-MODELLO al catalogo
   * Se esiste già, incrementa usage_count
   */
  async addEquipment(
    tipo: EquipmentCatalogType,
    marca: string,
    modello: string
  ): Promise<string> {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser()

    const { data, error } = await supabase.rpc('add_equipment_to_catalog', {
      p_tipo: tipo,
      p_marca: marca,
      p_modello: modello,
      p_user_id: user?.id || null
    })

    if (error) throw error

    return data
  },

  /**
   * Cerca apparecchiature con fuzzy matching
   * Opzionalmente filtrato per tipo
   */
  async searchFuzzy(
    searchTerm: string,
    tipo?: EquipmentCatalogType,
    limit: number = 10
  ): Promise<EquipmentSearchResult[]> {
    const { data, error } = await supabase.rpc('search_equipment_fuzzy', {
      search_term: searchTerm,
      equipment_type_filter: tipo || null,
      limit_results: limit
    })

    if (error) throw error

    return data as EquipmentSearchResult[]
  },

  /**
   * Verifica se una combinazione TIPO-MARCA-MODELLO esiste già
   */
  async exists(
    tipo: EquipmentCatalogType,
    marca: string,
    modello: string
  ): Promise<boolean> {
    const { data, error } = await supabase
      .from('equipment_catalog')
      .select('id')
      .eq('tipo_apparecchiatura', tipo)
      .eq('marca', marca)
      .eq('modello', modello)
      .eq('is_active', true)
      .maybeSingle()

    if (error) throw error

    return !!data
  },

  /**
   * Ottiene dettagli di un'apparecchiatura specifica
   */
  async getById(id: string): Promise<EquipmentCatalogItem | null> {
    const { data, error } = await supabase
      .from('equipment_catalog')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .maybeSingle()

    if (error) throw error

    return data as EquipmentCatalogItem | null
  },

  /**
   * Ottiene tutte le apparecchiature aggiunte dall'utente
   * Utile per amministrazione/review
   */
  async getUserDefined(userId?: string): Promise<EquipmentCatalogItem[]> {
    let query = supabase
      .from('equipment_catalog')
      .select('*')
      .eq('is_user_defined', true)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (userId) {
      query = query.eq('created_by', userId)
    }

    const { data, error } = await query

    if (error) throw error

    return data as EquipmentCatalogItem[]
  },

  /**
   * Incrementa usage_count quando un'apparecchiatura viene utilizzata
   * (chiamato quando si seleziona un'apparecchiatura dal catalogo)
   */
  async incrementUsage(id: string): Promise<void> {
    const { error } = await supabase.rpc('increment_equipment_usage', {
      equipment_id: id
    })

    if (error) throw error
  }
}
