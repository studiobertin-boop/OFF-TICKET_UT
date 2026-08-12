import { describe, expect, it } from 'vitest'
import {
  canonicalFromForm,
  missingCanonicalSpecs,
  normalizeSpecs,
  parseNumeric,
  readSpec,
  readSheetPressure,
  readVariantValue,
  sheetPressureKey,
  variantSpecKey,
  variantSpecKeys,
} from '../specsNormalization'

describe('parseNumeric', () => {
  it('converte le stringhe lasciate dall’import', () => {
    expect(parseNumeric('653')).toBe(653)
    expect(parseNumeric('10,5')).toBe(10.5)
    expect(parseNumeric('8.5')).toBe(8.5)
  })

  it('tollera l’unità di misura in coda', () => {
    expect(parseNumeric('11 bar')).toBe(11)
    expect(parseNumeric('500 l')).toBe(500)
  })

  it('rifiuta ciò che non è un numero singolo', () => {
    // Un intervallo di temperatura non deve diventare il suo estremo inferiore.
    expect(parseNumeric('-10 ÷ +200')).toBeNull()
    // Nel catalogo alcune portate sono registrate come «maggiore di».
    expect(parseNumeric('>8097')).toBeNull()
    expect(parseNumeric('')).toBeNull()
    expect(parseNumeric(null)).toBeNull()
  })
})

describe('normalizeSpecs', () => {
  it('traduce le chiavi generiche secondo il tipo — serbatoio', () => {
    const r = normalizeSpecs('Serbatoi', { volume: '500', pressione: '11', temperatura: '120' })
    expect(r.canonical).toEqual({ volume: 500, ps: 11, ts: '120' })
    // `volume` non compare: per un serbatoio è già il nome canonico, va solo
    // convertito da stringa a numero, non rinominato né rimosso.
    expect(r.legacyKeysConverted.sort()).toEqual(['pressione', 'temperatura'])
    expect(r.changed).toBe(true)
  })

  it('lo stesso nome ha significati diversi secondo il tipo', () => {
    // Per un serbatoio `volume` resta `volume`; per un compressore è la portata.
    expect(normalizeSpecs('Serbatoi', { volume: '500' }).legacyKeysConverted).toEqual([])
    expect(normalizeSpecs('Compressori', { volume: '500' }).legacyKeysConverted).toEqual(['volume'])
  })

  it('per un compressore «volume» è la portata e «pressione» è la massima', () => {
    const r = normalizeSpecs('Compressori', { volume: '2580', pressione: '15' })
    expect(r.canonical).toEqual({ fad: 2580, pressione_max: 15 })
  })

  it('per un essiccatore «volume» è l’aria trattata', () => {
    expect(normalizeSpecs('Essiccatori', { volume: '13000' }).canonical).toEqual({ q: 13000 })
  })

  it('per una valvola «volume» è l’aria scaricata e «pressione» la taratura', () => {
    expect(normalizeSpecs('Valvole di sicurezza', { volume: '8415', pressione: '11' }).canonical)
      .toEqual({ qmax: 8415, ptar: 11 })
  })

  it('è idempotente su una riga già canonica', () => {
    const r = normalizeSpecs('Serbatoi', { volume: 500, ps: 11, categoria_ped: 'IV' })
    expect(r.changed).toBe(false)
    expect(r.legacyKeysConverted).toEqual([])
    expect(r.canonical).toEqual({ volume: 500, ps: 11, categoria_ped: 'IV' })
  })

  it('segnala i valori attesi numerici ma non convertibili, senza toccarli', () => {
    const r = normalizeSpecs('Valvole di sicurezza', { volume: '>4854', pressione: '13.5' })
    expect(r.unconvertible).toEqual([{ key: 'volume', value: '>4854', reason: 'non_numerico' }])
    expect(r.canonical).toEqual({ ptar: 13.5 })
  })

  it('non sceglie quando vecchia e nuova chiave si contraddicono', () => {
    const r = normalizeSpecs('Serbatoi', { volume: '500', ps: 11, pressione: '13' })
    expect(r.unconvertible).toEqual([{ key: 'pressione', value: '13', reason: 'collisione' }])
    expect(r.canonical.ps).toBe(11)
  })

  it('considera ridondante la chiave generica che concorda con la canonica', () => {
    const r = normalizeSpecs('Serbatoi', { ps: 11, pressione: '11' })
    expect(r.unconvertible).toEqual([])
    expect(r.legacyKeysConverted).toEqual(['pressione'])
  })

  it('non produce nulla senza un tipo', () => {
    expect(normalizeSpecs(null, { volume: '500' }).changed).toBe(false)
  })
})

describe('readSpec', () => {
  it('legge la chiave canonica', () => {
    expect(readSpec('Compressori', { fad: 2580 }, 'fad')).toBe(2580)
  })

  it('ricade sulla chiave generica: è ciò che ripara l’autocompilazione', () => {
    expect(readSpec('Compressori', { volume: '2580' }, 'fad')).toBe(2580)
    expect(readSpec('Compressori', { pressione: '15' }, 'pressione_max')).toBe(15)
    expect(readSpec('Serbatoi', { pressione: '11' }, 'ps')).toBe(11)
  })

  it('dà la precedenza alla chiave canonica', () => {
    expect(readSpec('Compressori', { fad: 2580, volume: '999' }, 'fad')).toBe(2580)
  })

  it('legge la regolazione dei giri, che è un enum e non un numero', () => {
    // È il valore che la scheda dati riporta nella riga del compressore, in sola lettura.
    expect(readSpec('Compressori', { giri: 'variabili' }, 'giri')).toBe('variabili')
    expect(readSpec('Compressori', {}, 'giri')).toBeNull()
  })

  it('restituisce null quando il dato manca', () => {
    expect(readSpec('Compressori', {}, 'fad')).toBeNull()
    expect(readSpec('Compressori', null, 'fad')).toBeNull()
  })
})

describe('missingCanonicalSpecs', () => {
  it('non lamenta nulla se i dati ci sono, anche in formato vecchio', () => {
    expect(missingCanonicalSpecs('Serbatoi', { volume: '500', pressione: '11' })).toEqual([])
  })

  it('elenca i campi obbligatori assenti', () => {
    const mancanti = missingCanonicalSpecs('Compressori', { pressione: '13' }).map(d => d.key)
    expect(mancanti).toEqual(['fad'])
  })
})

describe('canonicalFromForm', () => {
  it('traduce i campi della scheda dati', () => {
    expect(
      canonicalFromForm('Serbatoi', { volume: 500, ps_pressione_max: 11, categoria_ped: 'IV' })
    ).toEqual({ volume: 500, ps: 11, categoria_ped: 'IV' })
  })

  it('accetta i campi deprecati che le schede vecchie usano ancora', () => {
    expect(canonicalFromForm('Compressori', { fad: 2580 })).toEqual({ fad: 2580 })
    expect(canonicalFromForm('Valvole di sicurezza', { portata_max: 8415 })).toEqual({ qmax: 8415 })
  })

  it('a parità di destinazione vince il campo corrente sul deprecato', () => {
    expect(canonicalFromForm('Compressori', { volume_aria_prodotto: 2600, fad: 2580 }).fad).toBe(2600)
  })

  it('ignora i campi vuoti', () => {
    expect(canonicalFromForm('Serbatoi', { volume: null, ps_pressione_max: '' })).toEqual({})
  })
})

describe('chiave di variante', () => {
  it('individua la chiave che distingue le varianti di un modello', () => {
    expect(variantSpecKey('Compressori')).toBe('pressione_esercizio')
    expect(variantSpecKey('Valvole di sicurezza')).toBe('ptar')
    expect(variantSpecKey('Serbatoi')).toBe('ps')
    expect(variantSpecKey('Filtri')).toBe('ps')
    expect(variantSpecKey('Separatori')).toBeNull()
    expect(variantSpecKey(null)).toBeNull()
  })

  it('dichiara la ricaduta dei compressori, come il COALESCE dell indice unico', () => {
    expect(variantSpecKeys('Compressori')).toEqual(['pressione_esercizio', 'pressione_max'])
    expect(variantSpecKeys('Valvole di sicurezza')).toEqual(['ptar'])
    expect(variantSpecKeys('Serbatoi')).toEqual(['ps'])
  })

  it('preferisce la pressione di esercizio a quella di targa', () => {
    expect(readVariantValue('Compressori', { pressione_esercizio: 7.5, pressione_max: 8 })).toBe(7.5)
  })

  it('ripiega sulla pressione di targa quando manca quella di esercizio', () => {
    // 146 righe su 612 a produzione sono in questo stato.
    expect(readVariantValue('Compressori', { pressione_max: 11 })).toBe(11)
  })

  it('legge anche la chiave generica dell import massivo', () => {
    expect(readVariantValue('Compressori', { pressione: '10' })).toBe(10)
    expect(readVariantValue('Valvole di sicurezza', { pressione: '11' })).toBe(11)
  })

  it('restituisce null se il tipo non ha varianti o il dato manca', () => {
    expect(readVariantValue('Serbatoi', { ps: 11 })).toBe(11)
    expect(readVariantValue('Separatori', { ps: 11 })).toBeNull()
    expect(readVariantValue('Compressori', { fad: 2000 })).toBeNull()
    expect(readVariantValue('Compressori', null)).toBeNull()
  })
})

describe('pressione dichiarata dalla scheda dati', () => {
  it('sui compressori è la massima, non quella di esercizio', () => {
    // La colonna della scheda si intitola PS e finisce nella denuncia: è la pressione di targa.
    // A catalogo la stessa riga si distingue invece per pressione di esercizio.
    expect(sheetPressureKey('Compressori')).toBe('pressione_max')
    expect(readSheetPressure('Compressori', { pressione_esercizio: 10, pressione_max: 11 })).toBe(11)
    expect(readSheetPressure('Compressori', { pressione_esercizio: 7.5, pressione_max: 8 })).toBe(8)
  })

  it('sugli altri tipi coincide con la chiave di variante', () => {
    expect(sheetPressureKey('Serbatoi')).toBe('ps')
    expect(sheetPressureKey('Valvole di sicurezza')).toBe('ptar')
    expect(readSheetPressure('Serbatoi', { ps: 11 })).toBe(11)
    expect(readSheetPressure('Valvole di sicurezza', { ptar: 9 })).toBe(9)
  })

  it('ripiega sulla variante quando la pressione di scheda manca', () => {
    // 162 righe di compressori a produzione hanno solo la pressione di esercizio o la generica.
    expect(readSheetPressure('Compressori', { pressione_esercizio: 13 })).toBe(13)
    expect(readSheetPressure('Compressori', { pressione: '10' })).toBe(10)
  })

  it('senza pressioni, o su un tipo che non ne ha, è null', () => {
    expect(readSheetPressure('Compressori', { fad: 2000 })).toBeNull()
    expect(readSheetPressure('Separatori', { ps: 11 })).toBeNull()
    expect(readSheetPressure(null, { ps: 11 })).toBeNull()
  })
})

describe('pressione_esercizio resta operativa pur essendo interna', () => {
  it('regge ancora la chiave di variante', () => {
    expect(variantSpecKey('Compressori')).toBe('pressione_esercizio')
    expect(variantSpecKeys('Compressori')).toEqual(['pressione_esercizio', 'pressione_max'])
    expect(readVariantValue('Compressori', { pressione_esercizio: 7.5, pressione_max: 8 })).toBe(7.5)
  })

  it('non entra fra i campi obbligatori mancanti', () => {
    expect(
      missingCanonicalSpecs('Compressori', { fad: 2000, pressione_max: 8 }).map(d => d.key)
    ).toEqual([])
  })

  it('sopravvive alla normalizzazione', () => {
    const r = normalizeSpecs('Compressori', { pressione_esercizio: '10', pressione_max: '11', volume: '1680' })
    expect(r.canonical).toEqual({ pressione_esercizio: 10, pressione_max: 11, fad: 1680 })
  })
})

describe('Filtri — PS opzionale, a parità con gli altri recipienti', () => {
  it('ha una chiave di variante come i recipienti, ma non è obbligatoria', () => {
    expect(variantSpecKey('Filtri')).toBe('ps')
    expect(missingCanonicalSpecs('Filtri', {}).map(d => d.key)).toEqual([])
  })

  it('legge PS come pressione di scheda, come sugli altri recipienti', () => {
    expect(sheetPressureKey('Filtri')).toBe('ps')
    expect(readSheetPressure('Filtri', { ps: 11 })).toBe(11)
    expect(readVariantValue('Filtri', { ps: 11 })).toBe(11)
  })

  it('traduce i campi della scheda dati come per i serbatoi', () => {
    expect(canonicalFromForm('Filtri', { ps_pressione_max: 11, ts: '-10 ÷ +50' }))
      .toEqual({ ps: 11, ts: '-10 ÷ +50' })
  })
})
