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
import { buildSpessimetriche } from './engine/spessimetriche'
import { buildTubazioni } from './engine/tubazioni'
import { buildValvole } from './engine/valvole'
import { buildAllegati } from './engine/allegati'
import { codiciSpessimetrica } from '@/utils/spessimetrica'

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
  const { scheda, customer, pratica, schemaImpianto, resolveCostruttore } = input
  // Le apparecchiature sottoposte a spessimetrica si segnano sulla singola apparecchiatura: la
  // scheda è la fonte, e un elenco rimasto in `additional_info` dalle pratiche di prima non conta.
  const additionalInfo: AdditionalInfo = { ...input.additionalInfo, spessimetrica: codiciSpessimetrica(scheda) }
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
    spessimetriche: buildSpessimetriche(esiti, additionalInfo),
    valvole: buildValvole(scheda, additionalInfo, options),
    allegati: buildAllegati(additionalInfo),
    schemaImpianto,
  }
}
