import { describe, it, expect } from 'vitest'
import { applicaFusioneColonne } from '../fusioneCelle'
import { dimensioniGruppi, buildEsiti } from '../engine/esiti'
import { makeScheda, makeAdditionalInfo, makeSerbatoio, makeValvola } from './fixtures'

/** Tabella minima con la stessa forma emessa dal generatore del template. */
function tabella(intestazioni: string[], righe: string[][]): string {
  const cella = (testo: string) =>
    `<w:tc><w:tcPr><w:tcW w:w="1000" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>` +
    `<w:p><w:r><w:t xml:space="preserve">${testo}</w:t></w:r></w:p></w:tc>`
  const riga = (celle: string[]) => `<w:tr><w:trPr><w:cantSplit/></w:trPr>${celle.map(cella).join('')}</w:tr>`
  return (
    `<w:body><w:p><w:r><w:t>prima</w:t></w:r></w:p><w:tbl><w:tblPr/>` +
    riga(intestazioni) +
    righe.map(riga).join('') +
    `</w:tbl><w:p><w:r><w:t>dopo</w:t></w:r></w:p></w:body>`
  )
}

const INTESTAZIONI = ['Pos.', 'Adempimento DM 329/2004', 'Stato INAIL', 'Ver. integr.']

const OPZIONI = {
  ancoraTabella: 'Adempimento DM 329/2004',
  intestazioniColonne: ['Stato INAIL', 'Ver. integr.'],
}

describe('applicaFusioneColonne', () => {
  it('fonde le colonne indicate su un gruppo di più righe', () => {
    const xml = tabella(INTESTAZIONI, [
      ['C1', 'Escluso', 'Già immatricolato', '✓'],
      ['C1.1', 'Verifica', '', ''],
      ['C1.2', 'Verifica', '', ''],
    ])
    const out = applicaFusioneColonne(xml, { ...OPZIONI, dimensioniGruppi: [3] })

    // Una apertura e due continuazioni per ciascuna delle due colonne
    expect(out.match(/<w:vMerge w:val="restart"\/>/g)).toHaveLength(2)
    expect(out.match(/<w:vMerge\/>/g)).toHaveLength(4)
    // Il valore resta nella cella di apertura
    expect(out).toContain('Già immatricolato')
  })

  it('non tocca i gruppi di una sola riga', () => {
    const xml = tabella(INTESTAZIONI, [
      ['C1', 'Escluso', '', ''],
      ['SEP1', 'Non applicabile', '', ''],
    ])
    const out = applicaFusioneColonne(xml, { ...OPZIONI, dimensioniGruppi: [1, 1] })
    expect(out).not.toContain('vMerge')
  })

  it('fonde più gruppi consecutivi in modo indipendente', () => {
    const xml = tabella(INTESTAZIONI, [
      ['S1', 'Verifica', 'Nuova richiesta', ''],
      ['S1.1', 'Verifica', '', ''],
      ['S2', 'Dichiarazione', 'Nuova richiesta', ''],
      ['S2.1', 'Dichiarazione', '', ''],
    ])
    const out = applicaFusioneColonne(xml, { ...OPZIONI, dimensioniGruppi: [2, 2] })
    expect(out.match(/<w:vMerge w:val="restart"\/>/g)).toHaveLength(4)
    expect(out.match(/<w:vMerge\/>/g)).toHaveLength(4)
  })

  it('rispetta l’ordine imposto dallo schema: vMerge dopo tcW, prima di vAlign', () => {
    const xml = tabella(INTESTAZIONI, [
      ['S1', 'Verifica', 'Nuova richiesta', ''],
      ['S1.1', 'Verifica', '', ''],
    ])
    const out = applicaFusioneColonne(xml, { ...OPZIONI, dimensioniGruppi: [2] })
    expect(out).toContain('<w:tcW w:w="1000" w:type="dxa"/><w:vMerge w:val="restart"/><w:vAlign')
  })

  it('svuota il contenuto delle celle di continuazione', () => {
    const xml = tabella(INTESTAZIONI, [
      ['S1', 'Verifica', 'Nuova richiesta', ''],
      ['S1.1', 'Verifica', 'residuo da nascondere', ''],
    ])
    const out = applicaFusioneColonne(xml, { ...OPZIONI, dimensioniGruppi: [2] })
    expect(out).not.toContain('residuo da nascondere')
    // La riga resta identificabile: si svuota solo la cella fusa
    expect(out).toContain('S1.1')
  })

  it('non altera nulla se la tabella non viene trovata', () => {
    const xml = tabella(INTESTAZIONI, [['S1', 'Verifica', '', '']])
    const out = applicaFusioneColonne(xml, {
      ancoraTabella: 'Intestazione inesistente',
      intestazioniColonne: ['Stato INAIL'],
      dimensioniGruppi: [1],
    })
    expect(out).toBe(xml)
  })

  it('non altera nulla se una colonna richiesta non esiste', () => {
    const xml = tabella(INTESTAZIONI, [
      ['S1', 'Verifica', '', ''],
      ['S1.1', 'Verifica', '', ''],
    ])
    const out = applicaFusioneColonne(xml, {
      ...OPZIONI,
      intestazioniColonne: ['Colonna assente'],
      dimensioniGruppi: [2],
    })
    expect(out).toBe(xml)
  })

  it('non altera nulla se il numero di righe non corrisponde ai gruppi', () => {
    // Difesa contro un modello e un template andati fuori sincrono: meglio un documento
    // senza fusioni che uno con celle unite sui confini sbagliati.
    const xml = tabella(INTESTAZIONI, [
      ['S1', 'Verifica', '', ''],
      ['S1.1', 'Verifica', '', ''],
    ])
    const out = applicaFusioneColonne(xml, { ...OPZIONI, dimensioniGruppi: [3] })
    expect(out).toBe(xml)
  })
})

describe('dimensioniGruppi', () => {
  it('conta le righe di ciascun gruppo nell’ordine di tabella', () => {
    // C1 + disoleatore + valvola = 3; S1 + 2 valvole = 3; E1 + scambiatore = 2; F1 = 1
    const scheda = makeScheda({
      serbatoi: [
        makeSerbatoio({
          valvole_aggiuntive: [makeValvola({ n_fabbrica: '2926/3' })],
        }),
      ],
    })
    expect(dimensioniGruppi(buildEsiti(scheda, makeAdditionalInfo()))).toEqual([3, 3, 2, 1])
  })

  it('restituisce un elenco vuoto senza righe', () => {
    expect(dimensioniGruppi([])).toEqual([])
  })
})

describe('buildEsiti — stato di gruppo', () => {
  it('consolida stato INAIL e verifica di integrità sulla prima riga del gruppo', () => {
    const rows = buildEsiti(
      makeScheda(),
      makeAdditionalInfo({ spessimetrica: ['C1.1'] })
    )
    const gruppoC1 = rows.filter((r) => r.gruppo === 'C1')

    // Il valore stava sul disoleatore: risale al capogruppo, dove la fusione lo mostra.
    expect(gruppoC1[0].pos).toBe('C1')
    expect(gruppoC1[0].statoInail).toBe('Nuova richiesta')
    expect(gruppoC1[0].verificaIntegrita).toBe(true)
    expect(gruppoC1.slice(1).every((r) => r.statoInail === '')).toBe(true)
    expect(gruppoC1.slice(1).every((r) => !r.verificaIntegrita)).toBe(true)
  })

  it('riporta la matricola del recipiente sul capogruppo', () => {
    const scheda = makeScheda({
      serbatoi: [
        makeSerbatoio({ gia_denunciato: true, matricola_inail: '2018/7/00046/TV' }),
      ],
    })
    const gruppoS1 = buildEsiti(scheda, makeAdditionalInfo()).filter((r) => r.gruppo === 'S1')
    expect(gruppoS1[0].statoInail).toBe('Già immatricolato n.m. 2018/7/00046/TV')
  })
})
