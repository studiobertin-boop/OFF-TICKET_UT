import { describe, it, expect } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { PROFONDITA_CRONOLOGIA, useSchemaHistory } from '../useSchemaHistory'

describe('useSchemaHistory', () => {
  it('annulla l’ultima modifica applicata', () => {
    const { result } = renderHook(() => useSchemaHistory({ n: 0 }))

    act(() => result.current.applica({ n: 1 }))
    expect(result.current.stato).toEqual({ n: 1 })

    act(() => result.current.annulla())
    expect(result.current.stato).toEqual({ n: 0 })
  })

  it('non offre di annullare finché non c’è stata una modifica', () => {
    const { result } = renderHook(() => useSchemaHistory({ n: 0 }))
    expect(result.current.puoAnnullare).toBe(false)

    act(() => result.current.applica({ n: 1 }))
    expect(result.current.puoAnnullare).toBe(true)
  })

  it('annullare oltre il primo stato non rompe nulla', () => {
    const { result } = renderHook(() => useSchemaHistory({ n: 0 }))

    act(() => result.current.annulla())
    act(() => result.current.annulla())

    expect(result.current.stato).toEqual({ n: 0 })
    expect(result.current.puoAnnullare).toBe(false)
  })

  it(`conserva al massimo ${PROFONDITA_CRONOLOGIA} stati, scartando i più vecchi`, () => {
    const { result } = renderHook(() => useSchemaHistory({ n: 0 }))

    for (let i = 1; i <= PROFONDITA_CRONOLOGIA + 5; i++) {
      act(() => result.current.applica({ n: i }))
    }

    for (let i = 0; i < PROFONDITA_CRONOLOGIA; i++) {
      act(() => result.current.annulla())
    }

    // Risalendo di 10 passi dallo stato 15 si arriva al 5: gli stati 0-4 sono usciti dallo stack.
    expect(result.current.stato).toEqual({ n: PROFONDITA_CRONOLOGIA + 5 - PROFONDITA_CRONOLOGIA })
    expect(result.current.puoAnnullare).toBe(false)
  })

  it('accetta un aggiornamento calcolato dallo stato corrente', () => {
    const { result } = renderHook(() => useSchemaHistory({ n: 2 }))

    act(() => result.current.applica((c) => ({ n: c.n * 5 })))
    expect(result.current.stato).toEqual({ n: 10 })

    act(() => result.current.annulla())
    expect(result.current.stato).toEqual({ n: 2 })
  })

  it('non registra in cronologia gli aggiornamenti transitori del trascinamento', () => {
    const { result } = renderHook(() => useSchemaHistory({ n: 0 }))

    act(() => result.current.aggiornaSenzaCronologia({ n: 7 }))

    expect(result.current.stato).toEqual({ n: 7 })
    expect(result.current.puoAnnullare).toBe(false)
  })

  it('azzera la cronologia quando si riparte da uno stato nuovo', () => {
    const { result } = renderHook(() => useSchemaHistory({ n: 0 }))

    act(() => result.current.applica({ n: 1 }))
    act(() => result.current.reimposta({ n: 99 }))

    expect(result.current.stato).toEqual({ n: 99 })
    expect(result.current.puoAnnullare).toBe(false)
  })
})
