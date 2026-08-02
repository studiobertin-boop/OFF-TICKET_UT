import { normalizeKey, parseSerie } from '../modelName'
import type { CatalogRow, Finding, Rule } from '../types'
import { baseModello, capacityOf, entityOf, fmt, makeFinding, ratedPressure } from './shared'

/**
 * Progressione delle taglie dentro una serie.
 *
 * I costruttori numerano i modelli in ordine di capacità: un FRIULAIR AMD 130
 * tratta più aria di un AMD 105 e meno di un AMD 168. Una taglia superiore con
 * capacità inferiore è quindi sospetta.
 *
 * È però una regola EURISTICA, e i dati lo dimostrano: KAESER ASK 34 e ASK 35
 * appartengono a generazioni diverse e la progressione non vale fra loro. Per
 * questo la regola nasce disattivata, ha gravità bassa e non propone mai
 * correzioni — segnala un sospetto da verificare, non un errore accertato.
 *
 * Il raggruppamento è volutamente stretto (stessa marca, stessa famiglia, stesso
 * suffisso, stessa pressione) proprio per contenere i falsi positivi.
 */

interface Point {
  row: CatalogRow
  numero: number
  capacita: number
}

/** Serve una serie di almeno tre taglie perché la progressione sia un'evidenza. */
const MIN_SERIE = 3

export const serieMonotona: Rule = input => {
  if (!input.options.includeHeuristics) return []

  const points = new Map<string, Point[]>()

  for (const row of input.catalog) {
    const capacita = capacityOf(row)
    if (capacita === null) continue

    const serie = parseSerie(baseModello(row))
    if (!serie.famiglia || serie.numero === null) continue

    const pressione = ratedPressure(row)
    const key = [
      row.tipoApparecchiatura ?? '',
      normalizeKey(row.marca),
      serie.famiglia,
      normalizeKey(serie.suffisso),
      pressione === null ? '' : fmt(pressione),
    ].join('/')

    const bucket = points.get(key)
    const point: Point = { row, numero: serie.numero, capacita }
    if (bucket) bucket.push(point)
    else points.set(key, [point])
  }

  const findings: Finding[] = []

  for (const group of points.values()) {
    if (group.length < MIN_SERIE) continue

    const sorted = [...group].sort((a, b) => a.numero - b.numero)
    const coppie: Array<[Point, Point]> = []
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i]
      const b = sorted[i + 1]
      if (b.numero > a.numero && b.capacita < a.capacita) coppie.push([a, b])
    }
    if (coppie.length === 0) continue

    const first = sorted[0].row
    const serie = parseSerie(baseModello(first))
    const dettaglio = coppie
      .map(
        ([a, b]) =>
          `${a.row.modello} dichiara ${fmt(a.capacita)}, ${b.row.modello} — di taglia superiore — ne dichiara ${fmt(b.capacita)}`
      )
      .join('; ')

    findings.push(
      makeFinding({
        rule: 'SERIE_NON_MONOTONA',
        // La chiave è la serie, non i singoli modelli: archiviare un falso
        // positivo deve zittire la serie, non una coppia alla volta.
        keyParts: [`${normalizeKey(first.marca)}/${serie.famiglia}/${normalizeKey(serie.suffisso)}`],
        // Solo i modelli, non le capacità: aggiornare un valore della serie non
        // deve far riemergere un falso positivo già valutato.
        payload: sorted.map(p => normalizeKey(p.row.modello)),
        title: `${first.marca} · serie ${serie.famiglia}${serie.suffisso ? ` ${serie.suffisso}` : ''}`,
        detail: `La capacità non cresce con la taglia: ${dettaglio}. Può essere un errore oppure un cambio di generazione del modello.`,
        entities: sorted.map(p => entityOf(p.row, `taglia ${fmt(p.numero)}`)),
        fix: {
          kind: 'manual',
          hint: 'Confrontare con il catalogo del costruttore: se le taglie appartengono a generazioni diverse, archiviare la segnalazione.',
        },
      })
    )
  }

  return findings
}
