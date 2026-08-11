/**
 * Render dello schema posizionato in una stringa SVG autonoma (nessun DOM: funzione pura,
 * testabile in Node e rasterizzabile nel browser da `rasterize.ts`).
 *
 * Il disegno riproduce l'impaginazione delle relazioni storiche: schema in alto, nota sui
 * diametri delle tubazioni, tabella "Lista Apparecchiature" in basso.
 */
import { DIMENSIONI_NODO, corpoNodo, dimensioniLayout } from './layout'
import { escapeXml, simboloDi, simboloMuro, valvolaIntercettazione, TRATTO } from './symbols'
import type { SchemaLayout, SchemaNodoPosizionato } from './types'

const FONT = 'Arial, Helvetica, sans-serif'
const MARGINE = 40
const RIGA_TABELLA = 34
const COLONNA_CODICE = 130
const ALTEZZA_NOTA = 90

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
  a: SchemaNodoPosizionato,
  yCollettore: number
): string {
  const cDa = centro(da)
  const cA = centro(a)
  const corpoA = corpoNodo(a)
  const yTetto = corpoNodo(da).y

  const percorso = `M ${cDa.x} ${yTetto} L ${cDa.x} ${yCollettore} L ${corpoA.x} ${yCollettore} L ${corpoA.x} ${cA.y}`
  const linea = `<path d="${percorso}" fill="none" stroke="#000" stroke-width="${TRATTO}" marker-end="url(#freccia)" />`
  // Flessibile e valvola di intercettazione stanno sul montante, appena sopra la macchina.
  return linea + ondeVerticali(cDa.x, yTetto - 4) + valvolaIntercettazione(cDa.x, yTetto - 62)
}

/** Mandata di linea fra due stadi di trattamento: tratto orizzontale con valvola in ingresso. */
function renderMandataLinea(da: SchemaNodoPosizionato, a: SchemaNodoPosizionato): string {
  const cDa = centro(da)
  const cA = centro(a)
  const corpoDa = corpoNodo(da)
  const corpoA = corpoNodo(a)
  const xUscita = corpoDa.x + corpoDa.larghezza
  const xMedia = (xUscita + corpoA.x) / 2
  const percorso = `M ${xUscita} ${cDa.y} L ${xMedia} ${cDa.y} L ${xMedia} ${cA.y} L ${corpoA.x} ${cA.y}`
  return (
    `<path d="${percorso}" fill="none" stroke="#000" stroke-width="${TRATTO}" marker-end="url(#freccia)" />` +
    valvolaIntercettazione(corpoA.x - 22, cA.y)
  )
}

/**
 * Linea condense: scende dallo scarico del nodo, corre sulla corsia comune e scende nel
 * pozzo di raccolta dall'alto — il pozzo sta sotto la corsia, come negli schemi reali.
 */
function renderLineaCondense(
  da: SchemaNodoPosizionato,
  a: SchemaNodoPosizionato,
  yCorsia: number
): string {
  const cDa = centro(da)
  const corpoDa = corpoNodo(da)
  const corpoA = corpoNodo(a)
  const xArrivo = corpoA.x + corpoA.larghezza / 2
  const yUscita = corpoDa.y + corpoDa.altezza + 24
  const percorso = `M ${cDa.x} ${yUscita} L ${cDa.x} ${yCorsia} L ${xArrivo} ${yCorsia} L ${xArrivo} ${corpoA.y}`
  return `<path d="${percorso}" fill="none" stroke="#000" stroke-width="${TRATTO}" stroke-dasharray="10 7" marker-end="url(#freccia)" />`
}

function renderArchi(layout: SchemaLayout, yCorsiaCondense: number, yCollettore: number): string {
  const indice = new Map(layout.nodi.map((n) => [n.id, n]))
  return layout.archi
    .map((arco) => {
      const da = indice.get(arco.da)
      const a = indice.get(arco.a)
      if (!da || !a) return ''

      if (arco.stile === 'condensa') return renderLineaCondense(da, a, yCorsiaCondense)
      if (arco.stile === 'flessibile') return renderMandataCompressore(da, a, yCollettore)
      return renderMandataLinea(da, a)
    })
    .join('')
}

/** Uscita verso lo stabilimento: freccia tratteggiata verso l'alto, come negli schemi reali. */
function renderUscitaUtenze(layout: SchemaLayout): string {
  const inLinea = layout.nodi.filter((n) => n.tipo !== 'tanica' && n.tipo !== 'compressore')
  if (inLinea.length === 0) return ''
  const ultimo = inLinea.reduce((a, b) => (a.x > b.x ? a : b))
  const c = centro(ultimo)
  const x = ultimo.x + DIMENSIONI_NODO[ultimo.tipo].larghezza + 50
  const yAlto = 14

  return [
    `<path d="M ${ultimo.x + DIMENSIONI_NODO[ultimo.tipo].larghezza} ${c.y} L ${x} ${c.y} L ${x} ${yAlto}" fill="none" stroke="#000" stroke-width="${TRATTO}" stroke-dasharray="10 7" marker-end="url(#freccia)" />`,
    `<text x="${x + 10}" y="${yAlto + 6}" font-family="${FONT}" font-size="18" dominant-baseline="central" fill="#000">Utenze aria</text>`,
  ].join('')
}

/** Righe della tabella: apparecchiature e loro accessori/valvole, nell'ordine dei codici. */
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
  return righe.sort((a, b) => a.codice.localeCompare(b.codice, 'it', { numeric: true }))
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
  const pozzo = layout.nodi.find((n) => n.tipo === 'tanica')
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

  const larghezzaTabella = COLONNA_CODICE + 620 + MARGINE * 2
  const larghezzaTotale = Math.max(dimensioniDisegno.larghezza, larghezzaTabella)

  const nodi = layout.nodi
    .map((nodo) => `<g transform="translate(${nodo.x} ${nodo.y})">${simboloDi(nodo)}</g>`)
    .join('')
  const muro = layout.muro
    ? simboloMuro(layout.muro.x, layout.muro.yMin, layout.muro.yMax, layout.muro.yVarco)
    : ''

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${larghezzaTotale}" height="${altezzaTotale}" viewBox="0 0 ${larghezzaTotale} ${altezzaTotale}">`,
    `<defs><marker id="freccia" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#000" /></marker></defs>`,
    `<rect width="${larghezzaTotale}" height="${altezzaTotale}" fill="#fff" />`,
    muro,
    renderArchi(layout, yCorsiaCondense, yCollettore),
    renderUscitaUtenze(layout),
    nodi,
    renderNota(note, larghezzaTotale, yNota),
    renderTabella(righe, larghezzaTotale, yTabella),
    '</svg>',
  ].join('')
}
