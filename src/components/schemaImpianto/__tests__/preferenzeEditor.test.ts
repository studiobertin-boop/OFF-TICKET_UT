import { beforeEach, describe, expect, it } from 'vitest'
import {
  PREFERENZE_PREDEFINITE,
  dimensioneFinestra,
  leggiPreferenze,
  percentualeAnteprima,
  scriviPreferenze,
} from '../preferenzeEditor'

const CHIAVE = 'schema-impianto-preferenze-editor'

describe('lettura e scrittura delle preferenze', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('senza nulla di salvato restituisce i valori predefiniti', () => {
    expect(leggiPreferenze()).toEqual(PREFERENZE_PREDEFINITE)
  })

  it('rilegge quello che ha scritto', () => {
    scriviPreferenze({ schermoIntero: true, larghezza: 70, altezza: 60, anteprima: 25 })
    expect(leggiPreferenze()).toEqual({ schermoIntero: true, larghezza: 70, altezza: 60, anteprima: 25 })
  })

  // La chiave sopravvive agli aggiornamenti dell'applicazione: un giorno può contenere il
  // formato di una versione precedente, o un valore scritto a mano dagli strumenti per
  // sviluppatori. Nessuno di questi casi deve impedire di aprire l'editor.
  it('con un contenuto illeggibile ripiega sui predefiniti invece di sollevare', () => {
    localStorage.setItem(CHIAVE, 'non sono JSON {{{')
    expect(() => leggiPreferenze()).not.toThrow()
    expect(leggiPreferenze()).toEqual(PREFERENZE_PREDEFINITE)
  })

  it('riporta dentro i limiti un valore fuori scala, senza scartare gli altri', () => {
    localStorage.setItem(CHIAVE, JSON.stringify({ schermoIntero: false, larghezza: 999, altezza: 3, anteprima: 40 }))
    const lette = leggiPreferenze()
    expect(lette.larghezza).toBe(100)
    expect(lette.altezza).toBe(40)
    expect(lette.anteprima).toBe(40)
  })

  it('un campo mancante o di tipo sbagliato prende il predefinito e non trascina gli altri', () => {
    localStorage.setItem(CHIAVE, JSON.stringify({ anteprima: 'molto', larghezza: 55 }))
    const lette = leggiPreferenze()
    expect(lette.anteprima).toBe(PREFERENZE_PREDEFINITE.anteprima)
    expect(lette.schermoIntero).toBe(PREFERENZE_PREDEFINITE.schermoIntero)
    expect(lette.larghezza).toBe(55)
  })
})

describe('percentualeAnteprima', () => {
  // Riga larga 1000 che finisce a x=1200: il divisorio a x=900 lascia 300 all'anteprima, il 30%.
  it('misura la parte di riga che resta a destra del divisorio', () => {
    expect(percentualeAnteprima(1200, 1000, 900)).toBe(30)
  })

  it('trascinando oltre il bordo destro non fa sparire l\'anteprima', () => {
    expect(percentualeAnteprima(1200, 1000, 1250)).toBe(15)
  })

  it('trascinando oltre il bordo sinistro non fa sparire la tela', () => {
    expect(percentualeAnteprima(1200, 1000, 100)).toBe(70)
  })
})

describe('dimensioneFinestra', () => {
  // La finestra resta centrata, quindi cresce in tutte le direzioni: metà larghezza è la
  // distanza dell'angolo dal centro dello schermo. Schermo 1000x800, centro (500,400):
  // l'angolo a (900, 720) dà 400*2=800 di larghezza (80%) e 320*2=640 di altezza (80%).
  it('ricava le percentuali dalla distanza dell\'angolo dal centro', () => {
    expect(dimensioneFinestra(900, 720, 1000, 800)).toEqual({ larghezza: 80, altezza: 80 })
  })

  it('non lascia rimpicciolire la finestra sotto il minimo utile', () => {
    expect(dimensioneFinestra(510, 405, 1000, 800)).toEqual({ larghezza: 40, altezza: 40 })
  })

  it('non lascia crescere la finestra oltre lo schermo', () => {
    expect(dimensioneFinestra(2000, 2000, 1000, 800)).toEqual({ larghezza: 100, altezza: 100 })
  })
})
