/**
 * Render dello schema posizionato in una stringa SVG autonoma (nessun DOM: funzione pura,
 * testabile in Node e rasterizzabile nel browser da `rasterize.ts`).
 *
 * Il disegno riproduce l'impaginazione delle relazioni storiche: schema in alto, nota sui
 * diametri delle tubazioni, tabella "Lista Apparecchiature" in basso.
 */
import { DIMENSIONI_NODO, corpoNodo, dimensioniLayout, pozzoCondense } from './layout'
import { ancoraDi, escapeXml, simboloDi, simboloMuro, valvolaIntercettazione, TRATTO } from './symbols'
import type { SchemaLayout, SchemaNodoPosizionato } from './types'

const FONT = 'Arial, Helvetica, sans-serif'
const MARGINE = 40
const RIGA_TABELLA = 34
const COLONNA_CODICE = 130
const ALTEZZA_NOTA = 90
/** Sbraccio della freccia verso le utenze, più lo spazio per la scritta che la accompagna. */
const SPAZIO_UTENZE = 190
/** Rientro del montante rispetto al fianco del recipiente: evita che corra sul contorno. */
const AVVICINAMENTO = 34

interface Punto {
  x: number
  y: number
}

/**
 * Posizione assoluta di un'ancora del nodo, in coordinate del disegno. Fallisce piano: se
 * l'ancora non esiste (dato incoerente), ripiega sul centro del corpo invece di produrre
 * coordinate NaN che spaccherebbero la polilinea.
 */
export function posizioneAncora(nodo: SchemaNodoPosizionato, ancoraId: string): Punto {
  const ancora = ancoraDi(nodo, ancoraId)
  if (!ancora) {
    const corpo = corpoNodo(nodo)
    return { x: corpo.x + corpo.larghezza / 2, y: corpo.y + corpo.altezza / 2 }
  }
  return { x: nodo.x + ancora.x, y: nodo.y + ancora.y }
}

function percorso(punti: Punto[]): string {
  return punti.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
}

/**
 * Raccorda due punti con due tratti ortogonali. Il verso lo decide la distanza maggiore:
 * si esce nella direzione in cui c'è più strada, che è il modo in cui si instrada a mano.
 */
function raccordoOrtogonale(da: Punto, a: Punto): Punto[] {
  if (da.x === a.x || da.y === a.y) return [a]
  return Math.abs(a.x - da.x) >= Math.abs(a.y - da.y)
    ? [{ x: a.x, y: da.y }, a]
    : [{ x: da.x, y: a.y }, a]
}

/** Polilinea che parte dall'ancora, tocca i gomiti imposti e arriva all'altra ancora. */
function polilineaConGomiti(inizio: Punto, gomiti: Punto[], fine: Punto): Punto[] {
  const punti: Punto[] = [inizio]
  let corrente = inizio
  for (const g of [...gomiti, fine]) {
    punti.push(...raccordoOrtogonale(corrente, g))
    corrente = g
  }
  return punti
}

/**
 * Quote alle quali una polilinea attraversa la verticale `x`. Servono ad aprire i varchi del
 * muro: ricavarle dalla rotta effettiva, invece di fissarle nel layout, tiene muro e tubazioni
 * d'accordo anche dopo che l'utente ha spostato un nodo nell'editor.
 */
function quoteAttraversamento(punti: Punto[], x: number): number[] {
  const quote: number[] = []
  for (let i = 1; i < punti.length; i++) {
    const a = punti[i - 1]
    const b = punti[i]
    if (a.y === b.y && Math.min(a.x, b.x) <= x && x <= Math.max(a.x, b.x)) quote.push(a.y)
  }
  return quote
}

export interface RenderSvgOptions {
  /** Nota sui diametri, es. "Collegamenti effettuati con tubazioni da Ø40 a Ø63mm". */
  noteTubazioni?: string[]
}

/** Centro del corpo disegnato: è lì che si attaccano le tubazioni. */
function centro(nodo: SchemaNodoPosizionato): { x: number; y: number } {
  const corpo = corpoNodo(nodo)
  return { x: corpo.x + corpo.larghezza / 2, y: corpo.y + corpo.altezza / 2 }
}

/** Tratto ondulato verticale: convenzione CAD per la tubazione flessibile. */
function ondeVerticali(x: number, yPartenza: number, lunghezza = 40): string {
  const onde = Array.from({ length: Math.round(lunghezza / 10) }, (_, i) => {
    const y0 = yPartenza - i * 10
    return `M ${x} ${y0} q -5 -2.5 0 -5 q 5 -2.5 0 -5`
  }).join(' ')
  return `<path d="${onde}" fill="none" stroke="#000" stroke-width="${TRATTO}" />`
}

/**
 * Mandata compressore → serbatoio: montante dal cielo del compressore fino al collettore
 * comune, poi tratto orizzontale fino all'ingresso del serbatoio. È la resa degli schemi
 * reali, dove più compressori confluiscono sulla stessa linea invece di attraversarsi.
 */
function renderMandataCompressore(
  da: SchemaNodoPosizionato,
  ancoraDa: string,
  a: SchemaNodoPosizionato,
  ancoraA: string,
  yCollettore: number,
  gomiti?: Punto[]
): { svg: string; punti: Punto[] } {
  const pDa = posizioneAncora(da, ancoraDa)
  const pA = posizioneAncora(a, ancoraA)
  // La discesa si stacca dal fianco del recipiente e l'ultimo tratto entra in orizzontale:
  // scendendo sul bordo, la linea si confonderebbe col contorno del simbolo.
  const xDiscesa = pA.x - AVVICINAMENTO

  const punti: Punto[] =
    gomiti && gomiti.length > 0
      ? polilineaConGomiti(pDa, gomiti, pA)
      : [
          { x: pDa.x, y: pDa.y },
          { x: pDa.x, y: yCollettore },
          { x: xDiscesa, y: yCollettore },
          { x: xDiscesa, y: pA.y },
          { x: pA.x, y: pA.y },
        ]
  const linea = `<path d="${percorso(punti)}" fill="none" stroke="#000" stroke-width="${TRATTO}" marker-end="url(#freccia)" />`
  // Flessibile e valvola di intercettazione stanno sul montante, appena sopra la macchina.
  // La valvola sta sul montante: farfalla verticale, in linea col tubo.
  const svg =
    linea + ondeVerticali(pDa.x, pDa.y - 4) + valvolaIntercettazione(pDa.x, pDa.y - 62, 'verticale')
  return { svg, punti }
}

/** Mandata di linea fra due stadi di trattamento: tratto orizzontale con valvola in ingresso. */
function renderMandataLinea(
  da: SchemaNodoPosizionato,
  ancoraDa: string,
  a: SchemaNodoPosizionato,
  ancoraA: string,
  gomiti?: Punto[]
): { svg: string; punti: Punto[] } {
  const pDa = posizioneAncora(da, ancoraDa)
  const pA = posizioneAncora(a, ancoraA)
  const xMedia = (pDa.x + pA.x) / 2
  const punti: Punto[] =
    gomiti && gomiti.length > 0
      ? polilineaConGomiti(pDa, gomiti, pA)
      : [
          { x: pDa.x, y: pDa.y },
          { x: xMedia, y: pDa.y },
          { x: xMedia, y: pA.y },
          { x: pA.x, y: pA.y },
        ]
  const svg =
    `<path d="${percorso(punti)}" fill="none" stroke="#000" stroke-width="${TRATTO}" marker-end="url(#freccia)" />` +
    valvolaIntercettazione(pA.x - 22, pA.y)
  return { svg, punti }
}

/**
 * Linea condense: scende dallo scarico del nodo, corre sulla corsia comune e scende nel
 * pozzo di raccolta dall'alto — il pozzo sta sotto la corsia, come negli schemi reali.
 */
function renderLineaCondense(
  da: SchemaNodoPosizionato,
  ancoraDa: string,
  a: SchemaNodoPosizionato,
  ancoraA: string,
  yCorsia: number,
  gomiti?: Punto[]
): { svg: string; punti: Punto[] } {
  const pDa = posizioneAncora(da, ancoraDa)
  const pA = posizioneAncora(a, ancoraA)
  const punti: Punto[] =
    gomiti && gomiti.length > 0
      ? polilineaConGomiti(pDa, gomiti, pA)
      : [
          { x: pDa.x, y: pDa.y },
          { x: pDa.x, y: yCorsia },
          { x: pA.x, y: yCorsia },
          { x: pA.x, y: pA.y },
        ]
  const svg = `<path d="${percorso(punti)}" fill="none" stroke="#000" stroke-width="${TRATTO}" stroke-dasharray="10 7" marker-end="url(#freccia)" />`
  return { svg, punti }
}

/** Disegno delle tubazioni, insieme alle quote a cui attraversano il muro (se c'è). */
function renderArchi(
  layout: SchemaLayout,
  yCorsiaCondense: number,
  yCollettore: number
): { svg: string; varchi: number[] } {
  const indice = new Map(layout.nodi.map((n) => [n.id, n]))
  const parti: string[] = []
  const varchi: number[] = []

  for (const arco of layout.archi) {
    const da = indice.get(arco.da.nodo)
    const a = indice.get(arco.a.nodo)
    if (!da || !a) continue

    const reso =
      arco.stile === 'condensa'
        ? renderLineaCondense(da, arco.da.ancora, a, arco.a.ancora, yCorsiaCondense, arco.punti)
        : arco.stile === 'flessibile'
          ? renderMandataCompressore(da, arco.da.ancora, a, arco.a.ancora, yCollettore, arco.punti)
          : renderMandataLinea(da, arco.da.ancora, a, arco.a.ancora, arco.punti)

    parti.push(reso.svg)
    if (layout.muro) varchi.push(...quoteAttraversamento(reso.punti, layout.muro.x))
  }

  return { svg: parti.join(''), varchi }
}

/**
 * Uscita verso lo stabilimento: freccia tratteggiata verso l'alto, come negli schemi reali.
 * Parte dall'ultimo stadio della linea aria — mai dal pozzo di raccolta condense, che è un
 * capolinea e non alimenta le utenze.
 */
function renderUscitaUtenze(layout: SchemaLayout): { svg: string; xFine: number } {
  const pozzo = pozzoCondense(layout.nodi, layout)
  const inLinea = layout.nodi.filter((n) => n.tipo !== 'compressore' && n.id !== pozzo?.id)
  if (inLinea.length === 0) return { svg: '', xFine: 0 }
  const ultimo = inLinea.reduce((a, b) => (a.x > b.x ? a : b))
  const c = centro(ultimo)
  const x = ultimo.x + DIMENSIONI_NODO[ultimo.tipo].larghezza + 50
  const yAlto = 14

  const svg = [
    `<path d="M ${ultimo.x + DIMENSIONI_NODO[ultimo.tipo].larghezza} ${c.y} L ${x} ${c.y} L ${x} ${yAlto}" fill="none" stroke="#000" stroke-width="${TRATTO}" stroke-dasharray="10 7" marker-end="url(#freccia)" />`,
    `<text x="${x + 10}" y="${yAlto + 6}" font-family="${FONT}" font-size="18" dominant-baseline="central" fill="#000">Utenze aria</text>`,
  ].join('')
  return { svg, xFine: x + SPAZIO_UTENZE - 50 }
}

/**
 * Righe della tabella: apparecchiature e loro accessori/valvole. L'ordine è quello del flusso
 * dell'aria (compressori → serbatoi → trattamento → raccolta), lo stesso in cui il layout
 * dispone i nodi e in cui le legge chi confronta il disegno con la lista. L'ordine alfabetico
 * dei codici spezzerebbe quella corrispondenza (SEP prima di S, la raccolta in mezzo ai filtri).
 */
export function righeLista(layout: SchemaLayout): { codice: string; descrizione: string }[] {
  const righe: { codice: string; descrizione: string }[] = []
  for (const nodo of layout.nodi) {
    righe.push({ codice: nodo.id, descrizione: nodo.etichetta })
    if (nodo.accessorio) {
      righe.push({ codice: nodo.accessorio.codice, descrizione: nodo.accessorio.etichetta })
      for (const v of nodo.accessorio.valvoleSicurezza) {
        righe.push({ codice: v.codice, descrizione: v.etichetta })
      }
    }
    for (const v of nodo.valvoleSicurezza) {
      righe.push({ codice: v.codice, descrizione: v.etichetta })
    }
  }
  return righe
}

function renderTabella(righe: { codice: string; descrizione: string }[], larghezza: number, yTop: number): string {
  const x = MARGINE
  const w = larghezza - MARGINE * 2
  const parti: string[] = []

  parti.push(
    `<rect x="${x}" y="${yTop}" width="${w}" height="${RIGA_TABELLA}" fill="none" stroke="#000" stroke-width="${TRATTO}" />`,
    `<text x="${x + w / 2}" y="${yTop + RIGA_TABELLA / 2}" font-family="${FONT}" font-size="20" text-anchor="middle" dominant-baseline="central" fill="#000">LISTA APPARECCHIATURE</text>`
  )

  righe.forEach((riga, i) => {
    const y = yTop + RIGA_TABELLA * (i + 1)
    parti.push(
      `<rect x="${x}" y="${y}" width="${w}" height="${RIGA_TABELLA}" fill="none" stroke="#000" stroke-width="1" />`,
      `<line x1="${x + COLONNA_CODICE}" y1="${y}" x2="${x + COLONNA_CODICE}" y2="${y + RIGA_TABELLA}" stroke="#000" stroke-width="1" />`,
      `<text x="${x + COLONNA_CODICE / 2}" y="${y + RIGA_TABELLA / 2}" font-family="${FONT}" font-size="16" text-anchor="middle" dominant-baseline="central" fill="#000">${escapeXml(riga.codice)}</text>`,
      `<text x="${x + COLONNA_CODICE + 12}" y="${y + RIGA_TABELLA / 2}" font-family="${FONT}" font-size="16" dominant-baseline="central" fill="#000">${escapeXml(riga.descrizione)}</text>`
    )
  })

  return parti.join('')
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

/** Quota del collettore di mandata: appena sopra la fascia dei serbatoi, così i montanti dei compressori vi confluiscono senza attraversare nulla. */
function quotaCollettore(layout: SchemaLayout): number {
  const serbatoi = layout.nodi.filter((n) => n.tipo === 'serbatoio')
  const riferimento = serbatoi.length > 0 ? serbatoi : layout.nodi
  if (riferimento.length === 0) return MARGINE
  return Math.min(...riferimento.map((n) => n.y)) - MARGINE / 2
}

/** Quota della corsia comune delle linee condense: appena sopra il pozzo di raccolta, così le linee vi scendono dentro dall'alto. */
function quotaCorsiaCondense(layout: SchemaLayout, altezzaDisegno: number): number {
  const pozzo = pozzoCondense(layout.nodi, layout)
  return pozzo ? corpoNodo(pozzo).y - 40 : altezzaDisegno - MARGINE / 2
}

export function renderSvg(layout: SchemaLayout, options: RenderSvgOptions = {}): string {
  const note = options.noteTubazioni ?? []
  const dimensioniDisegno = dimensioniLayout(layout)
  const righe = righeLista(layout)

  const yCollettore = quotaCollettore(layout)
  const yCorsiaCondense = quotaCorsiaCondense(layout, dimensioniDisegno.altezza)
  const yNota = dimensioniDisegno.altezza + MARGINE
  const altezzaNota = note.length > 0 ? ALTEZZA_NOTA : 0
  const yTabella = yNota + altezzaNota
  const altezzaTotale = yTabella + RIGA_TABELLA * (righe.length + 1) + MARGINE

  const archi = renderArchi(layout, yCorsiaCondense, yCollettore)
  const uscita = renderUscitaUtenze(layout)

  const larghezzaTabella = COLONNA_CODICE + 620 + MARGINE * 2
  const larghezzaTotale = Math.max(
    dimensioniDisegno.larghezza,
    uscita.xFine + MARGINE,
    larghezzaTabella
  )

  const nodi = layout.nodi
    .map((nodo) => `<g transform="translate(${nodo.x} ${nodo.y})">${simboloDi(nodo)}</g>`)
    .join('')
  const muro = layout.muro
    ? simboloMuro(layout.muro.x, layout.muro.yMin, layout.muro.yMax, archi.varchi)
    : ''

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${larghezzaTotale}" height="${altezzaTotale}" viewBox="0 0 ${larghezzaTotale} ${altezzaTotale}">`,
    `<defs><marker id="freccia" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#000" /></marker></defs>`,
    `<rect width="${larghezzaTotale}" height="${altezzaTotale}" fill="#fff" />`,
    muro,
    archi.svg,
    uscita.svg,
    nodi,
    renderNota(note, larghezzaTotale, yNota),
    renderTabella(righe, larghezzaTotale, yTabella),
    '</svg>',
  ].join('')
}
