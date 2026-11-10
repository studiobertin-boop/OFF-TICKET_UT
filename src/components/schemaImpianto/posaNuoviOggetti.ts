/**
 * Dove nasce ciò che si aggiunge a mano alla tela. In un file suo e non dentro `SchemaEditor.tsx`
 * per la stessa ragione degli hook accanto: esportare una funzione da un file di componenti fa
 * scattare `react-refresh/only-export-components`, e il progetto gira il lint con
 * `--max-warnings 0`.
 */
import type { Node } from '@xyflow/react'
import { SCARTO_INCOLLA } from '@/services/schemaImpianto/appunti'
import { allineaAllaGriglia } from '@/services/schemaImpianto/griglia'
import { estensioneOrizzontale } from '@/services/schemaImpianto/layout'
import type { Tarature } from '@/services/schemaImpianto/libreria'
import type { SchemaNodoPosizionato, SchemaTestoLibero } from '@/services/schemaImpianto/types'
import type { SchemaNodeData } from './SchemaNodeSymbol'

/**
 * Aria fra la cima del disegno e ciò che si posa sopra di essa: quanto basta perché
 * l'apparecchiatura più alta della palette non finisca addosso a ciò che c'era già.
 */
const STACCO_NUOVO_OGGETTO = 160

/** Lo stesso stacco, di fianco, quando l'oggetto ripiega a destra del disegno. */
const STACCO_LATERALE = 80

/**
 * Nuovo oggetto incolonnato sul bordo sinistro di quello più a sinistra — di solito il
 * compressore — e appena sopra la cima del disegno. Fino al 17-08-2026 nasceva sotto tutto il
 * disegno, e su uno schema alto bisognava inseguirlo scorrendo; il committente lo ha chiesto dove
 * sta già guardando.
 *
 * Quando sopra la cima non c'è spazio — un disegno che comincia a quota 90 e un serbatoio alto
 * 260 — la posa non si schiaccia a zero, dove l'oggetto nascerebbe addosso a quelli esistenti:
 * ripiega a destra di tutto il disegno, alla quota della cima. Sotto zero non si può andare,
 * perché `dimensioniLayout` misura il disegno solo dal bordo in giù e un nodo a ordinata negativa
 * verrebbe tagliato nel documento.
 *
 * Le annotazioni contano quanto le apparecchiature: `x`/`y` di un testo SONO il suo capo
 * alto-sinistro, quindi per il bordo sinistro e la cima bastano loro.
 */
export function sopraIlBordoSinistro(
  nodes: Node[],
  testi: SchemaTestoLibero[],
  libreria: Tarature = {}
): { x: number; y: number } {
  const ascisse = [...nodes.map((n) => n.position.x), ...testi.map((t) => t.x)]
  const cime = [...nodes.map((n) => n.position.y), ...testi.map((t) => t.y)]
  if (ascisse.length === 0) return { x: 40, y: 40 }

  const cima = Math.min(...cime)
  const quotaSopra = allineaAllaGriglia(cima - STACCO_NUOVO_OGGETTO)
  if (quotaSopra >= 0) return { x: allineaAllaGriglia(Math.min(...ascisse)), y: quotaSopra }

  // A destra dell'ingombro VERO, non della sola ascissa dei nodi: un simbolo largo si
  // ritroverebbe altrimenti sotto il nuovo oggetto. È la stessa misura che serve a centrare la
  // tabella sul disegno, e viene da lì (`estensioneOrizzontale`, layout.ts).
  const nodi: SchemaNodoPosizionato[] = nodes.map((n) => ({
    ...(n.data as SchemaNodeData).nodo,
    x: n.position.x,
    y: n.position.y,
  }))
  const destra = estensioneOrizzontale(nodi, testi, null, libreria).destra
  return { x: allineaAllaGriglia(destra + STACCO_LATERALE), y: allineaAllaGriglia(cima) }
}

/** Un rettangolo della tela, in unità del disegno. */
export interface RettangoloTela {
  x: number
  y: number
  larghezza: number
  altezza: number
}

/**
 * Quanto il nuovo oggetto nasce scostato dal punto dell'ultimo clic: in alto a destra, tre passi
 * di griglia. Esattamente sul punto finirebbe sopra ciò che si è appena cliccato — di solito il
 * tubo o il simbolo a cui lo si vuole collegare — coprendone l'attacco.
 */
const SCARTO_DAL_PUNTO = 30

/**
 * Dove nasce un TEE preso dalla palette: accanto al punto in cui si stava lavorando (10-11-2026).
 * Con `sopraIlBordoSinistro` nasceva sopra la cima del disegno, sul bordo sinistro: su uno schema
 * largo, a un TEE che serve quasi sempre in mezzo alla linea toccava attraversare tutta la tela.
 *
 * «Dove si stava lavorando» è l'ULTIMO PUNTO PREMUTO sulla tela, finché è ancora inquadrato; se
 * non c'è (editor appena aperto) o è uscito dall'inquadratura (si è scorso altrove dopo l'ultimo
 * clic), è il centro di ciò che la tela mostra adesso — che è comunque dove si sta guardando.
 *
 * Mai sotto zero, per la stessa ragione di `sopraIlBordoSinistro`: il documento misura il disegno
 * dal bordo in giù. E mai esattamente sopra un nodo che sta già lì: due TEE aggiunti di fila
 * senza toccare la tela si impilerebbero in un pallino solo, e il secondo sembrerebbe non nato.
 */
export function vicinoAlPuntoDiLavoro(
  ultimoPunto: { x: number; y: number } | null,
  inquadratura: RettangoloTela,
  dimensioni: { larghezza: number; altezza: number },
  nodes: Node[]
): { x: number; y: number } {
  const inquadrato =
    ultimoPunto !== null &&
    ultimoPunto.x >= inquadratura.x &&
    ultimoPunto.x <= inquadratura.x + inquadratura.larghezza &&
    ultimoPunto.y >= inquadratura.y &&
    ultimoPunto.y <= inquadratura.y + inquadratura.altezza
  // Il CENTRO dell'oggetto, poi riportato al suo angolo: è il centro che deve stare vicino al
  // punto, qualunque sia la misura del simbolo.
  const centro =
    inquadrato && ultimoPunto
      ? { x: ultimoPunto.x + SCARTO_DAL_PUNTO, y: ultimoPunto.y - SCARTO_DAL_PUNTO }
      : { x: inquadratura.x + inquadratura.larghezza / 2, y: inquadratura.y + inquadratura.altezza / 2 }
  let x = Math.max(0, allineaAllaGriglia(centro.x - dimensioni.larghezza / 2))
  let y = Math.max(0, allineaAllaGriglia(centro.y - dimensioni.altezza / 2))
  const occupato = () => nodes.some((n) => n.position.x === x && n.position.y === y)
  while (occupato()) {
    x += SCARTO_INCOLLA
    y += SCARTO_INCOLLA
  }
  return { x, y }
}
