/**
 * Render dello schema posizionato in una stringa SVG autonoma (nessun DOM: funzione pura,
 * testabile in Node e rasterizzabile nel browser da `rasterize.ts`).
 *
 * Il disegno riproduce l'impaginazione delle relazioni storiche: schema in alto, nota sui
 * diametri delle tubazioni, tabella "Lista Apparecchiature" in basso.
 */
import { corpoNodo, dimensioniLayout, quoteInstradamento } from './layout'
import type { Tarature } from './libreria'
import {
  ancoraDi,
  campioneTubazione,
  escapeXml,
  frecciaDirezione,
  latoImposto,
  riduttorePressione,
  simboloDi,
  simboloMuro,
  testoMultiRiga,
  valvolaIntercettazione,
  valvolaScarico,
  FONT,
  TESTO_LIBERO,
  TRATTO,
  TRATTEGGIO_CONDENSE,
} from './symbols'
import {
  instrada,
  ondula,
  percorso,
  puntoSuTratto,
  quoteAttraversamento,
  tronconi,
  type Punto,
  type QuoteInstradamento,
} from './tratti'
import type {
  SchemaArcoStile,
  SchemaLayout,
  SchemaNodoPosizionato,
  SchemaNodoTipo,
  SchemaSegnoTubo,
  SchemaTestoLibero,
} from './types'

export type { Punto }

const MARGINE = 40
const RIGA_TABELLA = 34
const COLONNA_CODICE = 130
const ALTEZZA_NOTA = 90

/**
 * Posizione assoluta di un'ancora del nodo, in coordinate del disegno. Fallisce piano: se
 * l'ancora non esiste (dato incoerente), ripiega sul centro del corpo invece di produrre
 * coordinate NaN che spaccherebbero la polilinea.
 */
export function posizioneAncora(nodo: SchemaNodoPosizionato, ancoraId: string, libreria: Tarature = {}): Punto {
  const ancora = ancoraDi(nodo, ancoraId, libreria)
  if (!ancora) {
    const corpo = corpoNodo(nodo, libreria)
    return { x: corpo.x + corpo.larghezza / 2, y: corpo.y + corpo.altezza / 2 }
  }
  return { x: nodo.x + ancora.x, y: nodo.y + ancora.y }
}

export interface RenderSvgOptions {
  /** Nota sui diametri, es. "Collegamenti effettuati con tubazioni da Ø40 a Ø63mm". */
  noteTubazioni?: string[]
}

/**
 * Un arco disegnato. La FORMA la decide `instrada` (tratti.ts), condivisa con la tela dell'editor
 * — che la chiama tramite `polilineaDellArco` (`conversioneFlow.ts`, cablata in
 * `SchemaEdgeTubazione.tsx`): qui resta la resa.
 *
 * Dal 17-08-2026 la resa può cambiare lungo il tubo: i segni che dichiarano uno `stileAValle` lo
 * dividono in tronconi, ognuno col proprio tratto. Senza cambi è un `<path>` solo, identico a
 * prima — ed è la ragione per cui i riferimenti SVG committati non si sono mossi.
 *
 * La rotta resta quella dello stile dell'ARCO: `instrada` la sceglie una volta (il flessibile
 * scende al collettore, la condensa corre sulla propria corsia, la linea va dritta), e i tronconi
 * non la ridiscutono. Cambia il tratto disegnato, non il tragitto.
 *
 * Fino a questa data erano tre funzioni — `renderMandataCompressore`, `renderMandataLinea`,
 * `renderLineaCondense` — che calcolavano la stessa polilinea e si distinguevano solo nell'ultima
 * riga: quella differenza vive ora in `trattoSvg`, una volta per troncone.
 */
function renderArco(
  da: SchemaNodoPosizionato,
  ancoraDa: string,
  a: SchemaNodoPosizionato,
  ancoraA: string,
  stile: SchemaArcoStile,
  quote: QuoteInstradamento,
  gomiti: Punto[] | undefined,
  segni: SchemaSegnoTubo[],
  libreria: Tarature = {}
): { svg: string; punti: Punto[] } {
  const pDa = posizioneAncora(da, ancoraDa, libreria)
  const pA = posizioneAncora(a, ancoraA, libreria)
  const punti = instrada(stile, pDa, pA, gomiti, quote, {
    da: latoImposto(da, ancoraDa, libreria),
    a: latoImposto(a, ancoraA, libreria),
  })
  const svg = tronconi(punti, stile, segni)
    .map((tratto) => trattoSvg(tratto.punti, tratto.stile))
    .join('')
  return { svg, punti }
}

/** Il tracciato di un troncone, col tratto del suo tipo. */
function trattoSvg(punti: Punto[], stile: SchemaArcoStile): string {
  if (stile === 'flessibile') {
    return `<path d="${ondula(punti)}" fill="none" stroke="#000" stroke-width="${TRATTO}" />`
  }
  const tratteggio = stile === 'condensa' ? ` stroke-dasharray="${TRATTEGGIO_CONDENSE}"` : ''
  return `<path d="${percorso(punti)}" fill="none" stroke="#000" stroke-width="${TRATTO}"${tratteggio} />`
}

/**
 * Disegno delle tubazioni, insieme alle quote a cui attraversano il muro (se c'è).
 *
 * I segni (valvola di intercettazione, riduttore di pressione) si disegnano qui e non dentro le
 * funzioni `renderMandata*`: la loro posizione dipende dalla polilinea RESA (`reso.punti`, dopo
 * i gomiti automatici), non da quella richiesta, e solo qui la si conosce già calcolata.
 */
function renderArchi(
  layout: SchemaLayout,
  quote: QuoteInstradamento,
  libreria: Tarature = {}
): { svg: string; varchi: number[] } {
  const indice = new Map(layout.nodi.map((n) => [n.id, n]))
  const parti: string[] = []
  const varchi: number[] = []

  for (const arco of layout.archi) {
    const da = indice.get(arco.da.nodo)
    const a = indice.get(arco.a.nodo)
    if (!da || !a) continue

    const reso = renderArco(
      da,
      arco.da.ancora,
      a,
      arco.a.ancora,
      arco.stile,
      quote,
      arco.punti,
      arco.segni ?? [],
      libreria
    )

    parti.push(reso.svg)
    for (const segno of arco.segni ?? []) {
      const { punto, orizzontale, direzione } = puntoSuTratto(reso.punti, segno.t)
      // La freccia prende la direzione: le serve il verso, che `orizzontale` non porta.
      if (segno.tipo === 'freccia_direzione') {
        parti.push(frecciaDirezione(punto.x, punto.y, direzione))
        continue
      }
      const disegnaSegno = segno.tipo === 'riduttore_pressione' ? riduttorePressione : valvolaIntercettazione
      parti.push(disegnaSegno(punto.x, punto.y, orizzontale ? 'orizzontale' : 'verticale'))
    }
    if (layout.muro) varchi.push(...quoteAttraversamento(reso.punti, layout.muro.x))
  }

  return { svg: parti.join(''), varchi }
}

/**
 * La colonna di sinistra della tabella porta due cose diverse: il codice di un'apparecchiatura,
 * o il disegno di un simbolo che la legenda spiega. Un tipo che le distingue evita di dedurre
 * dal contenuto quale delle due sia.
 */
export type CellaSinistra = { codice: string } | { simbolo: string }

export interface RigaTabella {
  sinistra: CellaSinistra
  descrizione: string
}

/** Tipi di nodo il cui simbolo disegna la valvola di scarico. Il commento in testa a `types.ts`
 *  elencava anche separatore e disoleatore: `simboloSeparatore` la esclude di proposito
 *  e il compressore non la disegna affatto. */
const CON_VALVOLA_SCARICO: SchemaNodoTipo[] = ['serbatoio', 'essiccatore', 'filtro']

/**
 * Righe della tabella: apparecchiature e loro accessori/valvole. L'ordine è quello del flusso
 * dell'aria (compressori → serbatoi → trattamento → raccolta), lo stesso in cui il layout
 * dispone i nodi e in cui le legge chi confronta il disegno con la lista. L'ordine alfabetico
 * dei codici spezzerebbe quella corrispondenza (SEP prima di S, la raccolta in mezzo ai filtri).
 */
export function righeLista(layout: SchemaLayout): RigaTabella[] {
  const righe: RigaTabella[] = []
  for (const nodo of layout.nodi) {
    // Il terminale utenze è un raccordo, non un'apparecchiatura: non ha codice né marca, e in
    // tabella occuperebbe una riga che non dice nulla. La legenda spiegherà i simboli, non lui.
    if (nodo.tipo === 'utenze' || nodo.tipo === 'giunzione') continue
    righe.push({ sinistra: { codice: nodo.id }, descrizione: nodo.etichetta })
    if (nodo.accessorio) {
      righe.push({ sinistra: { codice: nodo.accessorio.codice }, descrizione: nodo.accessorio.etichetta })
      for (const v of nodo.accessorio.valvoleSicurezza) {
        righe.push({ sinistra: { codice: v.codice }, descrizione: v.etichetta })
      }
    }
    for (const v of nodo.valvoleSicurezza) {
      righe.push({ sinistra: { codice: v.codice }, descrizione: v.etichetta })
    }
  }
  return righe
}

/**
 * Legenda dei simboli, in coda alla lista apparecchiature come negli schemi del committente
 * (`DOCUMENTAZIONE/relazione/schema.png`): il simbolo al posto del codice, il suo nome accanto.
 *
 * Compaiono solo i simboli che il disegno contiene davvero — una legenda che spiega ciò che non
 * c'è fa cercare al lettore qualcosa che non troverà. La valvola di sicurezza resta fuori: ha
 * già la sua riga con codice, marca e modello, e la legenda spiega solo ciò che nessuna riga
 * codificata identifica.
 */
export function righeLegenda(layout: SchemaLayout): RigaTabella[] {
  // Anche i tipi che entrano da un cambio a metà tubo (`stileAValle`): senza, un disegno con un
  // troncone flessibile su un tubo rigido mostrerebbe una legenda che il disegno smentisce.
  const stili = new Set([
    ...layout.archi.map((a) => a.stile),
    ...layout.archi.flatMap((a) => (a.segni ?? []).flatMap((s) => (s.stileAValle ? [s.stileAValle] : []))),
  ])
  const segni = layout.archi.flatMap((a) => a.segni ?? [])
  const righe: RigaTabella[] = []

  // La disegnano le mandate: nessuna linea condense la porta. Ma la presenza in legenda si
  // legge dai segni veri posati sull'arco, non dallo stile — la disegnano le mandate solo
  // indirettamente, tramite il segno che `buildSchemaModel` semina (Task 5).
  if (segni.some((s) => s.tipo === 'valvola_intercettazione')) {
    righe.push({ sinistra: { simbolo: valvolaIntercettazione(0, 0) }, descrizione: 'Valvola di intercettazione' })
  }
  if (segni.some((s) => s.tipo === 'riduttore_pressione')) {
    righe.push({ sinistra: { simbolo: riduttorePressione(0, 0) }, descrizione: 'Riduttore di pressione' })
  }
  // Il campione punta a destra: nel disegno la freccia segue il tratto, in legenda sta da sola e
  // deve solo farsi riconoscere.
  if (segni.some((s) => s.tipo === 'freccia_direzione')) {
    righe.push({ sinistra: { simbolo: frecciaDirezione(0, 0, { x: 1, y: 0 }) }, descrizione: 'Direzione del flusso' })
  }
  if (layout.nodi.some((n) => CON_VALVOLA_SCARICO.includes(n.tipo))) {
    // Le due misure (Task 3) non hanno una riga di legenda ciascuna: quella del serbatoio, se
    // presente, è la più rappresentativa — un disegno senza serbatoi la disegna nella misura
    // dei rombi/filtri, l'unica che ha.
    const misura = layout.nodi.some((n) => n.tipo === 'serbatoio') ? 'serbatoio' : 'apparecchio'
    righe.push({ sinistra: { simbolo: valvolaScarico(0, -4, misura) }, descrizione: 'Valvola di scarico' })
  }
  if (stili.has('standard')) {
    righe.push({ sinistra: { simbolo: campioneTubazione('standard') }, descrizione: 'Tubazione rigida' })
  }
  if (stili.has('flessibile')) {
    righe.push({ sinistra: { simbolo: campioneTubazione('flessibile') }, descrizione: 'Tubazione flessibile' })
  }
  if (stili.has('condensa')) {
    righe.push({ sinistra: { simbolo: campioneTubazione('condensa') }, descrizione: 'Linea condense' })
  }

  return righe
}

function renderTabella(righe: RigaTabella[], larghezza: number, yTop: number): string {
  const x = MARGINE
  const w = larghezza - MARGINE * 2
  const parti: string[] = []

  parti.push(
    `<rect x="${x}" y="${yTop}" width="${w}" height="${RIGA_TABELLA}" fill="none" stroke="#000" stroke-width="${TRATTO}" />`,
    `<text x="${x + w / 2}" y="${yTop + RIGA_TABELLA / 2}" font-family="${FONT}" font-size="20" text-anchor="middle" dominant-baseline="central" fill="#000">LISTA APPARECCHIATURE</text>`
  )

  righe.forEach((riga, i) => {
    const y = yTop + RIGA_TABELLA * (i + 1)
    // La cella di sinistra ospita il codice o il simbolo: il simbolo è disegnato in coordinate
    // locali centrate sull'origine (vedi `campioneTubazione`), quindi basta traslarlo al centro
    // della cella.
    const sinistra =
      'codice' in riga.sinistra
        ? `<text x="${x + COLONNA_CODICE / 2}" y="${y + RIGA_TABELLA / 2}" font-family="${FONT}" font-size="16" text-anchor="middle" dominant-baseline="central" fill="#000">${escapeXml(riga.sinistra.codice)}</text>`
        : `<g transform="translate(${x + COLONNA_CODICE / 2} ${y + RIGA_TABELLA / 2})">${riga.sinistra.simbolo}</g>`

    parti.push(
      `<rect x="${x}" y="${y}" width="${w}" height="${RIGA_TABELLA}" fill="none" stroke="#000" stroke-width="1" />`,
      `<line x1="${x + COLONNA_CODICE}" y1="${y}" x2="${x + COLONNA_CODICE}" y2="${y + RIGA_TABELLA}" stroke="#000" stroke-width="1" />`,
      sinistra,
      `<text x="${x + COLONNA_CODICE + 12}" y="${y + RIGA_TABELLA / 2}" font-family="${FONT}" font-size="16" dominant-baseline="central" fill="#000">${escapeXml(riga.descrizione)}</text>`
    )
  })

  return parti.join('')
}

/**
 * Annotazioni libere: solo testo, nessuna cornice. Si disegnano dopo i nodi e le tubazioni,
 * così una scritta posata su un tubo resta leggibile. Non toccano la tabella: `righeLista` e
 * `righeLegenda` non le leggono, `SchemaTestoLibero` non è un `SchemaNodo`.
 */
function renderTestiLiberi(testi: SchemaTestoLibero[]): string {
  return testi.map((t) => testoMultiRiga(t.x, t.y, t.contenuto, TESTO_LIBERO.dimensione, 'start')).join('')
}

function renderNota(note: string[], larghezza: number, yTop: number): string {
  if (note.length === 0) return ''
  const w = Math.min(larghezza - MARGINE * 2, 680)
  const x = (larghezza - w) / 2
  const h = 24 * note.length + 24
  const righe = note
    .map(
      (nota, i) =>
        `<text x="${larghezza / 2}" y="${yTop + 24 + i * 24}" font-family="${FONT}" font-size="18" text-anchor="middle" dominant-baseline="central" fill="#000">${escapeXml(nota)}</text>`
    )
    .join('')
  return `<rect x="${x}" y="${yTop}" width="${w}" height="${h}" fill="none" stroke="#000" stroke-width="${TRATTO}" />${righe}`
}

/**
 * `libreria` sta PRIMA di `options`, non dopo: è il parametro che le due catene di produzione
 * (editor, documento) costruiscono una volta sola e passano sempre, mentre `options` è per
 * consumo occasionale (la nota diametri, oggi il solo campo). Se fosse l'ultimo, ogni chiamante
 * che oggi passa `{ noteTubazioni }` come secondo argomento continuerebbe a compilare passando
 * una `Tarature` dove si aspetta `RenderSvgOptions` — esattamente il difetto silenzioso che
 * questo task esiste per evitare (vedi il commento di testa a `symbols/index.ts`).
 */
export function renderSvg(layout: SchemaLayout, libreria: Tarature = {}, options: RenderSvgOptions = {}): string {
  const note = options.noteTubazioni ?? []
  const dimensioniDisegno = dimensioniLayout(layout, libreria)
  const righe = [...righeLista(layout), ...righeLegenda(layout)]

  const quote = quoteInstradamento(layout, libreria)
  const yNota = dimensioniDisegno.altezza + MARGINE
  const altezzaNota = note.length > 0 ? ALTEZZA_NOTA : 0
  const yTabella = yNota + altezzaNota
  const altezzaTotale = yTabella + RIGA_TABELLA * (righe.length + 1) + MARGINE

  const archi = renderArchi(layout, quote, libreria)

  const larghezzaTabella = COLONNA_CODICE + 620 + MARGINE * 2
  const larghezzaTotale = Math.max(dimensioniDisegno.larghezza, larghezzaTabella)

  const nodi = layout.nodi
    .map((nodo) => `<g transform="translate(${nodo.x} ${nodo.y})">${simboloDi(nodo, libreria)}</g>`)
    .join('')
  const muro = layout.muro
    ? simboloMuro(layout.muro.x, layout.muro.yMin, layout.muro.yMax, archi.varchi)
    : ''

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${larghezzaTotale}" height="${altezzaTotale}" viewBox="0 0 ${larghezzaTotale} ${altezzaTotale}">`,
    `<rect width="${larghezzaTotale}" height="${altezzaTotale}" fill="#fff" />`,
    muro,
    archi.svg,
    nodi,
    renderTestiLiberi(layout.testi ?? []),
    renderNota(note, larghezzaTotale, yNota),
    renderTabella(righe, larghezzaTotale, yTabella),
    '</svg>',
  ].join('')
}

/**
 * Le quote a cui le tubazioni attraversano il muro, per disegnarlo sulla tela dell'editor senza
 * rendere tutto l'SVG. E' la stessa `renderArchi` del documento, di cui si tiene l'altra metà del
 * risultato: una copia della sua logica di instradamento aprirebbe sulla tela varchi in punti
 * diversi da quelli del .docx consegnato. Chiamata da `SchemaEditor` (`varchiMuro`,
 * SchemaEditor.tsx), che la passa a `MuroSeparazione` insieme al muro da disegnare.
 */
export function varchiDelMuro(layout: SchemaLayout, libreria: Tarature = {}): number[] {
  return renderArchi(layout, quoteInstradamento(layout, libreria), libreria).varchi
}
