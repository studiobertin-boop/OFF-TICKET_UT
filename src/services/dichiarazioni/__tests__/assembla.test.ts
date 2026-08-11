import { describe, test, expect } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { A4 } from '@/services/pdfCompose/componiPdf'
import { ordinaFontiSorgente, assemblaDichiarazioni, type FontePagina } from '../assembla'

const paginaDiProva = async (etichetta: string): Promise<File> => {
  const doc = await PDFDocument.create()
  doc.addPage([595, 842]).drawText(etichetta, { x: 20, y: 20, size: 12 })
  const bytes = await doc.save()
  return new File([bytes.slice()], `${etichetta}.pdf`, { type: 'application/pdf' })
}

const fonte = (etichetta: string, ruolo: FontePagina['ruolo'], ordine: number, file: File): FontePagina => ({
  file,
  etichetta,
  ruolo,
  ordine,
})

describe('ordinaFontiSorgente', () => {
  test('ordina per ruolo (bollo, attestazione, doc identità) e poi per ordine dentro il ruolo', async () => {
    const p = await paginaDiProva('x')
    const fonti: FontePagina[] = [
      fonte('id-2', 'DOC_IDENTITA_UTILIZZATORE', 1, p),
      fonte('bollo-2', 'BOLLO', 1, p),
      fonte('attestazione-1', 'ATTESTAZIONE', 0, p),
      fonte('bollo-1', 'BOLLO', 0, p),
      fonte('id-1', 'DOC_IDENTITA_UTILIZZATORE', 0, p),
    ]

    expect(ordinaFontiSorgente(fonti).map((f) => f.etichetta)).toEqual([
      'bollo-1',
      'bollo-2',
      'attestazione-1',
      'id-1',
      'id-2',
    ])
  })

  test('ignora le pagine senza ruolo assegnato', async () => {
    const p = await paginaDiProva('x')
    const fonti: FontePagina[] = [
      fonte('bollo', 'BOLLO', 0, p),
      { file: p, etichetta: 'non assegnata', ruolo: null, ordine: 0 } as unknown as FontePagina,
    ]
    expect(ordinaFontiSorgente(fonti.filter((f) => f.ruolo !== null)).map((f) => f.etichetta)).toEqual(['bollo'])
  })
})

describe('assemblaDichiarazioni', () => {
  test('concatena bollo, attestazione, doc identità utilizzatore, dichiarazione e doc identità installatore, in quest’ordine', async () => {
    const esito = await assemblaDichiarazioni({
      fontiSorgente: [
        fonte('attestazione', 'ATTESTAZIONE', 0, await paginaDiProva('attestazione')),
        fonte('bollo', 'BOLLO', 0, await paginaDiProva('bollo')),
        fonte('id-utilizzatore', 'DOC_IDENTITA_UTILIZZATORE', 0, await paginaDiProva('id-utilizzatore')),
      ],
      dichiarazioneInstallatore: await paginaDiProva('dichiarazione'),
      documentoIdentitaInstallatore: await paginaDiProva('id-installatore'),
    })

    expect(esito.pagine).toBe(5)
    expect(esito.sottoLimite).toBe(true)

    const finale = await PDFDocument.load(await esito.blob.arrayBuffer())
    for (const pagina of finale.getPages()) {
      expect(pagina.getWidth()).toBeCloseTo(A4.larghezza, 0)
      expect(pagina.getHeight()).toBeCloseTo(A4.altezza, 0)
    }
  })
})
