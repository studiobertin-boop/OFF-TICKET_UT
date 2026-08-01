import { describe, test, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import PizZip from 'pizzip'
import { renderRelazioneDocx } from '../renderRelazione'
import { buildRelazioneModel } from '../buildRelazioneModel'
import { dimensioniGruppi } from '../engine/esiti'
import {
  makeScheda,
  makeCustomer,
  makeAdditionalInfo,
  makeCompressore,
  makePratica,
} from './fixtures'
import { attendiXmlValido } from './xmlBenFormato'

const TEMPLATE_PATH = resolve(process.cwd(), 'public/templates/relazione-dm329.docx')

describe('integrazione template ↔ engine', () => {
  test('il template generato renderizza senza errori e sostituisce i tag', () => {
    expect(
      existsSync(TEMPLATE_PATH),
      'template .docx mancante in public/templates/ (vedi TEMPLATE_TAGS.md)'
    ).toBe(true)

    const template = readFileSync(TEMPLATE_PATH)
    const model = buildRelazioneModel({
      scheda: makeScheda({
        compressori: [makeCompressore({ codice: 'C1', ha_disoleatore: false })],
        disoleatori: [],
      }),
      additionalInfo: makeAdditionalInfo({ spessimetrica: ['S1'] }),
      customer: makeCustomer({ ragione_sociale: 'ACME S.r.l.' }),
      pratica: makePratica({ progressivo: 1 }),
    })

    const out = renderRelazioneDocx(template, model)
    const xml = new PizZip(out).file('word/document.xml')!.asText()

    // Prima di ogni asserzione sul contenuto: un documento che Word non apre non è
    // un documento. Cercare stringhe dentro un XML rotto passa comunque.
    attendiXmlValido(xml)

    // Sostituzioni avvenute
    expect(xml).toContain('ACME S.r.l.')
    expect(xml).toContain('C1')
    // Blocco revisione attivo (progressivo 1) con segnaposto da compilare in Word
    expect(xml).toContain('descrivere le motivazioni della revisione')

    // Contenuto delle sezioni nuove
    expect(xml).toContain('Sezione di pompaggio') // §2.1 elenco sezioni
    expect(xml).toContain('Ubicazione impianto') // §2.2 condizioni
    expect(xml).toContain('Aria compressa') // §3 fluidi
    expect(xml).toContain('Verifica e dichiarazione di messa in servizio') // §5.2 esiti
    expect(xml).toContain('art. 1 comma 3 lettera L') // §5.2 esclusione compressore
    expect(xml).toContain('ogni 3 anni') // §7.2 scadenze

    // Riferimenti normativi corretti
    expect(xml).toContain('2014/68/UE')
    expect(xml).toContain('2014/29/UE')
    expect(xml).not.toContain('68/2014/UE')

    // Nessun tag docxtemplater rimasto non sostituito, incluse le sezioni inverse
    expect(xml).not.toContain('{premessa')
    expect(xml).not.toContain('{#')
    expect(xml).not.toContain('{/')
    expect(xml).not.toContain('{^')

    // Nessun markup finito come testo letterale: succede passando XML di paragrafo
    // dove il generatore del template si aspetta testo semplice, e nel documento si
    // vede il tag anziché il contenuto.
    expect(xml).not.toContain('&lt;w:')
  })

  test('le colonne di gruppo risultano fuse nella tabella degli esiti', () => {
    const template = readFileSync(TEMPLATE_PATH)
    const model = buildRelazioneModel({
      scheda: makeScheda(),
      additionalInfo: makeAdditionalInfo({ spessimetrica: ['S1'] }),
      customer: makeCustomer(),
      pratica: makePratica(),
    })

    const xml = new PizZip(renderRelazioneDocx(template, model))
      .file('word/document.xml')!
      .asText()

    // La fusione inietta vMerge nelle proprietà di cella: se l'iniezione sbaglia punto,
    // l'XML si rompe e il documento non si apre più. Va verificato, non solo cercato.
    attendiXmlValido(xml)

    // La fusione è una post-elaborazione dell'XML renderizzato: se il template cambia
    // struttura (colonne rinominate o riordinate) `applicaFusioneColonne` non trova più
    // gli appigli e restituisce l'XML invariato. Questo test è ciò che lo rende evidente.
    const gruppiMultiRiga = dimensioniGruppi(model.esiti).filter((n) => n > 1).length
    expect(gruppiMultiRiga).toBeGreaterThan(0)
    expect(xml.match(/<w:vMerge w:val="restart"\/>/g) ?? []).toHaveLength(gruppiMultiRiga * 2)

    // Il documento deve restare un OOXML valido dopo la manipolazione.
    expect(() => new DOMParser().parseFromString(xml, 'application/xml')).not.toThrow()
    const doc = new DOMParser().parseFromString(xml, 'application/xml')
    expect(doc.getElementsByTagName('parsererror')).toHaveLength(0)
  })
})
