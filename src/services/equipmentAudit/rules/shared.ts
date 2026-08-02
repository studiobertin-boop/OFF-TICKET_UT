import type { EquipmentCatalogType } from '@/types'
import { buildFindingKey, buildPayloadHash } from '../findingKey'
import { normalizeKey, parseModello } from '../modelName'
import { readNumericSpec } from '../specsNormalization'
import type { CatalogRow, Finding, FindingEntity, FindingFix, RuleId } from '../types'
import { HEURISTIC_RULES, RULE_SEVERITY } from '../types'

/** Chiave del dato di capacità, che cambia nome con il tipo di apparecchiatura. */
export function capacityKey(tipo: EquipmentCatalogType | null): string {
  switch (tipo) {
    case 'Compressori':
      return 'fad'
    case 'Essiccatori':
      return 'q'
    case 'Valvole di sicurezza':
      return 'qmax'
    default:
      return 'volume'
  }
}

/** Chiave della pressione di riferimento del tipo. */
export function pressureKey(tipo: EquipmentCatalogType | null): string {
  switch (tipo) {
    case 'Compressori':
      return 'pressione_max'
    case 'Valvole di sicurezza':
      return 'ptar'
    default:
      return 'ps'
  }
}

/**
 * Pressione a cui è dichiarata la capacità della riga.
 *
 * Il nome del modello ha la precedenza: quando il costruttore scrive
 * `ASD 40 (@13bar)` sta dichiarando esplicitamente il punto di misura della
 * portata, mentre `specs.pressione` è la pressione massima della macchina — due
 * grandezze che su KAESER differiscono sistematicamente.
 */
export function ratedPressure(row: CatalogRow): number | null {
  const fromName = parseModello(row.modello).pressioneEsercizio
  if (fromName !== null) return fromName

  const stored = readNumericSpec(row.tipoApparecchiatura, row.specs, 'pressione_esercizio')
  if (stored !== null) return stored

  return readNumericSpec(row.tipoApparecchiatura, row.specs, pressureKey(row.tipoApparecchiatura))
}

export function capacityOf(row: CatalogRow): number | null {
  return readNumericSpec(row.tipoApparecchiatura, row.specs, capacityKey(row.tipoApparecchiatura))
}

/** Nome base del modello, senza la pressione. */
export function baseModello(row: CatalogRow): string {
  return parseModello(row.modello).base
}

export function entityOf(row: CatalogRow, suffix?: string): FindingEntity {
  const parts = [row.marca, row.modello]
  if (suffix) parts.push(suffix)
  return { kind: 'catalog', id: row.id, label: parts.filter(Boolean).join(' · ') }
}

/** Raggruppa le righe per una chiave, preservando l'ordine d'inserimento. */
export function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>()
  for (const item of items) {
    const k = key(item)
    const bucket = out.get(k)
    if (bucket) bucket.push(item)
    else out.set(k, [item])
  }
  return out
}

export function catalogOfType(rows: CatalogRow[], tipo: EquipmentCatalogType): CatalogRow[] {
  return rows.filter(r => r.tipoApparecchiatura === tipo)
}

/** Identità semantica di una riga: sopravvive a fusioni e ricreazioni. */
export function rowIdentity(row: CatalogRow): string {
  return `${normalizeKey(row.marca)}/${normalizeKey(baseModello(row))}`
}

/**
 * Parti di chiave per le segnalazioni che riguardano UNA riga.
 *
 * All'identità va aggiunta la pressione, altrimenti le varianti dello stesso
 * modello — che condividono il nome base — collasserebbero in una segnalazione
 * sola e le altre sparirebbero dal report. La pressione è stabile attraverso la
 * normalizzazione dei nomi: prima la si legge dal nome, dopo dai dati tecnici.
 */
export function rowKeyParts(row: CatalogRow): string[] {
  const p = ratedPressure(row)
  return [rowIdentity(row), p === null ? '' : fmt(p)]
}

export interface FindingDraft {
  rule: RuleId
  scope?: 'catalogo' | 'scheda'
  /** Parti identificative della chiave di archiviazione: mai UUID, mai valori. */
  keyParts: string[]
  /** Valori la cui variazione deve far decadere l'archiviazione. */
  payload: unknown
  title: string
  detail: string
  entities: FindingEntity[]
  fix: FindingFix
}

export function makeFinding(draft: FindingDraft): Finding {
  return {
    key: buildFindingKey(draft.rule, draft.keyParts),
    payloadHash: buildPayloadHash(draft.payload),
    rule: draft.rule,
    severity: RULE_SEVERITY[draft.rule],
    heuristic: HEURISTIC_RULES.has(draft.rule),
    scope: draft.scope ?? 'catalogo',
    title: draft.title,
    detail: draft.detail,
    entities: draft.entities,
    fix: draft.fix,
  }
}

/** Formattazione compatta dei numeri per i testi delle segnalazioni. */
export function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)))
}
