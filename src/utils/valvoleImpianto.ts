/**
 * Convenzione delle posizioni delle valvole di sicurezza e loro enumerazione.
 *
 * Vive fuori da `services/relazione` perché serve anche alla scheda dati: il selettore
 * «protetto dalla valvola» dei recipienti filtro e degli scambiatori deve proporre le
 * stesse posizioni che la relazione poi stampa.
 *
 * Convenzione:
 * - serbatoio `Sx`   → valvole `Sx.1`, `Sx.2`, …
 * - disoleatore `Cx.1` → valvole `Cx.2`, `Cx.3`, … (il .1 è occupato dal disoleatore)
 */
import type { SchedaDatiCompleta, ValvolaSicurezza } from '@/types/technicalSheet'

/** Codici di tutte le valvole di un serbatoio: S1 → ['S1.1', 'S1.2', …]. */
export function codiciValvoleSerbatoio(serbatoioCodice: string, count: number): string[] {
  return Array.from({ length: Math.max(count, 0) }, (_, i) => `${serbatoioCodice}.${i + 1}`)
}

/** Codici di tutte le valvole di un disoleatore: C1.1 → ['C1.2', 'C1.3', …]. */
export function codiciValvoleDisoleatore(disoleatoreCodice: string, count: number): string[] {
  const base = disoleatoreCodice.split('.')[0]
  return Array.from({ length: Math.max(count, 0) }, (_, i) => `${base}.${i + 2}`)
}

/** Valvola principale + eventuali aggiuntive, nell'ordine in cui sono numerate. */
export function valvoleDi(
  principale: ValvolaSicurezza,
  aggiuntive?: ValvolaSicurezza[]
): ValvolaSicurezza[] {
  return [principale, ...(aggiuntive ?? [])]
}

export interface ValvolaImpianto {
  /** Posizione secondo la convenzione (es. 'S1.1', 'C1.2') */
  pos: string
  /** Posizione del recipiente che la porta (es. 'S1', 'C1.1') */
  recipiente: string
  valvola: ValvolaSicurezza
}

/**
 * Tutte le valvole censite nella scheda, in ordine di impianto: prima quelle dei
 * disoleatori, poi quelle dei serbatoi. È l'elenco da cui scegliere nel selettore
 * «protetto dalla valvola» e con cui risolvere i riferimenti in relazione.
 */
export function elencaValvole(scheda: SchedaDatiCompleta): ValvolaImpianto[] {
  const out: ValvolaImpianto[] = []

  for (const c of scheda.compressori ?? []) {
    const diso = (scheda.disoleatori ?? []).find((d) => d.compressore_associato === c.codice)
    if (!diso) continue
    const valvole = valvoleDi(diso.valvola_sicurezza, diso.valvole_aggiuntive)
    codiciValvoleDisoleatore(diso.codice, valvole.length).forEach((pos, i) => {
      out.push({ pos, recipiente: diso.codice, valvola: valvole[i] })
    })
  }

  for (const s of scheda.serbatoi ?? []) {
    const valvole = valvoleDi(s.valvola_sicurezza, s.valvole_aggiuntive)
    codiciValvoleSerbatoio(s.codice, valvole.length).forEach((pos, i) => {
      out.push({ pos, recipiente: s.codice, valvola: valvole[i] })
    })
  }

  return out
}

/** Risolve un elenco di posizioni nelle valvole corrispondenti, scartando i riferimenti orfani. */
export function risolviValvole(
  scheda: SchedaDatiCompleta,
  posizioni: string[] | undefined
): ValvolaImpianto[] {
  if (!posizioni?.length) return []
  const indice = new Map(elencaValvole(scheda).map((v) => [v.pos, v]))
  return posizioni
    .map((p) => indice.get(p))
    .filter((v): v is ValvolaImpianto => v !== undefined)
}
