import type { EquipmentCatalogType } from '@/types'
import type {
  Serbatoio,
  Compressore,
  Disoleatore,
  Essiccatore,
  Scambiatore,
  ValvolaSicurezza,
} from '@/types/technicalSheet'

/**
 * Risultato del confronto tra specs esistenti e dati form
 */
export interface SpecsComparison {
  hasChanges: boolean
  newFields: Record<string, any> // Campi aggiunti (erano null/undefined)
  modifiedFields: Record<
    string,
    {
      oldValue: any
      newValue: any
    }
  > // Campi modificati (warning)
  unchangedFields: string[] // Campi invariati
  suggestNewVariant?: boolean // Per compressori/valvole con pressione diversa
}

/**
 * Campi da escludere dal confronto (specifici dell'istanza)
 */
const INSTANCE_SPECIFIC_FIELDS = [
  'codice',
  'n_fabbrica',
  'anno',
  'materiale_n',
  'note',
  'foto_targhetta',
  'ha_disoleatore',
  'ha_scambiatore',
  'compressore_associato',
  'valvola_sicurezza',
  'manometro',
  'finitura_interna',
  'ancorato_terra',
  'scarico',
]

/**
 * Mappa campi form → campi specs per tipo apparecchiatura
 */
const FORM_TO_SPECS_MAP: Record<string, Record<string, string>> = {
  Serbatoi: {
    volume: 'volume',
    ps_pressione_max: 'ps',
    ts_temperatura: 'ts',
    categoria_ped: 'categoria_ped',
  },
  Compressori: {
    pressione_max: 'pressione_max',
    volume_aria_prodotto: 'fad',
    fad: 'fad', // Backward compatibility
  },
  Disoleatori: {
    volume: 'volume',
    ps_pressione_max: 'ps',
    pressione_max: 'ps', // Backward compatibility
    ts_temperatura: 'ts',
    categoria_ped: 'categoria_ped',
  },
  Essiccatori: {
    ps_pressione_max: 'ps',
    pressione_max: 'ps', // Backward compatibility
    volume_aria_trattata: 'q',
  },
  Scambiatori: {
    volume: 'volume',
    ps_pressione_max: 'ps',
    ts_temperatura: 'ts',
    categoria_ped: 'categoria_ped',
  },
  'Valvole di sicurezza': {
    pressione_taratura: 'ptar',
    pressione: 'ptar', // Backward compatibility
    ts_temperatura: 'ts',
    temperatura_max: 'ts', // Backward compatibility
    volume_aria_scaricato: 'qmax',
    portata_max: 'qmax', // Backward compatibility
    diametro: 'diametro',
  },
  Filtri: {},
  Separatori: {},
  'Recipienti filtro': {
    volume: 'volume',
    ps_pressione_max: 'ps',
    ts_temperatura: 'ts',
    categoria_ped: 'categoria_ped',
  },
}

/**
 * Tipo unione per tutti i tipi di apparecchiature
 */
type Equipment =
  | Serbatoio
  | Compressore
  | Disoleatore
  | Essiccatore
  | Scambiatore
  | ValvolaSicurezza

/**
 * Helper per verificare se un valore è considerato "vuoto"
 */
function isEmpty(value: any): boolean {
  return value === null || value === undefined || value === ''
}

/**
 * Helper per verificare se due valori sono equivalenti
 */
function areValuesEqual(a: any, b: any): boolean {
  // Entrambi vuoti → uguali
  if (isEmpty(a) && isEmpty(b)) return true

  // Uno vuoto, l'altro no → diversi
  if (isEmpty(a) || isEmpty(b)) return false

  // Confronto numerico con tolleranza per float
  if (typeof a === 'number' && typeof b === 'number') {
    return Math.abs(a - b) < 0.01
  }

  // Confronto standard
  return a === b
}

/**
 * Pulisce oggetto specs rimuovendo valori null/undefined/empty string
 */
export function cleanSpecs(specs: Record<string, any>): Record<string, any> {
  return Object.fromEntries(Object.entries(specs).filter(([_, v]) => !isEmpty(v)))
}

/**
 * Confronta specs esistenti con dati form per rilevare modifiche
 *
 * @param currentSpecs - Specs correnti dal database (null se apparecchiatura non esiste)
 * @param formData - Dati compilati nel form dall'utente
 * @param equipmentType - Tipo di apparecchiatura
 * @returns Oggetto con dettagli delle differenze
 */
export function compareSpecs(
  currentSpecs: Record<string, any> | null | undefined,
  formData: Equipment,
  equipmentType: EquipmentCatalogType
): SpecsComparison {
  const result: SpecsComparison = {
    hasChanges: false,
    newFields: {},
    modifiedFields: {},
    unchangedFields: [],
  }

  // Se non c'è mapping per questo tipo, nessun confronto possibile
  const fieldMap = FORM_TO_SPECS_MAP[equipmentType]
  if (!fieldMap || Object.keys(fieldMap).length === 0) {
    return result
  }

  // Se non ci sono specs correnti, tratta come tutti campi nuovi
  const currentSpecsCleaned = currentSpecs ? cleanSpecs(currentSpecs) : {}

  // EDGE CASE: Compressori - pressione_max fa parte della chiave
  if (equipmentType === 'Compressori' && 'pressione_max' in formData) {
    const formPressione = (formData as Compressore).pressione_max
    const catalogPressione = currentSpecsCleaned.pressione_max

    if (!isEmpty(formPressione) && !areValuesEqual(formPressione, catalogPressione)) {
      // Pressione diversa = chiave diversa = suggerisci nuova variante
      result.suggestNewVariant = true
      return result
    }
  }

  // EDGE CASE: Valvole - ptar fa parte della chiave
  if (equipmentType === 'Valvole di sicurezza') {
    const valvola = formData as ValvolaSicurezza
    const formPtar = valvola.pressione_taratura || valvola.pressione // Backward compat
    const catalogPtar = currentSpecsCleaned.ptar

    if (!isEmpty(formPtar) && !areValuesEqual(formPtar, catalogPtar)) {
      // Ptar diverso = chiave diversa = suggerisci nuova variante
      result.suggestNewVariant = true
      return result
    }
  }

  // Confronta ogni campo mappato
  for (const [formField, specsField] of Object.entries(fieldMap)) {
    // Skip campi specifici istanza
    if (INSTANCE_SPECIFIC_FIELDS.includes(formField)) continue

    const formValue = (formData as any)[formField]
    const catalogValue = currentSpecsCleaned[specsField]

    // Skip se form field è vuoto (utente non ha compilato)
    if (isEmpty(formValue)) {
      if (!isEmpty(catalogValue)) {
        result.unchangedFields.push(specsField)
      }
      continue
    }

    // Confronta valori
    if (isEmpty(catalogValue)) {
      // Campo nuovo (era vuoto nel catalogo, ora compilato)
      result.newFields[specsField] = formValue
      result.hasChanges = true
    } else if (!areValuesEqual(formValue, catalogValue)) {
      // Campo modificato (valore diverso)
      result.modifiedFields[specsField] = {
        oldValue: catalogValue,
        newValue: formValue,
      }
      result.hasChanges = true
    } else {
      // Campo invariato
      result.unchangedFields.push(specsField)
    }
  }

  return result
}

/**
 * Estrae specs aggiornati da dati form basandosi sul risultato del confronto
 *
 * @param _formData - Dati compilati nel form (non usato, ma mantenuto per consistenza API)
 * @param equipmentType - Tipo di apparecchiatura
 * @param comparison - Risultato del confronto
 * @returns Oggetto specs da salvare nel database
 */
export function extractUpdatedSpecs(
  _formData: Equipment,
  equipmentType: EquipmentCatalogType,
  comparison: SpecsComparison
): Record<string, any> {
  const fieldMap = FORM_TO_SPECS_MAP[equipmentType]
  if (!fieldMap) return {}

  const updatedSpecs: Record<string, any> = {}

  // Aggiungi nuovi campi
  for (const specsField of Object.keys(comparison.newFields)) {
    updatedSpecs[specsField] = comparison.newFields[specsField]
  }

  // Aggiungi campi modificati
  for (const specsField of Object.keys(comparison.modifiedFields)) {
    updatedSpecs[specsField] = comparison.modifiedFields[specsField].newValue
  }

  return cleanSpecs(updatedSpecs)
}

/**
 * Formatta label leggibile per campo specs
 */
export function getFieldLabel(specsField: string): string {
  const labels: Record<string, string> = {
    volume: 'Volume',
    ps: 'PS (Pressione Max)',
    ts: 'TS (Temperatura Max)',
    categoria_ped: 'Categoria PED',
    pressione_max: 'Pressione Max',
    fad: 'FAD (Volume aria prodotto)',
    q: 'Q (Volume aria trattata)',
    ptar: 'Ptar (Pressione taratura)',
    qmax: 'Qmax (Volume aria scaricato)',
    diametro: 'Diametro',
  }

  return labels[specsField] || specsField
}

/**
 * Formatta valore specs per visualizzazione
 */
export function formatSpecsValue(specsField: string, value: any): string {
  if (isEmpty(value)) return '-'

  const units: Record<string, string> = {
    volume: 'litri',
    ps: 'bar',
    ts: '°C',
    pressione_max: 'bar',
    fad: 'l/min',
    q: 'l/min',
    ptar: 'bar',
    qmax: 'l/min',
  }

  const unit = units[specsField]
  return unit ? `${value} ${unit}` : String(value)
}
