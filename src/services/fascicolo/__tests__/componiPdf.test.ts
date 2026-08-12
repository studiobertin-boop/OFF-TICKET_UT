import { describe, test, expect } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { A4, componiFascicolo, inquadraInA4 } from '../componiPdf'

/**
 * Il motore vero è testato a fondo in `services/pdfCompose/__tests__/componiPdf.test.ts`.
 * Qui basta un fumo: il fascicolo importa da questo percorso storico, e deve continuare a
 * funzionare esattamente come prima dell'estrazione.
 */
describe('fascicolo/componiPdf (re-export)', () => {
  test('inquadraInA4 e componiFascicolo restano usabili da qui', async () => {
    expect(inquadraInA4(A4.larghezza, A4.altezza).ruotato).toBe(false)

    const doc = await PDFDocument.create()
    doc.addPage([595, 842]).drawRectangle({ x: 10, y: 10, width: 100, height: 100 })
    const file = new File([(await doc.save()).slice()], 'prova.pdf', { type: 'application/pdf' })

    const esito = await componiFascicolo([{ file, etichetta: 'prova.pdf', foto: false }])
    expect(esito.pagine).toBe(1)
    expect(esito.sottoLimite).toBe(true)
  })
})
