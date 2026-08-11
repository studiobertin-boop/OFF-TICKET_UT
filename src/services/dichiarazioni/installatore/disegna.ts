/**
 * Disegno della dichiarazione installatore: per ogni pagina calcolata da `impagina`, copia lo
 * sfondo (carta intestata) dal template e disegna sopra testo e campi con pdf-lib.
 *
 * Struttura e testo ricalcano fedelmente due dichiarazioni reali già emesse da Officina del
 * Compressore: paragrafo introduttivo con l'anagrafica del legale rappresentante, elenco
 * puntato delle apparecchiature (etichetta seguita da puntini di riempimento e valore
 * allineato a destra, non una tabella a colonne), e chiusura con i due paragrafi legali fissi
 * "DICHIARA INOLTRE"/"DECLINA" prima della firma.
 *
 * Font WinAnsi (Helvetica/HelveticaBold): copre gli accenti italiani, niente `fontkit` da
 * incorporare. Nessuna dipendenza da `<canvas>`/browser: gira in Node, quindi è testabile in
 * Vitest puro e riusabile da uno script CLI di esempio.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import type { Pagina } from './impagina'

export interface DatiInstallatore {
  nome: string
  legale_rappresentante: string
  legale_rappresentante_nascita_luogo: string
  legale_rappresentante_nascita_data: string
  legale_rappresentante_residenza_via: string
  legale_rappresentante_residenza_comune: string
  legale_rappresentante_residenza_provincia: string
  partita_iva: string
  via: string
  numero_civico: string
  cap: string
  comune: string
  provincia: string
  posizione_inail: string
  telefono: string
  pec: string
}

export interface DatiDichiarazioneInstallatore {
  installer: DatiInstallatore
  customer: { nome: string }
  /** Indirizzo del sito produttivo dove sono installate le apparecchiature. */
  sitoProduttivo: string
  data: string
  luogo?: string
  /** Timbro + firma del legale rappresentante (PNG). Disegnato solo sull'ultima pagina. */
  firma?: Uint8Array | ArrayBuffer
}

const MARGINE = 55
/** Oltre questo punto nessun campo può scrivere: margine destro del foglio. */
const BORDO_DESTRO = 545
const BORDO_INFERIORE = 40
const RIGA_ALTEZZA = 14

/** Livelli di rientro dell'elenco puntato. */
const INDENT_CAMPO = MARGINE + 14
const INDENT_DOTATO_DI = MARGINE + 30
const INDENT_CAMPO_DIPENDENTE = MARGINE + 55

/**
 * Distanza dal bordo superiore del foglio a cui inizia il contenuto, misurata sul template
 * reale della carta intestata Officina del Compressore (`dichiarazione-installatore-sfondo.pdf`,
 * A4 verticale 595×842pt): loghi fino a y=806pt, testo/riga fino a y=704pt — cioè 138pt dal
 * bordo superiore. 165 lascia un margine di sicurezza di circa 27pt sotto la riga. Valore
 * assoluto tarato su *questo* template: se cambia, va rimisurato con pdf.js.
 */
const Y_SOTTO_INTESTAZIONE = 165

/** Dimensioni del timbro+firma sul foglio: originale 494×186px, scalato mantenendo il rapporto. */
const FIRMA_LARGHEZZA = 150
const FIRMA_ALTEZZA = (FIRMA_LARGHEZZA * 186) / 494

/**
 * Spazio riservato al blocco di chiusura (campi sito produttivo, i due paragrafi legali fissi,
 * data/firma/timbro, nota allegato): se quel che resta dell'ultima pagina non basta, il blocco
 * si sposta su una pagina dedicata piuttosto che sconfinare. Stima prudente per eccesso — uno
 * spreco di mezza pagina in un caso raro costa meno di un documento legale con la firma
 * sovrapposta al testo.
 */
const CHIUSURA_ALTEZZA_RISERVATA = 340

const testo = (
  pagina: PDFPage,
  contenuto: string,
  x: number,
  y: number,
  font: PDFFont,
  dimensione = 9.5
) => {
  pagina.drawText(contenuto, { x, y, size: dimensione, font, color: rgb(0, 0, 0) })
}

const testoCentrato = (
  pagina: PDFPage,
  contenuto: string,
  y: number,
  font: PDFFont,
  dimensione: number
) => {
  const larghezza = font.widthOfTextAtSize(contenuto, dimensione)
  const x = MARGINE + (BORDO_DESTRO - MARGINE - larghezza) / 2
  testo(pagina, contenuto, Math.max(MARGINE, x), y, font, dimensione)
}

/**
 * Riduce il corpo di `testo` finché la sua larghezza a quel corpo non entra in
 * `larghezzaMax`, senza scendere sotto `minimo`. Rete di sicurezza per i dati reali (ragioni
 * sociali, indirizzi) che i campi, per quanto generosi, non hanno modo di prevedere in anticipo
 * — meglio un carattere più piccolo che un valore sconfinato oltre il bordo.
 */
export const dimensioneAdattata = (
  font: PDFFont,
  testo: string,
  larghezzaMax: number,
  dimensione: number,
  minimo = 6
): number => {
  let d = dimensione
  while (d > minimo && font.widthOfTextAtSize(testo, d) > larghezzaMax) {
    d -= 0.5
  }
  return Math.max(d, minimo)
}

/**
 * Spezza `testo` in righe che stanno entro `larghezzaMax`, andando a capo per parola intera.
 * Serve al paragrafo introduttivo e ai due paragrafi legali fissi, entrambi troppo lunghi per
 * una riga sola e di lunghezza non prevedibile in anticipo (l'introduttivo contiene ragione
 * sociale e indirizzo dell'installatore).
 */
export const spezzaRighe = (font: PDFFont, testo: string, dimensione: number, larghezzaMax: number): string[] => {
  const parole = testo.split(' ')
  const righe: string[] = []
  let corrente = ''
  for (const parola of parole) {
    const prova = corrente ? `${corrente} ${parola}` : parola
    if (corrente && font.widthOfTextAtSize(prova, dimensione) > larghezzaMax) {
      righe.push(corrente)
      corrente = parola
    } else {
      corrente = prova
    }
  }
  if (corrente) righe.push(corrente)
  return righe
}

const disegnaParagrafo = (pagina: PDFPage, font: PDFFont, testoCompleto: string, xIniziale: number, y: number, dimensione = 9.5): number => {
  let yy = y
  for (const riga of spezzaRighe(font, testoCompleto, dimensione, BORDO_DESTRO - xIniziale)) {
    testo(pagina, riga, xIniziale, yy, font, dimensione)
    yy -= RIGA_ALTEZZA
  }
  return yy
}

/** Un campo "Etichetta: ..........valore" con puntini di riempimento fino al valore, allineato a destra. */
const campoConPuntini = (
  pagina: PDFPage,
  font: PDFFont,
  label: string,
  valore: string,
  xLabel: number,
  y: number,
  dimensione = 9.5
) => {
  testo(pagina, label, xLabel, y, font, dimensione)
  const xDopoLabel = xLabel + font.widthOfTextAtSize(label, dimensione) + 3

  const dValore = dimensioneAdattata(font, valore, BORDO_DESTRO - xDopoLabel - 20, dimensione)
  const larghezzaValore = font.widthOfTextAtSize(valore, dValore)
  const xValore = BORDO_DESTRO - larghezzaValore
  testo(pagina, valore, xValore, y, font, dValore)

  const xFinePuntini = xValore - 3
  if (xFinePuntini > xDopoLabel) {
    const larghezzaPunto = font.widthOfTextAtSize('.', dimensione)
    const nPuntini = Math.max(0, Math.floor((xFinePuntini - xDopoLabel) / larghezzaPunto))
    if (nPuntini > 0) testo(pagina, '.'.repeat(nPuntini), xDopoLabel, y, font, dimensione)
  }
}

const disegnaIntestazioneIniziale = (
  pagina: PDFPage,
  font: PDFFont,
  fontBold: PDFFont,
  dati: DatiDichiarazioneInstallatore,
  yIniziale: number
): number => {
  let y = yIniziale
  testoCentrato(pagina, 'DICHIARAZIONE SOSTITUTIVA DELL’ATTO DI NOTORIETÀ', y, fontBold, 12)
  y -= RIGA_ALTEZZA * 1.3
  testoCentrato(pagina, '(Ai sensi del DPR445/2000)', y, font, 9.5)
  y -= RIGA_ALTEZZA * 1.8

  const { installer } = dati
  const intro =
    `Il sottoscritto, ${installer.legale_rappresentante} nato a ${installer.legale_rappresentante_nascita_luogo} ` +
    `il ${installer.legale_rappresentante_nascita_data}, residente in ${installer.legale_rappresentante_residenza_comune} ` +
    `(${installer.legale_rappresentante_residenza_provincia}), ${installer.legale_rappresentante_residenza_via}, ` +
    `in qualità di legale rappresentante della ditta: ${installer.nome} con sede in ${installer.via} nr. ${installer.numero_civico} ` +
    `– ${installer.cap} ${installer.comune} (${installer.provincia}), partita iva/codice fiscale ${installer.partita_iva}, ` +
    `posizione I.N.A.I.L. ${installer.posizione_inail}, tel. ${installer.telefono} ed indirizzo pec ${installer.pec}`
  y = disegnaParagrafo(pagina, font, intro, MARGINE, y)
  y -= RIGA_ALTEZZA * 0.8

  testoCentrato(pagina, 'DICHIARA', y, fontBold, 10.5)
  y -= RIGA_ALTEZZA * 1.6
  testo(pagina, 'Che l’installazione delle seguenti apparecchiature a pressione:', MARGINE, y, font)
  y -= RIGA_ALTEZZA * 1.4

  return y
}

const disegnaCampiApparecchiatura = (
  pagina: PDFPage,
  font: PDFFont,
  y: number,
  xLabel: number,
  riga: { tipo: string; marca?: string; modello?: string; n_fabbrica?: string }
): number => {
  let yy = y
  campoConPuntini(pagina, font, 'Tipologia apparecchiatura:', riga.tipo, xLabel, yy)
  yy -= RIGA_ALTEZZA
  campoConPuntini(pagina, font, 'Costruttore:', riga.marca ?? '', xLabel, yy)
  yy -= RIGA_ALTEZZA
  campoConPuntini(pagina, font, 'Modello:', riga.modello ?? '', xLabel, yy)
  yy -= RIGA_ALTEZZA
  campoConPuntini(pagina, font, 'Numero di Fabbrica:', riga.n_fabbrica ?? '', xLabel, yy)
  yy -= RIGA_ALTEZZA
  return yy
}

/** Un gruppo (principale + dipendente) o una riga standalone, nel formato a elenco puntato. */
const disegnaGruppo = (
  pagina: PDFPage,
  font: PDFFont,
  y: number,
  riga: Pagina['righe'][number]
): number => {
  let yy = y
  // '▪' (U+25AA) non è codificabile in WinAnsi, l'unica codifica che pdf-lib usa per i font
  // standard: '•' (U+2022, BULLET) sì.
  testo(pagina, '•', MARGINE, yy, font, 9.5)
  yy = disegnaCampiApparecchiatura(pagina, font, yy, INDENT_CAMPO, riga.principale ?? riga.dipendente)

  if (riga.principale) {
    testo(pagina, 'dotato di:', INDENT_DOTATO_DI, yy, font, 9.5)
    yy -= RIGA_ALTEZZA
    yy = disegnaCampiApparecchiatura(pagina, font, yy, INDENT_CAMPO_DIPENDENTE, riga.dipendente)
  }

  return yy - RIGA_ALTEZZA * 0.5
}

/**
 * Sito produttivo, i due paragrafi legali fissi, data/firma/timbro e nota allegato: sempre in
 * fondo, sempre nello stesso ordine, indipendentemente da quante apparecchiature precedono.
 */
const disegnaChiusura = async (
  out: PDFDocument,
  pagina: PDFPage,
  font: PDFFont,
  fontBold: PDFFont,
  dati: DatiDichiarazioneInstallatore,
  yIniziale: number
) => {
  let y = yIniziale

  campoConPuntini(pagina, font, 'Installate presso il sito produttivo di', dati.sitoProduttivo, MARGINE, y)
  y -= RIGA_ALTEZZA
  campoConPuntini(pagina, fontBold, 'della ditta', dati.customer.nome, MARGINE, y)
  y -= RIGA_ALTEZZA * 1.3
  y = disegnaParagrafo(
    pagina, font,
    'è stata eseguita in conformità ai manuali d’uso dei costruttori (rif. Dm329/2004, art.6, comma 1, lett. C).',
    MARGINE, y
  )
  y -= RIGA_ALTEZZA * 0.8

  testoCentrato(pagina, 'DICHIARA INOLTRE', y, fontBold, 10.5)
  y -= RIGA_ALTEZZA * 1.6
  y = disegnaParagrafo(
    pagina, font,
    'di essere consapevole delle sanzioni penali, previste in caso di dichiarazioni non veritiere e di ' +
      'falsità negli atti e della conseguente decadenza dai benefici di cui gli art. 75 e 76 del DPR ' +
      '445/2000, di essere informato che i dati personali raccolti saranno trattati anche con mezzi ' +
      'informatici, esclusivamente per il procedimento per il quale la dichiarazione viene resa (aet.13 ' +
      'D.Lgs196/2003)',
    MARGINE, y
  )
  y -= RIGA_ALTEZZA * 0.8

  testoCentrato(pagina, 'DECLINA', y, fontBold, 10.5)
  y -= RIGA_ALTEZZA * 1.6
  y = disegnaParagrafo(
    pagina, font,
    'Si declina ogni responsabilita’ per sinistri a persone o cose derivanti da manomissioni ' +
      'dell’impianto da parte di terzi, ovvero da carenze di attività manutentive o di riparazione ' +
      'affidate a terzi.',
    MARGINE, y
  )
  y -= RIGA_ALTEZZA * 2

  const xFirma = BORDO_DESTRO - FIRMA_LARGHEZZA
  const luogoData = [dati.luogo, dati.data].filter(Boolean).join(' lì ')
  testo(pagina, luogoData, MARGINE, y, font, 10)
  testo(pagina, 'Firma del Dichiarante *', xFirma, y, fontBold, 9.5)
  y -= FIRMA_ALTEZZA + 4

  if (dati.firma) {
    const immagine = await out.embedPng(new Uint8Array(dati.firma as ArrayBuffer))
    pagina.drawImage(immagine, { x: xFirma, y, width: FIRMA_LARGHEZZA, height: FIRMA_ALTEZZA })
  }
  y -= RIGA_ALTEZZA

  testo(pagina, '*ALLEGATO: alla fotocopia documento di riconoscimento del sottoscrittore (art. 38 D.P.R. 445/2000).', MARGINE, y, font, 8)
}

/**
 * Disegna la dichiarazione installatore su tante pagine quante ne calcola `impagina`, più — se
 * serve — una pagina in più per la sola chiusura, quando non entra in fondo all'ultima.
 */
export async function disegnaDichiarazioneInstallatore(
  pagine: Pagina[],
  templateBytes: Uint8Array | ArrayBuffer,
  dati: DatiDichiarazioneInstallatore
): Promise<Uint8Array> {
  const out = await PDFDocument.create()
  const font = await out.embedFont(StandardFonts.Helvetica)
  const fontBold = await out.embedFont(StandardFonts.HelveticaBold)

  if (pagine.length === 0) {
    return out.save()
  }

  const template = await PDFDocument.load(new Uint8Array(templateBytes as ArrayBuffer))
  const [sfondo] = await out.embedPdf(template, [0])
  const { width: larghezza, height: altezza } = sfondo.size()

  const nuovaPagina = () => {
    const pagina = out.addPage([larghezza, altezza])
    pagina.drawPage(sfondo, { x: 0, y: 0, width: larghezza, height: altezza })
    return pagina
  }

  let paginaCorrente: PDFPage = nuovaPagina()
  let y = altezza - Y_SOTTO_INTESTAZIONE

  for (const p of pagine) {
    if (!p.continuazione) {
      y = disegnaIntestazioneIniziale(paginaCorrente, font, fontBold, dati, y)
    }
    for (const riga of p.righe) {
      y = disegnaGruppo(paginaCorrente, font, y, riga)
    }

    if (p === pagine[pagine.length - 1]) {
      if (y - CHIUSURA_ALTEZZA_RISERVATA < BORDO_INFERIORE) {
        paginaCorrente = nuovaPagina()
        y = altezza - Y_SOTTO_INTESTAZIONE
      }
      await disegnaChiusura(out, paginaCorrente, font, fontBold, dati, y)
    } else {
      paginaCorrente = nuovaPagina()
      y = altezza - Y_SOTTO_INTESTAZIONE
    }
  }

  return out.save()
}
