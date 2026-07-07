import { describe, test, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import PizZip from 'pizzip'
import { renderRelazioneDocx } from '../renderRelazione'
import { buildRelazioneModel } from '../buildRelazioneModel'
import { makeScheda, makeCustomer, makeAdditionalInfo, makeCompressore } from './fixtures'

const TEMPLATE_PATH = resolve(process.cwd(), 'public/templates/relazione-dm329.docx')

describe('integrazione template ↔ engine', () => {
  test('il template generato renderizza senza errori e sostituisce i tag', () => {
    expect(existsSync(TEMPLATE_PATH), 'template .docx mancante: esegui scripts/generate-relazione-template.ts').toBe(true)

    const template = readFileSync(TEMPLATE_PATH)
    const model = buildRelazioneModel({
      scheda: makeScheda({
        compressori: [makeCompressore({ codice: 'C1', ha_disoleatore: false })],
        disoleatori: [],
      }),
      additionalInfo: makeAdditionalInfo({ motivoRevisione: 'sostituzione valvole', spessimetrica: ['S1'] }),
      customer: makeCustomer({ ragione_sociale: 'ACME S.r.l.' }),
    })

    const out = renderRelazioneDocx(template, model)
    const xml = new PizZip(out).file('word/document.xml')!.asText()

    // Sostituzioni avvenute
    expect(xml).toContain('ACME S.r.l.')
    expect(xml).toContain('C1') // riga tabella caratteristiche/procedura
    expect(xml).toContain('sostituzione valvole') // blocco revisione attivo

    // Nessun tag docxtemplater rimasto non sostituito
    expect(xml).not.toContain('{premessa')
    expect(xml).not.toContain('{#')
    expect(xml).not.toContain('{/')
    expect(xml).not.toContain('{classificazione')
  })
})
