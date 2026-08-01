/**
 * Preflight di completezza — elenca ciò che manca *prima* di generare il documento.
 *
 * È la risposta al difetto più visibile della stampa unione che sostituiamo: produceva
 * relazioni disseminate di `#N/A` e di celle vuote, e chi le leggeva non poteva sapere
 * se una cella vuota significasse «non dovuto» oppure «non compilato».
 *
 * Due livelli soltanto:
 * - `errore` — il documento affermerebbe il falso o resterebbe incompleto in un punto
 *   che il valutatore INAIL guarda. Va corretto nella scheda, non in Word.
 * - `avviso` — informazione che il redattore deve conoscere, ma che può legittimamente
 *   restare com'è (lo schema d'impianto assente, ad esempio, non è un dato mancante:
 *   l'immagine non viene persistita, quindi la sua assenza è uno stato normale).
 *
 * Lavora sul `RelazioneModel` e non sulla scheda: così controlla esattamente ciò che
 * finirà nel documento, senza rifare i calcoli dell'engine con regole leggermente diverse.
 */
import { comportaAdempimento } from '@/utils/dm329Classification'
import type { RelazioneModel, Segnalazione } from './types'

/** Aggiunge una segnalazione se ci sono posizioni interessate. */
function perPosizioni(
  out: Segnalazione[],
  livello: Segnalazione['livello'],
  codice: string,
  posizioni: string[],
  messaggio: (n: number) => string
): void {
  if (posizioni.length === 0) return
  out.push({ livello, codice, messaggio: messaggio(posizioni.length), posizioni })
}

export function validateRelazione(model: RelazioneModel): Segnalazione[] {
  const out: Segnalazione[] = []
  const { premessa, esiti, valvole, tubazioni } = model

  // --- Anagrafica cliente -----------------------------------------------------------
  if (!premessa.ragioneSociale.trim()) {
    out.push({
      livello: 'errore',
      codice: 'cliente-ragione-sociale',
      messaggio: 'Ragione sociale del cliente mancante: comparirebbe in copertina come spazio vuoto.',
    })
  }
  if (!premessa.sedeLegale.replace(/[,\s()]/g, '')) {
    out.push({
      livello: 'errore',
      codice: 'cliente-sede-legale',
      messaggio: 'Sede legale del cliente incompleta: va compilata nell’anagrafica cliente.',
    })
  }
  if (!premessa.descrizioneAttivita.trim()) {
    out.push({
      livello: 'errore',
      codice: 'cliente-descrizione-attivita',
      messaggio: 'Descrizione dell’attività mancante: la premessa resterebbe monca.',
    })
  }
  if (!premessa.ubicazioneDichiarata) {
    out.push({
      livello: 'avviso',
      codice: 'ubicazione-non-dichiarata',
      messaggio:
        'Ubicazione dell’impianto non dichiarata nel codice pratica: la relazione lo darà per ' +
        'ubicato presso la sede legale.',
    })
  }

  // --- Apparecchiature --------------------------------------------------------------
  if (esiti.length === 0) {
    out.push({
      livello: 'errore',
      codice: 'nessuna-apparecchiatura',
      messaggio: 'Nessuna apparecchiatura nella scheda: la relazione sarebbe priva di oggetto.',
    })
  }

  perPosizioni(
    out,
    'errore',
    'recipiente-dati-insufficienti',
    esiti.filter((r) => r.recipiente && r.esito === null).map((r) => r.pos),
    (n) =>
      `${n === 1 ? 'Un recipiente non è classificabile' : `${n} recipienti non sono classificabili`}: ` +
      'manca il volume o la pressione massima (PS).'
  )

  perPosizioni(
    out,
    'errore',
    'categoria-ped-mancante',
    esiti.filter((r) => comportaAdempimento(r.esito) && !r.categoria).map((r) => r.pos),
    (n) =>
      `${n === 1 ? 'Un recipiente soggetto' : `${n} recipienti soggetti`} ad adempimento ` +
      'è senza categoria PED: la frequenza di riqualificazione non è determinabile.'
  )

  // --- Valvole di sicurezza ---------------------------------------------------------
  perPosizioni(
    out,
    'errore',
    'valvola-portata-insufficiente',
    valvole.portata.filter((r) => r.applicabile && r.datiCompleti && !r.adeguato).map((r) => r.posValvola),
    (n) =>
      `${n === 1 ? 'Una valvola scarica' : `${n} valvole scaricano`} meno della portata dei ` +
      'compressori collegati: la verifica di §6.1 non è superata.'
  )

  perPosizioni(
    out,
    'errore',
    'valvola-taratura-superiore',
    valvole.pressione.filter((r) => r.datiCompleti && !r.adeguato).map((r) => r.posValvola),
    (n) =>
      `${n === 1 ? 'Una valvola è tarata' : `${n} valvole sono tarate`} sopra la PS del ` +
      'recipiente che protegge: la verifica di §6.2 non è superata.'
  )

  perPosizioni(
    out,
    'errore',
    'valvola-dati-mancanti',
    [
      ...valvole.portata.filter((r) => r.applicabile && !r.datiCompleti).map((r) => r.posValvola),
      ...valvole.pressione.filter((r) => !r.datiCompleti).map((r) => r.posValvola),
    ].filter((pos, i, tutte) => tutte.indexOf(pos) === i),
    (n) =>
      `${n === 1 ? 'Una valvola non è verificabile' : `${n} valvole non sono verificabili`}: ` +
      'mancano portata scaricata, taratura o PS del recipiente. In tabella comparirà «n.d.».'
  )

  perPosizioni(
    out,
    'avviso',
    'valvola-senza-compressori',
    valvole.portata.filter((r) => !r.applicabile).map((r) => r.posValvola),
    (n) =>
      `${n === 1 ? 'Una valvola non ha' : `${n} valvole non hanno`} compressori collegati: ` +
      'la verifica di portata non è definita e la tabella riporterà «n.a.». ' +
      'Se il collegamento esiste, va dichiarato qui sopra.'
  )

  // --- Tubazioni (A4) ---------------------------------------------------------------
  if (!tubazioni.escluse) {
    out.push({
      livello: 'avviso',
      codice: 'tubazioni-oltre-soglia',
      messaggio:
        `Diametro nominale massimo dichiarato DN ${tubazioni.dnMassimo}, oltre la soglia di ` +
        'esclusione di 80 mm: le tubazioni rientrano nel campo di applicazione e la relazione ' +
        'segnalerà la necessità di denuncia PED.',
    })
  } else if (!tubazioni.dnMassimo) {
    out.push({
      livello: 'avviso',
      codice: 'tubazioni-dn-non-dichiarati',
      messaggio:
        'Diametri delle tubazioni non dichiarati nella scheda: la relazione le dà per escluse ' +
        '(DN ≤ 80 mm) senza averlo verificato.',
    })
  }

  // --- Documento ---------------------------------------------------------------------
  if (!model.schemaImpianto) {
    out.push({
      livello: 'avviso',
      codice: 'schema-assente',
      messaggio: 'Nessuno schema d’impianto scelto: il paragrafo §2.3 resterà vuoto.',
    })
  }
  // Data del sopralluogo e nome del tecnico non compaiono più nel documento (scelta FB
  // sulla copertina): un controllo su dati che nessuno legge sarebbe solo rumore.

  return out
}

/** Vero se almeno una segnalazione è di livello `errore`. */
export function haErrori(segnalazioni: Segnalazione[]): boolean {
  return segnalazioni.some((s) => s.livello === 'errore')
}
