/**
 * Engine — copertina e §1 PREMESSA.
 * Produce testi e flag già risolti (nessuna logica lasciata al template).
 */
import type { Customer } from '@/types'
import type { AdditionalInfo, PraticaInfo, PremessaModel } from '../types'
import { formatDataIT } from '../helpers'

export interface PremessaInput {
  customer: Customer
  /** Dati del codice pratica: unica sorgente dell'ubicazione dell'impianto */
  pratica: PraticaInfo
  additionalInfo: AdditionalInfo
}

/**
 * Gli indirizzi vanno in maiuscolo comunque siano stati digitati in anagrafica: nel
 * documento sono un'intestazione, e la loro forma non deve dipendere da chi ha compilato
 * la scheda.
 */
function maiuscolo(testo: string): string {
  return testo.toUpperCase()
}

/** Le due parti di un indirizzo cliente: "via n° civico" e "cap comune (provincia)". */
function parti(c: Customer): { via: string; localita: string } {
  const via = [c.via, c.numero_civico ? `n° ${c.numero_civico}` : ''].filter(Boolean).join(' ')
  const comune = [c.cap, c.comune].filter(Boolean).join(' ')
  return {
    via: maiuscolo(via),
    localita: maiuscolo([comune, c.provincia ? `(${c.provincia})` : ''].filter(Boolean).join(' ')),
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
  const indirizzoImpianto = maiuscolo(pratica.indirizzoImpianto?.trim() || '')
  const uguale = pratica.impiantoUgualeSedeLegale === true || indirizzoImpianto === ''

  const sitoProduttivo = uguale ? sedeLegale : indirizzoImpianto

  // Clausola di ubicazione. La denominazione della sala non è inclusa qui: va resa in
  // corsivo fra virgolette, quindi il template la stampa con un run proprio.
  const sala = pratica.denominazioneSala?.trim()
  const ubicazione = uguale
    ? 'ubicato presso la medesima sede sociale'
    : `ubicato in ${indirizzoImpianto}`

  const descrizioneAttivita =
    additionalInfo.descrizioneAttivita?.trim() || customer.descrizione_attivita || ''

  const motivoRevisione = additionalInfo.motivoRevisione?.trim() ?? ''

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
    // Denominazione della sala: il flag regola la sezione condizionale, il testo virgolettato
    // entra in un run in corsivo del template.
    haDenominazioneSala: Boolean(sala),
    denominazioneSala: sala ? `“${sala}”` : '',
    // Numero di revisione dal codice pratica. Alla prima emissione la nota è generata;
    // dalla prima revisione in poi la scrive il tecnico, perché è una valutazione sua.
    numeroRevisione: String(pratica.progressivo ?? 0),
    notaRevisione: (pratica.progressivo ?? 0) === 0 ? 'prima emissione' : '',
    dataEmissione: formatDataIT(additionalInfo.dataEmissione),
    motivoRevisione,
    // «Uguale» per dichiarazione esplicita è un dato; «uguale» per indirizzo assente è
    // un ripiego, e il preflight deve poterli distinguere.
    ubicazioneDichiarata:
      pratica.impiantoUgualeSedeLegale === true || indirizzoImpianto !== '',
    // Il capoverso di revisione vuole due cose insieme: che il progressivo del codice
    // pratica sia oltre lo zero e che il tecnico abbia scritto perché. Il motivo resta una
    // valutazione sua — il motore non lo genera — ma senza il capoverso non compare, così
    // il documento non annuncia una revisione di cui non sa dire la ragione.
    haRevisione: (pratica.progressivo ?? 0) > 0 && motivoRevisione !== '',
    haSpessimetrica: (additionalInfo.spessimetrica ?? []).length > 0,
  }
}
