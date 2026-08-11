import { supabase } from '../supabase'
import type { DocumentoFascicolo, RuoloDocumento } from '@/services/fascicolo/types'

/**
 * Documenti del fascicolo: bucket `fascicoli` per i byte, `fascicolo_documenti` per l'indice.
 *
 * Il legame con l'apparecchiatura è il suo codice di scheda. I codici non si rinumerano, ma un
 * numero liberato si riassegna: per questo `eliminaOrfani` esiste, ed è chiamata sia quando si
 * elimina una riga della scheda sia dalla passata notturna.
 */

export const BUCKET_FASCICOLI = 'fascicoli'

/** Tetto di peso per apparecchiatura: sette documenti fra certificati, manuali e foto ci stanno. */
export const TETTO_BYTE_APPARECCHIATURA = 50 * 1024 * 1024

interface RigaDocumento {
  id: string
  request_id: string
  codice: string
  tipo: 'sorgente' | 'fascicolo'
  ruoli: string[] | null
  valvola: string | null
  confidenza: number | null
  motivazione: string | null
  origine: 'ai' | 'euristica' | 'manuale' | null
  file_name: string
  file_path: string
  file_size: number
  mime_type: string | null
  created_at: string
}

const daRiga = (r: RigaDocumento): DocumentoFascicolo => ({
  id: r.id,
  nome: r.file_name,
  peso: r.file_size,
  mime: r.mime_type,
  filePath: r.file_path,
  tipo: r.tipo,
  ruoli: (r.ruoli ?? []) as RuoloDocumento[],
  valvola: r.valvola,
  confidenza: r.confidenza ?? undefined,
  motivazione: r.motivazione ?? undefined,
  origine: r.origine ?? undefined,
})

export interface CaricaDocumentoInput {
  requestId: string
  codice: string
  file: File
  tipo?: 'sorgente' | 'fascicolo'
}

export interface PatchClassificazione {
  ruoli: RuoloDocumento[]
  valvola?: string | null
  confidenza?: number
  motivazione?: string
  origine?: 'ai' | 'euristica' | 'manuale'
}

export const fascicoloDocumentiApi = {
  /** Documenti di un'apparecchiatura, nell'ordine in cui sono stati caricati. */
  elenca: async (requestId: string, codice: string): Promise<DocumentoFascicolo[]> => {
    const { data, error } = await supabase
      .from('fascicolo_documenti')
      .select('*')
      .eq('request_id', requestId)
      .eq('codice', codice)
      .order('created_at', { ascending: true })

    if (error) throw error
    return (data ?? []).map(daRiga)
  },

  carica: async ({ requestId, codice, file, tipo = 'sorgente' }: CaricaDocumentoInput): Promise<DocumentoFascicolo> => {
    const { data: sessione } = await supabase.auth.getSession()
    if (!sessione.session) throw new Error('Non autenticato')

    // Il tetto è per apparecchiatura: il limite scatta dove il tecnico sta lavorando.
    const gia = await fascicoloDocumentiApi.pesoDi(requestId, codice)
    if (gia + file.size > TETTO_BYTE_APPARECCHIATURA) {
      const mb = (b: number) => `${(b / 1024 / 1024).toFixed(1)} MB`
      throw new Error(
        `L'apparecchiatura ${codice} arriverebbe a ${mb(gia + file.size)}, oltre il tetto di ${mb(TETTO_BYTE_APPARECCHIATURA)}.`
      )
    }

    const nomePulito = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const filePath = `${requestId}/${codice}/${Date.now()}_${nomePulito}`

    const { error: erroreUpload } = await supabase.storage
      .from(BUCKET_FASCICOLI)
      .upload(filePath, file, { cacheControl: '3600', upsert: false })
    if (erroreUpload) throw new Error(`Errore nel caricamento: ${erroreUpload.message}`)

    const { data, error } = await supabase
      .from('fascicolo_documenti')
      .insert({
        request_id: requestId,
        codice,
        tipo,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        mime_type: file.type || null,
        uploaded_by: sessione.session.user.id,
      })
      .select('*')
      .single()

    if (error) {
      // Senza la riga il file sarebbe un peso invisibile: si toglie subito.
      await supabase.storage.from(BUCKET_FASCICOLI).remove([filePath])
      throw new Error(`Errore nel salvataggio del documento: ${error.message}`)
    }

    // La riga di scadenza vale finché non si ricarica: ora non è più vera.
    await supabase.from('fascicolo_scadenze').delete().eq('request_id', requestId).eq('codice', codice)

    return daRiga(data as RigaDocumento)
  },

  /** Byte già occupati da un'apparecchiatura, fascicolo generato compreso. */
  pesoDi: async (requestId: string, codice: string): Promise<number> => {
    const { data, error } = await supabase
      .from('fascicolo_documenti')
      .select('file_size')
      .eq('request_id', requestId)
      .eq('codice', codice)

    if (error) throw error
    return (data ?? []).reduce((somma, r: { file_size: number }) => somma + r.file_size, 0)
  },

  aggiornaClassificazione: async (id: string, patch: PatchClassificazione): Promise<void> => {
    const { error } = await supabase
      .from('fascicolo_documenti')
      .update({
        ruoli: patch.ruoli,
        valvola: patch.valvola ?? null,
        confidenza: patch.confidenza ?? null,
        motivazione: patch.motivazione ?? null,
        origine: patch.origine ?? null,
      })
      .eq('id', id)

    if (error) throw error
  },

  elimina: async (id: string): Promise<void> => {
    const { data, error: erroreLettura } = await supabase
      .from('fascicolo_documenti')
      .select('file_path')
      .eq('id', id)
      .single()
    if (erroreLettura) throw erroreLettura

    // Prima i byte, poi la riga: al contrario un errore lascerebbe un file senza indice.
    const { error: erroreStorage } = await supabase.storage
      .from(BUCKET_FASCICOLI)
      .remove([(data as { file_path: string }).file_path])
    if (erroreStorage) console.error('Rimozione del file non riuscita:', erroreStorage)

    const { error } = await supabase.from('fascicolo_documenti').delete().eq('id', id)
    if (error) throw error
  },

  /**
   * Cancella i documenti agganciati a codici che la scheda non contiene più.
   *
   * Serve perché un numero liberato si riassegna: senza questa passata un serbatoio nuovo
   * chiamato `S2` erediterebbe i documenti del vecchio `S2`.
   */
  eliminaOrfani: async (requestId: string, codiciValidi: string[]): Promise<number> => {
    const { data, error } = await supabase
      .from('fascicolo_documenti')
      .select('id, codice, file_path')
      .eq('request_id', requestId)

    if (error) throw error
    const validi = new Set(codiciValidi)
    const orfani = (data ?? []).filter((r: { codice: string }) => !validi.has(r.codice))
    if (orfani.length === 0) return 0

    await supabase.storage
      .from(BUCKET_FASCICOLI)
      .remove(orfani.map((r: { file_path: string }) => r.file_path))
    const { error: erroreDelete } = await supabase
      .from('fascicolo_documenti')
      .delete()
      .in('id', orfani.map((r: { id: string }) => r.id))
    if (erroreDelete) throw erroreDelete

    return orfani.length
  },

  scarica: async (filePath: string): Promise<Blob> => {
    const { data, error } = await supabase.storage.from(BUCKET_FASCICOLI).download(filePath)
    if (error) throw new Error(`Errore nello scaricamento: ${error.message}`)
    return data
  },

  /** La nota «fascicolo scaduto il …», se i documenti sono stati cancellati. */
  scadenzaDi: async (
    requestId: string,
    codice: string
  ): Promise<{ purgato_il: string; n_file: number } | null> => {
    const { data, error } = await supabase
      .from('fascicolo_scadenze')
      .select('purgato_il, n_file')
      .eq('request_id', requestId)
      .eq('codice', codice)
      .maybeSingle()

    if (error) throw error
    return data ?? null
  },
}
