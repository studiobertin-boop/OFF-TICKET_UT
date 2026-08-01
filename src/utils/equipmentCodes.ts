/**
 * Codici apparecchiature DM329.
 *
 * Il `codice` è l'identità dell'apparecchiatura: assegnato una volta, mostrato così com'è, mai
 * riderivato dall'indice dell'array. Eliminando S2 da S1/S2/S3 l'ex S3 resta S3; una nuova
 * apparecchiatura riceve il numero libero più basso (S2), così i codici restano sempre entro
 * 1..max di EQUIPMENT_LIMITS.
 */

import { EQUIPMENT_LIMITS } from '@/types'
import type { AdditionalInfo, TipoGiri } from '@/services/relazione/types'

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

/**
 * Codice dell'apparecchiatura che un nome file indirizza per posizione: `serbatoi` + indice 0 ⇒ `S1`,
 * `disoleatori` + indice 0 ⇒ `C1.1` (gli array dipendenti portano il suffisso del figlio).
 *
 * È solo la traduzione posizione → codice del nome file: non dice nulla su cosa la scheda contenga
 * davvero, quindi il chiamante deve comunque cercare il record con quel codice.
 * Ritorna null se l'array non ha limiti definiti o l'indice non è un intero non negativo.
 */
export function codeForArrayIndex(array: string, index: number): string | null {
  const limits = (EQUIPMENT_LIMITS as Record<string, { prefix: string; max: number; suffix?: string }>)[array]
  if (!limits || !Number.isInteger(index) || index < 0) return null
  return `${limits.prefix}${index + 1}${limits.suffix ?? ''}`
}

/** Array principali della scheda: prefisso e massimo vengono da EQUIPMENT_LIMITS. */
const PARENT_ARRAYS = ['serbatoi', 'compressori', 'essiccatori', 'filtri', 'separatori'] as const

/** Array dipendenti: il codice si deriva dal padre tramite il campo di riferimento. */
const CHILD_ARRAYS = [
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
      // altrimenti un `'S1 '` memorizzato farebbe scartare a `pruneAdditionalInfo` un riferimento valido.
      if (parseCode(item?.codice)) codes.add(item.codice.trim())
    }
  }
  return codes
}

/**
 * Completa i codici di una scheda senza rinumerare nulla di valido.
 *
 * Array principali: scorre nell'ordine in cui si trovano e assegna a ogni record privo di codice
 * valido — mancante, di prefisso sbagliato, fuori dal massimo del tipo, o duplicato di uno già
 * visto — il numero libero più basso.
 *
 * Array dipendenti: riallinea `codice` a `${riferimento}.1`. Il riferimento al padre deve avere
 * il prefisso e il numero entro i limiti specifici dell'array dipendente (es. disoleatori richiede
 * prefisso 'C' e num 1..5); se il riferimento non è valido il codice non è derivabile e il record
 * resta intatto. Anche quando il riferimento è valido, se il codice derivato è già occupato da un
 * altro figlio dello stesso padre, il record precedente conserva il codice e il nuovo resta intatto.
 *
 * Idempotente: applicata al proprio risultato ritorna `changed: false`.
 */
export function normalizeSchedaCodes<T extends Record<string, any>>(
  scheda: T
): { scheda: T; changed: boolean } {
  let changed = false
  const out: Record<string, any> = { ...(scheda ?? {}) }

  for (const name of PARENT_ARRAYS) {
    const items = scheda?.[name]
    if (!Array.isArray(items) || items.length === 0) continue

    const { prefix, max } = EQUIPMENT_LIMITS[name]
    const seen = new Set<number>()
    let touched = false

    // 1° passaggio: individua i codici da conservare.
    const keep = items.map((item: any) => {
      const p = parseCode(item?.codice)
      if (!p || p.prefix !== prefix || p.sub !== undefined || p.num < 1 || p.num > max) return false
      if (seen.has(p.num)) return false // duplicato: conserva il primo
      seen.add(p.num)
      return true
    })

    // 2° passaggio: assegna il numero libero più basso a chi ne è privo.
    const next = items.map((item: any, i: number) => {
      if (keep[i]) return item
      const taken = [...seen].map((n) => `${prefix}${n}`)
      const code = nextFreeCode(prefix, taken, max)
      if (!code) return item // tipo saturo: non c'è codice da assegnare
      seen.add(parseCode(code)!.num)
      touched = true
      return { ...item, codice: code }
    })

    if (touched) {
      out[name] = next
      changed = true
    }
  }

  for (const { array, ref } of CHILD_ARRAYS) {
    const items = scheda?.[array]
    if (!Array.isArray(items) || items.length === 0) continue

    const { prefix, max } = EQUIPMENT_LIMITS[array]
    /** Codice che il figlio dovrebbe avere, o null se il riferimento non è utilizzabile. */
    const expectedOf = (item: any): string | null => {
      const parent = parseCode(item?.[ref])
      if (!parent || parent.sub !== undefined) return null
      if (parent.prefix !== prefix || parent.num < 1 || parent.num > max) return null
      return childCode(item[ref])
    }
    const claimed = new Set<string>()
    // 1° passaggio: chi ha già il codice corretto lo mantiene e se lo riserva.
    items.forEach((item: any) => {
      const expected = expectedOf(item)
      if (expected && item?.codice === expected) claimed.add(expected)
    })
    // 2° passaggio: assegna a chi ne è privo, senza creare duplicati.
    let touched = false
    const next = items.map((item: any) => {
      const expected = expectedOf(item)
      if (!expected || item?.codice === expected) return item
      if (claimed.has(expected)) return item // il codice appartiene già a un altro figlio
      claimed.add(expected)
      touched = true
      return { ...item, codice: expected }
    })

    if (touched) {
      out[array] = next
      changed = true
    }
  }

  return { scheda: out as T, changed }
}

/**
 * Rimuove da `additional_info` i riferimenti a codici non più presenti nella scheda e riporta
 * cosa ha scartato, così il chiamante può dirlo all'utente.
 *
 * Attenzione al limite intrinseco del modello posizionale: se un codice liberato viene
 * riassegnato a una nuova apparecchiatura, un riferimento redatto per la precedente risulta
 * ancora valido e resta agganciato alla nuova. Qui non c'è l'informazione per distinguere i due
 * casi; la riconferma visiva nel dialog è la mitigazione.
 */
export function pruneAdditionalInfo(
  info: AdditionalInfo | undefined,
  codes: Set<string>
): { info: AdditionalInfo; dropped: string[] } {
  const src = info ?? {}
  const dropped: string[] = []

  const compressoriGiri: Record<string, TipoGiri> = {}
  for (const [code, giro] of Object.entries(src.compressoriGiri ?? {})) {
    if (codes.has(code)) compressoriGiri[code] = giro
    else dropped.push(`giri ${code}`)
  }

  const collegamentiCompressoriSerbatoi: Record<string, string[]> = {}
  for (const [code, serbatoi] of Object.entries(src.collegamentiCompressoriSerbatoi ?? {})) {
    if (!codes.has(code)) {
      dropped.push(`collegamenti ${code}`)
      continue
    }
    collegamentiCompressoriSerbatoi[code] = (serbatoi ?? []).filter((s) => {
      if (codes.has(s)) return true
      dropped.push(`collegamento ${code} → ${s}`)
      return false
    })
  }

  const spessimetrica = (src.spessimetrica ?? []).filter((code) => {
    if (codes.has(code)) return true
    dropped.push(`spessimetrica ${code}`)
    return false
  })

  return {
    info: { ...src, compressoriGiri, spessimetrica, collegamentiCompressoriSerbatoi },
    dropped,
  }
}
