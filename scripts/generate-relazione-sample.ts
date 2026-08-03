/**
 * Genera un documento di esempio dal template corrente, per valutare a vista la
 * struttura della relazione dopo una modifica.
 *
 * I dati ricalcano la relazione 541 (3 compressori a vite con disoleatore, 1 serbatoio
 * già immatricolato INAIL, essiccatore con scambiatore) più alcuni casi che le relazioni
 * storiche coprivano male: un compressore a pistoni, una seconda valvola sul serbatoio,
 * un serbatoio azoto, aria con acidi.
 *
 * Uso:  npx tsx scripts/generate-relazione-sample.ts [percorso-output] [schema.png]
 *
 * Il secondo argomento è lo schema d'impianto di §2.3, facoltativo: nell'app l'immagine
 * la sceglie il redattore al momento della generazione e non viene salvata.
 */
import { readFileSync, writeFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { buildRelazioneModel } from '../src/services/relazione/buildRelazioneModel'
import { renderRelazioneDocx } from '../src/services/relazione/renderRelazione'
import type { SchedaDatiCompleta } from '../src/types/technicalSheet'
import type { Customer } from '../src/types'
import type { AdditionalInfo, PraticaInfo, SchemaImpianto } from '../src/services/relazione/types'

/**
 * Legge un PNG e ne ricava le dimensioni dall'header IHDR (byte 16-23).
 * Nell'app questo passaggio non serve: le misura il browser con un elemento Image.
 * Qui si accetta il solo PNG per non trascinare un decoder JPEG in uno script di esempio.
 */
function leggiSchemaPng(percorso: string): SchemaImpianto {
  const dati = new Uint8Array(readFileSync(percorso))
  const firma = [0x89, 0x50, 0x4e, 0x47]
  if (!firma.every((b, i) => dati[i] === b)) {
    throw new Error(`${percorso} non è un PNG: per l'esempio serve un PNG.`)
  }
  const vista = new DataView(dati.buffer, dati.byteOffset, dati.byteLength)
  return {
    dati,
    larghezzaPx: vista.getUint32(16),
    altezzaPx: vista.getUint32(20),
    nomeFile: percorso,
  }
}

/**
 * La radice del progetto si ricava dalla posizione dello script, non dalla cartella da cui
 * lo si lancia: il template sta sempre lì, e chi segue la guida si trova spesso dentro
 * `DOCUMENTAZIONE/relazione/`. I percorsi passati a riga di comando restano invece relativi
 * alla cartella corrente, che è quello che ci si aspetta scrivendo `esempio.docx`.
 */
const RADICE = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const TEMPLATE = resolve(RADICE, 'public/templates/relazione-dm329.docx')
const OUT = process.argv[2]
  ? resolve(process.cwd(), process.argv[2])
  : resolve(RADICE, 'DOCUMENTAZIONE/relazione/ESEMPIO_nuova_struttura.docx')

const customer: Customer = {
  id: 'sample',
  ragione_sociale: 'ESEMPIO S.P.A.',
  descrizione_attivita:
    'lavorazioni meccaniche e trattamenti superficiali in genere, nonché la produzione di componenti per mobili ed elettrodomestici',
  via: 'Via Esempio',
  numero_civico: '1',
  cap: '31013',
  comune: 'Codognè',
  provincia: 'TV',
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const scheda: SchedaDatiCompleta = {
  stato: 'completa',
  dati_generali: {
    data_sopralluogo: '13/01/2026',
    nome_tecnico: 'Studio Bertin',
    cliente: 'ESEMPIO S.P.A.',
  },
  dati_impianto: {
    sede_imp_uguale_legale: true,
    sede_impianto: '',
    indirizzo_impianto: '',
    raccolta_condense: 'tanica',
    locale_condiviso_con: '',
    locale_dedicato: true,
    accesso_locale_vietato: true,
    lontano_fonti_calore: true,
    lontano_materiale_infiammabile: true,
    // Caso che il testo statico contraddiceva: aria con acidi → frase evidenziata.
    aria_aspirata: ['Acidi'],
    dn_sala_max: 80,
    dn_distribuzione_max: 50,
  },
  compressori: [
    {
      codice: 'C1',
      marca: 'KAESER KOMPRESSOREN SE',
      modello: 'CSD 90 SFC',
      n_fabbrica: '1012288.0 / 1143',
      anno: 2025,
      pressione_max: 8.5,
      volume_aria_prodotto: 8000,
      tipo: 'VITE',
    },
    {
      codice: 'C2',
      marca: 'KAESER KOMPRESSOREN SE',
      modello: 'ASD 47 SFC',
      n_fabbrica: '100615.1 / 1049',
      anno: 2008,
      pressione_max: 8.5,
      volume_aria_prodotto: 4920,
      tipo: 'VITE',
    },
    // Compressore a pistoni: privo di recipienti in pressione (art. 2 comma i).
    {
      codice: 'C3',
      marca: 'ABAC',
      modello: 'B7000',
      n_fabbrica: 'AB-77120',
      anno: 2019,
      pressione_max: 10,
      volume_aria_prodotto: 670,
      tipo: 'PISTONI',
      silenziato: true,
    },
  ],
  disoleatori: [
    {
      codice: 'C1.1',
      compressore_associato: 'C1',
      marca: 'A.S.T.R.A. REFRIGERANTI S.R.L.',
      modello: '3080',
      n_fabbrica: '25827',
      anno: 2024,
      volume: 80,
      ps_pressione_max: 11,
      ts_temperatura: 120,
      categoria_ped: 'III',
      valvola_sicurezza: {
        marca: 'ARMATUREN- UND METALLWERKE ZÖBLITZ GMBH',
        modello: '810sGK',
        n_fabbrica: '1001913158',
        anno: 2025,
        pressione_taratura: 10,
        volume_aria_scaricato: 21500,
        ts_temperatura: 225,
        categoria_ped: 'IV',
      },
    },
    {
      codice: 'C2.1',
      compressore_associato: 'C2',
      marca: 'AIR COM S.r.l.',
      modello: '25ZK1',
      n_fabbrica: '473',
      anno: 2008,
      volume: 30,
      ps_pressione_max: 16,
      ts_temperatura: 120,
      categoria_ped: 'II',
      // Già immatricolato: compare in colonna Stato INAIL.
      gia_denunciato: true,
      matricola_inail: '2013/3/00013/TV',
      valvola_sicurezza: {
        marca: 'PADOVAN VALERIO snc',
        modello: 'TW3',
        n_fabbrica: '673123/2',
        anno: 2023,
        pressione_taratura: 10,
        volume_aria_scaricato: 7713,
        ts_temperatura: 200,
        categoria_ped: 'IV',
      },
    },
  ],
  serbatoi: [
    {
      codice: 'S1',
      marca: 'SICC S.r.L.',
      modello: '2000 - 12784',
      n_fabbrica: '16.04805.019',
      anno: 2016,
      volume: 2000,
      ps_pressione_max: 11.5,
      ts_temperatura: 120,
      categoria_ped: 'IV',
      finitura_interna: 'ZINCATO',
      ancorato_terra: true,
      scarico: 'AUTOMATICO',
      manometro: { fondo_scala: 16, segno_rosso: 11 },
      gia_denunciato: true,
      matricola_inail: '2018/7/00046/TV',
      orientamento: 'VERTICALE',
      ubicazione: 'SALA_COMPRESSORI',
      fluido: 'ARIA',
      valvola_sicurezza: {
        marca: 'PADOVAN VALERIO snc',
        modello: 'TA21',
        n_fabbrica: '630623/2',
        anno: 2023,
        pressione_taratura: 10.8,
        volume_aria_scaricato: 32142,
        ts_temperatura: 200,
        categoria_ped: 'IV',
      },
      // Seconda valvola sullo stesso recipiente: caso che il modello vecchio non copriva.
      valvole_aggiuntive: [
        {
          marca: 'PADOVAN VALERIO snc',
          modello: 'TA21',
          n_fabbrica: '2926/3',
          anno: 2025,
          pressione_taratura: 11,
          volume_aria_scaricato: 32948,
          ts_temperatura: 200,
          categoria_ped: 'IV',
        },
      ],
    },
    {
      codice: 'S2',
      marca: 'SICC TECH s.r.l.',
      modello: '500 - 12783',
      n_fabbrica: '19.02986.025',
      anno: 2019,
      volume: 500,
      ps_pressione_max: 11,
      ts_temperatura: 120,
      categoria_ped: 'IV',
      finitura_interna: 'VERNICIATO',
      ancorato_terra: true,
      scarico: 'MANUALE',
      orientamento: 'ORIZZONTALE',
      // Serbatoio dislocato in linea: differenzia la descrizione della sezione.
      ubicazione: 'LINEA_DISTRIBUZIONE',
      fluido: 'ARIA',
      valvola_sicurezza: {
        marca: 'PADOVAN VALERIO snc',
        modello: 'TA6',
        n_fabbrica: '878425/771',
        anno: 2025,
        pressione_taratura: 10.8,
        volume_aria_scaricato: 6710,
        ts_temperatura: 200,
        categoria_ped: 'IV',
      },
    },
    {
      codice: 'S3',
      marca: 'SICC TECH s.r.l.',
      modello: '1000 - 20011',
      n_fabbrica: '21.03311.007',
      anno: 2021,
      volume: 1000,
      ps_pressione_max: 11,
      ts_temperatura: 120,
      categoria_ped: 'IV',
      finitura_interna: 'ZINCATO',
      ancorato_terra: true,
      scarico: 'AUTOMATICO',
      orientamento: 'VERTICALE',
      ubicazione: 'LINEA_DISTRIBUZIONE',
      // Circuito azoto: genera una sezione di accumulo separata e una riga in §3.
      fluido: 'AZOTO',
      valvola_sicurezza: {
        marca: 'PADOVAN VALERIO snc',
        modello: 'TA12',
        n_fabbrica: '553825/82',
        anno: 2021,
        pressione_taratura: 10.8,
        volume_aria_scaricato: 39814,
        ts_temperatura: 200,
        categoria_ped: 'IV',
      },
    },
  ],
  essiccatori: [
    {
      codice: 'E1',
      marca: 'FRIULAIR S.r.l.',
      modello: 'ACT 140',
      n_fabbrica: '17R015270',
      anno: 2017,
      ps_pressione_max: 14,
      volume_aria_trattata: 14500,
      ha_scambiatore: true,
    },
  ],
  scambiatori: [
    {
      codice: 'E1.1',
      essiccatore_associato: 'E1',
      marca: 'RAAL S.A.',
      modello: 'RACF 31000-0',
      n_fabbrica: '00021-06-17',
      anno: 2017,
      volume: 28,
      ps_pressione_max: 14,
      ts_temperatura: 120,
      categoria_ped: 'II',
      // Lo scambiatore non ha valvola propria: è protetto da quelle del serbatoio in sala.
      valvole_protezione: ['S1.1', 'S1.2'],
    },
  ],
  filtri: [
    { codice: 'F1', marca: 'FRIULAIR', modello: 'PRE', n_fabbrica: 'F-001', anno: 2017, tipo: 'PREFILTRO' },
    { codice: 'F2', marca: 'FRIULAIR', modello: 'LIN', n_fabbrica: 'F-002', anno: 2017, tipo: 'LINEA' },
    { codice: 'F3', marca: 'FRIULAIR', modello: 'LIN', n_fabbrica: 'F-003', anno: 2017, tipo: 'LINEA' },
  ],
  recipienti_filtro: [],
  separatori: [
    { codice: 'SEP1', marca: 'JORC', modello: 'SEPREMIUM 10', n_fabbrica: 'SEP-001', anno: 2017 },
  ],
}

const additionalInfo: AdditionalInfo = {
  descrizioneAttivita: customer.descrizione_attivita ?? '',
  compressoriGiri: { C1: 'variabili', C2: 'variabili', C3: 'fissi' },
  spessimetrica: ['C2.1', 'S1'],
  collegamentiCompressoriSerbatoi: {
    C1: ['S1'],
    C2: ['S1'],
    C3: ['S2'],
  },
}

// Codice pratica: progressivo 1 → il documento è una revisione, e il motivo resta
// uno spazio evidenziato che il redattore compila in Word.
const pratica: PraticaInfo = {
  progressivo: 1,
  denominazioneSala: 'Sala Compressori Nord',
  impiantoUgualeSedeLegale: true,
  indirizzoImpianto: null,
}

const schemaImpianto = process.argv[3] ? leggiSchemaPng(process.argv[3]) : undefined

const model = buildRelazioneModel({ scheda, additionalInfo, customer, pratica, schemaImpianto })
writeFileSync(OUT, Buffer.from(renderRelazioneDocx(readFileSync(TEMPLATE), model)))
console.log(`Scritto ${OUT}`)
console.log(
  schemaImpianto
    ? `Schema §2.3: ${schemaImpianto.larghezzaPx}×${schemaImpianto.altezzaPx} px`
    : 'Schema §2.3: assente (paragrafo vuoto)'
)
console.log(
  `Righe: esiti ${model.esiti.length} · protezioni ${model.protezioni.serbatoi.length}+` +
    `${model.protezioni.altre.length} · riqualificazione ${model.riqualificazione.length} · ` +
    `fluidi ${model.fluidi.righe.length}`
)
console.log(`Aria non pulita → frase evidenziata: ${model.fluidi.evidenziaNocive}`)
console.log(`Tubazioni escluse (DN ≤ 80): ${model.tubazioni.escluse}`)
