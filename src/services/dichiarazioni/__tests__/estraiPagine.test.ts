import { describe, test, expect } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { estraiPagina } from '../estraiPagine'

const pdfMultiPagina = async (n: number, nome = 'multi.pdf'): Promise<File> => {
  const doc = await PDFDocument.create()
  for (let i = 0; i < n; i++) {
    doc.addPage([595, 842]).drawText(`pagina ${i}`, { x: 50, y: 50, size: 20 })
  }
  const bytes = await doc.save()
  return new File([bytes.slice()], nome, { type: 'application/pdf' })
}

describe('estraiPagina', () => {
  test('estrae una singola pagina come file PDF standalone di una sola pagina', async () => {
    const sorgente = await pdfMultiPagina(3)
    const estratta = await estraiPagina(sorgente, 1)

    expect(estratta).toBeInstanceOf(File)
    expect(estratta.type).toBe('application/pdf')

    const doc = await PDFDocument.load(await estratta.arrayBuffer())
    expect(doc.getPageCount()).toBe(1)
  })

  test('pagine diverse dello stesso sorgente restano indipendenti', async () => {
    const sorgente = await pdfMultiPagina(3)
    const p0 = await estraiPagina(sorgente, 0)
    const p2 = await estraiPagina(sorgente, 2)

    expect(p0.size).toBeGreaterThan(0)
    expect(p2.size).toBeGreaterThan(0)

    const doc0 = await PDFDocument.load(await p0.arrayBuffer())
    const doc2 = await PDFDocument.load(await p2.arrayBuffer())
    expect(doc0.getPageCount()).toBe(1)
    expect(doc2.getPageCount()).toBe(1)
  })

  test('mantiene un nome file riconoscibile, con l’indicazione della pagina', async () => {
    // Nome prevedibile: utile nei messaggi di errore quando pdf-lib scarta una pagina.
    const sorgente = await pdfMultiPagina(3, 'scansione.pdf')
    const estratta = await estraiPagina(sorgente, 1)
    expect(estratta.name).toBe('scansione.pdf#2')
  })
})
