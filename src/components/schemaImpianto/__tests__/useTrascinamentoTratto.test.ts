import { describe, it, expect } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { Edge, Node } from '@xyflow/react'
import { useSchemaHistory } from '../useSchemaHistory'
import { useTrascinamentoTratto, indiceTrattoPiuVicino } from '../useTrascinamentoTratto'
import type { SchemaEdgeData } from '../SchemaEdgeTubazione'
import type { Punto, QuoteInstradamento } from '@/services/schemaImpianto/tratti'

describe('indiceTrattoPiuVicino', () => {
  it('trova il tratto orizzontale quando il clic cade su di esso', () => {
    const full = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ]
    expect(indiceTrattoPiuVicino(full, { x: 50, y: 0 })).toBe(0)
  })

  it('trova il tratto verticale quando il clic cade su quello', () => {
    const full = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ]
    expect(indiceTrattoPiuVicino(full, { x: 100, y: 80 })).toBe(1)
  })
})

/**
 * Cronologia del gesto: `useTrascinamentoTratto` non basta da solo, perché "entrare in
 * cronologia" è un effetto sulla coppia `applica`/`aggiornaSenzaCronologia` di
 * `useSchemaHistory` — la stessa combinazione che monta `SchemaEditor`. Precedente in casa:
 * `useSchemaHistory.test.ts` monta l'hook nudo con `renderHook`/`act`, senza componenti React;
 * qui si monta la coppia di hook allo stesso modo, sull'arco singolo che il gesto tocca.
 *
 * Arco senza gomiti: pDa=(0,0), pA=(100,100), stile 'standard' → `instrada` (nessun gomito)
 * dà la polilinea nativa [(0,0),(50,0),(50,100),(100,100)]; il tratto 1, fra (50,0) e (50,100),
 * è quello verticale afferrato in tutti i casi qui sotto (indiceTratto fisso: il componente lo
 * ricalcolerebbe da `indiceTrattoPiuVicino`, qui si passa direttamente perché non si monta la
 * tela).
 */
interface Stato {
  nodes: Node[]
  edges: Edge[]
}

const QUOTE: QuoteInstradamento = { yCollettore: 0, yCorsiaCondense: 0 }
const P_DA: Punto = { x: 0, y: 0 }
const P_A: Punto = { x: 100, y: 100 }
const PRESA: Punto = { x: 50, y: 25 }
const INDICE_TRATTO = 1

function arco(punti: Punto[] | undefined): Edge {
  return { id: 'e1', source: 's', target: 't', data: { stile: 'standard', punti } satisfies SchemaEdgeData }
}

function montaArmonia(punti: Punto[] | undefined) {
  return renderHook(() => {
    const history = useSchemaHistory<Stato>({ nodes: [], edges: [arco(punti)] })
    const { edgesConTrascinamento } = useTrascinamentoTratto(history.stato, history.applica, history.aggiornaSenzaCronologia, QUOTE)
    return { ...history, edgesConTrascinamento }
  })
}

/** Emette un evento del gesto sull'unico arco montato, dentro `act`. */
function evento(
  hook: ReturnType<typeof montaArmonia>,
  puntoLibero: Punto,
  concluso: boolean,
  indiceTratto = INDICE_TRATTO
) {
  act(() => {
    const data = hook.result.current.edgesConTrascinamento[0].data as SchemaEdgeData
    data.onTrascinaTratto!(P_DA, P_A, indiceTratto, puntoLibero, concluso)
  })
}

function punti(hook: ReturnType<typeof montaArmonia>): Punto[] | undefined {
  return (hook.result.current.stato.edges[0].data as SchemaEdgeData).punti
}

describe('cronologia di useTrascinamentoTratto', () => {
  it('A. arco senza gomiti: il trascinamento vero entra in cronologia allo stato pulito, e Ctrl+Z torna all’instradamento automatico', () => {
    const hook = montaArmonia(undefined)

    evento(hook, PRESA, false) // primo evento, delta nullo per costruzione
    evento(hook, { x: 70, y: 25 }, false) // spostamento vero
    evento(hook, { x: 70, y: 25 }, true) // rilascio, non tornato sulla presa

    expect(punti(hook)).not.toBeUndefined() // la rotta è stata materializzata in gomiti a mano
    expect(hook.result.current.puoAnnullare).toBe(true)

    act(() => hook.result.current.annulla())
    expect(punti(hook)).toBeUndefined() // torna allo stato pulito, non a una rotta cotta in gomiti
    expect(hook.result.current.puoAnnullare).toBe(false)
  })

  it('B. gesto a vuoto con spostamento intermedio: una sola voce di cronologia, stato finale svuotato come all’inizio', () => {
    const hook = montaArmonia(undefined)

    evento(hook, PRESA, false) // primo evento, delta nullo
    evento(hook, { x: 70, y: 25 }, false) // si allontana dalla presa
    evento(hook, PRESA, false) // torna sulla presa (ancora in corso)
    evento(hook, PRESA, true) // rilascia sulla presa

    expect(punti(hook)).toEqual([]) // arco senza gomiti a mano: lo stato di partenza È il vuoto
    expect(hook.result.current.puoAnnullare).toBe(true) // una voce scritta (al secondo evento)

    act(() => hook.result.current.annulla())
    expect(punti(hook)).toBeUndefined() // un solo passo di cronologia: si torna allo stato vero di partenza
    expect(hook.result.current.puoAnnullare).toBe(false)
  })

  it('C. gesto che non esce mai dalla cella di presa: zero voci di cronologia, punti resta esattamente undefined', () => {
    const hook = montaArmonia(undefined)

    evento(hook, PRESA, false) // primo evento
    evento(hook, PRESA, true) // rilascio nello stesso punto: mai un delta non nullo

    expect(punti(hook)).toBeUndefined() // non deve nemmeno diventare `[]`
    expect(hook.result.current.puoAnnullare).toBe(false)
  })

  it('D. arco con gomiti a mano che si muove e torna: i gomiti a mano vengono preservati', () => {
    const gomitiOriginali: Punto[] = [{ x: 50, y: 50 }]
    const hook = montaArmonia(gomitiOriginali)

    evento(hook, PRESA, false)
    evento(hook, { x: 70, y: 25 }, false)
    evento(hook, PRESA, true) // torna esattamente sulla presa

    expect(punti(hook)).toEqual(gomitiOriginali) // non sostituiti dalla rotta automatica ([])
  })

  it('E. arco con gomiti a mano che si muove e non torna: in cronologia finiscono i gomiti originali intatti', () => {
    const gomitiOriginali: Punto[] = [{ x: 50, y: 50 }]
    const hook = montaArmonia(gomitiOriginali)

    evento(hook, PRESA, false) // primo evento, delta nullo: non deve toccare né alterare lo stato
    evento(hook, { x: 70, y: 25 }, false) // spostamento vero
    evento(hook, { x: 70, y: 25 }, true) // rilascio, non tornato sulla presa

    expect(hook.result.current.puoAnnullare).toBe(true)
    act(() => hook.result.current.annulla())
    expect(punti(hook)).toEqual(gomitiOriginali) // gomiti originali, non una forma già alterata
  })
})
