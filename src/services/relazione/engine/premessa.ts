/**
 * Engine — copertina e §1 PREMESSA.
 * Produce testi e flag già risolti (nessuna logica lasciata al template).
 */
import type { Customer } from '@/types'
import type { AdditionalInfo, PraticaInfo, PremessaModel } from '../types'

export interface PremessaInput {
  customer: Customer
  /** Dati del codice pratica: unica sorgente dell'ubicazione dell'impianto */
  pratica: PraticaInfo
  additionalInfo: AdditionalInfo
}

/** Le due parti di un indirizzo cliente: "via n° civico" e "cap comune (provincia)". */
function parti(c: Customer): { via: string; localita: string } {
  const via = [c.via, c.numero_civico ? `n° ${c.numero_civico}` : ''].filter(Boolean).join(' ')
  const comune = [c.cap, c.comune].filter(Boolean).join(' ')
  return {
    via,
    localita: [comune, c.provincia ? `(${c.provincia})` : ''].filter(Boolean).join(' '),
  }
}

/** Indirizzo su una riga: "via n° civico, cap comune (provincia)". Per la prosa di §1. */
function formatIndirizzo(c: Customer): string {
  const { via, localita } = parti(c)
  return [via, localita].filter(Boolean).join(', ')
}

/**
 * Indirizzo su due righe per la copertina, dove la località va a capo.
 * Il ritorno a capo diventa un `<w:br/>`: docxtemplater è configurato con
 * `linebreaks: true`, quindi resta un solo paragrafo e la spaziatura non cambia.
 */
function formatIndirizzoCopertina(c: Customer): string {
  const { via, localita } = parti(c)
  if (!via) return localita
  if (!localita) return via
  return `${via},\n${localita}`
}

export function buildPremessa(input: PremessaInput): PremessaModel {
  const { customer, pratica, additionalInfo } = input

  const sedeLegale = formatIndirizzo(customer)
  const indirizzoImpianto = pratica.indirizzoImpianto?.trim() || ''
  const uguale = pratica.impiantoUgualeSedeLegale === true || indirizzoImpianto === ''

  const sitoProduttivo = uguale ? sedeLegale : indirizzoImpianto

  // Clausola di ubicazione, con l'eventuale denominazione della sala compressori.
  const sala = pratica.denominazioneSala?.trim()
  const ubicazione = [
    uguale ? 'ubicato presso la medesima sede sociale' : `ubicato in ${indirizzoImpianto}`,
    sala ? `ed individuato come ${sala}` : '',
  ]
    .filter(Boolean)
    .join(' ')

  const descrizioneAttivita =
    additionalInfo.descrizioneAttivita?.trim() || customer.descrizione_attivita || ''

  // In copertina l'indirizzo va su due righe; nella prosa di §1 su una sola. Il sito
  // produttivo dichiarato a mano è testo libero e non si può spezzare in modo affidabile:
  // resta su una riga.
  const sedeLegaleCopertina = formatIndirizzoCopertina(customer)

  return {
    ragioneSociale: customer.ragione_sociale,
    sedeLegale,
    sedeLegaleCopertina,
    sitoProduttivo,
    sitoProduttivoCopertina: uguale ? sedeLegaleCopertina : indirizzoImpianto,
    descrizioneAttivita,
    ubicazione,
    // «Uguale» per dichiarazione esplicita è un dato; «uguale» per indirizzo assente è
    // un ripiego, e il preflight deve poterli distinguere.
    ubicazioneDichiarata:
      pratica.impiantoUgualeSedeLegale === true || indirizzoImpianto !== '',
    // Il documento è una revisione quando il progressivo del codice pratica è oltre lo
    // zero. Il motivo non viene generato: resta uno spazio evidenziato che il redattore
    // compila in Word, perché è una valutazione tecnica, non un dato della scheda.
    haRevisione: (pratica.progressivo ?? 0) > 0,
    haSpessimetrica: (additionalInfo.spessimetrica ?? []).length > 0,
  }
}
