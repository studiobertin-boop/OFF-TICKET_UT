import { describe, it, expect } from 'vitest'
import {
  CAMPO_STATO_SCHEDA, compilazioneScheda, compilazioneDiPratica, ordineCompilazione,
  schedaDi, statoDesunto, statoManuale,
} from '../schedaStato'
import { EQUIPMENT_DEFS, nuovaRiga } from '@/components/technicalSheet/table/equipmentConfig'

/** Contesto compilato per intero: quattro campi di sopralluogo e dieci di sala. */
const CONTESTO_PIENO = {
  dati_generali: {
    data_sopralluogo: '2026-03-02',
    nome_tecnico: 'M. Rossi',
    cliente: 'ACME',
    installatore: 'Installatore SRL',
  },
  dati_impianto: {
    aria_aspirata: 'Dall’esterno',
    raccolta_condense: 'Separatore',
    locale_dedicato: true,
    accesso_locale_vietato: true,
    lontano_fonti_calore: true,
    lontano_materiale_infiammabile: true,
    dn_sala_min: 20,
    dn_sala_max: 50,
    dn_distribuzione_min: 20,
    dn_distribuzione_max: 50,
  },
}

describe('statoDesunto', () => {
  it('dice vuota una scheda che non esiste o su cui nessuno ha scritto', () => {
    expect(statoDesunto(null)).toEqual({ stato: 'vuota', percentuale: 0 })
    expect(statoDesunto({})).toEqual({ stato: 'vuota', percentuale: 0 })
    // Le spunte della sala risultano compilate anche a falso: non bastano a dire «cominciata».
    expect(statoDesunto({ dati_generali: {}, dati_impianto: {}, serbatoi: [] }))
      .toEqual({ stato: 'vuota', percentuale: 0 })
  })

  it('dice parziale una scheda con una sola apparecchiatura da compilare', () => {
    const scheda = { filtri: [nuovaRiga(EQUIPMENT_DEFS.filtro, 'F1')] }
    const { stato, percentuale } = statoDesunto(scheda)
    expect(stato).toBe('parziale')
    expect(percentuale).toBeGreaterThanOrEqual(1)
    expect(percentuale).toBeLessThanOrEqual(99)
  })

  it('dice completa una scheda in cui ogni campo previsto è compilato', () => {
    expect(statoDesunto(CONTESTO_PIENO)).toEqual({ stato: 'completa', percentuale: 100 })
  })

  it('torna parziale quando si aggiunge un’apparecchiatura a una scheda completa', () => {
    const conFiltro = { ...CONTESTO_PIENO, filtri: [nuovaRiga(EQUIPMENT_DEFS.filtro, 'F1')] }
    expect(statoDesunto(conFiltro).stato).toBe('parziale')
  })

  it('non mostra mai 0 o 100 su una scheda che è in mezzo', () => {
    const quasi = {
      ...CONTESTO_PIENO,
      dati_generali: { ...CONTESTO_PIENO.dati_generali, installatore: '' },
    }
    const { stato, percentuale } = statoDesunto(quasi)
    expect(stato).toBe('parziale')
    expect(percentuale).toBe(93)
  })
})

describe('statoManuale', () => {
  it('accetta i tre stati previsti e ignora il resto', () => {
    expect(statoManuale({ [CAMPO_STATO_SCHEDA]: 'completa' })).toBe('completa')
    expect(statoManuale({ [CAMPO_STATO_SCHEDA]: null })).toBeNull()
    expect(statoManuale({ [CAMPO_STATO_SCHEDA]: 'boh' })).toBeNull()
    expect(statoManuale(undefined)).toBeNull()
  })
})

describe('compilazioneScheda', () => {
  it('lo stato imposto vince, ma la percentuale resta quella reale', () => {
    const c = compilazioneScheda({}, { [CAMPO_STATO_SCHEDA]: 'completa' })
    expect(c).toEqual({ stato: 'completa', percentuale: 0, manuale: true })
  })

  it('senza imposizione riporta lo stato desunto', () => {
    expect(compilazioneScheda(CONTESTO_PIENO, {}))
      .toEqual({ stato: 'completa', percentuale: 100, manuale: false })
  })
})

describe('scheda agganciata alla pratica', () => {
  it('legge la scheda sia come oggetto sia come elenco', () => {
    expect(schedaDi({ technical_data: { equipment_data: CONTESTO_PIENO } })).toEqual(CONTESTO_PIENO)
    expect(schedaDi({ technical_data: [{ equipment_data: CONTESTO_PIENO }] })).toEqual(CONTESTO_PIENO)
    expect(schedaDi({ technical_data: null })).toBeNull()
    expect(schedaDi({})).toBeNull()
  })

  it('una pratica senza scheda leggibile risulta vuota', () => {
    expect(compilazioneDiPratica({ technical_data: null, custom_fields: {} }))
      .toEqual({ stato: 'vuota', percentuale: 0, manuale: false })
  })
})

describe('ordineCompilazione', () => {
  it('mette in fila le schede per quanto sono avanti', () => {
    const chiavi = [
      ordineCompilazione({ stato: 'vuota', percentuale: 0, manuale: false }),
      ordineCompilazione({ stato: 'parziale', percentuale: 40, manuale: false }),
      ordineCompilazione({ stato: 'completa', percentuale: 100, manuale: false }),
    ]
    expect(chiavi).toEqual([0, 40, 100])
  })

  it('lo stato imposto conta più della percentuale reale', () => {
    expect(ordineCompilazione({ stato: 'completa', percentuale: 20, manuale: true })).toBe(100)
  })
})
