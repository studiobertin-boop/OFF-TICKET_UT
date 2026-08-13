/**
 * I numeri della finestra dell'editor dello schema: schermo intero, dimensioni del dialog e
 * quota di larghezza presa dall'anteprima.
 *
 * Stanno nel browser e non in banca dati perché sono preferenze di visualizzazione di chi
 * disegna, non dati della pratica: due persone che aprono lo stesso schema devono poterlo
 * guardare come preferiscono, e nessuna deve poter cambiare ciò che vede l'altra.
 *
 * L'aritmetica dei due gesti (divisorio e ridimensionamento) sta qui e non nei componenti,
 * perché qui si può collaudare: i componenti del modulo non vengono montati nei test.
 */

export interface PreferenzeEditor {
  schermoIntero: boolean
  /** Larghezza e altezza del dialog, in percentuale dello schermo. */
  larghezza: number
  altezza: number
  /** Quota di larghezza presa dall'anteprima, in percentuale della riga tela+anteprima. */
  anteprima: number
}

export const PREFERENZE_PREDEFINITE: PreferenzeEditor = {
  schermoIntero: false,
  larghezza: 90,
  altezza: 85,
  anteprima: 38,
}

/**
 * Limiti oltre i quali la finestra diventa inservibile: una tela larga il 5% non si disegna e
 * un'anteprima larga il 90% non lascia spazio al disegno.
 */
const LIMITI = {
  larghezza: [40, 100],
  altezza: [40, 100],
  anteprima: [15, 70],
} as const

const CHIAVE = 'schema-impianto-preferenze-editor'

/**
 * Riporta un valore qualunque dentro i suoi limiti. La difesa non è contro il nostro codice ma
 * contro il contenuto del browser: la chiave sopravvive agli aggiornamenti dell'applicazione,
 * quindi può contenere il formato di una versione precedente, un valore scritto a mano dagli
 * strumenti per sviluppatori, o un numero che era legittimo quando i limiti erano altri.
 */
function entroLimiti(valore: unknown, [minimo, massimo]: readonly [number, number], predefinito: number): number {
  if (typeof valore !== 'number' || !Number.isFinite(valore)) return predefinito
  return Math.min(massimo, Math.max(minimo, valore))
}

export function leggiPreferenze(): PreferenzeEditor {
  let salvato: unknown
  try {
    const grezzo = localStorage.getItem(CHIAVE)
    if (grezzo === null) return PREFERENZE_PREDEFINITE
    salvato = JSON.parse(grezzo)
  } catch {
    return PREFERENZE_PREDEFINITE
  }
  if (typeof salvato !== 'object' || salvato === null) return PREFERENZE_PREDEFINITE
  const letto = salvato as Partial<Record<keyof PreferenzeEditor, unknown>>
  return {
    schermoIntero: typeof letto.schermoIntero === 'boolean' ? letto.schermoIntero : PREFERENZE_PREDEFINITE.schermoIntero,
    larghezza: entroLimiti(letto.larghezza, LIMITI.larghezza, PREFERENZE_PREDEFINITE.larghezza),
    altezza: entroLimiti(letto.altezza, LIMITI.altezza, PREFERENZE_PREDEFINITE.altezza),
    anteprima: entroLimiti(letto.anteprima, LIMITI.anteprima, PREFERENZE_PREDEFINITE.anteprima),
  }
}

export function scriviPreferenze(preferenze: PreferenzeEditor): void {
  try {
    localStorage.setItem(CHIAVE, JSON.stringify(preferenze))
  } catch {
    // Spazio esaurito o scrittura vietata: si perde la preferenza, non la sessione di disegno.
  }
}

/**
 * Quanta parte della riga resta all'anteprima portando il divisorio sotto il puntatore.
 * `bordoDestro` e `larghezzaRiga` vengono dal riquadro della riga tela+anteprima.
 */
export function percentualeAnteprima(bordoDestro: number, larghezzaRiga: number, xPuntatore: number): number {
  const quota = ((bordoDestro - xPuntatore) / larghezzaRiga) * 100
  return entroLimiti(quota, LIMITI.anteprima, PREFERENZE_PREDEFINITE.anteprima)
}

/**
 * Dimensioni della finestra portando il suo angolo in basso a destra nel punto (x, y).
 * Il dialog resta centrato sullo schermo, quindi la finestra cresce in tutte le direzioni
 * insieme: metà larghezza è la distanza dell'angolo dal centro. Calcolarla così invece di
 * inseguire il bordo evita l'inseguimento fra puntatore ed elemento che il ricentraggio
 * produrrebbe a ogni movimento.
 */
export function dimensioneFinestra(
  x: number,
  y: number,
  larghezzaSchermo: number,
  altezzaSchermo: number,
): { larghezza: number; altezza: number } {
  return {
    larghezza: entroLimiti(
      ((x - larghezzaSchermo / 2) * 2 * 100) / larghezzaSchermo,
      LIMITI.larghezza,
      PREFERENZE_PREDEFINITE.larghezza,
    ),
    altezza: entroLimiti(
      ((y - altezzaSchermo / 2) * 2 * 100) / altezzaSchermo,
      LIMITI.altezza,
      PREFERENZE_PREDEFINITE.altezza,
    ),
  }
}
