import { describe, it, expect } from 'vitest'
import { chiaveSimbolo } from '../types'
import { REGISTRO_SIMBOLI, definizioneDi, dimensioniDi, ancoraDi, ancoreDi, simboloDi, simboloGiunzione, valvolaIntercettazione, riduttorePressione, testoMultiRiga } from '../symbols'
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
    const corta = terminale('Utenze aria')
    const lunga = terminale('Utenze aria\nreparto verniciatura\ne collaudo')
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
    expect(simboloDi(utenze)).toContain('>Utenze aria</text>')
    expect(simboloDi({ ...utenze, etichetta: 'Utenze azoto' })).toContain('>Utenze azoto</text>')
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
      '>Utenze aria compressa reparto 2</text>'
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

  it('gli attacchi stanno sui bordi del riquadro, il pallino al centro', () => {
    const { larghezza, altezza } = REGISTRO_SIMBOLI.giunzione.dimensioni
    const per = (id: string) => REGISTRO_SIMBOLI.giunzione.ancore.find((a) => a.id === id)!
    expect(per('sx')).toMatchObject({ x: 0, y: altezza / 2 })
    expect(per('dx')).toMatchObject({ x: larghezza, y: altezza / 2 })
    expect(per('alto')).toMatchObject({ x: larghezza / 2, y: 0 })
    expect(per('basso')).toMatchObject({ x: larghezza / 2, y: altezza })
    // Il centro del pallino va ricavato dalle dimensioni del registro, non scritto a mano:
    // se l'ingombro cambia, il test deve seguirlo senza bisogno di essere riscritto.
    const svg = simboloGiunzione(nodo)
    const cx = Number(/cx="([\d.]+)"/.exec(svg)![1])
    const cy = Number(/cy="([\d.]+)"/.exec(svg)![1])
    expect(cx).toBe(larghezza / 2)
    expect(cy).toBe(altezza / 2)
  })

  it('il pallino tocca esattamente le ancore: né un buco né una sporgenza fuori dal riquadro', () => {
    // Il raggio è metà della larghezza per costruzione (vedi simboloGiunzione): un'uguaglianza,
    // non una tolleranza, perché qualunque scarto lascerebbe un buco (raggio più piccolo) o
    // farebbe sporgere il pallino fuori dal riquadro (raggio più grande).
    const { larghezza } = REGISTRO_SIMBOLI.giunzione.dimensioni
    const raggio = Number(/r="([\d.]+)"/.exec(simboloGiunzione(nodo))![1])
    expect(raggio).toBe(larghezza / 2)
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
