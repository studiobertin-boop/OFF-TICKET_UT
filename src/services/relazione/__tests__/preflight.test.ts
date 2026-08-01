import { describe, test, expect } from 'vitest'
import { validateRelazione, haErrori } from '../preflight'
import { buildRelazioneModel } from '../buildRelazioneModel'
import type { BuildRelazioneInput } from '../buildRelazioneModel'
import {
  makeScheda,
  makeCustomer,
  makeAdditionalInfo,
  makeDatiImpianto,
  makeSerbatoio,
  makeValvola,
  makePratica,
} from './fixtures'

/** Modello di partenza: scheda completa e collegamento compressore→serbatoio dichiarato. */
const modello = (over: Partial<BuildRelazioneInput> = {}) =>
  buildRelazioneModel({
    scheda: makeScheda(),
    additionalInfo: makeAdditionalInfo({ collegamentiCompressoriSerbatoi: { C1: ['S1'] } }),
    customer: makeCustomer(),
    pratica: makePratica(),
    ...over,
  })

const codici = (over: Partial<BuildRelazioneInput> = {}) =>
  validateRelazione(modello(over)).map((s) => s.codice)

const trova = (over: Partial<BuildRelazioneInput>, codice: string) =>
  validateRelazione(modello(over)).find((s) => s.codice === codice)

describe('preflight — impianto completo', () => {
  test('nessun errore quando i dati ci sono tutti', () => {
    const segnalazioni = validateRelazione(modello())
    expect(haErrori(segnalazioni)).toBe(false)
  })

  test('restano gli avvisi su ciò che non è un dato mancante', () => {
    // Lo schema non è persistito: la sua assenza è uno stato normale, non un errore.
    expect(codici()).toContain('schema-assente')
    // I DN non dichiarati non bloccano, ma la frase di esclusione non è verificata.
    expect(codici()).toContain('tubazioni-dn-non-dichiarati')
  })
})

describe('preflight — anagrafica e pratica', () => {
  test('descrizione attività mancante è un errore', () => {
    const over = {
      customer: makeCustomer({ descrizione_attivita: null }),
      additionalInfo: makeAdditionalInfo({
        descrizioneAttivita: '',
        collegamentiCompressoriSerbatoi: { C1: ['S1'] },
      }),
    }
    expect(codici(over)).toContain('cliente-descrizione-attivita')
    expect(haErrori(validateRelazione(modello(over)))).toBe(true)
  })

  test('sede legale vuota è un errore, non una stringa di sola punteggiatura', () => {
    const customer = makeCustomer({ via: '', numero_civico: '', cap: '', comune: '', provincia: '' })
    expect(codici({ customer })).toContain('cliente-sede-legale')
  })

  test('ubicazione non dichiarata è un avviso, perché la relazione ripiega sulla sede legale', () => {
    const pratica = makePratica({ impiantoUgualeSedeLegale: false, indirizzoImpianto: null })
    const s = trova({ pratica }, 'ubicazione-non-dichiarata')
    expect(s?.livello).toBe('avviso')
    // Dichiararla esplicitamente non produce segnalazioni.
    expect(codici({ pratica: makePratica({ indirizzoImpianto: 'Via Prova 1, Treviso' }) })).not.toContain(
      'ubicazione-non-dichiarata'
    )
  })
})

describe('preflight — apparecchiature', () => {
  test('recipiente senza volume e PS non è classificabile', () => {
    const scheda = makeScheda({
      serbatoi: [makeSerbatoio({ volume: undefined, ps_pressione_max: undefined })],
    })
    const s = trova({ scheda }, 'recipiente-dati-insufficienti')
    expect(s?.livello).toBe('errore')
    expect(s?.posizioni).toEqual(['S1'])
  })

  test('la valvola del recipiente incompleto non viene segnalata a sua volta', () => {
    const scheda = makeScheda({
      serbatoi: [makeSerbatoio({ volume: undefined, ps_pressione_max: undefined })],
    })
    // S1.1 eredita l'etichetta «Dati insufficienti» dal recipiente, ma non è un
    // recipiente: segnalarla raddoppierebbe il rumore senza aggiungere informazione.
    expect(trova({ scheda }, 'recipiente-dati-insufficienti')?.posizioni).not.toContain('S1.1')
  })

  test('scheda senza apparecchiature', () => {
    const scheda = makeScheda({
      serbatoi: [], compressori: [], disoleatori: [], essiccatori: [], scambiatori: [], filtri: [],
    })
    expect(codici({ scheda })).toContain('nessuna-apparecchiatura')
  })

  test('categoria PED assente su un recipiente soggetto', () => {
    // Costruita a mano: con PS e volume validi `calculateCategoriaPED` restituisce
    // sempre una categoria, quindi l'engine oggi non può produrre questo caso.
    // Il controllo resta a presidio dell'invariante.
    const m = modello()
    const soggetto = m.esiti.find((r) => r.esito === 'VERIFICA' || r.esito === 'DICHIARAZIONE')!
    soggetto.categoria = ''
    const s = validateRelazione(m).find((x) => x.codice === 'categoria-ped-mancante')
    expect(s?.posizioni).toEqual([soggetto.pos])
  })
})

describe('preflight — valvole di sicurezza', () => {
  test('valvola che scarica meno dei compressori collegati', () => {
    const scheda = makeScheda({
      serbatoi: [
        makeSerbatoio({
          valvola_sicurezza: makeValvola({ pressione_taratura: 10.8, volume_aria_scaricato: 100 }),
        }),
      ],
    })
    const s = trova({ scheda }, 'valvola-portata-insufficiente')
    expect(s?.livello).toBe('errore')
    expect(s?.posizioni).toEqual(['S1.1'])
  })

  test('valvola tarata sopra la PS del recipiente', () => {
    const scheda = makeScheda({
      serbatoi: [
        makeSerbatoio({
          ps_pressione_max: 11.5,
          valvola_sicurezza: makeValvola({ pressione_taratura: 14, volume_aria_scaricato: 32142 }),
        }),
      ],
    })
    const s = trova({ scheda }, 'valvola-taratura-superiore')
    expect(s?.posizioni).toEqual(['S1.1'])
  })

  test('dati mancanti: la valvola non passa la verifica, la segnala come non determinabile', () => {
    const scheda = makeScheda({
      serbatoi: [
        makeSerbatoio({
          valvola_sicurezza: makeValvola({
            pressione_taratura: undefined,
            volume_aria_scaricato: undefined,
          }),
        }),
      ],
    })
    const m = modello({ scheda })

    // Il confronto 0 ≤ 0 dichiarava adeguata una valvola di cui non si sa nulla.
    expect(m.valvole.pressione.find((r) => r.posValvola === 'S1.1')?.adeguato).toBe(false)
    expect(m.valvole.portata.find((r) => r.posValvola === 'S1.1')?.adeguato).toBe(false)

    const segnalazioni = validateRelazione(m).map((s) => s.codice)
    expect(segnalazioni).toContain('valvola-dati-mancanti')
    // Nessuna verifica è stata eseguita, quindi nessuna può risultare non superata.
    expect(segnalazioni).not.toContain('valvola-taratura-superiore')
    expect(segnalazioni).not.toContain('valvola-portata-insufficiente')
  })

  test('valvola senza compressori collegati: avviso, non errore', () => {
    // Additional info di default: nessun collegamento dichiarato.
    const s = validateRelazione(
      buildRelazioneModel({
        scheda: makeScheda(),
        additionalInfo: makeAdditionalInfo(),
        customer: makeCustomer(),
        pratica: makePratica(),
      })
    ).find((x) => x.codice === 'valvola-senza-compressori')
    expect(s?.livello).toBe('avviso')
    expect(s?.posizioni).toEqual(['S1.1'])
  })
})

describe('preflight — tubazioni e documento', () => {
  test('DN oltre 80 mm richiama la denuncia PED', () => {
    const scheda = makeScheda({
      dati_impianto: makeDatiImpianto({ dn_sala_max: 100, dn_distribuzione_max: 50 }),
    })
    const s = trova({ scheda }, 'tubazioni-oltre-soglia')
    expect(s?.livello).toBe('avviso')
    expect(s?.messaggio).toContain('DN 100')
  })

  test('DN entro soglia: nessuna segnalazione sulle tubazioni', () => {
    const scheda = makeScheda({
      dati_impianto: makeDatiImpianto({ dn_sala_max: 50, dn_distribuzione_max: 80 }),
    })
    expect(codici({ scheda })).not.toContain('tubazioni-oltre-soglia')
    expect(codici({ scheda })).not.toContain('tubazioni-dn-non-dichiarati')
  })

  test('con lo schema scelto sparisce l’avviso', () => {
    const schemaImpianto = {
      dati: new Uint8Array([1, 2, 3]),
      larghezzaPx: 800,
      altezzaPx: 600,
    }
    expect(codici({ schemaImpianto })).not.toContain('schema-assente')
  })
})
