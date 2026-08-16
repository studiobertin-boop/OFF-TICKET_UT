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
  // stava prima che diventasse manuale — il bordo destro della sala compressori, allineato alla
  // griglia — e lo lascia spostare. E' l'unico uso rimasto di `calcolaMuro`.
  //
  // Il compressore sta apposta su un'ascissa che non produce un multiplo di 10 (37, non 40):
  // `calcolaMuro` dà qui 187 (37 + 120 di larghezza del compressore, sceso da 129 nel Task 8,
  // Blocco 3 — non più 160 — + 30 di margine), e solo `allineaAllaGriglia` lo porta a 190. Con
  // un compressore già su un multiplo di 10 (come la versione precedente di questo test, che
  // confrontava con `calcolaMuro(nodi).x`) i due valori coincidevano per coincidenza, e il
  // confronto passava anche togliendo `allineaAllaGriglia` dal ramo automatico.
  it('propone il bordo destro della sala compressori, allineato alla griglia', () => {
    const nodi = [compressoreIn(37), serbatoioInLinea(600)]
    expect(calcolaMuro(nodi)!.x).toBe(187)
    expect(ascissaProposta(nodi)).toBe(190)
  })

  // Un disegno con la sola sala, o con la sola linea, non ha un bordo fra i due gruppi: il muro
  // nasce comunque, perche' il committente l'ha chiesto, ma in spazio libero — un muro che
  // nascesse sopra le apparecchiature sembrerebbe un difetto invece di una proposta.
  it('propone il bordo destro del nodo piu a destra, oltre il margine di spazio libero, quando manca un bordo fra i due gruppi', () => {
    // Due compressori, non uno solo: con un solo nodo Math.max e Math.min di ascissaProposta
    // darebbero lo stesso risultato, e un mutante che li scambiasse passerebbe inosservato.
    // Il più a destra sta su un'ascissa tonda (300): col compressore sceso a un multiplo di 10
    // (120, Task 8, Blocco 3 — non più 129) un'ascissa già multipla di 10 basta a tenere
    // `bordoDestro + margineSpazioLibero` un multiplo di 10 anch'esso, senza la correzione ad
    // hoc (301, non 300) che serviva quando 129 non lo era: questo test isola l'aritmetica del
    // ramo senza bordo, non `allineaAllaGriglia` — già coperta a parte dal test sopra — quindi
    // non deve dipendere da un arrotondamento.
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

  // Fix round 1 (revisione del Task 4): il ramo senza bordo fra i gruppi leggeva
  // `DIMENSIONI_NODO[n.tipo].larghezza`, sempre l'ingombro del verticale (103) per 'serbatoio' —
  // innocuo finché i due orientamenti condividevano lo stesso ingombro, un bug vero ora che
  // l'orizzontale (310) ne ha uno proprio: col difetto il muro proposto nascerebbe dentro il
  // serbatoio invece che al suo bordo destro vero.
  it('propone il bordo destro vero di un serbatoio orizzontale, non quello del verticale', () => {
    function serbatoioOrizzontaleIn(x: number): SchemaNodoPosizionato {
      return {
        id: 'S1', tipo: 'serbatoio', orientamento: 'ORIZZONTALE', etichetta: '',
        valvoleSicurezza: [], origine: 'scheda', gruppo: 'SALA_COMPRESSORI', x, y: 200,
      }
    }
    const soloSala = [compressoreIn(40), serbatoioOrizzontaleIn(300)]
    expect(calcolaMuro(soloSala)).toBeNull()

    // Bordo vero: 300 + 310 (l'ingombro dell'orizzontale) + 60 di margine = 670.
    expect(ascissaProposta(soloSala)).toBe(670)
    // Col difetto (larghezza del verticale, 103): 300 + 103 + 60 = 460 — arrotondato alla
    // griglia, 460, comunque ben dentro il riquadro vero del serbatoio (che arriva a x=610).
    expect(ascissaProposta(soloSala)).not.toBe(460)
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
