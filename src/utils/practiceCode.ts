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
