import { describe, it, expect } from 'vitest'
import { chiaveSimbolo } from '../types'
import { REGISTRO_SIMBOLI, definizioneDi, dimensioniDi, ancoraDi, ancoreDi, simboloDi, simboloGiunzione, simboloUtenze, valvolaIntercettazione, riduttorePressione, testoMultiRiga, DIAMETRO_GIUNZIONE, campioneTubazione, TRATTEGGIO_CONDENSE } from '../symbols'
import { capoValido } from '../agganci'

describe('chiaveSimbolo', () => {
  it('distingue le due varianti del serbatoio', () => {
    expect(chiaveSimbolo({ tipo: 'serbatoio', orientamento: 'VERTICALE' })).toBe('serbatoio:VERTICALE')
    expect(chiaveSimbolo({ tipo: 'serbatoio', orientamento: 'ORIZZONTALE' })).toBe('serbatoio:ORIZZONTALE')
  })

  it('assume il serbatoio verticale quando l\'orientamento manca', () => {
    expect(chiaveSimbolo({ tipo: 'serbatoio' })).toBe('serbatoio:VERTICALE')
  })

  it('per gli altri tipi la chiave è il tipo stesso', () => {
    expect(chiaveSimbolo({ tipo: 'compressore' })).toBe('compressore')
    expect(chiaveSimbolo({ tipo: 'tanica' })).toBe('tanica')
  })
})

describe('registro dei simboli', () => {
  it('ogni definizione dichiara almeno un\'ancora, con identificativi distinti', () => {
    for (const [chiave, def] of Object.entries(REGISTRO_SIMBOLI)) {
      expect(def.ancore.length, chiave).toBeGreaterThan(0)
      const ids = def.ancore.map((a) => a.id)
      expect(new Set(ids).size, chiave).toBe(ids.length)
    }
  })

  it('ogni ancora accetta almeno un tipo e cade dentro il riquadro d\'ingombro', () => {
    for (const [chiave, def] of Object.entries(REGISTRO_SIMBOLI)) {
      for (const a of def.ancore) {
        expect(a.accetta.length, `${chiave}/${a.id}`).toBeGreaterThan(0)
        expect(a.x, `${chiave}/${a.id}`).toBeGreaterThanOrEqual(0)
        expect(a.x, `${chiave}/${a.id}`).toBeLessThanOrEqual(def.dimensioni.larghezza)
        expect(a.y, `${chiave}/${a.id}`).toBeGreaterThanOrEqual(0)
        expect(a.y, `${chiave}/${a.id}`).toBeLessThanOrEqual(def.dimensioni.altezza)
      }
    }
  })

  it('il serbatoio orizzontale ha ancore diverse dal verticale', () => {
    const serbatoio = (orientamento: 'VERTICALE' | 'ORIZZONTALE') => ({
      id: 'S1', tipo: 'serbatoio' as const, orientamento, etichetta: 'S1', gruppo: 'SALA_COMPRESSORI' as const,
      valvoleSicurezza: [], origine: 'scheda' as const,
    })
    const v = ancoraDi(serbatoio('VERTICALE'), 'sx')
    const o = ancoraDi(serbatoio('ORIZZONTALE'), 'sx')
    expect(v).toBeDefined()
    expect(o).toBeDefined()
    expect(v).not.toEqual(o)
  })

  it('definizioneDi risolve la variante del nodo', () => {
    expect(definizioneDi({ tipo: 'serbatoio', orientamento: 'ORIZZONTALE' }).dimensioni.larghezza).toBe(150)
    expect(definizioneDi({ tipo: 'tanica' }).dimensioni.larghezza).toBe(80)
  })
})

describe('ancoreDi', () => {
  const terminale = (etichetta: string) => ({
    id: 'UTENZE', tipo: 'utenze' as const, etichetta, gruppo: 'LINEA_DISTRIBUZIONE' as const,
    valvoleSicurezza: [], origine: 'scheda' as const,
  })

  it('per un nodo qualunque restituisce le ancore del registro, intatte', () => {
    const compressore = { id: 'C1', tipo: 'compressore' as const, etichetta: 'C', gruppo: 'SALA_COMPRESSORI' as const, valvoleSicurezza: [], origine: 'scheda' as const }
    expect(ancoreDi(compressore)).toEqual(REGISTRO_SIMBOLI.compressore.ancore)
  })

  it('l’attacco del terminale utenze sta in fondo al riquadro, anche quando il riquadro cresce', () => {
    // Il codolo del terminale parte dal fondo del riquadro: se l'ancora restasse alla quota
    // fissa del registro mentre il riquadro si allunga, la tubazione si attaccherebbe a metà
    // del codolo invece che alla sua base.
    //
    // «lunga» deve avere righe a sufficienza da superare l'altezza minima del registro (120):
    // con 3 righe (verifica fatta a mano in fase di stesura) il riquadro non cresce affatto e il
    // test resterebbe vero anche con l'ancora fissa — decorativo, non protettivo. Con 6 lo
    // supera davvero, e il test discrimina.
    const corta = terminale('Utenze aria')
    const lunga = terminale('Utenze aria\nreparto verniciatura\ne collaudo\nlinea 4\nlinea 5\nlinea 6')
    expect(ancoreDi(corta).find((a) => a.id === 'in')!.y).toBe(dimensioniDi(corta).altezza)
    expect(ancoreDi(lunga).find((a) => a.id === 'in')!.y).toBe(dimensioniDi(lunga).altezza)
  })
})

describe('simbolo «Alle utenze»', () => {
  const utenze = {
    id: 'UTENZE',
    tipo: 'utenze' as const,
    etichetta: 'Utenze aria',
    gruppo: 'LINEA_DISTRIBUZIONE' as const,
    valvoleSicurezza: [],
    origine: 'scheda' as const,
  }

  it('disegna la scritta che il nodo porta, non una cablata nel codice', () => {
    // `testoMultiRiga` (Task 4) avvolge anche una riga sola in un `<tspan>`.
    expect(simboloDi(utenze)).toContain('>Utenze aria</tspan>')
    expect(simboloDi({ ...utenze, etichetta: 'Utenze azoto' })).toContain('>Utenze azoto</tspan>')
  })

  it('disegna il codolo tratteggiato e la punta di freccia piena', () => {
    const svg = simboloDi(utenze)
    // Tratteggio come le altre linee di servizio del disegno.
    expect(svg).toContain('stroke-dasharray="10 7"')
    // La punta è un triangolo pieno, non un marker: nell'editor il simbolo vive in un <svg>
    // suo, dove i <defs> di renderSvg non esistono e un marker-end non verrebbe disegnato.
    // Il path completo (non il solo `fill="#000"`, che compare già sul <text> della scritta e
    // quindi non discriminerebbe un'implementazione priva del triangolo) prova che il
    // triangolo esiste davvero, con la geometria attesa.
    expect(svg).toContain('<path d="M 6 27 L 12 14 L 18 27 Z" fill="#000" />')
    expect(svg).not.toContain('marker-end')
  })

  it('dichiara una sola ancora, in basso al codolo, che accetta aria', () => {
    const def = definizioneDi(utenze)
    expect(def.ancore).toEqual([{ id: 'in', x: 12, y: 120, accetta: ['aria'] }])
    expect(def.dimensioni).toEqual({ larghezza: 190, altezza: 120 })
  })

  // La spec promette «ingombro largo abbastanza da contenere la scritta, così `dimensioniLayout`
  // allarga da sé la tela». Con la larghezza fissa a 190 restavano ~17-18 caratteri: oltre, la
  // scritta usciva dal riquadro — tagliata subito nell'editor, tagliata nel PNG appena superava
  // il margine. E il campo di rinomina invita a scrivere («Utenze aria», «Utenze azoto»).
  it('l\'ingombro del terminale cresce con la lunghezza della scritta', () => {
    const corta = dimensioniDi({ ...utenze, etichetta: 'Utenze aria' })
    const lunga = dimensioniDi({ ...utenze, etichetta: 'Utenze aria compressa reparto 2' })
    const piuLunga = dimensioniDi({ ...utenze, etichetta: 'Utenze aria compressa reparto 2 e 3' })

    // Una scritta breve non stringe il riquadro sotto il minimo del registro.
    expect(corta.larghezza).toBe(190)
    // Una lunga lo allarga, e la scritta ci sta dentro per intero.
    expect(lunga.larghezza).toBeGreaterThan(190)
    expect(simboloDi({ ...utenze, etichetta: 'Utenze aria compressa reparto 2' })).toContain(
      '>Utenze aria compressa reparto 2</tspan>'
    )
    // Cresce con la lunghezza, non a scatti fissi: quattro caratteri in più allargano ancora.
    expect(piuLunga.larghezza).toBeGreaterThan(lunga.larghezza)
    // L'altezza non c'entra: la scritta sta su una riga sola.
    expect(lunga.altezza).toBe(corta.altezza)
  })

  it('gli altri tipi conservano l\'ingombro del registro', () => {
    // `dimensioniDi` non deve diventare una seconda fonte di verità sugli ingombri: per tutto
    // ciò che non è il terminale è il registro a decidere, com'è sempre stato.
    for (const chiave of Object.keys(REGISTRO_SIMBOLI)) {
      const def = REGISTRO_SIMBOLI[chiave]
      const [tipo, orientamento] = chiave.split(':')
      if (tipo === 'utenze') continue
      const nodo = { ...utenze, tipo: tipo as typeof utenze.tipo, orientamento: orientamento as never }
      expect(dimensioniDi(nodo), chiave).toEqual(def.dimensioni)
    }
  })

  it('l\'ancora accetta l\'aria e rifiuta la condensa', () => {
    expect(capoValido(utenze, 'in', 'standard')).toBe(true)
    expect(capoValido(utenze, 'in', 'flessibile')).toBe(true)
    expect(capoValido(utenze, 'in', 'condensa')).toBe(false)
  })
})

describe('terminale utenze su più righe', () => {
  const terminale = (etichetta: string) => ({
    id: 'UTENZE', tipo: 'utenze' as const, etichetta, gruppo: 'LINEA_DISTRIBUZIONE' as const,
    valvoleSicurezza: [], origine: 'scheda' as const,
  })

  it('disegna una riga per capoverso', () => {
    const svg = simboloUtenze(terminale('Utenze aria\nreparto 2'))
    expect([...svg.matchAll(/<tspan/g)]).toHaveLength(2)
    expect(svg).toContain('>Utenze aria</tspan>')
    expect(svg).toContain('>reparto 2</tspan>')
  })

  it('la larghezza si misura sulla riga più lunga, non su tutto il contenuto', () => {
    // Un `toBeLessThan` da solo non basta a discriminare: misurando l'intera stringa con `\n`
    // (231, come `unaRigaLunga` sotto) o sommando la lunghezza delle due righe (222, una
    // mutazione plausibile di «riga più lunga») il risultato è comunque minore di 231, quindi il
    // confronto passerebbe con entrambe le implementazioni sbagliate. La riga più lunga di
    // «Utenze aria» / «reparto 2» è 11 caratteri, sotto quanto serve a superare il minimo del
    // registro: fissare il valore atteso a 190 (quel minimo) è l'unico modo che scopre la
    // differenza.
    const dueRigheCorte = dimensioniDi(terminale('Utenze aria\nreparto 2'))
    const unaRigaLunga = dimensioniDi(terminale('Utenze aria reparto 2'))
    expect(dueRigheCorte.larghezza).toBe(190)
    expect(dueRigheCorte.larghezza).toBeLessThan(unaRigaLunga.larghezza)
  })

  it('l’altezza cresce col numero di righe, e solo quando serve', () => {
    const una = dimensioniDi(terminale('Utenze aria'))
    const due = dimensioniDi(terminale('Utenze aria\nreparto 2'))
    const otto = dimensioniDi(terminale(Array.from({ length: 8 }, (_, i) => `riga ${i}`).join('\n')))
    expect(due.altezza).toBe(una.altezza)
    expect(otto.altezza).toBeGreaterThan(una.altezza)
    // Valore atteso ESATTO, non solo un limite inferiore: un `toBeGreaterThanOrEqual` non si
    // accorgerebbe se `UTENZE.margineInferiore` (symbols/index.ts) cambiasse — l'altezza
    // crescerebbe comunque, e resterebbe sopra la soglia. 20 è il centro della prima riga
    // (`yPunta + 6`), 7 * 18 * 1,25 (INTERLINEA_TESTO) porta all'ultima delle otto righe, e
    // `margineInferiore` (10) è l'aria fra quella riga e il fondo del riquadro; il risultato è
    // arrotondato per eccesso.
    expect(otto.altezza).toBe(188)
  })

  it('il codolo parte dal fondo del riquadro, che è dove si attacca la tubazione', () => {
    const lungo = terminale(Array.from({ length: 8 }, (_, i) => `riga ${i}`).join('\n'))
    const altezza = dimensioniDi(lungo).altezza
    // 12 è `UTENZE.x`, l'ascissa del codolo: la costante non è esportata, quindi il test la
    // fissa come letterale — se cambia, questo test deve accorgersene.
    expect(simboloUtenze(lungo)).toContain(`M 12 ${altezza}`)
    expect(ancoreDi(lungo).find((a) => a.id === 'in')!.y).toBe(altezza)
  })
})

describe('giunzione', () => {
  const nodo = { id: 'M-G1', tipo: 'giunzione' as const, etichetta: 'Giunzione', gruppo: 'LINEA_DISTRIBUZIONE' as const, valvoleSicurezza: [], origine: 'manuale' as const }

  it('è un punto pieno senza monconi: la forma a T la disegnano le tubazioni', () => {
    const svg = simboloGiunzione(nodo)
    expect(svg).toContain('<circle')
    // Nessun tratto disegnato: prima del Blocco C2 il simbolo aveva tre monconi che
    // restavano visibili anche senza tubazioni collegate.
    expect(svg).not.toContain('<path')
  })

  it('ha quattro attacchi, uno per lato, tutti sull’aria', () => {
    const ancore = REGISTRO_SIMBOLI.giunzione.ancore
    expect(ancore.map((a) => a.id).sort()).toEqual(['alto', 'basso', 'dx', 'sx'])
    expect(ancore.every((a) => a.accetta.length === 1 && a.accetta[0] === 'aria')).toBe(true)
  })

  it('le quattro ancore stanno tutte al centro: i tubi convergono in un punto solo', () => {
    const { larghezza, altezza } = REGISTRO_SIMBOLI.giunzione.dimensioni
    // Il centro va ricavato dalle dimensioni del registro, non scritto a mano: se l'ingombro
    // cambia, il test deve seguirlo senza bisogno di essere riscritto.
    for (const ancora of REGISTRO_SIMBOLI.giunzione.ancore) {
      expect(ancora).toMatchObject({ x: larghezza / 2, y: altezza / 2 })
    }
    const svg = simboloGiunzione(nodo)
    expect(Number(/cx="([\d.]+)"/.exec(svg)![1])).toBe(larghezza / 2)
    expect(Number(/cy="([\d.]+)"/.exec(svg)![1])).toBe(altezza / 2)
  })

  it('i punti di presa restano sulle mezzerie dei lati: il TEE si afferra come prima', () => {
    const { larghezza, altezza } = REGISTRO_SIMBOLI.giunzione.dimensioni
    const per = (id: string) => REGISTRO_SIMBOLI.giunzione.ancore.find((a) => a.id === id)!
    expect(per('sx').presa).toEqual({ x: 0, y: altezza / 2 })
    expect(per('dx').presa).toEqual({ x: larghezza, y: altezza / 2 })
    expect(per('alto').presa).toEqual({ x: larghezza / 2, y: 0 })
    expect(per('basso').presa).toEqual({ x: larghezza / 2, y: altezza })
  })

  it('il pallino ha il diametro dei punti di ancoraggio delle apparecchiature, e contiene le ancore', () => {
    // Il vincolo vecchio — raggio uguale a metà larghezza, per toccare le ancore sui bordi —
    // non esiste più: le ancore stanno nel CENTRO del pallino, quindi non c'è buco a nessun
    // raggio, ed è precisamente ciò che permette al pallino di rimpicciolire (osservazione 4).
    const raggio = Number(/r="([\d.]+)"/.exec(simboloGiunzione(nodo))![1])
    expect(raggio).toBe(DIAMETRO_GIUNZIONE / 2)
    expect(DIAMETRO_GIUNZIONE).toBe(10)
    expect(raggio).toBeLessThan(REGISTRO_SIMBOLI.giunzione.dimensioni.larghezza / 2)
  })
})

describe('testoMultiRiga', () => {
  it('mette una riga per ogni capoverso, incolonnate sulla stessa ascissa', () => {
    const svg = testoMultiRiga(10, 20, 'Utenze aria\nreparto 2', 18, 'start')
    const tspan = [...svg.matchAll(/<tspan x="([\d.]+)" y="([\d.]+)">([^<]*)<\/tspan>/g)]
    expect(tspan).toHaveLength(2)
    expect(tspan.map((m) => m[3])).toEqual(['Utenze aria', 'reparto 2'])
    expect(tspan.map((m) => m[1])).toEqual(['10', '10'])
  })

  it('distanzia le righe di un’interlinea proporzionale al corpo', () => {
    const svg = testoMultiRiga(0, 100, 'a\nb\nc', 20)
    const y = [...svg.matchAll(/y="([\d.]+)"/g)].map((m) => Number(m[1]))
    expect(y).toEqual([100, 125, 150])
  })

  it('una riga sola resta una riga sola, senza spaziature inventate', () => {
    const svg = testoMultiRiga(5, 5, 'Utenze aria', 18, 'start')
    expect([...svg.matchAll(/<tspan/g)]).toHaveLength(1)
  })

  it('protegge i caratteri speciali come il testo a riga singola', () => {
    expect(testoMultiRiga(0, 0, 'a & b\n<c>')).toContain('a &amp; b')
    expect(testoMultiRiga(0, 0, 'a & b\n<c>')).toContain('&lt;c&gt;')
  })
})

describe('riduttorePressione', () => {
  it('contiene la farfalla della valvola di intercettazione più uno stelo di regolazione', () => {
    const valvola = valvolaIntercettazione(50, 50)
    const riduttore = riduttorePressione(50, 50)
    // Stesso corpo della valvola (farfalla), riconoscibile perché il riduttore lo contiene
    // per intero: è la valvola con un elemento in più, non un disegno indipendente.
    expect(riduttore).toContain(valvola)
    expect(riduttore).not.toBe(valvola)
    expect(riduttore).toContain('<rect')
  })

  it('ruota lo stelo con l’orientamento, come la valvola sottostante', () => {
    const orizzontale = riduttorePressione(50, 50, 'orizzontale')
    const verticale = riduttorePressione(50, 50, 'verticale')
    expect(orizzontale).not.toBe(verticale)
  })
})

describe('campioneTubazione', () => {
  // La tela (SchemaEdgeTubazione.tsx) e il documento devono tratteggiare le condense allo stesso
  // modo: fino al Blocco D4 la tela usava '8 6' e il documento '10 7', e su fondo nero la
  // differenza non si notava. Il test fissa la costante, non il numero scritto due volte.
  it('il campione di legenda delle condense usa la costante del tratteggio', () => {
    expect(campioneTubazione('condensa')).toContain(`stroke-dasharray="${TRATTEGGIO_CONDENSE}"`)
    expect(TRATTEGGIO_CONDENSE).toBe('10 7')
  })
})
