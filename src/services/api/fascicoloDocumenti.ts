import { supabase } from '../supabase'
import { DURATA_LINK_FIRMATO_S } from '@/utils/scaricaFile'
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

/**
 * Classificazione di un documento: non è un patch, è una riscrittura completa.
 *
 * `aggiornaClassificazione` scrive tutti e cinque i campi ad ogni chiamata — quelli omessi
 * diventano `null` — perché i chiamanti passano sempre l'esito intero della classificazione,
 * mai solo la parte che cambia.
 */
export interface ClassificazioneDocumento {
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

  /** Codici che hanno già un fascicolo composto (tipo='fascicolo'), per l'intera pratica. */
  codiciConFascicolo: async (requestId: string): Promise<Set<string>> => {
    const { data, error } = await supabase
      .from('fascicolo_documenti')
      .select('codice')
      .eq('request_id', requestId)
      .eq('tipo', 'fascicolo')

    if (error) throw error
    return new Set((data ?? []).map((r: { codice: string }) => r.codice))
  },

  carica: async ({ requestId, codice, file, tipo = 'sorgente' }: CaricaDocumentoInput): Promise<DocumentoFascicolo> => {
    const { data: sessione } = await supabase.auth.getSession()
    if (!sessione.session) throw new Error('Non autenticato')

    // Il tetto è per apparecchiatura: il limite scatta dove il tecnico sta lavorando.
    // Quando si sta caricando un nuovo fascicolo generato, quello vecchio (se c'è) è già
    // condannato — `genera()` lo elimina subito dopo — e non va contato: altrimenti con
    // sorgenti pesanti la rigenerazione rifiuterebbe citando un tetto che non verrebbe
    // davvero superato una volta tolto il fascicolo precedente.
    const gia = await fascicoloDocumentiApi.pesoDi(requestId, codice, { escludiFascicoloEsistente: tipo === 'fascicolo' })
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
      // Senza la riga il file sarebbe un peso invisibile: si toglie subito. Se anche questa
      // rimozione fallisce non c'è un secondo tentativo — l'utente vede comunque l'errore di
      // salvataggio — ma l'esito va almeno in console, come fa `elimina`: altrimenti il file
      // orfano resta lì senza che nulla lo segnali.
      const { error: erroreRollback } = await supabase.storage.from(BUCKET_FASCICOLI).remove([filePath])
      if (erroreRollback) {
        console.error('Rimozione di rollback non riuscita, file orfano nello storage:', filePath, erroreRollback)
      }
      throw new Error(`Errore nel salvataggio del documento: ${error.message}`)
    }

    // La riga di scadenza vale finché non si ricarica: ora non è più vera.
    await supabase.from('fascicolo_scadenze').delete().eq('request_id', requestId).eq('codice', codice)

    return daRiga(data as RigaDocumento)
  },

  /**
   * Byte già occupati da un'apparecchiatura, fascicolo generato compreso — a meno di
   * `escludiFascicoloEsistente`, che serve solo a `carica` quando sta salendo un fascicolo che
   * sta per sostituire quello attuale.
   */
  pesoDi: async (
    requestId: string,
    codice: string,
    opzioni?: { escludiFascicoloEsistente?: boolean }
  ): Promise<number> => {
    let query = supabase
      .from('fascicolo_documenti')
      .select('file_size')
      .eq('request_id', requestId)
      .eq('codice', codice)
    if (opzioni?.escludiFascicoloEsistente) {
      query = query.neq('tipo', 'fascicolo')
    }
    const { data, error } = await query

    if (error) throw error
    return (data ?? []).reduce((somma, r: { file_size: number }) => somma + r.file_size, 0)
  },

  aggiornaClassificazione: async (id: string, patch: ClassificazioneDocumento): Promise<void> => {
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

    // Prima i byte, poi la riga: se lo storage fallisce ci si ferma qui, senza cancellare la
    // riga. Inghiottire l'errore lascerebbe un file irraggiungibile — nessun percorso porta più
    // a lui, non lo vede `eliminaOrfani`, non conta nel tetto — cioè spazio perso per sempre.
    // Così l'unico stato residuo possibile è «riga che punta al vuoto», visibile e rimediabile.
    const { error: erroreStorage } = await supabase.storage
      .from(BUCKET_FASCICOLI)
      .remove([(data as { file_path: string }).file_path])
    if (erroreStorage) throw new Error(`Rimozione del file non riuscita: ${erroreStorage.message}`)

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
    // Una lista vuota non è mai un elenco di codici validi da rispettare: è più probabile un
    // errore a monte (calcolo dei codici non ancora pronto, scheda non ancora caricata), e
    // trattarla come tale cancellerebbe ogni documento della pratica. Il caso legittimo — l'unica
    // apparecchiatura viene eliminata — resta coperto dalla passata notturna, che i codici validi
    // li ricava dal database, non da un elenco passato a mano.
    if (codiciValidi.length === 0) return 0

    const { data, error } = await supabase
      .from('fascicolo_documenti')
      .select('id, codice, file_path')
      .eq('request_id', requestId)

    if (error) throw error
    const validi = new Set(codiciValidi)
    const orfani = (data ?? []).filter((r: { codice: string }) => !validi.has(r.codice))
    if (orfani.length === 0) return 0

    // Prima i byte, poi le righe: un fallimento qui deve fermare anche la cancellazione delle
    // righe, altrimenti i file orfani nel bucket smettono pure di essere tracciati in tabella.
    // Rimuovere un percorso già assente non è un errore per lo Storage, quindi propagare non
    // rompe i casi normali.
    const { error: erroreStorage } = await supabase.storage
      .from(BUCKET_FASCICOLI)
      .remove(orfani.map((r: { file_path: string }) => r.file_path))
    if (erroreStorage) throw new Error(`Rimozione dei file orfani non riuscita: ${erroreStorage.message}`)

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

  /**
   * Link firmato per far scaricare il file al browser: vedi `utils/scaricaFile`.
   *
   * Resta distinto da `scarica`, che serve a tutt'altro — leggere i byte per comporre il
   * fascicolo (`services/fascicolo/sorgente`) — e per quello il blob è la forma giusta.
   */
  urlFirmato: async (filePath: string, nome: string): Promise<string> => {
    const { data, error } = await supabase.storage
      .from(BUCKET_FASCICOLI)
      .createSignedUrl(filePath, DURATA_LINK_FIRMATO_S, { download: nome })
    if (error || !data) {
      throw new Error(`Errore nella preparazione dello scaricamento: ${error?.message ?? 'link non creato'}`)
    }
    return data.signedUrl
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
