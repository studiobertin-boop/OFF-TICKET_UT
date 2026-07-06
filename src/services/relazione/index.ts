/**
 * Modulo generazione Relazione Tecnica DM329.
 *
 * Flusso: buildRelazioneModel (scheda + additional_info + cliente → modello risolto)
 * → renderRelazioneDocx (modello + template .docx → byte del documento).
 */
export { buildRelazioneModel } from './buildRelazioneModel'
export type { BuildRelazioneInput } from './buildRelazioneModel'
export { renderRelazioneDocx, buildTemplateData } from './renderRelazione'
export { generateAndDownloadRelazione, TEMPLATE_URL } from './generateRelazione'
export type { GenerateRelazioneParams } from './generateRelazione'
export { additionalInfoSchema, tipoGiriSchema } from './schema'
export type { AdditionalInfoParsed } from './schema'
export type {
  AdditionalInfo,
  RelazioneModel,
  EngineOptions,
  PremessaModel,
  DescrizioneGeneraleModel,
  CaratteristicheRow,
  ProceduraRow,
  ClassificazioneModel,
  ClassificazioneBlocco,
  ValvoleModel,
  PortataValvolaRow,
  PressioneValvolaRow,
} from './types'
