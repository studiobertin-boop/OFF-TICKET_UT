import { supabase } from '../supabase'
import type {
  AssegnazionePagina,
  DocumentoFinaleDichiarazioni,
  DocumentoOverrideInstallatore,
  DocumentoSorgenteDichiarazione,
} from '@/services/dichiarazioni/tipi'

/**
 * Documenti delle "dichiarazioni": bucket `dichiarazioni` per i byte, `dichiarazioni_documenti`
 * per l'indice. A differenza del fascicolo, la chiave è la sola pratica (`request_id`): qui non
 * esiste un'apparecchiatura singola a cui agganciare i documenti.
 */

export const BUCKET_DICHIARAZIONI = 'dichiarazioni'

interface RigaDocumento {
  id: string
  request_id: string
  tipo: 'sorgente' | 'override_id_installatore' | 'finale'
  n_pagine: number | null
  assegnazioni: AssegnazionePagina[]
  file_name: string
  file_path: string
  file_size: number
  mime_type: string | null
  created_at: string
}

const sorgenteDaRiga = (r: RigaDocumento): DocumentoSorgenteDichiarazione => ({
  id: r.id,
  nome: r.file_name,
  peso: r.file_size,
  mime: r.mime_type,
  filePath: r.file_path,
  nPagine: r.n_pagine,
  assegnazioni: r.assegnazioni ?? [],
})

const overrideDaRiga = (r: RigaDocumento): DocumentoOverrideInstallatore => ({
  id: r.id,
  nome: r.file_name,
  peso: r.file_size,
  mime: r.mime_type,
  filePath: r.file_path,
})

const finaleDaRiga = (r: RigaDocumento): DocumentoFinaleDichiarazioni => ({
  id: r.id,
  nome: r.file_name,
  peso: r.file_size,
  mime: r.mime_type,
  filePath: r.file_path,
})

const percorsoFile = (requestId: string, file: File): string => {
  const nomePulito = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  return `${requestId}/${Date.now()}_${nomePulito}`
}

const caricaByte = async (filePath: string, file: File): Promise<void> => {
  const { error } = await supabase.storage
    .from(BUCKET_DICHIARAZIONI)
    .upload(filePath, file, { cacheControl: '3600', upsert: false })
  if (error) throw new Error(`Errore nel caricamento: ${error.message}`)
}

export interface CaricaSorgenteInput {
  requestId: string
  file: File
  /** Numero di pagine del PDF, o 1 per un'immagine: calcolato dal chiamante (pdf.js). */
  nPagine: number
}

export const dichiarazioniDocumentiApi = {
  /** Documenti sorgente di una pratica, nell'ordine in cui sono stati caricati. */
  elencaSorgenti: async (requestId: string): Promise<DocumentoSorgenteDichiarazione[]> => {
    const { data, error } = await supabase
      .from('dichiarazioni_documenti')
      .select('*')
      .eq('request_id', requestId)
      .eq('tipo', 'sorgente')
      .order('created_at', { ascending: true })

    if (error) throw error
    return (data ?? []).map(sorgenteDaRiga)
  },

  /** Il documento d'identità dell'installatore caricato per questa pratica, se sostituisce il predefinito. */
  overrideIdInstallatore: async (requestId: string): Promise<DocumentoOverrideInstallatore | null> => {
    const { data, error } = await supabase
      .from('dichiarazioni_documenti')
      .select('*')
      .eq('request_id', requestId)
      .eq('tipo', 'override_id_installatore')
      .maybeSingle()

    if (error) throw error
    return data ? overrideDaRiga(data as RigaDocumento) : null
  },

  /** L'ultimo PDF a 5 parti composto e salvato per questa pratica, se esiste. */
  ultimoFinale: async (requestId: string): Promise<DocumentoFinaleDichiarazioni | null> => {
    const { data, error } = await supabase
      .from('dichiarazioni_documenti')
      .select('*')
      .eq('request_id', requestId)
      .eq('tipo', 'finale')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw error
    return data ? finaleDaRiga(data as RigaDocumento) : null
  },

  caricaSorgente: async ({ requestId, file, nPagine }: CaricaSorgenteInput): Promise<DocumentoSorgenteDichiarazione> => {
    const { data: sessione } = await supabase.auth.getSession()
    if (!sessione.session) throw new Error('Non autenticato')

    const filePath = percorsoFile(requestId, file)
    await caricaByte(filePath, file)

    const { data, error } = await supabase
      .from('dichiarazioni_documenti')
      .insert({
        request_id: requestId,
        tipo: 'sorgente',
        n_pagine: nPagine,
        assegnazioni: [],
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        mime_type: file.type || null,
        uploaded_by: sessione.session.user.id,
      })
      .select('*')
      .single()

    if (error) {
      const { error: erroreRollback } = await supabase.storage.from(BUCKET_DICHIARAZIONI).remove([filePath])
      if (erroreRollback) {
        console.error('Rimozione di rollback non riuscita, file orfano nello storage:', filePath, erroreRollback)
      }
      throw new Error(`Errore nel salvataggio del documento: ${error.message}`)
    }

    return sorgenteDaRiga(data as RigaDocumento)
  },

  /** Riscrive per intero l'array di assegnazioni pagina-per-pagina di un documento sorgente. */
  aggiornaAssegnazioni: async (id: string, assegnazioni: AssegnazionePagina[]): Promise<void> => {
    const { error } = await supabase
      .from('dichiarazioni_documenti')
      .update({ assegnazioni })
      .eq('id', id)

    if (error) throw error
  },

  caricaOverrideIdInstallatore: async (requestId: string, file: File): Promise<DocumentoOverrideInstallatore> => {
    const { data: sessione } = await supabase.auth.getSession()
    if (!sessione.session) throw new Error('Non autenticato')

    // Un solo override alla volta: quello vecchio, se c'è, va sostituito.
    const precedente = await dichiarazioniDocumentiApi.overrideIdInstallatore(requestId)
    if (precedente) {
      await dichiarazioniDocumentiApi.elimina(precedente.id)
    }

    const filePath = percorsoFile(requestId, file)
    await caricaByte(filePath, file)

    const { data, error } = await supabase
      .from('dichiarazioni_documenti')
      .insert({
        request_id: requestId,
        tipo: 'override_id_installatore',
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        mime_type: file.type || null,
        uploaded_by: sessione.session.user.id,
      })
      .select('*')
      .single()

    if (error) {
      const { error: erroreRollback } = await supabase.storage.from(BUCKET_DICHIARAZIONI).remove([filePath])
      if (erroreRollback) {
        console.error('Rimozione di rollback non riuscita, file orfano nello storage:', filePath, erroreRollback)
      }
      throw new Error(`Errore nel salvataggio del documento: ${error.message}`)
    }

    return overrideDaRiga(data as RigaDocumento)
  },

  /** Salva il PDF finale, caricando il nuovo prima di eliminare il precedente. */
  salvaFinale: async (requestId: string, file: File): Promise<DocumentoFinaleDichiarazioni> => {
    const { data: sessione } = await supabase.auth.getSession()
    if (!sessione.session) throw new Error('Non autenticato')

    const precedente = await dichiarazioniDocumentiApi.ultimoFinale(requestId)

    const filePath = percorsoFile(requestId, file)
    await caricaByte(filePath, file)

    const { data, error } = await supabase
      .from('dichiarazioni_documenti')
      .insert({
        request_id: requestId,
        tipo: 'finale',
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        mime_type: file.type || null,
        uploaded_by: sessione.session.user.id,
      })
      .select('*')
      .single()

    if (error) {
      const { error: erroreRollback } = await supabase.storage.from(BUCKET_DICHIARAZIONI).remove([filePath])
      if (erroreRollback) {
        console.error('Rimozione di rollback non riuscita, file orfano nello storage:', filePath, erroreRollback)
      }
      throw new Error(`Errore nel salvataggio del documento: ${error.message}`)
    }

    // Il vecchio finale si toglie solo dopo che il nuovo è al sicuro: se lo storage o
    // l'inserimento sopra fossero falliti, la pratica resterebbe comunque con un finale
    // scaricabile invece che senza nessuno.
    if (precedente) {
      await dichiarazioniDocumentiApi.elimina(precedente.id)
    }
    await supabase.from('dichiarazioni_scadenze').delete().eq('request_id', requestId)

    return finaleDaRiga(data as RigaDocumento)
  },

  elimina: async (id: string): Promise<void> => {
    const { data, error: erroreLettura } = await supabase
      .from('dichiarazioni_documenti')
      .select('file_path')
      .eq('id', id)
      .single()
    if (erroreLettura) throw erroreLettura

    const { error: erroreStorage } = await supabase.storage
      .from(BUCKET_DICHIARAZIONI)
      .remove([(data as { file_path: string }).file_path])
    if (erroreStorage) throw new Error(`Rimozione del file non riuscita: ${erroreStorage.message}`)

    const { error } = await supabase.from('dichiarazioni_documenti').delete().eq('id', id)
    if (error) throw error
  },

  scarica: async (filePath: string): Promise<Blob> => {
    const { data, error } = await supabase.storage.from(BUCKET_DICHIARAZIONI).download(filePath)
    if (error) throw new Error(`Errore nello scaricamento: ${error.message}`)
    return data
  },

  /** La nota «dichiarazioni scadute il …», se i documenti sono stati cancellati. */
  scadenzaDi: async (requestId: string): Promise<{ purgato_il: string; n_file: number } | null> => {
    const { data, error } = await supabase
      .from('dichiarazioni_scadenze')
      .select('purgato_il, n_file')
      .eq('request_id', requestId)
      .maybeSingle()

    if (error) throw error
    return data ?? null
  },
}
