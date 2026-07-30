import { describe, test, expect } from 'vitest'
import {
  parseCode, compareCodes, nextFreeCode, childCode, collectCodes, normalizeSchedaCodes,
} from '@/utils/equipmentCodes'

describe('parseCode', () => {
  test('riconosce i codici principali', () => {
    expect(parseCode('S1')).toEqual({ prefix: 'S', num: 1 })
    expect(parseCode('SEP12')).toEqual({ prefix: 'SEP', num: 12 })
  })

  test('riconosce i codici dei figli', () => {
    expect(parseCode('C1.1')).toEqual({ prefix: 'C', num: 1, sub: 1 })
  })

  test('rifiuta i valori non validi', () => {
    expect(parseCode(null)).toBeNull()
    expect(parseCode(undefined)).toBeNull()
    expect(parseCode('')).toBeNull()
    expect(parseCode('undefined.1')).toBeNull()
    expect(parseCode('s1')).toBeNull()
    expect(parseCode('S')).toBeNull()
    expect(parseCode(3)).toBeNull()
  })
})

describe('compareCodes', () => {
  test('ordina numericamente, non alfabeticamente', () => {
    expect(['S10', 'S2', 'S1'].sort(compareCodes)).toEqual(['S1', 'S2', 'S10'])
  })

  test('mette il figlio dopo il padre', () => {
    expect(['C1.1', 'C1'].sort(compareCodes)).toEqual(['C1', 'C1.1'])
  })

  test('raggruppa per prefisso', () => {
    expect(['S1', 'C1'].sort(compareCodes)).toEqual(['C1', 'S1'])
  })

  test('manda in fondo i codici non validi', () => {
    expect(['S2', null, 'S1'].sort(compareCodes)).toEqual(['S1', 'S2', null])
  })
})

describe('nextFreeCode', () => {
  test('riempie il buco più basso', () => {
    expect(nextFreeCode('S', ['S1', 'S3'], 7)).toBe('S2')
  })

  test('parte da 1 su insieme vuoto', () => {
    expect(nextFreeCode('S', [], 7)).toBe('S1')
  })

  test('accoda quando non ci sono buchi', () => {
    expect(nextFreeCode('S', ['S1', 'S2'], 7)).toBe('S3')
  })

  test('ritorna null quando il tipo è saturo', () => {
    expect(nextFreeCode('SEP', ['SEP1', 'SEP2', 'SEP3'], 3)).toBeNull()
  })

  test('ignora i codici di altro prefisso', () => {
    expect(nextFreeCode('S', ['C1', 'C2'], 7)).toBe('S1')
  })

  test('ignora i codici dei figli: C1.1 non riserva il numero 1', () => {
    expect(nextFreeCode('C', ['C1.1'], 5)).toBe('C1')
  })

  test('tollera i valori non validi nella lista', () => {
    expect(nextFreeCode('S', [null, undefined, '', 'S1'], 7)).toBe('S2')
  })
})

describe('childCode', () => {
  test('deriva il codice del figlio dal padre', () => {
    expect(childCode('C3')).toBe('C3.1')
    expect(childCode('S1', 2)).toBe('S1.2')
  })
})

describe('collectCodes', () => {
  test('raccoglie i codici validi di tutti gli array', () => {
    const codes = collectCodes({
      serbatoi: [{ codice: 'S1' }],
      compressori: [{ codice: 'C1' }],
      disoleatori: [{ codice: 'C1.1' }],
      filtri: [{ codice: null }],
    })
    expect(codes).toEqual(new Set(['S1', 'C1', 'C1.1']))
  })

  test('tollera scheda vuota o array assenti', () => {
    expect(collectCodes({})).toEqual(new Set())
    expect(collectCodes(null)).toEqual(new Set())
  })
})

describe('normalizeSchedaCodes', () => {
  test('assegna i codici mancanti in ordine di array', () => {
    const { scheda, changed } = normalizeSchedaCodes({
      compressori: [{ marca: 'a' }, { marca: 'b' }],
    })
    expect(changed).toBe(true)
    expect(scheda.compressori.map((c: any) => c.codice)).toEqual(['C1', 'C2'])
  })

  test('non rinumera: i buchi restano buchi', () => {
    const { scheda, changed } = normalizeSchedaCodes({
      serbatoi: [{ codice: 'S1' }, { codice: 'S3' }],
    })
    expect(changed).toBe(false)
    expect(scheda.serbatoi.map((s: any) => s.codice)).toEqual(['S1', 'S3'])
  })

  test('assegna al record privo di codice il numero libero più basso', () => {
    const { scheda } = normalizeSchedaCodes({
      serbatoi: [{ codice: 'S1' }, { codice: 'S3' }, {}],
    })
    expect(scheda.serbatoi.map((s: any) => s.codice)).toEqual(['S1', 'S3', 'S2'])
  })

  test('risolve i duplicati conservando il primo', () => {
    const { scheda, changed } = normalizeSchedaCodes({
      serbatoi: [{ codice: 'S1', marca: 'primo' }, { codice: 'S1', marca: 'secondo' }],
    })
    expect(changed).toBe(true)
    expect(scheda.serbatoi[0]).toEqual({ codice: 'S1', marca: 'primo' })
    expect(scheda.serbatoi[1]).toEqual({ codice: 'S2', marca: 'secondo' })
  })

  test('riassegna i codici di prefisso sbagliato', () => {
    const { scheda } = normalizeSchedaCodes({ serbatoi: [{ codice: 'X9' }] })
    expect(scheda.serbatoi[0].codice).toBe('S1')
  })

  test('riassegna i codici fuori dal massimo del tipo', () => {
    const { scheda } = normalizeSchedaCodes({ separatori: [{ codice: 'SEP9' }] })
    expect(scheda.separatori[0].codice).toBe('SEP1')
  })

  test('lascia intatto il record quando il tipo è saturo', () => {
    const { scheda } = normalizeSchedaCodes({
      separatori: [{ codice: 'SEP1' }, { codice: 'SEP2' }, { codice: 'SEP3' }, { marca: 'quarto' }],
    })
    expect(scheda.separatori[3]).toEqual({ marca: 'quarto' })
  })

  test('deriva il codice del figlio dal riferimento al padre', () => {
    const { scheda, changed } = normalizeSchedaCodes({
      compressori: [{ codice: 'C1' }, { codice: 'C2' }, { codice: 'C3' }],
      disoleatori: [{ codice: 'undefined.1', compressore_associato: 'C3' }],
    })
    expect(changed).toBe(true)
    expect(scheda.disoleatori[0].codice).toBe('C3.1')
  })

  test('lascia intatto il figlio senza riferimento valido', () => {
    const { scheda, changed } = normalizeSchedaCodes({
      disoleatori: [{ codice: 'undefined.1', compressore_associato: null }],
    })
    expect(changed).toBe(false)
    expect(scheda.disoleatori[0].codice).toBe('undefined.1')
  })

  test('deriva anche i codici di scambiatori e recipienti', () => {
    const { scheda } = normalizeSchedaCodes({
      scambiatori: [{ essiccatore_associato: 'E2' }],
      recipienti_filtro: [{ filtro_associato: 'F1' }],
    })
    expect(scheda.scambiatori[0].codice).toBe('E2.1')
    expect(scheda.recipienti_filtro[0].codice).toBe('F1.1')
  })

  test('riferimento di prefisso sbagliato lascia il record intatto', () => {
    const { scheda, changed } = normalizeSchedaCodes({
      disoleatori: [{ codice: 'S9.1', compressore_associato: 'S9' }],
    })
    expect(changed).toBe(false)
    expect(scheda.disoleatori[0].codice).toBe('S9.1')
  })

  test('riferimento fuori dal massimo del tipo lascia il record intatto', () => {
    const { scheda, changed } = normalizeSchedaCodes({
      disoleatori: [{ codice: 'C99.1', compressore_associato: 'C99' }],
    })
    expect(changed).toBe(false)
    expect(scheda.disoleatori[0].codice).toBe('C99.1')
  })

  test('due figli sullo stesso padre non ricevono lo stesso codice', () => {
    const { scheda, changed } = normalizeSchedaCodes({
      compressori: [{ codice: 'C1' }],
      disoleatori: [{ compressore_associato: 'C1' }, { compressore_associato: 'C1' }],
    })
    expect(changed).toBe(true)
    expect(scheda.disoleatori[0].codice).toBe('C1.1')
    expect(scheda.disoleatori[1].codice).toBeUndefined()
  })

  test('il figlio che ha già il codice corretto ha la precedenza sull\'ordine di array', () => {
    const { scheda, changed } = normalizeSchedaCodes({
      compressori: [{ codice: 'C1' }],
      disoleatori: [{ compressore_associato: 'C1' }, { codice: 'C1.1', compressore_associato: 'C1' }],
    })
    expect(changed).toBe(false)
    expect(scheda.disoleatori[0].codice).toBeUndefined()
    expect(scheda.disoleatori[1].codice).toBe('C1.1')
  })

  test('idempotenza con due figli sullo stesso padre', () => {
    const first = normalizeSchedaCodes({
      compressori: [{ codice: 'C1' }],
      disoleatori: [{ compressore_associato: 'C1' }, { compressore_associato: 'C1' }],
    })
    const second = normalizeSchedaCodes(first.scheda)
    expect(second.changed).toBe(false)
    expect(second.scheda).toEqual(first.scheda)
  })

  test('è idempotente', () => {
    const first = normalizeSchedaCodes({
      compressori: [{ marca: 'a' }, { marca: 'b' }],
      disoleatori: [{ compressore_associato: 'C2' }],
    })
    const second = normalizeSchedaCodes(first.scheda)
    expect(second.changed).toBe(false)
    expect(second.scheda).toEqual(first.scheda)
  })

  test('non modifica la scheda in ingresso', () => {
    const input = { compressori: [{ marca: 'a' }] }
    normalizeSchedaCodes(input)
    expect(input.compressori[0]).toEqual({ marca: 'a' })
  })

  test('conserva i campi non gestiti', () => {
    const { scheda } = normalizeSchedaCodes({
      stato: 'bozza',
      dati_generali: { cliente: 'ACME' },
      serbatoi: [{ marca: 'a' }],
    })
    expect(scheda.stato).toBe('bozza')
    expect(scheda.dati_generali).toEqual({ cliente: 'ACME' })
  })
})
