import { describe, it, expect } from 'vitest'
import {
  classificaRecipiente,
  classificaCompressore,
  classificaTubazioni,
  comportaAdempimento,
  frequenzeRiqualificazione,
  esitoToTipoPratica,
  calcolaEsitiPerCodice,
  codiciConAdempimento,
} from '../dm329Classification'
import { determineTipoPratica } from '../civaFiltering'

describe('classificaRecipiente', () => {
  it('restituisce null quando i dati non bastano a decidere', () => {
    expect(classificaRecipiente(undefined, 11)).toBeNull()
    expect(classificaRecipiente(500, undefined)).toBeNull()
    expect(classificaRecipiente(0, 11)).toBeNull()
    expect(classificaRecipiente(500, 0)).toBeNull()
    expect(classificaRecipiente(-10, 11)).toBeNull()
  })

  it('esclude i recipienti sotto i 25 litri (art. 2 comma i)', () => {
    expect(classificaRecipiente(24, 16)).toBe('ESCLUSO_VOLUME')
    expect(classificaRecipiente(20, 11)).toBe('ESCLUSO_VOLUME')
  })

  it('colloca sotto soglia 25 ≤ V < 50 con PS < 12', () => {
    expect(classificaRecipiente(25, 11)).toBe('SOTTO_SOGLIA')
    expect(classificaRecipiente(49, 11.9)).toBe('SOTTO_SOGLIA')
  })

  it('richiede dichiarazione per V ≥ 50, PS ≤ 12, PS×V ≤ 8000', () => {
    // Esempio della guida Baglioni: V=500, PS=11 → PS×V=5500
    expect(classificaRecipiente(500, 11)).toBe('DICHIARAZIONE')
    // Confine esatto: PS×V = 8000
    expect(classificaRecipiente(800, 10)).toBe('DICHIARAZIONE')
  })

  it('richiede verifica per PS×V > 8000', () => {
    // Relazione 555: V=3000, PS=11,5 → 34500
    expect(classificaRecipiente(3000, 11.5)).toBe('VERIFICA')
    // Relazione 541: V=2000, PS=11,5 → 23000
    expect(classificaRecipiente(2000, 11.5)).toBe('VERIFICA')
    // Appena oltre il confine
    expect(classificaRecipiente(801, 10)).toBe('VERIFICA')
  })

  it('richiede verifica per V > 25 con PS > 12 (disoleatori)', () => {
    // Relazione 555: disoleatori 65/55/125 litri a 16 bar
    expect(classificaRecipiente(65, 16)).toBe('VERIFICA')
    expect(classificaRecipiente(30, 16)).toBe('VERIFICA')
    // Relazione 541: scambiatore 28 litri a 14 bar
    expect(classificaRecipiente(28, 14)).toBe('VERIFICA')
  })

  it('tratta come sotto soglia il residuo 25 ≤ V < 50 con PS ≥ 12', () => {
    expect(classificaRecipiente(30, 12)).toBe('SOTTO_SOGLIA')
    expect(classificaRecipiente(25, 15)).toBe('SOTTO_SOGLIA')
  })
})

describe('determineTipoPratica — comportamento invariato dopo il refactor', () => {
  const casi: Array<[number | undefined, number | undefined, string]> = [
    [undefined, 11, 'NESSUNA'],
    [500, undefined, 'NESSUNA'],
    [0, 11, 'NESSUNA'],
    [24, 16, 'NESSUNA'],
    [25, 11, 'NESSUNA'],
    [49, 11.9, 'NESSUNA'],
    [30, 12, 'NESSUNA'],
    [25, 15, 'NESSUNA'],
    [500, 11, 'DICHIARAZIONE'],
    [800, 10, 'DICHIARAZIONE'],
    [801, 10, 'VERIFICA'],
    [3000, 11.5, 'VERIFICA'],
    [65, 16, 'VERIFICA'],
    [28, 14, 'VERIFICA'],
  ]

  it.each(casi)('V=%s PS=%s → %s', (volume, ps, atteso) => {
    expect(determineTipoPratica(volume, ps)).toBe(atteso)
  })
})

describe('classificaCompressore', () => {
  it('distingue il compressore con disoleatore da quello privo di recipienti', () => {
    expect(classificaCompressore(true)).toBe('ESCLUSO_COMPRESSORE')
    expect(classificaCompressore(false)).toBe('ESCLUSO_NO_RECIPIENTE')
  })
})

describe('classificaTubazioni', () => {
  it('esclude fino a DN 80 compreso', () => {
    expect(classificaTubazioni(80)).toBe('ESCLUSO_TUBAZIONE')
    expect(classificaTubazioni(50)).toBe('ESCLUSO_TUBAZIONE')
  })

  it('fa rientrare nel campo di applicazione oltre DN 80', () => {
    expect(classificaTubazioni(100)).toBe('VERIFICA')
  })

  it('restituisce null senza diametro dichiarato', () => {
    expect(classificaTubazioni(undefined)).toBeNull()
    expect(classificaTubazioni(0)).toBeNull()
  })
})

describe('comportaAdempimento', () => {
  it('è vero solo per dichiarazione e verifica', () => {
    expect(comportaAdempimento('DICHIARAZIONE')).toBe(true)
    expect(comportaAdempimento('VERIFICA')).toBe(true)
    expect(comportaAdempimento('ESCLUSO_VOLUME')).toBe(false)
    expect(comportaAdempimento('ESCLUSO_NO_RECIPIENTE')).toBe(false)
    expect(comportaAdempimento('SOTTO_SOGLIA')).toBe(false)
    expect(comportaAdempimento('ESCLUSO_COMPRESSORE')).toBe(false)
    expect(comportaAdempimento('ESCLUSO_TUBAZIONE')).toBe(false)
    expect(comportaAdempimento(null)).toBe(false)
  })
})

describe('frequenzeRiqualificazione', () => {
  it('applica 3 anni alle categorie III e IV, 4 anni a I e II', () => {
    expect(frequenzeRiqualificazione('III')).toEqual({ funzionamentoAnni: 3, integritaAnni: 10 })
    expect(frequenzeRiqualificazione('IV')).toEqual({ funzionamentoAnni: 3, integritaAnni: 10 })
    expect(frequenzeRiqualificazione('I')).toEqual({ funzionamentoAnni: 4, integritaAnni: 10 })
    expect(frequenzeRiqualificazione('II')).toEqual({ funzionamentoAnni: 4, integritaAnni: 10 })
  })

  it('restituisce null senza categoria', () => {
    expect(frequenzeRiqualificazione(undefined)).toBeNull()
  })
})

describe('esitoToTipoPratica', () => {
  it('collassa tutti gli esiti di esclusione su NESSUNA', () => {
    expect(esitoToTipoPratica('ESCLUSO_VOLUME')).toBe('NESSUNA')
    expect(esitoToTipoPratica('ESCLUSO_NO_RECIPIENTE')).toBe('NESSUNA')
    expect(esitoToTipoPratica('SOTTO_SOGLIA')).toBe('NESSUNA')
    expect(esitoToTipoPratica('ESCLUSO_COMPRESSORE')).toBe('NESSUNA')
    expect(esitoToTipoPratica('ESCLUSO_TUBAZIONE')).toBe('NESSUNA')
    expect(esitoToTipoPratica(null)).toBe('NESSUNA')
  })
})

describe('calcolaEsitiPerCodice', () => {
  it('classifica un serbatoio, un disoleatore, uno scambiatore e un recipiente filtro', () => {
    const righe = calcolaEsitiPerCodice({
      serbatoi: [{ codice: 'S1', volume: 100, ps_pressione_max: 15 } as any],
      disoleatori: [{ codice: 'C1.1', volume: 10, ps_pressione_max: 10 } as any],
      scambiatori: [{ codice: 'E1.1', volume: 200, ps_pressione_max: 15 } as any],
      recipienti_filtro: [{ codice: 'F1.1', volume: 5, ps_pressione_max: 5 } as any],
    })

    expect(righe).toEqual([
      { codice: 'S1', esito: 'VERIFICA', giaDenunciato: false },
      { codice: 'C1.1', esito: 'ESCLUSO_VOLUME', giaDenunciato: false },
      { codice: 'E1.1', esito: 'VERIFICA', giaDenunciato: false },
      { codice: 'F1.1', esito: 'ESCLUSO_VOLUME', giaDenunciato: false },
    ])
  })

  it('riporta gia_denunciato quando marcato sulla riga', () => {
    const righe = calcolaEsitiPerCodice({
      serbatoi: [{ codice: 'S1', volume: 100, ps_pressione_max: 15, gia_denunciato: true } as any],
    })
    expect(righe).toEqual([{ codice: 'S1', esito: 'VERIFICA', giaDenunciato: true }])
  })

  it('array assenti o vuoti non producono righe', () => {
    expect(calcolaEsitiPerCodice({})).toEqual([])
  })
})

describe('codiciConAdempimento', () => {
  it('esclude gli esiti che non comportano adempimento', () => {
    const codici = codiciConAdempimento([
      { codice: 'S1', esito: 'VERIFICA', giaDenunciato: false },
      { codice: 'S2', esito: 'SOTTO_SOGLIA', giaDenunciato: false },
      { codice: 'S3', esito: 'DICHIARAZIONE', giaDenunciato: false },
    ])
    expect(codici).toEqual(['S1', 'S3'])
  })

  it('esclude i codici già marcati come denunciati, anche se comportano adempimento', () => {
    const codici = codiciConAdempimento([
      { codice: 'S1', esito: 'VERIFICA', giaDenunciato: true },
      { codice: 'S2', esito: 'VERIFICA', giaDenunciato: false },
    ])
    expect(codici).toEqual(['S2'])
  })
})
