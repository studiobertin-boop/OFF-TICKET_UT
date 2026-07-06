/**
 * Orchestratore — assembla il RelazioneModel completo a partire dalla scheda dati,
 * dagli additional_info e dall'anagrafica cliente. Ogni sezione è una funzione pura.
 */
import type { Customer } from '@/types'
import type { SchedaDatiCompleta } from '@/types/technicalSheet'
import type { AdditionalInfo, EngineOptions, RelazioneModel } from './types'
import { buildPremessa } from './engine/premessa'
import { buildDescrizioneGenerale } from './engine/descrizioneGenerale'
import { buildCaratteristiche } from './engine/caratteristiche'
import { buildProceduraDM329 } from './engine/proceduraDM329'
import { buildClassificazione } from './engine/classificazione'
import { buildValvole } from './engine/valvole'
import { buildAllegati } from './engine/allegati'

export interface BuildRelazioneInput extends EngineOptions {
  scheda: SchedaDatiCompleta
  additionalInfo: AdditionalInfo
  customer: Customer
}

export function buildRelazioneModel(input: BuildRelazioneInput): RelazioneModel {
  const { scheda, additionalInfo, customer, resolveCostruttore } = input
  const options: EngineOptions = { resolveCostruttore }

  return {
    premessa: buildPremessa({ customer, datiImpianto: scheda.dati_impianto, additionalInfo }),
    descrizioneGenerale: buildDescrizioneGenerale(scheda, additionalInfo),
    caratteristiche: buildCaratteristiche(scheda, options),
    procedura: buildProceduraDM329(scheda, options),
    classificazione: buildClassificazione(scheda, additionalInfo),
    valvole: buildValvole(scheda, additionalInfo, options),
    allegati: buildAllegati(additionalInfo),
    dataSopralluogo: scheda.dati_generali?.data_sopralluogo ?? '',
    nomeTecnico: scheda.dati_generali?.nome_tecnico ?? '',
  }
}
