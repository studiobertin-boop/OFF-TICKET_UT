import { describe, it, expect } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { TARATURA_NEUTRA } from '@/services/schemaImpianto/libreria'
import type { TaraturaSimbolo } from '@/services/schemaImpianto/libreria'
import type { SchemaAncora, SchemaTipoAggancio } from '@/services/schemaImpianto/types'
import {
  spostaAncora,
  aggiungiAncora,
  togliAncora,
  impostaAccetta,
  trasla,
  deforma,
  useTaratura,
} from '../useTaratura'

function conAncora(id: string, x: number, y: number, accetta: SchemaTipoAggancio[] = ['aria']): TaraturaSimbolo {
  const ancora: SchemaAncora = { id, x, y, accetta }
  return { ...TARATURA_NEUTRA, ancore: [ancora] }
}

function conDueAncore(): TaraturaSimbolo {
  return {
    ...TARATURA_NEUTRA,
    ancore: [
      { id: 'sx', x: 0, y: 50, accetta: ['aria'] },
      { id: 'dx', x: 100, y: 50, accetta: ['aria'] },
    ],
  }
}

describe('i gesti della taratura', () => {
  it("l ancora si posa sempre sulla griglia, anche a metà passo", () => {
    const t = spostaAncora(conAncora('sx', 0, 130), 'sx', 33, 147)
    expect(t.ancore[0]).toMatchObject({ x: 30, y: 150 })
  })

  it('la sagoma si trasla libera, senza agganciarsi', () => {
    expect(trasla(TARATURA_NEUTRA, -3, 0)).toMatchObject({ dx: -3, dy: 0 })
  })

  it('la deformazione non tocca le ancore', () => {
    // È il cuore del meccanismo: se la scala muovesse anche le ancore, il gesto di
    // avvicinare il blocco al pallino non servirebbe a niente.
    const t = deforma(conAncora('sx', 30, 130), 1.07, 1)
    expect(t.ancore[0]).toMatchObject({ x: 30, y: 130 })
  })

  it("l ancora nuova nasce sulla griglia e con un id che non collide", () => {
    const t = aggiungiAncora(conAncora('sx', 30, 130), ['aria'], 117, 130)
    expect(t.ancore).toHaveLength(2)
    expect(t.ancore[1].x).toBe(120)
    expect(t.ancore[1].id).not.toBe('sx')
  })

  it("togliere un ancora lascia le altre dove sono", () => {
    const t = togliAncora(conDueAncore(), 'sx')
    expect(t.ancore.map((a) => a.id)).toEqual(['dx'])
  })

  // --- Casi limite e scelte di design non coperte dai test sopra (brief Task 11) ---

  it("l'id dell'ancora nuova prende il lato più vicino, non un contatore sul numero di ancore", () => {
    // Punto sopra il baricentro delle due ancore esistenti (che sta a y=50): il lato più
    // vicino è 'alto', non un terzo id derivato dal conteggio (che darebbe qualcosa come
    // 'ancora-3', il tipo di id casuale che il brief vieta esplicitamente).
    const t = aggiungiAncora(conDueAncore(), ['aria'], 50, 0)
    expect(t.ancore[2].id).toBe('alto-2')
  })

  it('togliere l’ultima ancora rimasta è un esito legittimo: la sagoma resta senza punti di attacco', () => {
    const t = togliAncora(conAncora('sx', 30, 130), 'sx')
    expect(t.ancore).toEqual([])
  })

  it("aggiungere un'ancora che non accetta nulla non solleva eccezioni: la funzione non giudica, non decide per l'editor", () => {
    const t = aggiungiAncora(TARATURA_NEUTRA, [], 10, 10)
    expect(t.ancore[0].accetta).toEqual([])
  })

  it("impostaAccetta cambia cosa un'ancora accetta mantenendone l'id, senza toccare le altre", () => {
    const t = impostaAccetta(conDueAncore(), 'sx', ['condensa'])
    expect(t.ancore).toEqual([
      { id: 'sx', x: 0, y: 50, accetta: ['condensa'] },
      { id: 'dx', x: 100, y: 50, accetta: ['aria'] },
    ])
  })

  it('impostaAccetta su un id inesistente non tocca nulla', () => {
    const partenza = conDueAncore()
    expect(impostaAccetta(partenza, 'assente', ['condensa'])).toEqual(partenza)
  })

  it('due deforma in sequenza compongono per prodotto, non per somma o sostituzione', () => {
    const unaVolta = deforma(TARATURA_NEUTRA, 1.5, 2)
    const dueVolte = deforma(unaVolta, 2, 1)
    expect(dueVolte).toMatchObject({ sx: 3, sy: 2 })
  })
})

describe('useTaratura', () => {
  it('applica un gesto discreto e lo annulla', () => {
    const { result } = renderHook(() => useTaratura(conAncora('sx', 30, 130)))

    act(() => result.current.togliAncora('sx'))
    expect(result.current.taratura.ancore).toEqual([])
    expect(result.current.puoAnnullare).toBe(true)

    act(() => result.current.annulla())
    expect(result.current.taratura.ancore).toHaveLength(1)
    expect(result.current.puoAnnullare).toBe(false)
  })

  it('la cronologia della taratura è sua: non condivide stato con un\'altra istanza dell\'hook', () => {
    // Simula editor e taratura come due hook indipendenti (due chiamate separate, come
    // sarebbero due componenti montati insieme): annullare l'uno non deve toccare l'altro.
    const { result: editor } = renderHook(() => useTaratura(conAncora('sx', 0, 0)))
    const { result: taratura } = renderHook(() => useTaratura(conAncora('dx', 100, 0)))

    act(() => editor.current.trasla(10, 0, true))
    act(() => taratura.current.trasla(20, 0, true))

    act(() => taratura.current.annulla())

    expect(editor.current.taratura.dx).toBe(10)
    expect(taratura.current.taratura.dx).toBe(0)
  })

  it('un trascinamento (concluso=false ripetuto, poi true) entra in cronologia come un solo passo', () => {
    const { result } = renderHook(() => useTaratura(conAncora('sx', 0, 0)))

    act(() => {
      result.current.trasla(5, 0, false)
      result.current.trasla(5, 0, false)
      result.current.trasla(5, 0, true)
    })

    expect(result.current.taratura.dx).toBe(15)

    // Un solo `annulla` torna allo stato di partenza: se ogni evento fosse entrato in
    // cronologia per conto suo, ne servirebbero tre.
    act(() => result.current.annulla())
    expect(result.current.taratura.dx).toBe(0)
    expect(result.current.puoAnnullare).toBe(false)
  })

  it('due trascinamenti separati restano due passi distinti', () => {
    const { result } = renderHook(() => useTaratura(conAncora('sx', 0, 0)))

    act(() => result.current.trasla(5, 0, true))
    act(() => result.current.trasla(5, 0, true))

    expect(result.current.taratura.dx).toBe(10)

    act(() => result.current.annulla())
    expect(result.current.taratura.dx).toBe(5)

    act(() => result.current.annulla())
    expect(result.current.taratura.dx).toBe(0)
  })
})
