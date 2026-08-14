import { describe, expect, it } from 'vitest'
import { PASSO_GRIGLIA, agganciaQuota, allineaAllaGriglia } from '../griglia'

describe('allineaAllaGriglia', () => {
  it('porta al punto di griglia più vicino', () => {
    expect(allineaAllaGriglia(726.5)).toBe(730)
    expect(allineaAllaGriglia(573.75)).toBe(570)
    expect(allineaAllaGriglia(585)).toBe(590)
  })

  // Un valore già allineato non deve muoversi: è il caso che un arrotondamento
  // sbagliato (per difetto o per eccesso invece che al più vicino) sposterebbe.
  it('lascia fermo ciò che è già sulla griglia', () => {
    expect(allineaAllaGriglia(260)).toBe(260)
    expect(allineaAllaGriglia(0)).toBe(0)
    expect(allineaAllaGriglia(-40)).toBe(-40)
  })

  it('vale anche a sinistra dello zero', () => {
    expect(allineaAllaGriglia(-23)).toBe(-20)
    expect(allineaAllaGriglia(-27)).toBe(-30)
  })

  it('il passo è quello della griglia visibile', () => {
    expect(PASSO_GRIGLIA).toBe(10)
  })
})

describe('agganciaQuota', () => {
  it('senza quote preferite si comporta come la sola griglia', () => {
    expect(agganciaQuota(726.5, [])).toBe(730)
    expect(agganciaQuota(573.75, [])).toBe(570)
  })

  // 234 è la quota di un capo del tubo: dista 2 dal valore grezzo, mentre il punto di
  // griglia più vicino (240) ne dista 6. Vince il capo, e la linea resta dritta.
  it('una quota preferita vicina vince sul punto di griglia', () => {
    expect(agganciaQuota(236, [260, 234])).toBe(234)
  })

  // Qui il valore è lontano da entrambi i capi: comanda la griglia, altrimenti i capi
  // catturerebbero il tratto per tutta la corsa e il gesto diventerebbe inservibile.
  it('lontano dalle quote preferite comanda la griglia', () => {
    expect(agganciaQuota(312, [260, 234])).toBe(310)
  })

  // A parità di distanza vince la quota preferita: il suo scopo è tenere dritta la linea,
  // e il punto di griglia in quel caso non aggiunge nulla. Una sola quota preferita, non
  // due: con due equidistanti il caso non direbbe nulla sul pareggio fra griglia e capo,
  // ma solo su quale delle due il ciclo tiene per ultima.
  it('a parità di distanza vince la quota preferita', () => {
    // 245 dista 5 dal punto di griglia (250) e 5 dalla quota preferita (240).
    expect(agganciaQuota(245, [240])).toBe(240)
  })

  it('sceglie la più vicina fra più quote preferite', () => {
    expect(agganciaQuota(258, [234, 260])).toBe(260)
  })

  it('una quota preferita già sulla griglia non cambia nulla', () => {
    expect(agganciaQuota(261, [260])).toBe(260)
  })
})
