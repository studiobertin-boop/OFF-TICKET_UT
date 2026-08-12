import { describe, test, expect } from 'vitest'
import { PDFDocument, PDFName, PDFDict } from 'pdf-lib'
import type { SchedaDatiCompleta, ValvolaSicurezza } from '@/types/technicalSheet'
import { generaDichiarazioneInstallatore } from '../index'

const PNG_1X1 = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='),
  (c) => c.charCodeAt(0)
)

const numeroImmagini = (pagina: ReturnType<PDFDocument['getPage']>): number => {
  const risorse = pagina.node.Resources()
  const xobject = risorse?.lookupMaybe(PDFName.of('XObject'), PDFDict)
  return xobject ? xobject.keys().length : 0
}

const A4 = { larghezza: 595.28, altezza: 841.89 }
const valvola: ValvolaSicurezza = {}

const templateDiProva = async (): Promise<Uint8Array> => {
  const doc = await PDFDocument.create()
  doc.addPage([A4.larghezza, A4.altezza]).drawRectangle({ x: 0, y: 0, width: 10, height: 10 })
  return doc.save()
}

const scheda = (parziale: Partial<SchedaDatiCompleta>): SchedaDatiCompleta => ({
  stato: 'completa',
  dati_generali: { data_sopralluogo: '', nome_tecnico: '', cliente: '' },
  dati_impianto: { sede_imp_uguale_legale: true, sede_impianto: '', indirizzo_impianto: '', raccolta_condense: 'Nessuna' },
  serbatoi: [],
  compressori: [],
  disoleatori: [],
  essiccatori: [],
  scambiatori: [],
  filtri: [],
  recipienti_filtro: [],
  separatori: [],
  ...parziale,
})

const installer = {
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
}
const sitoProduttivo = 'Via Esempio, n.1 - 31013 Codognè (TV)'

describe('generaDichiarazioneInstallatore', () => {
  test('collega raggruppamento, impaginazione e disegno in un unico PDF', async () => {
    const bytes = await generaDichiarazioneInstallatore({
      scheda: scheda({
        serbatoi: [
          { codice: 'S1', marca: 'SICC TECH', volume: 3000, ps_pressione_max: 12, valvola_sicurezza: valvola },
        ],
      }),
      installer,
      customer: { nome: 'ESEMPIO S.P.A.' },
      sitoProduttivo,
      data: '11/08/2026',
      templateBytes: await templateDiProva(),
    })

    const finale = await PDFDocument.load(bytes)
    expect(finale.getPageCount()).toBeGreaterThanOrEqual(1)
  })

  test('con molte apparecchiature soggette produce più pagine', async () => {
    const disoleatori = Array.from({ length: 40 }, (_, i) => ({
      codice: `C${i + 1}.1`,
      compressore_associato: `C${i + 1}`,
      marca: 'X',
      volume: 65,
      ps_pressione_max: 11,
      valvola_sicurezza: valvola,
    }))
    const compressori = Array.from({ length: 40 }, (_, i) => ({ codice: `C${i + 1}`, marca: 'KAESER', modello: 'X' }))

    const bytes = await generaDichiarazioneInstallatore({
      scheda: scheda({ disoleatori, compressori }),
      installer,
      customer: { nome: 'ESEMPIO S.P.A.' },
      sitoProduttivo,
      data: '11/08/2026',
      templateBytes: await templateDiProva(),
    })

    const finale = await PDFDocument.load(bytes)
    expect(finale.getPageCount()).toBeGreaterThan(1)
  })

  test('inoltra la firma fino al disegno, sull’ultima pagina', async () => {
    const bytes = await generaDichiarazioneInstallatore({
      scheda: scheda({
        serbatoi: [
          { codice: 'S1', marca: 'SICC TECH', volume: 3000, ps_pressione_max: 12, valvola_sicurezza: valvola },
        ],
      }),
      installer,
      customer: { nome: 'ESEMPIO S.P.A.' },
      sitoProduttivo,
      data: '11/08/2026',
      templateBytes: await templateDiProva(),
      firma: PNG_1X1,
    })

    const finale = await PDFDocument.load(bytes)
    const pagina = finale.getPages()[finale.getPageCount() - 1]
    // Almeno 2 XObject: lo sfondo (carta intestata) e la firma.
    expect(numeroImmagini(pagina)).toBeGreaterThanOrEqual(2)
  })
})
