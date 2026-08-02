import { parseModello } from '../modelName'
import { readNumericSpec } from '../specsNormalization'
import type { Finding, Rule } from '../types'
import { entityOf, fmt, makeFinding, pressureKey, rowIdentity } from './shared'

/**
 * Pressione scritta dentro il nome del modello.
 *
 * Finché la pressione sta nel nome, `GA 18 (@10bar)` e `GA 18 (@8,5bar)` sono
 * due modelli diversi anziché due varianti dello stesso: il selettore di
 * variante della scheda dati non ha nulla su cui lavorare e i confronti fra
 * portate non hanno un modello comune su cui appoggiarsi.
 *
 * La correzione sposta la pressione nei dati tecnici e ripulisce il nome. Non
 * viene proposta quando i due valori si contraddicono — pressione massima
 * inferiore a quella di esercizio — perché lì non si sa quale sia quello buono.
 */
export const pressioneNelNome: Rule = input => {
  const out: Finding[] = []

  for (const row of input.catalog) {
    const parsed = parseModello(row.modello)
    if (parsed.pattern === 'plain' || parsed.pressioneEsercizio === null) continue

    const ps = readNumericSpec(row.tipoApparecchiatura, row.specs, pressureKey(row.tipoApparecchiatura))
    const contraddittoria = ps !== null && ps < parsed.pressioneEsercizio

    const descrizioneRange =
      parsed.pattern === 'range' && parsed.rangeMin !== undefined
        ? ` Il nome indica l’intervallo ${fmt(parsed.rangeMin)}–${fmt(parsed.rangeMax!)} bar: si assume l’estremo superiore, a cui il costruttore dichiara la portata.`
        : ''

    out.push(
      makeFinding({
        rule: 'PRESSIONE_NEL_NOME',
        keyParts: [rowIdentity(row), fmt(parsed.pressioneEsercizio)],
        payload: [parsed.pressioneEsercizio, parsed.pattern],
        title: `${row.marca} · ${row.modello}`,
        detail:
          `La pressione di esercizio (${fmt(parsed.pressioneEsercizio)} bar) sta nel nome anziché nei dati tecnici: ` +
          `il modello diventa «${parsed.base}».${descrizioneRange}` +
          (contraddittoria
            ? ` Attenzione: i dati tecnici registrano ${fmt(ps!)} bar di pressione massima, meno di quella di esercizio.`
            : ''),
        entities: [entityOf(row)],
        fix: contraddittoria
          ? {
              kind: 'manual',
              hint: 'Chiarire prima quale pressione è corretta: spostarla adesso consoliderebbe un dato incoerente.',
            }
          : {
              kind: 'set_modello',
              rowId: row.id,
              modello: parsed.base,
              patch: { pressione_esercizio: parsed.pressioneEsercizio },
            },
      })
    )
  }

  return out
}
