import { supabase, ensureValidSession } from '../supabase'
import type { DM329TechnicalData } from '../../types'

/**
 * API Service per DM329 Technical Data
 */
export const technicalDataApi = {
  /**
   * Ottiene la scheda dati tecnici per una richiesta DM329
   * @param requestId ID della richiesta
   * @returns DM329TechnicalData o null se non trovata
   */
  async getByRequestId(requestId: string): Promise<DM329TechnicalData | null> {
    await ensureValidSession()

    const { data, error } = await supabase
      .from('dm329_technical_data')
      .select(`
        *,
        request:requests(*),
        completed_by_user:users!dm329_technical_data_completed_by_fkey(*),
        created_by_user:users!dm329_technical_data_created_by_fkey(*)
      `)
      .eq('request_id', requestId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found
        return null
      }
      console.error('Error fetching technical data:', error)
      throw new Error(`Errore nel caricamento della scheda dati: ${error.message}`)
    }

    return data
  },

  /**
   * Crea una nuova scheda dati tecnici
   * @param requestId ID della richiesta DM329
   * @param indirizzo_impianto Indirizzo impianto (opzionale)
   * @returns DM329TechnicalData creata
   */
  async create(
    requestId: string,
    indirizzo_impianto?: string
  ): Promise<DM329TechnicalData> {
    await ensureValidSession()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      throw new Error('Utente non autenticato')
    }

    const { data, error } = await supabase
      .from('dm329_technical_data')
      .insert({
        request_id: requestId,
        indirizzo_impianto,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating technical data:', error)
      throw new Error(`Errore nella creazione della scheda dati: ${error.message}`)
    }

    return data
  },

  /**
   * Aggiorna la scheda dati tecnici
   * @param requestId ID della richiesta
   * @param updates Dati da aggiornare
   * @returns DM329TechnicalData aggiornata
   */
  async update(
    requestId: string,
    updates: Partial<Omit<DM329TechnicalData, 'id' | 'request_id' | 'created_at' | 'created_by'>>
  ): Promise<DM329TechnicalData> {
    await ensureValidSession()

    const { data, error } = await supabase
      .from('dm329_technical_data')
      .update(updates)
      .eq('request_id', requestId)
      .select()
      .single()

    if (error) {
      console.error('Error updating technical data:', error)
      throw new Error(`Errore nell'aggiornamento della scheda dati: ${error.message}`)
    }

    return data
  },

  /**
   * Salva i dati apparecchiature (equipment_data JSONB)
   * @param requestId ID della richiesta
   * @param equipmentData Dati apparecchiature
   * @returns DM329TechnicalData aggiornata
   */
  async updateEquipmentData(
    requestId: string,
    equipmentData: Record<string, any>
  ): Promise<DM329TechnicalData> {
    return this.update(requestId, { equipment_data: equipmentData })
  },

  /**
   * Salva l'indirizzo impianto (con dati strutturati da autocomplete)
   * @param requestId ID della richiesta
   * @param indirizzo Indirizzo testuale
   * @param formatted Dati strutturati da Google Places
   * @returns DM329TechnicalData aggiornata
   */
  async updateAddress(
    requestId: string,
    indirizzo: string,
    formatted?: any
  ): Promise<DM329TechnicalData> {
    return this.update(requestId, {
      indirizzo_impianto: indirizzo,
      indirizzo_impianto_formatted: formatted,
    })
  },

  /**
   * Marca la scheda come completata
   * Questo trigger automaticamente il cambio stato della richiesta a 2-SCHEDA_DATI_PRONTA
   * @param requestId ID della richiesta
   * @returns DM329TechnicalData aggiornata
   */
  async markAsCompleted(requestId: string): Promise<DM329TechnicalData> {
    await ensureValidSession()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      throw new Error('Utente non autenticato')
    }

    const { data, error } = await supabase
      .from('dm329_technical_data')
      .update({
        is_completed: true,
        completed_by: user.id,
        completed_at: new Date().toISOString(),
      })
      .eq('request_id', requestId)
      .select()
      .single()

    if (error) {
      console.error('Error marking technical data as completed:', error)
      throw new Error(`Errore nel completamento della scheda dati: ${error.message}`)
    }

    return data
  },

  /**
   * Riapre la scheda (la marca come non completata)
   * @param requestId ID della richiesta
   * @returns DM329TechnicalData aggiornata
   */
  async markAsIncomplete(requestId: string): Promise<DM329TechnicalData> {
    await ensureValidSession()

    const { data, error } = await supabase
      .from('dm329_technical_data')
      .update({
        is_completed: false,
        completed_by: null,
        completed_at: null,
      })
      .eq('request_id', requestId)
      .select()
      .single()

    if (error) {
      console.error('Error marking technical data as incomplete:', error)
      throw new Error(`Errore nella riapertura della scheda dati: ${error.message}`)
    }

    return data
  },

  /**
   * Salva i risultati OCR
   * @param requestId ID della richiesta
   * @param ocrResults Array di risultati OCR
   * @param status Stato elaborazione OCR
   * @returns DM329TechnicalData aggiornata
   */
  async updateOCRResults(
    requestId: string,
    ocrResults: any[],
    status: 'processing' | 'completed' | 'failed'
  ): Promise<DM329TechnicalData> {
    return this.update(requestId, {
      ocr_results: ocrResults,
      ocr_processing_status: status,
      ocr_processed_at: new Date().toISOString(),
    })
  },

  /**
   * Elimina la scheda dati tecnici
   * @param requestId ID della richiesta
   */
  async delete(requestId: string): Promise<void> {
    await ensureValidSession()

    const { error } = await supabase
      .from('dm329_technical_data')
      .delete()
      .eq('request_id', requestId)

    if (error) {
      console.error('Error deleting technical data:', error)
      throw new Error(`Errore nell'eliminazione della scheda dati: ${error.message}`)
    }
  },

  /**
   * Verifica se esiste una scheda dati per una richiesta
   * @param requestId ID della richiesta
   * @returns true se esiste, false altrimenti
   */
  async exists(requestId: string): Promise<boolean> {
    await ensureValidSession()

    const { count, error } = await supabase
      .from('dm329_technical_data')
      .select('id', { count: 'exact', head: true })
      .eq('request_id', requestId)

    if (error) {
      console.error('Error checking technical data existence:', error)
      return false
    }

    return (count ?? 0) > 0
  },
}
