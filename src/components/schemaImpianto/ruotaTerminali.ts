/**
 * Rotazione dei terminali «alle utenze» sulla tela, in forma pura. In un file suo per la stessa
 * ragione di `posaNuoviOggetti.ts`: esportare una funzione da `SchemaEditor.tsx` fa scattare
 * `react-refresh/only-export-components`.
 */
import type { Node } from '@xyflow/react'
import type { Tarature } from '@/services/schemaImpianto/libreria'
import { ancoraDi, rotazioneUtenze } from '@/services/schemaImpianto/symbols'
import type { SchemaNodo } from '@/services/schemaImpianto/types'
import type { SchemaNodeData } from './SchemaNodeSymbol'

/** Vero se fra i nodi dati c'è almeno un terminale utenze: il solo simbolo che si ruota. */
export function haTerminali(nodes: Node[]): boolean {
  return nodes.some((n) => (n.data as SchemaNodeData).nodo.tipo === 'utenze')
}

/**
 * Ruota di 90° in senso orario i terminali utenze fra i nodi indicati; ogni altro nodo resta
 * com'è. Quattro pressioni riportano il terminale alla giacitura di partenza.
 *
 * Il perno è l'ATTACCO, non l'angolo del riquadro: la tubazione che arriva al terminale resta
 * dov'è e gli gira attorno il resto — è il gesto del CAD, e l'unico che non costringe a
 * ricollegare. L'origine del nodo si sposta quindi della differenza fra l'attacco di prima e
 * quello di dopo, che stanno entrambi sulla griglia (`geometriaUtenze`, symbols/index.ts).
 *
 * `rotazione` torna ASSENTE a 0°: un terminale mai ruotato e uno riportato dritto restano
 * indistinguibili nel salvato.
 */
export function ruotaTerminali(nodes: Node[], ids: Set<string>, libreria: Tarature = {}): Node[] {
  return nodes.map((n) => {
    const dati = n.data as SchemaNodeData
    if (!ids.has(n.id) || dati.nodo.tipo !== 'utenze') return n
    const prossima = ((rotazioneUtenze(dati.nodo) + 90) % 360) as 0 | 90 | 180 | 270
    const ruotato: SchemaNodo = { ...dati.nodo, rotazione: prossima }
    if (prossima === 0) delete ruotato.rotazione
    const prima = ancoraDi(dati.nodo, 'in', libreria)
    const dopo = ancoraDi(ruotato, 'in', libreria)
    const position =
      prima && dopo
        ? { x: n.position.x + prima.x - dopo.x, y: n.position.y + prima.y - dopo.y }
        : n.position
    return { ...n, position, data: { ...dati, nodo: ruotato } satisfies SchemaNodeData }
  })
}
