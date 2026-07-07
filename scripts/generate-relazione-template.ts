/**
 * Genera una PRIMA VERSIONE del template Word per la relazione tecnica DM329,
 * già "taggato" per docxtemplater secondo src/services/relazione/TEMPLATE_TAGS.md.
 *
 * Output: public/templates/relazione-dm329.docx
 *
 * NON è la versione grafica definitiva: è un documento valido e funzionante da
 * aprire in Word per rifinire formattazione, loghi, intestazioni e testo statico.
 * Rigenerabile con:  npx tsx scripts/generate-relazione-template.ts
 */
import { mkdirSync, writeFileSync } from 'fs'
import { dirname, resolve } from 'path'
import PizZip from 'pizzip'

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Un run di testo (preserva gli spazi). */
function run(text: string, bold = false): string {
  const rPr = bold ? '<w:rPr><w:b/></w:rPr>' : ''
  return `<w:r>${rPr}<w:t xml:space="preserve">${esc(text)}</w:t></w:r>`
}

interface ParaOpts {
  bold?: boolean
  size?: number // half-points (es. 28 = 14pt)
  align?: 'center' | 'left'
  spacingBefore?: number
}

function para(text: string, opts: ParaOpts = {}): string {
  const props: string[] = []
  if (opts.align === 'center') props.push('<w:jc w:val="center"/>')
  if (opts.spacingBefore) props.push(`<w:spacing w:before="${opts.spacingBefore}"/>`)
  const runPropsSize = opts.size ? `<w:sz w:val="${opts.size}"/><w:szCs w:val="${opts.size}"/>` : ''
  const pPr = props.length || runPropsSize
    ? `<w:pPr>${props.join('')}${runPropsSize ? `<w:rPr>${runPropsSize}</w:rPr>` : ''}</w:pPr>`
    : ''
  const rPr =
    opts.bold || opts.size
      ? `<w:rPr>${opts.bold ? '<w:b/>' : ''}${runPropsSize}</w:rPr>`
      : ''
  return `<w:p>${pPr}<w:r>${rPr}<w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>`
}

/** Paragrafo con più run (per comporre frasi con tag consecutivi). */
function paraRuns(...runs: string[]): string {
  return `<w:p>${runs.join('')}</w:p>`
}

function heading(text: string): string {
  return para(text, { bold: true, size: 28, spacingBefore: 240 })
}

function title(text: string): string {
  return para(text, { bold: true, size: 32, align: 'center' })
}

/** Loop che produce paragrafi separati (pattern a 3 paragrafi di docxtemplater). */
function loopParas(tag: string, innerText: string): string {
  return para(`{#${tag}}`) + para(innerText) + para(`{/${tag}}`)
}

/** Tabella con riga d'intestazione + una riga-loop ripetuta per ogni elemento. */
function loopTable(headers: string[], loopTag: string, cells: string[]): string {
  const n = headers.length
  const colW = Math.floor(9000 / n)
  const grid = `<w:tblGrid>${Array.from({ length: n }, () => `<w:gridCol w:w="${colW}"/>`).join('')}</w:tblGrid>`
  const borders =
    '<w:tblBorders>' +
    ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
      .map((s) => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="000000"/>`)
      .join('') +
    '</w:tblBorders>'
  const tblPr = `<w:tblPr><w:tblW w:w="9000" w:type="dxa"/>${borders}</w:tblPr>`

  const cell = (content: string) =>
    `<w:tc><w:tcPr><w:tcW w:w="${colW}" w:type="dxa"/></w:tcPr>${content}</w:tc>`

  const headerRow =
    '<w:tr>' + headers.map((h) => cell(para(h, { bold: true }))).join('') + '</w:tr>'

  // Inietta apertura/chiusura loop nella prima/ultima cella
  const bodyCells = cells.map((c, i) => {
    let text = c
    if (i === 0) text = `{#${loopTag}}${text}`
    if (i === n - 1) text = `${text}{/${loopTag}}`
    return cell(paraRuns(run(text)))
  })
  const loopRow = '<w:tr>' + bodyCells.join('') + '</w:tr>'

  return `<w:tbl>${tblPr}${grid}${headerRow}${loopRow}</w:tbl>`
}

// ---------------------------------------------------------------------------
// Corpo del documento
// ---------------------------------------------------------------------------

const body: string[] = []

// --- Copertina ---
body.push(title('RELAZIONE TECNICA'))
body.push(title('IMPIANTO ARIA COMPRESSA'))
body.push(title('(ART. 6, COMMA 1, LETTERA B – D.M. 329/2004)'))
body.push(para(''))
body.push(para('Cliente {premessa.ragioneSociale}', { bold: true, size: 32, align: 'center' }))
body.push(para('{premessa.sedeLegale}', { align: 'center' }))
body.push(para(''))
body.push(para('Sito produttivo in', { bold: true, align: 'center' }))
body.push(para('{premessa.sitoProduttivo}', { align: 'center' }))
body.push(para(''))
body.push(para('Data sopralluogo: {dataSopralluogo}          Il Tecnico: {nomeTecnico}'))

// --- Premessa ---
body.push(heading('PREMESSA'))
body.push(
  para(
    'La presente relazione tecnica si riferisce all’impianto a pressione installato presso il ' +
      'sito produttivo della ditta: {premessa.ragioneSociale} con sede sociale in ' +
      '{premessa.sedeLegale}, esercente attività di {premessa.descrizioneAttivita}, ' +
      '{premessa.ubicazione}.'
  )
)
body.push(
  para(
    'Essa, coerentemente alla vigente normativa di settore (PED 2014/68/UE e D.M. 329/2004) è ' +
      'finalizzata a descrivere le condizioni di installazione e di esercizio e le misure di ' +
      'sicurezza adottate.'
  )
)
body.push(
  para(
    'L’impianto in oggetto non costituisce “impianto” o “insieme” così come definiti dalla PED e ' +
      'pertanto non risulta necessario l’intervento di un Organismo Notificato. Ogni componente ' +
      'installato risulta dotato di marcatura CE all’origine.'
  )
)
// Blocco condizionale revisione
body.push(para('{#premessa.haRevisione}'))
body.push(
  para(
    'L’attuale revisione del documento è conseguente alla {premessa.motivoRevisione}. Vengono ' +
      'verificati i requisiti di sicurezza nelle nuove condizioni operative.'
  )
)
body.push(para('{/premessa.haRevisione}'))
// Blocco condizionale spessimetrica
body.push(para('{#premessa.haSpessimetrica}'))
body.push(
  para(
    'Ove previsto in base alla tipologia di apparecchiatura ed alla periodicità stabilita ' +
      'dall’art. 3 del D.lgs. 93/2000, sono state effettuate le verifiche di integrità tramite ' +
      'Controllo Ultrasonoro Spessimetrico, che in tutti i casi hanno fornito esito positivo.'
  )
)
body.push(para('{/premessa.haSpessimetrica}'))

// --- Descrizione generale ---
body.push(heading('DESCRIZIONE GENERALE DELL’IMPIANTO'))
body.push(
  para(
    'L’impianto in oggetto è finalizzato alla produzione e distribuzione di aria compressa a ' +
      'servizio delle utenze di produzione. Esso è costituito dalle seguenti sezioni principali:'
  )
)
body.push(loopParas('descrizioneGenerale.sezioni', '-\t{voce}'))
body.push(para('{descrizioneGenerale.fraseArea}'))
body.push(para('{#descrizioneGenerale.haLocaleDedicato}'))
body.push(para('{descrizioneGenerale.paragrafoLocaleDedicato}'))
body.push(para('{/descrizioneGenerale.haLocaleDedicato}'))

// --- Caratterizzazione ---
body.push(heading('CARATTERIZZAZIONE DELLE APPARECCHIATURE'))
body.push(
  para(
    'Lo schema sotto riportato rappresenta i principali elementi che compongono l’impianto e la ' +
      'loro logica di assemblaggio:'
  )
)
body.push(para('SCHEMA', { bold: true, align: 'center' }))
body.push(para(''))
body.push(
  para('La tabella seguente riassume le caratteristiche delle principali apparecchiature:')
)
body.push(
  loopTable(
    ['Pos.', 'Descrizione', 'Costruttore e Modello', 'Capacità / Portata', 'Pressione', 'Temp.', 'Cat.', 'Anno', 'N. fabbrica'],
    'caratteristiche',
    ['{pos}', '{descrizione}', '{costruttore} {modello}', '{capacita}', '{pressione}', '{temperatura}', '{categoria}', '{anno}', '{nFabbrica}']
  )
)
body.push(para(''))
body.push(para('La tabella che segue identifica la procedura ai sensi del D.M. 329/2004:'))
body.push(
  loopTable(
    ['Pos.', 'Descrizione', 'Costruttore e Modello', 'N. fabbrica', 'Dichiaraz. messa in servizio', 'Verifica messa in servizio'],
    'procedura',
    ['{pos}', '{descrizione}', '{costruttore} {modello}', '{nFabbrica}', '{dichiarazioneMark}', '{verificaMark}']
  )
)

// --- Classificazione ---
body.push(heading('CLASSIFICAZIONE DELLE APPARECCHIATURE E RELATIVI SISTEMI DI PROTEZIONE'))
body.push(para('Compressori:', { bold: true }))
body.push(para('{classificazione.compressori.testo}'))
body.push(para('Essiccatore a ciclo frigorifero:', { bold: true }))
body.push(para('{classificazione.essiccatori.testo}'))
body.push(para('Serbatoi di accumulo:', { bold: true }))
body.push(para('{classificazione.serbatoi.testo}'))
body.push(
  para(
    'Tubazioni: tutte le tubazioni destinate a contenere aria compressa hanno DN ≤ 80 mm e ' +
      'pertanto escluse dal campo di applicazione del D.M. 329/2004 ai sensi dell’art. 3 comma bb).'
  )
)

// --- Verifica valvole ---
body.push(heading('VERIFICA DELLE VALVOLE DI SICUREZZA'))
body.push(
  para(
    'Le valvole di sicurezza sono in grado di scaricare, alla pressione di taratura, portate ' +
      'superiori alle massime portate elaborabili dai compressori:'
  )
)
body.push(
  loopTable(
    ['Pos. valvola', 'N. fabbrica', 'Apparecchiature connesse', 'Portata max da elaborare', 'Portata scaricata alla taratura', 'Adeguato'],
    'valvole.portata',
    ['{posValvola}', '{nFabbricaValvola}', '{#connesse}{pos} - {descrizione} {costruttore} {modello}; {/connesse}', '{portataMax}', '{portataScaricata}', '{adeguatoMark}']
  )
)
body.push(para(''))
body.push(para('La pressione di taratura delle valvole risulta adeguata alle massime pressioni ammissibili:'))
body.push(
  loopTable(
    ['Pos. valvola', 'N. fabbrica', 'Recipiente associato', 'PS recipiente', 'Pressione di taratura', 'Adeguato'],
    'valvole.pressione',
    ['{posValvola}', '{nFabbricaValvola}', '{#connesse}{pos} - {descrizione} {costruttore} {modello}{/connesse}', '{psRecipiente}', '{pressioneTaratura}', '{adeguatoMark}']
  )
)

// --- Verifiche periodiche (testo statico, da completare con la tabella dell'Allegato B) ---
body.push(heading('VERIFICHE PERIODICHE'))
body.push(
  para(
    'Le attrezzature rientranti nel campo di applicazione del D.M. 329/2004 sono soggette, in base ' +
      'all’art. 10, commi 3 e 5, all’obbligo di riqualificazione periodica secondo le frequenze ' +
      'indicate nell’Allegato B (da riportare in questa sezione come tabella statica).'
  )
)

// --- Allegati ---
body.push(heading('ALLEGATI'))
body.push(loopParas('allegati', '-\t{voce}'))

// ---------------------------------------------------------------------------
// Assemblaggio del .docx
// ---------------------------------------------------------------------------

const documentXml =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<w:document xmlns:w="${W}"><w:body>${body.join('')}` +
  `<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>` +
  `</w:body></w:document>`

const zip = new PizZip()
zip.file(
  '[Content_Types].xml',
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
    `</Types>`
)
zip.file(
  '_rels/.rels',
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
    `</Relationships>`
)
zip.file('word/document.xml', documentXml)

const outPath = resolve(process.cwd(), 'public/templates/relazione-dm329.docx')
mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, zip.generate({ type: 'nodebuffer' }))
console.log('Template generato:', outPath)
