/**
 * Quando scadono i documenti di un fascicolo.
 *
 * I file caricati non restano per sempre: un archivio che cresce e non si svuota diventa un
 * costo e un rischio. La data di cancellazione si legge dallo stato della pratica, e questa è
 * l'unica dichiarazione della regola — la usano sia l'interfaccia, che mostra la data al
 * tecnico, sia la Edge Function che di notte cancella davvero.
 *
 * Il modulo non importa nulla apposta: viene caricato anche da Deno, dove `@/` non esiste.
 */

/**
 * Stati che avviano il conto dei 30 giorni. Solo il vocabolario DM329: `COMPLETATA`, del
 * vocabolario vecchio, non ospita schede tecniche e quindi nemmeno fascicoli.
 *
 * `ARCHIVIATA NON FINITA` ha spazi, non trattini bassi: è la stringa esatta che sta a database.
 */
export const STATI_CHIUSI: readonly string[] = ['7-CHIUSA', 'ARCHIVIATA NON FINITA']

/** Giorni dopo il passaggio in uno stato chiuso. */
export const GIORNI_DOPO_CHIUSURA = 30

/** Tetto: giorni senza alcun movimento, qualunque sia lo stato. */
export const GIORNI_SENZA_MOVIMENTO = 180

/** Con meno giorni di questi alla cancellazione si preavvisa. */
export const GIORNI_PREAVVISO = 7

const GIORNO = 24 * 60 * 60 * 1000

/** Ciò che della pratica serve a datare la scadenza. */
export interface MovimentoPratica {
  stato: string
  /** Ultimo cambio di stato, da `request_history`. Null per le pratiche senza storia. */
  ultimoCambioStato: string | null
  /** Ultima modifica qualsiasi: `requests.updated_at`. */
  aggiornataIl: string | null
  /** Ripiego quando la storia manca. */
  creataIl: string
}

/** Millisecondi di una data ISO, o NaN se assente o illeggibile. */
const istante = (iso: string | null | undefined): number => (iso ? Date.parse(iso) : NaN)

/**
 * Data in cui i documenti della pratica vanno cancellati.
 *
 * È il **minimo** fra le due scadenze, e il minimo è ciò che rende i 180 giorni un tetto vero:
 * una pratica chiusa scade a 30 giorni anche se la si continua a ritoccare.
 */
export const dataCancellazione = (p: MovimentoPratica): Date => {
  const creata = istante(p.creataIl)
  const cambio = Number.isNaN(istante(p.ultimoCambioStato)) ? creata : istante(p.ultimoCambioStato)
  const modifica = Number.isNaN(istante(p.aggiornataIl)) ? cambio : istante(p.aggiornataIl)

  const perImmobilita = Math.max(cambio, modifica) + GIORNI_SENZA_MOVIMENTO * GIORNO
  const perChiusura = STATI_CHIUSI.includes(p.stato)
    ? cambio + GIORNI_DOPO_CHIUSURA * GIORNO
    : Number.POSITIVE_INFINITY

  return new Date(Math.min(perChiusura, perImmobilita))
}

/** La scadenza vista da un certo momento. */
export interface StatoScadenza {
  data: Date
  /** Negativi quando la data è passata. */
  giorniMancanti: number
  scaduta: boolean
  /** Dentro la finestra di preavviso o scaduta da meno di 24 ore: il preavviso resta acceso finché la passata notturna non cancella davvero i documenti. */
  inPreavviso: boolean
}

export const statoScadenza = (p: MovimentoPratica, adesso: Date): StatoScadenza => {
  const data = dataCancellazione(p)
  let giorniMancanti = Math.round((data.getTime() - adesso.getTime()) / GIORNO)
  // Normalizza -0 a 0, altrimenti finisce in interfaccia come "-0 giorni"
  if (Object.is(giorniMancanti, -0)) giorniMancanti = 0
  const scaduta = data.getTime() <= adesso.getTime()
  return { data, giorniMancanti, scaduta, inPreavviso: giorniMancanti >= 0 && giorniMancanti <= GIORNI_PREAVVISO }
}
