import { describe, it, expect } from 'vitest'
import { codiceVisibile, codiciOccupati, motivoRifiutoCodice, LUNGHEZZA_MASSIMA_CODICE } from '../codici'
import type { SchemaNodo } from '../types'

function nodo(parziale: Partial<SchemaNodo> & Pick<SchemaNodo, 'id'>): SchemaNodo {
  return {
    tipo: 'serbatoio',
    etichetta: 'Serbatoio',
    gruppo: 'LINEA_DISTRIBUZIONE',
    valvoleSicurezza: [],
    origine: 'manuale',
    ...parziale,
  }
}

describe('codiceVisibile', () => {
  it("ricade sull'identificativo quando nessuno ha scritto un codice a mano", () => {
    // Il caso di ogni nodo di scheda e di ogni layout salvato prima del 17-08-2026: senza questo
    // ripiego un disegno già consegnato uscirebbe con le caselle del codice vuote.
    expect(codiceVisibile(nodo({ id: 'M-S1' }))).toBe('M-S1')
    expect(codiceVisibile(nodo({ id: 'S1', origine: 'scheda' }))).toBe('S1')
  })

  it("mostra il codice scritto a mano quando c'è, e non l'identificativo interno", () => {
    expect(codiceVisibile(nodo({ id: 'M-S1', codice: 'S9' }))).toBe('S9')
  })
})

describe('codiciOccupati', () => {
  it('conta anche gli accessori e le valvole di sicurezza, che hanno una riga propria in tabella', () => {
    // `righeLista` (renderSvg.ts) stampa una riga per l'accessorio e una per ogni valvola: un
    // codice a mano che collidesse con una di quelle produrrebbe due righe uguali, che è
    // esattamente ciò che questo controllo esiste per impedire.
    const occupati = codiciOccupati([
      nodo({
        id: 'C1',
        origine: 'scheda',
        valvoleSicurezza: [{ codice: 'C1.2', etichetta: 'Valvola' }],
        accessorio: {
          codice: 'C1.1',
          etichetta: 'Disoleatore',
          valvoleSicurezza: [{ codice: 'C1.3', etichetta: 'Valvola' }],
        },
      }),
    ])
    expect(occupati).toEqual(new Set(['C1', 'C1.1', 'C1.2', 'C1.3']))
  })

  it("conta il codice scritto a mano oltre all'identificativo, perché entrambi restano visibili", () => {
    expect(codiciOccupati([nodo({ id: 'M-S1', codice: 'S9' })])).toEqual(new Set(['M-S1', 'S9']))
  })

  it('lascia fuori il nodo escluso, o non si potrebbe riconfermare il codice che ha già', () => {
    expect(codiciOccupati([nodo({ id: 'M-S1', codice: 'S9' })], 'M-S1')).toEqual(new Set())
  })
})

describe('motivoRifiutoCodice', () => {
  const tela = [nodo({ id: 'S1', origine: 'scheda' }), nodo({ id: 'M-S1' }), nodo({ id: 'M-F1', codice: 'F9' })]

  it('accetta un codice libero', () => {
    expect(motivoRifiutoCodice('S7', tela, 'M-S1')).toBeNull()
  })

  it('accetta il codice che il nodo ha già: non collide con sé stesso', () => {
    expect(motivoRifiutoCodice('F9', tela, 'M-F1')).toBeNull()
  })

  it('rifiuta un codice di scheda, che comparirebbe due volte in tabella', () => {
    expect(motivoRifiutoCodice('S1', tela, 'M-S1')).toMatch(/già usato/)
  })

  it('rifiuta il codice a mano di un altro nodo', () => {
    expect(motivoRifiutoCodice('F9', tela, 'M-S1')).toMatch(/già usato/)
  })

  it('rifiuta un codice più lungo del limite, che uscirebbe dal simbolo sul disegno', () => {
    expect(motivoRifiutoCodice('A'.repeat(LUNGHEZZA_MASSIMA_CODICE + 1), tela, 'M-S1')).toMatch(/caratteri/)
    expect(motivoRifiutoCodice('A'.repeat(LUNGHEZZA_MASSIMA_CODICE), tela, 'M-S1')).toBeNull()
  })

  it('rifiuta il vuoto e i soli spazi: una casella senza codice non identifica niente', () => {
    expect(motivoRifiutoCodice('', tela, 'M-S1')).not.toBeNull()
    expect(motivoRifiutoCodice('   ', tela, 'M-S1')).not.toBeNull()
  })

  it('non si lascia ingannare dagli spazi ai bordi', () => {
    expect(motivoRifiutoCodice('  S1  ', tela, 'M-S1')).toMatch(/già usato/)
  })
})
