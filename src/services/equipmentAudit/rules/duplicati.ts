import { normalizeKey } from '../modelName'
import { CANONICAL_SPECS, isEmptySpec } from '../specsNormalization'
import type { CatalogRow, Finding, Rule } from '../types'
import { baseModello, entityOf, fmt, groupBy, makeFinding, ratedPressure } from './shared'

/**
 * Righe che descrivono la stessa apparecchiatura.
 *
 * Il confronto ignora maiuscole e punteggiatura e usa il nome BASE del modello,
 * altrimenti `GA 18 (@10bar)` e `GA 18` risulterebbero estranei. Ma tiene conto
 * della chiave di variante — pressione per i compressori, taratura per le
 * valvole — perché due righe con lo stesso nome e pressioni diverse sono
 * varianti legittime dello stesso modello, non un duplicato.
 */

function variantValue(row: CatalogRow): string {
  const defs = row.tipoApparecchiatura ? CANONICAL_SPECS[row.tipoApparecchiatura] ?? [] : []
  if (!defs.some(d => d.isVariantKey)) return ''

  const p = ratedPressure(row)
  return p === null ? '' : fmt(p)
}

/** Unione dei dati tecnici: il primo valore non vuoto vince, in ordine di utilizzo. */
function mergeSpecs(rows: CatalogRow[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const row of rows) {
    for (const [k, v] of Object.entries(row.specs)) {
      if (!isEmptySpec(v) && isEmptySpec(out[k])) out[k] = v
    }
  }
  return out
}

export const duplicati: Rule = input => {
  const findings: Finding[] = []

  const groups = groupBy(input.catalog, row =>
    [
      row.tipoApparecchiatura ?? '',
      normalizeKey(row.marca),
      normalizeKey(baseModello(row)),
      variantValue(row),
    ].join('/')
  )

  for (const group of groups.values()) {
    if (group.length < 2) continue

    // Si conserva la riga più usata; a parità, la prima incontrata.
    const sorted = [...group].sort((a, b) => b.usageCount - a.usageCount)
    const keep = sorted[0]
    const drop = sorted.slice(1)

    // Nomi diversi renderebbero orfane le schede che citano quelli eliminati:
    // in quel caso la fusione va decisa a mano.
    const nomiIdentici = group.every(
      r => r.marca === keep.marca && r.modello === keep.modello
    )

    const aliases = [
      ...new Set(drop.filter(r => r.modello !== keep.modello).map(r => r.modello)),
    ]

    findings.push(
      makeFinding({
        rule: 'DUPLICATO',
        keyParts: [`${normalizeKey(keep.marca)}/${normalizeKey(baseModello(keep))}`, variantValue(keep)],
        payload: group.map(r => r.id).sort(),
        title: `${keep.marca} · ${baseModello(keep)}`,
        detail:
          `${group.length} righe descrivono la stessa apparecchiatura` +
          (nomiIdentici
            ? '.'
            : ` con nomi scritti diversamente (${group.map(r => `«${r.modello}»`).join(', ')}).`),
        entities: group.map(r =>
          entityOf(r, r.usageCount > 0 ? `usata ${r.usageCount}×` : 'mai usata')
        ),
        fix: nomiIdentici
          ? {
              kind: 'merge_rows',
              keepId: keep.id,
              dropIds: drop.map(r => r.id),
              mergedSpecs: mergeSpecs(sorted),
              mergedAliases: [...new Set([...(aliases ?? [])])],
            }
          : {
              kind: 'manual',
              hint: 'I nomi differiscono: uniformarli prima di fondere, altrimenti le schede che citano quelli eliminati restano scollegate dal catalogo.',
            },
      })
    )
  }

  return findings
}
