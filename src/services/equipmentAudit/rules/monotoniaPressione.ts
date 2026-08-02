import type { CatalogRow, Finding, RuleId } from '../types'
import {
  baseModello,
  capacityOf,
  entityOf,
  fmt,
  groupBy,
  makeFinding,
  ratedPressure,
  rowIdentity,
} from './shared'
import { normalizeKey } from '../modelName'

/**
 * Coerenza fra pressione e portata all'interno dello stesso modello.
 *
 * Due regole fisiche, opposte nel verso ma identiche nella forma:
 *
 *  - un compressore che lavora a pressione più alta non può produrre più aria
 *    (`nonCrescente`);
 *  - una valvola tarata per aprirsi a pressione più alta non può scaricarne
 *    meno (`nonDecrescente`).
 *
 * Il confronto ha senso solo fra varianti dello stesso modello, quindi il
 * raggruppamento usa il nome BASE — senza la pressione che metà catalogo porta
 * nel nome — e la pressione a cui la portata è dichiarata.
 */

export type Direction = 'nonCrescente' | 'nonDecrescente'

interface Point {
  row: CatalogRow
  pressione: number
  capacita: number
}

function violates(dir: Direction, capLower: number, capUpper: number): boolean {
  return dir === 'nonCrescente' ? capUpper > capLower : capUpper < capLower
}

/**
 * Soglia oltre la quale lo scarto fra due capacità non è una differenza di
 * prestazione ma un errore di trascrizione: una cifra persa o una di troppo.
 */
const SOGLIA_ORDINE_GRANDEZZA = 5

/**
 * Nessuna correzione viene applicata da sola.
 *
 * Riscalare di dieci una delle due righe ripristina quasi sempre l'ordine, ma
 * quasi mai è la correzione giusta: su `AIRCENTER 12` (770 l/min a 10 bar, 1010
 * a 13) dividere per dieci darebbe 101 l/min, un valore privo di senso fisico.
 * Il motore quindi non sceglie: quando lo scarto ha l'aria di un errore di
 * cifra lo dice, e la verifica resta sui documenti del costruttore.
 */
function scaleHint(coppie: Array<[Point, Point]>, unita: string): string | null {
  for (const [a, b] of coppie) {
    const min = Math.min(a.capacita, b.capacita)
    const max = Math.max(a.capacita, b.capacita)
    if (min <= 0 || max / min < SOGLIA_ORDINE_GRANDEZZA) continue

    const basso = a.capacita < b.capacita ? a : b
    const alto = a.capacita < b.capacita ? b : a
    return (
      `Lo scarto è di quasi un ordine di grandezza: ${fmt(basso.capacita)} ${unita} ` +
      `(${basso.row.modello}) contro ${fmt(alto.capacita)} ${unita} (${alto.row.modello}). ` +
      `Verificare se a ${fmt(basso.capacita)} manca una cifra.`
    )
  }
  return null
}

export interface MonotoniaConfig {
  rule: RuleId
  direction: Direction
  /** Etichette usate nei testi delle segnalazioni. */
  nomePressione: string
  nomeCapacita: string
  unitaPressione: string
  unitaCapacita: string
}

export function checkMonotoniaPressione(rows: CatalogRow[], cfg: MonotoniaConfig): Finding[] {
  const points: Point[] = []
  for (const row of rows) {
    const pressione = ratedPressure(row)
    const capacita = capacityOf(row)
    // Senza entrambi i valori il confronto non è possibile: tacere è meglio
    // che segnalare l'intero catalogo prima della normalizzazione.
    if (pressione === null || capacita === null) continue
    points.push({ row, pressione, capacita })
  }

  const findings: Finding[] = []

  for (const group of groupBy(points, p =>
    `${normalizeKey(p.row.marca)}/${normalizeKey(baseModello(p.row))}`
  ).values()) {
    if (group.length < 2) continue

    const sorted = [...group].sort((a, b) => a.pressione - b.pressione)
    if (new Set(sorted.map(p => p.pressione)).size < 2) continue

    const coppie: Array<[Point, Point]> = []
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i]
      const b = sorted[i + 1]
      if (b.pressione > a.pressione && violates(cfg.direction, a.capacita, b.capacita)) {
        coppie.push([a, b])
      }
    }
    if (coppie.length === 0) continue

    const first = sorted[0].row
    const verso = cfg.direction === 'nonCrescente' ? 'non può crescere' : 'non può calare'
    const dettaglio = coppie
      .map(
        ([a, b]) =>
          `a ${fmt(a.pressione)} ${cfg.unitaPressione} risulta ${fmt(a.capacita)} ${cfg.unitaCapacita} ` +
          `(${a.row.modello}), a ${fmt(b.pressione)} ${cfg.unitaPressione} ne risulta ` +
          `${fmt(b.capacita)} ${cfg.unitaCapacita} (${b.row.modello})`
      )
      .join('; ')

    findings.push(
      makeFinding({
        rule: cfg.rule,
        keyParts: [rowIdentity(first)],
        payload: sorted.map(p => [p.pressione, p.capacita]),
        title: `${first.marca} · ${baseModello(first)}`,
        detail:
          `Al crescere della ${cfg.nomePressione} ${cfg.nomeCapacita} ${verso}: ${dettaglio}.`,
        entities: sorted.map(p => entityOf(p.row, `${fmt(p.pressione)} ${cfg.unitaPressione}`)),
        fix: {
          kind: 'manual',
          hint:
            scaleHint(coppie, cfg.unitaCapacita) ??
            `Verificare ${cfg.nomeCapacita} sulla documentazione del costruttore e correggere la riga errata.`,
        },
      })
    )
  }

  return findings
}
