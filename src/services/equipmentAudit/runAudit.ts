import { duplicati } from './rules/duplicati'
import { fadMonotono } from './rules/fadMonotono'
import { pressioneNelNome } from './rules/pressioneNelNome'
import { qmaxMonotono } from './rules/qmaxMonotono'
import { schedeDati } from './rules/schedeDati'
import { serieMonotona } from './rules/serieMonotona'
import { specsIntegrity } from './rules/specsIntegrity'
import type { AuditInput, AuditReport, DismissalRecord, Finding, Rule, Severity } from './types'
import { SEVERITY_ORDER } from './types'

/**
 * Esecuzione della verifica di coerenza.
 *
 * Nessuna operazione di I/O: catalogo, schede e archiviazioni arrivano già
 * caricati. È questo che rende il motore verificabile contro dati noti senza
 * toccare il database.
 */

const RULES: readonly Rule[] = [
  specsIntegrity,
  fadMonotono,
  qmaxMonotono,
  serieMonotona,
  duplicati,
  pressioneNelNome,
  schedeDati,
]

export interface DismissalSplit {
  active: Finding[]
  dismissed: Array<Finding & { dismissal: DismissalRecord }>
  /** Archiviate i cui valori sono cambiati: tornano attive, marcate qui. */
  resurfacedKeys: string[]
}

/**
 * Separa le segnalazioni archiviate da quelle da mostrare.
 *
 * L'archiviazione vale per lo stato dei dati al momento della valutazione: se i
 * valori coinvolti cambiano, la segnalazione riemerge invece di restare sepolta.
 */
export function applyDismissals(
  findings: Finding[],
  dismissals: DismissalRecord[]
): DismissalSplit {
  const byKey = new Map(dismissals.map(d => [d.findingKey, d]))
  const active: Finding[] = []
  const dismissed: Array<Finding & { dismissal: DismissalRecord }> = []
  const resurfacedKeys: string[] = []

  for (const finding of findings) {
    const dismissal = byKey.get(finding.key)
    if (!dismissal) {
      active.push(finding)
      continue
    }

    if (dismissal.payloadHash === finding.payloadHash) {
      dismissed.push({ ...finding, dismissal })
    } else {
      active.push(finding)
      resurfacedKeys.push(finding.key)
    }
  }

  return { active, dismissed, resurfacedKeys }
}

function compare(a: Finding, b: Finding): number {
  const bySeverity = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  if (bySeverity !== 0) return bySeverity
  if (a.rule !== b.rule) return a.rule < b.rule ? -1 : 1
  return a.title.localeCompare(b.title, 'it')
}

export function runAudit(input: AuditInput): AuditReport {
  const raw = RULES.flatMap(rule => rule(input))

  // Una stessa riga può violare più regole: le chiavi restano distinte perché
  // includono la regola, ma un duplicato esatto sarebbe comunque un bug.
  const unique = new Map<string, Finding>()
  for (const f of raw) if (!unique.has(f.key)) unique.set(f.key, f)

  const { active, dismissed, resurfacedKeys } = applyDismissals([...unique.values()], input.dismissals)
  active.sort(compare)
  dismissed.sort(compare)

  const counts: Record<Severity, number> = { critica: 0, alta: 0, media: 0, bassa: 0 }
  for (const f of active) counts[f.severity]++

  return {
    stats: {
      catalogRows: input.catalog.length,
      sheetRows: input.sheets.length,
      sheetsScanned: new Set(input.sheets.map(s => s.technicalDataId)).size,
    },
    counts,
    findings: active,
    dismissed,
    resurfacedKeys,
  }
}
