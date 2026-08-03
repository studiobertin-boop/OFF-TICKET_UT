import { supabase } from '../supabase'
import type { EquipmentCatalogType, EquipmentCatalogItem, EquipmentSearchResult } from '@/types'
import { normalizeSpecs, variantSpecKey } from '@/services/equipmentAudit'
import { raggruppaVarianti, type VarianteCatalogo } from '@/utils/equipmentVarianti'

export type { VarianteCatalogo }

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
   * Tutte le righe attive di catalogo per una combinazione tipo + marca + modello.
   *
   * Uno stesso modello può averne più d'una: compressori e valvole sono indicizzati anche per
   * pressione, e a produzione 160 modelli di compressore su 325 hanno da 2 a 3 varianti. Per
   * questo la query NON usa `maybeSingle()`, che in quei casi fa fallire la richiesta con
   * `PGRST116` invece di restituire un risultato.
   */
  async findVariants(
    tipo: EquipmentCatalogType,
    marca: string,
    modello: string
  ): Promise<EquipmentCatalogItem[]> {
    const { data, error } = await supabase
      .from('equipment_catalog')
      .select('*')
      .eq('tipo_apparecchiatura', tipo)
      .eq('marca', marca)
      .eq('modello', modello)
      .eq('is_active', true)

    if (error) throw error

    return (data ?? []) as EquipmentCatalogItem[]
  },

  /**
   * Tutte le righe attive di un tipo per un insieme di marche.
   *
   * Serve a precaricare in una sola query il catalogo che interessa a una scheda già compilata,
   * invece di interrogare il database una volta per riga.
   */
  async findByMarche(
    tipo: EquipmentCatalogType,
    marche: string[]
  ): Promise<EquipmentCatalogItem[]> {
    if (marche.length === 0) return []

    const { data, error } = await supabase
      .from('equipment_catalog')
      .select('*')
      .eq('tipo_apparecchiatura', tipo)
      .eq('is_active', true)
      .in('marca', marche)

    if (error) throw error

    return (data ?? []) as EquipmentCatalogItem[]
  },

  /**
   * Varianti di un modello, ordinate per pressione crescente.
   *
   * Il raggruppamento sta in `raggruppaVarianti`: qui resta solo la lettura dal database.
   */
  async getVarianti(
    tipo: EquipmentCatalogType,
    marca: string,
    modello: string
  ): Promise<VarianteCatalogo[]> {
    return raggruppaVarianti(tipo, await this.findVariants(tipo, marca, modello))
  },

  /**
   * Ottiene i dati completi (con specs) di un'apparecchiatura specifica
   * Usato per popolare i campi tecnici quando si seleziona dal catalogo
   *
   * Per i tipi con più varianti restituisce la prima riga: chi deve scegliere fra le varianti
   * passa da `getVarianti`.
   */
  async getEquipmentByTipoMarcaModello(
    tipo: EquipmentCatalogType,
    marca: string,
    modello: string
  ): Promise<EquipmentCatalogItem | null> {
    const rows = await this.findVariants(tipo, marca, modello)
    return rows[0] ?? null
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
    const rows = await this.findVariants(tipo, marca, modello)
    return rows.length > 0
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
    const varianti = await this.getVarianti(tipo, marca, modello)
    return varianti.map(v => v.value)
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
    const varianti = await this.getVarianti(tipo, marca, modello)
    return varianti.find(v => v.value === pressione)?.item ?? null
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
    const varianti = await this.getVarianti(tipo, marca, modello)
    return varianti.map(v => v.value)
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
    const varianti = await this.getVarianti(tipo, marca, modello)
    return varianti.find(v => v.value === ptar)?.item ?? null
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
   * @param options - Riga da aggiornare: per id se lo si conosce, altrimenti per pressione dichiarata
   * @returns void (throws su errore)
   */
  async updateEquipmentSpecs(
    tipo: EquipmentCatalogType,
    marca: string,
    modello: string,
    newSpecs: Record<string, any>,
    options?: {
      /**
       * Identificativo della riga di catalogo scelta dal tecnico. Da preferire sempre che sia
       * disponibile: da quando due varianti possono dichiarare la stessa pressione, `variante`
       * non individua più una riga sola, e scriverci sopra rischia la riga sbagliata.
       */
      catalogItemId?: string
      /** Valore della chiave di variante (pressione per i compressori, Ptar per le valvole). */
      variante?: number
      /** @deprecated usare `variante` */
      pressione?: number
      /** @deprecated usare `variante` */
      ptar?: number
    }
  ): Promise<void> {
    // 1. Trova la riga di catalogo.
    //
    //    Con `catalogItemId` la riga si individua senza ambiguità: è quella scelta dal tecnico
    //    quando la scheda si è precompilata, e cortocircuita ogni altra ricerca.
    //
    //    Il ripiego per pressione resta per chi non porta l'id — le schede già salvate non lo
    //    hanno — ma il valore che arriva è la pressione dichiarata dalla scheda (`readSheetPressure`),
    //    non più la chiave dell'indice unico: da quando due varianti possono dichiararne una
    //    uguale, `variante` può corrispondere a più righe. Se càpita, meglio non scrivere che
    //    scrivere sulla riga sbagliata.
    const variante = options?.variante ?? options?.pressione ?? options?.ptar
    let equipment: EquipmentCatalogItem | null = null

    if (options?.catalogItemId) {
      equipment = await this.getById(options.catalogItemId)
    } else if (variantSpecKey(tipo) !== null && variante !== undefined) {
      const candidati = (await this.getVarianti(tipo, marca, modello)).filter(v => v.value === variante)
      if (candidati.length > 1) {
        console.warn(
          'Variante ambigua per updateEquipmentSpecs: più righe dichiarano la stessa pressione, nessun aggiornamento eseguito.',
          { tipo, marca, modello, variante, righe: candidati.map(c => c.item.id) }
        )
        return
      }
      equipment = candidati[0]?.item ?? null
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

    // 4. Merge specs, poi normalizzazione: le chiavi generiche dell'import massivo
    //    (`pressione`, `volume`, `temperatura`) vanno convertite e rimosse, altrimenti la riga
    //    resta con `pressione: "8"` accanto a `ps: 8` e le due possono divergere.
    const { canonical, legacyKeysConverted } = normalizeSpecs(tipo, {
      ...(equipment.specs || {}),
      ...cleanedNewSpecs,
    })
    const mergedSpecs = { ...(equipment.specs || {}), ...cleanedNewSpecs, ...canonical }
    for (const legacy of legacyKeysConverted) delete mergedSpecs[legacy]

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
