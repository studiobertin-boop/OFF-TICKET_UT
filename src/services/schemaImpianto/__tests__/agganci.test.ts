import { describe, it, expect } from 'vitest'
import { tipoAggancioPerStile, ancoraAmmette, capoValido, connessioneAmmessa, stileIniziale } from '../agganci'

describe('compatibilita degli agganci', () => {
  it('mandata rigida e flessibile chiedono entrambe un aggancio aria', () => {
    expect(tipoAggancioPerStile('standard')).toBe('aria')
    expect(tipoAggancioPerStile('flessibile')).toBe('aria')
    expect(tipoAggancioPerStile('condensa')).toBe('condensa')
  })

  it('un ancora di sola aria rifiuta una linea condense', () => {
    const ancora = { id: 'dx', x: 0, y: 0, accetta: ['aria' as const] }
    expect(ancoraAmmette(ancora, 'standard')).toBe(true)
    expect(ancoraAmmette(ancora, 'condensa')).toBe(false)
  })

  it('lo scarico del serbatoio accetta la condensa ma non la mandata', () => {
    const serbatoio = { tipo: 'serbatoio' as const, orientamento: 'VERTICALE' as const }
    expect(capoValido(serbatoio, 'basso-out', 'condensa')).toBe(true)
    expect(capoValido(serbatoio, 'basso-out', 'standard')).toBe(false)
    expect(capoValido(serbatoio, 'dx', 'standard')).toBe(true)
  })

  it('un ancora inesistente non e mai valida', () => {
    expect(capoValido({ tipo: 'tanica' as const }, 'inventata', 'condensa')).toBe(false)
  })

  it('una linea condense da uno scarico a una tanica e ammessa, anche se lo stile con cui si traccia di default (standard/aria) non lo e', () => {
    const essiccatore = { tipo: 'essiccatore' as const }
    const tanica = { tipo: 'tanica' as const }
    // Nessuno dei due capi ammette aria: senza la correzione, isValidConnection valutato
    // sempre con 'standard' rifiuterebbe questa connessione mentre la si traccia.
    expect(capoValido(essiccatore, 'basso-out', 'standard')).toBe(false)
    expect(capoValido(tanica, 'alto-in', 'standard')).toBe(false)
    expect(connessioneAmmessa(essiccatore, 'basso-out', tanica, 'alto-in')).toBe(true)
  })

  it('una mandata fra due ancore aria resta ammessa come prima', () => {
    const essiccatore = { tipo: 'essiccatore' as const }
    const filtro = { tipo: 'filtro' as const }
    expect(connessioneAmmessa(essiccatore, 'dx', filtro, 'sx')).toBe(true)
  })

  it('un capo che non ammette alcuno stile in comune resta rifiutato', () => {
    const tanica = { tipo: 'tanica' as const }
    const filtro = { tipo: 'filtro' as const }
    // 'alto-in' della tanica accetta solo condensa, 'dx' del filtro solo aria: nessuno stile in comune.
    expect(connessioneAmmessa(tanica, 'alto-in', filtro, 'dx')).toBe(false)
  })

  it('deduce lo stile condensa quando e l’unico ammesso da entrambi i capi', () => {
    const essiccatore = { tipo: 'essiccatore' as const }
    const tanica = { tipo: 'tanica' as const }
    expect(stileIniziale(essiccatore, 'basso-out', tanica, 'alto-in')).toBe('condensa')
  })

  it('deduce lo stile standard quando entrambi i capi ammettono aria', () => {
    const essiccatore = { tipo: 'essiccatore' as const }
    const filtro = { tipo: 'filtro' as const }
    expect(stileIniziale(essiccatore, 'dx', filtro, 'sx')).toBe('standard')
  })

  // Un TEE inserito su una linea condense lasciava due archi condensa attaccati ad ancore che
  // dichiaravano di accettare solo aria: uno stato che l'editor rifiuterebbe se lo si disegnasse
  // a mano. Dal 17-08-2026 la giunzione accetta entrambi i tipi.
  it('la giunzione accetta sia l’aria sia la condensa su ogni suo lato', () => {
    const giunzione = { tipo: 'giunzione' as const }
    for (const ancora of ['sx', 'dx', 'alto', 'basso']) {
      expect(capoValido(giunzione, ancora, 'standard')).toBe(true)
      expect(capoValido(giunzione, ancora, 'condensa')).toBe(true)
    }
  })

  // Conseguenza accettata di quell'allargamento, segnalata al committente prima di procedere: fra
  // due giunzioni l'aria è ammessa da entrambi i capi, quindi una tubazione tracciata a mano fra
  // due TEE di una linea condense nasce ad aria e va cambiata a mano.
  it('fra due giunzioni la tubazione nuova nasce ad aria', () => {
    const giunzione = { tipo: 'giunzione' as const }
    expect(stileIniziale(giunzione, 'dx', giunzione, 'sx')).toBe('standard')
  })
})
