import { describe, it, expect } from 'vitest'
import { makeCompressore, makeDatiImpianto, makeScheda, makeSerbatoio, makeValvola } from '@/services/relazione/__tests__/fixtures'
import { buildSchemaModel } from '../buildSchemaModel'
import { layoutSchema } from '../layout'
import { serializzaLayout, deserializzaLayout, riconcilia, layoutIniziale, layoutDaPersistere } from '../persistenza'

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
