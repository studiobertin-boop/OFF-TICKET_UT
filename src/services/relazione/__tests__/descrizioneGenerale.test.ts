import { describe, test, expect } from 'vitest'
import { buildDescrizioneGenerale } from '../engine/descrizioneGenerale'
import {
  makeScheda,
  makeCompressore,
  makeSerbatoio,
  makeEssiccatore,
  makeFiltro,
  makeSeparatore,
  makeDatiImpianto,
  makeAdditionalInfo,
} from './fixtures'

/** Prima riga = sezione di pompaggio. */
function pompaggio(scheda: Parameters<typeof buildDescrizioneGenerale>[0], giri: Record<string, 'fissi' | 'variabili'> = {}) {
  return buildDescrizioneGenerale(scheda, makeAdditionalInfo({ compressoriGiri: giri }))
    .sezioni[0]
}

describe('buildDescrizioneGenerale — sezione di pompaggio', () => {
  test('singolare con 1 compressore, giri variabili', () => {
    const scheda = makeScheda({ compressori: [makeCompressore({ codice: 'C1' })] })
    expect(pompaggio(scheda, { C1: 'variabili' })).toBe(
      'Sezione di pompaggio costituita da n°1 compressore rotativo a vite a giri variabili tramite inverter'
    )
  })

  test('plurale con più compressori omogenei', () => {
    const scheda = makeScheda({
      compressori: [makeCompressore({ codice: 'C1' }), makeCompressore({ codice: 'C2' })],
    })
    expect(pompaggio(scheda, { C1: 'fissi', C2: 'fissi' })).toBe(
      'Sezione di pompaggio costituita da n°2 compressori rotativi a vite a giri fissi'
    )
  })

  test('tipo comune e giri diversi: il tipo si fattorizza fuori (relazione 541)', () => {
    const scheda = makeScheda({
      compressori: [
        makeCompressore({ codice: 'C1' }),
        makeCompressore({ codice: 'C2' }),
        makeCompressore({ codice: 'C3' }),
      ],
    })
    expect(pompaggio(scheda, { C1: 'fissi', C2: 'variabili', C3: 'variabili' })).toBe(
      'Sezione di pompaggio costituita da n°3 compressori rotativi a vite di cui uno a giri fissi e due a giri variabili tramite inverter'
    )
  })

  test('usa la d eufonica davanti a vocale (relazione 555)', () => {
    const scheda = makeScheda({
      compressori: [
        makeCompressore({ codice: 'C1' }),
        makeCompressore({ codice: 'C2' }),
        makeCompressore({ codice: 'C3' }),
      ],
    })
    expect(pompaggio(scheda, { C1: 'fissi', C2: 'fissi', C3: 'variabili' })).toBe(
      'Sezione di pompaggio costituita da n°3 compressori rotativi a vite di cui due a giri fissi ed uno a giri variabili tramite inverter'
    )
  })

  test('tipi diversi: il descrittore entra nei gruppi (relazione 554)', () => {
    const scheda = makeScheda({
      compressori: [
        makeCompressore({ codice: 'C1', tipo: 'VITE' }),
        makeCompressore({ codice: 'C2', tipo: 'PISTONI', silenziato: true }),
      ],
    })
    expect(pompaggio(scheda, { C1: 'fissi' })).toBe(
      'Sezione di pompaggio costituita da n°2 compressori di cui uno rotativo a vite a giri fissi ed uno silenziato a pistoni'
    )
  })

  test('non emette la sezione senza compressori', () => {
    const sezioni = buildDescrizioneGenerale(
      makeScheda({ compressori: [], disoleatori: [] }),
      makeAdditionalInfo()
    ).sezioni
    expect(sezioni.some((s) => s.startsWith('Sezione di pompaggio'))).toBe(false)
  })
})

describe('buildDescrizioneGenerale — sezioni di accumulo', () => {
  test('plurali coerenti col conteggio', () => {
    const scheda = makeScheda({
      serbatoi: [makeSerbatoio({ codice: 'S1' }), makeSerbatoio({ codice: 'S2' })],
    })
    expect(buildDescrizioneGenerale(scheda, makeAdditionalInfo()).sezioni[1]).toBe(
      'Sezione di accumulo ed alimentazione delle linee aria compressa costituita da n°2 serbatoi polmone verticali'
    )
  })

  test('riflette l’orientamento orizzontale', () => {
    const scheda = makeScheda({
      serbatoi: [makeSerbatoio({ orientamento: 'ORIZZONTALE' })],
    })
    expect(buildDescrizioneGenerale(scheda, makeAdditionalInfo()).sezioni[1]).toBe(
      'Sezione di accumulo ed alimentazione delle linee aria compressa costituita da n°1 serbatoio polmone orizzontale'
    )
  })

  test('elenca le ubicazioni solo se differiscono (relazione 582)', () => {
    const scheda = makeScheda({
      serbatoi: [
        makeSerbatoio({ codice: 'S1', ubicazione: 'SALA_COMPRESSORI' }),
        makeSerbatoio({ codice: 'S2', ubicazione: 'LINEA_DISTRIBUZIONE' }),
        makeSerbatoio({ codice: 'S3', ubicazione: 'LINEA_DISTRIBUZIONE' }),
      ],
    })
    expect(buildDescrizioneGenerale(scheda, makeAdditionalInfo()).sezioni[1]).toBe(
      'Sezione di accumulo ed alimentazione delle linee aria compressa costituita da n°3 serbatoi polmone verticali di cui uno ubicato in sala compressori e due dislocati lungo la linea di distribuzione'
    )
  })

  test('riporta l’ubicazione libera quando è "altra posizione"', () => {
    const scheda = makeScheda({
      serbatoi: [
        makeSerbatoio({ codice: 'S1' }),
        makeSerbatoio({ codice: 'S2', ubicazione: 'ALTRO', ubicazione_altro: 'esterno coperto' }),
      ],
    })
    expect(buildDescrizioneGenerale(scheda, makeAdditionalInfo()).sezioni[1]).toContain(
      'esterno coperto'
    )
  })

  test('crea una sezione separata per l’azoto, dopo l’aria compressa', () => {
    const scheda = makeScheda({
      serbatoi: [
        makeSerbatoio({ codice: 'S1' }),
        makeSerbatoio({ codice: 'S2', fluido: 'AZOTO' }),
      ],
    })
    const sezioni = buildDescrizioneGenerale(scheda, makeAdditionalInfo()).sezioni
    expect(sezioni[1]).toContain('linee aria compressa')
    expect(sezioni[2]).toBe(
      'Sezione di accumulo ed alimentazione delle linee azoto costituita da n°1 serbatoio polmone verticale'
    )
  })
})

describe('buildDescrizioneGenerale — sezione trattamento aria', () => {
  test('somma essiccatori e filtri di linea', () => {
    const scheda = makeScheda({
      essiccatori: [makeEssiccatore({ codice: 'E1' })],
      filtri: [makeFiltro({ codice: 'F1' }), makeFiltro({ codice: 'F2' })],
    })
    expect(buildDescrizioneGenerale(scheda, makeAdditionalInfo()).sezioni[2]).toBe(
      "Sezione trattamento aria costituita da n°1 essiccatore d'aria a ciclo frigorifero e n°2 filtri di linea"
    )
  })

  test('distingue prefiltro da filtro di linea (relazioni 555 e 582)', () => {
    const scheda = makeScheda({
      essiccatori: [makeEssiccatore({ codice: 'E1' })],
      filtri: [
        makeFiltro({ codice: 'F1', tipo: 'PREFILTRO' }),
        makeFiltro({ codice: 'F2', tipo: 'LINEA' }),
        makeFiltro({ codice: 'F3', tipo: 'LINEA' }),
      ],
    })
    expect(buildDescrizioneGenerale(scheda, makeAdditionalInfo()).sezioni[2]).toBe(
      "Sezione trattamento aria costituita da n°1 prefiltro, n°1 essiccatore d'aria a ciclo frigorifero e n°2 filtri di linea"
    )
  })

  test('omette i filtri di linea quando ci sono solo essiccatori (relazione 554)', () => {
    const scheda = makeScheda({
      essiccatori: [makeEssiccatore({ codice: 'E1' })],
      filtri: [],
    })
    expect(buildDescrizioneGenerale(scheda, makeAdditionalInfo()).sezioni[2]).toBe(
      "Sezione trattamento aria costituita da n°1 essiccatore d'aria a ciclo frigorifero"
    )
  })
})

describe('buildDescrizioneGenerale — raccolta condense', () => {
  test('la riga separatore compare solo se esiste un separatore', () => {
    const senza = buildDescrizioneGenerale(makeScheda({ separatori: [] }), makeAdditionalInfo())
    expect(senza.sezioni.some((s) => s.includes('separatore acqua olio'))).toBe(false)

    const con = buildDescrizioneGenerale(
      makeScheda({ separatori: [makeSeparatore()] }),
      makeAdditionalInfo()
    )
    expect(con.sezioni.some((s) => s.includes('separatore acqua olio'))).toBe(true)
  })

  test('distingue tanica da recipiente dedicato', () => {
    const ultima = (raccolta: 'tanica' | 'altro') => {
      const { sezioni } = buildDescrizioneGenerale(
        makeScheda({ dati_impianto: makeDatiImpianto({ raccolta_condense: raccolta }) }),
        makeAdditionalInfo()
      )
      return sezioni[sezioni.length - 1]
    }
    expect(ultima('tanica')).toBe('Raccolta delle condense in tanica dedicata')
    expect(ultima('altro')).toBe('Raccolta delle condense in recipiente dedicato')
  })

  test('nessuna riga con raccolta condense assente', () => {
    const model = buildDescrizioneGenerale(
      makeScheda({ dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }) }),
      makeAdditionalInfo()
    )
    expect(model.sezioni.some((s) => s.startsWith('Raccolta delle condense'))).toBe(false)
  })
})
