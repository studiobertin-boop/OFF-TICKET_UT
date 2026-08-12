import { describe, test, expect } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import {
  A4,
  A4_ORIZZONTALE,
  LIMITE_BYTE,
  componiFascicolo,
  inquadraInA4,
  inquadraInFoglio,
} from '../componiPdf'

/** Un PDF vero delle dimensioni date, come `File` da dare al compositore. */
const pdfDiProva = async (pagine: [number, number][], nome = 'prova.pdf'): Promise<File> => {
  const doc = await PDFDocument.create()
  pagine.forEach(([w, h]) => {
    doc.addPage([w, h]).drawRectangle({ x: 10, y: 10, width: w - 20, height: h - 20 })
  })
  const bytes = await doc.save()
  return new File([bytes.slice()], nome, { type: 'application/pdf' })
}

const arrotonda = (n: number) => Math.round(n * 100) / 100

describe('inquadraInA4', () => {
  test('lascia una pagina A4 verticale dov’è, senza ruotarla né rimpicciolirla', () => {
    const q = inquadraInA4(A4.larghezza, A4.altezza)

    expect(q.ruotato).toBe(false)
    expect(arrotonda(q.x)).toBe(0)
    expect(arrotonda(q.y)).toBe(0)
    expect(arrotonda(q.larghezza)).toBe(arrotonda(A4.larghezza))
  })

  test('ruota ciò che è più largo che alto e lo centra nel foglio', () => {
    const q = inquadraInA4(A4.altezza, A4.larghezza)

    expect(q.ruotato).toBe(true)
    expect(arrotonda(q.x - q.altezza)).toBe(arrotonda(A4.larghezza - q.x))
    expect(arrotonda(q.y)).toBe(arrotonda(A4.altezza - (q.y + q.larghezza)))
  })

  test('una foto orizzontale ruotata riempie il foglio molto più che lasciata dritta', () => {
    const [w, h] = [4000, 3000]
    const q = inquadraInA4(w, h)

    const scalaDritta = Math.min(A4.larghezza / w, A4.altezza / h)
    const areaDritta = w * scalaDritta * h * scalaDritta

    expect(q.ruotato).toBe(true)
    expect(q.larghezza * q.altezza).toBeGreaterThan(areaDritta * 1.5)
  })

  test('non ruota il quadrato: non ci guadagnerebbe niente', () => {
    expect(inquadraInA4(1000, 1000).ruotato).toBe(false)
  })

  test('non ingrandisce oltre il foglio ciò che è più piccolo', () => {
    const q = inquadraInA4(100, 150)

    expect(q.larghezza).toBeLessThanOrEqual(A4.larghezza)
    expect(q.altezza).toBeLessThanOrEqual(A4.altezza)
  })
})

describe('inquadraInFoglio con A4_ORIZZONTALE', () => {
  test('un contenuto verticale viene ruotato per riempire un foglio orizzontale', () => {
    // Una scansione A4 verticale (più alta che larga) su un foglio orizzontale va ruotata,
    // l'opposto di quanto succede su un foglio A4 verticale.
    const q = inquadraInFoglio(A4.larghezza, A4.altezza, A4_ORIZZONTALE)
    expect(q.ruotato).toBe(true)
  })

  test('un contenuto già orizzontale non viene ruotato su un foglio orizzontale', () => {
    const q = inquadraInFoglio(A4_ORIZZONTALE.larghezza, A4_ORIZZONTALE.altezza, A4_ORIZZONTALE)
    expect(q.ruotato).toBe(false)
    expect(arrotonda(q.larghezza)).toBe(arrotonda(A4_ORIZZONTALE.larghezza))
  })

  test('il comportamento su A4 verticale resta quello di inquadraInA4', () => {
    const q1 = inquadraInFoglio(4000, 3000, A4)
    const q2 = inquadraInA4(4000, 3000)
    expect(q1).toEqual(q2)
  })
})

describe('componiFascicolo', () => {
  test('rilega i documenti nell’ordine ricevuto, una pagina per pagina sorgente', async () => {
    const esito = await componiFascicolo([
      { file: await pdfDiProva([[595, 842], [595, 842]], 'certificato.pdf'), etichetta: 'certificato.pdf', foto: false },
      { file: await pdfDiProva([[595, 842]], 'istruzioni.pdf'), etichetta: 'istruzioni.pdf', foto: false },
    ])

    expect(esito.pagine).toBe(3)
    expect(esito.sottoLimite).toBe(true)
    expect(esito.scartati).toEqual([])
  })

  test('porta ad A4 anche le pagine che A4 non sono', async () => {
    const esito = await componiFascicolo([
      { file: await pdfDiProva([[1190, 842], [300, 400]], 'misto.pdf'), etichetta: 'misto.pdf', foto: false },
    ])

    const finale = await PDFDocument.load(await esito.blob.arrayBuffer())
    for (const pagina of finale.getPages()) {
      expect(arrotonda(pagina.getWidth())).toBe(arrotonda(A4.larghezza))
      expect(arrotonda(pagina.getHeight())).toBe(arrotonda(A4.altezza))
    }
  })

  test('non si ferma sul file illeggibile: lo scarta, lo dichiara e rilega il resto', async () => {
    const rotto = new File([new Uint8Array([1, 2, 3])], 'rotto.pdf', { type: 'application/pdf' })
    const esito = await componiFascicolo([
      { file: rotto, etichetta: 'rotto.pdf', foto: false },
      { file: await pdfDiProva([[595, 842]], 'buono.pdf'), etichetta: 'buono.pdf', foto: false },
    ])

    expect(esito.pagine).toBe(1)
    expect(esito.scartati.map((s) => s.etichetta)).toEqual(['rotto.pdf'])
  })

  test('senza documenti dà un PDF vuoto invece di rompersi', async () => {
    const esito = await componiFascicolo([])

    expect(esito.pagine).toBe(0)
    expect(esito.sottoLimite).toBe(true)
  })

  test('un fascicolo leggero non subisce riduzioni', async () => {
    const esito = await componiFascicolo([
      { file: await pdfDiProva([[595, 842]], 'certificato.pdf'), etichetta: 'certificato.pdf', foto: false },
    ])

    expect(esito.ridotti).toEqual([])
    expect(esito.byte).toBeLessThan(LIMITE_BYTE)
  })

  test('con foglio A4_ORIZZONTALE produce pagine orizzontali', async () => {
    const esito = await componiFascicolo(
      [{ file: await pdfDiProva([[595, 842]], 'verticale.pdf'), etichetta: 'verticale.pdf', foto: false }],
      { foglio: A4_ORIZZONTALE }
    )

    const finale = await PDFDocument.load(await esito.blob.arrayBuffer())
    for (const pagina of finale.getPages()) {
      expect(pagina.getWidth()).toBeGreaterThan(pagina.getHeight())
    }
  })
})
