import type { EquipmentCatalogType } from '@/types'
import {
  FORM_TO_CANONICAL, readSpec, readVariantValue, variantSpecKey, variantSpecKeys,
} from '@/services/equipmentAudit'
import { TIPO_COMPRESSORE_LABELS } from '@/types/technicalSheet'
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

  // Se non c'è mapping per questo tipo, nessun confronto possibile.
  //
  // La mappa è `FORM_TO_CANONICAL`, la stessa che usano il motore di verifica e le migration:
  // il duplicato che viveva qui era divergente — indicizzava `ts_temperatura` mentre la tabella
  // scrive `ts`, quindi la temperatura non veniva mai confrontata — e ignorava valvole e
  // recipienti filtro.
  const fieldMap = FORM_TO_CANONICAL[equipmentType]
  if (!fieldMap || Object.keys(fieldMap).length === 0) {
    return result
  }

  // Se non ci sono specs correnti, tratta come tutti campi nuovi
  const currentSpecsCleaned = currentSpecs ? cleanSpecs(currentSpecs) : {}

  /**
   * Lettura tollerante verso il vecchio formato del catalogo.
   *
   * Gran parte delle voci porta ancora le chiavi generiche dell'import massivo
   * (`volume`, `pressione`, `temperatura`). Confrontando solo le chiavi
   * canoniche, ogni campo risulterebbe «nuovo» e l'aggiornamento aggiungerebbe
   * la chiave canonica accanto a quella generica, lasciando due valori per lo
   * stesso dato.
   */
  const readCatalog = (specsField: string) =>
    readSpec(equipmentType, currentSpecsCleaned, specsField)

  /**
   * Valore del form per una chiave canonica.
   * A parità di destinazione vince il primo campo valorizzato nell'ordine della mappa: i
   * sinonimi che seguono sono campi deprecati, tenuti solo per le schede già salvate.
   */
  const readForm = (specsField: string) => {
    for (const [formField, mapped] of Object.entries(fieldMap)) {
      if (mapped !== specsField) continue
      const v = (formData as any)[formField]
      if (!isEmpty(v)) return v
    }
    return undefined
  }

  /**
   * Il valore che identifica la variante non è un campo aggiornabile: se cambia, cambia la riga
   * di catalogo. Vale per i compressori (pressione) come per le valvole (Ptar); quale sia la
   * chiave lo decide `variantSpecKey`, così resta allineata all'indice unico a database.
   */
  const chiaviVariante = variantSpecKeys(equipmentType)
  if (variantSpecKey(equipmentType)) {
    const formVariante = chiaviVariante.map(readForm).find(v => !isEmpty(v))
    const catalogVariante = readVariantValue(equipmentType, currentSpecsCleaned)

    if (!isEmpty(formVariante) && !areValuesEqual(formVariante, catalogVariante)) {
      result.suggestNewVariant = true
      return result
    }
  }

  // Confronta ogni campo mappato, una volta per chiave canonica
  const daConfrontare = [...new Set(Object.entries(fieldMap)
    .filter(([formField]) => !INSTANCE_SPECIFIC_FIELDS.includes(formField))
    .map(([, specsField]) => specsField))]

  for (const specsField of daConfrontare) {
    // La chiave di variante è l'identità della riga, non un dato da aggiornare
    if (chiaviVariante.includes(specsField)) continue

    const formValue = readForm(specsField)
    const catalogValue = readCatalog(specsField)

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
  const fieldMap = FORM_TO_CANONICAL[equipmentType]
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
 * Campi della scheda che alimentano una chiave canonica, nell'ordine della mappa.
 * Il primo è quello corrente, gli altri sono sinonimi deprecati tenuti per le schede vecchie.
 */
export function formFieldsFor(equipmentType: EquipmentCatalogType, canonicalKey: string): string[] {
  return Object.entries(FORM_TO_CANONICAL[equipmentType] ?? {})
    .filter(([, mapped]) => mapped === canonicalKey)
    .map(([formField]) => formField)
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
    tipo_compressore: 'Tipo compressore',
  }

  return labels[specsField] || specsField
}

/**
 * Formatta valore specs per visualizzazione
 */
export function formatSpecsValue(specsField: string, value: any): string {
  if (isEmpty(value)) return '-'

  // Enumerativi: si mostra l'etichetta leggibile, non il valore memorizzato
  if (specsField === 'tipo_compressore') {
    return TIPO_COMPRESSORE_LABELS[String(value)] || String(value)
  }

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
