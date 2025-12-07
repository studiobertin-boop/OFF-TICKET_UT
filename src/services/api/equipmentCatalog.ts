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
  },

  // ============================================================================
  // METODI PER COMPRESSORI (con pressione_max come chiave)
  // ============================================================================

  /**
   * Per COMPRESSORI: ottiene pressioni disponibili per tipo + marca + modello
   * Usato per popolare il terzo autocomplete (pressione)
   */
  async getPressioniByTipoMarcaModello(
    tipo: EquipmentCatalogType,
    marca: string,
    modello: string
  ): Promise<number[]> {
    const { data, error } = await supabase
      .from('equipment_catalog')
      .select('specs')
      .eq('tipo_apparecchiatura', tipo)
      .eq('marca', marca)
      .eq('modello', modello)
      .eq('is_active', true)

    if (error) throw error

    // Estrai pressione_max da specs e rimuovi duplicati
    const pressioni = data
      .map(item => item.specs?.pressione_max)
      .filter((p): p is number => typeof p === 'number' && !isNaN(p))

    return [...new Set(pressioni)].sort((a, b) => a - b)
  },

  /**
   * Per COMPRESSORI: ottiene specs dato marca, modello E pressione
   */
  async getEquipmentByTipoMarcaModelloPressione(
    tipo: EquipmentCatalogType,
    marca: string,
    modello: string,
    pressione: number
  ): Promise<EquipmentCatalogItem | null> {
    const { data, error } = await supabase
      .from('equipment_catalog')
      .select('*')
      .eq('tipo_apparecchiatura', tipo)
      .eq('marca', marca)
      .eq('modello', modello)
      .eq('is_active', true)

    if (error) throw error

    // Filtra per pressione_max negli specs
    const match = data?.find(
      item => item.specs?.pressione_max === pressione
    )

    return match as EquipmentCatalogItem | null
  },

  /**
   * Verifica esistenza con pressione (per compressori)
   */
  async existsWithPressione(
    tipo: EquipmentCatalogType,
    marca: string,
    modello: string,
    pressione: number
  ): Promise<boolean> {
    const equipment = await this.getEquipmentByTipoMarcaModelloPressione(
      tipo, marca, modello, pressione
    )
    return !!equipment
  },

  // ============================================================================
  // METODI PER VALVOLE DI SICUREZZA (con ptar come chiave)
  // ============================================================================

  /**
   * Per VALVOLE: ottiene Ptar disponibili per tipo + marca + modello
   * Usato per popolare il terzo autocomplete (ptar)
   */
  async getPtarByTipoMarcaModello(
    tipo: EquipmentCatalogType,
    marca: string,
    modello: string
  ): Promise<number[]> {
    const { data, error } = await supabase
      .from('equipment_catalog')
      .select('specs')
      .eq('tipo_apparecchiatura', tipo)
      .eq('marca', marca)
      .eq('modello', modello)
      .eq('is_active', true)

    if (error) throw error

    // Estrai ptar da specs e rimuovi duplicati
    const ptarValues = data
      .map(item => item.specs?.ptar)
      .filter((p): p is number => typeof p === 'number' && !isNaN(p))

    return [...new Set(ptarValues)].sort((a, b) => a - b)
  },

  /**
   * Per VALVOLE: ottiene specs dato marca, modello E ptar
   */
  async getEquipmentByTipoMarcaModelloPtar(
    tipo: EquipmentCatalogType,
    marca: string,
    modello: string,
    ptar: number
  ): Promise<EquipmentCatalogItem | null> {
    const { data, error } = await supabase
      .from('equipment_catalog')
      .select('*')
      .eq('tipo_apparecchiatura', tipo)
      .eq('marca', marca)
      .eq('modello', modello)
      .eq('is_active', true)

    if (error) throw error

    // Filtra per ptar negli specs
    const match = data?.find(
      item => item.specs?.ptar === ptar
    )

    return match as EquipmentCatalogItem | null
  },

  /**
   * Verifica esistenza con ptar (per valvole)
   */
  async existsWithPtar(
    tipo: EquipmentCatalogType,
    marca: string,
    modello: string,
    ptar: number
  ): Promise<boolean> {
    const equipment = await this.getEquipmentByTipoMarcaModelloPtar(
      tipo, marca, modello, ptar
    )
    return !!equipment
  },

  // ============================================================================
  // AGGIORNAMENTO SPECS (per completare informazioni mancanti)
  // ============================================================================

  /**
   * Aggiorna specs di un'apparecchiatura esistente (merge parziale)
   * Usato quando l'utente completa informazioni mancanti (FAD, PS, TS, etc.)
   *
   * @param tipo - Tipo apparecchiatura
   * @param marca - Marca
   * @param modello - Modello
   * @param newSpecs - Nuovi specs da aggiungere/sovrascrivere
   * @param options - Opzioni per compressori/valvole (pressione come chiave)
   * @returns void (throws su errore)
   */
  async updateEquipmentSpecs(
    tipo: EquipmentCatalogType,
    marca: string,
    modello: string,
    newSpecs: Record<string, any>,
    options?: {
      pressione?: number  // Per compressori (chiave univoca)
      ptar?: number       // Per valvole (chiave univoca)
    }
  ): Promise<void> {
    // 1. Trova equipment esistente
    let equipment: EquipmentCatalogItem | null = null

    if (tipo === 'Compressori' && options?.pressione !== undefined) {
      equipment = await this.getEquipmentByTipoMarcaModelloPressione(
        tipo, marca, modello, options.pressione
      )
    } else if (tipo === 'Valvole di sicurezza' && options?.ptar !== undefined) {
      equipment = await this.getEquipmentByTipoMarcaModelloPtar(
        tipo, marca, modello, options.ptar
      )
    } else {
      equipment = await this.getEquipmentByTipoMarcaModello(tipo, marca, modello)
    }

    // 2. Se non trovato, silenzioso (apparecchiatura potrebbe essere stata eliminata)
    if (!equipment) {
      console.warn('Equipment not found for update:', { tipo, marca, modello, options })
      return
    }

    // 3. Pulisci newSpecs (rimuovi null/undefined/empty)
    const cleanedNewSpecs = Object.fromEntries(
      Object.entries(newSpecs).filter(([_, v]) =>
        v !== null && v !== undefined && v !== ''
      )
    )

    // 4. Merge specs (preserva specs esistenti, aggiunge/sovrascrive nuovi)
    const mergedSpecs = {
      ...(equipment.specs || {}),
      ...cleanedNewSpecs
    }

    // 5. Update database
    const { error } = await supabase
      .from('equipment_catalog')
      .update({
        specs: mergedSpecs,
        updated_at: new Date().toISOString()
      })
      .eq('id', equipment.id)

    if (error) {
      console.error('Error updating equipment specs:', error)
      throw error
    }

    console.log('✅ Equipment specs updated:', {
      id: equipment.id,
      tipo,
      marca,
      modello,
      updatedFields: Object.keys(cleanedNewSpecs)
    })
  }
}
