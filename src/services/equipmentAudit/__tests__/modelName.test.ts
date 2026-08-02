import { describe, expect, it } from 'vitest'
import { normalizeKey, parseModello, parseSerie } from '../modelName'

describe('parseModello', () => {
  it('estrae la pressione nella forma «@Nbar»', () => {
    const p = parseModello('GA 18 (@10bar)')
    expect(p.base).toBe('GA 18')
    expect(p.pattern).toBe('at')
    expect(p.pressioneEsercizio).toBe(10)
  })

  it('riconosce la forma «maxNbar»', () => {
    const p = parseModello('CSD 125 (max15bar)')
    expect(p.base).toBe('CSD 125')
    expect(p.pattern).toBe('max')
    expect(p.pressioneEsercizio).toBe(15)
  })

  it('accetta la virgola come separatore decimale', () => {
    expect(parseModello('TA15 (@10,80bar)').pressioneEsercizio).toBe(10.8)
    expect(parseModello('ASD 32 (@7,5bar)').pressioneEsercizio).toBe(7.5)
  })

  it('accetta il punto come separatore decimale', () => {
    expect(parseModello('ASK 34 T SFC (11.5-15bar)').pressioneEsercizio).toBe(15)
  })

  it('per un intervallo prende l’estremo superiore, a cui è dichiarata la portata', () => {
    const p = parseModello('SK 25 SFC (8,5-11bar)')
    expect(p.base).toBe('SK 25 SFC')
    expect(p.pattern).toBe('range')
    expect(p.rangeMin).toBe(8.5)
    expect(p.rangeMax).toBe(11)
    expect(p.pressioneEsercizio).toBe(11)
  })

  it('tollera lo spazio prima dell’unità', () => {
    expect(parseModello('CSC 100 (@13 bar)').pressioneEsercizio).toBe(13)
  })

  it('conserva ciò che segue la parentesi', () => {
    expect(parseModello('CSA 20 (@10bar)+TANK270').base).toBe('CSA 20+TANK270')
    expect(parseModello('CSA 15 (@8bar) IVR+TANK500').base).toBe('CSA 15 IVR+TANK500')
  })

  it('conserva le sigle presenti nella stessa parentesi', () => {
    const p = parseModello('810sGK (DN10 @14bar)')
    expect(p.base).toBe('810sGK (DN10)')
    expect(p.pressioneEsercizio).toBe(14)
  })

  it('regge la parentesi non chiusa presente nei dati', () => {
    const p = parseModello('H15N (@10bar')
    expect(p.base).toBe('H15N')
    expect(p.pressioneEsercizio).toBe(10)
  })

  it('lascia intatto un nome senza pressione', () => {
    const p = parseModello('AMD 130')
    expect(p.base).toBe('AMD 130')
    expect(p.pattern).toBe('plain')
    expect(p.pressioneEsercizio).toBeNull()
  })

  it('è idempotente: rianalizzare il nome ripulito non trova più pressioni', () => {
    for (const nome of [
      'GA 18 (@10bar)',
      'CSD 125 (max15bar)',
      'SK 25 SFC (8,5-11bar)',
      'CSA 20 (@10bar)+TANK270',
      '810sGK (DN10 @14bar)',
    ]) {
      const primo = parseModello(nome)
      const secondo = parseModello(primo.base)
      expect(secondo.pattern, nome).toBe('plain')
      expect(secondo.base, nome).toBe(primo.base)
    }
  })
})

describe('parseSerie', () => {
  it('separa famiglia, taglia e suffisso', () => {
    expect(parseSerie('AIRCENTER 12 SFC')).toEqual({
      famiglia: 'AIRCENTER',
      numero: 12,
      suffisso: 'SFC',
    })
  })

  it('regge il nome senza spazio fra sigla e numero', () => {
    expect(parseSerie('TA15')).toEqual({ famiglia: 'TA', numero: 15, suffisso: '' })
  })

  it('accetta la taglia decimale', () => {
    expect(parseSerie('CSA 7,5').numero).toBe(7.5)
  })

  it('rinuncia quando il nome non comincia per lettera', () => {
    expect(parseSerie('810sGK (DN10)').numero).toBeNull()
  })
})

describe('normalizeKey', () => {
  it('ignora maiuscole, spazi e punteggiatura', () => {
    expect(normalizeKey('CECCATO ARIA COMPRESSA S.R.L.')).toBe(
      normalizeKey('ceccato aria compressa srl')
    )
  })

  it('regge valori assenti', () => {
    expect(normalizeKey(null)).toBe('')
    expect(normalizeKey(undefined)).toBe('')
  })
})
