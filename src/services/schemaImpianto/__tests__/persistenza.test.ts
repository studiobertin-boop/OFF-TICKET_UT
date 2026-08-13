import { describe, it, expect } from 'vitest'
import { makeCompressore, makeDatiImpianto, makeEssiccatore, makeScheda, makeSeparatore, makeSerbatoio, makeValvola } from '@/services/relazione/__tests__/fixtures'
import { buildSchemaModel } from '../buildSchemaModel'
import { layoutSchema, DIMENSIONI_NODO } from '../layout'
import { serializzaLayout, deserializzaLayout, riconcilia, layoutIniziale, layoutDaPersistere } from '../persistenza'
import { dimensioniDi } from '../symbols'

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
    // del JSON arriverebbero fin qui. Senza il controllo, `calcolaMuro` (chiamato subito
    // sotto) esplode leggendo `DIMENSIONI_NODO[tipoInventato]`, che è `undefined`.
    const salvato = serializzaLayout(layoutSchema(modelloDiProva(['C1'])))
    salvato.nodi[0] = { ...salvato.nodi[0], tipo: 'tipo-inventato' as never }

    expect(deserializzaLayout(salvato)).toBeNull()
  })

  it('rifiuta un salvato con nodi o archi che non sono array', () => {
    expect(deserializzaLayout({ versione: 1, nodi: 'non un array', archi: [] } as never)).toBeNull()
    expect(deserializzaLayout({ versione: 1, nodi: [], archi: null } as never)).toBeNull()
  })

  it('ricalcola il muro invece di fidarsi di un valore salvato', () => {
    const layout = layoutSchema(modelloDiProva(['C1']))
    const salvato = serializzaLayout(layout)
    const tornato = deserializzaLayout(salvato)!

    expect(tornato.muro).toEqual(layout.muro)
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
