/**
 * La selezione di ciò che React Flow non conosce — testi liberi, aree, frecce di direzione sui
 * tubi, muro — e le due operazioni che la rendono un gruppo: il riquadro e lo spostamento.
 * Funzioni pure: l'hook che le usa è `useSelezioneMultipla.ts`.
 *
 * Il muro fa parte della selezione (Ctrl + clic, Canc) ma non del riquadro né dello spostamento
 * di gruppo: ha una logica sua (si muove solo in orizzontale, l'altezza si ricava dal disegno) e
 * cancellarlo col riquadro sarebbe una sorpresa. Deciso col committente il 17-09-2026.
 */
import { allineaAllaGriglia } from './griglia'
import { MEZZA_RIGA, ingombroTesto } from './layout'
import type { Punto } from './tratti'
import type { SchemaArea, SchemaTestoLibero } from './types'

export type ElementoLibero =
  | { tipo: 'muro' }
  | { tipo: 'testo'; id: string }
  | { tipo: 'area'; id: string }
  | { tipo: 'freccia'; arco: string; segno: string }

export function chiaveElemento(e: ElementoLibero): string {
  switch (e.tipo) {
    case 'muro':
      return 'muro'
    case 'freccia':
      return `freccia:${e.arco}:${e.segno}`
    default:
      return `${e.tipo}:${e.id}`
  }
}

/**
 * Cosa diventa la selezione quando si preme su un elemento. Con Ctrl lo si aggiunge o toglie. Senza
 * Ctrl si seleziona solo lui — tranne se era già selezionato: allora il gruppo resta intero, o non
 * si potrebbe mai trascinarlo (premere è l'inizio del trascinamento). Restituisce lo stesso array
 * quando non cambia nulla.
 */
export function selezioneDopoPressione(
  selezione: ElementoLibero[],
  elemento: ElementoLibero,
  aggiungi: boolean
): ElementoLibero[] {
  const chiave = chiaveElemento(elemento)
  const presente = selezione.some((e) => chiaveElemento(e) === chiave)
  if (aggiungi) return presente ? selezione.filter((e) => chiaveElemento(e) !== chiave) : [...selezione, elemento]
  return presente ? selezione : [elemento]
}

export interface Riquadro {
  sinistra: number
  alto: number
  destra: number
  basso: number
}

export function riquadroDaPunti(a: Punto, b: Punto): Riquadro {
  return {
    sinistra: Math.min(a.x, b.x),
    alto: Math.min(a.y, b.y),
    destra: Math.max(a.x, b.x),
    basso: Math.max(a.y, b.y),
  }
}

function contiene(r: Riquadro, sinistra: number, alto: number, destra: number, basso: number): boolean {
  return sinistra >= r.sinistra && alto >= r.alto && destra <= r.destra && basso <= r.basso
}

/** Una freccia sul tubo con il punto in cui la tela la disegna (`puntoSuTratto` sulla polilinea
 *  vera dell'arco): il servizio non conosce gli archi, e il punto lo calcola l'editor. */
export interface FrecciaPosata {
  arco: string
  segno: string
  punto: Punto
}

/**
 * Contenimento pieno, come React Flow per i nodi (`SelectionMode.Full`). Il testo si misura con
 * `ingombroTesto`, ma la sua `y` è il CENTRO della prima riga (`dominant-baseline="central"` in
 * `testoMultiRiga`, symbols/index.ts), non la sua base: il bordo alto va quindi mezza riga sopra la
 * `y`, e il bordo basso mezza riga sotto il centro dell'ultima riga che `ingombroTesto` restituisce
 * — stessa `MEZZA_RIGA` di `TestiLiberi.tsx`, condivisa da qui per non farla divergere in due file.
 */
export function elementiNelRiquadro(
  r: Riquadro,
  contenuto: { testi: SchemaTestoLibero[]; aree: SchemaArea[]; frecce: FrecciaPosata[] }
): ElementoLibero[] {
  const testi = contenuto.testi
    .filter((t) => {
      const ingombro = ingombroTesto(t)
      return contiene(r, t.x, t.y - MEZZA_RIGA, ingombro.destra, ingombro.basso + MEZZA_RIGA)
    })
    .map((t): ElementoLibero => ({ tipo: 'testo', id: t.id }))
  const aree = contenuto.aree
    .filter((a) => contiene(r, a.x, a.y, a.x + a.larghezza, a.y + a.altezza))
    .map((a): ElementoLibero => ({ tipo: 'area', id: a.id }))
  const frecce = contenuto.frecce
    .filter((f) => contiene(r, f.punto.x, f.punto.y, f.punto.x, f.punto.y))
    .map((f): ElementoLibero => ({ tipo: 'freccia', arco: f.arco, segno: f.segno }))
  return [...testi, ...aree, ...frecce]
}

/** Le posizioni di tutto ciò che uno spostamento di gruppo muove, per id. */
export interface PosizioniGruppo {
  nodi: Record<string, Punto>
  testi: Record<string, Punto>
  aree: Record<string, Punto>
}

export function gruppoVuoto(p: PosizioniGruppo): boolean {
  return Object.keys(p.nodi).length + Object.keys(p.testi).length + Object.keys(p.aree).length === 0
}

function mappa(origini: Record<string, Punto>, trasforma: (p: Punto) => Punto): Record<string, Punto> {
  return Object.fromEntries(Object.entries(origini).map(([id, p]) => [id, trasforma(p)]))
}

/**
 * Tutte le origini dello stesso scarto, con la posizione RISULTANTE agganciata alla griglia (come
 * `testiConSpostamento`: un'origine fuori griglia non si trascina dietro il proprio scarto per
 * sempre). I vincoli sono quelli che ciascun tipo ha già da solo: y ≥ 0 per i nodi, x e y ≥ 0 per
 * le aree, nessuno per i testi.
 */
export function posizioniSpostate(origini: PosizioniGruppo, dx: number, dy: number): PosizioniGruppo {
  const x = (p: Punto) => allineaAllaGriglia(p.x + dx)
  const y = (p: Punto) => allineaAllaGriglia(p.y + dy)
  return {
    nodi: mappa(origini.nodi, (p) => ({ x: x(p), y: Math.max(0, y(p)) })),
    testi: mappa(origini.testi, (p) => ({ x: x(p), y: y(p) })),
    aree: mappa(origini.aree, (p) => ({ x: Math.max(0, x(p)), y: Math.max(0, y(p)) })),
  }
}
