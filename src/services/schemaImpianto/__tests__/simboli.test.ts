import { describe, it, expect } from 'vitest'
import { chiaveSimbolo } from '../types'
import type { SchemaNodo, SchemaNodoTipo } from '../types'
import { REGISTRO_SIMBOLI, definizioneDi, dimensioniDi, ancoraDi, ancoreDi, simboloDi, simboloGiunzione, simboloMuro, simboloUtenze, valvolaIntercettazione, riduttorePressione, valvolaScarico, testoMultiRiga, DIAMETRO_GIUNZIONE, campioneTubazione, TRATTEGGIO_CONDENSE, MARGINE_VALVOLA_SERBATOIO, simboloTrasformato, inviluppo } from '../symbols'
import { capoValido } from '../agganci'
import { TARATURA_NEUTRA, type Tarature } from '../libreria'
import { PASSO_GRIGLIA } from '../griglia'

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

  // Task 8, Blocco 3: prima di questo task le ancore di fabbrica non cadevano sui multipli di
  // 10 (es. `serbatoio:VERTICALE/sx` a (0,169), `essiccatore/alto-in` a (55,10)) — per questo
  // esiste `agganciaQuota` (griglia.ts), che aggancia anche alle "quote preferite" perché la
  // sola griglia non bastava. Da qui in poi ogni ancora dichiarata nel registro deve cadere
  // esattamente su un multiplo di `PASSO_GRIGLIA`, sagoma per sagoma: dove un'ancora doveva
  // stare su un punto notevole (il vertice di un rombo, la calotta di un serbatoio, il centro
  // di un riquadro), è la sagoma che si è adattata (ingombri arrotondati ai multipli di 20, o
  // 10 quando basta), non l'ancora spostata a un valore qualunque.
  it('ogni ancora di ogni simbolo cade sulla griglia', () => {
    const fuori: string[] = []
    for (const [chiave, def] of Object.entries(REGISTRO_SIMBOLI)) {
      for (const a of def.ancore) {
        if (a.x % PASSO_GRIGLIA !== 0 || a.y % PASSO_GRIGLIA !== 0) {
          fuori.push(`${chiave}/${a.id} (${a.x}, ${a.y})`)
        }
      }
    }
    expect(fuori).toEqual([])
  })

  // Le cinque ancore indicate dal committente su uno screenshot dei propri blocchi: quattro sui
  // fianchi, alle due quote dove le calotte (semicerchi) incontrano il cilindro — sinistra e
  // destra, in alto e in basso — più una in basso al centro sulla valvola di scarico. Prima di
  // questo task ce n'erano quattro, in posti diversi (sx/dx a metà altezza, un'unica presa in
  // alto per aria+valvola di sicurezza): il committente ne voleva cinque, non quattro spostate.
  it('il serbatoio verticale ha le cinque ancore chieste dal committente', () => {
    const ancore = REGISTRO_SIMBOLI['serbatoio:VERTICALE'].ancore
    expect(ancore).toHaveLength(5)
    expect(ancore.filter((a) => a.accetta.includes('aria'))).toHaveLength(4)
    expect(ancore.filter((a) => a.accetta.includes('condensa'))).toHaveLength(1)
  })

  it('il serbatoio orizzontale ha ancore diverse dal verticale', () => {
    const serbatoio = (orientamento: 'VERTICALE' | 'ORIZZONTALE') => ({
      id: 'S1', tipo: 'serbatoio' as const, orientamento, etichetta: 'S1', gruppo: 'SALA_COMPRESSORI' as const,
      valvoleSicurezza: [], origine: 'scheda' as const,
    })
    // 'dx', non più 'sx' (Task 8, Blocco 3): dal momento in cui sia la larghezza del verticale
    // (100) sia l'altezza dell'orizzontale (100) sono scese a un multiplo di 20, i due raggi
    // delle calotte coincidono (50), e con loro la quota 'sx' (0, 90) dei due orientamenti —
    // stesso punto per coincidenza numerica, non perché la risoluzione della variante sia
    // rotta. 'dx' invece resta diverso per costruzione: il verticale è largo 100, l'orizzontale
    // 310, quindi la sua ascissa (310 contro 100) discrimina comunque i due registri.
    const v = ancoraDi(serbatoio('VERTICALE'), 'dx')
    const o = ancoraDi(serbatoio('ORIZZONTALE'), 'dx')
    expect(v).toBeDefined()
    expect(o).toBeDefined()
    expect(v).not.toEqual(o)
  })

  it('definizioneDi risolve la variante del nodo', () => {
    // 310 e 80: gli ingombri del Task 4 (proporzioni dai blocchi CAD), non più 150 e 80... e la
    // tanica è scesa ancora, da 86 a 80, nel Task 8 (Blocco 3), perché 86/2 = 43 non cadeva
    // sulla griglia — vedi `DIMENSIONI.tanica`.
    expect(definizioneDi({ tipo: 'serbatoio', orientamento: 'ORIZZONTALE' }).dimensioni.larghezza).toBe(310)
    expect(definizioneDi({ tipo: 'tanica' }).dimensioni.larghezza).toBe(80)
  })
})

describe('le proporzioni seguono i blocchi CAD', () => {
  // Task 4, Blocco 3: rapporti misurati sui blocchi `Blocchi.pdf` (script
  // `scripts/blocchi-cad.py --misure`), presa a 1 la larghezza del rombo (`essiccatore`). Per
  // compressore/tanica/pacco bombole la misura grezza è già il corpo (nessun accessorio da
  // isolare); per il serbatoio la misura grezza comprende valvola e scarico, quindi qui si
  // confrontano i soli ingombri del registro (che isolano il corpo, vedi il commento su
  // `CORPO_SERBATOIO_VERTICALE`/`CORPO_SERBATOIO_ORIZZONTALE` in symbols/index.ts), non `2,82/1,31`
  // (quello è il rettangolo grezzo, con valvola e scarico compresi).
  const lato = (chiave: string, orientamento?: string) =>
    definizioneDi({ tipo: chiave, orientamento } as SchemaNodo).dimensioni
  const rombo = lato('essiccatore').larghezza

  it('il compressore è quadrato e largo 1,09 rombi (1,17 sul CAD, arrotondato alla griglia)', () => {
    const { larghezza, altezza } = lato('compressore')
    // 120/110 = 1,09, non più 1,17 esatto: il riquadro è sceso da 129 a 120 (Task 8, Blocco 3)
    // perché l'ancora (centro dell'orlo, `larghezza/2`) cadesse sulla griglia — vedi
    // `DIMENSIONI.compressore`. Il vincolo di progetto è restare entro il decimo del valore
    // CAD, non riprodurlo esatto: si verifica quello (uno `toBeCloseTo` a una cifra sola non
    // lo lascerebbe passare, lo scarto è del 7%).
    const rapportoCAD = 1.17
    expect(Math.abs(larghezza / rombo - rapportoCAD) / rapportoCAD).toBeLessThan(0.1)
    expect(larghezza).toBe(altezza)
  })

  it('il serbatoio orizzontale ha un ingombro suo, più largo che alto', () => {
    // Il riquadro non è il solo corpo (2,82×0,88 rombi, capsula isolata da valvola e scarico sul
    // CAD — vedi CORPO_SERBATOIO_ORIZZONTALE in symbols/index.ts): ci sale sopra
    // MARGINE_VALVOLA_SERBATOIO, lo spazio per la valvola e la sua sigla (una scelta di questo
    // editor, non una misura CAD — il CAD non ha bisogno di riservare spazio per un'etichetta
    // che nel blocco vive fuori dal riquadro, sulla pagina).
    //
    // `toBeCloseTo(larghezza/altezza, 1)` contro `larghezza`/`altezza` letti dallo stesso
    // registro sarebbe tautologico (fix round 1, revisione): il numero atteso e quello ottenuto
    // sarebbero la stessa costante scritta due volte, e nessuna mutazione della costante
    // potrebbe mai far cadere il test. Si sottrae invece il margine e si confronta il RESIDUO
    // — che per costruzione è il solo corpo (CORPO_SERBATOIO_ORIZZONTALE) — con la misura
    // indipendente sul CAD, 2,82/0,88: cade se il corpo (larghezza o altezza) non rispetta più
    // quel rapporto, a prescindere da quanto vale il margine.
    //
    // Il residuo è 3,1 (310/100), non più 2,82/0,88 = 3,2045 esatto: l'altezza del corpo è
    // scesa da 97 a 100 (Task 8, Blocco 3) perché l'ancora `sx`/`dx` (a metà altezza) cadesse
    // sulla griglia — vedi `CORPO_SERBATOIO_ORIZZONTALE`. Il vincolo di progetto è restare
    // entro il decimo del rapporto CAD (qui lo scarto è del 3,4%), non riprodurlo esatto: si
    // verifica quello, non un `toBeCloseTo` a una cifra che il vecchio rapporto imponeva.
    const o = lato('serbatoio', 'ORIZZONTALE')
    const v = lato('serbatoio', 'VERTICALE')
    expect(o).not.toEqual(v)
    expect(o.larghezza).toBeGreaterThan(o.altezza)
    const rapportoCAD = 2.82 / 0.88
    const rapportoEditor = o.larghezza / (o.altezza - MARGINE_VALVOLA_SERBATOIO)
    expect(Math.abs(rapportoEditor - rapportoCAD) / rapportoCAD).toBeLessThan(0.1)
  })

  it('la tanica è larga il doppio dell\'altezza', () => {
    const { larghezza, altezza } = lato('tanica')
    expect(larghezza / altezza).toBeCloseTo(2, 1)
  })

  it('il pacco bombole è quadrato', () => {
    const { larghezza, altezza } = lato('pacco_bombole')
    expect(larghezza).toBe(altezza)
  })

  // Fix round 1 (revisione del Task 4): sul riquadro quadrato più piccolo (129, prima 160) la
  // girante spostata a destra per il disoleatore sconfinava nel suo riquadro. Fix round 2: il
  // blocco CAD `compressore-disoleatore` ESISTE (indice 2 di `NOMI` in blocchi-cad.py — la
  // versione precedente di questo commento diceva il contrario, la stessa falsità corretta nel
  // commento gemello di `simboloCompressore`), ed è stato misurato: box del disoleatore
  // 21,30×26,70pt su un riquadro 53,40×53,34pt → 51,5×64,5 su un riquadro 129 (non il quadrato
  // 46×46 del giro precedente). Il franco fra girante e box che il CAD stesso lascia (1,26pt,
  // ~3 unità qui) è quello che tiene i due riquadri separati — non serve più scostare la girante
  // a mano.
  it('la girante e il riquadro del disoleatore non si sovrappongono', () => {
    const nodo = {
      id: 'C1', tipo: 'compressore' as const, etichetta: 'C1', gruppo: 'SALA_COMPRESSORI' as const,
      valvoleSicurezza: [], origine: 'scheda' as const,
      accessorio: { codice: 'C1.1', etichetta: 'disoleatore', valvoleSicurezza: [] },
    } as SchemaNodo
    const svg = simboloDi(nodo)

    const cerchio = svg.match(/<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"/)
    expect(cerchio).not.toBeNull()
    const [, cxStr, , rStr] = cerchio!
    const bordoSinistroGirante = Number(cxStr) - Number(rStr)

    // Il primo `<rect>` è il corpo (x="0"): il disoleatore è il successivo, con x diverso da 0.
    const rettangoli = [...svg.matchAll(/<rect x="([\d.]+)" y="[\d.]+" width="([\d.]+)" height="([\d.]+)"/g)]
    const disoleatore = rettangoli.find((m) => m[1] !== '0')
    expect(disoleatore).toBeDefined()
    const [, xStr, wStr, hStr] = disoleatore!
    const bordoDestroDisoleatore = Number(xStr) + Number(wStr)

    expect(bordoSinistroGirante).toBeGreaterThan(bordoDestroDisoleatore)

    // Il box è più alto che largo (21,30×26,70pt sul CAD, rapporto 0,80), non un quadrato: lo
    // stesso difetto di forma che aveva anche il pacco bombole (fix round 1) prima di essere
    // misurato sul blocco vero.
    expect(Number(wStr) / Number(hStr)).toBeCloseTo(21.3 / 26.7, 1)
  })
})

// Fix round 1 (revisione del Task 4): il describe sopra guarda solo `DIMENSIONI` (il riquadro
// dichiarato). Per tanica e pacco bombole il DISEGNO aveva un rientro/margine che il riquadro non
// mostrava — il test sul rapporto passava lo stesso, perché misurava il riquadro, non il
// rettangolo/le bombole effettivamente tracciati sul foglio. Qui si guarda l'SVG prodotto.
describe('il disegno rispetta le proporzioni misurate, non solo il riquadro dichiarato', () => {
  const nodo = (tipo: SchemaNodoTipo, id: string): SchemaNodo =>
    ({ id, tipo, etichetta: id, gruppo: 'ALTRO', valvoleSicurezza: [], origine: 'scheda' }) as SchemaNodo

  it('la tanica disegna il rettangolo esteso quanto il riquadro, non rientrato', () => {
    // Il blocco CAD `tanica` è un solo rettangolo 35,52×17,76pt (2:1 esatto): la cornice È il
    // blocco, non un rettangolo più piccolo dentro un riquadro più grande.
    const { larghezza, altezza } = definizioneDi({ tipo: 'tanica' }).dimensioni
    const svg = simboloDi(nodo('tanica', 'RC'))
    expect(svg).toContain(`<rect x="0" y="0" width="${larghezza}" height="${altezza}"`)
  })

  it('il pacco bombole affianca le quattro bombole a bordo pieno, cornice = riquadro', () => {
    // Il primo sotto-elemento del gruppo CAD `pacco-bombole` è un quadrato 53,40×53,40pt che
    // coincide col riquadro dell'intero blocco: niente margine, niente telaio più piccolo.
    const { larghezza, altezza } = definizioneDi({ tipo: 'pacco_bombole' }).dimensioni
    const svg = simboloDi(nodo('pacco_bombole', 'PB1'))
    expect(svg).toContain(`<rect x="0" y="0" width="${larghezza}" height="${altezza}"`)

    // Le quattro bombole affiancano a bordo pieno (passo = larghezza/4, senza margine da
    // sottrarre prima di dividere): la prima parte dal bordo sinistro del riquadro (x=0), la
    // quarta finisce sul bordo destro (x=larghezza).
    const passo = larghezza / 4
    expect(svg).toContain(`M 0 ${altezza} L 0 `)
    expect(svg).toContain(`M ${3 * passo} ${altezza} L ${3 * passo} `)

    // Rapporto larghezza:altezza di ciascuna bombola ≈ 1:4 (13,38pt su un blocco di 53,40pt),
    // non l'1:2,9 che usciva quando il passo sottraeva un margine che il CAD non ha.
    expect(passo / altezza).toBeCloseTo(13.38 / 53.4, 1)
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

  /**
   * Fix round 1 (revisione, Task 7): `utenze` è una `ChiaveSimbolo` valida come le altre, quindi
   * una taratura potrà coprirla. Con taratura, il ramo utenze di `ancoreDi` chiama `dimensioniDi`
   * per la propria altezza; se il ramo tarato di `dimensioniDi` richiamasse a sua volta
   * `ancoreDi(nodo, libreria)` (invece di leggere `taratura.ancore` direttamente) il giro si
   * chiuderebbe su se stesso — `RangeError: Maximum call stack size exceeded` alla prima
   * apertura del dialog su una pratica con 'utenze' tarato. Nessun altro test in questo file
   * combina «tipo utenze» e «chiave tarata»: senza questo, il ciclo passerebbe inosservato.
   */
  it('una taratura su "utenze" non entra in ricorsione fra ancoreDi e dimensioniDi', () => {
    const nodo = terminale('Utenze aria')
    const libreria: Tarature = {
      utenze: { dx: 0, dy: 0, sx: 1, sy: 1, ancore: [{ id: 'in', x: 12, y: 0, accetta: ['aria'] }] },
    }
    expect(() => ancoreDi(nodo, libreria)).not.toThrow()
    expect(() => dimensioniDi(nodo, libreria)).not.toThrow()
    // L'altezza resta un numero finito, non NaN o Infinity: il sintomo concreto di un giro che
    // in qualche runtime non esplodesse subito in uno stack overflow, ma producesse comunque
    // un dato inutilizzabile.
    expect(Number.isFinite(dimensioniDi(nodo, libreria).altezza)).toBe(true)
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
    // 4/10/16, non più 6/12/18: `UTENZE.x` è sceso a 10 (Task 8, Blocco 3, perché l'ancora
    // cadesse sulla griglia — vedi il suo commento in symbols/index.ts), e la punta segue.
    expect(svg).toContain('<path d="M 4 27 L 10 14 L 16 27 Z" fill="#000" />')
    expect(svg).not.toContain('marker-end')
  })

  it('dichiara una sola ancora, in basso al codolo, che accetta aria', () => {
    const def = definizioneDi(utenze)
    // x=10, non più 12 (Task 8, Blocco 3): vedi il commento su `UTENZE.x`, symbols/index.ts.
    expect(def.ancore).toEqual([{ id: 'in', x: 10, y: 120, accetta: ['aria'] }])
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
    // 10 è `UTENZE.x` (non più 12, Task 8, Blocco 3), l'ascissa del codolo: la costante non è
    // esportata, quindi il test la fissa come letterale — se cambia, questo test deve
    // accorgersene.
    expect(simboloUtenze(lungo)).toContain(`M 10 ${altezza}`)
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

  // Il riduttore non ha una copertura sua: costruisce sopra la valvola, quindi la eredita. Se un
  // giorno smettesse di farlo, questo test lo dice prima che lo dica il documento del cliente.
  it('il riduttore di pressione eredita la copertura della valvola', () => {
    expect(riduttorePressione(100, 50)).toContain('fill="#fff"')
  })
})

describe('copertura della valvola di intercettazione', () => {
  // Osservazione 6 del committente: «la linea attraversa la valvola invece di interrompersi».
  // Il rettangolo bianco va PRIMA dei tratti, o coprirebbe la farfalla invece del tubo, ed e'
  // esattamente grande quanto la farfalla: ogni unita' in piu' e' disegno altrui cancellato.
  it('la valvola di intercettazione copre il tubo con un rettangolo bianco, prima dei tratti', () => {
    const svg = valvolaIntercettazione(100, 50)
    expect(svg.indexOf('fill="#fff"')).toBeLessThan(svg.indexOf('<path'))
    expect(svg).toContain('<rect x="91" y="42" width="18" height="16" fill="#fff" stroke="none" />')
  })

  it('il rettangolo bianco ruota con la farfalla sul montante', () => {
    expect(valvolaIntercettazione(100, 50, 'verticale')).toContain(
      '<rect x="92" y="41" width="16" height="18" fill="#fff" stroke="none" />'
    )
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

describe('i tre rombi si distinguono per il segno interno', () => {
  const rombo = (tipo: 'essiccatore' | 'filtro' | 'separatore') =>
    definizioneDi({ tipo } as SchemaNodo).disegna(
      { id: 'X1', tipo, etichetta: '', gruppo: 'ALTRO', valvoleSicurezza: [], origine: 'scheda' } as SchemaNodo
    )

  // La firma della valvola di scarico: il vertice dove le due punte della farfalla si toccano,
  // seguito dall'inizio del secondo triangolo — letta chiamando DAVVERO `valvolaScarico`, nella
  // stessa posizione (50, 102) in cui `simboloRombo` la posa sotto un rombo 110×110 (essiccatore,
  // filtro e separatore condividono quell'ingombro). Non è una stringa immaginata: se la
  // geometria della farfalla cambiasse, questa costante smetterebbe di comparire nel disegno
  // vero e il test lo scoprirebbe da sé, invece di restare verde per una coincidenza.
  //
  // Fix round 1 (revisione, Task 8, Blocco 3): non più (55, 100) — quella era la posizione vera
  // solo prima del Task 8, quando `cx` del rombo era `larghezza/2` senza offset (55) e `cy +
  // semiH + 12` dava 49+39+12=100. Con gli offset nuovi (`cx=50`, `cy+semiH+12=50+40+12=102`) il
  // vecchio letterale era rimasto un test contro se stesso, non contro il disegno vero — la
  // stessa classe di difetto che il revisore ha trovato in `ANCORE_ROMBO` (verificato qui
  // renderizzando `simboloDi` su un essiccatore e cercando il pattern della farfalla nel
  // markup: la coppia di triangoli compare esattamente a (50, 102), non a (55, 100)).
  const FIRMA_VALVOLA_SCARICO = 'L 50 102 Z M 46.85 108.3'
  it('la firma è davvero prodotta da valvolaScarico', () => {
    expect(valvolaScarico(50, 102, 'apparecchio')).toContain(FIRMA_VALVOLA_SCARICO)
  })

  it("l'essiccatore ha due tratti orizzontali, non uno", () => {
    // Il pattern intercetta ogni segmento orizzontale del disegno, compresi gli attacchi ai
    // fianchi (larghi 10 unità) e le basi dei due triangoli della valvola di scarico (larghe
    // ~6 unità): un filtro sull'ampiezza (>20) tiene solo i segni interni del rombo, larghi
    // ~41 (due volte semiL per la frazione di larghezza del segno), senza dover conoscere le
    // coordinate esatte di attacchi e valvola.
    const orizzontali = [...rombo('essiccatore').matchAll(/M (\d+(?:\.\d+)?) (\d+(?:\.\d+)?) L (\d+(?:\.\d+)?) \2\b/g)]
      .filter((m) => Math.abs(Number(m[3]) - Number(m[1])) > 20)
    expect(orizzontali).toHaveLength(2)
  })

  it('il filtro ha una verticale tratteggiata', () => {
    expect(rombo('filtro')).toMatch(/stroke-dasharray="[^"]+"/)
  })

  it('il separatore ha un rettangolo interno e nessuna valvola a farfalla', () => {
    const svg = rombo('separatore')
    expect(svg).toContain('<rect')
    // La farfalla della valvola di scarico è due triangoli che si toccano sulla punta: la sua
    // firma è il tratto orizzontale accanto al vertice. Vedi `valvolaScarico`.
    expect(svg).not.toContain(FIRMA_VALVOLA_SCARICO)
  })
})

describe('simboloMuro', () => {
  // Le aperture sono larghe `larghezzaVarco = 44` e si fondono in una sola quando l'inizio della
  // prossima cade entro 20px dalla fine di quella già aperta (`symbols/index.ts`): due varchi a
  // 64px o meno di distanza (44 + 20) restano un'unica apertura. Il test conta i TRONCONI PIENI
  // di muratura (i `<rect>`, l'unico elemento che ne contiene), non le coordinate delle aperture:
  // con N aperture interne che non toccano gli estremi [yMin, yMax] i tronconi sono N+1 (uno
  // prima della prima, uno fra ogni coppia, uno dopo l'ultima) — un conteggio che non si rompe al
  // primo ritocco estetico della geometria del muro. Due casi, non uno: un solo caso non
  // distingue «fonde» da «non disegna il secondo varco» (che darebbe anch'esso un troncone in
  // meno del numero di varchi).
  it('due varchi vicini si fondono in un\'unica apertura: un troncone in meno dei varchi', () => {
    // y=100 e y=150 distano 50px, sotto la soglia di fusione (64) — si fondono in un'apertura
    // sola: 2 tronconi (prima e dopo), non 3.
    const svg = simboloMuro(0, 0, 300, [100, 150])
    expect([...svg.matchAll(/<rect/g)]).toHaveLength(2)
  })

  it('due varchi lontani restano due aperture distinte: un troncone in più della fusione', () => {
    // y=100 e y=220 distano 120px, sopra la soglia di fusione — è il caso che dà senso al primo:
    // 3 tronconi (prima, fra i due varchi, dopo), la controprova che senza distanza sufficiente
    // le aperture non si fondono da sole.
    const svg = simboloMuro(0, 0, 300, [100, 220])
    expect([...svg.matchAll(/<rect/g)]).toHaveLength(3)
  })
})

describe('la trasformazione della sagoma', () => {
  const t = { dx: -3, dy: 0, sx: 1.07, sy: 1, ancore: [] }

  it('avvolge la sagoma in un g con translate e scale', () => {
    expect(simboloTrasformato('<circle cx="10" cy="10" r="5" />', t))
      .toBe('<g transform="translate(-3 0) scale(1.07 1)"><circle cx="10" cy="10" r="5" /></g>')
  })

  it('la taratura neutra non aggiunge nulla', () => {
    // Senza questo, ogni simbolo non tarato guadagnerebbe un <g> inutile e TUTTI i
    // riferimenti SVG cambierebbero senza che sia cambiato niente.
    expect(simboloTrasformato('<circle />', TARATURA_NEUTRA)).toBe('<circle />')
  })

  it('contro-scala le scritte, che altrimenti si stirerebbero', () => {
    const svg = simboloTrasformato('<text x="10" y="10">S1</text>', { ...t, sx: 2, sy: 1 })
    // La scritta porta una scala inversa a quella del gruppo: 1/2 in orizzontale.
    expect(svg).toMatch(/<text[^>]*transform="[^"]*scale\(0\.5 1\)/)
  })

  it('ancora la contro-scala del testo multi-riga al primo tspan, non a (0,0)', () => {
    // testoMultiRiga produce un <text> SENZA x/y proprie (le porta il primo <tspan>, una per
    // riga: vedi testoMultiRiga in symbols/index.ts). Ancorare la contro-scala all'ancora di
    // default (0,0) sarebbe un errore silenzioso, non solo "meno preciso": (0,0) è un punto
    // fisso di qualunque scala, quindi lì scala diretta e inversa si annullerebbero ESATTAMENTE
    // sulla posizione, lasciando il blocco di testo fermo alla sola traslazione del gruppo,
    // senza seguirne la scala — il sintomo scoperto in revisione sul terminale utenze
    // (simboloUtenze), l'unico consumatore reale di testoMultiRiga.
    const svgOriginale = testoMultiRiga(50, 30, 'riga1\nriga2', 20, 'start')
    const svg = simboloTrasformato(svgOriginale, { ...t, sx: 2, sy: 1 })
    expect(svg).toMatch(/<text[^>]*transform="translate\(50 30\) scale\(0\.5 1\) translate\(-50 -30\)"/)
  })
})

describe("l'ingombro è l'inviluppo di sagoma trasformata e ancore", () => {
  it('cresce se un ancora sta fuori dal disegno', () => {
    const ancore = [{ id: 'alto', x: 75, y: -20, accetta: ['valvola_sicurezza' as const] }]
    const misure = inviluppo({ larghezza: 150, altezza: 260 }, TARATURA_NEUTRA, ancore)
    expect(misure.altezza).toBeGreaterThan(260)
  })

  it('segue la scala della sagoma', () => {
    const misure = inviluppo({ larghezza: 100, altezza: 100 }, { ...TARATURA_NEUTRA, sx: 2, sy: 1 }, [])
    expect(misure.larghezza).toBe(200)
  })
})
