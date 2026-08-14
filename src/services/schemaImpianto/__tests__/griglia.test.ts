import { describe, expect, it } from 'vitest'
import { PASSO_GRIGLIA, agganciaQuota, allineaAllaGriglia } from '../griglia'

describe('allineaAllaGriglia', () => {
  it('porta al punto di griglia più vicino', () => {
    expect(allineaAllaGriglia(726.5)).toBe(730)
    expect(allineaAllaGriglia(573.75)).toBe(570)
    expect(allineaAllaGriglia(585)).toBe(590)
  })

  // Non prova la direzione dell'arrotondamento — floor, ceil e round lasciano fermo un
  // multiplo esatto allo stesso modo — ma scopre bug di segno o di scala: un'inversione di
  // segno sposterebbe -40, e una divisione per PASSO_GRIGLIA dimenticata sposterebbe anche
  // 260.
  it('lascia fermo ciò che è già sulla griglia', () => {
    expect(allineaAllaGriglia(260)).toBe(260)
    expect(allineaAllaGriglia(0)).toBe(0)
    expect(allineaAllaGriglia(-40)).toBe(-40)
  })

  it('vale anche a sinistra dello zero', () => {
    expect(allineaAllaGriglia(-23)).toBe(-20)
    expect(allineaAllaGriglia(-27)).toBe(-30)
  })

  // Math.round(-0.4) è -0: senza normalizzazione questo fallirebbe, perché in Vitest
  // expect(-0).toBe(0) fallisce (Object.is distingue -0 da 0). La normalizzazione evita
  // questa trappola per chiunque scriva test su coordinate che passano per lo zero.
  it('normalizza il -0 a 0', () => {
    expect(allineaAllaGriglia(-4)).toBe(0)
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
  // griglia più vicino (240) ne dista 4. Vince il capo, e la linea resta dritta.
  it('una quota preferita vicina vince sul punto di griglia', () => {
    expect(agganciaQuota(236, [260, 234])).toBe(234)
  })

  // Qui il valore è lontano da entrambi i capi: comanda la griglia, altrimenti i capi
  // catturerebbero il tratto per tutta la corsa e il gesto diventerebbe inservibile.
  it('lontano dalle quote preferite comanda la griglia', () => {
    expect(agganciaQuota(312, [260, 234])).toBe(310)
  })

  // Pareggio su un valore intero, non un mezzo punto: resta indipendente dalla direzione
  // dell'arrotondamento a metà passo. Griglia (240) e quota preferita (234) distano
  // entrambe 3 da 237 — un capo davvero fuori griglia, come nel caso reale. Vince la quota
  // preferita: il punto di griglia lì non aggiunge nulla.
  it('a parità di distanza vince la quota preferita', () => {
    expect(agganciaQuota(237, [234])).toBe(234)
  })

  it('sceglie la più vicina fra più quote preferite', () => {
    // Griglia a 250 (dista 4), capi a 234 (dista 12) e 249 (dista 3): vince 249,
    // in qualunque ordine arrivi la lista, e la sola griglia darebbe 250.
    expect(agganciaQuota(246, [234, 249])).toBe(249)
    expect(agganciaQuota(246, [249, 234])).toBe(249)
  })

  it('una quota preferita già sulla griglia non cambia nulla', () => {
    expect(agganciaQuota(261, [260])).toBe(260)
  })
})
