import { supabase } from '../supabase'

/**
 * Documenti della relazione tecnica: bucket `relazioni` per i byte, `relazione_documenti`
 * per l'indice. Un solo file per pratica — a differenza del fascicolo/dichiarazioni non c'è
 * un concetto di "sorgenti": la relazione si genera dai dati della scheda.
 */

export const BUCKET_RELAZIONI = 'relazioni'

interface RigaDocumento {
  id: string
  request_id: string
  file_name: string
  file_path: string
  file_size: number
  mime_type: string | null
  created_at: string
}

export interface DocumentoRelazione {
  id: string
  nome: string
  peso: number
  mime: string | null
  filePath: string
}

const daRiga = (r: RigaDocumento): DocumentoRelazione => ({
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

export const relazioneDocumentiApi = {
  /** L'ultima relazione salvata per questa pratica, se esiste. */
  ultimoFinale: async (requestId: string): Promise<DocumentoRelazione | null> => {
    const { data, error } = await supabase
      .from('relazione_documenti')
      .select('*')
      .eq('request_id', requestId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw error
    return data ? daRiga(data as RigaDocumento) : null
  },

  /** Salva la relazione appena generata, caricando la nuova prima di eliminare la precedente. */
  salvaFinale: async (requestId: string, file: File): Promise<DocumentoRelazione> => {
    const { data: sessione } = await supabase.auth.getSession()
    if (!sessione.session) throw new Error('Non autenticato')

    const precedente = await relazioneDocumentiApi.ultimoFinale(requestId)

    const filePath = percorsoFile(requestId, file)
    const { error: erroreUpload } = await supabase.storage
      .from(BUCKET_RELAZIONI)
      .upload(filePath, file, { cacheControl: '3600', upsert: false })
    if (erroreUpload) throw new Error(`Errore nel caricamento: ${erroreUpload.message}`)

    const { data, error } = await supabase
      .from('relazione_documenti')
      .insert({
        request_id: requestId,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        mime_type: file.type || null,
        uploaded_by: sessione.session.user.id,
      })
      .select('*')
      .single()

    if (error) {
      const { error: erroreRollback } = await supabase.storage.from(BUCKET_RELAZIONI).remove([filePath])
      if (erroreRollback) {
        console.error('Rimozione di rollback non riuscita, file orfano nello storage:', filePath, erroreRollback)
      }
      throw new Error(`Errore nel salvataggio della relazione: ${error.message}`)
    }

    // Il vecchio file si toglie solo dopo che il nuovo è al sicuro: se upload o insert fossero
    // falliti, la pratica resterebbe comunque con una relazione scaricabile invece che con
    // nessuna.
    if (precedente) {
      const { error: erroreStorage } = await supabase.storage.from(BUCKET_RELAZIONI).remove([precedente.filePath])
      if (erroreStorage) throw new Error(`Rimozione della relazione precedente non riuscita: ${erroreStorage.message}`)
      const { error: erroreDelete } = await supabase.from('relazione_documenti').delete().eq('id', precedente.id)
      if (erroreDelete) throw erroreDelete
    }
    await supabase.from('relazione_scadenze').delete().eq('request_id', requestId)

    return daRiga(data as RigaDocumento)
  },

  scarica: async (filePath: string): Promise<Blob> => {
    const { data, error } = await supabase.storage.from(BUCKET_RELAZIONI).download(filePath)
    if (error) throw new Error(`Errore nello scaricamento: ${error.message}`)
    return data
  },

  /** La nota «relazione scaduta il …», se il file è stato cancellato dalla passata notturna. */
  scadenzaDi: async (requestId: string): Promise<{ purgato_il: string; n_file: number } | null> => {
    const { data, error } = await supabase
      .from('relazione_scadenze')
      .select('purgato_il, n_file')
      .eq('request_id', requestId)
      .maybeSingle()

    if (error) throw error
    return data ?? null
  },
}
