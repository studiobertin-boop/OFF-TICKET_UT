import { describe, test, expect } from 'vitest'
import { PDFDocument, StandardFonts, PDFName, PDFDict } from 'pdf-lib'
import type { Pagina } from '../impagina'
import { disegnaDichiarazioneInstallatore, dimensioneAdattata, spezzaRighe, type DatiDichiarazioneInstallatore } from '../disegna'

/** PNG 1×1 minimo valido: basta a testare l'incorporazione, non serve un timbro vero. */
const PNG_1X1 = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='),
  (c) => c.charCodeAt(0)
)

/** Numero di immagini incorporate come risorse XObject della pagina. */
const numeroImmagini = (pagina: ReturnType<PDFDocument['getPage']>): number => {
  const risorse = pagina.node.Resources()
  const xobject = risorse?.lookupMaybe(PDFName.of('XObject'), PDFDict)
  return xobject ? xobject.keys().length : 0
}

const A4 = { larghezza: 595.28, altezza: 841.89 }

const templateDiProva = async (): Promise<Uint8Array> => {
  const doc = await PDFDocument.create()
  // Una pagina senza flusso di contenuto non è incorporabile da pdf-lib: ci vuole qualcosa
  // di disegnato, come nei fixture di prova di pdfCompose/componiPdf.test.ts.
  doc.addPage([A4.larghezza, A4.altezza]).drawRectangle({ x: 0, y: 0, width: 10, height: 10 })
  return doc.save()
}

const gruppo = (n: string) => ({
  principale: { tipo: 'Compressore', marca: 'KAESER', modello: 'CSD 102 SFC', n_fabbrica: '100259.0/1397' },
  dipendente: { tipo: 'Serbatoio disoleatore', marca: 'AIR COM', modello: '25GK1', n_fabbrica: n },
  codiceOrdinamento: n,
})

const dati: DatiDichiarazioneInstallatore = {
  installer: {
    nome: 'OFFICINA DEL COMPRESSORE S.R.L.',
    legale_rappresentante: 'Mario Rossi',
    legale_rappresentante_nascita_luogo: 'Treviso',
    legale_rappresentante_nascita_data: '01.01.1970',
    legale_rappresentante_residenza_via: 'via di prova nr. 1',
    legale_rappresentante_residenza_comune: 'Paese',
    legale_rappresentante_residenza_provincia: 'TV',
    partita_iva: '03166570261',
    via: 'Via G. Di Vittorio',
    numero_civico: '11',
    cap: '31038',
    comune: 'Paese',
    provincia: 'TV',
    posizione_inail: '0000000',
    telefono: '0422-000000',
    pec: 'prova@pec.it',
  },
  customer: { nome: 'ESEMPIO S.P.A.' },
  sitoProduttivo: 'Via Esempio, n.1 - 31013 Codognè (TV)',
  data: '11/08/2026',
  luogo: 'Paese',
}

describe('disegnaDichiarazioneInstallatore', () => {
  test('produce lo stesso numero di pagine calcolato da impagina, quando la chiusura entra nell’ultima', async () => {
    const pagine: Pagina[] = [
      { righe: [gruppo('13052'), gruppo('12693')], continuazione: false },
      { righe: [gruppo('9437')], continuazione: true },
    ]

    const bytes = await disegnaDichiarazioneInstallatore(pagine, await templateDiProva(), dati)
    const finale = await PDFDocument.load(bytes)

    expect(finale.getPageCount()).toBe(2)
  })

  test('aggiunge una pagina in più per la chiusura quando l’ultima pagina è troppo piena', async () => {
    // Molti gruppi sull'ultima pagina: la chiusura (sito produttivo, due paragrafi legali,
    // firma) non ci sta più e deve spostarsi su una pagina dedicata.
    const molti = Array.from({ length: 12 }, (_, i) => gruppo(String(i)))
    const pagine: Pagina[] = [{ righe: molti, continuazione: false }]

    const bytes = await disegnaDichiarazioneInstallatore(pagine, await templateDiProva(), dati)
    const finale = await PDFDocument.load(bytes)

    expect(finale.getPageCount()).toBe(2)
  })

  test('ogni pagina è nel formato del template di sfondo', async () => {
    const pagine: Pagina[] = [{ righe: [gruppo('13052')], continuazione: false }]
    const bytes = await disegnaDichiarazioneInstallatore(pagine, await templateDiProva(), dati)
    const finale = await PDFDocument.load(bytes)

    const pagina = finale.getPages()[0]
    expect(Math.round(pagina.getWidth())).toBe(Math.round(A4.larghezza))
    expect(Math.round(pagina.getHeight())).toBe(Math.round(A4.altezza))
  })

  test('una sola pagina con una sola riga standalone non solleva eccezioni', async () => {
    const pagine: Pagina[] = [
      { righe: [{ principale: null, dipendente: { tipo: 'Serbatoio aria verticale', n_fabbrica: 'X' }, codiceOrdinamento: 'X' }], continuazione: false },
    ]
    await expect(disegnaDichiarazioneInstallatore(pagine, await templateDiProva(), dati)).resolves.toBeInstanceOf(Uint8Array)
  })

  test('senza pagine non solleva eccezioni', async () => {
    // pdf-lib ripristina una pagina vuota su un documento a zero pagine quando lo si ricarica
    // (un PDF senza pagine non è un documento valido): qui basta che non sollevi eccezioni,
    // un caso che comunque non dovrebbe capitare — se non c'è nulla da dichiarare non si
    // invoca la generazione.
    await expect(disegnaDichiarazioneInstallatore([], await templateDiProva(), dati)).resolves.toBeInstanceOf(Uint8Array)
  })

  test('disegna il timbro e la firma solo sull’ultima pagina', async () => {
    const pagine: Pagina[] = [
      { righe: [gruppo('13052'), gruppo('12693')], continuazione: false },
      { righe: [gruppo('9437')], continuazione: true },
    ]

    const bytes = await disegnaDichiarazioneInstallatore(pagine, await templateDiProva(), { ...dati, firma: PNG_1X1 })
    const finale = await PDFDocument.load(bytes)
    const [prima, ultima] = finale.getPages()

    // Lo sfondo (carta intestata) è incorporato su ogni pagina: la differenza fra le due deve
    // essere esattamente l'immagine del timbro, presente solo sull'ultima.
    expect(numeroImmagini(ultima)).toBe(numeroImmagini(prima) + 1)
  })

  test('senza firma l’unico XObject della pagina è lo sfondo, non un timbro in più', async () => {
    const pagine: Pagina[] = [{ righe: [gruppo('13052')], continuazione: false }]
    const bytes = await disegnaDichiarazioneInstallatore(pagine, await templateDiProva(), dati)
    const finale = await PDFDocument.load(bytes)

    expect(numeroImmagini(finale.getPages()[0])).toBe(1)
  })

  test('dimensioneAdattata riduce il corpo del testo finché non entra nella colonna, senza scendere sotto il minimo', async () => {
    const doc = await PDFDocument.create()
    const font = await doc.embedFont(StandardFonts.Helvetica)

    // Un nome breve non ha bisogno di rimpicciolire.
    expect(dimensioneAdattata(font, 'KAESER', 200, 9)).toBe(9)

    // Un nome molto lungo, in una colonna stretta ma non impossibile, va ridotto quel poco che basta.
    const ridotta = dimensioneAdattata(font, 'A.S.T.R.A. REFRIGERANTI S.R.L.', 110, 9)
    expect(ridotta).toBeLessThan(9)
    expect(font.widthOfTextAtSize('A.S.T.R.A. REFRIGERANTI S.R.L.', ridotta)).toBeLessThanOrEqual(110)

    // Anche un nome improponibilmente lungo non scende sotto la soglia minima di leggibilità.
    const estrema = dimensioneAdattata(font, 'X'.repeat(200), 100, 9, 6)
    expect(estrema).toBe(6)
  })

  test('spezzaRighe va a capo per parola intera senza superare la larghezza massima', async () => {
    const doc = await PDFDocument.create()
    const font = await doc.embedFont(StandardFonts.Helvetica)
    const frase = 'una frase abbastanza lunga da dover andare a capo più di una volta di sicuro'

    const righe = spezzaRighe(font, frase, 10, 120)

    expect(righe.length).toBeGreaterThan(1)
    expect(righe.join(' ')).toBe(frase)
    for (const riga of righe) {
      expect(font.widthOfTextAtSize(riga, 10)).toBeLessThanOrEqual(120)
    }
  })

  test('spezzaRighe non spezza mai una singola parola, anche più larga del limite', async () => {
    const doc = await PDFDocument.create()
    const font = await doc.embedFont(StandardFonts.Helvetica)

    const righe = spezzaRighe(font, 'paroleunicalunghissima altra', 10, 5)

    expect(righe).toEqual(['paroleunicalunghissima', 'altra'])
  })
})
