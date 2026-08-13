/**
 * Libreria dei simboli, ricalcata sui blocchi AutoCAD in `DOCUMENTAZIONE/relazione/Blocchi.pdf`.
 *
 * Ogni simbolo è una funzione pura che produce un frammento SVG in coordinate locali
 * (origine in alto a sinistra del riquadro dichiarato in `REGISTRO_SIMBOLI`): il render
 * statico li concatena, l'editor li riusa dentro i custom node di react-flow, così il
 * disegno è lo stesso nelle due modalità.
 *
 * Convenzioni grafiche del CAD di riferimento: solo tratto nero su fondo bianco, nessun
 * riempimento colorato, spessore uniforme.
 *
 * Ingombri e ancore vivono qui, non in `layout.ts`: nascono dalla stessa geometria che
 * disegna i simboli, quindi il registro (`REGISTRO_SIMBOLI`) è la fonte unica e `layout.ts`
 * si limita a riesportare `DIMENSIONI_NODO` per i consumatori esistenti.
 */
import { ondula } from '../tratti'
import type { SchemaArcoStile, SchemaNodoTipo, SchemaNodo, SchemaAncora, ChiaveSimbolo } from '../types'
import { chiaveSimbolo } from '../types'

export const TRATTO = 2
const FONT = 'Arial, Helvetica, sans-serif'

/** Ingombri per tipo, in unità SVG: le funzioni di disegno vi leggono `larghezza`/`altezza`. */
const DIMENSIONI: Record<SchemaNodoTipo, { larghezza: number; altezza: number }> = {
  compressore: { larghezza: 160, altezza: 150 },
  serbatoio: { larghezza: 150, altezza: 260 },
  essiccatore: { larghezza: 110, altezza: 110 },
  filtro: { larghezza: 110, altezza: 110 },
  separatore: { larghezza: 110, altezza: 110 },
  tanica: { larghezza: 80, altezza: 70 },
  pacco_bombole: { larghezza: 120, altezza: 100 },
  utenze: { larghezza: 190, altezza: 120 },
  giunzione: { larghezza: 24, altezza: 24 },
}

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

/**
 * Interlinea, in multipli del corpo del carattere. Sotto 1,2 le righe si toccano nei glifi
 * discendenti; molto sopra, il blocco di testo si sfilaccia e non si legge più come un'unità.
 */
export const INTERLINEA_TESTO = 1.25

/**
 * Testo che va a capo sugli `\n`. Un `<text>` SVG non manda a capo da sé — un `\n` dentro il
 * contenuto verrebbe reso come uno spazio — quindi ogni riga è un `<tspan>` con la propria
 * ascissa e ordinata, incolonnate sulla stessa `x`.
 *
 * `x`/`y` sono il primo capo della PRIMA riga (o il suo centro, secondo `ancora`): le righe
 * successive scendono. Chi calcola l'ingombro di un testo deve quindi tenere conto che il
 * blocco cresce verso il basso.
 *
 * Non ha ancora consumatori in questo repo: il terminale utenze e i testi liberi che la
 * useranno arrivano nei task successivi del Blocco C2 (`testo()` resta il disegno di tutto
 * ciò che oggi è a riga singola: codici, etichette, tabella).
 */
export function testoMultiRiga(
  x: number,
  y: number,
  contenuto: string,
  dimensione = 20,
  ancora: 'middle' | 'start' | 'end' = 'middle'
): string {
  const righe = contenuto.split('\n')
  const tspan = righe
    .map((riga, i) => `<tspan x="${x}" y="${y + i * dimensione * INTERLINEA_TESTO}">${escapeXml(riga)}</tspan>`)
    .join('')
  return `<text font-family="${FONT}" font-size="${dimensione}" text-anchor="${ancora}" dominant-baseline="central" fill="#000">${tspan}</text>`
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

/**
 * Riduttore di pressione: la stessa farfalla della valvola di intercettazione più uno stelo
 * di regolazione, per distinguerlo a colpo d'occhio. Simbolo segnaposto (vedi nota di testa
 * al file sui simboli nuovi di questo blocco), non un blocco CAD del committente.
 */
export function riduttorePressione(
  x: number,
  y: number,
  orientamento: 'orizzontale' | 'verticale' = 'orizzontale'
): string {
  const base = valvolaIntercettazione(x, y, orientamento)
  const stelo =
    orientamento === 'orizzontale'
      ? traccia(`M ${x} ${y - 8} L ${x} ${y - 16}`) +
        `<rect x="${x - 5}" y="${y - 22}" width="10" height="6" fill="none" stroke="#000" stroke-width="${TRATTO}" />`
      : traccia(`M ${x + 8} ${y} L ${x + 16} ${y}`) +
        `<rect x="${x + 16}" y="${y - 5}" width="6" height="10" fill="none" stroke="#000" stroke-width="${TRATTO}" />`
  return base + stelo
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
 * Campione di tubazione per la legenda: un tratto orizzontale centrato sull'origine, reso con
 * lo stesso stile che `renderSvg` dà alla tubazione vera. Riusare qui la funzione che disegna
 * (`ondula`) invece di ridisegnare un'onda a mano è ciò che tiene campione e disegno d'accordo
 * per costruzione: un'onda «di legenda» diversa da quella dei tubi sarebbe una didascalia falsa.
 */
export function campioneTubazione(stile: SchemaArcoStile): string {
  const meta = 30
  const capi = [
    { x: -meta, y: 0 },
    { x: meta, y: 0 },
  ]
  if (stile === 'flessibile') {
    return `<path d="${ondula(capi)}" fill="none" stroke="#000" stroke-width="${TRATTO}" />`
  }
  const tratteggio = stile === 'condensa' ? ' stroke-dasharray="10 7"' : ''
  return `<path d="M ${-meta} 0 L ${meta} 0" fill="none" stroke="#000" stroke-width="${TRATTO}"${tratteggio} />`
}

/**
 * Compressore: riquadro con la girante (cerchio tagliato da una corda, non da un diametro).
 * Nel blocco CAD il codice sta in alto a sinistra sul filo del riquadro e la girante è
 * centrata; quando c'è il disoleatore la girante slitta a destra per fargli posto, il codice
 * passa a destra e a sinistra compaiono la valvola di sicurezza e il riquadro del disoleatore.
 */
export function simboloCompressore(nodo: SchemaNodo): string {
  const { larghezza, altezza } = DIMENSIONI.compressore
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
export function simboloSerbatoio(nodo: SchemaNodo): string {
  const { larghezza, altezza } = DIMENSIONI.serbatoio
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
  nodo: SchemaNodo,
  segno: 'verticale' | 'orizzontale',
  conScarico: boolean
): string {
  const { larghezza, altezza } = DIMENSIONI[nodo.tipo]
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

export function simboloEssiccatore(nodo: SchemaNodo): string {
  return simboloRombo(nodo, 'orizzontale', true)
}

export function simboloFiltro(nodo: SchemaNodo): string {
  return simboloRombo(nodo, 'verticale', true)
}

/** Il separatore scarica da un codolo nudo, senza valvola: così nel blocco di riferimento. */
export function simboloSeparatore(nodo: SchemaNodo): string {
  const { larghezza, altezza } = DIMENSIONI.separatore
  const cx = larghezza / 2
  const cy = altezza / 2 - 6
  const semiH = altezza / 2 - 16
  return simboloRombo(nodo, 'orizzontale', false) + traccia(`M ${cx} ${cy + semiH} L ${cx} ${cy + semiH + 14}`)
}

/** Tanica raccolta condense: riquadro chiuso col solo codice dentro. */
export function simboloTanica(nodo: SchemaNodo): string {
  const { larghezza, altezza } = DIMENSIONI.tanica
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
export function simboloPaccoBombole(nodo: SchemaNodo): string {
  const { larghezza, altezza } = DIMENSIONI.pacco_bombole
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

/**
 * Giunzione (TEE): un punto pieno, senza monconi. Fino al Blocco B disegnava tre tratti verso
 * sinistra, destra e basso, che restavano visibili anche quando nessuna tubazione ci arrivava
 * e fissavano il ramo di diramazione verso il basso; il committente ha chiesto un attacco
 * libero da qualunque lato, e la forma a T (o a croce, o a gomito) la disegnano ora le
 * tubazioni che ci arrivano davvero.
 *
 * Il raggio è esattamente metà della larghezza del riquadro: il pallino tocca così le quattro
 * ancore, che stanno sui bordi, senza lasciare un buco fra la fine di un tubo e la giunzione.
 * Un raggio più piccolo lo lascerebbe, un raggio più grande sporgerebbe fuori dal riquadro.
 */
export function simboloGiunzione(_nodo: SchemaNodo): string {
  const { larghezza, altezza } = DIMENSIONI.giunzione
  return `<circle cx="${larghezza / 2}" cy="${altezza / 2}" r="${larghezza / 2}" fill="#000" />`
}

/**
 * Geometria del terminale utenze, condivisa fra chi lo disegna (`simboloUtenze`) e chi ne calcola
 * l'ingombro (`dimensioniDi`): sono la stessa cosa vista da due parti, e tenerle separate è
 * esattamente ciò che faceva uscire la scritta dal riquadro.
 */
const UTENZE = {
  /** Ascissa del codolo, la stessa dell'ancora `in` nel registro. */
  x: 12,
  /** Rientro della scritta rispetto al codolo. */
  rientroScritta: 18,
  dimensioneScritta: 18,
  /** Aria fra la fine della scritta e il bordo destro del riquadro. */
  margineDestro: 12,
  /**
   * Larghezza media di un carattere, in frazione della dimensione del font. Per Arial 0,5 è una
   * buona approssimazione: serve a decidere quanto allargare la tela, non a comporre
   * tipograficamente, e misurare i glifi richiederebbe un DOM che queste funzioni non hanno.
   */
  larghezzaCarattere: 0.5,
}

/**
 * Terminale «Alle utenze»: codolo tratteggiato che sale dall'ancora, punta di freccia e la
 * scritta accanto. Riproduce la forma del disegno di riferimento del committente
 * (`DOCUMENTAZIONE/relazione/schema.png`), dove il tratteggio è corto e il tratto prima è
 * tubazione vera.
 *
 * La punta è un triangolo pieno e non un `marker-end`: nell'editor `SchemaNodeSymbol` monta il
 * simbolo in un `<svg>` suo, senza i `<defs>` che `renderSvg` dichiara, e un marker non
 * verrebbe disegnato affatto.
 */
export function simboloUtenze(nodo: SchemaNodo): string {
  const { altezza } = DIMENSIONI.utenze
  const x = UTENZE.x
  const yPunta = 14
  return [
    `<path d="M ${x} ${altezza} L ${x} ${yPunta + 12}" fill="none" stroke="#000" stroke-width="${TRATTO}" stroke-dasharray="10 7" />`,
    `<path d="M ${x - 6} ${yPunta + 13} L ${x} ${yPunta} L ${x + 6} ${yPunta + 13} Z" fill="#000" />`,
    testo(x + UTENZE.rientroScritta, yPunta + 6, nodo.etichetta, UTENZE.dimensioneScritta, 'start'),
  ].join('')
}

export interface DefinizioneSimbolo {
  dimensioni: { larghezza: number; altezza: number }
  ancore: SchemaAncora[]
  disegna: (nodo: SchemaNodo) => string
}

/** Ancore condivise da essiccatore e filtro, che hanno la stessa geometria e sono solo stadi della linea aria. */
const ANCORE_ROMBO: SchemaAncora[] = [
  { id: 'sx', x: 6, y: 49, accetta: ['aria'] },
  { id: 'dx', x: 104, y: 49, accetta: ['aria'] },
  { id: 'alto-in', x: 55, y: 10, accetta: ['aria'] },
  { id: 'basso-out', x: 55, y: 88, accetta: ['condensa'] },
]

/**
 * Ancore del separatore: stessa geometria del rombo, ma quando fa da pozzo di raccolta
 * condense (`dati_impianto.raccolta_condense: 'separatore'`) la corsia condense entra di
 * fianco, non dall'alto (schemi storici, `555_RELAZIONE_TECNICA_00-2025.pdf` pag. 3): `sx`/`dx`
 * accettano anche condensa, oltre all'aria che già passa quando il separatore è uno stadio
 * di linea.
 */
const ANCORE_SEPARATORE: SchemaAncora[] = [
  { id: 'sx', x: 6, y: 49, accetta: ['aria', 'condensa'] },
  { id: 'dx', x: 104, y: 49, accetta: ['aria', 'condensa'] },
  { id: 'alto-in', x: 55, y: 10, accetta: ['aria'] },
  { id: 'basso-out', x: 55, y: 88, accetta: ['condensa'] },
]

/**
 * Registro dei simboli: unisce per ogni variante grafica l'ingombro, i punti di aggancio
 * delle tubazioni e la funzione di disegno, così i tre non possono più andare fuori sincrono
 * come accadeva quando vivevano in file separati (`DIMENSIONI_NODO` in `layout.ts`, disegno
 * qui). Le coordinate delle ancore sono ricavate a mano dalla geometria di ogni funzione
 * `simbolo*` (vedi `corpoNodo` in `layout.ts` per i riquadri del corpo disegnato).
 */
export const REGISTRO_SIMBOLI: Record<ChiaveSimbolo, DefinizioneSimbolo> = {
  compressore: {
    dimensioni: DIMENSIONI.compressore,
    ancore: [
      { id: 'alto-out', x: 80, y: 0, accetta: ['aria'] },
      { id: 'basso-out', x: 80, y: 150, accetta: ['condensa'] },
    ],
    disegna: simboloCompressore,
  },
  'serbatoio:VERTICALE': {
    dimensioni: DIMENSIONI.serbatoio,
    ancore: [
      { id: 'sx', x: 33, y: 150, accetta: ['aria'] },
      { id: 'dx', x: 117, y: 150, accetta: ['aria'] },
      { id: 'alto-in', x: 75, y: 40, accetta: ['aria', 'valvola_sicurezza'] },
      { id: 'basso-out', x: 75, y: 260, accetta: ['condensa'] },
    ],
    disegna: simboloSerbatoio,
  },
  'serbatoio:ORIZZONTALE': {
    dimensioni: DIMENSIONI.serbatoio,
    ancore: [
      { id: 'sx', x: 0, y: 130, accetta: ['aria'] },
      { id: 'dx', x: 150, y: 130, accetta: ['aria'] },
      { id: 'alto-in', x: 33, y: 88, accetta: ['aria', 'valvola_sicurezza'] },
      { id: 'basso-out', x: 117, y: 172, accetta: ['condensa'] },
    ],
    disegna: simboloSerbatoio,
  },
  essiccatore: { dimensioni: DIMENSIONI.essiccatore, ancore: ANCORE_ROMBO, disegna: simboloEssiccatore },
  filtro: { dimensioni: DIMENSIONI.filtro, ancore: ANCORE_ROMBO, disegna: simboloFiltro },
  separatore: { dimensioni: DIMENSIONI.separatore, ancore: ANCORE_SEPARATORE, disegna: simboloSeparatore },
  tanica: {
    dimensioni: DIMENSIONI.tanica,
    ancore: [{ id: 'alto-in', x: 40, y: 6, accetta: ['condensa'] }],
    disegna: simboloTanica,
  },
  pacco_bombole: {
    dimensioni: DIMENSIONI.pacco_bombole,
    ancore: [{ id: 'dx', x: 114, y: 60, accetta: ['aria'] }],
    disegna: simboloPaccoBombole,
  },
  giunzione: {
    dimensioni: DIMENSIONI.giunzione,
    // Quattro attacchi sempre disponibili, uno per lato: non c'è un «davanti», quindi non
    // c'è nulla da ruotare. Gli id sono i nomi dei quattro lati: sx/dx/alto/basso.
    ancore: [
      { id: 'sx', x: 0, y: 12, accetta: ['aria'] },
      { id: 'dx', x: 24, y: 12, accetta: ['aria'] },
      { id: 'alto', x: 12, y: 0, accetta: ['aria'] },
      { id: 'basso', x: 12, y: 24, accetta: ['aria'] },
    ],
    disegna: simboloGiunzione,
  },
  utenze: {
    dimensioni: DIMENSIONI.utenze,
    // Una sola: la linea aria ci arriva e finisce lì. Sta in fondo al codolo, dove il
    // tratteggio comincia, così la tubazione entrante e il codolo formano un tratto continuo.
    ancore: [{ id: 'in', x: 12, y: 120, accetta: ['aria'] }],
    disegna: simboloUtenze,
  },
}

export function definizioneDi(nodo: { tipo: SchemaNodoTipo; orientamento?: 'VERTICALE' | 'ORIZZONTALE' }): DefinizioneSimbolo {
  return REGISTRO_SIMBOLI[chiaveSimbolo(nodo)]
}

export function ancoraDi(
  nodo: { tipo: SchemaNodoTipo; orientamento?: 'VERTICALE' | 'ORIZZONTALE' },
  id: string
): SchemaAncora | undefined {
  return definizioneDi(nodo).ancore.find((a) => a.id === id)
}

/**
 * Ingombro effettivo di un nodo. Coincide col riquadro dichiarato nel registro per tutti i tipi
 * tranne il terminale utenze, la cui scritta è libera: l'utente la cambia dall'editor, e con la
 * larghezza fissa di 190 le restavano una diciassettina di caratteri — oltre, la scritta usciva
 * dal riquadro, tagliata subito nell'editor (`SchemaNodeSymbol` monta un `<svg>` largo quanto
 * l'ingombro) e tagliata nel PNG appena superava il margine. La larghezza si ricava quindi dalla
 * lunghezza dell'etichetta, con quella del registro come minimo, così `dimensioniLayout` allarga
 * da sé la tela come la spec promette.
 *
 * `DIMENSIONI_NODO` resta un `Record` statico per tipo e non può portare questa informazione:
 * chi ha in mano il nodo (e quindi la sua etichetta) passa di qui, gli altri continuano a leggere
 * il registro. I due punti dove la larghezza del terminale conta davvero sono `dimensioniLayout`
 * (la tela del PNG) e `SchemaNodeSymbol` (il riquadro sulla tela dell'editor).
 */
export function dimensioniDi(nodo: SchemaNodo): { larghezza: number; altezza: number } {
  const dimensioni = definizioneDi(nodo).dimensioni
  if (nodo.tipo !== 'utenze') return dimensioni

  const scritta = nodo.etichetta.length * UTENZE.dimensioneScritta * UTENZE.larghezzaCarattere
  const necessaria = UTENZE.x + UTENZE.rientroScritta + scritta + UTENZE.margineDestro
  return { larghezza: Math.max(dimensioni.larghezza, Math.ceil(necessaria)), altezza: dimensioni.altezza }
}

/** Ingombri per tipo, ricavati dal registro. Conserva la forma che `layout.ts` già usa. */
export const DIMENSIONI_NODO: Record<SchemaNodoTipo, { larghezza: number; altezza: number }> = {
  compressore: REGISTRO_SIMBOLI.compressore.dimensioni,
  serbatoio: REGISTRO_SIMBOLI['serbatoio:VERTICALE'].dimensioni,
  essiccatore: REGISTRO_SIMBOLI.essiccatore.dimensioni,
  filtro: REGISTRO_SIMBOLI.filtro.dimensioni,
  separatore: REGISTRO_SIMBOLI.separatore.dimensioni,
  tanica: REGISTRO_SIMBOLI.tanica.dimensioni,
  pacco_bombole: REGISTRO_SIMBOLI.pacco_bombole.dimensioni,
  giunzione: REGISTRO_SIMBOLI.giunzione.dimensioni,
  utenze: REGISTRO_SIMBOLI.utenze.dimensioni,
}

/** Frammento SVG del nodo in coordinate locali (senza traslazione). */
export function simboloDi(nodo: SchemaNodo): string {
  return definizioneDi(nodo).disegna(nodo)
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
