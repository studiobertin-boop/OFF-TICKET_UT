import { describe, expect, it } from 'vitest'
import { calcolaMuro, DIMENSIONI_NODO } from '@/services/schemaImpianto/layout'
import type { SchemaNodoPosizionato } from '@/services/schemaImpianto/types'
import { ascissaProposta, ascissaSpostata } from '../useMuro'

function compressoreIn(x: number, id = 'C1'): SchemaNodoPosizionato {
  return {
    id,
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
  it('propone il bordo destro del nodo piu a destra, oltre il margine di spazio libero, quando manca un bordo fra i due gruppi', () => {
    // Due compressori, non uno solo: con un solo nodo Math.max e Math.min di ascissaProposta
    // darebbero lo stesso risultato, e un mutante che li scambiasse passerebbe inosservato.
    const piuASinistra = compressoreIn(40)
    const piuADestra = compressoreIn(300, 'C2')
    const soloSala = [piuASinistra, piuADestra]
    expect(calcolaMuro(soloSala)).toBeNull()

    const bordoDestro = piuADestra.x + DIMENSIONI_NODO.compressore.larghezza
    // Lo stesso margine che ascissaProposta somma al bordo nel ramo senza bordo fra i gruppi
    // (`bordo + 60` in useMuro.ts): scritto qui a parte, non dentro il valore atteso finale,
    // cosi' un mutante che lo cambiasse (es. a 20, ancora multiplo di PASSO_GRIGLIA) fa
    // comunque cadere il confronto sul valore esatto.
    const margineSpazioLibero = 60
    expect(ascissaProposta(soloSala)).toBe(bordoDestro + margineSpazioLibero)
  })

  it('propone il solo margine di spazio libero su un disegno vuoto', () => {
    // Nessun nodo: il bordo di partenza e' 0, quindi la proposta e' il margine da solo — lo
    // stesso valore letterale della fixture precedente, perche' e' la stessa costante in
    // ascissaProposta.
    expect(ascissaProposta([])).toBe(60)
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
