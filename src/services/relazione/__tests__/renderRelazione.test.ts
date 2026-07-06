import { describe, test, expect } from 'vitest'
import PizZip from 'pizzip'
import { renderRelazioneDocx } from '../renderRelazione'
import { buildRelazioneModel } from '../buildRelazioneModel'
import { makeScheda, makeCustomer, makeAdditionalInfo, makeCompressore } from './fixtures'

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
    })

    const xml = outputXml(renderRelazioneDocx(template, model))
    expect(xml).toContain('ACME S.r.l.')
  })

  test('espande i loop di tabella (caratteristiche) e i flag Adeguato/Verifica', () => {
    const body =
      `<w:p><w:r><w:t>{#caratteristiche}[{pos}]{/caratteristiche}</w:t></w:r></w:p>` +
      `<w:p><w:r><w:t>{#procedura}{pos}={verificaMark};{/procedura}</w:t></w:r></w:p>`
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
    })

    const xml = outputXml(renderRelazioneDocx(template, model))
    expect(xml).toContain('[C1]')
    expect(xml).toContain('C1=;') // compressore senza disoleatore → verificaMark vuoto
  })
})
