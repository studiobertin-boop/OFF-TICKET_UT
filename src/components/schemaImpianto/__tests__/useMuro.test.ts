import { describe, expect, it } from 'vitest'
import { calcolaMuro, DIMENSIONI_NODO } from '@/services/schemaImpianto/layout'
import { PASSO_GRIGLIA } from '@/services/schemaImpianto/griglia'
import type { SchemaNodoPosizionato } from '@/services/schemaImpianto/types'
import { ascissaProposta, ascissaSpostata } from '../useMuro'

function compressoreIn(x: number): SchemaNodoPosizionato {
  return {
    id: 'C1',
    tipo: 'compressore',
    etichetta: '',
    valvoleSicurezza: [],
    origine: 'scheda',
    gruppo: 'SALA_COMPRESSORI',
    x,
    y: 200,
  }
}

function serbatoioInLinea(x: number): SchemaNodoPosizionato {
  return {
    id: 'S1',
    tipo: 'serbatoio',
    etichetta: '',
    valvoleSicurezza: [],
    origine: 'scheda',
    gruppo: 'LINEA_DISTRIBUZIONE',
    x,
    y: 200,
  }
}

describe('ascissaProposta', () => {
  // Il pulsante della barra non chiede al committente dove mettere il muro: lo propone dove
  // stava prima che diventasse manuale — il bordo destro della sala compressori — e lo lascia
  // spostare. E' l'unico uso rimasto di `calcolaMuro`.
  it('propone il bordo destro della sala compressori, come faceva il muro automatico', () => {
    const nodi = [compressoreIn(40), serbatoioInLinea(600)]
    expect(ascissaProposta(nodi)).toBe(calcolaMuro(nodi).x)
  })

  // Un disegno con la sola sala, o con la sola linea, non ha un bordo fra i due gruppi: il muro
  // nasce comunque, perche' il committente l'ha chiesto, ma in spazio libero — un muro che
  // nascesse sopra le apparecchiature sembrerebbe un difetto invece di una proposta.
  it('propone un punto libero anche quando non c e un bordo fra i due gruppi', () => {
    const soloSala = [compressoreIn(40)]
    expect(calcolaMuro(soloSala)).toBeNull()
    const proposta = ascissaProposta(soloSala)
    expect(proposta % PASSO_GRIGLIA).toBe(0)
    expect(proposta).toBeGreaterThan(40 + DIMENSIONI_NODO.compressore.larghezza)
  })

  it('propone comunque un punto sulla griglia su un disegno vuoto', () => {
    expect(ascissaProposta([]) % PASSO_GRIGLIA).toBe(0)
  })
})

describe('ascissaSpostata', () => {
  // Il muro si posa sui punti della griglia, come tutto cio' che si piazza a mano (decisione 3
  // del 14-08-2026). Si allinea qui, dove i test lo raggiungono, non nel componente.
  it('posa il muro sul punto di griglia piu vicino', () => {
    expect(ascissaSpostata(573)).toBe(570)
    expect(ascissaSpostata(576)).toBe(580)
  })
})
