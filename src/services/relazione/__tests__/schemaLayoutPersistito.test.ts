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
