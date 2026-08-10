/**
 * Engine — §2.2 CONDIZIONI DI INSTALLAZIONE.
 *
 * Sostituisce la frase combinatoria che concatenava gli attributi dell'area
 * ("appositamente predisposta, accessibile solo al personale autorizzato, ...") e recupera
 * i campi della scheda che prima restavano inutilizzati.
 *
 * Le righe con esito negativo vengono evidenziate anziché riscritte: una condizione di
 * installazione non soddisfatta richiede una valutazione del redattore, non un automatismo.
 */
import type { DatiImpianto } from '@/types/technicalSheet'
import type { CondizioneRow } from '../types'

/**
 * La tabella ha due sole colonne: quel che una volta stava in «Note» si accoda all'esito
 * col separatore delle altre tabelle. Senza precisazione la cella resta il solo esito.
 */
function conPrecisazione(esito: string, precisazione: string | undefined): string {
  const testo = precisazione?.trim()
  return testo ? `${esito} – ${testo}` : esito
}

export function buildCondizioniInstallazione(dati: DatiImpianto | undefined): CondizioneRow[] {
  const d = dati ?? ({} as DatiImpianto)
  const righe: CondizioneRow[] = []

  // Ubicazione: locale dedicato oppure area condivisa, con l'indicazione di con chi.
  const dedicato = d.locale_dedicato === true
  const condivisoCon = d.locale_condiviso_con?.trim()
  righe.push({
    requisito: 'Ubicazione impianto',
    esito: dedicato
      ? 'Locale dedicato'
      : condivisoCon
        ? `Area condivisa con ${condivisoCon}`
        : 'Area condivisa',
    evidenzia: false,
  })

  // Compare solo se l'accesso è effettivamente interdetto: l'assenza del flag non è
  // un'informazione da riportare.
  if (d.accesso_locale_vietato === true) {
    righe.push({
      requisito: 'Accesso riservato al personale autorizzato',
      esito: 'Sì',
      evidenzia: false,
    })
  }

  righe.push({
    requisito: 'Areazione adeguata',
    esito: 'Sì',
    evidenzia: false,
  })

  righe.push({
    requisito: 'Lontananza da sorgenti di calore',
    esito: conPrecisazione(
      d.lontano_fonti_calore === true ? 'Sì' : 'No',
      d.fonti_calore_materiali_infiammabili
    ),
    evidenzia: d.lontano_fonti_calore !== true,
  })

  righe.push({
    requisito: 'Assenza di materiale infiammabile nelle vicinanze',
    esito: d.lontano_materiale_infiammabile === true ? 'Sì' : 'No',
    evidenzia: d.lontano_materiale_infiammabile !== true,
  })

  return righe
}
