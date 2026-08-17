/**
 * Dove nasce ciò che si aggiunge a mano alla tela. In un file suo e non dentro `SchemaEditor.tsx`
 * per la stessa ragione degli hook accanto: esportare una funzione da un file di componenti fa
 * scattare `react-refresh/only-export-components`, e il progetto gira il lint con
 * `--max-warnings 0`.
 */
import type { Node } from '@xyflow/react'
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
