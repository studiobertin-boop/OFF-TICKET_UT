import { describe, it, expect } from 'vitest'
import { buildFluidi } from '../engine/fluidi'
import { buildCondizioniInstallazione } from '../engine/condizioniInstallazione'
import { buildProtezioni } from '../engine/protezioni'
import { buildRiqualificazione } from '../engine/riqualificazione'
import { buildEsiti } from '../engine/esiti'
import { buildValvole } from '../engine/valvole'
import {
  makeScheda,
  makeAdditionalInfo,
  makeDatiImpianto,
  makeSerbatoio,
  makeCompressore,
  makeValvola,
  makeDisoleatore,
  makeScambiatore,
  makeFiltro,
  makeRecipienteFiltro,
} from './fixtures'

const info = makeAdditionalInfo()

// ---------------------------------------------------------------------------
// §3 Fluidi
// ---------------------------------------------------------------------------

describe('buildFluidi', () => {
  it('espone il circuito aria compressa con gruppo 2', () => {
    const { righe } = buildFluidi(makeScheda())
    expect(righe).toHaveLength(1)
    expect(righe[0]).toMatchObject({
      circuito: 'Aria compressa',
      fluido: 'Aria ambiente',
      gruppo: '2',
      provenienza: "Aspirazione dall'ambiente",
    })
  })

  it('non evidenzia nulla con aria pulita', () => {
    const scheda = makeScheda({
      dati_impianto: makeDatiImpianto({ aria_aspirata: ['Pulita'] }),
    })
    const { evidenziaNocive, righe } = buildFluidi(scheda)
    expect(evidenziaNocive).toBe(false)
    expect(righe[0].qualita).toBe('')
  })

  it('evidenzia la dichiarazione di assenza di sostanze nocive con acidi o vapori', () => {
    for (const qualita of [['Acidi'], ['Vapori'], ['Umidità', 'Acidi']] as const) {
      const scheda = makeScheda({
        dati_impianto: makeDatiImpianto({ aria_aspirata: [...qualita] }),
      })
      expect(buildFluidi(scheda).evidenziaNocive).toBe(true)
    }
  })

  it('non evidenzia per umidità o polveri, trattate dalle sezioni di filtrazione', () => {
    const scheda = makeScheda({
      dati_impianto: makeDatiImpianto({ aria_aspirata: ['Umidità', 'Polveri'] }),
    })
    const { evidenziaNocive, righe } = buildFluidi(scheda)
    expect(evidenziaNocive).toBe(false)
    // La qualità resta comunque riportata in tabella
    expect(righe[0].qualita).toBe('Umidità, Polveri')
  })

  it('aggiunge il circuito azoto quando un serbatoio lo dichiara', () => {
    const scheda = makeScheda({
      serbatoi: [makeSerbatoio(), makeSerbatoio({ codice: 'S2', fluido: 'AZOTO' })],
    })
    const { righe } = buildFluidi(scheda)
    expect(righe.map((r) => r.circuito)).toEqual(['Aria compressa', 'Azoto'])
    expect(righe[1].gruppo).toBe('2')
  })

  it('lascia il gruppo vuoto per un fluido arbitrario invece di asserirlo', () => {
    const scheda = makeScheda({
      serbatoi: [makeSerbatoio({ fluido: 'ALTRO', fluido_altro: 'Argon' })],
    })
    const argon = buildFluidi(scheda).righe.find((r) => r.circuito === 'Argon')
    expect(argon?.gruppo).toBe('')
  })
})

// ---------------------------------------------------------------------------
// §2.2 Condizioni di installazione
// ---------------------------------------------------------------------------

describe('buildCondizioniInstallazione', () => {
  const trova = (rows: ReturnType<typeof buildCondizioniInstallazione>, frammento: string) =>
    rows.find((r) => r.requisito.includes(frammento))

  it('distingue locale dedicato da area condivisa', () => {
    expect(
      trova(buildCondizioniInstallazione(makeDatiImpianto({ locale_dedicato: true })), 'Ubicazione')
        ?.esito
    ).toBe('Locale dedicato')

    expect(
      trova(
        buildCondizioniInstallazione(
          makeDatiImpianto({ locale_dedicato: false, locale_condiviso_con: 'magazzino ricambi' })
        ),
        'Ubicazione'
      )?.esito
    ).toBe('Area condivisa con magazzino ricambi')
  })

  it('mostra la riga sull’accesso solo quando è effettivamente interdetto', () => {
    expect(
      trova(
        buildCondizioniInstallazione(makeDatiImpianto({ accesso_locale_vietato: true })),
        'Accesso riservato'
      )
    ).toBeDefined()

    expect(
      trova(
        buildCondizioniInstallazione(makeDatiImpianto({ accesso_locale_vietato: false })),
        'Accesso riservato'
      )
    ).toBeUndefined()
  })

  it('evidenzia le righe con esito negativo', () => {
    const rows = buildCondizioniInstallazione(
      makeDatiImpianto({
        lontano_fonti_calore: false,
        lontano_materiale_infiammabile: true,
      })
    )
    expect(trova(rows, 'sorgenti di calore')).toMatchObject({ esito: 'No', evidenzia: true })
    expect(trova(rows, 'materiale infiammabile')).toMatchObject({
      esito: 'Sì',
      evidenzia: false,
    })
  })

  it('non evidenzia l’areazione, che resta un’affermazione fissa', () => {
    const areazione = trova(buildCondizioniInstallazione(makeDatiImpianto()), 'Areazione')
    expect(areazione).toMatchObject({ esito: 'Sì', evidenzia: false })
  })

  it('riporta le note su fonti di calore', () => {
    const rows = buildCondizioniInstallazione(
      makeDatiImpianto({
        lontano_fonti_calore: true,
        fonti_calore_materiali_infiammabili: 'caldaia a 12 m',
      })
    )
    expect(trova(rows, 'sorgenti di calore')?.note).toBe('caldaia a 12 m')
  })

  it('non esplode con dati impianto assenti', () => {
    const rows = buildCondizioniInstallazione(undefined)
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((r) => typeof r.esito === 'string')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// §5.3 Protezioni
// ---------------------------------------------------------------------------

describe('buildProtezioni', () => {
  /** Le protezioni derivano dagli esiti: solo le apparecchiature soggette entrano. */
  const protezioni = (scheda: Parameters<typeof buildProtezioni>[0]) =>
    buildProtezioni(scheda, buildEsiti(scheda, info))

  it('elenca i presidi del serbatoio nella prima tabella', () => {
    const s1 = protezioni(makeScheda()).serbatoi.find((r) => r.pos === 'S1')
    expect(s1).toMatchObject({
      apparecchiatura: 'Serbatoio aria verticale',
      scaricoCondensa: 'Automatico',
      finituraInterna: 'Zincato',
      ancoraggio: 'Sì',
    })
    expect(s1?.valvole).toEqual([{ pos: 'S1.1', nFabbrica: '484725/7' }])
  })

  it('gestisce più valvole sullo stesso recipiente', () => {
    const scheda = makeScheda({
      serbatoi: [
        makeSerbatoio({
          valvole_aggiuntive: [makeValvola({ n_fabbrica: '2926/3', pressione_taratura: 11 })],
        }),
      ],
    })
    const s1 = protezioni(scheda).serbatoi.find((r) => r.pos === 'S1')
    expect(s1?.valvole.map((v) => v.pos)).toEqual(['S1.1', 'S1.2'])
    expect(s1?.valvole[1].nFabbrica).toBe('2926/3')
  })

  it('riporta la finitura verniciata invece di lasciarla muta', () => {
    const scheda = makeScheda({
      serbatoi: [makeSerbatoio({ finitura_interna: 'VERNICIATO' })],
    })
    expect(protezioni(scheda).serbatoi.find((r) => r.pos === 'S1')?.finituraInterna).toBe(
      'Verniciato'
    )
  })

  it('formatta il manometro con fondo scala e segno rosso', () => {
    const scheda = makeScheda({
      serbatoi: [makeSerbatoio({ manometro: { fondo_scala: 16, segno_rosso: 11 } })],
    })
    expect(protezioni(scheda).serbatoi.find((r) => r.pos === 'S1')?.manometro).toBe(
      'fondo scala 16 bar · segno rosso 11 bar'
    )
  })

  it('mette il disoleatore nella seconda tabella, con manometro a bordo macchina', () => {
    const diso = protezioni(makeScheda()).altre.find((r) => r.pos === 'C1.1')
    expect(diso?.valvole.map((v) => v.pos)).toEqual(['C1.2'])
    expect(diso?.manometro).toBe('a bordo macchina')
  })

  it('risolve le valvole dichiarate a protezione dello scambiatore', () => {
    const scheda = makeScheda({
      scambiatori: [makeScambiatore({ valvole_protezione: ['S1.1'] })],
    })
    const scamb = protezioni(scheda).altre.find((r) => r.pos === 'E1.1')
    expect(scamb?.valvole).toEqual([{ pos: 'S1.1', nFabbrica: '484725/7' }])
    expect(scamb?.manometro).toBe('a bordo macchina')
  })

  it('scarta i riferimenti a valvole inesistenti invece di inventarli', () => {
    const scheda = makeScheda({
      scambiatori: [makeScambiatore({ valvole_protezione: ['S9.1'] })],
    })
    expect(protezioni(scheda).altre.find((r) => r.pos === 'E1.1')?.valvole).toEqual([])
  })

  it('mette il recipiente filtro nella seconda tabella, senza manometro', () => {
    const scheda = makeScheda({
      filtri: [makeFiltro({ ha_recipiente: true })],
      recipienti_filtro: [makeRecipienteFiltro({ valvole_protezione: ['S1.1'] })],
    })
    const rec = protezioni(scheda).altre.find((r) => r.pos === 'F1.1')
    expect(rec?.manometro).toBe('-')
    expect(rec?.valvole.map((v) => v.pos)).toEqual(['S1.1'])
  })

  it('esclude le apparecchiature non soggette al DM329', () => {
    // Serbatoio da 20 litri: escluso ex art. 2 comma i, non deve comparire fra i presidi.
    const scheda = makeScheda({
      serbatoi: [makeSerbatoio({ volume: 20, ps_pressione_max: 11 })],
    })
    expect(protezioni(scheda).serbatoi).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// §7.2 Riqualificazione periodica
// ---------------------------------------------------------------------------

describe('buildRiqualificazione', () => {
  it('include solo le apparecchiature con un adempimento', () => {
    const esiti = buildEsiti(makeScheda(), info)
    const rows = buildRiqualificazione(esiti)
    // S1 (verifica), C1.1 (verifica), E1.1 (verifica). Non compressori né valvole.
    expect(rows.map((r) => r.pos).sort()).toEqual(['C1.1', 'E1.1', 'S1'])
  })

  it('applica 3 anni alle categorie III e IV e 4 anni a I e II', () => {
    const esiti = buildEsiti(makeScheda(), info)
    const rows = buildRiqualificazione(esiti)
    // S1 categoria IV, C1.1 categoria III → 3 anni; E1.1 categoria II → 4 anni
    expect(rows.find((r) => r.pos === 'S1')?.verificaFunzionamento).toBe('ogni 3 anni')
    expect(rows.find((r) => r.pos === 'C1.1')?.verificaFunzionamento).toBe('ogni 3 anni')
    expect(rows.find((r) => r.pos === 'E1.1')?.verificaFunzionamento).toBe('ogni 4 anni')
    expect(rows.every((r) => r.verificaIntegrita === 'ogni 10 anni')).toBe(true)
  })

  it('non deroga per i recipienti zincati', () => {
    const scheda = makeScheda({
      serbatoi: [makeSerbatoio({ finitura_interna: 'ZINCATO' })],
    })
    const rows = buildRiqualificazione(buildEsiti(scheda, info))
    expect(rows.some((r) => r.pos === 'S1')).toBe(true)
  })

  it('segnala esplicitamente la categoria mancante', () => {
    const scheda = makeScheda({
      // 800 l × 10 bar = 8000 → dichiarazione; categoria calcolata comunque presente,
      // quindi la si azzera forzando dati non classificabili sulla categoria.
      serbatoi: [makeSerbatoio({ categoria_ped: undefined, volume: undefined })],
    })
    const esiti = buildEsiti(scheda, info).map((e) =>
      e.pos === 'S1' ? { ...e, esito: 'DICHIARAZIONE' as const, categoria: '' } : e
    )
    const s1 = buildRiqualificazione(esiti).find((r) => r.pos === 'S1')
    expect(s1?.verificaFunzionamento).toBe('da determinare (categoria mancante)')
  })
})

// ---------------------------------------------------------------------------
// Dettaglio della somma delle portate
// ---------------------------------------------------------------------------

describe('buildValvole — dettaglio somma portate', () => {
  it('scompone la somma quando più compressori alimentano lo stesso serbatoio', () => {
    // Relazione 555: 9900 + 7000 + 13370 = 30270
    const scheda = makeScheda({
      compressori: [
        makeCompressore({ codice: 'C1', volume_aria_prodotto: 9900 }),
        makeCompressore({ codice: 'C2', volume_aria_prodotto: 7000 }),
        makeCompressore({ codice: 'C3', volume_aria_prodotto: 13370 }),
      ],
      disoleatori: [],
      serbatoi: [
        makeSerbatoio({
          valvola_sicurezza: makeValvola({ volume_aria_scaricato: 32948 }),
        }),
      ],
    })
    const additional = makeAdditionalInfo({
      collegamentiCompressoriSerbatoi: { C1: ['S1'], C2: ['S1'], C3: ['S1'] },
    })
    const riga = buildValvole(scheda, additional).portata.find((r) => r.posValvola === 'S1.1')
    expect(riga?.portataMax).toBe('30270')
    expect(riga?.portataMaxTesto).toBe('9900 + 7000 + 13370 = 30270')
    expect(riga?.adeguato).toBe(true)
  })

  it('con un solo compressore collegato riporta il totale nudo', () => {
    const additional = makeAdditionalInfo({
      collegamentiCompressoriSerbatoi: { C1: ['S1'] },
    })
    const riga = buildValvole(makeScheda(), additional).portata.find(
      (r) => r.posValvola === 'S1.1'
    )
    expect(riga?.portataMaxTesto).toBe(riga?.portataMax)
    expect(riga?.portataMaxTesto).not.toContain('+')
  })

  it('non scompone nulla per le valvole dei disoleatori', () => {
    const scheda = makeScheda({ disoleatori: [makeDisoleatore()] })
    const riga = buildValvole(scheda, info).portata.find((r) => r.posValvola === 'C1.2')
    expect(riga?.portataMaxTesto).toBe(riga?.portataMax)
    expect(riga?.applicabile).toBe(true)
  })

  it('non dichiara adeguata la valvola di un recipiente senza compressori collegati', () => {
    // Caso reale: serbatoio azoto, non alimentato dai compressori d'aria. Una somma
    // pari a zero renderebbe il confronto banalmente "superato".
    const scheda = makeScheda({
      serbatoi: [makeSerbatoio({ codice: 'S1', fluido: 'AZOTO' })],
    })
    const riga = buildValvole(
      scheda,
      makeAdditionalInfo({ collegamentiCompressoriSerbatoi: {} })
    ).portata.find((r) => r.posValvola === 'S1.1')
    expect(riga?.applicabile).toBe(false)
    expect(riga?.adeguato).toBe(false)
    expect(riga?.portataMax).toBe('')
  })
})
