import { describe, it, expect } from 'vitest'
import { makeCompressore, makeDatiImpianto, makeScheda, makeSerbatoio } from '@/services/relazione/__tests__/fixtures'
import { buildSchemaModel } from '../buildSchemaModel'
import { layoutSchema } from '../layout'
import { serializzaLayout, deserializzaLayout, riconcilia } from '../persistenza'

function modelloDiProva(codiciCompressore: string[]) {
  const scheda = makeScheda({
    compressori: codiciCompressore.map((c) => makeCompressore({ codice: c, ha_disoleatore: false })),
    disoleatori: [], essiccatori: [], scambiatori: [], filtri: [],
    serbatoi: [makeSerbatoio()],
    dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
  })
  return buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { [codiciCompressore[0]]: ['S1'] } })
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

  it('riparte da zero quando il layout salvato è vuoto: tutti i nodi della scheda sono aggiunti', () => {
    const salvato = { versione: 1 as const, nodi: [], archi: [] }
    const modello = modelloDiProva(['C1', 'C2'])
    const esito = riconcilia(salvato, modello)

    expect(esito.aggiunti.sort()).toEqual(modello.nodi.map((n) => n.id).sort())
    expect(esito.rimossi).toEqual([])
    expect(esito.layout.nodi).toHaveLength(modello.nodi.length)
  })
})
