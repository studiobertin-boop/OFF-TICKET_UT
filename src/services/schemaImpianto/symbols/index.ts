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

/** Testo: `x`/`y` sono il centro, o il capo iniziale/finale se `ancora` lo dice. */
function testo(
  x: number,
  y: number,
  contenuto: string,
  dimensione = 20,
  ancora: 'middle' | 'start' | 'end' = 'middle'
): string {
  return `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${dimensione}" text-anchor="${ancora}" dominant-baseline="central" fill="#000">${escapeXml(contenuto)}</text>`
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

/**
 * Valvola di intercettazione: farfalla con l'asse lungo la tubazione. Su un montante va
 * ruotata: nel blocco CAD la farfalla è sempre in linea col tubo, mai di traverso.
 */
export function valvolaIntercettazione(
  x: number,
  y: number,
  orientamento: 'orizzontale' | 'verticale' = 'orizzontale'
): string {
  const l = 9
  const h = 8
  const d =
    orientamento === 'orizzontale'
      ? `M ${x - l} ${y - h} L ${x - l} ${y + h} L ${x} ${y} Z M ${x + l} ${y - h} L ${x + l} ${y + h} L ${x} ${y} Z`
      : `M ${x - h} ${y - l} L ${x + h} ${y - l} L ${x} ${y} Z M ${x - h} ${y + l} L ${x + h} ${y + l} L ${x} ${y} Z`
  return traccia(d)
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

/**
 * Compressore: riquadro con la girante (cerchio tagliato da una corda, non da un diametro).
 * Nel blocco CAD il codice sta in alto a sinistra sul filo del riquadro e la girante è
 * centrata; quando c'è il disoleatore la girante slitta a destra per fargli posto, il codice
 * passa a destra e a sinistra compaiono la valvola di sicurezza e il riquadro del disoleatore.
 */
export function simboloCompressore(nodo: SchemaNodoPosizionato): string {
  const { larghezza, altezza } = DIMENSIONI_NODO.compressore
  const corpo = `<rect x="0" y="0" width="${larghezza}" height="${altezza}" fill="none" stroke="#000" stroke-width="${TRATTO}" />`
  const raggio = 36

  /** Girante: cerchio con una corda obliqua, spostata dal centro come nel blocco. */
  const girante = (cx: number, cy: number): string => {
    const s = raggio * 0.72
    const scarto = raggio * 0.16
    return [
      `<circle cx="${cx}" cy="${cy}" r="${raggio}" fill="none" stroke="#000" stroke-width="${TRATTO}" />`,
      traccia(`M ${cx - s} ${cy + s - scarto} L ${cx + s} ${cy - s - scarto}`),
    ].join('')
  }

  if (!nodo.accessorio) {
    return corpo + girante(larghezza / 2, altezza / 2) + testo(10, 20, nodo.id, 24, 'start')
  }

  const cx = larghezza - raggio - 18
  const conGirante = girante(cx, altezza / 2 + 8)

  // Disoleatore: riquadro in basso a sinistra, con sopra la propria valvola di sicurezza.
  const dw = 64
  const dh = 54
  const dx = 8
  const dy = altezza - dh - 8
  const disoleatore = [
    `<rect x="${dx}" y="${dy}" width="${dw}" height="${dh}" fill="none" stroke="#000" stroke-width="${TRATTO}" />`,
    testo(dx + 4, dy + dh - 12, nodo.accessorio.codice, 14, 'start'),
  ].join('')

  const valvola = nodo.accessorio.valvoleSicurezza[0]
  const conValvola = valvola
    ? valvolaSicurezza(dx + 18, 44) + testo(dx, 22, valvola.codice, 14, 'start')
    : ''

  return corpo + conGirante + testo(larghezza - 10, 20, nodo.id, 24, 'end') + disoleatore + conValvola
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

  // Nel serbatoio orizzontale il blocco CAD sposta le valvole ai due capi e il codice verso
  // destra; in quello verticale sta tutto sull'asse.
  const xValvole = orizzontale ? x + w * 0.22 : larghezza / 2
  const xScarico = orizzontale ? x + w * 0.78 : larghezza / 2
  const xCodice = orizzontale ? x + w * 0.62 : larghezza / 2

  const etichettaCodice = testo(xCodice, y + h / 2, nodo.id, 24)

  // Le valvole di sicurezza si appoggiano sulla sommità, affiancate quando sono più d'una.
  const valvole = nodo.valvoleSicurezza
    .map((v, i) => {
      const passo = 34
      const vx = xValvole + (i - (nodo.valvoleSicurezza.length - 1) / 2) * passo
      const vy = y - 12
      return [
        traccia(`M ${vx} ${y} L ${vx} ${vy + 6}`),
        valvolaSicurezza(vx, vy),
        testo(vx, vy - 18, v.codice, 14),
      ].join('')
    })
    .join('')

  const scarico = valvolaScarico(xScarico, y + h + 10)
  return corpo + etichettaCodice + valvole + scarico
}

/**
 * Simbolo a rombo (essiccatore, filtro, separatore). Nei blocchi CAD i tre si distinguono
 * per il segno interno — il filtro ha un tratto verticale, l'essiccatore e il separatore un
 * tratto orizzontale in basso — e tutti portano due attacchi che sporgono ai fianchi, dove
 * si innestano le tubazioni.
 */
function simboloRombo(
  nodo: SchemaNodoPosizionato,
  segno: 'verticale' | 'orizzontale',
  conScarico: boolean
): string {
  const { larghezza, altezza } = DIMENSIONI_NODO[nodo.tipo]
  const cx = larghezza / 2
  const cy = altezza / 2 - 6
  const semiL = larghezza / 2 - 6
  const semiH = altezza / 2 - 16

  const rombo = traccia(
    `M ${cx} ${cy - semiH} L ${cx + semiL} ${cy} L ${cx} ${cy + semiH} L ${cx - semiL} ${cy} Z`
  )
  const attacchi = traccia(
    `M ${cx - semiL - 10} ${cy} L ${cx - semiL} ${cy} M ${cx + semiL} ${cy} L ${cx + semiL + 10} ${cy}`
  )
  const interno =
    segno === 'verticale'
      ? traccia(`M ${cx} ${cy - semiH} L ${cx} ${cy + semiH}`)
      : traccia(`M ${cx - semiL * 0.42} ${cy + semiH * 0.5} L ${cx + semiL * 0.42} ${cy + semiH * 0.5}`)

  const haAccessorio = Boolean(nodo.accessorio)
  const etichettaCodice = testo(cx, haAccessorio ? cy - 12 : cy, nodo.id, haAccessorio ? 16 : 18)

  // L'accessorio ha una resa propria: riquadro per il recipiente filtro, esagono del
  // circuito frigorifero per lo scambiatore dell'essiccatore.
  let accessorio = ''
  if (nodo.accessorio && nodo.tipo === 'filtro') {
    const rw = 40
    const rh = 18
    accessorio =
      `<rect x="${cx - rw / 2}" y="${cy + 2}" width="${rw}" height="${rh}" rx="4" ry="4" fill="none" stroke="#000" stroke-width="${TRATTO}" />` +
      testo(cx, cy + 2 + rh / 2, nodo.accessorio.codice, 11)
  } else if (nodo.accessorio) {
    const r = 9
    const ey = cy + 26
    const esagono = Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 3) * i + Math.PI / 6
      return `${(cx + r * Math.cos(a)).toFixed(1)} ${(ey + r * Math.sin(a)).toFixed(1)}`
    })
    accessorio =
      testo(cx, cy + 6, nodo.accessorio.codice, 12) +
      traccia(`M ${esagono.join(' L ')} Z`)
  }

  const scarico = conScarico ? valvolaScarico(cx, cy + semiH + 12) : ''
  return rombo + attacchi + interno + etichettaCodice + accessorio + scarico
}

export function simboloEssiccatore(nodo: SchemaNodoPosizionato): string {
  return simboloRombo(nodo, 'orizzontale', true)
}

export function simboloFiltro(nodo: SchemaNodoPosizionato): string {
  return simboloRombo(nodo, 'verticale', true)
}

/** Il separatore scarica da un codolo nudo, senza valvola: così nel blocco di riferimento. */
export function simboloSeparatore(nodo: SchemaNodoPosizionato): string {
  const { larghezza, altezza } = DIMENSIONI_NODO.separatore
  const cx = larghezza / 2
  const cy = altezza / 2 - 6
  const semiH = altezza / 2 - 16
  return simboloRombo(nodo, 'orizzontale', false) + traccia(`M ${cx} ${cy + semiH} L ${cx} ${cy + semiH + 14}`)
}

/** Tanica raccolta condense: riquadro chiuso col solo codice dentro. */
export function simboloTanica(nodo: SchemaNodoPosizionato): string {
  const { larghezza, altezza } = DIMENSIONI_NODO.tanica
  const x = 6
  const y = 6
  const w = larghezza - 12
  const h = altezza - 12
  return [
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#000" stroke-width="${TRATTO}" />`,
    testo(larghezza / 2, y + h / 2, nodo.id, 20),
  ].join('')
}

/** Pacco bombole: quattro bombole a fondo piatto e cielo arrotondato, col codice sopra il telaio. */
export function simboloPaccoBombole(nodo: SchemaNodoPosizionato): string {
  const { larghezza, altezza } = DIMENSIONI_NODO.pacco_bombole
  const bombole = 4
  const yTelaio = 22
  const hTelaio = altezza - yTelaio - 4
  const margine = 6
  const passo = (larghezza - margine * 2) / bombole

  const cilindri = Array.from({ length: bombole }, (_, i) => {
    const bx = margine + i * passo + 2
    const bw = passo - 4
    const r = bw / 2
    const cielo = yTelaio + 8
    const fondo = yTelaio + hTelaio
    // Corpo a U rovesciata: fianchi dritti, cielo arrotondato, fondo aperto sul telaio.
    const corpo = traccia(
      `M ${bx} ${fondo} L ${bx} ${cielo + r} A ${r} ${r} 0 0 1 ${bx + bw} ${cielo + r} L ${bx + bw} ${fondo}`
    )
    const collo = traccia(`M ${bx + r - 3} ${cielo} L ${bx + r - 3} ${cielo - 6} M ${bx + r + 3} ${cielo} L ${bx + r + 3} ${cielo - 6}`)
    return corpo + collo
  }).join('')

  return [
    `<rect x="${margine}" y="${yTelaio}" width="${larghezza - margine * 2}" height="${hTelaio}" fill="none" stroke="#000" stroke-width="${TRATTO}" />`,
    cilindri,
    testo(margine, 10, nodo.id, 16, 'start'),
  ].join('')
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

/**
 * Muro di separazione sala compressori / stabilimento: muratura tratteggiata a 45°, interrotta
 * da un varco per ogni tubazione che lo attraversa. Varchi troppo vicini vengono fusi in uno
 * solo, o fra i due resterebbe un moncone di muro largo pochi pixel.
 */
export function simboloMuro(x: number, yMin: number, yMax: number, varchi: number[]): string {
  const spessore = 14
  const larghezzaVarco = 44

  const aperture: [number, number][] = []
  for (const y of [...new Set(varchi)].sort((a, b) => a - b)) {
    const inizio = y - larghezzaVarco / 2
    const fine = y + larghezzaVarco / 2
    const ultima = aperture[aperture.length - 1]
    if (ultima && inizio <= ultima[1] + 20) ultima[1] = Math.max(ultima[1], fine)
    else aperture.push([inizio, fine])
  }

  // I tronconi pieni sono ciò che resta del muro fra un'apertura e la successiva.
  const tronconi: [number, number][] = []
  let cursore = yMin
  for (const [inizio, fine] of aperture) {
    if (inizio > cursore) tronconi.push([cursore, inizio])
    cursore = Math.max(cursore, fine)
  }
  if (cursore < yMax) tronconi.push([cursore, yMax])

  const segmenti = tronconi
    .map(
      ([a, b]) =>
        `<rect x="${x}" y="${a}" width="${spessore}" height="${b - a}" fill="none" stroke="#000" stroke-width="${TRATTO}" />`
    )
    .join('')

  const tratti = tronconi
    .flatMap(([a, b]) => {
      const righe: string[] = []
      for (let y = a; y + 12 < b; y += 12) righe.push(`M ${x} ${y + 12} L ${x + spessore} ${y}`)
      return righe
    })
    .join(' ')

  return segmenti + `<path d="${tratti}" fill="none" stroke="#000" stroke-width="1" />`
}
