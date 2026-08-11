import { completezzaScheda, eCompleta, percentuale, righeComplete } from './schedaCompleteness'
import type { Request } from '@/types'

/**
 * Stato di compilazione della scheda dati di una pratica DM329.
 *
 * Serve all'elenco pratiche, dove sta accanto agli altri indicatori (urgente, bloccata,
 * scaduta, no CIVA) e risponde a una domanda che prima costringeva ad aprire la scheda:
 * questa pratica ha già i dati?
 *
 * Si desume dai contatori della scheda — gli stessi che la scheda stessa mostra — e si
 * ricalcola a ogni lettura: aggiungere un'apparecchiatura da compilare fa tornare
 * «parziale» una scheda completa senza che nessuno debba ricordarsi di aggiornare niente.
 * Resta però imponibile a mano, perché il grado di compilazione non è la verità di ogni
 * pratica: una scheda può essere «finita» pur avendo campi che non si sapranno mai.
 */
export type StatoScheda = 'vuota' | 'parziale' | 'completa'

/** Chiave in `requests.custom_fields` dove vive lo stato imposto a mano. */
export const CAMPO_STATO_SCHEDA = 'stato_scheda'

export const STATO_SCHEDA_LABELS: Record<StatoScheda, string> = {
  vuota: 'Scheda vuota',
  parziale: 'Scheda parzialmente compilata',
  completa: 'Scheda completa',
}

export interface CompilazioneScheda {
  stato: StatoScheda
  /**
   * Percentuale desunta dai contatori, 0–100. Resta quella reale anche quando lo stato è
   * imposto: il comando manuale cambia come si legge la scheda, non quanto è compilata.
   */
  percentuale: number
  /** Vero quando lo stato mostrato è stato imposto e non desunto. */
  manuale: boolean
}

const STATI: readonly string[] = ['vuota', 'parziale', 'completa']

/** Lo stato imposto a mano, se il valore salvato è uno di quelli previsti. */
export const statoManuale = (custom: Record<string, any> | undefined | null): StatoScheda | null => {
  const v = custom?.[CAMPO_STATO_SCHEDA]
  return typeof v === 'string' && STATI.includes(v) ? (v as StatoScheda) : null
}

/**
 * Stato desunto dai contatori.
 *
 * «Vuota» non è «zero per cento»: le spunte e i campi con un default applicato dal motore
 * risultano compilati anche su una scheda mai aperta, e senza distinguerli una pratica senza
 * scheda mostrerebbe un 30% inesistente. Vuota è quindi la scheda su cui nessuno ha ancora
 * scritto niente e che non porta apparecchiature: aggiungerne una, anche tutta da compilare,
 * è già cominciare.
 *
 * La percentuale resta quella che la scheda stessa mostra nella propria testata, e sta fra
 * 1 e 99 finché non si arriva agli estremi: uno «0%» su una scheda appena iniziata o un
 * «100%» su una a cui manca un campo direbbero il falso proprio sui due casi che l'icona
 * distingue con una forma propria.
 */
export const statoDesunto = (scheda: unknown): { stato: StatoScheda; percentuale: number } => {
  const c = completezzaScheda(scheda)
  if (c.valorizzati === 0 && righeComplete(scheda).totali === 0) {
    return { stato: 'vuota', percentuale: 0 }
  }
  if (eCompleta(c)) return { stato: 'completa', percentuale: 100 }
  return { stato: 'parziale', percentuale: Math.min(99, Math.max(1, percentuale(c))) }
}

/** Stato da mostrare: quello imposto a mano se c'è, altrimenti quello desunto. */
export const compilazioneScheda = (
  scheda: unknown,
  custom?: Record<string, any> | null,
): CompilazioneScheda => {
  const desunto = statoDesunto(scheda)
  const imposto = statoManuale(custom)
  return imposto
    ? { stato: imposto, percentuale: desunto.percentuale, manuale: true }
    : { ...desunto, manuale: false }
}

/**
 * Chiave d'ordinamento: 0 vuota, 100 completa, la percentuale in mezzo. Ordina per quanto
 * la scheda è avanti, che è la domanda che ci si fa cliccando su quella colonna.
 */
export const ordineCompilazione = (c: CompilazioneScheda): number =>
  c.stato === 'vuota' ? 0 : c.stato === 'completa' ? 100 : c.percentuale

/**
 * La scheda agganciata a una pratica, qualunque forma abbia preso l'aggancio.
 * `request_id` è unico e PostgREST restituisce un oggetto; l'elenco è il ripiego.
 */
export const schedaDi = (request: Pick<Request, 'technical_data'>): Record<string, any> | null => {
  const agganciata = request.technical_data
  const riga = Array.isArray(agganciata) ? agganciata[0] : agganciata
  return riga?.equipment_data ?? null
}

/** Compilazione di una pratica: scheda agganciata e stato imposto, letti insieme. */
export const compilazioneDiPratica = (
  request: Pick<Request, 'technical_data' | 'custom_fields'>,
): CompilazioneScheda => compilazioneScheda(schedaDi(request), request.custom_fields)
