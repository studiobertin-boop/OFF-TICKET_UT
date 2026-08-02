import { describe, expect, it } from 'vitest'
import { buildFindingKey, buildPayloadHash, stableHash } from '../findingKey'
import { fadMonotono } from '../rules/fadMonotono'
import { CSDX_165, input } from './fixtures'

/**
 * Le invarianti dell'identità delle segnalazioni. Se cadono, un'archiviazione
 * smette di reggere e le stesse segnalazioni tornano a ogni esecuzione — o, peggio,
 * un problema nuovo resta nascosto sotto un'archiviazione vecchia.
 */

describe('stableHash', () => {
  it('è deterministico', () => {
    expect(stableHash('KAESER/CSDX 165')).toBe(stableHash('KAESER/CSDX 165'))
  })

  it('distingue input diversi', () => {
    expect(stableHash('a')).not.toBe(stableHash('b'))
  })
})

describe('buildFindingKey', () => {
  it('non dipende dall’ordine in cui il motore incontra le righe', () => {
    expect(buildFindingKey('DUPLICATO', ['b', 'a'])).toBe(buildFindingKey('DUPLICATO', ['a', 'b']))
  })

  it('distingue le regole a parità di entità', () => {
    expect(buildFindingKey('DUPLICATO', ['x'])).not.toBe(buildFindingKey('SPECS_LEGACY', ['x']))
  })

  it('ignora le parti vuote, così una variante senza pressione resta stabile', () => {
    expect(buildFindingKey('SPECS_LEGACY', ['x', ''])).toBe(buildFindingKey('SPECS_LEGACY', ['x']))
  })
})

describe('buildPayloadHash', () => {
  it('non dipende dall’ordine delle chiavi di un oggetto', () => {
    expect(buildPayloadHash({ a: 1, b: 2 })).toBe(buildPayloadHash({ b: 2, a: 1 }))
  })

  it('cambia se cambia anche un solo valore', () => {
    expect(buildPayloadHash([10, 1353])).not.toBe(buildPayloadHash([10, 13530]))
  })
})

describe('identità delle segnalazioni prodotte dalle regole', () => {
  it('non contiene identificativi di riga: sopravvive a fusioni e ricreazioni', () => {
    const catalog = CSDX_165()
    const primo = fadMonotono(input(catalog))[0]

    // Le stesse apparecchiature, reinserite: gli id cambiano, l'identità no.
    const ricreato = CSDX_165()
    const secondo = fadMonotono(input(ricreato))[0]

    expect(catalog[0].id).not.toBe(ricreato[0].id)
    expect(secondo.key).toBe(primo.key)
    expect(secondo.key).not.toContain(catalog[0].id)
  })

  it('non cambia se cambia una riga estranea', () => {
    const conAltro = [...CSDX_165(), ...CSDX_165().map(r => ({ ...r, marca: 'ALTRA MARCA' }))]
    const soloNostra = fadMonotono(input(conAltro)).find(f => f.title.includes('KAESER'))!
    expect(soloNostra.key).toBe(fadMonotono(input(CSDX_165()))[0].key)
  })

  it('il payload cambia quando i valori coinvolti cambiano: l’archiviazione decade', () => {
    const primo = fadMonotono(input(CSDX_165()))[0]

    const corretto = CSDX_165()
    corretto[0].specs = { volume: '13530', pressione: '10' }
    const dopo = fadMonotono(input(corretto))

    // Corretto il dato, la segnalazione sparisce del tutto.
    expect(dopo).toEqual([])

    // Ma con un valore diverso e ancora incoerente, la chiave regge e il payload cambia.
    const altroErrore = CSDX_165()
    altroErrore[0].specs = { volume: '1400', pressione: '10' }
    const secondo = fadMonotono(input(altroErrore))[0]
    expect(secondo.key).toBe(primo.key)
    expect(secondo.payloadHash).not.toBe(primo.payloadHash)
  })
})
