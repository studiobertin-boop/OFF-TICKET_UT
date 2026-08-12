import { describe, it, expect } from 'vitest'
import {
  ondula,
  AMPIEZZA_ONDA,
  PASSO_ONDA,
  puntoSuTratto,
  tSuTratto,
  polilineaConGomiti,
  trascinaTratto,
} from '../tratti'

/** Coppie (x,y) di tutti i punti d'arrivo dei comandi Q, nell'ordine. */
function arriviQ(d: string): [number, number][] {
  return [...d.matchAll(/Q [-\d.]+ [-\d.]+ ([-\d.]+) ([-\d.]+)/g)].map((m) => [
    Number(m[1]),
    Number(m[2]),
  ])
}

/** Ogni comando Q come [controlloX, controlloY, arrivoX, arrivoY], nell'ordine. */
function comandiQ(d: string): [number, number, number, number][] {
  return [...d.matchAll(/Q ([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)/g)].map((m) => [
    Number(m[1]),
    Number(m[2]),
    Number(m[3]),
    Number(m[4]),
  ])
}

/**
 * Angolo, in gradi, fra la tangente finale del tracciato e la direzione data. Per una curva
 * quadratica la tangente in arrivo è `E − C`, ed è su quella che l'attributo `marker-end`
 * orienta la punta di freccia: se non coincide con l'asse del tubo, la punta arriva storta.
 */
function angoloTangenteFinale(d: string, direzione: { x: number; y: number }): number {
  const comandi = comandiQ(d)
  const [cx, cy, ex, ey] = comandi[comandi.length - 1]
  const tangente = { x: ex - cx, y: ey - cy }
  const coseno =
    (tangente.x * direzione.x + tangente.y * direzione.y) /
    (Math.hypot(tangente.x, tangente.y) * Math.hypot(direzione.x, direzione.y))
  return (Math.acos(Math.min(1, Math.max(-1, coseno))) * 180) / Math.PI
}

describe('ondula', () => {
  it('parte dal primo punto e arriva esattamente sull’ultimo', () => {
    const d = ondula([
      { x: 0, y: 0 },
      { x: 50, y: 0 },
    ])
    expect(d.startsWith('M 0 0')).toBe(true)
    const arrivi = arriviQ(d)
    expect(arrivi[arrivi.length - 1]).toEqual([50, 0])
  })

  it('mette un’onda ogni PASSO_ONDA unità', () => {
    const d = ondula([
      { x: 0, y: 0 },
      { x: 50, y: 0 },
    ])
    expect(arriviQ(d)).toHaveLength(50 / PASSO_ONDA)
  })

  it('ondula anche in verticale, sfalsando la x invece della y', () => {
    const orizzontale = ondula([
      { x: 0, y: 0 },
      { x: 50, y: 0 },
    ])
    const verticale = ondula([
      { x: 0, y: 0 },
      { x: 0, y: 50 },
    ])
    // Un'implementazione che sposta sempre la y darebbe controlli con x costante: qui la x dei
    // punti di controllo deve variare, ed è ciò che distingue le due direzioni.
    const controlliX = [...verticale.matchAll(/Q ([-\d.]+) /g)].map((m) => Number(m[1]))
    expect(new Set(controlliX).size).toBeGreaterThan(1)
    expect(orizzontale).not.toBe(verticale)
  })

  it('alterna i lati: due onde consecutive non stanno dalla stessa parte', () => {
    const d = ondula([
      { x: 0, y: 0 },
      { x: 50, y: 0 },
    ])
    const controlliY = [...d.matchAll(/Q [-\d.]+ ([-\d.]+) /g)].map((m) => Number(m[1]))
    expect(controlliY[0]).toBe(-controlliY[1])
  })

  it('riparte a ogni vertice, così gli spigoli restano netti', () => {
    const d = ondula([
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 30 },
    ])
    // Il vertice dev'essere toccato esattamente, non tagliato da un'onda a cavallo.
    const arrivi = arriviQ(d)
    expect(arrivi).toContainEqual([50, 0])
    expect(arrivi[arrivi.length - 1]).toEqual([50, 30])
  })

  it('un tratto più corto di un’onda resta un’onda sola, e finisce dove deve', () => {
    const d = ondula([
      { x: 0, y: 0 },
      { x: 3, y: 0 },
    ])
    expect(arriviQ(d)).toHaveLength(1)
    expect(arriviQ(d)[0]).toEqual([3, 0])
  })

  // Con PASSO_ONDA = 5, un tratto sotto le 2,5 unità farebbe arrotondare mezziPeriodi a 0 senza
  // la guardia Math.max(1, ...): il ciclo interno non girerebbe e il tracciato si fermerebbe al
  // primo punto, senza mai raggiungere l'ancora. Il caso di 3 unità sopra non basta a
  // dimostrarlo (Math.round(3/5) fa già 1 da solo): qui la guardia è l'unica cosa che salva il
  // risultato.
  it('un tratto sotto mezzo passo resta comunque un’onda sola che tocca l’ancora', () => {
    const d = ondula([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ])
    expect(arriviQ(d)).toHaveLength(1)
    expect(arriviQ(d)[0]).toEqual([1, 0])
  })

  // La punta di freccia della tubazione la disegna `marker-end`, che si orienta sulla tangente
  // finale del tracciato. Finché l'ultimo semiperiodo aveva il punto di controllo scostato di
  // AMPIEZZA_ONDA, quella tangente formava 64° con l'asse del tubo e la punta arrivava ruotata,
  // ora in su ora in giù secondo la parità del semiperiodo: in ogni disegno consegnato, perché
  // la mandata compressore→serbatoio è flessibile in ogni impianto.
  it('entra in asse: la tangente finale punta come il tubo, non di traverso', () => {
    expect(angoloTangenteFinale(ondula([{ x: 0, y: 0 }, { x: 34, y: 0 }]), { x: 1, y: 0 })).toBeLessThan(1)
  })

  it('entra in asse anche quando l’ultimo tratto è verticale', () => {
    const d = ondula([
      { x: 0, y: 0 },
      { x: 40, y: 0 },
      { x: 40, y: 33 },
    ])
    expect(angoloTangenteFinale(d, { x: 0, y: 1 })).toBeLessThan(1)
  })

  it('raddrizza solo l’ultimo semiperiodo: il resto del tubo resta ondulato', () => {
    const d = ondula([{ x: 0, y: 0 }, { x: 40, y: 0 }])
    const comandi = comandiQ(d)
    // Se il raddrizzamento si estendesse a tutto il tratto, il flessibile diventerebbe una
    // linea retta e la legenda mostrerebbe un campione che il disegno smentisce.
    expect(comandi.slice(0, -1).every(([, cy]) => Math.abs(cy) === AMPIEZZA_ONDA)).toBe(true)
  })

  // PASSO_ONDA e AMPIEZZA_ONDA valgono entrambi 5, quindi nessuna misura può distinguerli
  // finché i valori restano uguali: scambiarli nel codice oggi non cambierebbe un solo carattere
  // del tracciato. Queste asserzioni legano ciascuna costante al proprio ruolo — lo scostamento
  // perpendicolare ad AMPIEZZA_ONDA, il passo lungo l'asse a PASSO_ONDA — così lo scambio viene
  // scoperto non appena i due valori divergono. La lunghezza è un multiplo esatto del passo,
  // altrimenti la ridistribuzione lo accorcerebbe e i conti tornerebbero solo per caso.
  it('scosta i controlli di AMPIEZZA_ONDA e li fa arrivare ogni PASSO_ONDA', () => {
    const semiperiodi = 4
    const comandi = comandiQ(ondula([{ x: 0, y: 0 }, { x: PASSO_ONDA * semiperiodi, y: 0 }]))

    expect(comandi).toHaveLength(semiperiodi)
    comandi.forEach(([cx, cy, ex], k) => {
      // Lungo l'asse: il controllo sta a metà semiperiodo, l'arrivo alla sua fine.
      expect(cx).toBe(PASSO_ONDA * (k + 0.5))
      expect(ex).toBe(PASSO_ONDA * (k + 1))
      // In perpendicolare: l'ampiezza piena, tranne l'ultimo semiperiodo che va in asse perché
      // la punta di freccia si orienta lì sopra (vedi il test sulla tangente finale).
      expect(Math.abs(cy)).toBe(k === semiperiodi - 1 ? 0 : AMPIEZZA_ONDA)
    })
  })

  it('salta i tratti di lunghezza nulla senza produrre NaN', () => {
    const d = ondula([
      { x: 10, y: 10 },
      { x: 10, y: 10 },
      { x: 10, y: 40 },
    ])
    expect(d).not.toContain('NaN')
    const arrivi = arriviQ(d)
    expect(arrivi[arrivi.length - 1]).toEqual([10, 40])
  })
})

describe('puntoSuTratto', () => {
  const orizzontale = [
    { x: 0, y: 100 },
    { x: 200, y: 100 },
  ]
  const conAngolo = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 50 },
  ]

  it('t=0 e t=1 cadono esattamente sui due capi', () => {
    expect(puntoSuTratto(orizzontale, 0).punto).toEqual({ x: 0, y: 100 })
    expect(puntoSuTratto(orizzontale, 1).punto).toEqual({ x: 200, y: 100 })
  })

  it('t=0.5 cade a metà della lunghezza totale, non del solo primo tratto', () => {
    // Primo tratto lungo 100, secondo lungo 50: metà dei 150 totali cade a 75 sul primo tratto.
    const risultato = puntoSuTratto(conAngolo, 0.5)
    expect(risultato.punto).toEqual({ x: 75, y: 0 })
    expect(risultato.orizzontale).toBe(true)
  })

  it('riconosce il tratto verticale dopo l’angolo', () => {
    // 100/150 = 0.667: appena oltre l'angolo, sul tratto verticale.
    const risultato = puntoSuTratto(conAngolo, 0.7)
    expect(risultato.orizzontale).toBe(false)
    expect(risultato.punto.x).toBe(100)
  })
})

describe('tSuTratto', () => {
  const conAngolo = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 50 },
  ]

  it('è l’inversa di puntoSuTratto sui punti che restituisce', () => {
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const { punto } = puntoSuTratto(conAngolo, t)
      expect(tSuTratto(conAngolo, punto)).toBeCloseTo(t, 5)
    }
  })

  it('un punto fuori dalla polilinea si proietta sul tratto più vicino, non sul più lontano', () => {
    // (100, 25) è il punto medio del tratto verticale (x=100, da y=0 a y=50): a distanza 0 da
    // quel tratto, contro 25 dal tratto orizzontale. Lunghezza percorsa fino a lì: 100 (primo
    // tratto) + 25 (metà del secondo, lungo 50) = 125 su 150 totali → t = 125/150 = 5/6.
    expect(tSuTratto(conAngolo, { x: 100, y: 25 })).toBeCloseTo(5 / 6, 2)
  })
})

describe('trascinaTratto', () => {
  it('un tratto orizzontale fra due gomiti trasla entrambi sulla y, la x non cambia', () => {
    const pDa = { x: 0, y: 0 }
    const pA = { x: 300, y: 300 }
    const gomiti = [
      { x: 100, y: 100 },
      { x: 200, y: 100 },
    ]
    // La polilinea risolta è: pDa(0,0) -> raccordo(0,100)? verifichiamolo indirettamente:
    // il tratto orizzontale fra i due gomiti è quello all'indice corretto una volta risolta
    // la polilinea completa — usa polilineaConGomiti per trovarlo, non un indice a occhio.
    const full = polilineaConGomiti(pDa, gomiti, pA)
    const indiceTratto = full.findIndex(
      (p, i) => full[i + 1] && p.y === full[i + 1].y && p.x === 100 && full[i + 1].x === 200
    )
    expect(indiceTratto).toBeGreaterThanOrEqual(0)

    const nuovi = trascinaTratto(pDa, gomiti, pA, indiceTratto, { x: 0, y: 50 })
    // I due gomiti che delimitavano il tratto ora stanno a y=150, x invariate.
    expect(nuovi).toContainEqual({ x: 100, y: 150 })
    expect(nuovi).toContainEqual({ x: 200, y: 150 })
  })

  it('trascinare il tratto che tocca l’ancora Da fa nascere un gomito nuovo, l’ancora non si sposta', () => {
    const pDa = { x: 0, y: 0 }
    const pA = { x: 200, y: 0 }
    // Nessun gomito: full = [pDa, pA] (un solo tratto orizzontale, indice 0).
    const nuovi = trascinaTratto(pDa, [], pA, 0, { x: 0, y: 40 })
    // Un gomito nuovo vicino a pDa (stessa x, nuova y) e uno vicino a pA (stessa x di pA,
    // nuova y): il tratto centrale è quello che si è davvero spostato.
    expect(nuovi.length).toBeGreaterThanOrEqual(1)
    const full = polilineaConGomiti(pDa, nuovi, pA)
    expect(full[0]).toEqual(pDa)
    expect(full[full.length - 1]).toEqual(pA)
    // Nessun punto della nuova polilinea è alla y originale in mezzo al tracciato: il tratto
    // dritto centrale è salito di 40.
    const centrali = full.slice(1, -1)
    expect(centrali.some((p) => p.y === 40)).toBe(true)
  })

  it('un gomito a valle del tratto trascinato, non toccato dal gesto, sopravvive', () => {
    // Difetto reale scovato in revisione: un errore nell'ordine degli argomenti passati a
    // `raccordaPreservando` sul lato "successivo" faceva sparire il gomito a valle invece di
    // riportarlo in coda all'array. Tre gomiti collineari a gradino: si trascina il tratto
    // centrale, il terzo gomito (il montante verticale finale) non deve sparire.
    const pDa = { x: 0, y: 0 }
    const pA = { x: 300, y: 100 }
    const gomiti = [
      { x: 50, y: 0 },
      { x: 150, y: 0 },
      { x: 150, y: 100 },
    ]
    const nuovi = trascinaTratto(pDa, gomiti, pA, 1, { x: 0, y: 30 })
    // Il gomito del montante finale, (150,100), deve comparire ancora — non toccato dal
    // trascinamento del tratto (50,0)-(150,0).
    expect(nuovi).toContainEqual({ x: 150, y: 100 })
    // La polilinea ricostruita arriva ancora a pA senza salti né duplicati impliciti.
    const full = polilineaConGomiti(pDa, nuovi, pA)
    expect(full[full.length - 1]).toEqual(pA)
  })

  it('un indice fuori range non tocca i gomiti', () => {
    const pDa = { x: 0, y: 0 }
    const pA = { x: 100, y: 100 }
    const gomiti = [{ x: 50, y: 50 }]
    expect(trascinaTratto(pDa, gomiti, pA, 99, { x: 10, y: 10 })).toEqual(gomiti)
  })
})
