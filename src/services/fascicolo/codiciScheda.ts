/**
 * Quali codici di apparecchiatura esistono davvero in una scheda DM329.
 *
 * `equipmentCodes.ts` e la passata notturna che rimuove i documenti orfani devono concordare
 * sulla stessa nozione di «codice valido»: sono le due metà dello stesso criterio con cui si
 * decide se un documento va cancellato. Due copie divergerebbero — lo stesso motivo per cui
 * `scadenza.ts` (la regola di scadenza) vive in un modulo solo, importato da entrambe le parti.
 *
 * Il modulo non importa nulla apposta: viene caricato anche da Deno, dove `@/` non esiste.
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

/** Array principali della scheda: prefisso e massimo vengono da EQUIPMENT_LIMITS (lato client). */
export const PARENT_ARRAYS = ['serbatoi', 'compressori', 'essiccatori', 'filtri', 'separatori'] as const

/** Array dipendenti: il codice si deriva dal padre tramite il campo di riferimento. */
export const CHILD_ARRAYS = [
  { array: 'disoleatori', ref: 'compressore_associato' },
  { array: 'scambiatori', ref: 'essiccatore_associato' },
  { array: 'recipienti_filtro', ref: 'filtro_associato' },
] as const

/** Tutti i codici validi presenti nella scheda, per validare i riferimenti. */
export function collectCodes(scheda: any): Set<string> {
  const codes = new Set<string>()
  const names: string[] = [...PARENT_ARRAYS, ...CHILD_ARRAYS.map((c) => c.array)]
  for (const name of names) {
    const items = scheda?.[name]
    if (!Array.isArray(items)) continue
    for (const item of items) {
      // `parseCode` tollera gli spazi: il codice entra nell'insieme nella stessa forma normalizzata,
      // altrimenti un `'S1 '` memorizzato farebbe scartare un riferimento valido.
      if (parseCode(item?.codice)) codes.add(item.codice.trim())
    }
  }
  return codes
}
