/**
 * Cronologia delle versioni salvate a mano dello schema d'impianto: bucket
 * `schema-impianto-versioni` per i PNG, tabella `schema_impianto_versioni` per l'indice.
 * Al massimo 5 versioni per pratica — questo servizio applica il limite dopo ogni
 * salvataggio, eliminando le più vecchie.
 */
import { supabase } from '../supabase'
import { DURATA_LINK_FIRMATO_S } from '@/utils/scaricaFile'
import type { SchemaImpianto } from '@/services/relazione/types'

export const BUCKET_SCHEMA_VERSIONI = 'schema-impianto-versioni'

/** Oltre questa soglia, le versioni più vecchie vengono eliminate a ogni salvataggio. */
const MASSIMO_VERSIONI = 5

interface RigaVersione {
  id: string
  request_id: string
  file_path: string
  file_size: number
  larghezza_px: number
  altezza_px: number
  created_at: string
}

export interface VersioneSchema {
  id: string
  filePath: string
  peso: number
  larghezzaPx: number
  altezzaPx: number
  creataIl: string
}

const daRiga = (r: RigaVersione): VersioneSchema => ({
  id: r.id,
  filePath: r.file_path,
  peso: r.file_size,
  larghezzaPx: r.larghezza_px,
  altezzaPx: r.altezza_px,
  creataIl: r.created_at,
})

const percorsoFile = (requestId: string): string => `${requestId}/${Date.now()}.png`

export const schemaImpiantoVersioniApi = {
  /** Le versioni salvate per questa pratica, dalla più recente. */
  elenca: async (requestId: string): Promise<VersioneSchema[]> => {
    const { data, error } = await supabase
      .from('schema_impianto_versioni')
      .select('*')
      .eq('request_id', requestId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data ?? []).map(daRiga as (r: unknown) => VersioneSchema)
  },

  /**
   * Salva lo schema attuale come nuova versione, poi elimina le eccedenti oltre le 5 più
   * recenti. Carica prima di potare: se il salvataggio fallisse a metà, la pratica resta
   * con le versioni di prima invece che con una in meno e nessuna in più.
   */
  salva: async (requestId: string, schema: SchemaImpianto): Promise<VersioneSchema> => {
    const { data: sessione } = await supabase.auth.getSession()
    if (!sessione.session) throw new Error('Non autenticato')

    const filePath = percorsoFile(requestId)
    const blob = new Blob([schema.dati as BlobPart], { type: 'image/png' })
    const { error: erroreUpload } = await supabase.storage
      .from(BUCKET_SCHEMA_VERSIONI)
      .upload(filePath, blob, { cacheControl: '3600', upsert: false, contentType: 'image/png' })
    if (erroreUpload) throw new Error(`Errore nel salvataggio della versione: ${erroreUpload.message}`)

    const { data, error } = await supabase
      .from('schema_impianto_versioni')
      .insert({
        request_id: requestId,
        file_path: filePath,
        file_size: schema.dati.byteLength,
        larghezza_px: schema.larghezzaPx,
        altezza_px: schema.altezzaPx,
        created_by: sessione.session.user.id,
      })
      .select('*')
      .single()

    if (error) {
      const { error: erroreRollback } = await supabase.storage.from(BUCKET_SCHEMA_VERSIONI).remove([filePath])
      if (erroreRollback) {
        console.error('Rimozione di rollback non riuscita, file orfano nello storage:', filePath, erroreRollback)
      }
      throw new Error(`Errore nel salvataggio della versione: ${error.message}`)
    }

    const tutte = await schemaImpiantoVersioniApi.elenca(requestId)
    const eccedenti = tutte.slice(MASSIMO_VERSIONI)
    for (const versione of eccedenti) {
      await schemaImpiantoVersioniApi.elimina(versione.id, versione.filePath)
    }

    return daRiga(data as RigaVersione)
  },

  /** Elimina una versione: file su Storage, poi la riga. `filePath` evita una lettura in più
   *  quando il chiamante ce l'ha già (vedi `salva` qui sopra). */
  elimina: async (id: string, filePath: string): Promise<void> => {
    const { error: erroreStorage } = await supabase.storage.from(BUCKET_SCHEMA_VERSIONI).remove([filePath])
    if (erroreStorage) console.error('Rimozione dello storage non riuscita:', filePath, erroreStorage)

    const { error } = await supabase.from('schema_impianto_versioni').delete().eq('id', id)
    if (error) throw new Error(`Errore nell'eliminazione della versione: ${error.message}`)
  },

  scarica: async (filePath: string): Promise<Blob> => {
    const { data, error } = await supabase.storage.from(BUCKET_SCHEMA_VERSIONI).download(filePath)
    if (error) throw new Error(`Errore nello scaricamento: ${error.message}`)
    return data
  },

  /** Link firmato per l'anteprima nell'elenco: il bucket è privato, come `relazioni`. */
  urlFirmato: async (filePath: string): Promise<string> => {
    const { data, error } = await supabase.storage
      .from(BUCKET_SCHEMA_VERSIONI)
      .createSignedUrl(filePath, DURATA_LINK_FIRMATO_S)
    if (error || !data) {
      throw new Error(`Errore nella preparazione dell'anteprima: ${error?.message ?? 'link non creato'}`)
    }
    return data.signedUrl
  },
}
