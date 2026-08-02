import type { EquipmentCatalogType } from '@/types'
import type { CategoriaPED } from '@/types/technicalSheet'
import {
  TIPO_COMPRESSORE_LABELS, TIPO_COMPRESSORE_OPTIONS, TIPO_GIRI_LABELS, TIPO_GIRI_OPTIONS,
} from '@/types/technicalSheet'

/** Le categorie PED non hanno una costante condivisa: il tipo le vincola comunque. */
const CATEGORIA_PED_OPTIONS: readonly CategoriaPED[] = ['I', 'II', 'III', 'IV']

/**
 * Contratto dei dati tecnici (`specs`) del catalogo apparecchiature.
 *
 * Nel catalogo convivono due generazioni di chiavi. L'import massivo ha scritto
 * chiavi generiche con valori stringa — `volume`, `pressione`, `temperatura` —
 * il cui significato cambia col tipo: per un serbatoio `volume` sono litri, per
 * un compressore è la portata d'aria in l/min, per una valvola è l'aria
 * scaricata. Le righe create dall'app usano invece chiavi tipizzate e numeriche
 * (`fad`, `ps`, `q`, `ptar`, `qmax`), che sono le uniche che il resto del codice
 * sa leggere.
 *
 * Questo modulo è l'unica fonte di verità della corrispondenza fra le due, e
 * serve a tre consumatori: il motore di verifica, i form del modulo di gestione
 * e la migration di normalizzazione.
 */

export type SpecKind = 'number' | 'text' | 'enum'

export interface CanonicalSpecDef {
  key: string
  label: string
  unit: string | null
  kind: SpecKind
  options?: readonly string[]
  /** Testo leggibile delle opzioni; se assente si mostra il valore memorizzato. */
  optionLabels?: Record<string, string>
  min?: number
  max?: number
  /** Concorre alla completezza della riga: se manca, la voce è «incompleta». */
  required?: boolean
  /** Fa parte della chiave che distingue le varianti dello stesso modello. */
  isVariantKey?: boolean
  /**
   * È la pressione che la scheda dati porta nella colonna PS/Ptar.
   *
   * Quasi sempre coincide con la chiave di variante, ma sui compressori no: il catalogo
   * distingue le varianti per pressione di esercizio, mentre la scheda — e la denuncia —
   * dichiarano la pressione massima. Tenerle separate è ciò che permette alla scheda di
   * riconoscere la propria voce di catalogo parlando la lingua della colonna che mostra.
   */
  isSheetPressure?: boolean
  /**
   * Il dato ha senso solo per certe righe del tipo: quando la condizione è falsa il campo
   * non si mostra e non si valida. Serve per le proprietà che dipendono dalla tipologia
   * costruttiva — la regolazione dei giri esiste sui rotativi a vite, non su uno scroll.
   */
  appliesWhen?: (specs: Record<string, unknown>) => boolean
  /**
   * Chiave da cui ripiegare quando quella di variante non è valorizzata.
   * Rispecchia il `COALESCE` dell'indice unico a database: una riga senza pressione di
   * esercizio si distingue comunque per pressione di targa.
   */
  variantFallbackKey?: string
}

const VOLUME: CanonicalSpecDef = {
  key: 'volume', label: 'Volume', unit: 'l', kind: 'number', min: 1, max: 100000, required: true,
}
/**
 * `isVariantKey`: lo stesso serbatoio o essiccatore può esistere a catalogo a più PS, con
 * volumi o portate diversi. Rispecchia `equipment_catalog_unique_ps` a database.
 */
const PS: CanonicalSpecDef = {
  key: 'ps', label: 'PS — pressione massima', unit: 'bar', kind: 'number', min: 0, max: 100,
  required: true, isVariantKey: true, isSheetPressure: true,
}
/** Testo libero: nel catalogo TS è spesso un intervallo, es. «-10 ÷ +200». */
const TS: CanonicalSpecDef = {
  key: 'ts', label: 'TS — temperatura massima', unit: '°C', kind: 'text',
}
const CATEGORIA_PED: CanonicalSpecDef = {
  key: 'categoria_ped', label: 'Categoria PED', unit: null, kind: 'enum', options: CATEGORIA_PED_OPTIONS,
}

const RECIPIENTE_SPECS = [VOLUME, PS, TS, CATEGORIA_PED] as const

export const CANONICAL_SPECS: Record<EquipmentCatalogType, readonly CanonicalSpecDef[]> = {
  Serbatoi: RECIPIENTE_SPECS,
  Disoleatori: RECIPIENTE_SPECS,
  Scambiatori: RECIPIENTE_SPECS,
  'Recipienti filtro': RECIPIENTE_SPECS,
  Compressori: [
    { key: 'fad', label: 'FAD — aria prodotta', unit: 'l/min', kind: 'number', min: 0, max: 1000000, required: true },
    {
      key: 'pressione_esercizio',
      label: 'Pressione di esercizio',
      unit: 'bar',
      kind: 'number',
      min: 0,
      max: 100,
      isVariantKey: true,
      variantFallbackKey: 'pressione_max',
    },
    { key: 'pressione_max', label: 'Pressione massima', unit: 'bar', kind: 'number', min: 0, max: 100, required: true, isSheetPressure: true },
    {
      key: 'tipo_compressore',
      label: 'Tipo costruttivo',
      unit: null,
      kind: 'enum',
      options: TIPO_COMPRESSORE_OPTIONS,
      optionLabels: TIPO_COMPRESSORE_LABELS,
    },
    {
      // Non `required`: il motore di verifica non deve segnalare come incompleta una riga a
      // cui il dato manca soltanto perché nessuno l'ha ancora osservato sul campo.
      // `appliesWhen` con il tipo non specificato è deliberato: a produzione
      // `tipo_compressore` è vuoto su tutte le righe e la scheda dati tratta «rotativo a
      // vite» come default implicito.
      key: 'giri',
      label: 'Regolazione giri',
      unit: null,
      kind: 'enum',
      options: TIPO_GIRI_OPTIONS,
      optionLabels: TIPO_GIRI_LABELS,
      appliesWhen: (specs) => !specs.tipo_compressore || specs.tipo_compressore === 'VITE',
    },
  ],
  Essiccatori: [
    { key: 'q', label: 'Q — aria trattata', unit: 'l/min', kind: 'number', min: 0, max: 1000000, required: true },
    PS,
    TS,
  ],
  'Valvole di sicurezza': [
    { key: 'ptar', label: 'Ptar — pressione di taratura', unit: 'bar', kind: 'number', min: 0, max: 100, required: true, isVariantKey: true, isSheetPressure: true },
    { key: 'qmax', label: 'Qmax — aria scaricata', unit: 'l/min', kind: 'number', min: 0, max: 1000000, required: true },
    TS,
    { key: 'diametro', label: 'Diametro', unit: null, kind: 'text' },
    CATEGORIA_PED,
  ],
  Filtri: [],
  Separatori: [],
  Altro: [],
}

/**
 * Chiave generica dell'import → chiave canonica, per tipo.
 * Corrispondenza verificata sui dati di produzione.
 */
export const LEGACY_SPEC_MAP: Record<EquipmentCatalogType, Readonly<Record<string, string>>> = {
  Serbatoi: { volume: 'volume', pressione: 'ps', temperatura: 'ts' },
  Disoleatori: { volume: 'volume', pressione: 'ps', temperatura: 'ts' },
  Scambiatori: { volume: 'volume', pressione: 'ps', temperatura: 'ts' },
  'Recipienti filtro': { volume: 'volume', pressione: 'ps', temperatura: 'ts' },
  Compressori: { volume: 'fad', pressione: 'pressione_max', temperatura: 'ts' },
  Essiccatori: { volume: 'q', pressione: 'ps', temperatura: 'ts' },
  'Valvole di sicurezza': { volume: 'qmax', pressione: 'ptar', temperatura: 'ts' },
  Filtri: { volume: 'volume', pressione: 'ps', temperatura: 'ts' },
  Separatori: { volume: 'volume', pressione: 'ps', temperatura: 'ts' },
  Altro: {},
}

/**
 * Campo della scheda dati → chiave canonica del catalogo.
 *
 * Il form ha accumulato negli anni sinonimi e campi deprecati (`fad` prima di
 * `volume_aria_prodotto`, `portata_max` prima di `volume_aria_scaricato`): sono
 * elencati tutti perché le schede vecchie li contengono ancora. A parità di
 * destinazione vince il primo campo valorizzato, nell'ordine di questa mappa.
 */
export const FORM_TO_CANONICAL: Record<EquipmentCatalogType, Readonly<Record<string, string>>> = {
  Serbatoi: {
    volume: 'volume',
    ps_pressione_max: 'ps',
    ts: 'ts',
    ts_temperatura: 'ts',
    categoria_ped: 'categoria_ped',
  },
  Disoleatori: {
    volume: 'volume',
    ps_pressione_max: 'ps',
    pressione_max: 'ps',
    ts: 'ts',
    ts_temperatura: 'ts',
    categoria_ped: 'categoria_ped',
  },
  Scambiatori: {
    volume: 'volume',
    ps_pressione_max: 'ps',
    ts: 'ts',
    ts_temperatura: 'ts',
    categoria_ped: 'categoria_ped',
  },
  'Recipienti filtro': {
    volume: 'volume',
    ps_pressione_max: 'ps',
    ts: 'ts',
    ts_temperatura: 'ts',
    categoria_ped: 'categoria_ped',
  },
  Compressori: {
    volume_aria_prodotto: 'fad',
    fad: 'fad',
    pressione_max: 'pressione_max',
    tipo: 'tipo_compressore',
  },
  Essiccatori: {
    volume_aria_trattata: 'q',
    ps_pressione_max: 'ps',
    pressione_max: 'ps',
  },
  'Valvole di sicurezza': {
    pressione_taratura: 'ptar',
    pressione: 'ptar',
    volume_aria_scaricato: 'qmax',
    portata_max: 'qmax',
    ts: 'ts',
    ts_temperatura: 'ts',
    temperatura_max: 'ts',
    diametro: 'diametro',
    categoria_ped: 'categoria_ped',
  },
  Filtri: {},
  Separatori: {},
  Altro: {},
}

/** Traduce i campi compilati in una scheda dati nelle chiavi canoniche del catalogo. */
export function canonicalFromForm(
  tipo: EquipmentCatalogType,
  form: Record<string, unknown> | null | undefined
): Record<string, number | string> {
  const out: Record<string, number | string> = {}
  if (!form) return out

  const defs = CANONICAL_SPECS[tipo] ?? []
  const defByKey = new Map(defs.map(d => [d.key, d]))

  for (const [formKey, canonicalKey] of Object.entries(FORM_TO_CANONICAL[tipo] ?? {})) {
    if (canonicalKey in out) continue
    const coerced = coerce(defByKey.get(canonicalKey), form[formKey])
    if (coerced !== null) out[canonicalKey] = coerced
  }

  return out
}

const UNIT_SUFFIX = /\s*(bar|l\/min|litri|lt|l|°?\s*c|mm|kw|m3\/min)\s*$/i

/**
 * Converte in numero i valori del catalogo, che l'import ha lasciato come
 * stringhe. Rifiuta ciò che non è un numero singolo: gli intervalli di
 * temperatura («-10 ÷ +200») devono restare testo, non diventare -10.
 */
export function parseNumeric(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v !== 'string') return null

  const cleaned = v.trim().replace(UNIT_SUFFIX, '').replace(',', '.').trim()
  if (cleaned === '') return null

  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

export function isEmptySpec(v: unknown): boolean {
  return v === null || v === undefined || (typeof v === 'string' && v.trim() === '')
}

export type UnconvertibleReason = 'non_numerico' | 'collisione'

export interface NormalizeResult {
  /** Valori nelle chiavi canoniche, già tipizzati. */
  canonical: Record<string, number | string>
  /** Chiavi generiche convertite: vanno rimosse dal record originale. */
  legacyKeysConverted: string[]
  /** Chiavi che il motore non può convertire da solo: si segnalano, non si toccano. */
  unconvertible: Array<{ key: string; value: unknown; reason: UnconvertibleReason }>
  /** `false` quando la riga era già canonica: la normalizzazione è idempotente. */
  changed: boolean
}

function coerce(def: CanonicalSpecDef | undefined, value: unknown): number | string | null {
  if (isEmptySpec(value)) return null
  if (!def || def.kind === 'number') {
    const n = parseNumeric(value)
    if (n !== null) return n
    return def ? null : String(value)
  }
  return typeof value === 'number' ? String(value) : String(value).trim()
}

/**
 * Porta i dati tecnici di una riga nelle chiavi canoniche del suo tipo.
 *
 * Non è distruttiva: quando una chiave generica e la sua canonica coesistono con
 * valori diversi, non sceglie — la segnala come collisione e lascia i dati
 * intatti. Quando un valore atteso numerico non lo è, stessa cosa.
 */
export function normalizeSpecs(
  tipo: EquipmentCatalogType | null,
  specs: Record<string, unknown> | null | undefined
): NormalizeResult {
  const source = specs ?? {}
  const result: NormalizeResult = {
    canonical: {},
    legacyKeysConverted: [],
    unconvertible: [],
    changed: false,
  }
  if (!tipo) return result

  const defs = CANONICAL_SPECS[tipo] ?? []
  const defByKey = new Map(defs.map(d => [d.key, d]))
  const legacyMap = LEGACY_SPEC_MAP[tipo] ?? {}

  /**
   * Alcune chiavi generiche hanno lo stesso nome della canonica: per un
   * serbatoio `volume` è già il campo giusto, per un compressore lo stesso nome
   * indica invece la portata. Solo le seconde vanno tradotte; trattare le prime
   * come da convertire porterebbe a riscrivere e poi cancellare lo stesso campo.
   */
  const daTradurre = new Map(
    Object.entries(legacyMap).filter(([legacyKey, canonicalKey]) => legacyKey !== canonicalKey)
  )

  // 1. Le chiavi già canoniche passano, con la sola coercizione di tipo.
  for (const [key, value] of Object.entries(source)) {
    if (daTradurre.has(key)) continue
    if (isEmptySpec(value)) continue

    const def = defByKey.get(key)
    const coerced = coerce(def, value)
    if (coerced === null) {
      result.unconvertible.push({ key, value, reason: 'non_numerico' })
      continue
    }
    result.canonical[key] = coerced
    if (def && typeof value !== typeof coerced) result.changed = true
  }

  // 2. Le chiavi generiche si traducono, senza mai sovrascrivere una canonica.
  for (const [legacyKey, canonicalKey] of daTradurre) {
    const value = source[legacyKey]
    if (isEmptySpec(value)) continue

    const def = defByKey.get(canonicalKey)
    const coerced = coerce(def, value)
    if (coerced === null) {
      result.unconvertible.push({ key: legacyKey, value, reason: 'non_numerico' })
      continue
    }

    const existing = result.canonical[canonicalKey]
    if (existing !== undefined) {
      // Entrambe presenti: se concordano la generica è ridondante, se no decide l'utente.
      if (String(existing) !== String(coerced)) {
        result.unconvertible.push({ key: legacyKey, value, reason: 'collisione' })
      } else {
        result.legacyKeysConverted.push(legacyKey)
        result.changed = true
      }
      continue
    }

    result.canonical[canonicalKey] = coerced
    result.legacyKeysConverted.push(legacyKey)
    result.changed = true
  }

  return result
}

/**
 * Legge un dato tecnico accettando entrambe le generazioni di chiavi.
 *
 * È ciò che permette all'autocompilazione della scheda dati di funzionare sul
 * catalogo così com'è oggi, senza attendere la migrazione dei dati.
 */
export function readSpec(
  tipo: EquipmentCatalogType | null | undefined,
  specs: Record<string, unknown> | null | undefined,
  canonicalKey: string
): number | string | null {
  if (!specs) return null

  const defs = tipo ? CANONICAL_SPECS[tipo] ?? [] : []
  const def = defs.find(d => d.key === canonicalKey)

  const direct = coerce(def, specs[canonicalKey])
  if (direct !== null) return direct

  if (!tipo) return null
  const legacyMap = LEGACY_SPEC_MAP[tipo] ?? {}
  for (const [legacyKey, mapped] of Object.entries(legacyMap)) {
    if (mapped !== canonicalKey) continue
    const fallback = coerce(def, specs[legacyKey])
    if (fallback !== null) return fallback
  }

  return null
}

/** Come `readSpec`, ma restituisce solo valori numerici. */
export function readNumericSpec(
  tipo: EquipmentCatalogType | null | undefined,
  specs: Record<string, unknown> | null | undefined,
  canonicalKey: string
): number | null {
  const v = readSpec(tipo, specs, canonicalKey)
  return typeof v === 'number' ? v : parseNumeric(v)
}

/** Campi obbligatori del tipo che la riga non valorizza. */
export function missingCanonicalSpecs(
  tipo: EquipmentCatalogType | null,
  specs: Record<string, unknown> | null | undefined
): CanonicalSpecDef[] {
  if (!tipo) return []
  return (CANONICAL_SPECS[tipo] ?? []).filter(
    def => def.required && readSpec(tipo, specs, def.key) === null
  )
}

/**
 * Chiave che distingue le varianti dello stesso modello, o null se il tipo non ne ha.
 *
 * Unica fonte di verità per chiunque debba scegliere «quale pressione identifica la riga»:
 * il selettore della scheda dati, la ricerca a catalogo e l'aggiornamento degli specs devono
 * usare la stessa, altrimenti due varianti risultano indistinguibili e si autocompila quella
 * sbagliata. Deve restare allineata all'indice unico parziale a database.
 */
export function variantSpecKey(tipo: EquipmentCatalogType | null | undefined): string | null {
  if (!tipo) return null
  return (CANONICAL_SPECS[tipo] ?? []).find(d => d.isVariantKey)?.key ?? null
}

/** Chiave di variante e sua ricaduta, nell'ordine in cui vanno provate. */
export function variantSpecKeys(tipo: EquipmentCatalogType | null | undefined): string[] {
  if (!tipo) return []
  const def = (CANONICAL_SPECS[tipo] ?? []).find(d => d.isVariantKey)
  if (!def) return []
  return def.variantFallbackKey ? [def.key, def.variantFallbackKey] : [def.key]
}

/**
 * Valore che identifica la variante di una riga di catalogo.
 * Null se il tipo non è indicizzato per variante o se il dato manca del tutto.
 */
export function readVariantValue(
  tipo: EquipmentCatalogType | null | undefined,
  specs: Record<string, unknown> | null | undefined
): number | null {
  for (const key of variantSpecKeys(tipo)) {
    const v = readNumericSpec(tipo, specs, key)
    if (v !== null) return v
  }
  return null
}

/**
 * Chiave della pressione che la scheda dati mostra nella colonna PS/Ptar.
 *
 * Sui recipienti e sulle valvole è la stessa che distingue le varianti; sui compressori no,
 * perché il catalogo li distingue per pressione di esercizio e la scheda dichiara la massima.
 */
export function sheetPressureKey(tipo: EquipmentCatalogType | null | undefined): string | null {
  if (!tipo) return null
  return (CANONICAL_SPECS[tipo] ?? []).find(d => d.isSheetPressure)?.key ?? null
}

/**
 * Pressione con cui una riga di catalogo si presenta alla scheda dati.
 *
 * È il valore che il selettore della colonna PS propone e quello su cui si decide se il
 * modello esiste già «a quella pressione»: confrontare la PS di una riga con la pressione di
 * esercizio del catalogo faceva comparire a vuoto l'invito ad aggiungere una voce già presente.
 * Ripiega sulla chiave di variante per le righe che la pressione di scheda non ce l'hanno.
 */
export function readSheetPressure(
  tipo: EquipmentCatalogType | null | undefined,
  specs: Record<string, unknown> | null | undefined
): number | null {
  const key = sheetPressureKey(tipo)
  const diretta = key ? readNumericSpec(tipo, specs, key) : null
  return diretta ?? readVariantValue(tipo, specs)
}

/** Etichetta leggibile di una chiave canonica, con unità di misura. */
export function formatSpecLabel(tipo: EquipmentCatalogType | null, key: string): string {
  const def = tipo ? (CANONICAL_SPECS[tipo] ?? []).find(d => d.key === key) : undefined
  if (!def) return key
  return def.unit ? `${def.label} [${def.unit}]` : def.label
}
