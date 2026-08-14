/**
 * Geometria dei tratti di tubazione, condivisa da chi disegna: il render statico
 * (`renderSvg.ts`), l'editor (`SchemaEdgeTubazione.tsx`) e i campioni della legenda
 * (`symbols/index.ts`). Sta in un file suo perché `symbols` non può importare `renderSvg`
 * senza chiudere un ciclo, e perché è geometria pura, verificabile senza DOM.
 */

import type { SchemaArcoStile } from './types'
import { agganciaQuota } from './griglia'

export interface Punto {
  x: number
  y: number
}

/** Mezzo periodo dell'onda del flessibile, in unità SVG. */
export const PASSO_ONDA = 5
/** Quanto l'onda si scosta dall'asse del tubo. */
export const AMPIEZZA_ONDA = 5

/**
 * Raccorda due punti con due tratti ortogonali. Il verso lo decide la distanza maggiore:
 * si esce nella direzione in cui c'è più strada, che è il modo in cui si instrada a mano.
 * Spostata qui da `renderSvg.ts` perché la usa anche l'editor (routing unificato, vedi
 * `trascinaTratto` più sotto), non solo il render statico.
 */
export function raccordoOrtogonale(da: Punto, a: Punto): Punto[] {
  if (da.x === a.x || da.y === a.y) return [a]
  return Math.abs(a.x - da.x) >= Math.abs(a.y - da.y)
    ? [{ x: a.x, y: da.y }, a]
    : [{ x: da.x, y: a.y }, a]
}

/** Polilinea che parte dall'ancora, tocca i gomiti imposti e arriva all'altra ancora. */
export function polilineaConGomiti(inizio: Punto, gomiti: Punto[], fine: Punto): Punto[] {
  const punti: Punto[] = [inizio]
  let corrente = inizio
  for (const g of [...gomiti, fine]) {
    punti.push(...raccordoOrtogonale(corrente, g))
    corrente = g
  }
  return punti
}

/** Tracciato SVG (comandi M/L) di una polilinea già risolta: la stessa linea dritta che
 *  disegna il render statico per gli stili non ondulati, e che l'editor usa anche come area
 *  di trascinamento del tratto (`useTrascinamentoTratto.ts`). Condivisa fra `renderSvg.ts` e
 *  `SchemaEdgeTubazione.tsx` perché la forma dev'essere letteralmente la stessa stringa. */
export function percorso(punti: Punto[]): string {
  return punti.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
}

/**
 * Raccordo che preserva l'asse del tratto trascinato: il gomito nuovo (se serve) sta sulla
 * coordinata di `fisso` lungo l'asse perpendicolare al tratto e su quella di `daPreservare`
 * lungo l'asse del tratto — così il tratto appena spostato resta esattamente dov'è stato
 * messo, e solo il moncone che lo ricongiunge al capo fisso si allunga o si accorcia. È
 * diverso da `raccordoOrtogonale`, che sceglie il verso in base alla distanza maggiore: qui
 * il verso è dettato dall'orientamento del tratto trascinato, non da un'euristica.
 */
function raccordaPreservando(fisso: Punto, daPreservare: Punto, orizzontale: boolean): Punto[] {
  const allineato = orizzontale ? fisso.y === daPreservare.y : fisso.x === daPreservare.x
  if (allineato) return [daPreservare]
  const gomito = orizzontale ? { x: daPreservare.x, y: fisso.y } : { x: fisso.x, y: daPreservare.y }
  return [gomito, daPreservare]
}

/**
 * Nuovi gomiti dopo aver trascinato in blocco il tratto dritto fra `full[indiceTratto]` e
 * `full[indiceTratto+1]`, numerazione della polilinea COMPLETA che l'utente vede — quella che
 * produce `instrada` per questo arco (rotta nativa dello stile se senza gomiti a mano,
 * `polilineaConGomiti` se ce ne sono già) — di `delta`. Riceve `stile` e `quote` proprio per
 * ricostruirla con `instrada`, non con `polilineaConGomiti` direttamente: numerare una
 * polilinea diversa da quella che il componente ha disegnato (e su cui l'utente ha afferrato
 * il tratto con `indiceTrattoPiuVicino`) sposta un tratto diverso da quello agganciato: è
 * esattamente il difetto del giro di riparazione 1, dove questa funzione ricostruiva ancora
 * con `polilineaConGomiti` da sola — per un arco senza gomiti a mano una spezzata a un solo
 * angolo, mentre la tela (via `polilineaDellArco`) disegna già la rotta nativa a più tratti.
 *
 * Il tratto resta ortogonale per costruzione (le rotte di `instrada` lo garantiscono a monte):
 * si sposta la sola coordinata condivisa dai due capi (y se il tratto è orizzontale, x se
 * verticale) e si ricongiungono i vicini — è il modo in cui «i gomiti ai capi si aggiustano da
 * soli»: se un capo tocca un'ancora, ne nasce uno nuovo lì vicino (l'ancora non si sposta mai);
 * se tocca già un gomito, quel gomito trasla e basta, perché `raccordaPreservando` lo trova già
 * allineato. Come si posa quella coordinata è nel commento del corpo della funzione, sotto.
 */
export function trascinaTratto(
  stile: SchemaArcoStile,
  pDa: Punto,
  pA: Punto,
  gomiti: Punto[] | undefined,
  quote: QuoteInstradamento,
  indiceTratto: number,
  delta: Punto
): Punto[] {
  const full = instrada(stile, pDa, pA, gomiti, quote)
  const a = full[indiceTratto]
  const b = full[indiceTratto + 1]
  if (!a || !b) return gomiti ?? []

  const orizzontale = a.y === b.y
  // Si posa la quota ASSOLUTA agganciata, non si somma uno spostamento: sommare conserva
  // per sempre lo scarto di una partenza fuori griglia — misurato in pagina, un tratto a
  // x=726,5 trascinato di 50 finiva a 776,5. Le quote dei due capi entrano fra le posizioni
  // buone perché le ancore dei simboli sono ancora fuori griglia, e senza di loro un tubo
  // fra quote 260 e 234 non potrebbe mai essere raccordato dritto (agganciaQuota, griglia.ts).
  const quotaGrezza = orizzontale ? a.y + delta.y : a.x + delta.x
  const quotaNuova = agganciaQuota(quotaGrezza, orizzontale ? [pDa.y, pA.y] : [pDa.x, pA.x])
  const sposta = (p: Punto): Punto => (orizzontale ? { x: p.x, y: quotaNuova } : { x: quotaNuova, y: p.y })
  const nuovoA = sposta(a)
  const nuovoB = sposta(b)

  const precedente = full[indiceTratto - 1] ?? pDa
  const successivo = full[indiceTratto + 2] ?? pA

  const nuovaPolilinea: Punto[] = [
    pDa,
    ...full.slice(1, indiceTratto),
    ...raccordaPreservando(precedente, nuovoA, orizzontale),
    nuovoB,
    ...raccordaPreservando(nuovoB, successivo, orizzontale),
    ...full.slice(indiceTratto + 3),
  ]

  return nuovaPolilinea
    .filter((p, i, arr) => i === 0 || p.x !== arr[i - 1].x || p.y !== arr[i - 1].y)
    .slice(1, -1)
}

/**
 * Tracciato ondulato che segue una polilinea: convenzione CAD della tubazione flessibile.
 *
 * L'onda è perpendicolare alla direzione di ogni tratto e **riparte a ogni vertice**, così gli
 * spigoli restano netti come nei blocchi di riferimento invece di essere smussati da un'onda a
 * cavallo di due tratti. Il numero di mezzi periodi si adatta alla lunghezza e il passo si
 * ridistribuisce, perché il tratto deve finire esattamente sull'ancora e non a un'onda di
 * distanza: un tubo che non tocca il bocchello è un errore di disegno visibile.
 *
 * L'**ultimo semiperiodo dell'ultimo tratto** ha il punto di controllo sull'asse invece che
 * scostato: `marker-end` orienta la punta di freccia sulla tangente finale della curva (`E − C`),
 * e con un controllo scostato quella tangente formava 64° con l'asse del tubo — la punta arrivava
 * ruotata, ora in su ora in giù secondo la parità del semiperiodo, in ogni disegno consegnato.
 * Siccome i capi di ogni semiperiodo stanno già sull'asse, un controllo sull'asse rende quel
 * pezzetto rettilineo e la tangente coincide con la direzione del tubo: è anche ciò che si vede
 * nei blocchi CAD, dove il flessibile entra dritto nel raccordo. Un flessibile talmente corto da
 * avere un solo semiperiodo diventa rettilineo, ed è invisibile a quella scala.
 *
 * La polilinea passata resta la verità geometrica del percorso — chi calcola i varchi nel muro
 * continua a lavorare su quella, non su questo tracciato.
 */
export function ondula(punti: Punto[]): string {
  if (punti.length === 0) return ''
  const parti = [`M ${punti[0].x} ${punti[0].y}`]

  // Ultimo tratto che verrà davvero disegnato: quelli di lunghezza nulla sono saltati, e la
  // punta di freccia si orienta sull'ultimo Q emesso, non sull'ultima coppia di punti.
  let ultimoTratto = 0
  for (let i = 1; i < punti.length; i++) {
    if (Math.hypot(punti[i].x - punti[i - 1].x, punti[i].y - punti[i - 1].y) !== 0) ultimoTratto = i
  }

  for (let i = 1; i < punti.length; i++) {
    const a = punti[i - 1]
    const b = punti[i]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const lunghezza = Math.hypot(dx, dy)
    // Due punti coincidenti (gomito posato sull'ancora): niente da ondulare, e dividere per
    // zero riempirebbe il tracciato di NaN.
    if (lunghezza === 0) continue

    const ux = dx / lunghezza
    const uy = dy / lunghezza
    // Perpendicolare alla direzione del tratto: è su questa che l'onda oscilla.
    const px = -uy
    const py = ux

    const mezziPeriodi = Math.max(1, Math.round(lunghezza / PASSO_ONDA))
    const passo = lunghezza / mezziPeriodi

    for (let k = 0; k < mezziPeriodi; k++) {
      const verso = k % 2 === 0 ? 1 : -1
      const inizio = k * passo
      const fine = inizio + passo
      const mezzo = inizio + passo / 2
      // Ampiezza nulla sull'ultimo semiperiodo dell'ultimo tratto: vedi il commento in testa.
      const ampiezza = i === ultimoTratto && k === mezziPeriodi - 1 ? 0 : AMPIEZZA_ONDA
      const cx = a.x + ux * mezzo + px * ampiezza * verso
      const cy = a.y + uy * mezzo + py * ampiezza * verso
      const ex = a.x + ux * fine
      const ey = a.y + uy * fine
      parti.push(`Q ${arrotonda(cx)} ${arrotonda(cy)} ${arrotonda(ex)} ${arrotonda(ey)}`)
    }
  }

  return parti.join(' ')
}

/** Due decimali bastano al disegno e tengono l'SVG leggibile nei test. */
function arrotonda(valore: number): number {
  return Math.round(valore * 100) / 100
}

/**
 * Punto lungo una polilinea GIÀ RISOLTA (compresi i gomiti automatici di
 * `polilineaConGomiti`) a una frazione `t` della lunghezza totale — non del numero di
 * segmenti, o un tratto lungo poco sposterebbe il segno quanto uno lungo molto. Ritorna anche
 * se il tratto locale è orizzontale, per orientare il simbolo (`valvolaIntercettazione` e
 * `riduttorePressione` vogliono sapere se sono su un montante o su un tratto in linea).
 */
export function puntoSuTratto(punti: Punto[], t: number): { punto: Punto; orizzontale: boolean } {
  if (punti.length === 0) return { punto: { x: 0, y: 0 }, orizzontale: true }
  if (punti.length === 1) return { punto: punti[0], orizzontale: true }

  const lunghezze = punti.slice(1).map((p, i) => Math.hypot(p.x - punti[i].x, p.y - punti[i].y))
  const totale = lunghezze.reduce((s, l) => s + l, 0)
  const target = Math.max(0, Math.min(1, t)) * totale

  let percorsa = 0
  for (let i = 0; i < lunghezze.length; i++) {
    const l = lunghezze[i]
    if (percorsa + l >= target || i === lunghezze.length - 1) {
      const frazioneLocale = l === 0 ? 0 : (target - percorsa) / l
      const a = punti[i]
      const b = punti[i + 1]
      return {
        punto: { x: a.x + (b.x - a.x) * frazioneLocale, y: a.y + (b.y - a.y) * frazioneLocale },
        orizzontale: a.y === b.y,
      }
    }
    percorsa += l
  }
  return { punto: punti[punti.length - 1], orizzontale: true }
}

/**
 * Inversa di `puntoSuTratto`: la `t` del punto della polilinea più vicino a un punto libero
 * (es. dove il mouse ha rilasciato un segno trascinato). Proietta su ogni segmento, bloccando
 * la proiezione ai suoi estremi, e tiene il segmento a distanza minima — così un rilascio
 * fuori dalla linea si aggancia al tratto più vicino, non al primo della lista.
 */
export function tSuTratto(punti: Punto[], p: Punto): number {
  if (punti.length < 2) return 0

  const lunghezze = punti.slice(1).map((pt, i) => Math.hypot(pt.x - punti[i].x, pt.y - punti[i].y))
  const totale = lunghezze.reduce((s, l) => s + l, 0)
  if (totale === 0) return 0

  let percorsa = 0
  let migliore = { distanza: Infinity, t: 0 }
  for (let i = 0; i < lunghezze.length; i++) {
    const a = punti[i]
    const b = punti[i + 1]
    const l = lunghezze[i]
    const frazioneLocale =
      l === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / (l * l)))
    const proiezione = { x: a.x + (b.x - a.x) * frazioneLocale, y: a.y + (b.y - a.y) * frazioneLocale }
    const distanza = Math.hypot(p.x - proiezione.x, p.y - proiezione.y)
    if (distanza < migliore.distanza) migliore = { distanza, t: (percorsa + frazioneLocale * l) / totale }
    percorsa += l
  }
  return migliore.t
}

/**
 * Rientro del montante rispetto al fianco del recipiente: evita che corra sul contorno.
 * Vive qui, e non in `renderSvg.ts`, perché è geometria del tratto, non della resa grafica,
 * e serve a chi instrada da entrambe le parti (il render del documento e l'editor).
 */
export const AVVICINAMENTO = 34

/**
 * Le due quote che il disegno intero impone alle rotte native: dipendono da dove stanno
 * TUTTI i nodi, non dai due capi dell'arco, quindi chi instrada le riceve invece di
 * ricavarsele (un arco non ha, né deve avere, una vista sul layout globale).
 * Le calcola `quoteInstradamento` in `layout.ts`.
 */
export interface QuoteInstradamento {
  yCollettore: number
  yCorsiaCondense: number
}

/**
 * Mandata compressore → serbatoio: montante dal cielo del compressore fino al collettore
 * comune, tratto orizzontale, discesa accanto al bocchello. È la resa degli schemi reali,
 * dove più compressori confluiscono sulla stessa linea invece di attraversarsi.
 */
export function rottaFlessibile(pDa: Punto, pA: Punto, yCollettore: number): Punto[] {
  const xDiscesa = pA.x - AVVICINAMENTO
  return [
    { x: pDa.x, y: pDa.y },
    { x: pDa.x, y: yCollettore },
    { x: xDiscesa, y: yCollettore },
    { x: xDiscesa, y: pA.y },
    { x: pA.x, y: pA.y },
  ]
}

/** Mandata di linea fra due stadi di trattamento: spezzata che gira a metà strada. */
export function rottaLinea(pDa: Punto, pA: Punto): Punto[] {
  const xMedia = (pDa.x + pA.x) / 2
  return [
    { x: pDa.x, y: pDa.y },
    { x: xMedia, y: pDa.y },
    { x: xMedia, y: pA.y },
    { x: pA.x, y: pA.y },
  ]
}

/**
 * Linea condense: scende dallo scarico del nodo, corre sulla corsia comune e scende nel pozzo
 * di raccolta dall'alto — il pozzo sta sotto la corsia, come negli schemi reali.
 */
export function rottaCondensa(pDa: Punto, pA: Punto, yCorsia: number): Punto[] {
  return [
    { x: pDa.x, y: pDa.y },
    { x: pDa.x, y: yCorsia },
    { x: pA.x, y: yCorsia },
    { x: pA.x, y: pA.y },
  ]
}

/**
 * L'unico posto che deve decidere la forma di un tubo. La chiamano sia il render del documento
 * (`renderSvg.ts`) sia la tela dell'editor, quest'ultima tramite `polilineaDellArco`
 * (`conversioneFlow.ts`, cablata dentro `SchemaEdgeTubazione.tsx`): è questa condivisione a
 * chiudere la divergenza fra i due disegni, non solo ad aprirle la strada.
 *
 * I gomiti imposti a mano vincono su ogni rotta nativa: da quel momento il percorso è una
 * scelta dell'utente e nessuna euristica deve sovrascriverla.
 */
export function instrada(
  stile: SchemaArcoStile,
  pDa: Punto,
  pA: Punto,
  gomiti: Punto[] | undefined,
  quote: QuoteInstradamento
): Punto[] {
  if (gomiti && gomiti.length > 0) return polilineaConGomiti(pDa, gomiti, pA)
  if (stile === 'flessibile') return rottaFlessibile(pDa, pA, quote.yCollettore)
  if (stile === 'condensa') return rottaCondensa(pDa, pA, quote.yCorsiaCondense)
  return rottaLinea(pDa, pA)
}
