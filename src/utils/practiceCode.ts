import { Request } from '@/types'

/**
 * Composizione del codice pratica DM329: CODICECLIENTE[LETTERASALA]_PROGRESSIVO-ANNO
 * es. "527A_00-2026" oppure "123_01-2025".
 *
 * La lettera della sala si OMETTE quando il cliente ha una sola sala
 * (clientSalaCount <= 1); compare automaticamente quando ne esistono due o più.
 */
export interface ComposeCodiceInput {
  clientCode?: string | null // customers.identificativo (già zero-pad)
  sala_lettera?: string | null
  progressivo?: number | null
  anno?: number | null
  clientSalaCount: number
}

const pad2 = (n: number) => String(n).padStart(2, '0')

export function composeCodicePratica({
  clientCode,
  sala_lettera,
  progressivo,
  anno,
  clientSalaCount,
}: ComposeCodiceInput): string {
  if (!clientCode || progressivo == null || anno == null) return ''
  const lettera = clientSalaCount > 1 && sala_lettera ? sala_lettera : ''
  return `${clientCode}${lettera}_${pad2(progressivo)}-${anno}`
}

/**
 * Nome del file della relazione tecnica: il codice pratica con «RELAZIONE» in mezzo alle
 * sue due parti — `602A_00-2026` → `602A_RELAZIONE_00-2026.docx`.
 *
 * Le pratiche senza codice — dati vecchi — ripiegano sulla ragione sociale: comporre il
 * nome dalle parti mancanti darebbe file chiamati tutti `_RELAZIONE_.docx`.
 */
export function nomeFileRelazione(codicePratica: string, ragioneSociale: string): string {
  const [cliente, pratica] = codicePratica.split('_')
  if (!cliente || !pratica) return `Relazione_${ragioneSociale || 'senza_cliente'}.docx`
  return `${cliente}_RELAZIONE_${pratica}.docx`
}

/**
 * Nome del file del fascicolo di un'apparecchiatura: il codice pratica spezzato nelle sue
 * due parti, col codice dell'apparecchiatura attaccato alla prima e il contenuto dichiarato
 * in mezzo — `602A_01-2026` + `E1` → `602A-E1_CERTIFICATI_MANUALI_FOTO_01-2026.pdf`.
 *
 * Stesso ripiego di `nomeFileRelazione`: le pratiche senza codice — dati vecchi — userebbero
 * un nome fatto di soli separatori.
 */
export function nomeFileFascicolo(
  codicePratica: string,
  codiceApparecchiatura: string,
  ragioneSociale: string
): string {
  const [cliente, pratica] = codicePratica.split('_')
  if (!cliente || !pratica) {
    return `Fascicolo_${codiceApparecchiatura}_${ragioneSociale || 'senza_cliente'}.pdf`
  }
  return `${cliente}-${codiceApparecchiatura}_CERTIFICATI_MANUALI_FOTO_${pratica}.pdf`
}

/**
 * Nome del file delle dichiarazioni: il codice pratica con «DICHIARAZIONI» in mezzo alle
 * sue due parti — `602A_00-2026` → `602A_DICHIARAZIONI_00-2026.pdf`.
 *
 * Stesso ripiego di `nomeFileRelazione`: le pratiche senza codice — dati vecchi — userebbero
 * un nome fatto di soli separatori.
 */
export function nomeFileDichiarazioni(codicePratica: string, ragioneSociale: string): string {
  const [cliente, pratica] = codicePratica.split('_')
  if (!cliente || !pratica) return `Dichiarazioni_${ragioneSociale || 'senza_cliente'}.pdf`
  return `${cliente}_DICHIARAZIONI_${pratica}.pdf`
}

/**
 * Numero di sale distinte di un cliente, calcolato dalle pratiche già caricate
 * (pratiche primarie: pratica_padre_id assente). Usato per decidere se mostrare la lettera.
 */
export function computeClientSalaCounts(requests: Request[]): Map<string, number> {
  const byClient = new Map<string, Set<string>>()
  for (const r of requests) {
    if (!r.customer_id || r.pratica_padre_id || !r.sala_lettera) continue
    if (!byClient.has(r.customer_id)) byClient.set(r.customer_id, new Set())
    byClient.get(r.customer_id)!.add(r.sala_lettera)
  }
  const counts = new Map<string, number>()
  byClient.forEach((set, cid) => counts.set(cid, set.size))
  return counts
}

/**
 * Codice pratica di una richiesta, dato il conteggio sale del suo cliente.
 * Restituisce '' se la pratica non ha ancora codice (dati vecchi).
 */
export function codiceForRequest(request: Request, clientSalaCount: number): string {
  return composeCodicePratica({
    clientCode: request.customer?.identificativo,
    sala_lettera: request.sala_lettera,
    progressivo: request.progressivo,
    anno: request.anno,
    clientSalaCount,
  })
}
