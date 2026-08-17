import { describe, it, expect } from 'vitest'
import { additionalInfoSchema } from '../schema'

describe('schemaLayout in additional_info', () => {
  it('accetta un layout salvato e lo conserva', () => {
    const layout = { versione: 1, nodi: [{ id: 'C1', tipo: 'compressore', x: 40, y: 220 }], archi: [] }
    const esito = additionalInfoSchema.parse({ descrizioneAttivita: 'prova', schemaLayout: layout })
    expect(esito.schemaLayout).toEqual(layout)
  })

  it('resta valido quando il layout non c’è', () => {
    const esito = additionalInfoSchema.parse({ descrizioneAttivita: 'prova' })
    expect(esito.schemaLayout).toBeUndefined()
  })
})

describe('schemaPreferenze in additional_info', () => {
  // Zod scarta le chiavi che `additionalInfoSchema` non dichiara, e `handleGenera` salva
  // `parsed.data`: un campo non dichiarato sparirebbe alla prima relazione generata. Questo test
  // è la sola guardia contro una perdita silenziosa di lavoro dell'operatore.
  it('conserva le preferenze attraverso il parse', () => {
    const preferenze = {
      ordineStadi: ['F1', 'E1', 'F2'],
      condense: { S1: true, F2: false },
      bypass: [{ id: 'bp1', stadi: ['E1', 'F2'] }],
    }
    const esito = additionalInfoSchema.parse({ descrizioneAttivita: 'prova', schemaPreferenze: preferenze })
    expect(esito.schemaPreferenze).toEqual(preferenze)
  })

  it('resta valido quando le preferenze non ci sono', () => {
    const esito = additionalInfoSchema.parse({ descrizioneAttivita: 'prova' })
    expect(esito.schemaPreferenze).toBeUndefined()
  })
})
