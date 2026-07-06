import { describe, test, expect } from 'vitest'
import { buildClassificazione } from '../engine/classificazione'
import {
  makeScheda,
  makeCompressore,
  makeDisoleatore,
  makeEssiccatore,
  makeScambiatore,
  makeSerbatoio,
  makeAdditionalInfo,
} from './fixtures'

// Helper: scheda con solo compressori/disoleatori (azzera il resto)
const schedaCompressori = (
  compressori: ReturnType<typeof makeCompressore>[],
  disoleatori: ReturnType<typeof makeDisoleatore>[]
) =>
  makeScheda({
    compressori,
    disoleatori,
    serbatoi: [makeSerbatoio()],
    essiccatori: [makeEssiccatore({ ha_scambiatore: false })],
    scambiatori: [],
    filtri: [],
  })

describe('classificazione — compressori', () => {
  test('ALT1: un solo compressore senza disoleatore → escluso', () => {
    const m = buildClassificazione(
      schedaCompressori([makeCompressore({ codice: 'C1', ha_disoleatore: false })], []),
      makeAdditionalInfo()
    )
    expect(m.compressori.alternativa).toBe(1)
    expect(m.compressori.testo).toContain('C1')
    expect(m.compressori.testo).toContain('volume inferiore a 25 litri')
  })

  test('ALT2: un solo compressore con disoleatore → verifica', () => {
    const m = buildClassificazione(
      schedaCompressori(
        [makeCompressore({ codice: 'C1', ha_disoleatore: true })],
        [makeDisoleatore({ codice: 'C1.1', compressore_associato: 'C1' })]
      ),
      makeAdditionalInfo()
    )
    expect(m.compressori.alternativa).toBe(2)
    expect(m.compressori.testo).toContain('C1.1')
    expect(m.compressori.testo).toContain('verifica di messa in servizio')
  })

  test('ALT4: più compressori misti → elenco per apparecchiatura', () => {
    const m = buildClassificazione(
      schedaCompressori(
        [
          makeCompressore({ codice: 'C1', ha_disoleatore: false }),
          makeCompressore({ codice: 'C2', ha_disoleatore: true }),
        ],
        [makeDisoleatore({ codice: 'C2.1', compressore_associato: 'C2' })]
      ),
      makeAdditionalInfo()
    )
    expect(m.compressori.alternativa).toBe(4)
    expect(m.compressori.testo).toContain('C1')
    expect(m.compressori.testo).toContain('C2.1')
  })

  test('ALT5: più compressori tutti con disoleatore → posizioni unite con la "e"', () => {
    const m = buildClassificazione(
      schedaCompressori(
        [
          makeCompressore({ codice: 'C1', ha_disoleatore: true }),
          makeCompressore({ codice: 'C2', ha_disoleatore: true }),
        ],
        [
          makeDisoleatore({ codice: 'C1.1', compressore_associato: 'C1' }),
          makeDisoleatore({ codice: 'C2.1', compressore_associato: 'C2' }),
        ]
      ),
      makeAdditionalInfo()
    )
    expect(m.compressori.alternativa).toBe(5)
    expect(m.compressori.testo).toContain('C1.1 e C2.1')
  })

  test('addon spessimetrica: aggiunge la frase se il disoleatore è in spessimetrica', () => {
    const m = buildClassificazione(
      schedaCompressori(
        [makeCompressore({ codice: 'C1', ha_disoleatore: true })],
        [makeDisoleatore({ codice: 'C1.1', compressore_associato: 'C1' })]
      ),
      makeAdditionalInfo({ spessimetrica: ['C1.1'] })
    )
    expect(m.compressori.testo).toContain('verifica spessimetrica')
  })
})

describe('classificazione — essiccatori', () => {
  const schedaEss = (
    essiccatori: ReturnType<typeof makeEssiccatore>[],
    scambiatori: ReturnType<typeof makeScambiatore>[]
  ) =>
    makeScheda({
      compressori: [makeCompressore({ ha_disoleatore: false })],
      disoleatori: [],
      serbatoi: [makeSerbatoio()],
      essiccatori,
      scambiatori,
      filtri: [],
    })

  test('ALT1: un solo essiccatore senza scambiatore → escluso', () => {
    const m = buildClassificazione(
      schedaEss([makeEssiccatore({ codice: 'E1', ha_scambiatore: false })], []),
      makeAdditionalInfo()
    )
    expect(m.essiccatori.alternativa).toBe(1)
    expect(m.essiccatori.testo).toContain('E1')
  })

  test('ALT2: un solo essiccatore con scambiatore → verifica, cita lo scambiatore', () => {
    const m = buildClassificazione(
      schedaEss(
        [makeEssiccatore({ codice: 'E1', ha_scambiatore: true })],
        [makeScambiatore({ codice: 'E1.1', essiccatore_associato: 'E1' })]
      ),
      makeAdditionalInfo()
    )
    expect(m.essiccatori.alternativa).toBe(2)
    expect(m.essiccatori.testo).toContain('E1.1')
    expect(m.essiccatori.testo).toContain('verifica di messa in servizio')
  })
})

describe('classificazione — serbatoi', () => {
  const schedaSerb = (serbatoi: ReturnType<typeof makeSerbatoio>[]) =>
    makeScheda({
      compressori: [makeCompressore({ ha_disoleatore: false })],
      disoleatori: [],
      serbatoi,
      essiccatori: [makeEssiccatore({ ha_scambiatore: false })],
      scambiatori: [],
      filtri: [],
    })

  test('ALT1: un solo serbatoio a dichiarazione (PS×V ≤ 8000)', () => {
    const m = buildClassificazione(
      schedaSerb([makeSerbatoio({ codice: 'S1', volume: 270, ps_pressione_max: 11 })]),
      makeAdditionalInfo()
    )
    expect(m.serbatoi.alternativa).toBe(1)
    expect(m.serbatoi.testo).toContain('dichiarazione di messa in servizio')
  })

  test('ALT2: un solo serbatoio a verifica (PS×V > 8000)', () => {
    const m = buildClassificazione(
      schedaSerb([makeSerbatoio({ codice: 'S1', volume: 2000, ps_pressione_max: 11.5 })]),
      makeAdditionalInfo()
    )
    expect(m.serbatoi.alternativa).toBe(2)
    expect(m.serbatoi.testo).toContain('verifica di messa in servizio')
  })

  test('ALT4: più serbatoi misti dichiarazione/verifica', () => {
    const m = buildClassificazione(
      schedaSerb([
        makeSerbatoio({ codice: 'S1', volume: 270, ps_pressione_max: 11 }),
        makeSerbatoio({ codice: 'S2', volume: 2000, ps_pressione_max: 11.5 }),
      ]),
      makeAdditionalInfo()
    )
    expect(m.serbatoi.alternativa).toBe(4)
  })

  test('dettagli serbatoio: scarico, finitura, ancoraggio e manometro risolti dai flag', () => {
    const m = buildClassificazione(
      schedaSerb([
        makeSerbatoio({
          codice: 'S1',
          volume: 270,
          ps_pressione_max: 11,
          scarico: 'AUTOMATICO',
          finitura_interna: 'ZINCATO',
          ancorato_terra: true,
          manometro: { fondo_scala: 16, segno_rosso: 11 },
        }),
      ]),
      makeAdditionalInfo()
    )
    expect(m.serbatoi.testo).toContain('automatico')
    expect(m.serbatoi.testo).toContain('zincata')
    expect(m.serbatoi.testo).toContain('ancorato a terra')
    expect(m.serbatoi.testo).toContain('fondo scala a 16 bar')
    expect(m.serbatoi.testo).toContain('segno rosso a 11 bar')
  })
})
