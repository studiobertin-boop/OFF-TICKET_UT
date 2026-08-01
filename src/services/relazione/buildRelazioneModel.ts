/**
 * Orchestratore — assembla il RelazioneModel completo a partire dalla scheda dati,
 * dagli additional_info e dall'anagrafica cliente. Ogni sezione è una funzione pura.
 */
import type { Customer } from '@/types'
import type { SchedaDatiCompleta } from '@/types/technicalSheet'
import type {
  AdditionalInfo, EngineOptions, PraticaInfo, RelazioneModel, SchemaImpianto,
} from './types'
import { buildPremessa } from './engine/premessa'
import { buildDescrizioneGenerale } from './engine/descrizioneGenerale'
import { buildCaratteristiche } from './engine/caratteristiche'
import { buildEsiti } from './engine/esiti'
import { buildProtezioni } from './engine/protezioni'
import { buildFluidi } from './engine/fluidi'
import { buildCondizioniInstallazione } from './engine/condizioniInstallazione'
import { buildRiqualificazione } from './engine/riqualificazione'
import { buildTubazioni } from './engine/tubazioni'
import { buildValvole } from './engine/valvole'
import { buildAllegati } from './engine/allegati'

export interface BuildRelazioneInput extends EngineOptions {
  scheda: SchedaDatiCompleta
  additionalInfo: AdditionalInfo
  customer: Customer
  /** Dati del codice pratica: ubicazione impianto e progressivo di revisione */
  pratica: PraticaInfo
  /** §2.3 — immagine scelta al momento della generazione, mai persistita */
  schemaImpianto?: SchemaImpianto
}

export function buildRelazioneModel(input: BuildRelazioneInput): RelazioneModel {
  const { scheda, additionalInfo, customer, pratica, schemaImpianto, resolveCostruttore } = input
  const options: EngineOptions = { resolveCostruttore }

  const esiti = buildEsiti(scheda, additionalInfo, options)

  return {
    premessa: buildPremessa({ customer, pratica, additionalInfo }),
    descrizioneGenerale: buildDescrizioneGenerale(scheda, additionalInfo),
    condizioniInstallazione: buildCondizioniInstallazione(scheda.dati_impianto),
    fluidi: buildFluidi(scheda),
    caratteristiche: buildCaratteristiche(scheda, options),
    esiti,
    protezioni: buildProtezioni(scheda, esiti),
    tubazioni: buildTubazioni(scheda),
    riqualificazione: buildRiqualificazione(esiti),
    valvole: buildValvole(scheda, additionalInfo, options),
    allegati: buildAllegati(additionalInfo),
    schemaImpianto,
  }
}
