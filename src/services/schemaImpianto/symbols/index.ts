/**
 * Libreria dei simboli, ricalcata sui blocchi AutoCAD in `DOCUMENTAZIONE/relazione/Blocchi.pdf`.
 *
 * Ogni simbolo è una funzione pura che produce un frammento SVG in coordinate locali
 * (origine in alto a sinistra del riquadro dichiarato in `DIMENSIONI_NODO`): il render
 * statico li concatena, l'editor li riusa dentro i custom node di react-flow, così il
 * disegno è lo stesso nelle due modalità.
 *
 * Convenzioni grafiche del CAD di riferimento: solo tratto nero su fondo bianco, nessun
 * riempimento colorato, spessore uniforme.
 */
import type { SchemaNodoPosizionato } from '../types'
import { DIMENSIONI_NODO } from '../layout'

export const TRATTO = 2
const FONT = 'Arial, Helvetica, sans-serif'

/** Testo centrato: `x`/`y` sono il centro del testo. */
function testo(x: number, y: number, contenuto: string, dimensione = 20): string {
  return `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${dimensione}" text-anchor="middle" dominant-baseline="central" fill="#000">${escapeXml(contenuto)}</text>`
}

export function escapeXml(valore: string): string {
  return valore
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function traccia(d: string): string {
  return `<path d="${d}" fill="none" stroke="#000" stroke-width="${TRATTO}" stroke-linecap="round" />`
}

/**
 * Valvola di sicurezza: quadratino con tratteggio orizzontale, posato sopra il recipiente
 * che protegge. `x`/`y` sono il centro del simbolo.
 */
export function valvolaSicurezza(x: number, y: number): string {
  const lato = 12
  const mezzo = lato / 2
  const righe = [-3, 0, 3]
    .map((dy) => `M ${x - mezzo} ${y + dy} L ${x + mezzo} ${y + dy}`)
    .join(' ')
  return [
    `<rect x="${x - mezzo}" y="${y - mezzo}" width="${lato}" height="${lato}" fill="none" stroke="#000" stroke-width="${TRATTO}" />`,
    traccia(righe),
  ].join('')
}

/** Valvola di intercettazione: farfalla orizzontale. `x`/`y` al centro. */
export function valvolaIntercettazione(x: number, y: number): string {
  const l = 9
  const h = 8
  return traccia(
    `M ${x - l} ${y - h} L ${x - l} ${y + h} L ${x} ${y} Z M ${x + l} ${y - h} L ${x + l} ${y + h} L ${x} ${y} Z`
  )
}

/** Valvola di scarico: farfalla verticale con stelo. `x`/`y` al centro della farfalla. */
export function valvolaScarico(x: number, y: number): string {
  const l = 8
  const h = 9
  return [
    traccia(
      `M ${x - l} ${y - h} L ${x + l} ${y - h} L ${x} ${y} Z M ${x - l} ${y + h} L ${x + l} ${y + h} L ${x} ${y} Z`
    ),
    traccia(`M ${x} ${y + h} L ${x} ${y + h + 8}`),
  ].join('')
}

/** Compressore: riquadro con girante; disoleatore e sua valvola disegnati dentro, se presenti. */
export function simboloCompressore(nodo: SchemaNodoPosizionato): string {
  const { larghezza, altezza } = DIMENSIONI_NODO.compressore
  const corpo = `<rect x="0" y="0" width="${larghezza}" height="${altezza}" fill="none" stroke="#000" stroke-width="${TRATTO}" />`
  const raggio = 34
  const cx = larghezza - raggio - 16
  const cy = altezza / 2 + 10
  const girante = [
    `<circle cx="${cx}" cy="${cy}" r="${raggio}" fill="none" stroke="#000" stroke-width="${TRATTO}" />`,
    traccia(`M ${cx - raggio * 0.7} ${cy + raggio * 0.7} L ${cx + raggio * 0.7} ${cy - raggio * 0.7}`),
  ].join('')
  const etichettaCodice = testo(cx, 22, nodo.id, 22)

  if (!nodo.accessorio) return corpo + girante + etichettaCodice

  // Disoleatore: riquadro interno in basso a sinistra, con la propria valvola sopra.
  const dw = 62
  const dh = 52
  const dx = 8
  const dy = altezza - dh - 8
  const disoleatore = [
    `<rect x="${dx}" y="${dy}" width="${dw}" height="${dh}" fill="none" stroke="#000" stroke-width="${TRATTO}" />`,
    testo(dx + dw / 2, dy + dh - 12, nodo.accessorio.codice, 14),
  ].join('')
  const valvola = nodo.accessorio.valvoleSicurezza[0]
  const conValvola = valvola
    ? valvolaSicurezza(dx + dw / 2, dy - 14) + testo(dx + dw / 2, dy - 32, valvola.codice, 14)
    : ''
  return corpo + girante + etichettaCodice + disoleatore + conValvola
}

/** Serbatoio: capsula verticale od orizzontale, con valvole di sicurezza sopra e scarico sotto. */
export function simboloSerbatoio(nodo: SchemaNodoPosizionato): string {
  const { larghezza, altezza } = DIMENSIONI_NODO.serbatoio
  const orizzontale = nodo.orientamento === 'ORIZZONTALE'

  const w = orizzontale ? larghezza : 84
  const h = orizzontale ? 84 : altezza - 40
  const x = (larghezza - w) / 2
  const y = orizzontale ? (altezza - h) / 2 : 40
  const raggio = Math.min(w, h) / 2

  const corpo = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${raggio}" ry="${raggio}" fill="none" stroke="#000" stroke-width="${TRATTO}" />`
  const etichettaCodice = testo(larghezza / 2, y + h / 2, nodo.id, 24)

  // Le valvole di sicurezza si appoggiano sulla sommità, affiancate quando sono più d'una.
  const valvole = nodo.valvoleSicurezza
    .map((v, i) => {
      const passo = 34
      const vx = larghezza / 2 + (i - (nodo.valvoleSicurezza.length - 1) / 2) * passo
      const vy = y - 12
      return [
        traccia(`M ${vx} ${y} L ${vx} ${vy + 6}`),
        valvolaSicurezza(vx, vy),
        testo(vx, vy - 18, v.codice, 14),
      ].join('')
    })
    .join('')

  const scarico = valvolaScarico(larghezza / 2, y + h + 10)
  return corpo + etichettaCodice + valvole + scarico
}

/** Simbolo a rombo (essiccatore, filtro, separatore), con eventuale accessorio dipendente e scarico. */
function simboloRombo(nodo: SchemaNodoPosizionato, conScarico: boolean): string {
  const { larghezza, altezza } = DIMENSIONI_NODO[nodo.tipo]
  const cx = larghezza / 2
  const cy = altezza / 2 - 6
  const semiL = larghezza / 2 - 6
  const semiH = altezza / 2 - 16

  const rombo = traccia(
    `M ${cx} ${cy - semiH} L ${cx + semiL} ${cy} L ${cx} ${cy + semiH} L ${cx - semiL} ${cy} Z`
  )
  // Asse verticale interno, presente in tutti i blocchi a rombo del CAD di riferimento.
  const asse = traccia(`M ${cx} ${cy - semiH} L ${cx} ${cy + semiH}`)

  const haAccessorio = Boolean(nodo.accessorio)
  const etichettaCodice = testo(cx, haAccessorio ? cy - 10 : cy, nodo.id, haAccessorio ? 16 : 18)
  const etichettaAccessorio = nodo.accessorio ? testo(cx, cy + 8, nodo.accessorio.codice, 12) : ''
  // Lo scambiatore di calore aggiunge il cerchietto del circuito frigorifero.
  const cerchietto =
    nodo.tipo === 'essiccatore' && haAccessorio
      ? `<circle cx="${cx}" cy="${cy + 24}" r="7" fill="none" stroke="#000" stroke-width="${TRATTO}" />`
      : ''

  const scarico = conScarico ? valvolaScarico(cx, cy + semiH + 12) : ''
  return rombo + asse + etichettaCodice + etichettaAccessorio + cerchietto + scarico
}

export function simboloEssiccatore(nodo: SchemaNodoPosizionato): string {
  return simboloRombo(nodo, true)
}

export function simboloFiltro(nodo: SchemaNodoPosizionato): string {
  return simboloRombo(nodo, true)
}

export function simboloSeparatore(nodo: SchemaNodoPosizionato): string {
  return simboloRombo(nodo, false)
}

/** Tanica raccolta condense: contenitore aperto in alto. */
export function simboloTanica(nodo: SchemaNodoPosizionato): string {
  const { larghezza, altezza } = DIMENSIONI_NODO.tanica
  const x = 6
  const y = 6
  const w = larghezza - 12
  const h = altezza - 12
  return [
    traccia(`M ${x} ${y} L ${x} ${y + h} L ${x + w} ${y + h} L ${x + w} ${y}`),
    testo(larghezza / 2, y + h / 2, nodo.id, 20),
  ].join('')
}

/** Pacco bombole: fascio di cilindri affiancati. */
export function simboloPaccoBombole(nodo: SchemaNodoPosizionato): string {
  const { larghezza, altezza } = DIMENSIONI_NODO.pacco_bombole
  const bombole = 5
  const passo = (larghezza - 20) / bombole
  const cilindri = Array.from({ length: bombole }, (_, i) => {
    const bx = 10 + i * passo
    return `<rect x="${bx}" y="26" width="${passo - 4}" height="${altezza - 36}" rx="${(passo - 4) / 2}" ry="8" fill="none" stroke="#000" stroke-width="${TRATTO}" />`
  }).join('')
  return `<rect x="6" y="20" width="${larghezza - 12}" height="${altezza - 26}" fill="none" stroke="#000" stroke-width="${TRATTO}" />${cilindri}${testo(24, 12, nodo.id, 16)}`
}

const SIMBOLI: Record<SchemaNodoPosizionato['tipo'], (nodo: SchemaNodoPosizionato) => string> = {
  compressore: simboloCompressore,
  serbatoio: simboloSerbatoio,
  essiccatore: simboloEssiccatore,
  filtro: simboloFiltro,
  separatore: simboloSeparatore,
  tanica: simboloTanica,
  pacco_bombole: simboloPaccoBombole,
}

/** Frammento SVG del nodo in coordinate locali (senza traslazione). */
export function simboloDi(nodo: SchemaNodoPosizionato): string {
  return SIMBOLI[nodo.tipo](nodo)
}

/** Muro di separazione sala compressori / stabilimento: muratura tratteggiata a 45°, interrotta dal varco della tubazione. */
export function simboloMuro(x: number, yMin: number, yMax: number, yVarco: number): string {
  const spessore = 14
  const varco = 60
  const yVarcoMin = yVarco - varco / 2
  const yVarcoMax = yVarco + varco / 2

  const tratti: string[] = []
  for (let y = yMin; y < yMax; y += 12) {
    if (y > yVarcoMin - 12 && y < yVarcoMax) continue
    tratti.push(`M ${x} ${y + 12} L ${x + spessore} ${y}`)
  }

  const segmenti = [
    [yMin, yVarcoMin],
    [yVarcoMax, yMax],
  ]
    .map(
      ([a, b]) =>
        `<rect x="${x}" y="${a}" width="${spessore}" height="${b - a}" fill="none" stroke="#000" stroke-width="${TRATTO}" />`
    )
    .join('')

  return segmenti + `<path d="${tratti.join(' ')}" fill="none" stroke="#000" stroke-width="1" />`
}
