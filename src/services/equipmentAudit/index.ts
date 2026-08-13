/**
 * Motore di verifica del catalogo apparecchiature.
 *
 * Logica pura, senza dipendenze da React o Supabase: riceve i dati già caricati
 * e restituisce segnalazioni con una correzione dichiarativa. Chi lo usa decide
 * se e come applicarla.
 */

export * from './types'
export { runAudit, applyDismissals } from './runAudit'
export { flattenSheetEquipment, type RawSheet } from './flattenSheets'
export {
  parseModello,
  parseSerie,
  normalizeKey,
  type ParsedModello,
  type ParsedSerie,
  type PressurePattern,
} from './modelName'
export {
  CANONICAL_SPECS,
  LEGACY_SPEC_MAP,
  FORM_TO_CANONICAL,
  canonicalFromForm,
  formatSpecLabel,
  isEmptySpec,
  missingCanonicalSpecs,
  normalizeSpecs,
  parseNumeric,
  readNumericSpec,
  readSpec,
  readSheetPressure,
  normalizeDiametroValvola,
  readVariantKey,
  readVariantValue,
  sheetPressureKey,
  variantKeyFields,
  variantSpecKey,
  variantSpecKeys,
  DIAMETRO_VALVOLA_OPTIONS,
  type CanonicalSpecDef,
  type NormalizeResult,
} from './specsNormalization'
export { buildFindingKey, buildPayloadHash, stableHash } from './findingKey'
export { capacityKey, pressureKey, ratedPressure } from './rules/shared'
