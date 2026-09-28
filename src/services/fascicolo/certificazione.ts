import type { CertificazioneRecipiente } from '@/types/technicalSheet'

/**
 * Regime di certificazione di un recipiente, dedotto dalle direttive che il suo certificato CE
 * cita.
 *
 * Il modello che classifica i documenti trascrive soltanto i riferimenti normativi che legge;
 * la corrispondenza con RSP o PED si decide qui, in codice, perché è una tabella chiusa e va
 * verificata con i test — non lasciata all'interpretazione di chi legge il certificato.
 *
 * RSP — recipienti semplici a pressione:
 *   87/404/CEE (prima direttiva), 90/488/CEE (che la modifica), 2009/105/CE (testo codificato),
 *   2014/29/UE (rifusione in vigore); in Italia D.Lgs. 311/1991.
 * PED — attrezzature a pressione:
 *   97/23/CE (prima direttiva), 2014/68/UE (rifusione in vigore); in Italia D.Lgs. 93/2000.
 *
 * Il D.Lgs. 26/2016 recepisce entrambe le rifusioni del 2014 e non distingue: non si usa.
 */

/** Numero di direttiva o decreto, nelle due grafie in uso: «2014/29» e «29/2014». */
const citazione = (anno: string, numero: string) =>
  new RegExp(`(?<!\\d)(?:${anno}\\s*/\\s*${numero}|${numero}\\s*/\\s*${anno})(?!\\d)`)

const RSP = [
  citazione('2014', '29'),
  citazione('(?:19)?87', '404'),
  citazione('(?:19)?90', '488'),
  citazione('2009', '105'),
  // D.Lgs. 311/1991: il numero da solo è troppo comune, si pretende l'anno.
  /(?<!\d)311\s*\/\s*(?:19)?91(?!\d)/,
]

const PED = [
  citazione('2014', '68'),
  citazione('(?:19)?97', '23'),
  // D.Lgs. 93/2000, anche «93/00».
  /(?<!\d)93\s*\/\s*(?:20)?00(?!\d)/,
]

/** Nomi per esteso: valgono solo quando manca ogni numero, perché sono meno precisi. */
const RSP_PAROLE = /simple pressure vessel|recipient[ei] semplic[ei]|\br\.?s\.?p\b|\bspvd?\b/i
const PED_PAROLE = /pressure equipment|attrezzature a pressione|\bped\b/i

const trova = (testo: string, schemi: RegExp[]) => schemi.some((r) => r.test(testo))

/**
 * @param citate riferimenti normativi trascritti dal certificato, come compaiono
 * @returns RSP o PED; `null` se non si riconosce nulla o se il certificato cita direttive di
 *   entrambi i regimi — in quel caso decide chi legge, dal dettaglio del recipiente.
 */
export function certificazioneDaDirettive(citate: readonly string[]): CertificazioneRecipiente | null {
  const testo = citate.join(' ; ')
  if (!testo.trim()) return null

  const rsp = trova(testo, RSP)
  const ped = trova(testo, PED)
  if (rsp !== ped) return rsp ? 'RSP' : 'PED'
  if (rsp && ped) return null

  const rspParole = RSP_PAROLE.test(testo)
  const pedParole = PED_PAROLE.test(testo)
  if (rspParole !== pedParole) return rspParole ? 'RSP' : 'PED'
  return null
}
