import { describe, test, expect } from 'vitest'
import PizZip from 'pizzip'
import { renderRelazioneDocx } from '../renderRelazione'
import { buildRelazioneModel } from '../buildRelazioneModel'
import {
  makeScheda,
  makeCustomer,
  makeAdditionalInfo,
  makeCompressore,
  makePratica,
} from './fixtures'

/** Costruisce un .docx minimo valido con il body XML fornito. */
function makeTemplateDocx(bodyXml: string): Uint8Array {
  const zip = new PizZip()
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
  )
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  )
  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${bodyXml}</w:body></w:document>`
  )
  return zip.generate({ type: 'uint8array' })
}

function outputXml(bytes: Uint8Array): string {
  return new PizZip(bytes).file('word/document.xml')!.asText()
}

describe('renderRelazioneDocx', () => {
  test('sostituisce i placeholder semplici', () => {
    const p = (tag: string) => `<w:p><w:r><w:t>${tag}</w:t></w:r></w:p>`
    const template = makeTemplateDocx(p('{premessa.ragioneSociale}'))
    const model = buildRelazioneModel({
      scheda: makeScheda(),
      additionalInfo: makeAdditionalInfo(),
      customer: makeCustomer({ ragione_sociale: 'ACME S.r.l.' }),
      pratica: makePratica(),
    })

    const xml = outputXml(renderRelazioneDocx(template, model))
    expect(xml).toContain('ACME S.r.l.')
  })

  test('espande i loop di tabella e i mark di spunta', () => {
    const body =
      `<w:p><w:r><w:t>{#caratteristiche}[{pos}]{/caratteristiche}</w:t></w:r></w:p>` +
      `<w:p><w:r><w:t>{#esiti}{pos}={verificaIntegritaMark};{/esiti}</w:t></w:r></w:p>`
    const template = makeTemplateDocx(body)
    const model = buildRelazioneModel({
      scheda: makeScheda({
        compressori: [makeCompressore({ codice: 'C1', ha_disoleatore: false })],
        disoleatori: [],
        serbatoi: [],
        essiccatori: [],
        scambiatori: [],
        filtri: [],
      }),
      additionalInfo: makeAdditionalInfo(),
      customer: makeCustomer(),
      pratica: makePratica(),
    })

    const xml = outputXml(renderRelazioneDocx(template, model))
    expect(xml).toContain('[C1]')
    // Compressore senza recipiente: la verifica di integrità non è pertinente, e la cella
    // lo dice invece di restare vuota.
    expect(xml).toContain('C1=–;')
  })

  test('le sezioni inverse scelgono una sola variante della frase sui fluidi', () => {
    const body =
      `<w:p><w:r><w:t>{#fluidi.evidenziaNocive}EVIDENZIATA{/fluidi.evidenziaNocive}</w:t></w:r></w:p>` +
      `<w:p><w:r><w:t>{^fluidi.evidenziaNocive}PIANA{/fluidi.evidenziaNocive}</w:t></w:r></w:p>`
    const template = makeTemplateDocx(body)

    const render = (aria: 'Pulita' | 'Acidi') =>
      outputXml(
        renderRelazioneDocx(
          template,
          buildRelazioneModel({
            scheda: makeScheda({
              dati_impianto: {
                sede_imp_uguale_legale: true,
                sede_impianto: '',
                indirizzo_impianto: '',
                raccolta_condense: 'tanica',
                aria_aspirata: [aria],
              },
            }),
            additionalInfo: makeAdditionalInfo(),
            customer: makeCustomer(),
            pratica: makePratica(),
          })
        )
      )

    const pulita = render('Pulita')
    expect(pulita).toContain('PIANA')
    expect(pulita).not.toContain('EVIDENZIATA')

    const acidi = render('Acidi')
    expect(acidi).toContain('EVIDENZIATA')
    expect(acidi).not.toContain('PIANA')
  })
})

describe('§5.3 — blocco "Altre apparecchiature soggette"', () => {
  const p = (t: string) => `<w:p><w:r><w:t>${t}</w:t></w:r></w:p>`
  const blocco =
    p('{#protezioni.haAltre}') +
    p('Altre apparecchiature soggette al D.M. 329/2004:') +
    p('{/protezioni.haAltre}')

  const rendi = (scheda: Parameters<typeof buildRelazioneModel>[0]['scheda']) =>
    outputXml(
      renderRelazioneDocx(
        makeTemplateDocx(blocco),
        buildRelazioneModel({
          scheda,
          additionalInfo: makeAdditionalInfo(),
          customer: makeCustomer(),
          pratica: makePratica(),
        })
      )
    )

  test('scompare quando non ci sono altre apparecchiature soggette', () => {
    const scheda = makeScheda({
      compressori: [makeCompressore({ codice: 'C1', ha_disoleatore: false })],
      disoleatori: [],
      scambiatori: [],
      recipienti_filtro: [],
    })
    expect(rendi(scheda)).not.toContain('Altre apparecchiature soggette')
  })

  test('compare quando ce ne sono', () => {
    expect(rendi(makeScheda())).toContain('Altre apparecchiature soggette')
  })
})
