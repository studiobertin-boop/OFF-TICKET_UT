import { describe, it, expect } from 'vitest'
import {
  completezzaRiga,
  completezzaDatiGenerali,
  completezzaDatiImpianto,
  eCompleta,
  percentuale,
  somma,
} from '../schedaCompleteness'
import { EQUIPMENT_DEFS } from '@/components/technicalSheet/table/equipmentConfig'

/** Riga di targhetta completa, per i campi condivisi da tutti i tipi. */
const targhetta = {
  marca: 'KAESER',
  modello: 'SK 26',
  anno: 2022,
  n_fabbrica: '1782104920',
}

describe('completezzaRiga — il denominatore lo detta il tipo', () => {
  it('non conta PS, capacità, TS e categoria sui filtri, che non li prevedono', () => {
    const c = completezzaRiga(EQUIPMENT_DEFS.filtro, { ...targhetta })
    // marca, modello, anno, n_fabbrica + tipo (default dal motore)
    expect(c.previsti).toBe(5)
    expect(eCompleta(c)).toBe(true)
    expect(percentuale(c)).toBe(100)
  })

  it('non conta TS e categoria sui compressori', () => {
    const c = completezzaRiga(EQUIPMENT_DEFS.compressore, {
      ...targhetta,
      pressione_max: 11,
      volume_aria_prodotto: 2350,
      giri: 'fissi',
    })
    expect(c.mancanti).toEqual([])
    expect(eCompleta(c)).toBe(true)
  })

  it('conta PS, capacità, TS e categoria sui serbatoi', () => {
    const c = completezzaRiga(EQUIPMENT_DEFS.serbatoio, { ...targhetta })
    expect(c.mancanti).toContain('PS')
    expect(c.mancanti).toContain('Capacità')
    expect(c.mancanti).toContain('TS')
    expect(c.mancanti).toContain('Cat. PED')
  })

  it('non conta la categoria delle valvole: è la costante IV, non un campo', () => {
    const c = completezzaRiga(EQUIPMENT_DEFS.valvola, { ...targhetta })
    expect(c.mancanti).not.toContain('Cat. PED')
  })

  it('non conta il diametro delle valvole, che è opzionale', () => {
    const c = completezzaRiga(EQUIPMENT_DEFS.valvola, {
      ...targhetta,
      pressione_taratura: 11,
      volume_aria_scaricato: 2350,
      ts: 100,
    })
    expect(c.mancanti).not.toContain('Diametro')
    expect(eCompleta(c)).toBe(true)
  })
})

describe('completezzaRiga — campi del pannello dettagli', () => {
  it('dà per compilate le spunte: falso è una risposta', () => {
    const c = completezzaRiga(EQUIPMENT_DEFS.compressore, {
      ...targhetta,
      pressione_max: 11,
      volume_aria_prodotto: 2350,
      silenziato: false,
    })
    expect(c.mancanti).not.toContain('Silenziato')
  })

  it('dà per compilati i campi con default del motore', () => {
    const c = completezzaRiga(EQUIPMENT_DEFS.serbatoio, targhetta)
    expect(c.mancanti).not.toContain('Orientamento')
    expect(c.mancanti).not.toContain('Ubicazione')
    expect(c.mancanti).not.toContain('Fluido')
  })

  it('conta i campi senza default finché restano vuoti', () => {
    const c = completezzaRiga(EQUIPMENT_DEFS.serbatoio, targhetta)
    expect(c.mancanti).toContain('Finitura')
    expect(c.mancanti).toContain('Scarico')
    expect(c.mancanti).toContain('Man. fondo scala')
  })

  it('legge i percorsi puntati del manometro', () => {
    const c = completezzaRiga(EQUIPMENT_DEFS.serbatoio, {
      ...targhetta,
      manometro: { fondo_scala: 16, segno_rosso: 11 },
    })
    expect(c.mancanti).not.toContain('Man. fondo scala')
    expect(c.mancanti).not.toContain('Man. segno rosso')
  })

  it('esclude le note, che sono un commento e non un dato', () => {
    const c = completezzaRiga(EQUIPMENT_DEFS.compressore, targhetta)
    expect(c.mancanti).not.toContain('Note')
  })

  it('conta i giri: il catalogo li propone ma la scheda può correggerli', () => {
    expect(completezzaRiga(EQUIPMENT_DEFS.compressore, targhetta).mancanti).toContain('Giri')
    expect(
      completezzaRiga(EQUIPMENT_DEFS.compressore, { ...targhetta, giri: 'fissi' }).mancanti
    ).not.toContain('Giri')
  })

  it('prevede «quale fluido» solo a fluido ALTRO', () => {
    const senza = completezzaRiga(EQUIPMENT_DEFS.serbatoio, targhetta)
    expect(senza.mancanti).not.toContain('Quale fluido')

    const con = completezzaRiga(EQUIPMENT_DEFS.serbatoio, { ...targhetta, fluido: 'ALTRO' })
    expect(con.mancanti).toContain('Quale fluido')
  })

  it('prevede la matricola INAIL solo a denuncia spuntata', () => {
    const senza = completezzaRiga(EQUIPMENT_DEFS.serbatoio, targhetta)
    expect(senza.mancanti).not.toContain('Matr. INAIL')

    const con = completezzaRiga(EQUIPMENT_DEFS.serbatoio, { ...targhetta, gia_denunciato: true })
    expect(con.mancanti).toContain('Matr. INAIL')
  })

  it('accetta lo zero come valore e scarta NaN', () => {
    const zero = completezzaRiga(EQUIPMENT_DEFS.serbatoio, {
      ...targhetta,
      manometro: { fondo_scala: 0 },
    })
    expect(zero.mancanti).not.toContain('Man. fondo scala')

    const nan = completezzaRiga(EQUIPMENT_DEFS.serbatoio, { ...targhetta, anno: Number.NaN })
    expect(nan.mancanti).toContain('Anno')
  })

  it('regge una riga appena creata, tutta vuota', () => {
    const c = completezzaRiga(EQUIPMENT_DEFS.serbatoio, undefined)
    // Restano compilati i soli campi che non richiedono un gesto: le tre scelte con
    // default del motore e le due spunte.
    expect(c.compilati).toBe(5)
    expect(c.mancanti).toContain('Marca')
    expect(eCompleta(c)).toBe(false)
  })
})

describe('completezza del contesto', () => {
  it('conta i quattro campi del sopralluogo, non le note generali', () => {
    const c = completezzaDatiGenerali({
      data_sopralluogo: '2026-07-01',
      nome_tecnico: 'Frank',
      cliente: '002 test',
      installatore: 'OFFICINA DEL COMPRESSORE S.R.L.',
    })
    expect(c.previsti).toBe(4)
    expect(eCompleta(c)).toBe(true)
  })

  it('non chiede «locale condiviso con» quando il locale è dedicato', () => {
    const dedicato = completezzaDatiImpianto({ locale_dedicato: true })
    expect(dedicato.mancanti).not.toContain('Locale condiviso con')

    const condiviso = completezzaDatiImpianto({ locale_dedicato: false })
    expect(condiviso.mancanti).toContain('Locale condiviso con')
  })

  it('non chiede le fonti di calore vicine quando entrambe le distanze sono dichiarate', () => {
    const lontano = completezzaDatiImpianto({
      lontano_fonti_calore: true,
      lontano_materiale_infiammabile: true,
    })
    expect(lontano.mancanti).not.toContain('Fonti di calore o materiali infiammabili vicini')

    const vicino = completezzaDatiImpianto({ lontano_fonti_calore: true })
    expect(vicino.mancanti).toContain('Fonti di calore o materiali infiammabili vicini')
  })

  it('arriva a 100 su una sala compilata', () => {
    const c = completezzaDatiImpianto({
      aria_aspirata: ['Pulita'],
      raccolta_condense: 'separatore',
      locale_dedicato: true,
      lontano_fonti_calore: true,
      lontano_materiale_infiammabile: true,
      dn_sala_min: 20,
      dn_sala_max: 25,
      dn_distribuzione_min: 20,
      dn_distribuzione_max: 50,
    })
    expect(percentuale(c)).toBe(100)
  })
})

describe('aggregazione', () => {
  it('somma i conteggi e concatena i mancanti', () => {
    const c = somma([
      { compilati: 3, previsti: 4, mancanti: ['Anno'] },
      { compilati: 2, previsti: 2, mancanti: [] },
    ])
    expect(c).toEqual({ compilati: 5, previsti: 6, mancanti: ['Anno'] })
  })

  it('considera completa una sezione senza campi previsti', () => {
    expect(percentuale({ compilati: 0, previsti: 0, mancanti: [] })).toBe(100)
    expect(eCompleta({ compilati: 0, previsti: 0, mancanti: [] })).toBe(true)
  })
})
