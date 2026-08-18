import { describe, it, expect } from 'vitest'
import {
  capoDiValleDi,
  corsieDeiPonti,
  eCapoDiMonte,
  idTeeBypass,
  linearizzaConBypass,
  nodoGiunzioneBypass,
} from '../bypass'
import type { SchemaNodo } from '../types'

const nodo = (id: string, tipo: SchemaNodo['tipo'] = 'filtro'): SchemaNodo => ({
  id,
  tipo,
  etichetta: id,
  gruppo: 'SALA_COMPRESSORI',
  valvoleSicurezza: [],
  origine: 'scheda',
})

const catena = [nodo('F1'), nodo('E1', 'essiccatore'), nodo('F2'), nodo('F3')]

/** Gli id nella sequenza, con le giunzioni al loro posto: è ciò che i test guardano. */
const idDella = (sequenza: ReturnType<typeof linearizzaConBypass>['sequenza']): string[] =>
  sequenza.map((v) => v.id)

describe('idTeeBypass', () => {
  it('ricava gli id dei TEE dall id del gruppo, non dagli stadi scavalcati', () => {
    expect(idTeeBypass('bp1')).toEqual({ inizio: 'BP1-IN', fine: 'BP1-OUT' })
    expect(idTeeBypass('bp12')).toEqual({ inizio: 'BP12-IN', fine: 'BP12-OUT' })
  })

  it('il prefisso BP non collide con nessun identificativo che il resto del sistema produce', () => {
    // La sentinella promessa dalla specifica: il giorno che nasce un prefisso `B` fra i codici di
    // scheda, o un id riservato che comincia per BP, questo test cade e qualcuno se ne accorge.
    const estranei = ['S1', 'C1', 'C10', 'E1', 'F1', 'F12', 'SEP1', 'UTENZE', 'T', 'RC', 'M-1', 'M-BP1']
    const generati = ['bp1', 'bp2', 'bp10'].flatMap((g) => Object.values(idTeeBypass(g)))
    for (const id of generati) expect(estranei).not.toContain(id)
    // E nessuno degli estranei somiglia a un TEE di by-pass: il riconoscimento per prefisso
    // (`riconcilia`, gli avvisi) non deve pescare un'apparecchiatura vera.
    for (const id of estranei) expect(/^BP\d+-(IN|OUT)$/.test(id)).toBe(false)
  })
})

describe('nodoGiunzioneBypass', () => {
  it("nasce di origine 'scheda', come il terminale utenze", () => {
    // 'manuale' lo renderebbe indistruttibile, e sciogliere il gruppo lascerebbe due TEE orfani
    // su ogni disegno riaperto.
    const g = nodoGiunzioneBypass('BP1-IN')
    expect(g).toMatchObject({ id: 'BP1-IN', tipo: 'giunzione', origine: 'scheda' })
  })
})

describe('linearizzaConBypass', () => {
  it('mette una giunzione prima del primo scavalcato e una dopo l ultimo', () => {
    const { sequenza, ponti } = linearizzaConBypass(catena, [{ id: 'bp1', stadi: ['E1', 'F2'] }])
    expect(idDella(sequenza)).toEqual(['F1', 'BP1-IN', 'E1', 'F2', 'BP1-OUT', 'F3'])
    expect(ponti).toEqual([{ gruppo: 'bp1', inizio: 'BP1-IN', fine: 'BP1-OUT', corsia: 0 }])
  })

  it('scavalcando l intera catena mette i TEE ai due capi', () => {
    // È il caso del disegno di riferimento `si bypass.png`.
    const { sequenza } = linearizzaConBypass(catena, [{ id: 'bp1', stadi: ['F1', 'E1', 'F2', 'F3'] }])
    expect(idDella(sequenza)).toEqual(['BP1-IN', 'F1', 'E1', 'F2', 'F3', 'BP1-OUT'])
  })

  it('la sequenza porta i nodi veri, e le giunzioni sono nodi a tutti gli effetti', () => {
    const { sequenza } = linearizzaConBypass(catena, [{ id: 'bp1', stadi: ['F1'] }])
    expect(sequenza[0].tipo).toBe('giunzione')
    // Lo stadio non è una copia rimaneggiata: è lo stesso oggetto che il chiamante ha passato.
    expect(sequenza[1]).toBe(catena[0])
  })

  it('due gruppi disgiunti mettono quattro giunzioni, nell ordine della catena', () => {
    const { sequenza, ponti } = linearizzaConBypass(catena, [
      { id: 'bp2', stadi: ['F3'] },
      { id: 'bp1', stadi: ['F1'] },
    ])
    // L'ordine dei gruppi salvati non conta: conta quello della catena.
    expect(idDella(sequenza)).toEqual(['BP1-IN', 'F1', 'BP1-OUT', 'E1', 'F2', 'BP2-IN', 'F3', 'BP2-OUT'])
    expect(ponti.map((p) => p.gruppo)).toEqual(['bp1', 'bp2'])
  })

  it('un gruppo con membri non contigui non produce nulla', () => {
    // Difesa ridondante rispetto a `risolviPreferenze`, che già lo scarta: qui si fissa che
    // questo modulo non si fida del chiamante. Un gruppo spezzato non è disegnabile con due soli
    // TEE, e indovinare è peggio che dirlo.
    const { sequenza, ponti } = linearizzaConBypass(catena, [{ id: 'bp1', stadi: ['F1', 'F2'] }])
    expect(idDella(sequenza)).toEqual(['F1', 'E1', 'F2', 'F3'])
    expect(ponti).toEqual([])
  })

  it('un gruppo vuoto, o su stadi che la catena non contiene, non produce nulla', () => {
    const { sequenza, ponti } = linearizzaConBypass(catena, [
      { id: 'bp1', stadi: [] },
      { id: 'bp2', stadi: ['F9'] },
    ])
    expect(idDella(sequenza)).toEqual(['F1', 'E1', 'F2', 'F3'])
    expect(ponti).toEqual([])
  })

  it('senza gruppi la catena esce identica', () => {
    const { sequenza, ponti } = linearizzaConBypass(catena, [])
    expect(sequenza).toEqual(catena)
    expect(ponti).toEqual([])
  })
})

describe('corsieDeiPonti', () => {
  it('due gruppi che non si sovrappongono corrono sulla stessa corsia', () => {
    // Il caso normale. Impilarli a quote diverse sarebbe uno scalino nel disegno che nulla
    // giustifica.
    const { ponti } = linearizzaConBypass(catena, [
      { id: 'bp1', stadi: ['F1'] },
      { id: 'bp2', stadi: ['F3'] },
    ])
    expect(ponti.map((p) => p.corsia)).toEqual([0, 0])
  })

  it('due gruppi che si sovrappongono corrono su corsie diverse', () => {
    // Caso patologico — uno stadio in due gruppi — che `risolviPreferenze` oggi non vieta.
    // Non si scarta e non si indovina: si impila, e il disegno resta leggibile.
    const { ponti } = linearizzaConBypass(catena, [
      { id: 'bp1', stadi: ['F1', 'E1'] },
      { id: 'bp2', stadi: ['E1', 'F2'] },
    ])
    expect(ponti.map((p) => p.corsia)).toEqual([0, 1])
  })

  it('due gruppi annidati chiudono dall interno verso l esterno', () => {
    // Due ponti che finiscono sullo stesso stadio: il TEE di valle del ponte INTERNO va posato
    // per primo, o il disegno mostrerebbe il ponte contenuto che si chiude dopo il contenitore.
    const { sequenza } = linearizzaConBypass(catena, [
      { id: 'bp1', stadi: ['F1', 'E1', 'F2'] },
      { id: 'bp2', stadi: ['E1', 'F2'] },
    ])
    expect(idDella(sequenza)).toEqual(['BP1-IN', 'F1', 'BP2-IN', 'E1', 'F2', 'BP2-OUT', 'BP1-OUT', 'F3'])
  })

  it('fra due ponti annidati corre in basso quello interno', () => {
    // Nell'ordine della catena vincerebbe il più a sinistra — cioè l'esterno — e l'annidamento
    // uscirebbe rovesciato: il ponte contenuto appeso sopra a quello che lo contiene.
    const { ponti } = linearizzaConBypass(catena, [
      { id: 'bp1', stadi: ['F1', 'E1', 'F2'] },
      { id: 'bp2', stadi: ['E1', 'F2'] },
    ])
    expect(ponti.map((p) => [p.gruppo, p.corsia])).toEqual([
      ['bp1', 1],
      ['bp2', 0],
    ])
  })

  it('la corsia si riusa appena l intervallo si libera', () => {
    // Tre gruppi: il primo e il secondo si accavallano, il terzo è staccato da entrambi e
    // ritorna in basso invece di continuare a salire.
    expect(
      corsieDeiPonti([
        { inizio: 0, fine: 3 },
        { inizio: 2, fine: 5 },
        { inizio: 7, fine: 8 },
      ])
    ).toEqual([0, 1, 0])
  })
})

describe('riconoscere il capo di monte', () => {
  it('lo distingue da quello di valle, e da tutto il resto', () => {
    // La quota di un capo di by-pass dipende da quale dei due e' (Blocco 5): il layout deve
    // saperlo dall'id, che e' l'unica cosa che ha in mano mentre dispone la sequenza.
    expect(eCapoDiMonte('BP1-IN')).toBe(true)
    expect(eCapoDiMonte('BP12-IN')).toBe(true)
    expect(eCapoDiMonte('BP1-OUT')).toBe(false)
    expect(eCapoDiMonte('M-1')).toBe(false)
    expect(eCapoDiMonte('F1')).toBe(false)
  })

  it('trova il capo di valle che gli fa coppia', () => {
    expect(capoDiValleDi('BP1-IN')).toBe('BP1-OUT')
    expect(capoDiValleDi('BP12-IN')).toBe('BP12-OUT')
  })

  it('i due riconoscitori e gli id sono la stessa cosa detta due volte', () => {
    // Se `idTeeBypass` cambiasse forma agli id, questi due lo seguirebbero senza che nessuno se ne
    // accorga: il legame va fissato qui.
    const { inizio, fine } = idTeeBypass('bp3')
    expect(eCapoDiMonte(inizio)).toBe(true)
    expect(eCapoDiMonte(fine)).toBe(false)
    expect(capoDiValleDi(inizio)).toBe(fine)
  })
})
