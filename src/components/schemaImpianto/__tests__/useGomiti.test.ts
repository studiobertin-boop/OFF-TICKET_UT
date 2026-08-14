import { describe, it, expect } from 'vitest'
import { agganciaPosizioneGomito } from '../useGomiti'

describe('agganciaPosizioneGomito', () => {
  it('senza capi vicini si comporta come la sola griglia, su entrambi gli assi', () => {
    const pDa = { x: 0, y: 0 }
    const pA = { x: 10, y: 10 }
    expect(agganciaPosizioneGomito({ x: 726.5, y: 573.75 }, pDa, pA)).toEqual({ x: 730, y: 570 })
  })

  // x=233 dista 1 dal capo (234) e 3 dalla griglia (230): vince il capo. y=52 dista 2 dalla
  // griglia (50) e 38 dal capo (90): vince la griglia. Se l'aggancio mescolasse gli assi
  // (usando le ordinate dei capi per l'ascissa o viceversa), l'ascissa risulterebbe 230, non
  // 234, perché lungo l'asse scambiato nessun capo è abbastanza vicino.
  it('aggancia l’ascissa alla quota di un capo lasciando l’ordinata alla griglia', () => {
    const pDa = { x: 100, y: 50 }
    const pA = { x: 234, y: 90 }
    expect(agganciaPosizioneGomito({ x: 233, y: 52 }, pDa, pA)).toEqual({ x: 234, y: 50 })
  })

  // Speculare al caso sopra, sull'altro asse: y=233 dista 1 dal capo (234) e 3 dalla griglia
  // (230), x=52 dista 2 dalla griglia (50) e 38 dal capo (90).
  it('aggancia l’ordinata alla quota di un capo lasciando l’ascissa alla griglia', () => {
    const pDa = { x: 50, y: 100 }
    const pA = { x: 90, y: 234 }
    expect(agganciaPosizioneGomito({ x: 52, y: 233 }, pDa, pA)).toEqual({ x: 50, y: 234 })
  })

  // Le quote misurate in pagina sulla tubazione std-3 (M 677 260 L 726,5 260 L 726,5 234 L 776
  // 234): un gomito trascinato vicino allo spigolo aggancia entrambi gli assi ai capi, non solo
  // alla griglia. x=678 dista 1 dal capo (677) e 2 dalla griglia (680); y=236 dista 2 dal capo
  // (234) e 4 dalla griglia (240).
  it('aggancia entrambi gli assi ai rispettivi capi quando sono i più vicini', () => {
    const pDa = { x: 677, y: 260 }
    const pA = { x: 726, y: 234 }
    expect(agganciaPosizioneGomito({ x: 678, y: 236 }, pDa, pA)).toEqual({ x: 677, y: 234 })
  })
})
