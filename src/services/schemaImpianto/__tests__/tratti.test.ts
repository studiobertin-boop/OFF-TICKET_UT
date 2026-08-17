import { describe, it, expect } from 'vitest'
import {
  ondula,
  AMPIEZZA_ONDA,
  PASSO_ONDA,
  puntoSuTratto,
  quoteAttraversamento,
  tSuTratto,
  polilineaConGomiti,
  trascinaTratto,
  instrada,
  rottaCondensa,
  rottaFlessibile,
  rottaLinea,
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

  it('un flessibile di 50 unità porta cinque semiperiodi, non dieci', () => {
    // Misura letterale di proposito: ogni altro test di questo describe è parametrico su
    // PASSO_ONDA e resterebbe verde a qualunque passo, compreso quello che il committente ha
    // chiesto di cambiare il 17-08-2026 perché le onde erano troppo fitte. Questa è la riga che
    // se ne accorge se qualcuno le infittisce di nuovo.
    const d = ondula([
      { x: 0, y: 0 },
      { x: 50, y: 0 },
    ])
    expect(arriviQ(d)).toHaveLength(5)
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

  // Un tratto sotto mezzo passo farebbe arrotondare mezziPeriodi a 0 senza la guardia
  // Math.max(1, ...): il ciclo interno non girerebbe e il tracciato si fermerebbe al primo punto,
  // senza mai raggiungere l'ancora. Il caso di 3 unità sopra non basta a dimostrarlo: qui la
  // guardia è l'unica cosa che salva il risultato.
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

  // PASSO_ONDA e AMPIEZZA_ONDA hanno a lungo avuto lo stesso valore, e finché è stato così nessuna
  // misura poteva distinguerli: scambiarli nel codice non cambiava un solo carattere del
  // tracciato. Queste asserzioni legano ciascuna costante al proprio ruolo — lo scostamento
  // perpendicolare ad AMPIEZZA_ONDA, il passo lungo l'asse a PASSO_ONDA — così lo scambio viene
  // scoperto anche se i due tornassero a coincidere. La lunghezza è un multiplo esatto del passo,
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

  it('riporta il versore del tratto, col verso di percorrenza', () => {
    expect(puntoSuTratto(orizzontale, 0.5).direzione).toEqual({ x: 1, y: 0 })

    // Stessa giacitura, percorsa al contrario: `orizzontale` non distingue i due casi, la
    // direzione sì — ed è la differenza fra una freccia che indica il flusso e una che lo nega.
    const alContrario = puntoSuTratto([...orizzontale].reverse(), 0.5)
    expect(alContrario.orizzontale).toBe(true)
    expect(alContrario.direzione).toEqual({ x: -1, y: 0 })

    // Su una diagonale il versore è normalizzato: chi disegna lo moltiplica per la propria misura.
    const diagonale = puntoSuTratto(
      [
        { x: 0, y: 0 },
        { x: 30, y: 40 },
      ],
      0.5
    )
    expect(diagonale.direzione.x).toBeCloseTo(0.6)
    expect(diagonale.direzione.y).toBeCloseTo(0.8)
  })

  it('prende il versore del segmento su cui cade t, non del primo', () => {
    // Oltre l'angolo di `conAngolo`, dove il tratto scende: se il versore venisse dal primo
    // segmento, una freccia posata qui punterebbe avanti invece che in giù.
    expect(puntoSuTratto(conAngolo, 0.9).direzione).toEqual({ x: 0, y: 1 })
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
  // Con gomiti a mano già presenti `instrada` ripiega su `polilineaConGomiti` (vedi describe
  // 'instrada' più sotto): stile e quote non contano per questi casi, un valore qualsiasi va
  // bene, e la polilinea interna a `trascinaTratto` coincide con quella di prima di questo giro.
  const STILE_INDIFFERENTE = 'standard'
  const QUOTE_INDIFFERENTE = { yCollettore: 999, yCorsiaCondense: 999 }

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

    const nuovi = trascinaTratto(
      STILE_INDIFFERENTE,
      pDa,
      pA,
      gomiti,
      QUOTE_INDIFFERENTE,
      indiceTratto,
      { x: 0, y: 50 }
    )
    // I due gomiti che delimitavano il tratto ora stanno a y=150, x invariate.
    expect(nuovi).toContainEqual({ x: 100, y: 150 })
    expect(nuovi).toContainEqual({ x: 200, y: 150 })
  })

  it('trascinare il tratto che tocca l’ancora Da fa nascere un gomito nuovo, l’ancora non si sposta', () => {
    const pDa = { x: 0, y: 0 }
    const pA = { x: 300, y: 300 }
    // Nessun gomito a mano: la polilinea interna è ora la rotta nativa dello stile
    // (`instrada`), non più il semplice raccordo a un angolo — qui 'standard' (rottaLinea),
    // che gira a metà strada: [pDa, (150,0), (150,300), pA]. Il tratto 0, (0,0)-(150,0),
    // tocca l'ancora Da.
    const nuovi = trascinaTratto(
      'standard',
      pDa,
      pA,
      undefined,
      QUOTE_INDIFFERENTE,
      0,
      { x: 0, y: 40 }
    )
    // Elenco esatto dei gomiti attesi, non solo capi e "un punto qualsiasi a y=40": la rotta
    // nativa 'standard' è [pDa, (150,0), (150,300), pA] (xMedia=150), il tratto 0 tocca pDa e
    // sale a y=40 — nasce un gomito nuovo (0,40) accanto a pDa, il gomito (150,0) trasla a
    // (150,40), il terzo (150,300) resta. Asserzioni sciolte come "un punto qualsiasi a y=40"
    // restano verdi anche sull'implementazione difettosa che ricostruiva con
    // `polilineaConGomiti(pDa, gomiti ?? [], pA)` invece che con `instrada`.
    expect(nuovi).toEqual([
      { x: 0, y: 40 },
      { x: 150, y: 40 },
      { x: 150, y: 300 },
    ])
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
    const nuovi = trascinaTratto(
      STILE_INDIFFERENTE,
      pDa,
      pA,
      gomiti,
      QUOTE_INDIFFERENTE,
      1,
      { x: 0, y: 30 }
    )
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
    expect(
      trascinaTratto(STILE_INDIFFERENTE, pDa, pA, gomiti, QUOTE_INDIFFERENTE, 99, { x: 10, y: 10 })
    ).toEqual(gomiti)
  })

  // Giro di riparazione 1: prima di questo giro, un arco SENZA gomiti a mano veniva ricostruito
  // qui dentro con `polilineaConGomiti(pDa, [], pA)` — un semplice angolo singolo — mentre il
  // componente disegna con `polilineaDellArco`/`instrada` la rotta nativa dello stile, a più
  // tratti. L'indice che l'utente afferra (`indiceTrattoPiuVicino` sulla polilinea VERA) non
  // corrispondeva più a quello su cui `trascinaTratto` operava: il tratto sbagliato si spostava,
  // o il gesto non faceva nulla se l'indice cadeva fuori dalla polilinea (troppo corta).
  it('standard senza gomiti: il tratto verticale afferrato si sposta sulla propria x, non su quella di un raccordo diverso', () => {
    const pDa = { x: 0, y: 0 }
    const pA = { x: 200, y: 100 }
    const quote = { yCollettore: 999, yCorsiaCondense: 999 }
    // Rotta nativa 'standard' (rottaLinea): [(0,0), (100,0), (100,100), (200,100)]. Il tratto
    // verticale (100,0)-(100,100) è quello visto e afferrato dall'utente, indice 1.
    const full = instrada('standard', pDa, pA, undefined, quote)
    const indiceTratto = full.findIndex((p, i) => full[i + 1] && p.x === full[i + 1].x && p.x === 100)
    expect(indiceTratto).toBe(1)

    const nuovi = trascinaTratto('standard', pDa, pA, undefined, quote, indiceTratto, { x: 30, y: 0 })

    // Con la ricostruzione corretta (via `instrada`) il tratto verticale finisce a x=130
    // (100+30). La versione rotta lo spostava a x=230, perché numerava un'altra polilinea
    // (quella di `polilineaConGomiti(pDa, [], pA)`, il cui unico raccordo verticale sta a
    // x=200) — non il tratto che l'utente ha davvero afferrato.
    expect(nuovi).toEqual([
      { x: 130, y: 0 },
      { x: 130, y: 100 },
    ])
  })

  it('condensa senza gomiti: trascinare l’ultimo tratto sposta davvero la linea, non è un gesto a vuoto', () => {
    const pDa = { x: 50, y: 200 }
    const pA = { x: 400, y: 500 }
    const quote = { yCollettore: 999, yCorsiaCondense: 340 }
    // Rotta nativa 'condensa' (rottaCondensa): [(50,200), (50,340), (400,340), (400,500)].
    // L'ultimo tratto, (400,340)-(400,500), è quello che l'utente vede e afferra: indice 2.
    const full = instrada('condensa', pDa, pA, undefined, quote)
    expect(full.length).toBe(4)
    const indiceTratto = 2

    const nuovi = trascinaTratto('condensa', pDa, pA, undefined, quote, indiceTratto, { x: 20, y: 0 })

    // Con la ricostruzione corretta il gesto sposta davvero la corsia (x passa da 400 a 420
    // sui due gomiti toccati dal tratto trascinato). La versione rotta ricostruiva con
    // `polilineaConGomiti(pDa, [], pA)` — due soli tratti, `full[2]` fuori range — e restituiva
    // i gomiti invariati: il trascinamento non faceva NULLA, un gesto silenziosamente a vuoto.
    expect(nuovi).toEqual([
      { x: 50, y: 340 },
      { x: 420, y: 340 },
      { x: 420, y: 500 },
    ])
  })

  // Il difetto misurato in pagina: un tratto che parte da una quota fuori griglia ci
  // restava per sempre, perché si sommava uno spostamento invece di posare una quota.
  // Il montante a x=126,5 è il caso vero, rimpicciolito: in pagina era x=726,5.
  it('posa il tratto sulla griglia anche partendo da una quota fuori griglia', () => {
    const pDa = { x: 0, y: 0 }
    const pA = { x: 300, y: 100 }
    const gomiti = [
      { x: 126.5, y: 0 },
      { x: 126.5, y: 100 },
    ]
    const full = polilineaConGomiti(pDa, gomiti, pA)
    const indiceTratto = full.findIndex((p, i) => full[i + 1] && p.x === full[i + 1].x && p.x === 126.5)
    expect(indiceTratto).toBeGreaterThanOrEqual(0)

    const nuovi = trascinaTratto(STILE_INDIFFERENTE, pDa, pA, gomiti, QUOTE_INDIFFERENTE, indiceTratto, { x: 33, y: 0 })

    // 126,5 + 33 = 159,5: il punto di griglia più vicino è 160, e le ascisse dei due capi
    // (0 e 300) sono lontanissime, quindi qui comanda la griglia.
    expect(nuovi).toContainEqual({ x: 160, y: 0 })
    expect(nuovi).toContainEqual({ x: 160, y: 100 })
    expect(nuovi.some((p) => p.x === 159.5)).toBe(false)
  })

  // Il secondo magnete. Senza, nessun punto della griglia potrebbe raccordare un tubo che
  // arriva a un'ascissa fuori griglia, ed è la situazione normale finché le ancore dei
  // simboli stanno dove stanno.
  it('preferisce l’ascissa di un capo quando è più vicina del punto di griglia', () => {
    const pDa = { x: 0, y: 0 }
    const pA = { x: 234, y: 100 }
    // Rotta nativa 'standard' (rottaLinea), che gira a metà strada: [(0,0), (117,0), (117,100),
    // (234,100)]. Il montante verticale nasce in x=117 — è la polilinea vera che
    // `trascinaTratto` ricostruisce internamente con `instrada` (senza gomiti a mano
    // `polilineaConGomiti(pDa, [], pA)` darebbe un solo angolo a x=234, una forma diversa: vedi
    // il docblock di `trascinaTratto`), quindi l'indice del tratto verticale si trova qui allo
    // stesso modo, con `findIndex` sulla rotta di `instrada`.
    const full = instrada(STILE_INDIFFERENTE, pDa, pA, undefined, QUOTE_INDIFFERENTE)
    const indiceTratto = full.findIndex((p, i) => full[i + 1] && p.x === full[i + 1].x && p.x === 117)
    expect(indiceTratto).toBe(1)

    const nuovi = trascinaTratto(
      STILE_INDIFFERENTE,
      pDa,
      pA,
      undefined,
      QUOTE_INDIFFERENTE,
      indiceTratto,
      { x: 116, y: 0 }
    )

    // 117 + 116 = 233. Il punto di griglia più vicino è 230, a distanza 3; l'ascissa del
    // capo di arrivo è 234, a distanza 1: vince il capo. La quota agganciata (234) coincide
    // con l'ascissa di pA, quindi il lato a valle di `raccordaPreservando` si trova già
    // allineato e non genera un gomito suo: il risultato è un solo punto, {x:234, y:0} — il
    // montante finisce esattamente sotto il bocchello invece che tre unità a sinistra.
    expect(nuovi).toEqual([{ x: 234, y: 0 }])
  })

  // Ramo orizzontale del ramo "preferisce un capo": stessa aritmetica del test sopra, con gli
  // assi scambiati (gomiti a mano invece della rotta nativa, per controllare l'ordinata del
  // tratto senza dipendere da quale stile instrada). Pin per la mutazione trovata in revisione:
  // usare [pDa.x, pA.x] anche quando il tratto è orizzontale passa tutti gli altri test di
  // `trascinaTratto` per coincidenza numerica (i capi coincidono, o la quota grezza cade già
  // in griglia), ma qui i capi hanno ascisse (0, 100) lontanissime dalla quota grezza (233):
  // con l'asse sbagliato non c'è alcuna quota preferita a distanza ≤3, quindi vince la
  // griglia (230) invece del capo (234), e l'asserzione lo scopre.
  it('preferisce l’ordinata di un capo quando è più vicina del punto di griglia (tratto orizzontale)', () => {
    const pDa = { x: 0, y: 0 }
    const pA = { x: 100, y: 234 }
    const gomiti = [
      { x: 0, y: 117 },
      { x: 100, y: 117 },
    ]
    const full = polilineaConGomiti(pDa, gomiti, pA)
    const indiceTratto = full.findIndex((p, i) => full[i + 1] && p.y === full[i + 1].y && p.y === 117)
    expect(indiceTratto).toBe(1)

    const nuovi = trascinaTratto(STILE_INDIFFERENTE, pDa, pA, gomiti, QUOTE_INDIFFERENTE, indiceTratto, { x: 0, y: 116 })

    // 117 + 116 = 233. Il punto di griglia più vicino è 230, a distanza 3; l'ordinata del
    // capo di arrivo è 234, a distanza 1: vince il capo. Come nel caso gemello verticale, la
    // quota agganciata coincide con l'ordinata di pA: il lato a valle è già allineato e il
    // risultato è un solo punto, {x:0, y:234}.
    expect(nuovi).toEqual([{ x: 0, y: 234 }])
  })

  // Stessa classe di difetto del giro di riparazione 1 (test più sopra), questa volta sui lati
  // imposti invece che sui gomiti a mano: un capo giunzione (lato `alto`) fa disegnare la rotta
  // IMBOCCATA — due tratti — invece della rotta nativa `rottaLinea` — tre tratti, che gira a
  // metà strada. Se `trascinaTratto` ricostruisse senza `lati`, l'indice 1 (il tratto verticale
  // VISTO e afferrato dall'utente, sulla rotta imboccata) numererebbe il tratto sbagliato sulla
  // rotta nativa a tre tratti — il montante finirebbe spostato, non quello che l'utente vede.
  it('un capo con lato imposto: il tratto afferrato è quello della rotta imboccata, non della rotta nativa', () => {
    const pDa = { x: 272, y: 182 }
    const pA = { x: 382, y: 405 }
    const quote = { yCollettore: 0, yCorsiaCondense: 500 }
    const lati = { a: 'alto' as const }

    // Rotta imboccata: [(272,182), (382,182), (382,405)]. Il tratto verticale — quello afferrato
    // — è l'indice 1.
    const full = instrada('standard', pDa, pA, undefined, quote, lati)
    expect(full).toEqual([
      { x: 272, y: 182 },
      { x: 382, y: 182 },
      { x: 382, y: 405 },
    ])
    const indiceTratto = 1

    const nuovi = trascinaTratto('standard', pDa, pA, undefined, quote, indiceTratto, { x: 20, y: 0 }, lati)

    // 382 + 20 = 402: il punto di griglia più vicino (400, distanza 2) vince sui capi (272 e
    // 382, distanze 130 e 20). Con i lati ricostruiti correttamente il montante trasla a x=400
    // su entrambi i capi del tratto.
    expect(nuovi).toEqual([
      { x: 400, y: 182 },
      { x: 400, y: 405 },
    ])
  })
})

describe('rotte native', () => {
  it('la mandata flessibile sale al collettore, corre in orizzontale e scende accanto al bocchello', () => {
    // xDiscesa = 400 - AVVICINAMENTO(34) = 366: il montante di discesa si stacca dal fianco
    // del recipiente invece di correre sul suo contorno.
    expect(rottaFlessibile({ x: 100, y: 500 }, { x: 400, y: 300 }, 200)).toEqual([
      { x: 100, y: 500 },
      { x: 100, y: 200 },
      { x: 366, y: 200 },
      { x: 366, y: 300 },
      { x: 400, y: 300 },
    ])
  })

  it('la mandata di linea gira a metà strada', () => {
    expect(rottaLinea({ x: 0, y: 100 }, { x: 200, y: 300 })).toEqual([
      { x: 0, y: 100 },
      { x: 100, y: 100 },
      { x: 100, y: 300 },
      { x: 200, y: 300 },
    ])
  })

  it('la linea condense scende sulla corsia comune e poi nel pozzo', () => {
    // pA.y (500) sta SOTTO yCorsia (450), com'è nella realtà (il pozzo di raccolta sta sotto la
    // corsia comune, non sopra): un esempio con pA.y=400, pur risolvendo la stessa matematica,
    // ritrarrebbe una configurazione impossibile e insegnerebbe il contrario del docblock.
    expect(rottaCondensa({ x: 50, y: 100 }, { x: 300, y: 500 }, 450)).toEqual([
      { x: 50, y: 100 },
      { x: 50, y: 450 },
      { x: 300, y: 450 },
      { x: 300, y: 500 },
    ])
  })
})

describe('instrada', () => {
  const quote = { yCollettore: 200, yCorsiaCondense: 450 }

  it('sceglie la rotta nativa dello stile quando l’arco non ha gomiti', () => {
    const pDa = { x: 100, y: 500 }
    const pA = { x: 400, y: 300 }
    expect(instrada('flessibile', pDa, pA, undefined, quote)).toEqual(rottaFlessibile(pDa, pA, 200))
    expect(instrada('standard', pDa, pA, [], quote)).toEqual(rottaLinea(pDa, pA))
    expect(instrada('condensa', pDa, pA, [], quote)).toEqual(rottaCondensa(pDa, pA, 450))
  })

  it('i gomiti imposti a mano vincono su ogni rotta nativa', () => {
    const pDa = { x: 100, y: 500 }
    const pA = { x: 400, y: 300 }
    const gomiti = [{ x: 250, y: 500 }]
    for (const stile of ['flessibile', 'standard', 'condensa'] as const) {
      expect(instrada(stile, pDa, pA, gomiti, quote)).toEqual(polilineaConGomiti(pDa, gomiti, pA))
    }
  })

  it('la rotta nativa non è mai il semplice angolo singolo che l’editor disegnava', () => {
    // Il difetto del committente in forma di test: la tela faceva due tratti, il documento
    // quattro. Se questa asserzione diventa verde, l'unificazione è tornata indietro. Vale per
    // i tre stili, non solo per il flessibile: `standard` e `condensa` sono anch'essi rotte a
    // più tratti (rispettivamente `rottaLinea` e `rottaCondensa`), mai il raccordo a un angolo
    // solo che produrrebbe `polilineaConGomiti(pDa, [], pA)`.
    const pDa = { x: 100, y: 500 }
    const pA = { x: 400, y: 300 }
    for (const stile of ['flessibile', 'standard', 'condensa'] as const) {
      expect(instrada(stile, pDa, pA, [], quote)).not.toEqual(polilineaConGomiti(pDa, [], pA))
    }
  })
})

describe('instrada con un lato imposto', () => {
  const QUOTE = { yCollettore: 0, yCorsiaCondense: 500 }

  // Il caso misurato in pagina: un ramo che scende su un TEE posato su un tubo
  // orizzontale. Senza il lato imposto la rotta gira a metà strada (x mediana 327) e
  // l'ultimo tratto corre sovrapposto al tubo passante; con il lato imposto il ramo
  // scende dritto nella giunzione e la T si forma.
  it('un capo che impone il lato alto viene imboccato in verticale', () => {
    const punti = instrada('standard', { x: 272, y: 182 }, { x: 382, y: 405 }, undefined, QUOTE, { a: 'alto' })
    expect(punti).toEqual([
      { x: 272, y: 182 },
      { x: 382, y: 182 },
      { x: 382, y: 405 },
    ])
  })

  it('un capo che impone un lato laterale viene imboccato in orizzontale', () => {
    const punti = instrada('standard', { x: 272, y: 182 }, { x: 382, y: 405 }, undefined, QUOTE, { a: 'sx' })
    expect(punti).toEqual([
      { x: 272, y: 182 },
      { x: 272, y: 405 },
      { x: 382, y: 405 },
    ])
  })

  // Il lato imposto sul capo di PARTENZA vincola il primo segmento, non l'ultimo.
  it('un lato imposto in partenza vincola il primo segmento', () => {
    const punti = instrada('standard', { x: 272, y: 182 }, { x: 382, y: 405 }, undefined, QUOTE, { da: 'basso' })
    expect(punti).toEqual([
      { x: 272, y: 182 },
      { x: 272, y: 405 },
      { x: 382, y: 405 },
    ])
  })

  // Due giunzioni sullo stesso tubo: entrambi i vincoli vanno rispettati. Assi diversi
  // bastano a una spezzata a un angolo solo.
  it('due lati imposti su assi diversi danno un angolo solo', () => {
    const punti = instrada('standard', { x: 272, y: 182 }, { x: 382, y: 405 }, undefined, QUOTE, { da: 'basso', a: 'sx' })
    expect(punti).toEqual([
      { x: 272, y: 182 },
      { x: 272, y: 405 },
      { x: 382, y: 405 },
    ])
  })

  // Assi uguali: servono due angoli, e la piega sta a metà fra i due capi sull'asse
  // imposto — la scelta simmetrica, l'unica che non privilegia un capo sull'altro.
  it('due lati imposti sullo stesso asse danno una piega a metà', () => {
    const punti = instrada('standard', { x: 272, y: 182 }, { x: 382, y: 405 }, undefined, QUOTE, { da: 'basso', a: 'alto' })
    expect(punti).toEqual([
      { x: 272, y: 182 },
      { x: 272, y: 293.5 },
      { x: 382, y: 293.5 },
      { x: 382, y: 405 },
    ])
  })

  // Capi già allineati sull'asse imposto: nessun vertice intermedio, una linea dritta.
  it('capi già allineati non producono vertici inutili', () => {
    const punti = instrada('standard', { x: 382, y: 182 }, { x: 382, y: 405 }, undefined, QUOTE, { a: 'alto' })
    expect(punti).toEqual([
      { x: 382, y: 182 },
      { x: 382, y: 405 },
    ])
  })

  // I gomiti a mano vincono su tutto, lato imposto compreso: è la regola di sempre, ed
  // è ciò che lascia intatte le due metà di un tubo spezzato, che nascono con gomiti.
  it('i gomiti a mano vincono anche sul lato imposto', () => {
    const gomiti = [{ x: 300, y: 300 }]
    const conLato = instrada('standard', { x: 272, y: 182 }, { x: 382, y: 405 }, gomiti, QUOTE, { a: 'alto' })
    const senzaLato = instrada('standard', { x: 272, y: 182 }, { x: 382, y: 405 }, gomiti, QUOTE)
    expect(conLato).toEqual(senzaLato)
  })

  // Senza lati imposti nulla cambia: è ciò che tiene invariato il disegno di ogni
  // pratica che un TEE non ce l'ha.
  it('senza lati imposti la rotta resta quella dello stile', () => {
    const conOggettoVuoto = instrada('standard', { x: 0, y: 0 }, { x: 300, y: 100 }, undefined, QUOTE, {})
    const senzaParametro = instrada('standard', { x: 0, y: 0 }, { x: 300, y: 100 }, undefined, QUOTE)
    expect(conOggettoVuoto).toEqual(senzaParametro)
    expect(senzaParametro).toEqual(rottaLinea({ x: 0, y: 0 }, { x: 300, y: 100 }))
  })

  // Il lato imposto vince anche sugli stili con una rotta nativa lontana: un ramo
  // condense su una giunzione non deve passare dalla corsia comune.
  it('vale anche per gli stili con rotta nativa propria', () => {
    const punti = instrada('condensa', { x: 272, y: 182 }, { x: 382, y: 405 }, undefined, QUOTE, { a: 'alto' })
    expect(punti.some((p) => p.y === QUOTE.yCorsiaCondense)).toBe(false)
    expect(punti[punti.length - 1]).toEqual({ x: 382, y: 405 })
  })

  // Giro di fix 1 — buco di copertura del revisore: `rottaImboccata` ha otto rami e i nove casi
  // sopra ne esercitano solo cinque. I tre casi sotto stanno sugli stessi due capi
  // (272,182)-(382,405) apposta, per confrontare i numeri a colpo d'occhio con quelli sopra, ed
  // esercitano i tre rami mancanti.

  // Solo il capo di partenza impone, e impone un lato laterale: è il ramo "solo `da` impone"
  // (lo stesso di 'un lato imposto in partenza vincola il primo segmento', sopra), ma il suo
  // braccio FALSO — quel test usa 'basso' (verticale) ed esercita solo il braccio vero.
  it('un lato laterale imposto in partenza vincola il primo segmento in orizzontale', () => {
    const punti = instrada('standard', { x: 272, y: 182 }, { x: 382, y: 405 }, undefined, QUOTE, { da: 'sx' })
    expect(punti).toEqual([
      { x: 272, y: 182 },
      { x: 382, y: 182 },
      { x: 382, y: 405 },
    ])
  })

  // Assi diversi con l'ordine speculare a 'due lati imposti su assi diversi danno un angolo
  // solo' (che usa `{ da: 'basso', a: 'sx' }`): qui è `da` a essere laterale e `a` verticale,
  // il braccio opposto della stessa ternaria.
  it('assi diversi con il capo di partenza laterale danno lo stesso angolo, per il ramo opposto', () => {
    const punti = instrada('standard', { x: 272, y: 182 }, { x: 382, y: 405 }, undefined, QUOTE, {
      da: 'sx',
      a: 'alto',
    })
    expect(punti).toEqual([
      { x: 272, y: 182 },
      { x: 382, y: 182 },
      { x: 382, y: 405 },
    ])
  })

  // Entrambi i capi impongono un lato laterale: stesso asse, ma quello orizzontale — il ramo
  // `xMedia`, mai raggiunto da 'due lati imposti sullo stesso asse danno una piega a metà', che
  // copre solo la variante verticale (`yMedia`).
  it('due lati laterali sullo stesso asse danno una piega all’ascissa mediana', () => {
    const punti = instrada('standard', { x: 272, y: 182 }, { x: 382, y: 405 }, undefined, QUOTE, {
      da: 'sx',
      a: 'dx',
    })
    expect(punti).toEqual([
      { x: 272, y: 182 },
      { x: 327, y: 182 },
      { x: 327, y: 405 },
      { x: 382, y: 405 },
    ])
  })
})

// Trasferita qui da renderSvg.ts nel Blocco D4: la tela dell'editor deve aprire i varchi con la
// STESSA funzione del documento, e per importarla non puo' dipendere dal modulo che rende l'SVG.
describe('quoteAttraversamento', () => {
  it('trova le quote dei tratti orizzontali che scavalcano la verticale', () => {
    const punti = [{ x: 0, y: 10 }, { x: 100, y: 10 }, { x: 100, y: 90 }, { x: 200, y: 90 }]
    expect(quoteAttraversamento(punti, 50)).toEqual([10])
    expect(quoteAttraversamento(punti, 150)).toEqual([90])
  })

  it('non conta un tratto verticale, che il muro non lo attraversa mai', () => {
    expect(quoteAttraversamento([{ x: 50, y: 0 }, { x: 50, y: 100 }], 50)).toEqual([])
  })
})
