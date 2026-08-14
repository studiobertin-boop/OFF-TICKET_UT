import { beforeEach, describe, expect, it } from 'vitest'
import {
  PREFERENZE_PREDEFINITE,
  dimensioneFinestra,
  leggiPreferenze,
  percentualeAnteprima,
  scostamentoManiglia,
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

  // leggiPreferenze() deve restituire un oggetto proprio, non l'identità di PREFERENZE_PREDEFINITE:
  // due chiamate non devono condividere memoria, altrimenti mutare il risultato in un consumatore
  // corromperebbe anche il valore di ripiego usato dal resto del modulo.
  it('non restituisce l\'identità della costante condivisa: mutarlo non tocca i predefiniti', () => {
    const lette = leggiPreferenze()
    lette.larghezza = 999
    expect(PREFERENZE_PREDEFINITE.larghezza).toBe(90)
  })
})

describe('percentualeAnteprima', () => {
  // Riga larga 1000 che finisce a x=1200: il divisorio a x=900 lascia 300 all'anteprima, il 30%.
  it('misura la parte di riga che resta a destra del divisorio', () => {
    expect(percentualeAnteprima(1200, 1000, 900)).toBe(30)
  })

  // Il limite inferiore non è fisso al 15%: su questa riga da 1000px i 280px di
  // LARGHEZZA_MINIMA_ANTEPRIMA valgono il 28%, più del 15%, quindi è quello a vincere (Important
  // 1: prima di questa correzione il divisorio si fermava a 280px resi mentre la preferenza
  // scendeva fino al 15%, una zona morta di ~77px in cui trascinare non aveva alcun effetto).
  it('trascinando oltre il bordo destro non fa sparire l\'anteprima', () => {
    expect(percentualeAnteprima(1200, 1000, 1250)).toBeCloseTo(28)
  })

  it('trascinando oltre il bordo sinistro non fa sparire la tela', () => {
    expect(percentualeAnteprima(1200, 1000, 100)).toBe(70)
  })

  // Riga stretta (700px): i 280px di LARGHEZZA_MINIMA_ANTEPRIMA valgono il 40%, più del 15%
  // fisso — qui deve vincere il minimo in pixel. Un'implementazione che clampasse sempre al 15%
  // fisso (il vecchio comportamento, prima dell'Important 1) darebbe 15 invece di 40.
  it('su una riga stretta il minimo in pixel vince sul 15% fisso', () => {
    expect(percentualeAnteprima(700, 700, 693)).toBe(40)
  })

  // Riga larga (4000px): i 280px valgono solo il 7%, meno del 15% fisso — qui deve vincere il
  // 15%, esattamente come nel comportamento di sempre.
  it('su una riga larga vince il 15% fisso', () => {
    expect(percentualeAnteprima(4000, 4000, 3990)).toBe(15)
  })
})

describe('dimensioneFinestra', () => {
  // La finestra resta centrata, quindi cresce in tutte le direzioni: metà larghezza è la
  // distanza dell'angolo dal centro dello schermo. Schermo 1000x800, centro (500,400):
  // l'angolo a (900, 600) dà 400*2=800 di larghezza (80%) e 200*2=400 di altezza (50%).
  // Larghezza e altezza attese diverse apposta: un'implementazione che calcolasse l'altezza
  // copiando l'espressione della larghezza (ignorando y e altezzaSchermo) darebbe {80, 80} e
  // cadrebbe qui.
  it('ricava le percentuali dalla distanza dell\'angolo dal centro', () => {
    expect(dimensioneFinestra(900, 600, 1000, 800)).toEqual({ larghezza: 80, altezza: 50 })
  })

  it('non lascia rimpicciolire la finestra sotto il minimo utile', () => {
    expect(dimensioneFinestra(510, 405, 1000, 800)).toEqual({ larghezza: 40, altezza: 40 })
  })

  it('non lascia crescere la finestra oltre lo schermo', () => {
    expect(dimensioneFinestra(2000, 2000, 1000, 800)).toEqual({ larghezza: 100, altezza: 100 })
  })
})

describe('scostamentoManiglia', () => {
  // Schermo 1000x800, finestra all'80% di larghezza e 50% di altezza: l'angolo vero è a
  // (900, 600) (stessi numeri del primo caso di dimensioneFinestra, letti alla rovescia).
  // La maniglia sta 22px a sinistra e 24px sopra quell'angolo: valori diversi apposta, come
  // misurato in pagina, così un'implementazione che scambiasse ascissa e ordinata cadrebbe qui.
  it('misura quanto la maniglia è spostata dall\'angolo vero della finestra', () => {
    expect(scostamentoManiglia(878, 576, 1000, 800, 80, 50)).toEqual({ dx: 22, dy: 24 })
  })

  // Un altro schermo (1200x900, non più 1000x800) e un'altra finestra (60% x 90%, angolo a
  // (960, 855)) con uno scostamento diverso sui due assi (10 e 35): un secondo punto di
  // misura, indipendente dal primo.
  it('vale anche con un\'altra finestra e un altro punto di presa', () => {
    expect(scostamentoManiglia(950, 820, 1200, 900, 60, 90)).toEqual({ dx: 10, dy: 35 })
  })

  // L'invariante che dice "non salta": sommando lo scostamento al punto di presa si ottiene
  // sempre l'angolo vero, qualunque sia il punto in cui si è afferrata la maniglia — quindi
  // dimensioneFinestra(x+dx, y+dy, ...) restituisce esattamente le percentuali di partenza.
  it('compensa esattamente: dimensioneFinestra(x+dx, y+dy, ...) torna alle percentuali di partenza', () => {
    const larghezzaSchermo = 1000
    const altezzaSchermo = 800
    const larghezza = 80
    const altezza = 50
    for (const [x, y] of [
      [700, 500],
      [123, 456],
      [900, 600], // proprio sull'angolo: scostamento nullo, deve restare esatto anche qui
    ]) {
      const { dx, dy } = scostamentoManiglia(x, y, larghezzaSchermo, altezzaSchermo, larghezza, altezza)
      expect(dimensioneFinestra(x + dx, y + dy, larghezzaSchermo, altezzaSchermo)).toEqual({ larghezza, altezza })
    }
  })
})
