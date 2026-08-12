import { describe, it, expect } from 'vitest'
import { ondula, AMPIEZZA_ONDA, PASSO_ONDA } from '../tratti'

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
