import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { SchemaGomito } from '../SchemaEdgeTubazione'

/**
 * Unica eccezione in questo modulo a "niente test di interfaccia" (CLAUDE.md): il difetto che
 * questo file collauda vive esattamente nel confine fra `SchemaGomito` e l'API impura di
 * react-flow — quali opzioni passa a `screenToFlowPosition` — e non è osservabile richiamando
 * una funzione pura, perché la funzione pura (`agganciaPosizioneGomito`, useGomiti.ts) riceve
 * già il valore corrotto quando il cablaggio è sbagliato. Non si monta `SchemaEditor` né
 * `SchemaEdgeTubazione` per intero: solo `SchemaGomito`, con `useReactFlow` sostituito da un
 * mock che si comporta esattamente come la vera `screenToFlowPosition`.
 *
 * jsdom non implementa la Pointer Capture API (setPointerCapture/hasPointerCapture/
 * releasePointerCapture), che `useGestoPuntatore.ts` usa per tenere valido il gesto anche se il
 * cursore esce dalla maniglia. Stub minimi, solo per questo file — stesso schema del polyfill di
 * `Blob.arrayBuffer` in `tests/setup.ts`.
 */
beforeAll(() => {
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()
  Element.prototype.hasPointerCapture = vi.fn(() => true)
})

/**
 * Riproduce la differenza reale, non tutta `screenToFlowPosition`: verificato in
 * `node_modules/@xyflow/system/dist/esm/index.js:646-651` (`pointToRendererPoint` applica
 * `snapPosition` solo se `snapToGrid` è vero) e `node_modules/@xyflow/react/dist/esm/index.js:549-561`
 * (`screenToFlowPosition` legge `snapToGrid`/`snapGrid` dal negozio quando il chiamante non
 * passa opzioni). La tela monta `snapToGrid snapGrid={[10, 10]}` (`SchemaEditor.tsx:843-844`):
 * una chiamata senza opzioni restituisce quindi SEMPRE un multiplo di 10. Il mock: con
 * `{ snapToGrid: false }` dà la posizione grezza (232), altrimenti quella che la griglia della
 * tela produrrebbe per lo stesso clic (230, il multiplo di 10 più vicino).
 */
const screenToFlowPosition = vi.fn((_client: { x: number; y: number }, opzioni?: { snapToGrid?: boolean }) =>
  opzioni?.snapToGrid === false ? { x: 232, y: 50 } : { x: 230, y: 50 }
)

vi.mock('@xyflow/react', () => ({
  useReactFlow: () => ({ screenToFlowPosition }),
}))

describe('SchemaGomito — il cablaggio deve chiedere la posizione grezza', () => {
  it('il trascinamento consegna a onSposta la posizione NON agganciata alla griglia della tela', () => {
    const onSposta = vi.fn()
    const { container } = render(
      <SchemaGomito
        indice={0}
        punto={{ x: 230, y: 50 }}
        pDa={{ x: 260, y: 1000 }}
        pA={{ x: 234, y: 2000 }}
        onSposta={onSposta}
        onRimuovi={vi.fn()}
      />
    )
    const maniglia = container.firstElementChild as Element

    fireEvent.pointerDown(maniglia, { pointerId: 1 })
    fireEvent.pointerMove(maniglia, { pointerId: 1, clientX: 232, clientY: 50 })

    expect(onSposta).toHaveBeenCalledTimes(1)
    const [, , , posizione] = onSposta.mock.calls[0]
    // Se SchemaGomito chiamasse screenToFlowPosition senza `{ snapToGrid: false }` (il difetto
    // di adesso), il mock restituirebbe 230 — un multiplo di 10 su cui, per costruzione di
    // agganciaQuota, nessuna quota di un capo fuori griglia può mai vincere.
    expect(posizione.x).toBe(232)
  })
})
