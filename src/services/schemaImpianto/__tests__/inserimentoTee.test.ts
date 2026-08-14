import { describe, expect, it } from 'vitest'
import { TOLLERANZA_INSERIMENTO, arcoPiuVicino, idDelleMeta, spezzaArco } from '../inserimentoTee'
import type { Punto } from '../tratti'
import type { SchemaSegnoTubo } from '../types'

/**
 * La rotta `standard` fra due capi disallineati: gira a metà strada (`rottaLinea`, tratti.ts).
 * Lunghezze: 150 + 100 + 150 = 400, quindi il vertice (150,0) sta a t=0,375 e (150,100) a
 * t=0,625.
 */
const ROTTA: Punto[] = [
  { x: 0, y: 0 },
  { x: 150, y: 0 },
  { x: 150, y: 100 },
  { x: 300, y: 100 },
]

describe('arcoPiuVicino', () => {
  const archi = [
    { id: 'std-1', polilinea: ROTTA },
    { id: 'std-2', polilinea: [{ x: 0, y: 500 }, { x: 300, y: 500 }] },
  ]

  it('sceglie l’arco su cui il punto cade', () => {
    expect(arcoPiuVicino(archi, { x: 80, y: 3 })).toBe('std-1')
    expect(arcoPiuVicino(archi, { x: 80, y: 497 })).toBe('std-2')
  })

  // Senza la tolleranza, QUALUNQUE rilascio spezzerebbe il tubo meno lontano: si potrebbe
  // spostare un TEE da una parte all'altra della tela e trovarselo innestato su un tubo che
  // non si stava puntando.
  it('nessun arco se il punto è lontano da tutti', () => {
    expect(arcoPiuVicino(archi, { x: 80, y: 250 })).toBeNull()
  })

  it('la tolleranza è inclusiva sul bordo', () => {
    expect(arcoPiuVicino(archi, { x: 80, y: TOLLERANZA_INSERIMENTO })).toBe('std-1')
    expect(arcoPiuVicino(archi, { x: 80, y: TOLLERANZA_INSERIMENTO + 0.5 })).toBeNull()
  })

  it('senza archi non sceglie nulla', () => {
    expect(arcoPiuVicino([], { x: 0, y: 0 })).toBeNull()
  })

  // Senza la guardia su `polilinea.length < 2`, `puntoSuTratto([])` tratta l'arco vuoto come se
  // fosse un punto fermo all'origine (0,0): un rilascio vicino all'origine lo troverebbe
  // "vicino" anche se non è un tubo vero. L'arco lontano qui è irraggiungibile dal punto di
  // prova, quindi solo la guardia lo tiene fuori dal risultato.
  it('un arco con polilinea degenere (senza punti) non viene mai scelto', () => {
    const conDegenere = [
      { id: 'degenere', polilinea: [] as Punto[] },
      { id: 'lontano', polilinea: [{ x: 500, y: 500 }, { x: 600, y: 500 }] },
    ]
    expect(arcoPiuVicino(conDegenere, { x: 2, y: 2 })).toBeNull()
  })
})

describe('spezzaArco', () => {
  it('il centro sta sulla polilinea, non dove è stato rilasciato il TEE', () => {
    // Rilascio 6 unità a destra del montante: il TEE deve innestarsi SUL tubo, o le due metà
    // partirebbero da un punto che il tubo non tocca e il disegno farebbe uno scalino.
    const { centro } = spezzaArco(ROTTA, [], { x: 156, y: 50 })
    expect(centro).toEqual({ x: 150, y: 50 })
  })

  // Non basta che `centro` torni giusto: anche il gomito sintetizzato dal fallback del punto
  // medio deve usare `centro` come capo, non `puntoLibero`. Qui il rilascio è fuori dal tubo
  // (y=5, non y=0) e cade in un tratto senza vertici interni: se il fallback usasse
  // `puntoLibero`, il gomito cadrebbe a (42.5, 2.5) — fuori dalla linea — invece che sul tubo.
  it('il gomito sintetizzato dal fallback sta sulla linea, non sul punto libero fuori tubo', () => {
    const { centro, primo } = spezzaArco(ROTTA, [], { x: 85, y: 5 })
    expect(centro).toEqual({ x: 85, y: 0 })
    expect(primo.punti).toEqual([{ x: 42.5, y: 0 }])
  })

  it('i vertici si dividono fra le due metà secondo dove cade il taglio', () => {
    const { primo, secondo } = spezzaArco(ROTTA, [], { x: 150, y: 50 })
    expect(primo.punti).toEqual([{ x: 150, y: 0 }])
    expect(secondo.punti).toEqual([{ x: 150, y: 100 }])
  })

  // Il punto 2 del contesto: una metà senza gomiti tornerebbe alla rotta nativa del suo
  // stile. Il gomito nel punto medio sta esattamente sul segmento, quindi fissa la forma
  // senza cambiarla.
  it('una metà senza vertici viene fissata con un gomito nel suo punto medio', () => {
    const { centro, primo, secondo } = spezzaArco(ROTTA, [], { x: 80, y: 0 })
    expect(centro).toEqual({ x: 80, y: 0 })
    expect(primo.punti).toEqual([{ x: 40, y: 0 }])
    expect(secondo.punti).toEqual([
      { x: 150, y: 0 },
      { x: 150, y: 100 },
    ])
  })

  it('i segni vanno alla metà su cui cadono, con la t rimappata su quella metà', () => {
    const segni: SchemaSegnoTubo[] = [
      { id: 'v1', tipo: 'valvola_intercettazione', t: 0.25 },
      { id: 'r1', tipo: 'riduttore_pressione', t: 0.75 },
    ]
    const { primo, secondo } = spezzaArco(ROTTA, segni, { x: 150, y: 50 }) // taglio a t = 0,5
    expect(primo.segni).toEqual([{ id: 'v1', tipo: 'valvola_intercettazione', t: 0.5 }])
    expect(secondo.segni).toEqual([{ id: 'r1', tipo: 'riduttore_pressione', t: 0.5 }])
  })

  // Rilascio proprio sul capo di partenza: la prima metà è lunga zero. Non deve produrre
  // NaN — una t divisa per zero finirebbe nel layout salvato e da lì nel documento.
  it('un taglio sul capo di partenza non produce quote non numeriche', () => {
    const segni: SchemaSegnoTubo[] = [{ id: 'v1', tipo: 'valvola_intercettazione', t: 0.25 }]
    const { primo, secondo } = spezzaArco(ROTTA, segni, { x: 0, y: 0 })
    expect(primo.segni).toEqual([])
    expect(secondo.segni).toEqual(segni)
    expect(primo.punti.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true)
  })

  // Simmetrico al capo di partenza: rilascio proprio sul capo di arrivo, la seconda metà è
  // lunga zero. Non deve produrre NaN — una t divisa per zero finirebbe nel layout salvato e
  // da lì nel documento.
  it('un taglio sul capo di arrivo non produce quote non numeriche', () => {
    const segni: SchemaSegnoTubo[] = [{ id: 'v1', tipo: 'valvola_intercettazione', t: 0.75 }]
    const { primo, secondo } = spezzaArco(ROTTA, segni, { x: 300, y: 100 })
    expect(primo.segni).toEqual(segni)
    expect(secondo.segni).toEqual([])
    expect(secondo.punti.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true)
  })

  // Nessun segno con `t` nel dominio dichiarato (0..1, tratti.ts) può mai superare `tTaglio`
  // quando il taglio cade sul capo di arrivo (tTaglio=1): il filtro `s.t > tTaglio` lo esclude
  // sempre. Solo un dato fuori dominio — qui simulato — raggiunge davvero la divisione per
  // (1 - tTaglio), altrimenti nulla la eserciterebbe mai.
  it('un segno fuori dal dominio [0,1] non produce una quota infinita quando il taglio cade sul capo di arrivo', () => {
    const segni: SchemaSegnoTubo[] = [{ id: 'fuori-dominio', tipo: 'valvola_intercettazione', t: 1.5 }]
    const { secondo } = spezzaArco(ROTTA, segni, { x: 300, y: 100 })
    expect(secondo.segni.every((s) => Number.isFinite(s.t))).toBe(true)
  })

  // Una polilinea di lunghezza nulla (tutti i punti coincidenti): `quoteDeiVertici` calcola le
  // quote dei vertici dividendo per la lunghezza totale, che qui è zero.
  it('una polilinea di lunghezza nulla non produce quote non numeriche', () => {
    const puntoUnico: Punto[] = [{ x: 5, y: 5 }, { x: 5, y: 5 }, { x: 5, y: 5 }]
    const { centro, primo, secondo } = spezzaArco(puntoUnico, [], { x: 5, y: 5 })
    expect(Number.isFinite(centro.x) && Number.isFinite(centro.y)).toBe(true)
    expect(primo.punti.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true)
    expect(secondo.punti.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true)
  })
})

describe('idDelleMeta', () => {
  it('deriva due identificativi dal nome dell’arco spezzato', () => {
    expect(idDelleMeta('std-3', new Set(['std-3']))).toEqual(['std-3-a', 'std-3-b'])
  })

  // Spezzare due volte lo stesso tubo non deve produrre due archi con lo stesso id: react-flow
  // ne renderebbe uno solo, e il layout salvato perderebbe l'altro in silenzio.
  it('evita gli identificativi già presi', () => {
    expect(idDelleMeta('std-3', new Set(['std-3', 'std-3-a', 'std-3-b']))).toEqual(['std-3-a2', 'std-3-b2'])
  })
})
