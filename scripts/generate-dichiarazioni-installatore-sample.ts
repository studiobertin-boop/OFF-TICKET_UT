/**
 * Genera un esempio della sola dichiarazione installatore (parte 4 delle "dichiarazioni"),
 * per valutare a vista il layout multi-pagina dopo una modifica al motore o al template.
 *
 * I dati ricalcano l'esempio reale allegato al piano (Officina del Compressore, 3 compressori
 * con disoleatore, un serbatoio verticale standalone, un essiccatore con scambiatore), con
 * compressori aggiuntivi per forzare l'overflow su più pagine e verificare che i gruppi non si
 * spezzino mai a metà.
 *
 * Uso: npx tsx scripts/generate-dichiarazioni-installatore-sample.ts [percorso-output.pdf]
 */
import { readFileSync, writeFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { PDFDocument } from 'pdf-lib'
import { generaDichiarazioneInstallatore } from '../src/services/dichiarazioni/installatore'
import type { SchedaDatiCompleta, Compressore, Disoleatore } from '../src/types/technicalSheet'

const RADICE = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const TEMPLATE = resolve(RADICE, 'public/templates/dichiarazioni/dichiarazione-installatore-sfondo.pdf')
const FIRMA = resolve(RADICE, 'public/templates/dichiarazioni/timbroefirma.png')
const OUT = process.argv[2]
  ? resolve(process.cwd(), process.argv[2])
  : resolve(RADICE, 'DOCUMENTAZIONE/ESEMPIO_dichiarazione_installatore.pdf')

const compressoriBase: [Compressore, Disoleatore][] = [
  [
    { codice: 'C1', marca: 'KAESER KOMPRESSOREN SE', modello: 'CSD 102 SFC', n_fabbrica: '100259.0 / 1397' },
    { codice: 'C1.1', compressore_associato: 'C1', marca: 'AIR COM S.r.l.', modello: '25GK1', n_fabbrica: '13052', volume: 65, ps_pressione_max: 11, valvola_sicurezza: {} },
  ],
  [
    { codice: 'C2', marca: 'KAESER KOMPRESSOREN SE', modello: 'BSD 75', n_fabbrica: '101253.1 / 1160' },
    { codice: 'C2.1', compressore_associato: 'C2', marca: 'A.S.T.R.A. REFRIGERANTI S.R.L.', modello: '25IK2', n_fabbrica: '12693', volume: 55, ps_pressione_max: 11, valvola_sicurezza: {} },
  ],
  [
    { codice: 'C3', marca: 'KAESER KOMPRESSOREN SE', modello: 'CSDX 140 SFC', n_fabbrica: '101836.2 / 1034' },
    { codice: 'C3.1', compressore_associato: 'C3', marca: 'A.S.T.R.A. REFRIGERANTI S.R.L.', modello: '25AEK1', n_fabbrica: '9437', volume: 65, ps_pressione_max: 11, valvola_sicurezza: {} },
  ],
]

// Compressori aggiuntivi, oltre ai 3 dell'esempio reale, per forzare l'overflow su una seconda
// pagina con la capacità di default (12 righe sulla prima pagina, un gruppo pesa 2).
const compressoriExtra: [Compressore, Disoleatore][] = Array.from({ length: 5 }, (_, i) => {
  const n = i + 4
  return [
    { codice: `C${n}`, marca: 'KAESER KOMPRESSOREN SE', modello: `Modello ${n}`, n_fabbrica: `NF-${n}` },
    { codice: `C${n}.1`, compressore_associato: `C${n}`, marca: 'AIR COM S.r.l.', modello: '25GK1', n_fabbrica: `DISOL-${n}`, volume: 65, ps_pressione_max: 11, valvola_sicurezza: {} },
  ] as [Compressore, Disoleatore]
})

const tutti = [...compressoriBase, ...compressoriExtra]

const scheda: SchedaDatiCompleta = {
  stato: 'completa',
  dati_generali: { data_sopralluogo: '', nome_tecnico: '', cliente: 'ESEMPIO S.P.A.' },
  dati_impianto: { sede_imp_uguale_legale: true, sede_impianto: '', indirizzo_impianto: '', raccolta_condense: 'Nessuna' },
  compressori: tutti.map(([c]) => c),
  disoleatori: tutti.map(([, d]) => d),
  serbatoi: [
    {
      codice: 'S1',
      marca: 'SICC TECH s.r.l.',
      modello: '3000 - 20011R2',
      n_fabbrica: '20.03321.013',
      volume: 3000,
      ps_pressione_max: 12,
      orientamento: 'VERTICALE',
      valvola_sicurezza: {},
    },
  ],
  essiccatori: [
    { codice: 'E1', marca: 'FRIULAIR S.r.l.', modello: 'FCT300/AC', n_fabbrica: 'FCT300CQ1P080 / 200029513' },
  ],
  scambiatori: [
    {
      codice: 'E1.1',
      essiccatore_associato: 'E1',
      marca: 'RAAL S.A.',
      modello: 'RACF 21394-0',
      n_fabbrica: '0533-33-19',
      volume: 58,
      ps_pressione_max: 11,
    },
  ],
  filtri: [],
  recipienti_filtro: [],
  separatori: [],
}

async function main() {
  const templateBytes = readFileSync(TEMPLATE)
  const firma = readFileSync(FIRMA)
  const bytes = await generaDichiarazioneInstallatore({
    scheda,
    installer: {
      nome: 'OFFICINA DEL COMPRESSORE S.R.L.',
      // Dati anagrafici di fantasia, solo per esercitare l'andata a capo del paragrafo
      // introduttivo: quelli reali dell'installatore predefinito vivono solo nel database.
      legale_rappresentante: 'Mario Rossi',
      legale_rappresentante_nascita_luogo: 'Treviso',
      legale_rappresentante_nascita_data: '01.01.1970',
      legale_rappresentante_residenza_via: 'via di Prova nr. 1 int.2',
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
      pec: 'esempio@pec.it',
    },
    customer: { nome: 'ESEMPIO S.P.A.' },
    sitoProduttivo: 'Via Leonardo Da Vinci, n.3 - 31021 Mogliano Veneto (TV)',
    data: '11/08/2026',
    luogo: 'Paese',
    templateBytes,
    firma,
  })

  writeFileSync(OUT, bytes)
  const doc = await PDFDocument.load(bytes)
  console.log(`Scritto ${OUT}`)
  console.log(`Pagine: ${doc.getPageCount()}`)
  console.log(`Peso: ${(bytes.byteLength / 1024).toFixed(1)} KB`)
}

main()
