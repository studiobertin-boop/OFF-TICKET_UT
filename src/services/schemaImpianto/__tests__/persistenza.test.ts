import { describe, it, expect } from 'vitest'
import { makeCompressore, makeDatiImpianto, makeEssiccatore, makeScheda, makeSeparatore, makeSerbatoio, makeValvola } from '@/services/relazione/__tests__/fixtures'
import { buildSchemaModel } from '../buildSchemaModel'
import { preferenzeRisolteDaScheda } from '../preferenze'
import { layoutSchema, muroDaAscissa, DIMENSIONI_NODO } from '../layout'
import { serializzaLayout, deserializzaLayout, riconcilia, layoutIniziale, layoutDaPersistere } from '../persistenza'
import type { LayoutSalvato } from '../persistenza'
import { dimensioniDi } from '../symbols'
import type { Tarature } from '../libreria'
import { risolviLibreria } from '../libreria'
import type { SchemaLayout, SchemaModel } from '../types'

function modelloDiProva(codiciCompressore: string[]) {
  const scheda = makeScheda({
    compressori: codiciCompressore.map((c) => makeCompressore({ codice: c, ha_disoleatore: false })),
    disoleatori: [], essiccatori: [], scambiatori: [], filtri: [],
    serbatoi: [makeSerbatoio()],
    dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
  })
  return buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { [codiciCompressore[0]]: ['S1'] } })
}

/** Come `modelloDiProva`, ma lascia scegliere marca/modello di C1 e la valvola di S1: serve a
 *  simulare una modifica in scheda fra un salvataggio e il successivo. */
function modelloConDatiVariabili(overridesCompressore: Partial<ReturnType<typeof makeCompressore>> = {}, overridesValvola: Partial<ReturnType<typeof makeValvola>> = {}) {
  const scheda = makeScheda({
    compressori: [makeCompressore({ codice: 'C1', ha_disoleatore: false, ...overridesCompressore })],
    disoleatori: [], essiccatori: [], scambiatori: [], filtri: [],
    serbatoi: [makeSerbatoio({ valvola_sicurezza: makeValvola(overridesValvola) })],
    dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
  })
  return buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })
}

/** Layout scritto a mano con apparecchiature in ENTRAMBI i gruppi: senza questo, un test sul
 *  muro passerebbe anche con la vecchia `calcolaMuro`, che su un solo gruppo restituiva già
 *  `null` — per la ragione sbagliata (vedi Step 1 del brief). */
function layoutMinimo(): SchemaLayout {
  return {
    nodi: [
      {
        id: 'C1', tipo: 'compressore', etichetta: 'Compressore', gruppo: 'SALA_COMPRESSORI',
        valvoleSicurezza: [], origine: 'scheda', x: 40, y: 200,
      },
      {
        id: 'E1', tipo: 'essiccatore', etichetta: 'Essiccatore', gruppo: 'LINEA_DISTRIBUZIONE',
        valvoleSicurezza: [], origine: 'scheda', x: 500, y: 200,
      },
    ],
    archi: [],
    muro: null,
    testi: [],
  }
}

/** Lo stesso modello di `layoutMinimo`, senza posizioni: la scheda che lo riconosce ancora. */
function modelloMinimo(): SchemaModel {
  return { nodi: layoutMinimo().nodi.map(({ x: _x, y: _y, ...n }) => n), archi: [] }
}

describe('serializzazione', () => {
  it('l’andata e ritorno conserva nodi, archi e posizioni', () => {
    const layout = layoutSchema(modelloDiProva(['C1']))
    const tornato = deserializzaLayout(serializzaLayout(layout))!

    expect(tornato.nodi).toEqual(layout.nodi)
    expect(tornato.archi).toEqual(layout.archi)
  })

  it('rifiuta un contenuto di versione sconosciuta', () => {
    expect(deserializzaLayout({ versione: 99, nodi: [], archi: [] } as never)).toBeNull()
  })

  it('rifiuta un contenuto nullo o assente', () => {
    expect(deserializzaLayout(null)).toBeNull()
    expect(deserializzaLayout(undefined)).toBeNull()
  })

  it('rifiuta un salvato con un tipo di nodo sconosciuto invece di rompersi più avanti', () => {
    // A monte Zod accetta il contenuto come z.any(): un tipo ritirato o una modifica manuale
    // del JSON arriverebbero fin qui. Senza il controllo, un tipo sconosciuto arriva intonso
    // a `definizioneDi`.
    const salvato = serializzaLayout(layoutSchema(modelloDiProva(['C1'])))
    salvato.nodi[0] = { ...salvato.nodi[0], tipo: 'tipo-inventato' as never }

    expect(deserializzaLayout(salvato)).toBeNull()
  })

  it('rifiuta un salvato con nodi o archi che non sono array', () => {
    expect(deserializzaLayout({ versione: 1, nodi: 'non un array', archi: [] } as never)).toBeNull()
    expect(deserializzaLayout({ versione: 1, nodi: [], archi: null } as never)).toBeNull()
  })

  // Dal Blocco D4 il muro e' un oggetto del committente: si salva la sua ascissa, e l'altezza si
  // ricava al disegno. Un salvataggio scritto prima non ha `muroX` e si riapre senza muro — che
  // e' cio' che il committente ha chiesto («di default non va disegnato»), non una perdita.
  it('salva del muro la sola ascissa', () => {
    const layout = { ...layoutMinimo(), muro: { x: 333, yMin: 10, yMax: 900 } }
    const salvato = serializzaLayout(layout)
    expect(salvato.muroX).toBe(333)
    // Case-insensitive: un campo tipo `muroYMin` non contiene la sottostringa 'yMin' esatta
    // (la Y è maiuscola), ma sarebbe comunque l'altezza a fuggire nel salvato.
    expect(JSON.stringify(salvato).toLowerCase()).not.toContain('ymin')
  })

  it('ricostruisce il muro dall ascissa salvata, con l altezza di adesso', () => {
    const salvato = { ...serializzaLayout(layoutMinimo()), muroX: 333 }
    const riletto = deserializzaLayout(salvato)
    expect(riletto.muro).toEqual(muroDaAscissa(333, salvato.nodi))
    expect(riletto.muro.x).toBe(333)
  })

  it('un salvataggio senza ascissa del muro si riapre senza muro', () => {
    expect(deserializzaLayout(serializzaLayout(layoutMinimo())).muro).toBeNull()
  })

  // Il muro e' manuale per definizione, quindi sta nella stessa categoria dei nodi 'manuale' e
  // delle annotazioni: la scheda dati non lo conosce e non ha titolo per cancellarlo.
  //
  // `riconcilia` riceve un `muro` (come fa `deserializzaLayout`), non un `muroX`: passargli un
  // `LayoutSalvato` grezzo costruito a mano proverebbe una forma di chiamata che la produzione
  // non usa (vedi revisione finale, rilievo Critico — il test su questo vive in `layoutIniziale`).
  it('la riconciliazione con la scheda non porta via il muro', () => {
    const salvato = { ...layoutMinimo(), muro: { x: 333, yMin: 10, yMax: 900 } }
    expect(riconcilia(salvato, modelloMinimo()).layout.muro!.x).toBe(333)
  })

  it('restituisce una copia difensiva: mutare il layout originale non tocca il salvato', () => {
    const layout = layoutSchema(modelloDiProva(['C1']))
    const salvato = serializzaLayout(layout)

    // Simula un trascinamento nell'editor: muta in place gli stessi oggetti restituiti da layoutSchema.
    layout.nodi[0].x = 999999
    layout.archi[0].stile = 'condensa'

    expect(salvato.nodi[0].x).not.toBe(999999)
    expect(salvato.archi[0].stile).not.toBe('condensa')
  })
})

describe('riconciliazione con la scheda', () => {
  it('aggiunge le apparecchiature comparse in scheda, senza spostare le altre', () => {
    const salvato = serializzaLayout(layoutSchema(modelloDiProva(['C1'])))
    const esito = riconcilia(salvato, modelloDiProva(['C1', 'C2']))

    expect(esito.aggiunti).toEqual(['C2'])
    expect(esito.layout.nodi.find((n) => n.id === 'C1')!.x).toBe(salvato.nodi.find((n) => n.id === 'C1')!.x)
    expect(esito.layout.nodi.find((n) => n.id === 'C1')!.y).toBe(salvato.nodi.find((n) => n.id === 'C1')!.y)
  })

  it('toglie i nodi di origine scheda spariti dalla scheda', () => {
    const salvato = serializzaLayout(layoutSchema(modelloDiProva(['C1', 'C2'])))
    const esito = riconcilia(salvato, modelloDiProva(['C1']))

    expect(esito.rimossi).toEqual(['C2'])
    expect(esito.layout.nodi.map((n) => n.id)).not.toContain('C2')
  })

  it('conserva sempre i nodi aggiunti a mano', () => {
    const salvato = serializzaLayout(layoutSchema(modelloDiProva(['C1'])))
    salvato.nodi.push({
      id: 'PB1', tipo: 'pacco_bombole', etichetta: 'Pacco bombole', gruppo: 'LINEA_DISTRIBUZIONE',
      valvoleSicurezza: [], origine: 'manuale', x: 900, y: 400,
    })

    const esito = riconcilia(salvato, modelloDiProva(['C1']))
    expect(esito.layout.nodi.map((n) => n.id)).toContain('PB1')
    expect(esito.rimossi).not.toContain('PB1')
  })

  it('scarta gli archi che puntano a un nodo non più presente', () => {
    const salvato = serializzaLayout(layoutSchema(modelloDiProva(['C1', 'C2'])))
    const esito = riconcilia(salvato, modelloDiProva(['C1']))
    const idNodi = new Set(esito.layout.nodi.map((n) => n.id))

    for (const arco of esito.layout.archi) {
      expect(idNodi.has(arco.da.nodo)).toBe(true)
      expect(idNodi.has(arco.a.nodo)).toBe(true)
    }
  })

  it('non scarta un arco nuovo solo perché rigenera per coincidenza l’id di un arco salvato non correlato', () => {
    // buildArchi numera gli archi con un contatore che riparte a ogni chiamata: il primo arco
    // di una scheda è sempre "flex-1", indipendentemente da quali nodi collega. Qui il
    // compressore connesso al serbatoio cambia da C1 a C2 fra il salvataggio e la
    // riconciliazione: l'arco salvato e quello nuovo hanno lo stesso id ma capi diversi, e
    // quello nuovo (che tocca l'apparecchiatura appena aggiunta C2) deve sopravvivere.
    const salvato = serializzaLayout(layoutSchema(modelloDiProva(['C1'])))
    expect(salvato.archi[0].id).toBe('flex-1')

    const esito = riconcilia(salvato, modelloDiProva(['C2', 'C1']))
    const arcoNuovo = esito.layout.archi.find((a) => a.da.nodo === 'C2' && a.a.nodo === 'S1')

    expect(esito.aggiunti).toContain('C2')
    expect(arcoNuovo).toBeDefined()
  })

  it('aggiorna marca/modello di un nodo di origine scheda già salvato, conservandone la posizione', () => {
    const salvato = serializzaLayout(layoutSchema(modelloConDatiVariabili({ marca: 'KAESER', modello: 'CSD 105 SFC' })))
    const posizioneSalvata = salvato.nodi.find((n) => n.id === 'C1')!

    const modelloAggiornato = modelloConDatiVariabili({ marca: 'ATLAS COPCO', modello: 'GA 90' })
    const esito = riconcilia(salvato, modelloAggiornato)
    const nodoRiconciliato = esito.layout.nodi.find((n) => n.id === 'C1')!

    expect(nodoRiconciliato.etichetta).toBe('Compressore ATLAS COPCO Mod. GA 90')
    expect(nodoRiconciliato.x).toBe(posizioneSalvata.x)
    expect(nodoRiconciliato.y).toBe(posizioneSalvata.y)
  })

  it('aggiorna le valvole di sicurezza di un nodo già salvato: cambia il disegno, non solo la tabella', () => {
    const salvato = serializzaLayout(layoutSchema(modelloConDatiVariabili({}, { modello: 'TA21', n_fabbrica: '484725/7' })))
    const posizioneSalvata = salvato.nodi.find((n) => n.id === 'S1')!

    const modelloAggiornato = modelloConDatiVariabili({}, { modello: 'TW3', n_fabbrica: '999999' })
    const esito = riconcilia(salvato, modelloAggiornato)
    const nodoRiconciliato = esito.layout.nodi.find((n) => n.id === 'S1')!

    expect(nodoRiconciliato.valvoleSicurezza.map((v) => v.etichetta)).toEqual(
      modelloAggiornato.nodi.find((n) => n.id === 'S1')!.valvoleSicurezza.map((v) => v.etichetta)
    )
    expect(nodoRiconciliato.x).toBe(posizioneSalvata.x)
    expect(nodoRiconciliato.y).toBe(posizioneSalvata.y)
  })

  it('riparte da zero quando il layout salvato è vuoto: tutti i nodi della scheda sono aggiunti', () => {
    const salvato = { versione: 1 as const, nodi: [], archi: [] }
    const modello = modelloDiProva(['C1', 'C2'])
    const esito = riconcilia(salvato, modello)

    expect(esito.aggiunti.sort()).toEqual(modello.nodi.map((n) => n.id).sort())
    expect(esito.rimossi).toEqual([])
    expect(esito.layout.nodi).toHaveLength(modello.nodi.length)
  })
})

describe('layoutIniziale', () => {
  it('scarta un salvato di versione sconosciuta e riparte dall’auto-layout, non dalla posizione salvata', () => {
    // Il punto di questo test è discriminare fra "il controllo di versione c'è" e "non c'è":
    // una posizione lontanissima da qualsiasi output plausibile di layoutSchema (4000,4000) non
    // deve sopravvivere quando la versione è sconosciuta.
    const modello = modelloDiProva(['C1'])
    const salvato = {
      versione: 99 as unknown as 1,
      nodi: [{ ...layoutSchema(modello).nodi[0], x: 4000, y: 4000 }],
      archi: [],
    }

    const esito = layoutIniziale(salvato, modello)
    const automatico = layoutSchema(modello)

    expect(esito.layout.nodi.find((n) => n.id === 'C1')!.x).toBe(
      automatico.nodi.find((n) => n.id === 'C1')!.x
    )
    expect(esito.layout.nodi.find((n) => n.id === 'C1')!.y).toBe(
      automatico.nodi.find((n) => n.id === 'C1')!.y
    )
    expect(esito.aggiunti).toEqual([])
    expect(esito.rimossi).toEqual([])
  })

  it('scarta un salvato con un tipo di nodo sconosciuto e riparte dall’auto-layout', () => {
    const modello = modelloDiProva(['C1'])
    const salvato = serializzaLayout(layoutSchema(modello))
    salvato.nodi[0] = { ...salvato.nodi[0], tipo: 'tipo-inventato' as never, x: 4000, y: 4000 }

    const esito = layoutIniziale(salvato, modello)
    const automatico = layoutSchema(modello)

    expect(esito.layout.nodi.find((n) => n.id === 'C1')!.x).toBe(
      automatico.nodi.find((n) => n.id === 'C1')!.x
    )
    expect(esito.aggiunti).toEqual([])
    expect(esito.rimossi).toEqual([])
  })

  it('senza layout salvato riparte dall’auto-layout', () => {
    const modello = modelloDiProva(['C1', 'C2'])

    for (const assente of [null, undefined] as const) {
      const esito = layoutIniziale(assente, modello)
      expect(esito.layout.nodi.map((n) => n.id).sort()).toEqual(
        modello.nodi.map((n) => n.id).sort()
      )
      expect(esito.aggiunti).toEqual([])
      expect(esito.rimossi).toEqual([])
    }
  })

  it('con un layout salvato valido, l’esito è quello della riconciliazione', () => {
    const salvato = serializzaLayout(layoutSchema(modelloDiProva(['C1'])))
    const modello = modelloDiProva(['C1', 'C2'])

    const esito = layoutIniziale(salvato, modello)
    const atteso = riconcilia(salvato, modello)

    expect(esito).toEqual(atteso)
  })

  // Revisione finale, rilievo Critico: `layoutIniziale` passa a `riconcilia` ciò che
  // restituisce `deserializzaLayout` — un `SchemaLayout`, che porta `muro`, non `muroX`. Un
  // test che chiama `riconcilia` direttamente con un `LayoutSalvato` costruito a mano (come
  // faceva questo prima della revisione) non attraversa mai `deserializzaLayout`, quindi non
  // vede la porta che la produzione usa davvero: da qui il test va su `layoutIniziale`.
  it('un muro salvato torna a esistere alla riapertura, non solo scritto nel salvataggio', () => {
    const layout = { ...layoutMinimo(), muro: { x: 333, yMin: 10, yMax: 900 } }
    const salvato = serializzaLayout(layout)

    const esito = layoutIniziale(salvato, modelloMinimo())

    expect(esito.layout.muro).not.toBeNull()
    expect(esito.layout.muro!.x).toBe(333)
  })

  // Il giro che si chiude davvero a ogni conferma in produzione: `layoutDaPersistere` scrive
  // ciò che l'editor tiene in memoria, `layoutIniziale` lo rilegge alla riapertura successiva.
  // Insieme, non uno alla volta: muro, nodi, archi e testi devono sopravvivere tutti alla
  // stessa transazione.
  it('layoutIniziale(layoutDaPersistere(...)) conserva insieme muro, nodi, archi e testi', () => {
    const modello = modelloDiProva(['C1'])
    const base = layoutSchema(modello)
    const testo = { id: 'T1', x: 50, y: 60, contenuto: 'Nota' }
    const layout = { ...base, muro: { x: 333, yMin: 10, yMax: 900 }, testi: [testo] }

    const salvato = layoutDaPersistere(layout, true, undefined)
    const esito = layoutIniziale(salvato, modello)

    expect(esito.layout.muro).toEqual(muroDaAscissa(333, esito.layout.nodi))
    expect(esito.layout.muro!.x).toBe(333)
    expect(esito.layout.nodi.map((n) => n.id).sort()).toEqual(layout.nodi.map((n) => n.id).sort())
    for (const n of layout.nodi) {
      const trovato = esito.layout.nodi.find((m) => m.id === n.id)!
      expect(trovato.x).toBe(n.x)
      expect(trovato.y).toBe(n.y)
    }
    expect(esito.layout.archi).toEqual(layout.archi)
    expect(esito.layout.testi).toEqual([testo])
  })
})

describe('layoutDaPersistere', () => {
  const salvato = serializzaLayout(layoutSchema(modelloDiProva(['C1'])))

  it('con un layout in memoria, persiste quello: è il caso normale', () => {
    const layout = layoutSchema(modelloDiProva(['C1', 'C2']))
    expect(layoutDaPersistere(layout, false, salvato)).toEqual(serializzaLayout(layout))
    expect(layoutDaPersistere(layout, true, salvato)).toEqual(serializzaLayout(layout))
  })

  it('senza layout in memoria ma senza che questa sessione l’abbia mai ricalcolato, ripiega sul salvato: il rendering può essere fallito, non ancora partito, o non ancora finito', () => {
    expect(layoutDaPersistere(null, false, salvato)).toEqual(salvato)
  })

  it('senza layout in memoria e con questa sessione che lo ha ricalcolato a `null`, non ripiega: è una scelta deliberata (disegno caricato, o «Rimuovi»)', () => {
    expect(layoutDaPersistere(null, true, salvato)).toBeUndefined()
  })

  it('senza un salvato da cui ripiegare, resta undefined', () => {
    expect(layoutDaPersistere(null, false, null)).toBeUndefined()
    expect(layoutDaPersistere(null, false, undefined)).toBeUndefined()
  })
})

describe('terminale utenze nei layout salvati prima che esistesse', () => {
  /** Un layout salvato «vecchio»: quello che il motore produce oggi, meno il terminale. */
  function salvatoSenzaUtenze(modello: ReturnType<typeof modelloDiProva>) {
    const layout = layoutSchema(modello)
    return {
      nodi: layout.nodi.filter((n) => n.tipo !== 'utenze'),
      archi: layout.archi.filter((a) => a.a.nodo !== 'UTENZE'),
    }
  }

  it('lo aggiunge, con la sua tubazione', () => {
    const modello = modelloDiProva(['C1'])
    const esito = riconcilia(salvatoSenzaUtenze(modello), modello)

    expect(esito.aggiunti).toContain('UTENZE')
    expect(esito.layout.nodi.some((n) => n.tipo === 'utenze')).toBe(true)
    expect(esito.layout.archi.some((a) => a.a.nodo === 'UTENZE')).toBe(true)
  })

  // «Aggiunte dalla scheda: UTENZE» è falso su entrambi i fronti — il terminale non è
  // un'apparecchiatura (per questo resta fuori dalla lista e non conta per il muro) e non viene
  // dalla scheda — e capiterebbe una volta su ogni pratica già salvata.
  it('non lo annuncia all’utente fra le apparecchiature arrivate dalla scheda', () => {
    const modello = modelloDiProva(['C1'])
    const esito = riconcilia(salvatoSenzaUtenze(modello), modello)

    // Resta fra gli `aggiunti`, che è l'elenco vero dei nodi collocati dalla riconciliazione…
    expect(esito.aggiunti).toContain('UTENZE')
    // …ma non fra quelli di cui vale la pena avvisare.
    expect(esito.aggiuntiDaScheda).toEqual([])
  })

  it('annuncia però le apparecchiature vere comparse insieme a lui', () => {
    // Discrimina un `aggiuntiDaScheda` sempre vuoto: qui la scheda ha davvero un compressore in
    // più, e quello all'utente va detto.
    const salvato = salvatoSenzaUtenze(modelloDiProva(['C1']))
    const esito = riconcilia(salvato, modelloDiProva(['C1', 'C2']))

    expect(esito.aggiunti.sort()).toEqual(['C2', 'UTENZE'])
    expect(esito.aggiuntiDaScheda).toEqual(['C2'])
  })

  it('lo mette dove cadeva la freccia automatica, non in fondo alla tela', () => {
    const modello = modelloDiProva(['C1'])
    const salvato = salvatoSenzaUtenze(modello)
    const esito = riconcilia(salvato, modello)
    const utenze = esito.layout.nodi.find((n) => n.tipo === 'utenze')!

    // La regola della vecchia `renderUscitaUtenze`: a destra del nodo più a destra escluso il
    // pozzo condense, con l'ancora alla quota del suo centro. Qui `raccolta_condense: 'Nessuna'`
    // (vedi `modelloDiProva`), quindi non c'è pozzo da escludere: l'unico candidato oltre al
    // compressore è S1.
    const ultimo = salvato.nodi
      .filter((n) => n.tipo !== 'compressore' && n.tipo !== 'tanica')
      .reduce((a, b) => (a.x > b.x ? a : b))
    const dimUltimo = DIMENSIONI_NODO[ultimo.tipo]

    expect(utenze.x).toBe(ultimo.x + dimUltimo.larghezza + 50)
    // L'ancora `in` sta in fondo al riquadro: la sua altezza effettiva (`dimensioniDi`), non
    // quella fissa del registro — coincidono qui perché l'etichetta è a riga singola, ma
    // l'invariante vera è quella, non `DIMENSIONI_NODO.utenze.altezza` (vedi il test sotto che
    // la discrimina davvero con un'etichetta su molte righe).
    expect(utenze.y + dimensioniDi(utenze).altezza).toBe(ultimo.y + dimUltimo.altezza / 2)

    // Il ripiego generico l'avrebbe buttato sotto tutto il disegno (y = piede + 320 = 540, con
    // questa fixture): qui il terminale sta a y = 120, ben al di sotto della soglia, quindi il
    // confronto discrimina davvero fra le due strade e non è un caso di numeri vicini.
    const piede = Math.max(...salvato.nodi.map((n) => n.y))
    expect(utenze.y).toBeLessThan(piede + 320)
  })

  it('lo mette alla quota della fascia anche con un’etichetta su molte righe', () => {
    // Stessa ragione del test analogo in `layout.test.ts`: sotto le 6 righe l'altezza necessaria
    // (vedi `dimensioniDi`) non supera il minimo del registro (120), il riquadro non
    // crescerebbe affatto e il test non discriminerebbe dal caso a riga singola sopra.
    const modello = modelloDiProva(['C1'])
    modello.nodi.find((n) => n.tipo === 'utenze')!.etichetta = Array.from(
      { length: 8 },
      (_, i) => `riga ${i}`
    ).join('\n')
    const salvato = salvatoSenzaUtenze(modello)
    const esito = riconcilia(salvato, modello)
    const utenze = esito.layout.nodi.find((n) => n.tipo === 'utenze')!

    const ultimo = salvato.nodi
      .filter((n) => n.tipo !== 'compressore' && n.tipo !== 'tanica')
      .reduce((a, b) => (a.x > b.x ? a : b))
    const dimUltimo = DIMENSIONI_NODO[ultimo.tipo]

    // Stessa ancora del test sopra, ma qui il riquadro è davvero cresciuto oltre il minimo:
    // con l'altezza fissa del registro questo confronto cadrebbe.
    expect(utenze.y + dimensioniDi(utenze).altezza).toBe(ultimo.y + dimUltimo.altezza / 2)
  })

  it('esclude dal calcolo il pozzo di raccolta condense anche quando è un separatore, non solo quando è una tanica', () => {
    // Il pozzo di raccolta condense non è sempre una tanica: quando la scheda dichiara
    // `raccolta_condense: 'separatore'` è un separatore a farne le veci, e sta comunque nella
    // corsia bassa in basso a destra (vedi `layoutSchema`) — abbastanza a destra da rischiare
    // di risultare il nodo più a destra in assoluto. Un filtro che esclude solo `tipo ===
    // 'tanica'` (il difetto del brief originale) lo lascerebbe fra i candidati, e il terminale
    // finirebbe posizionato rispetto al pozzo invece che rispetto a S1, l'unico vero stadio
    // della linea.
    const scheda = makeScheda({
      compressori: [makeCompressore({ codice: 'C1', ha_disoleatore: false })],
      disoleatori: [], essiccatori: [], scambiatori: [], filtri: [],
      serbatoi: [makeSerbatoio()],
      separatori: [makeSeparatore()],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'separatore' }),
    })
    const modello = buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })
    const salvato = salvatoSenzaUtenze(modello)
    const esito = riconcilia(salvato, modello)
    const utenze = esito.layout.nodi.find((n) => n.tipo === 'utenze')!

    const s1 = salvato.nodi.find((n) => n.id === 'S1')!
    const dimS1 = DIMENSIONI_NODO.serbatoio
    // Atteso: posizionato rispetto a S1 (x=340, y=110 con questa fixture) → x=540, y=120.
    expect(utenze.x).toBe(s1.x + dimS1.larghezza + 50)
    expect(utenze.y + dimensioniDi(utenze).altezza).toBe(s1.y + dimS1.altezza / 2)

    // Col difetto del brief il terminale finirebbe invece rispetto a SEP1 (x=550, y=435, dim
    // 110×110): x=710, y=370. Ben diverso dal valore atteso, così se il difetto tornasse il
    // test lo scoprirebbe subito.
    const sep1 = salvato.nodi.find((n) => n.id === 'SEP1')!
    const dimSep1 = DIMENSIONI_NODO.separatore
    expect(utenze.x).not.toBe(sep1.x + dimSep1.larghezza + 50)
  })

  // Fix round 1 (revisione del Task 4): `posizioneTerminale` leggeva `DIMENSIONI_NODO[ultimo.tipo]`,
  // che per 'serbatoio' è sempre l'ingombro del verticale (103×298) — innocuo finché i due
  // orientamenti condividevano lo stesso ingombro, un bug vero ora che l'orizzontale ne ha uno
  // proprio (310×137). Col difetto il terminale finirebbe posizionato come se il serbatoio fosse
  // largo 103, cioè dentro il suo stesso riquadro (che è largo 310).
  it('lo mette a destra del vero bordo del serbatoio orizzontale, non di quello del verticale', () => {
    const scheda = makeScheda({
      compressori: [makeCompressore({ codice: 'C1', ha_disoleatore: false })],
      disoleatori: [], essiccatori: [], scambiatori: [], filtri: [],
      serbatoi: [makeSerbatoio({ orientamento: 'ORIZZONTALE' })],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
    })
    const modello = buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })
    const salvato = salvatoSenzaUtenze(modello)
    const esito = riconcilia(salvato, modello)
    const utenze = esito.layout.nodi.find((n) => n.tipo === 'utenze')!

    const s1 = salvato.nodi.find((n) => n.id === 'S1')!
    const dimVeraS1 = dimensioniDi(s1)
    expect(dimVeraS1.larghezza).toBe(310)
    expect(utenze.x).toBe(s1.x + dimVeraS1.larghezza + 50)

    // Col difetto (larghezza del verticale, 103) il terminale finirebbe a x = s1.x + 103 + 50,
    // ben dentro il riquadro vero del serbatoio (che arriva a s1.x + 310): la differenza fra i
    // due bordi è 207 unità, non un errore di arrotondamento.
    expect(utenze.x).not.toBe(s1.x + 103 + 50)
  })

  it('non lo duplica se il layout salvato ce l’ha già, e non ne sposta la posizione', () => {
    const modello = modelloDiProva(['C1'])
    const salvato = { ...salvatoSenzaUtenze(modello) }
    salvato.nodi = [
      ...salvato.nodi,
      {
        id: 'UTENZE',
        tipo: 'utenze',
        etichetta: 'Utenze azoto',
        gruppo: 'LINEA_DISTRIBUZIONE',
        valvoleSicurezza: [],
        origine: 'scheda',
        x: 1234,
        y: 56,
      },
    ]
    const esito = riconcilia(salvato, modello)
    const utenze = esito.layout.nodi.filter((n) => n.tipo === 'utenze')

    expect(utenze).toHaveLength(1)
    expect(utenze[0].x).toBe(1234)
    expect(utenze[0].y).toBe(56)
    expect(esito.aggiunti).not.toContain('UTENZE')
  })

  it('la scritta scelta dall’utente sopravvive alla riapertura', () => {
    // Il terminale è di origine 'scheda', quindi la riconciliazione riscriverebbe i suoi campi
    // dal modello: l'etichetta però è l'unica cosa che l'utente può cambiare, e perderla a ogni
    // riapertura renderebbe inutile poterla cambiare.
    const modello = modelloDiProva(['C1'])
    const salvato = { ...salvatoSenzaUtenze(modello) }
    salvato.nodi = [
      ...salvato.nodi,
      {
        id: 'UTENZE',
        tipo: 'utenze',
        etichetta: 'Utenze azoto',
        gruppo: 'LINEA_DISTRIBUZIONE',
        valvoleSicurezza: [],
        origine: 'scheda',
        x: 900,
        y: 100,
      },
    ]

    const esito = riconcilia(salvato, modello)
    expect(esito.layout.nodi.find((n) => n.tipo === 'utenze')!.etichetta).toBe('Utenze azoto')
  })
})

/**
 * Finché la freccia verso le utenze si ridisegnava a ogni render dal nodo più a destra, era
 * autocorrettiva. Ora è un arco salvato, e correggere la scheda dopo aver già salvato il
 * disegno — un gesto del tutto normale — la mandava in stallo in due modi opposti.
 */
describe('la tubazione del terminale quando cambia la coda della catena', () => {
  function modelloConCatena(conEssiccatore: boolean) {
    const scheda = makeScheda({
      compressori: [makeCompressore({ codice: 'C1', ha_disoleatore: false })],
      disoleatori: [], scambiatori: [], filtri: [],
      essiccatori: conEssiccatore ? [makeEssiccatore({ ha_scambiatore: false })] : [],
      serbatoi: [makeSerbatoio()],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
    })
    return buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })
  }

  /** Le tubazioni che arrivano sul codolo del terminale: dev'essere sempre esattamente una. */
  function entrantiAlTerminale(esito: ReturnType<typeof riconcilia>) {
    return esito.layout.archi.filter((a) => a.a.nodo === 'UTENZE')
  }

  it('non ne nasce una seconda quando si aggiunge uno stadio alla catena', () => {
    // Salvato con S1 → UTENZE; poi in scheda compare un essiccatore, e il modello propone
    // E1 → UTENZE. L'arco salvato sopravvive (entrambi i capi esistono ancora): senza la
    // regola dedicata si aggiungeva anche quello nuovo, perché E1 è fra gli `aggiunti`, e
    // due tubazioni convergevano sul codolo.
    const salvato = layoutSchema(modelloConCatena(false))
    const esito = riconcilia(salvato, modelloConCatena(true))

    expect(entrantiAlTerminale(esito)).toHaveLength(1)
    expect(esito.layout.nodi.some((n) => n.id === 'E1')).toBe(true)
  })

  it('il terminale non resta scollegato quando si toglie l’ultimo stadio', () => {
    // Salvato con E1 → UTENZE; poi l'essiccatore sparisce dalla scheda. L'arco salvato cade
    // insieme al nodo, e quello nuovo (S1 → UTENZE) non entrava fra gli `archiNuovi` perché
    // nessun capo era fra gli `aggiunti` — non c'era nessun aggiunto: il terminale restava a
    // mezz'aria, simbolo senza tubo.
    const salvato = layoutSchema(modelloConCatena(true))
    const esito = riconcilia(salvato, modelloConCatena(false))

    const entranti = entrantiAlTerminale(esito)
    expect(entranti).toHaveLength(1)
    expect(entranti[0].da.nodo).toBe('S1')
  })

  it('non ridisegna la tubazione che l’utente ha già tracciato al terminale', () => {
    // Il terminale è diventato un elemento anche per poterne tracciare a mano il tubo:
    // scartare l'arco salvato per riprendere quello del modello a ogni riapertura
    // contraddirebbe il principio che il layout salvato è autorevole su *dove* passano le
    // cose. La regola ripara il caso «scollegato», non sostituisce il lavoro manuale.
    const salvato = layoutSchema(modelloConCatena(false))
    const suoArco = salvato.archi.find((a) => a.a.nodo === 'UTENZE')!
    suoArco.punti = [{ x: 777, y: 333 }]

    const esito = riconcilia(salvato, modelloConCatena(false))
    const entranti = entrantiAlTerminale(esito)

    expect(entranti).toHaveLength(1)
    expect(entranti[0].punti).toEqual([{ x: 777, y: 333 }])
  })
})

describe('testi liberi', () => {
  const testo = { id: 'T1', x: 100, y: 200, contenuto: 'Linea azoto\nal reparto 2' }

  it('si salvano e si rileggono', () => {
    const layout = { nodi: [], archi: [], muro: null, testi: [testo] }
    const salvato = serializzaLayout(layout)
    expect(salvato.testi).toEqual([testo])
    expect(deserializzaLayout(salvato)!.testi).toEqual([testo])
  })

  it('il salvataggio è un’istantanea: modificare il layout dopo non tocca il salvato', () => {
    const layout = { nodi: [], archi: [], muro: null, testi: [{ ...testo }] }
    const salvato = serializzaLayout(layout)
    layout.testi![0].contenuto = 'cambiato'
    expect(salvato.testi![0].contenuto).toBe('Linea azoto\nal reparto 2')
  })

  it('un layout salvato prima di questo blocco si rilegge senza testi, non in errore', () => {
    const vecchio = { versione: 1, nodi: [], archi: [] }
    expect(deserializzaLayout(vecchio)!.testi).toEqual([])
  })

  it('sopravvivono alla riconciliazione con la scheda, come i nodi aggiunti a mano', () => {
    const modello = { nodi: [], archi: [] }
    const esito = riconcilia({ nodi: [], archi: [], testi: [testo] }, modello)
    expect(esito.layout.testi).toEqual([testo])
  })
})

describe('taratura di pratica e riattacco degli archi orfani', () => {
  /**
   * Apre come apre la produzione: la libreria si risolve nel CHIAMANTE e arriva già fusa a
   * `layoutIniziale`, che non rilegge `salvato.simboli` da sé (revisione finale, rilievo
   * Importante — il punto di fusione è uno solo, ed è `SchemaImpiantoSection.tsx`). Passare qui
   * il solo salvato, come facevano questi test prima, provava una strada che nessuno percorre.
   */
  function apri(salvato: LayoutSalvato, modello: SchemaModel, permanenti: Tarature = {}) {
    return layoutIniziale(salvato, modello, risolviLibreria(permanenti, salvato.simboli ?? {}))
  }

  /** Modello minimo con un compressore e una tanica, collegati: basta a isolare il
   *  comportamento sull'ancora della tanica, senza portarsi dietro l'intero motore di scheda. */
  function modelloDiRiferimento(): SchemaModel {
    return {
      nodi: [
        {
          id: 'C1', tipo: 'compressore', etichetta: 'Compressore', gruppo: 'SALA_COMPRESSORI',
          valvoleSicurezza: [], origine: 'scheda',
        },
        {
          id: 'T1', tipo: 'tanica', etichetta: 'Raccolta condense', gruppo: 'LINEA_DISTRIBUZIONE',
          valvoleSicurezza: [], origine: 'scheda',
        },
      ],
      archi: [],
    }
  }

  /** Layout salvato con un solo arco C1→T1: il capo su C1 sta su un'ancora vera del registro
   *  (così il test isola il comportamento all'ancora "sparita" sulla tanica), il capo su T1 su
   *  `ancoraTanica`, quella che il test vuole rendere orfana con una taratura. */
  function layoutConArcoVersoTanica(ancoraTanica: string, stile: SchemaLayout['archi'][number]['stile'] = 'standard'): LayoutSalvato {
    return {
      versione: 1,
      nodi: [
        {
          id: 'C1', tipo: 'compressore', etichetta: 'Compressore', gruppo: 'SALA_COMPRESSORI',
          valvoleSicurezza: [], origine: 'scheda', x: 40, y: 200,
        },
        {
          id: 'T1', tipo: 'tanica', etichetta: 'Raccolta condense', gruppo: 'LINEA_DISTRIBUZIONE',
          valvoleSicurezza: [], origine: 'scheda', x: 500, y: 500,
        },
      ],
      archi: [{ id: 'A1', da: { nodo: 'C1', ancora: 'alto-out' }, a: { nodo: 'T1', ancora: ancoraTanica }, stile }],
    }
  }

  it('un arco che cita un’ancora sparita si riattacca alla compatibile più vicina', () => {
    const salvato: LayoutSalvato = {
      ...layoutConArcoVersoTanica('sx'),
      // Taratura di pratica: sulla tanica di QUESTA pratica 'sx' non c'è più (il committente
      // l'ha tolta dal modo taratura), ma resta un'altra ancora che accetta ancora aria.
      simboli: { tanica: { dx: 0, dy: 0, sx: 1, sy: 1, ancore: [{ id: 'ingresso', x: 60, y: 20, accetta: ['aria'] }] } },
    }

    const { layout } = apri(salvato, modelloDiRiferimento())
    const arco = layout.archi.find((a) => a.id === 'A1')!

    expect(arco.a.ancora).not.toBe('sx')
    expect(arco.a.ancora).toBe('ingresso') // l'unica compatibile disponibile
  })

  it('non si riattacca a un’ancora che accetta un altro fluido', () => {
    // Un tubo d'aria (stile 'standard') non deve finire sull'ancora della condensa solo
    // perché è la più vicina — anzi l'unica rimasta.
    const salvato: LayoutSalvato = {
      ...layoutConArcoVersoTanica('sx'),
      simboli: { tanica: { dx: 0, dy: 0, sx: 1, sy: 1, ancore: [{ id: 'alto-in', x: 40, y: 0, accetta: ['condensa'] }] } },
    }

    const { layout } = apri(salvato, modelloDiRiferimento())

    // Nessuna ancora compatibile su T1: `riconcilia` tratta il capo come tratta oggi un
    // riferimento a un NODO sparito (vedi il filtro su `idNodi` in riconcilia) — l'arco intero
    // si scarta, non resta un capo a metà puntato su un id inesistente.
    expect(layout.archi.some((a) => a.id === 'A1')).toBe(false)
  })

  it('l’arco scartato viene contato, non fatto sparire in silenzio', () => {
    // Stesso caso del test qui sopra visto dall'altra parte: sparire è giusto, sparire senza
    // dirlo no. Una taratura permanente che cambi `accetta` fa cadere tubi da OGNI pratica
    // riaperta, e finora nessuno se ne accorgeva se non guardando il disegno (revisione finale,
    // rilievo Importante).
    const salvato: LayoutSalvato = {
      ...layoutConArcoVersoTanica('sx'),
      simboli: { tanica: { dx: 0, dy: 0, sx: 1, sy: 1, ancore: [{ id: 'alto-in', x: 40, y: 0, accetta: ['condensa'] }] } },
    }

    expect(apri(salvato, modelloDiRiferimento()).archiScartati).toBe(1)
  })

  it('non conta come scartato un arco che si è solo riattaccato altrove', () => {
    // La distinzione che rende utile l'avviso: qui l'ancora citata non c'è più, ma il tubo ha
    // trovato dove riattaccarsi e resta disegnato. Contarlo direbbe all'utente di ritracciare una
    // tubazione che è ancora lì.
    const salvato: LayoutSalvato = {
      ...layoutConArcoVersoTanica('sx'),
      simboli: { tanica: { dx: 0, dy: 0, sx: 1, sy: 1, ancore: [{ id: 'ingresso', x: 60, y: 20, accetta: ['aria'] }] } },
    }

    const esito = apri(salvato, modelloDiRiferimento())

    expect(esito.layout.archi.some((a) => a.id === 'A1')).toBe(true)
    expect(esito.archiScartati).toBe(0)
  })

  it('non conta come scartato un arco caduto insieme al suo nodo, che `rimossi` racconta già', () => {
    // Il compressore sparisce dalla scheda: l'arco C1→T1 cade col nodo, e `rimossi` lo dice già
    // nominando C1. Contarlo anche qui sarebbe lo stesso fatto annunciato due volte, la seconda
    // con una causa sbagliata («nessun attacco accetta più quel fluido»).
    const salvato = layoutConArcoVersoTanica('sx')
    const senzaCompressore: SchemaModel = {
      nodi: modelloDiRiferimento().nodi.filter((n) => n.id !== 'C1'),
      archi: [],
    }

    const esito = apri(salvato, senzaCompressore)

    expect(esito.rimossi).toContain('C1')
    expect(esito.archiScartati).toBe(0)
  })

  it('non basta che l’id dell’ancora sia rimasto: se non accetta più lo stile dell’arco si tratta come sparita', () => {
    // Il modo taratura (task successivi) può riassegnare un id esistente a un altro fluido
    // SENZA toglierlo: 'sx' c'è ancora nella definizione corrente, ma ora accetta condensa. Un
    // arco standard (aria) che citava 'sx' non deve restarci solo perché l'id combacia.
    const salvato: LayoutSalvato = {
      ...layoutConArcoVersoTanica('sx'),
      simboli: {
        tanica: {
          dx: 0, dy: 0, sx: 1, sy: 1,
          ancore: [
            { id: 'sx', x: 40, y: 0, accetta: ['condensa'] },
            { id: 'ingresso', x: 60, y: 20, accetta: ['aria'] },
          ],
        },
      },
    }

    const { layout } = apri(salvato, modelloDiRiferimento())
    const arco = layout.archi.find((a) => a.id === 'A1')!

    // Non è sparito (l'id 'sx' c'è), ma non è più giusto per lui: deve spostarsi sulla
    // candidata che accetta ancora aria, non restare fermo perché "un'ancora chiamata sx c'è".
    expect(arco.a.ancora).toBe('ingresso')
  })

  it('fra più ancore compatibili sceglie davvero la più vicina, non la prima della lista', () => {
    // C1 (compressore, 120×120) sta a (40,200): il suo centro, il riferimento di distanza per
    // il capo che si riattacca sulla tanica, è (100,260). 'lontana' è elencata per PRIMA ma è
    // la più distante da quel centro: se la scelta prendesse la prima candidata invece di
    // confrontare le distanze, il test la sceglierebbe e cadrebbe.
    const salvato: LayoutSalvato = {
      ...layoutConArcoVersoTanica('sx'),
      simboli: {
        tanica: {
          dx: 0, dy: 0, sx: 1, sy: 1,
          ancore: [
            { id: 'lontana', x: 60, y: 20, accetta: ['aria'] }, // assoluta (560,520)
            { id: 'vicina', x: -350, y: -350, accetta: ['aria'] }, // assoluta (150,150)
          ],
        },
      },
    }

    const { layout } = apri(salvato, modelloDiRiferimento())
    const arco = layout.archi.find((a) => a.id === 'A1')!

    expect(arco.a.ancora).toBe('vicina')
  })

  it('la libreria del chiamante vince su `salvato.simboli`, che è solo il seme', () => {
    // Il caso vero: il committente ha tarato la tanica scegliendo «usa solo questa volta» e non ha
    // ancora salvato la pratica. Lo stato vivo — quello che il chiamante fonde nella libreria e
    // con cui poi DISEGNA — porta 'ingresso'; `additional_info` porta ancora la taratura di prima,
    // con 'sx'. Se `layoutIniziale` rifondesse `salvato.simboli` sopra la libreria ricevuta,
    // vincerebbe il valore vecchio: il layout nascerebbe agganciato a un'ancora che il documento
    // non disegna più (revisione finale, rilievo Importante).
    const salvato: LayoutSalvato = {
      ...layoutConArcoVersoTanica('sx'),
      simboli: { tanica: { dx: 0, dy: 0, sx: 1, sy: 1, ancore: [{ id: 'sx', x: 0, y: 20, accetta: ['aria'] }] } },
    }
    const decisaOra: Tarature = {
      tanica: { dx: 0, dy: 0, sx: 1, sy: 1, ancore: [{ id: 'ingresso', x: 60, y: 20, accetta: ['aria'] }] },
    }

    const { layout } = layoutIniziale(salvato, modelloDiRiferimento(), decisaOra)

    expect(layout.archi.find((a) => a.id === 'A1')!.a.ancora).toBe('ingresso')
  })

  it('la taratura di pratica entra nel salvato e non alza la versione', () => {
    const t = { dx: -3, dy: 0, sx: 1.07, sy: 1, ancore: [{ id: 'sx', x: 30, y: 130, accetta: ['aria' as const] }] }

    const salvato = serializzaLayout(layoutMinimo(), { tanica: t })

    expect(salvato.simboli).toEqual({ tanica: t })
    expect(salvato.versione).toBe(1)
  })

  it('un salvato senza taratura di pratica non scrive `simboli`: resta indistinguibile da un layout di prima del blocco', () => {
    expect(serializzaLayout(layoutMinimo()).simboli).toBeUndefined()
    expect(serializzaLayout(layoutMinimo(), {}).simboli).toBeUndefined()
  })
})

describe('il by-pass alla riapertura', () => {
  const scheda = () =>
    makeScheda({
      compressori: [makeCompressore({ codice: 'C1', ha_disoleatore: false })],
      disoleatori: [],
      serbatoi: [makeSerbatoio({ codice: 'S1', orientamento: 'VERTICALE' })],
      essiccatori: [makeEssiccatore({ codice: 'E1' })],
      scambiatori: [],
      filtri: [],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
    })

  /** Il modello con (o senza) un by-pass su E1, l'unico stadio della catena. */
  const modello = (conBypass: boolean): SchemaModel => {
    const s = scheda()
    return buildSchemaModel({
      scheda: s,
      collegamentiCompressoriSerbatoi: { C1: ['S1'] },
      preferenze: preferenzeRisolteDaScheda(s, conBypass ? { bypass: [{ id: 'bp1', stadi: ['E1'] }] } : {}),
    })
  }

  const arcoAria = (l: SchemaLayout, da: string, a: string) =>
    l.archi.find((x) => x.da.nodo === da && x.a.nodo === a && x.stile !== 'condensa')

  it('gli archi nuovi arrivano risolti dal layout automatico, non col ripiego del modello', () => {
    // Presi dal modello entrerebbero nel salvataggio con la `t` di ripiego — 0,5, la valvola a
    // meta' tubo — invece che con quella calcolata sulla polilinea vera.
    //
    // Si guarda la MANDATA del compressore e non un tratto di linea: fra due nodi alla stessa
    // quota le due fonti danno lo stesso arco, e il test passerebbe a vuoto (ci e' passato, la
    // prima volta che e' stato scritto). La mandata porta invece una valvola ancorata al vertice
    // sotto la dorsale, e li' le due fonti si distinguono.
    const conBypass = modello(true)
    const automatico = layoutSchema(conBypass)
    // Salvato: lo stesso impianto senza il compressore, cosi' C1 e' un nodo «aggiunto» e la sua
    // mandata rientra fra gli `archiNuovi`.
    const salvato: SchemaLayout = {
      ...automatico,
      nodi: automatico.nodi.filter((n) => n.id !== 'C1'),
      archi: automatico.archi.filter((a) => a.da.nodo !== 'C1' && a.a.nodo !== 'C1'),
    }

    const ripescato = arcoAria(riconcilia(salvato, conBypass).layout, 'C1', 'S1')!
    const atteso = arcoAria(automatico, 'C1', 'S1')!
    // Il confronto e' con l'arco del layout AUTOMATICO e non con «diverso da 0,5»: una `t`
    // diversa per caso passerebbe lo stesso.
    expect(atteso.segni![0].t).not.toBe(0.5) // o il confronto non distinguerebbe le due fonti
    expect(ripescato.segni!.map((s) => s.t)).toEqual(atteso.segni!.map((s) => s.t))
  })

  it('il ponte entra nel salvataggio coi suoi gomiti', () => {
    // Il difetto che l'arco preso dal modello rende invisibile: il disegno esiste, ma il ponte
    // e' una retta sovrapposta alla linea di processo.
    const conBypass = modello(true)
    const automatico = layoutSchema(conBypass)
    const salvato: SchemaLayout = {
      ...automatico,
      nodi: automatico.nodi.filter((n) => !n.id.startsWith('BP1-')),
      archi: automatico.archi.filter((a) => !a.da.nodo.startsWith('BP1-') && !a.a.nodo.startsWith('BP1-')),
    }

    const ponte = arcoAria(riconcilia(salvato, conBypass).layout, 'BP1-IN', 'BP1-OUT')!
    expect(ponte.punti).toHaveLength(2)
    // E la `forma` non torna a galla: il contratto di sola andata regge anche di qua.
    expect(ponte).not.toHaveProperty('forma')
  })

  it('sciogliere un by-pass ricollega la catena invece di spezzarla', () => {
    // I due TEE cadono e con loro i tre archi che li toccavano, ma l'arco sostitutivo S1 → E1 non
    // veniva ripescato: `archiNuovi` lo prende solo se un capo e' fra i nodi AGGIUNTI, e nessuno
    // dei due lo e'. Il risultato era uno stadio scollegato su un disegno riaperto.
    const salvato = layoutSchema(modello(true))
    const esito = riconcilia(salvato, modello(false))
    expect(esito.layout.nodi.some((n) => n.tipo === 'giunzione')).toBe(false)
    expect(arcoAria(esito.layout, 'S1', 'E1')).toBeDefined()
  })

  it('e non calpesta un tracciato fatto a mano', () => {
    // L'invariante ripara chi non ha PIU' un ingresso, non chi ne ha uno diverso da quello che il
    // modello proporrebbe: il layout salvato resta autorevole su *dove* passano le cose.
    const senza = modello(false)
    const salvato = layoutSchema(senza)
    const aMano: SchemaLayout = {
      ...salvato,
      archi: salvato.archi.map((a) =>
        a.a.nodo === 'E1' ? { ...a, punti: [{ x: 1, y: 2 }] } : a
      ),
    }
    const entranti = riconcilia(aMano, senza).layout.archi.filter(
      (a) => a.a.nodo === 'E1' && a.stile !== 'condensa'
    )
    expect(entranti).toHaveLength(1)
    expect(entranti[0].punti).toEqual([{ x: 1, y: 2 }])
  })

  it('e non inventa ingressi per chi non ne ha per natura', () => {
    // Il serbatoio di testa e i compressori non ricevono aria: l'invariante deve ignorarli, o
    // aggiungerebbe tubi che nel modello non esistono.
    const senza = modello(false)
    const esito = riconcilia(layoutSchema(senza), senza)
    expect(esito.layout.archi.filter((a) => a.a.nodo === 'C1' && a.stile !== 'condensa')).toHaveLength(0)
    expect(esito.layout.archi).toHaveLength(senza.archi.length)
  })

  it('le giunzioni restano fuori dagli avvisi all operatore', () => {
    // «Rimosse perche' non piu' in scheda: BP1-IN, BP1-OUT» sarebbe falso su entrambi i fronti,
    // come lo sarebbe stato «Aggiunte dalla scheda: UTENZE» — che infatti e' gia' escluso. Una
    // giunzione non e' un'apparecchiatura.
    const sciolto = riconcilia(layoutSchema(modello(true)), modello(false))
    expect(sciolto.rimossi).not.toContain('BP1-IN')
    expect(sciolto.rimossi).not.toContain('BP1-OUT')

    const creato = riconcilia(layoutSchema(modello(false)), modello(true))
    expect(creato.aggiuntiDaScheda).not.toContain('BP1-IN')
    // Ma l'elenco vero, a uso interno, li contiene: e' quello con cui si posizionano.
    expect(creato.aggiunti).toContain('BP1-IN')
    expect(creato.aggiunti).toContain('BP1-OUT')
  })

  it('riaprire senza cambiare nulla non muove nulla', () => {
    // Il caso piu' comune, e quello che le due correzioni non devono guastare.
    const conBypass = modello(true)
    const salvato = layoutSchema(conBypass)
    const esito = riconcilia(salvato, conBypass)
    expect(esito.aggiunti).toEqual([])
    expect(esito.rimossi).toEqual([])
    expect(esito.layout.nodi.map((n) => `${n.id}@${n.x},${n.y}`)).toEqual(
      salvato.nodi.map((n) => `${n.id}@${n.x},${n.y}`)
    )
    expect(esito.layout.archi.map((a) => a.id)).toEqual(salvato.archi.map((a) => a.id))
  })
})

describe('l impronta delle preferenze con cui il disegno e stato generato', () => {
  const layout = layoutMinimo()

  it('serializzaLayout la scrive quando gliela si da, e non se la inventa', () => {
    expect(serializzaLayout(layout).preferenzeApplicate).toBeUndefined()
    expect(serializzaLayout(layout, undefined, 'impronta').preferenzeApplicate).toBe('impronta')
  })

  it('un salvataggio senza impronta si rilegge come prima', () => {
    // Campo nuovo e OPZIONALE, non un cambio di formato: nessun bump di `VERSIONE`, che invece
    // butterebbe via il layout salvato di ogni pratica esistente. Stessa ragione di `muroX` e
    // `simboli`.
    const salvato = serializzaLayout(layout)
    expect(deserializzaLayout(salvato)).not.toBeNull()
    expect(deserializzaLayout({ ...salvato, preferenzeApplicate: 'qualunque' })).not.toBeNull()
  })

  it('layoutDaPersistere la inoltra solo quando scrive davvero un layout', () => {
    // Sul ripiego — layout in memoria assente per un incidente — si riscrive il salvataggio di
    // prima **com'era**: sovrascrivergli l'impronta cancellerebbe l'avviso senza che nessuno
    // abbia rigenerato nulla.
    const vecchio = { ...serializzaLayout(layout), preferenzeApplicate: 'vecchia' }
    expect(layoutDaPersistere(layout, true, vecchio, undefined, 'nuova')?.preferenzeApplicate).toBe('nuova')
    expect(layoutDaPersistere(null, false, vecchio, undefined, 'nuova')?.preferenzeApplicate).toBe('vecchia')
  })

  it('layoutIniziale dice se ha ripiegato sul layout automatico', () => {
    // Serve a chi monta la sezione per sapere quale impronta vale: quella salvata se si e'
    // riconciliato, quella di adesso se si e' generato da zero.
    const modello = modelloDiProva(['C1'])
    expect(layoutIniziale(null, modello).daZero).toBe(true)
    expect(layoutIniziale(serializzaLayout(layoutSchema(modello)), modello).daZero).toBe(false)
    // Un salvato di versione ignota si butta e si genera da zero: anche li' l'impronta salvata
    // non vale piu' nulla.
    expect(layoutIniziale({ versione: 999, nodi: [], archi: [] }, modello).daZero).toBe(true)
  })
})
