import { describe, it, expect, vi } from 'vitest'
import type { Edge } from '@xyflow/react'
import type { QuoteInstradamento } from '@/services/schemaImpianto/tratti'
import { fondiDatiArchi, type CapiArco } from '../conversioneFlow'
import type { SchemaEdgeData } from '../SchemaEdgeTubazione'

const QUOTE: QuoteInstradamento = { yCollettore: 120, yCorsiaCondense: 340 }

/** I capi come `capiDegliArchi` li produce dalle ancore, uno per arco. */
const CAPI = new Map<string, CapiArco>([
  ['a1', { da: { x: 100, y: 200 }, a: { x: 400, y: 260 } }],
  ['a2', { da: { x: 400, y: 260 }, a: { x: 700, y: 300 } }],
])

/**
 * I tre elenchi come li producono useGomiti, useSegniTubo e useTrascinamentoTratto: stesso
 * id e capi per ogni indice, dati aggiuntivi diversi — è la forma reale che SchemaEditor passa
 * a `fondiDatiArchi`.
 */
function treElenchi() {
  const onSpostaGomito = vi.fn()
  const onSpostaSegno = vi.fn()
  const onTrascinaTratto = vi.fn()
  const basi: Edge[] = [
    { id: 'a1', source: 'S1', target: 'F1', data: { stile: 'standard', punti: [] } },
    { id: 'a2', source: 'F1', target: 'E1', data: { stile: 'flessibile', punti: [] } },
  ]
  const conGomiti: Edge[] = basi.map((e) => ({ ...e, data: { ...e.data, onSpostaGomito } }))
  const conSegni: Edge[] = basi.map((e) => ({ ...e, data: { ...e.data, onSpostaSegno } }))
  const conTrascinamento: Edge[] = basi.map((e) => ({ ...e, data: { ...e.data, onTrascinaTratto } }))
  return { conGomiti, conSegni, conTrascinamento, onSpostaGomito, onSpostaSegno, onTrascinaTratto }
}

describe('fondiDatiArchi', () => {
  // L'invariante che protegge dal ripiego di `polilineaDellArco`: se un arco esce da qui
  // senza `quote`, quella funzione ripiega silenziosamente sul raccordo semplice e il
  // difetto (rotte diverse fra tela e documento) torna senza che nulla protesti.
  it('ogni arco fuso porta le quote di instradamento', () => {
    const { conGomiti, conSegni, conTrascinamento } = treElenchi()
    const fusi = fondiDatiArchi(conGomiti, conSegni, conTrascinamento, QUOTE, CAPI, null)

    expect(fusi).toHaveLength(2)
    for (const arco of fusi) {
      expect((arco.data as SchemaEdgeData).quote).toEqual(QUOTE)
    }
  })

  // Stessa invariante, sull'altro dato che un arco non può ricavarsi da solo: se esce da qui
  // senza `capi`, `capiDellArco` ripiega sulle coordinate degli handle di react-flow — il bordo
  // dell'handle invece del centro dell'ancora — e la tela torna a disegnare 5 unità più in là
  // del documento. Che quei capi siano davvero le ancore lo prova
  // `instradamentoCondiviso.test.ts`, che li confronta con `posizioneAncora` su un layout vero.
  it('ogni arco fuso porta i propri capi', () => {
    const { conGomiti, conSegni, conTrascinamento } = treElenchi()
    const fusi = fondiDatiArchi(conGomiti, conSegni, conTrascinamento, QUOTE, CAPI, null)

    expect(fusi).toHaveLength(2)
    for (const arco of fusi) {
      expect((arco.data as SchemaEdgeData).capi, `arco ${arco.id}`).toEqual(CAPI.get(arco.id))
    }
  })

  it('i callback dei tre hook sopravvivono alla fusione', () => {
    const { conGomiti, conSegni, conTrascinamento, onSpostaGomito, onSpostaSegno, onTrascinaTratto } =
      treElenchi()
    const fusi = fondiDatiArchi(conGomiti, conSegni, conTrascinamento, QUOTE, CAPI, null)

    for (const arco of fusi) {
      const data = arco.data as SchemaEdgeData
      expect(data.onSpostaGomito).toBe(onSpostaGomito)
      expect(data.onSpostaSegno).toBe(onSpostaSegno)
      expect(data.onTrascinaTratto).toBe(onTrascinaTratto)
    }
  })

  it('marca come evidenziato solo l’arco sorvolato dal TEE', () => {
    const { conGomiti, conSegni, conTrascinamento } = treElenchi()
    const fusi = fondiDatiArchi(conGomiti, conSegni, conTrascinamento, QUOTE, CAPI, 'a2')
    expect(fusi.map((e) => (e.data as SchemaEdgeData).evidenziato)).toEqual([false, true])
  })

  it('senza TEE sorvolante nessun arco è evidenziato', () => {
    const { conGomiti, conSegni, conTrascinamento } = treElenchi()
    const fusi = fondiDatiArchi(conGomiti, conSegni, conTrascinamento, QUOTE, CAPI, null)
    expect(fusi.every((e) => (e.data as SchemaEdgeData).evidenziato === false)).toBe(true)
  })
})
