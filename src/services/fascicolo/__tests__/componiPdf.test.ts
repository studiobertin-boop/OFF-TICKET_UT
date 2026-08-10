import { describe, test, expect } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { A4, LIMITE_BYTE, componiFascicolo, inquadraInA4 } from '../componiPdf'

/** Un PDF vero delle dimensioni date, come `File` da dare al compositore. */
const pdfDiProva = async (pagine: [number, number][], nome = 'prova.pdf'): Promise<File> => {
  const doc = await PDFDocument.create()
  pagine.forEach(([w, h]) => {
    // Qualcosa di disegnato ci vuole: una pagina senza flusso di contenuto non è incorporabile,
    // e nessun documento reale ne è fatto.
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
    // Ruotato di 90° in senso antiorario attorno all'ancora: l'area occupata va da
    // `x - altezza` a `x` in orizzontale e da `y` a `y + larghezza` in verticale.
    expect(arrotonda(q.x - q.altezza)).toBe(arrotonda(A4.larghezza - q.x))
    expect(arrotonda(q.y)).toBe(arrotonda(A4.altezza - (q.y + q.larghezza)))
  })

  test('una foto orizzontale ruotata riempie il foglio molto più che lasciata dritta', () => {
    const [w, h] = [4000, 3000]
    const q = inquadraInA4(w, h)

    // Quanto occuperebbe la stessa foto senza ruotarla: il rapporto è la ragione della scelta.
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
})
