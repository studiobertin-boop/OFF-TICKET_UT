import { describe, test, expect, vi } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import * as raster from '@/services/pdfCompose/raster'
import { dividiPagineDoppie } from '../dividiPagineDoppie'

const pdfDiProva = async (pagine: [number, number][]): Promise<File> => {
  const doc = await PDFDocument.create()
  pagine.forEach(([w, h]) => { doc.addPage([w, h]) })
  const bytes = await doc.save()
  return new File([bytes.slice()], 'prova.pdf', { type: 'application/pdf' })
}

describe('dividiPagineDoppie', () => {
  test('un PDF senza pagine doppie torna invariato (stesso file, nessuna ricodifica)', async () => {
    const file = await pdfDiProva([[595, 842], [595, 842]])
    const risultato = await dividiPagineDoppie(file)

    expect(risultato.file).toBe(file)
    expect(risultato.pagineSeparate).toEqual([])
  })

  test('un file non apribile torna invariato invece di far fallire il chiamante', async () => {
    const rotto = new File([new Uint8Array([1, 2, 3])], 'rotto.pdf', { type: 'application/pdf' })
    const risultato = await dividiPagineDoppie(rotto)

    expect(risultato.file).toBe(rotto)
    expect(risultato.pagineSeparate).toEqual([])
  })

  test('se la rasterizzazione di una pagina doppia fallisce, la pagina resta intatta invece di sparire', async () => {
    const spia = vi.spyOn(raster, 'rasterizzaPdf').mockRejectedValue(new Error('rasterizzazione fallita'))
    try {
      // 1190.56×841.89: due A4 verticali affiancati, riconosciuta come doppia.
      const file = await pdfDiProva([[1190.56, 841.89]])
      const risultato = await dividiPagineDoppie(file)

      expect(risultato.pagineSeparate).toEqual([])
      const rilegato = await PDFDocument.load(await risultato.file.arrayBuffer())
      expect(rilegato.getPageCount()).toBe(1)
    } finally {
      spia.mockRestore()
    }
  })
})
