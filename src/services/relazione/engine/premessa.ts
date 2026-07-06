/**
 * Engine — sezione PREMESSA + copertina.
 * Produce testi e flag già risolti (nessuna logica lasciata al template).
 */
import type { Customer } from '@/types'
import type { DatiImpianto } from '@/types/technicalSheet'
import type { AdditionalInfo, PremessaModel } from '../types'

export interface PremessaInput {
  customer: Customer
  datiImpianto: DatiImpianto
  additionalInfo: AdditionalInfo
}

/** Formatta un indirizzo cliente: "via n° civico, cap comune (provincia)". */
function formatIndirizzo(c: Customer): string {
  const riga1 = [c.via, c.numero_civico ? `n° ${c.numero_civico}` : '']
    .filter(Boolean)
    .join(' ')
  const localita = [c.cap, c.comune].filter(Boolean).join(' ')
  const conProvincia = [localita, c.provincia ? `(${c.provincia})` : '']
    .filter(Boolean)
    .join(' ')
  return [riga1, conProvincia].filter(Boolean).join(', ')
}

export function buildPremessa(input: PremessaInput): PremessaModel {
  const { customer, datiImpianto, additionalInfo } = input

  const sedeLegale = formatIndirizzo(customer)
  const uguale = datiImpianto.sede_imp_uguale_legale
  const indirizzoImpianto = datiImpianto.sede_impianto || ''

  const sitoProduttivo = uguale ? sedeLegale : indirizzoImpianto
  const ubicazione = uguale
    ? 'ubicato presso la medesima sede sociale'
    : `ubicato in ${indirizzoImpianto}`

  const motivoRevisione = additionalInfo.motivoRevisione?.trim() || ''
  const spessimetrica = additionalInfo.spessimetrica ?? []
  const descrizioneAttivita =
    additionalInfo.descrizioneAttivita?.trim() || customer.descrizione_attivita || ''

  return {
    ragioneSociale: customer.ragione_sociale,
    sedeLegale,
    sitoProduttivo,
    descrizioneAttivita,
    ubicazione,
    haRevisione: motivoRevisione.length > 0,
    motivoRevisione,
    haSpessimetrica: spessimetrica.length > 0,
  }
}
