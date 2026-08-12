/**
 * Geometria dei tratti di tubazione, condivisa da chi disegna: il render statico
 * (`renderSvg.ts`), l'editor (`SchemaEdgeTubazione.tsx`) e i campioni della legenda
 * (`symbols/index.ts`). Sta in un file suo perché `symbols` non può importare `renderSvg`
 * senza chiudere un ciclo, e perché è geometria pura, verificabile senza DOM.
 */

export interface Punto {
  x: number
  y: number
}

/** Mezzo periodo dell'onda del flessibile, in unità SVG. */
export const PASSO_ONDA = 5
/** Quanto l'onda si scosta dall'asse del tubo. */
export const AMPIEZZA_ONDA = 5

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
