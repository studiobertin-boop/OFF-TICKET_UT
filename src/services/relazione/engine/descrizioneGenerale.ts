/**
 * Engine — sezione DESCRIZIONE GENERALE DELL'IMPIANTO.
 * Risolve plurali, tipo giri compressori, riga separatore e attributi dell'area.
 */
import type { SchedaDatiCompleta, Compressore } from '@/types/technicalSheet'
import type { AdditionalInfo, DescrizioneGeneraleModel } from '../types'
import { plurale } from '../helpers'

const PARAGRAFO_LOCALE_DEDICATO =
  'Il locale risulta interamente dedicato alla produzione, trattamento e stoccaggio ' +
  "dell'aria compressa e non vi è presenza, nelle vicinanze delle apparecchiature, di " +
  'materiale infiammabile. In considerazione del luogo di installazione si escludono ' +
  'scenari incidentali per incendio esterno o riscaldamento incontrollato.'

/** Frase sui giri della sezione di pompaggio in base ad additional_info.compressoriGiri. */
function fraseGiri(compressori: Compressore[], giriMap: AdditionalInfo['compressoriGiri']): string {
  const giri = compressori.map((c) => giriMap?.[c.codice])
  if (giri.length > 0 && giri.every((g) => g === 'variabili')) {
    return 'a giri variabili tramite inverter'
  }
  if (giri.length > 0 && giri.every((g) => g === 'fissi')) {
    return 'a giri fissi'
  }
  return 'a giri fissi e variabili tramite inverter'
}

export function buildDescrizioneGenerale(
  scheda: SchedaDatiCompleta,
  additionalInfo: AdditionalInfo
): DescrizioneGeneraleModel {
  const nC = scheda.compressori?.length ?? 0
  const nS = scheda.serbatoi?.length ?? 0
  const nE = scheda.essiccatori?.length ?? 0
  const nF = scheda.filtri?.length ?? 0
  const hasSeparatore = (scheda.separatori?.length ?? 0) > 0

  const sezioni: string[] = [
    `Sezione di pompaggio costituita da n°${nC} ${plurale(
      nC,
      'compressore rotativo',
      'compressori rotativi'
    )} a vite ${fraseGiri(scheda.compressori ?? [], additionalInfo.compressoriGiri)}`,
    `Sezione di accumulo ed alimentazione delle linee aria compressa costituita da n°${nS} ${plurale(
      nS,
      'serbatoio polmone verticale',
      'serbatoi polmone verticali'
    )}`,
    `Sezione trattamento aria costituita da n°${nE} ${plurale(
      nE,
      'essiccatore',
      'essiccatori'
    )} d'aria a ciclo frigorifero e n°${nF} ${plurale(nF, 'filtro', 'filtri')} di linea`,
  ]

  if (hasSeparatore) {
    sezioni.push('Raccolta e trattamento delle condense tramite separatore acqua olio')
  }
  if (scheda.dati_impianto?.raccolta_condense === 'tanica') {
    sezioni.push('Raccolta delle condense in tanica dedicata')
  }

  const haLocaleDedicato = scheda.dati_impianto?.locale_dedicato === true
  const accessoVietato = scheda.dati_impianto?.accesso_locale_vietato === true

  const attributiArea: string[] = []
  if (haLocaleDedicato) attributiArea.push('appositamente predisposta')
  if (accessoVietato) attributiArea.push('accessibile solo al personale autorizzato')

  const attributiFrase = attributiArea.length > 0 ? ` ${attributiArea.join(', ')},` : ''
  const fraseArea =
    `L'impianto è alloggiato entro un'area${attributiFrase} correttamente areata e ` +
    'lontana da sorgenti di calore.'

  return {
    sezioni,
    fraseArea,
    haLocaleDedicato,
    paragrafoLocaleDedicato: haLocaleDedicato ? PARAGRAFO_LOCALE_DEDICATO : '',
  }
}
