import { describe, test, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import PizZip from 'pizzip'
import { renderRelazioneDocx, dimensioniSchema } from '../renderRelazione'
import { buildRelazioneModel } from '../buildRelazioneModel'
import { makeScheda, makeCustomer, makeAdditionalInfo, makePratica } from './fixtures'
import { attendiXmlValido } from './xmlBenFormato'
import type { SchemaImpianto } from '../types'

const TEMPLATE_PATH = resolve(process.cwd(), 'public/templates/relazione-dm329.docx')

/**
 * PNG 1×1 valido. I pixel non contano: il modulo immagini incorpora i byte così come
 * sono e prende le dimensioni di stampa da `getSize`, non dall'intestazione del file.
 */
const PNG_1X1 = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
  ),
  (c) => c.charCodeAt(0)
)

const schema = (over: Partial<SchemaImpianto> = {}): SchemaImpianto => ({
  dati: PNG_1X1,
  larghezzaPx: 1600,
  altezzaPx: 900,
  nomeFile: 'schema.png',
  ...over,
})

const modello = (schemaImpianto?: SchemaImpianto) =>
  buildRelazioneModel({
    scheda: makeScheda(),
    additionalInfo: makeAdditionalInfo(),
    customer: makeCustomer(),
    pratica: makePratica(),
    schemaImpianto,
  })

describe('dimensioni di stampa dello schema', () => {
  test('larghezza fissa e altezza proporzionale', () => {
    expect(dimensioniSchema(schema({ larghezzaPx: 1600, altezzaPx: 900 }))).toEqual([640, 360])
    // Sorgenti a risoluzione diversa ma stesse proporzioni rendono identiche: è lo scopo
    // della larghezza fissa.
    expect(dimensioniSchema(schema({ larghezzaPx: 800, altezzaPx: 450 }))).toEqual([640, 360])
  })

  test('un formato ritratto viene ridotto per non sfondare la pagina', () => {
    const [larghezza, altezza] = dimensioniSchema(schema({ larghezzaPx: 1000, altezzaPx: 3000 }))
    expect(altezza).toBe(900)
    // La larghezza cede solo qui, e le proporzioni restano intatte.
    expect(larghezza).toBe(300)
  })

  test('senza dimensioni note ripiega su 4:3 invece di dividere per zero', () => {
    expect(dimensioniSchema(schema({ larghezzaPx: 0, altezzaPx: 0 }))).toEqual([640, 480])
  })
})

describe('incorporamento dello schema nel documento', () => {
  test('con schema: immagine nel pacchetto e riferimento nel documento', () => {
    const out = renderRelazioneDocx(readFileSync(TEMPLATE_PATH), modello(schema()))
    const zip = new PizZip(out)

    const media = Object.keys(zip.files).filter((f) => f.startsWith('word/media/'))
    expect(media).toHaveLength(1)

    const xml = zip.file('word/document.xml')!.asText()
    // I prefissi del disegno (wp:, a:, pic:) devono risultare dichiarati: è il controllo
    // che mancava quando il documento con immagine non si apriva in Word.
    attendiXmlValido(xml)
    expect(xml).toContain('<a:blip r:embed=')
    // 640×360 px in EMU (9525 EMU per pixel).
    expect(xml).toContain(`cx="${640 * 9525}"`)
    expect(xml).toContain(`cy="${360 * 9525}"`)
    // Il segnaposto letterale della fase precedente non deve riaffiorare.
    expect(xml).not.toContain('{%schemaImpianto}')
  })

  test('senza schema: nessuna immagine e nessun tag residuo', () => {
    const out = renderRelazioneDocx(readFileSync(TEMPLATE_PATH), modello(undefined))
    const zip = new PizZip(out)

    expect(Object.keys(zip.files).filter((f) => f.startsWith('word/media/'))).toHaveLength(0)

    const xml = zip.file('word/document.xml')!.asText()
    attendiXmlValido(xml)
    expect(xml).not.toContain('<a:blip')
    expect(xml).not.toContain('{%schemaImpianto}')
    // Lo schema assente è uno stato normale, non un errore: il resto del documento c'è.
    expect(xml).toContain('Schema d’impianto')
  })
})
