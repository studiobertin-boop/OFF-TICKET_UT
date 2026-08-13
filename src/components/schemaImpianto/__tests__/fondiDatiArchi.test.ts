import { describe, it, expect, vi } from 'vitest'
import type { Edge } from '@xyflow/react'
import type { QuoteInstradamento } from '@/services/schemaImpianto/tratti'
import { fondiDatiArchi } from '../conversioneFlow'
import type { SchemaEdgeData } from '../SchemaEdgeTubazione'

const QUOTE: QuoteInstradamento = { yCollettore: 120, yCorsiaCondense: 340 }

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
    const fusi = fondiDatiArchi(conGomiti, conSegni, conTrascinamento, QUOTE)

    expect(fusi).toHaveLength(2)
    for (const arco of fusi) {
      expect((arco.data as SchemaEdgeData).quote).toEqual(QUOTE)
    }
  })

  it('i callback dei tre hook sopravvivono alla fusione', () => {
    const { conGomiti, conSegni, conTrascinamento, onSpostaGomito, onSpostaSegno, onTrascinaTratto } =
      treElenchi()
    const fusi = fondiDatiArchi(conGomiti, conSegni, conTrascinamento, QUOTE)

    for (const arco of fusi) {
      const data = arco.data as SchemaEdgeData
      expect(data.onSpostaGomito).toBe(onSpostaGomito)
      expect(data.onSpostaSegno).toBe(onSpostaSegno)
      expect(data.onTrascinaTratto).toBe(onTrascinaTratto)
    }
  })
})
