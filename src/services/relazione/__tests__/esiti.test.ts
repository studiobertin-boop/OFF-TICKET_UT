import { describe, it, expect } from 'vitest'
import { buildEsiti } from '../engine/esiti'
import { descrizioneSerbatoio } from '../helpers'
import {
  makeScheda,
  makeAdditionalInfo,
  makeCompressore,
  makeDisoleatore,
  makeSerbatoio,
  makeEssiccatore,
  makeScambiatore,
  makeFiltro,
  makeRecipienteFiltro,
  makeSeparatore,
  makeValvola,
} from './fixtures'

const info = makeAdditionalInfo()

/** Trova la riga di una posizione; fallisce in modo leggibile se assente. */
function riga(rows: ReturnType<typeof buildEsiti>, pos: string) {
  const r = rows.find((x) => x.pos === pos)
  if (!r) throw new Error(`Riga ${pos} assente. Presenti: ${rows.map((x) => x.pos).join(', ')}`)
  return r
}

describe('buildEsiti — compressori', () => {
  it('esclude il compressore con disoleatore ex art. 1 comma 3 lettera L', () => {
    const rows = buildEsiti(makeScheda(), info)
    const c1 = riga(rows, 'C1')
    expect(c1.adempimento).toBe('Escluso')
    expect(c1.riferimento).toBe('art. 1 comma 3 lettera L D.lgs. 93/2000')
    // Il compressore non è un recipiente: nessun numero da esporre
    expect(c1.volume).toBe('')
    expect(c1.ps).toBe('')
  })

  it('esclude ex art. 2 comma i il compressore privo di recipienti (a pistoni)', () => {
    const scheda = makeScheda({
      compressori: [makeCompressore({ tipo: 'PISTONI' })],
      disoleatori: [],
    })
    const c1 = riga(buildEsiti(scheda, info), 'C1')
    expect(c1.adempimento).toBe('Escluso')
    expect(c1.riferimento).toBe('art. 2 comma i D.M. 329/2004')
  })

  it('sottopone a verifica il disoleatore oltre 25 litri e 12 bar', () => {
    const rows = buildEsiti(makeScheda(), info)
    const diso = riga(rows, 'C1.1')
    expect(diso.adempimento).toBe('Verifica e dichiarazione di messa in servizio')
    expect(diso.riferimento).toBe('artt. 4 e 5 D.M. 329/2004')
    expect(diso.volume).toBe('75')
    expect(diso.ps).toBe('16')
    expect(diso.psPerV).toBe('1200')
  })

  it('non espone volume e pressione del disoleatore sotto i 25 litri', () => {
    const scheda = makeScheda({
      disoleatori: [makeDisoleatore({ volume: 20, ps_pressione_max: 16 })],
    })
    const diso = riga(buildEsiti(scheda, info), 'C1.1')
    expect(diso.adempimento).toBe('Escluso')
    expect(diso.riferimento).toBe('art. 2 comma i D.M. 329/2004')
    expect(diso.volume).toBe('')
    expect(diso.ps).toBe('')
    expect(diso.psPerV).toBe('')
  })

  it('numera la valvola del disoleatore come Cx.2 e le fa ereditare l’esito', () => {
    const rows = buildEsiti(makeScheda(), info)
    const valvola = riga(rows, 'C1.2')
    expect(valvola.apparecchiatura).toBe('Valvola di sicurezza')
    expect(valvola.adempimento).toBe('Verifica e dichiarazione di messa in servizio')
    expect(valvola.categoria).toBe('IV')
  })
})

describe('buildEsiti — serbatoi', () => {
  it('richiede verifica quando PS×V supera 8000', () => {
    // Relazione 541: S1 da 2000 l a 11,5 bar → 23000
    const s1 = riga(buildEsiti(makeScheda(), info), 'S1')
    expect(s1.psPerV).toBe('23000')
    expect(s1.adempimento).toBe('Verifica e dichiarazione di messa in servizio')
    expect(s1.statoInail).toBe('Nuova richiesta')
  })

  it('richiede la sola dichiarazione quando PS×V non supera 8000', () => {
    // Relazione 554: S1 da 500 l a 11 bar → 5500
    const scheda = makeScheda({
      serbatoi: [makeSerbatoio({ volume: 500, ps_pressione_max: 11 })],
    })
    const s1 = riga(buildEsiti(scheda, info), 'S1')
    expect(s1.psPerV).toBe('5500')
    expect(s1.adempimento).toBe('Dichiarazione di messa in servizio')
    expect(s1.riferimento).toBe('art. 5 comma 1 lettera c D.M. 329/2004')
  })

  it('riporta la matricola dei recipienti già immatricolati', () => {
    // Relazione 583A: «già immatricolato da INAIL con n.m. 2020/7/50847/TV»
    const scheda = makeScheda({
      serbatoi: [
        makeSerbatoio({ gia_denunciato: true, matricola_inail: '2020/7/50847/TV' }),
      ],
    })
    expect(riga(buildEsiti(scheda, info), 'S1').statoInail).toBe(
      'Già immatricolato n.m. 2020/7/50847/TV'
    )
  })

  it('gestisce più valvole sullo stesso serbatoio', () => {
    // Relazione 555: S1.1 e S1.2 sul medesimo serbatoio
    const scheda = makeScheda({
      serbatoi: [
        makeSerbatoio({
          valvole_aggiuntive: [makeValvola({ n_fabbrica: '2926/3' })],
        }),
      ],
    })
    const rows = buildEsiti(scheda, info)
    expect(riga(rows, 'S1.1').apparecchiatura).toBe('Valvola di sicurezza')
    expect(riga(rows, 'S1.2').apparecchiatura).toBe('Valvola di sicurezza')
  })

  it('segna la verifica di integrità sulle apparecchiature spessimetrate', () => {
    const rows = buildEsiti(makeScheda(), makeAdditionalInfo({ spessimetrica: ['S1'] }))
    expect(riga(rows, 'S1').verificaIntegrita).toBe(true)
    expect(riga(rows, 'C1.1').verificaIntegrita).toBe(false)
  })
})

describe('descrizioneSerbatoio', () => {
  it('usa aria verticale come default', () => {
    expect(descrizioneSerbatoio(makeSerbatoio())).toBe('Serbatoio aria verticale')
  })

  it('riflette orientamento e fluido dichiarati', () => {
    expect(
      descrizioneSerbatoio(makeSerbatoio({ orientamento: 'ORIZZONTALE' }))
    ).toBe('Serbatoio aria orizzontale')
    expect(descrizioneSerbatoio(makeSerbatoio({ fluido: 'AZOTO' }))).toBe(
      'Serbatoio azoto verticale'
    )
    expect(
      descrizioneSerbatoio(makeSerbatoio({ fluido: 'ALTRO', fluido_altro: 'Argon' }))
    ).toBe('Serbatoio argon verticale')
  })
})

describe('buildEsiti — essiccatori e filtri', () => {
  it('esclude l’essiccatore privo di scambiatore', () => {
    // Relazione 554 e 582
    const scheda = makeScheda({ essiccatori: [makeEssiccatore()], scambiatori: [] })
    const e1 = riga(buildEsiti(scheda, info), 'E1')
    expect(e1.adempimento).toBe('Escluso')
    expect(e1.riferimento).toBe('art. 2 comma i D.M. 329/2004')
  })

  it('fa ereditare all’essiccatore l’esito del proprio scambiatore', () => {
    // Relazione 541: E1 con scambiatore E1.1 → verifica di messa in servizio
    const rows = buildEsiti(makeScheda(), info)
    expect(riga(rows, 'E1').adempimento).toBe('Verifica e dichiarazione di messa in servizio')
    expect(riga(rows, 'E1.1').apparecchiatura).toBe('Scambiatore di calore')
    expect(riga(rows, 'E1.1').adempimento).toBe('Verifica e dichiarazione di messa in servizio')
  })

  it('calcola la categoria PED del recipiente filtro quando non è dichiarata', () => {
    const scheda = makeScheda({
      filtri: [makeFiltro({ ha_recipiente: true })],
      recipienti_filtro: [makeRecipienteFiltro()],
    })
    // 75 l × 16 bar = 1200 → categoria III
    expect(riga(buildEsiti(scheda, info), 'F1.1').categoria).toBe('III')
  })
})

describe('buildEsiti — separatori', () => {
  it('non attribuisce adempimenti ai separatori', () => {
    const scheda = makeScheda({ separatori: [makeSeparatore()] })
    const sep = riga(buildEsiti(scheda, info), 'SEP1')
    expect(sep.adempimento).toBe('Non applicabile')
    expect(sep.riferimento).toBe('')
    expect(sep.statoInail).toBe('')
  })
})

describe('buildEsiti — dati incompleti', () => {
  it('segnala i recipienti non classificabili invece di darli per esclusi', () => {
    const scheda = makeScheda({
      serbatoi: [makeSerbatoio({ volume: undefined, ps_pressione_max: undefined })],
    })
    const s1 = riga(buildEsiti(scheda, info), 'S1')
    expect(s1.adempimento).toBe('Dati insufficienti')
    expect(s1.statoInail).toBe('')
  })
})

describe('buildEsiti — risoluzione del costruttore', () => {
  it('applica resolveCostruttore alle marche', () => {
    const rows = buildEsiti(makeScheda(), info, {
      resolveCostruttore: (m) => (m === 'KAESER' ? 'KAESER KOMPRESSOREN SE' : (m ?? '')),
    })
    expect(riga(rows, 'C1').costruttore).toBe('KAESER KOMPRESSOREN SE')
  })
})
