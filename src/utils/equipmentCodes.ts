/**
 * Codici apparecchiature DM329.
 *
 * Il `codice` è l'identità dell'apparecchiatura: assegnato una volta, mostrato così com'è, mai
 * riderivato dall'indice dell'array. Eliminando S2 da S1/S2/S3 l'ex S3 resta S3; una nuova
 * apparecchiatura riceve il numero libero più basso (S2), così i codici restano sempre entro
 * 1..max di EQUIPMENT_LIMITS.
 */

export interface ParsedCode {
  prefix: string
  num: number
  /** Sotto-numero dei figli: `C1.1` → sub 1. Assente nei codici principali. */
  sub?: number
}

const CODE_RE = /^([A-Z]+)(\d+)(?:\.(\d+))?$/

/** Scompone un codice, o ritorna null se non è un codice valido. */
export function parseCode(code: unknown): ParsedCode | null {
  if (typeof code !== 'string') return null
  const m = CODE_RE.exec(code.trim())
  if (!m) return null
  const parsed: ParsedCode = { prefix: m[1], num: Number(m[2]) }
  if (m[3] !== undefined) parsed.sub = Number(m[3])
  return parsed
}

/**
 * Ordine naturale dei codici: S1 < S2 < S10, C1 < C1.1, prefissi raggruppati.
 * I codici non validi finiscono in fondo.
 */
export function compareCodes(a: unknown, b: unknown): number {
  const pa = parseCode(a)
  const pb = parseCode(b)
  if (!pa && !pb) return 0
  if (!pa) return 1
  if (!pb) return -1
  if (pa.prefix !== pb.prefix) return pa.prefix.localeCompare(pb.prefix)
  if (pa.num !== pb.num) return pa.num - pb.num
  return (pa.sub ?? 0) - (pb.sub ?? 0)
}

/**
 * Numero libero più basso per il prefisso dato, entro 1..max.
 * I codici dei figli (`C1.1`) non riservano il numero del padre: un disoleatore orfano non
 * impedisce di creare il compressore C1.
 * Ritorna null se il tipo è saturo.
 */
export function nextFreeCode(prefix: string, existing: unknown[], max: number): string | null {
  const taken = new Set<number>()
  for (const code of existing) {
    const p = parseCode(code)
    if (p && p.prefix === prefix && p.sub === undefined) taken.add(p.num)
  }
  for (let n = 1; n <= max; n++) {
    if (!taken.has(n)) return `${prefix}${n}`
  }
  return null
}

/** Codice di un'apparecchiatura dipendente, derivato dal padre. */
export function childCode(parentCode: string, sub = 1): string {
  return `${parentCode}.${sub}`
}
