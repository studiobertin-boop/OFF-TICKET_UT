/**
 * Dove nasce ciò che si aggiunge a mano alla tela. In un file suo e non dentro `SchemaEditor.tsx`
 * per la stessa ragione degli hook accanto: esportare una funzione da un file di componenti fa
 * scattare `react-refresh/only-export-components`, e il progetto gira il lint con
 * `--max-warnings 0`.
 */
import type { Node } from '@xyflow/react'
import { allineaAllaGriglia } from '@/services/schemaImpianto/griglia'
import type { SchemaTestoLibero } from '@/services/schemaImpianto/types'

/**
 * Aria fra la cima del disegno e ciò che si posa sopra di essa: quanto basta perché
 * l'apparecchiatura più alta della palette non finisca addosso a ciò che c'era già.
 */
const STACCO_NUOVO_OGGETTO = 160

/**
 * Nuovo oggetto incolonnato sul bordo sinistro di quello più a sinistra — di solito il
 * compressore — e appena sopra la cima del disegno. Fino al 17-08-2026 nasceva sotto tutto il
 * disegno, e su uno schema alto bisognava inseguirlo scorrendo; il committente lo ha chiesto dove
 * sta già guardando.
 *
 * Le annotazioni contano quanto le apparecchiature: `x`/`y` di un testo SONO il suo capo
 * alto-sinistro, quindi bastano loro (`ingombroTesto`, layout.ts, calcola gli altri due lati, che
 * qui non servono). Nessuna libreria di tarature: si leggono posizioni, non ingombri.
 */
export function sopraIlBordoSinistro(nodes: Node[], testi: SchemaTestoLibero[]): { x: number; y: number } {
  const ascisse = [...nodes.map((n) => n.position.x), ...testi.map((t) => t.x)]
  const cime = [...nodes.map((n) => n.position.y), ...testi.map((t) => t.y)]
  if (ascisse.length === 0) return { x: 40, y: 40 }
  return {
    x: allineaAllaGriglia(Math.min(...ascisse)),
    // Mai oltre il bordo alto della tela: su un disegno che comincia in cima si posa a zero.
    y: Math.max(0, allineaAllaGriglia(Math.min(...cime) - STACCO_NUOVO_OGGETTO)),
  }
}
