/**
 * Fusione verticale di colonne di una tabella nel .docx renderizzato.
 *
 * Perché una post-elaborazione e non un tag di template: `vMerge` vive in `w:tcPr`,
 * cioè nelle proprietà della cella, non nel contenuto. Il loop di docxtemplater duplica
 * la riga identica — proprietà comprese — quindi tutte le righe generate porterebbero lo
 * stesso valore di `vMerge`. Non è esprimibile con un placeholder.
 *
 * Opera sull'XML appena reso, che ora nasce da un template scritto in Word: le celle sono
 * spezzate in più run e le intestazioni possono andare a capo. Per questo tabella e colonne
 * si cercano confrontando il testo **senza spazi** (vedi `normalizza`), non per uguaglianza
 * letterale né per posizione.
 *
 * Se la struttura non corrisponde a quanto atteso la funzione non modifica nulla: un
 * documento senza fusioni resta corretto e leggibile, uno con XML rotto no. La presenza
 * delle fusioni è verificata dai test sul template reale, che è ciò che intercetta una
 * modifica di struttura non accompagnata dall'aggiornamento di questo modulo.
 */

/** Cella vuota di continuazione: Word richiede almeno un paragrafo per cella. */
const PARAGRAFO_VUOTO = '<w:p/>'

/**
 * Confronto tollerante agli spazi: Word spezza volentieri un'intestazione su più righe o
 * più run («Verifica» / «Integrità»), e il testo estratto risulta concatenato senza
 * separatore. Ignorare del tutto gli spazi rende l'ancoraggio indipendente da come il
 * redattore ha impaginato la cella.
 */
function normalizza(testo: string): string {
  return testo.replace(/\s+/g, '')
}

/**
 * Individua la tabella la cui riga di intestazione contiene la cella indicata.
 * Presuppone tabelle non annidate, come sono tutte in questo documento.
 */
function trovaTabella(xml: string, testoIntestazione: string): { inizio: number; fine: number } | null {
  const ancora = normalizza(testoIntestazione)
  let cursore = 0

  while (true) {
    const inizio = xml.indexOf('<w:tbl>', cursore)
    if (inizio === -1) return null
    const chiusura = xml.indexOf('</w:tbl>', inizio)
    if (chiusura === -1) return null
    const fine = chiusura + '</w:tbl>'.length

    const righe = righeDi(xml.slice(inizio, fine))
    if (righe.length > 0) {
      const intestazione = celleDi(righe[0].xml).map((c) => normalizza(testoDi(c.xml)))
      if (intestazione.includes(ancora)) return { inizio, fine }
    }
    cursore = fine
  }
}

/** Spezza una tabella nelle sue righe, restituendo gli intervalli in ordine. */
function righeDi(tabella: string): Array<{ inizio: number; fine: number; xml: string }> {
  const out: Array<{ inizio: number; fine: number; xml: string }> = []
  const apertura = /<w:tr[ >]/g
  let m: RegExpExecArray | null
  while ((m = apertura.exec(tabella)) !== null) {
    const fine = tabella.indexOf('</w:tr>', m.index)
    if (fine === -1) break
    const fineAssoluta = fine + '</w:tr>'.length
    out.push({ inizio: m.index, fine: fineAssoluta, xml: tabella.slice(m.index, fineAssoluta) })
    apertura.lastIndex = fineAssoluta
  }
  return out
}

/** Spezza una riga nelle sue celle. */
function celleDi(riga: string): Array<{ inizio: number; fine: number; xml: string }> {
  const out: Array<{ inizio: number; fine: number; xml: string }> = []
  let cursore = 0
  for (;;) {
    const inizio = riga.indexOf('<w:tc>', cursore)
    if (inizio === -1) break
    const fine = riga.indexOf('</w:tc>', inizio)
    if (fine === -1) break
    const fineAssoluta = fine + '</w:tc>'.length
    out.push({ inizio, fine: fineAssoluta, xml: riga.slice(inizio, fineAssoluta) })
    cursore = fineAssoluta
  }
  return out
}

function testoDi(xml: string): string {
  return (xml.match(/<w:t[ >][^<]*/g) ?? [])
    .map((t) => t.replace(/^<w:t[^>]*>?/, ''))
    .join('')
    .trim()
}

/**
 * Inserisce un elemento `vMerge` nelle proprietà della cella. L'ordine degli elementi in
 * `w:tcPr` è vincolato dallo schema OOXML: `vMerge` va dopo `tcW`, prima di `shd` e
 * `vAlign`. Word rifiuta il documento se l'ordine non è rispettato.
 */
function conVMerge(cella: string, valore: 'restart' | 'continue'): string {
  const elemento =
    valore === 'restart' ? '<w:vMerge w:val="restart"/>' : '<w:vMerge/>'

  const fineTcW = cella.indexOf('/>', cella.indexOf('<w:tcW'))
  if (cella.indexOf('<w:tcW') === -1 || fineTcW === -1) return cella
  const punto = fineTcW + 2

  const conProprieta = cella.slice(0, punto) + elemento + cella.slice(punto)
  if (valore === 'restart') return conProprieta

  // Nelle celle di continuazione il contenuto non viene mostrato da Word: svuotarlo
  // evita che resti testo invisibile nel documento.
  const fineTcPr = conProprieta.indexOf('</w:tcPr>')
  if (fineTcPr === -1) return conProprieta
  const dopoTcPr = fineTcPr + '</w:tcPr>'.length
  return conProprieta.slice(0, dopoTcPr) + PARAGRAFO_VUOTO + '</w:tc>'
}

export interface FusioneColonne {
  /** Testo di una cella di intestazione che identifica univocamente la tabella */
  ancoraTabella: string
  /** Intestazioni delle colonne da fondere */
  intestazioniColonne: string[]
  /** Numero di righe di ciascun gruppo, nell'ordine di tabella */
  dimensioniGruppi: number[]
}

/**
 * Fonde verticalmente le colonne indicate, un blocco per gruppo.
 * Restituisce l'XML invariato se la struttura non corrisponde alle attese.
 */
export function applicaFusioneColonne(xml: string, opzioni: FusioneColonne): string {
  const { ancoraTabella, intestazioniColonne, dimensioniGruppi } = opzioni
  if (intestazioniColonne.length === 0 || dimensioniGruppi.length === 0) return xml

  const posizione = trovaTabella(xml, ancoraTabella)
  if (!posizione) return xml

  const tabella = xml.slice(posizione.inizio, posizione.fine)
  const righe = righeDi(tabella)
  if (righe.length < 2) return xml

  // La prima riga è l'intestazione: da lì si ricavano gli indici di colonna, così un
  // riordino delle colonne nel template non richiede modifiche qui.
  const intestazione = celleDi(righe[0].xml).map((c) => normalizza(testoDi(c.xml)))
  const indici = intestazioniColonne.map((t) => intestazione.indexOf(normalizza(t)))
  if (indici.some((i) => i === -1)) return xml

  const righeDati = righe.slice(1)
  const totaleAtteso = dimensioniGruppi.reduce((a, b) => a + b, 0)
  if (righeDati.length !== totaleAtteso) return xml

  // Mappa riga → ruolo nella fusione.
  const ruoli: Array<'restart' | 'continue' | null> = []
  for (const dimensione of dimensioniGruppi) {
    // Un gruppo di una sola riga non ha nulla da fondere.
    if (dimensione === 1) {
      ruoli.push(null)
      continue
    }
    ruoli.push('restart')
    for (let i = 1; i < dimensione; i += 1) ruoli.push('continue')
  }

  // Si riscrive dal fondo, così gli offset delle righe precedenti restano validi.
  let risultato = tabella
  for (let r = righeDati.length - 1; r >= 0; r -= 1) {
    const ruolo = ruoli[r]
    if (!ruolo) continue

    const riga = righeDati[r]
    const celle = celleDi(riga.xml)
    let rigaAggiornata = riga.xml
    for (const indice of [...indici].sort((a, b) => b - a)) {
      const cella = celle[indice]
      if (!cella) continue
      rigaAggiornata =
        rigaAggiornata.slice(0, cella.inizio) +
        conVMerge(cella.xml, ruolo) +
        rigaAggiornata.slice(cella.fine)
    }
    risultato =
      risultato.slice(0, riga.inizio) + rigaAggiornata + risultato.slice(riga.fine)
  }

  return xml.slice(0, posizione.inizio) + risultato + xml.slice(posizione.fine)
}
