import type { EquipmentCatalogType } from '@/types'
import type { EquipmentKind } from '@/components/technicalSheet/table/equipmentConfig'

/**
 * Tipi del motore di verifica del catalogo apparecchiature.
 *
 * Il motore è logica pura: non conosce React né Supabase. Riceve i dati già
 * caricati e restituisce segnalazioni con una correzione DICHIARATIVA — dice
 * *cosa* va cambiato, non *come* eseguirlo. È il service layer a tradurre la
 * correzione in scritture sul database.
 */

export type Severity = 'critica' | 'alta' | 'media' | 'bassa'

export type RuleId =
  // Catalogo — deterministiche
  | 'TIPO_MANCANTE'
  | 'FAD_NON_MONOTONO'
  | 'QMAX_NON_MONOTONO'
  | 'PS_MINORE_ESERCIZIO'
  | 'SPECS_VALORE_NON_NUMERICO'
  | 'SPECS_LEGACY'
  | 'PRESSIONE_NEL_NOME'
  | 'DUPLICATO'
  | 'SPECS_INCOMPLETI'
  // Catalogo — euristica
  | 'SERIE_NON_MONOTONA'
  // Schede dati
  | 'SCHEDA_MODELLO_ASSENTE'
  | 'SCHEDA_SPECS_DIVERGENTI'
  | 'SCHEDA_MARCA_NON_NORMALIZZATA'

export const SEVERITY_ORDER: Record<Severity, number> = {
  critica: 0,
  alta: 1,
  media: 2,
  bassa: 3,
}

/** Riga di catalogo ridotta a ciò che serve al motore. */
export interface CatalogRow {
  id: string
  /** Colonna legacy `tipo`: usata per dedurre il tipo quando `tipoApparecchiatura` è nullo. */
  tipoLegacy: string | null
  tipoApparecchiatura: EquipmentCatalogType | null
  marca: string
  modello: string
  specs: Record<string, unknown>
  isActive: boolean
  usageCount: number
}

/** Un'apparecchiatura censita in una scheda dati, già appiattita. */
export interface SheetEquipmentRef {
  technicalDataId: string
  requestId: string
  etichettaPratica: string | null
  /** Percorso nell'equipment_data, es. `serbatoi[0]` o `serbatoi[0].valvola_sicurezza`. */
  path: string
  /** Codice dell'apparecchiatura nella scheda, es. `S1`, `C2`, `S1.1`. */
  codice: string
  kind: EquipmentKind
  catalogType: EquipmentCatalogType
  marca: string | null
  modello: string | null
  /** Valori del form già tradotti in chiavi canoniche specs. */
  values: Record<string, number | string>
}

export interface FindingEntity {
  kind: 'catalog' | 'sheet'
  /** `CatalogRow.id`, oppure `${technicalDataId}:${codice}` per le schede. */
  id: string
  /** Etichetta leggibile, es. «KAESER · CSDX 165 · 10 bar». */
  label: string
}

/**
 * Correzione proposta, dichiarativa e serializzabile.
 * `manual` significa che il motore non ha una correzione sicura da proporre.
 */
export type FindingFix =
  | {
      kind: 'set_specs'
      rowId: string
      patch: Record<string, number | string | null>
      removeKeys?: string[]
    }
  /**
   * Rinomina il modello, opzionalmente spostando nei dati tecnici ciò che il
   * nome conteneva. Le due operazioni viaggiano insieme perché separate
   * lascerebbero la riga in uno stato incoerente.
   */
  | {
      kind: 'set_modello'
      rowId: string
      modello: string
      patch?: Record<string, number | string | null>
      removeKeys?: string[]
    }
  | { kind: 'set_tipo'; rowId: string; tipoApparecchiatura: EquipmentCatalogType }
  | {
      kind: 'merge_rows'
      keepId: string
      dropIds: string[]
      mergedSpecs: Record<string, unknown>
      mergedAliases: string[]
    }
  | { kind: 'delete_row'; rowId: string }
  | {
      kind: 'create_row'
      row: {
        tipoApparecchiatura: EquipmentCatalogType
        marca: string
        modello: string
        specs: Record<string, unknown>
      }
    }
  | { kind: 'manual'; hint: string }

export interface Finding {
  /**
   * Identità stabile fra esecuzioni: è la chiave di archiviazione.
   * Composta SOLO da regola + identificatori semantici ordinati, MAI da valori.
   */
  key: string
  /**
   * Hash dei soli valori coinvolti. Se cambiano, l'archiviazione decade e la
   * segnalazione riemerge marcata come «da rivalutare».
   */
  payloadHash: string
  rule: RuleId
  severity: Severity
  /** Le regole euristiche producono falsi positivi: sono escludibili e sempre archiviabili. */
  heuristic: boolean
  scope: 'catalogo' | 'scheda'
  title: string
  detail: string
  entities: FindingEntity[]
  fix: FindingFix
}

export interface DismissalRecord {
  findingKey: string
  payloadHash: string
  motivazione: string
  dismissedAt: string
  dismissedByName: string | null
}

export interface AuditOptions {
  /** Include i controlli sulle apparecchiature censite nelle schede dati. */
  includeSheets: boolean
  /** Include le regole euristiche (serie di modelli). Spento di default nella UI. */
  includeHeuristics: boolean
}

export interface AuditInput {
  catalog: CatalogRow[]
  sheets: SheetEquipmentRef[]
  dismissals: DismissalRecord[]
  options: AuditOptions
}

export interface AuditReport {
  stats: {
    catalogRows: number
    sheetRows: number
    /** Numero di schede dati distinte esaminate. */
    sheetsScanned: number
  }
  counts: Record<Severity, number>
  /** Attive, ordinate per gravità decrescente, poi regola, poi marca/modello. */
  findings: Finding[]
  /** Archiviate e ancora valide (payloadHash invariato). */
  dismissed: Array<Finding & { dismissal: DismissalRecord }>
  /** Archiviate ma con valori cambiati: sono in `findings`, marcate qui. */
  resurfacedKeys: string[]
}

/** Firma uniforme di ogni regola: `runAudit` è un semplice flatMap. */
export type Rule = (input: AuditInput) => Finding[]

export const RULE_LABELS: Record<RuleId, { title: string; description: string }> = {
  TIPO_MANCANTE: {
    title: 'Tipo apparecchiatura mancante',
    description:
      'La riga non ha un tipo assegnato: è invisibile ai filtri a cascata della scheda dati, quindi esiste ma non è raggiungibile.',
  },
  FAD_NON_MONOTONO: {
    title: 'Portata incoerente con la pressione',
    description:
      'A parità di modello, un compressore che lavora a pressione più alta non può produrre più aria.',
  },
  QMAX_NON_MONOTONO: {
    title: 'Scarico incoerente con la taratura',
    description:
      'A parità di modello, una valvola tarata per aprirsi a pressione più alta non può scaricare meno aria.',
  },
  PS_MINORE_ESERCIZIO: {
    title: 'Pressione massima minore di quella di esercizio',
    description:
      'La pressione massima registrata è inferiore alla pressione di esercizio indicata nel nome del modello.',
  },
  SPECS_VALORE_NON_NUMERICO: {
    title: 'Valore non numerico in un campo numerico',
    description: 'Il campo dovrebbe contenere un numero ma contiene testo non convertibile.',
  },
  SPECS_LEGACY: {
    title: 'Dati tecnici in formato superato',
    description:
      'La riga usa le chiavi generiche del vecchio import: non viene letta dall’autocompilazione della scheda dati.',
  },
  PRESSIONE_NEL_NOME: {
    title: 'Pressione dentro il nome del modello',
    description:
      'La pressione va nei dati tecnici, non nel nome: nel nome impedisce di riconoscere le varianti dello stesso modello.',
  },
  DUPLICATO: {
    title: 'Voce duplicata',
    description: 'Più righe descrivono la stessa apparecchiatura.',
  },
  SPECS_INCOMPLETI: {
    title: 'Dati tecnici incompleti',
    description: 'Mancano campi necessari alla compilazione della scheda dati.',
  },
  SERIE_NON_MONOTONA: {
    title: 'Serie di modelli non progressiva',
    description:
      'Nella stessa serie un modello di taglia superiore risulta di capacità inferiore. Può essere un errore oppure un cambio di generazione: da verificare.',
  },
  SCHEDA_MODELLO_ASSENTE: {
    title: 'Modello usato in pratica ma assente dal catalogo',
    description:
      'Una scheda dati cita un’apparecchiatura che non esiste a catalogo: non è riutilizzabile né verificabile.',
  },
  SCHEDA_SPECS_DIVERGENTI: {
    title: 'Dati della pratica diversi dal catalogo',
    description: 'I valori compilati in una scheda non coincidono con quelli a catalogo.',
  },
  SCHEDA_MARCA_NON_NORMALIZZATA: {
    title: 'Marca scritta in modo diverso dal catalogo',
    description: 'La marca differisce da quella a catalogo solo per maiuscole o spaziatura.',
  },
}

export const RULE_SEVERITY: Record<RuleId, Severity> = {
  TIPO_MANCANTE: 'critica',
  FAD_NON_MONOTONO: 'alta',
  QMAX_NON_MONOTONO: 'alta',
  PS_MINORE_ESERCIZIO: 'alta',
  SPECS_VALORE_NON_NUMERICO: 'alta',
  SPECS_LEGACY: 'media',
  PRESSIONE_NEL_NOME: 'media',
  DUPLICATO: 'media',
  SCHEDA_MODELLO_ASSENTE: 'media',
  SCHEDA_SPECS_DIVERGENTI: 'media',
  SPECS_INCOMPLETI: 'bassa',
  SERIE_NON_MONOTONA: 'bassa',
  SCHEDA_MARCA_NON_NORMALIZZATA: 'bassa',
}

/** Regole che producono falsi positivi noti: escludibili via `includeHeuristics`. */
export const HEURISTIC_RULES: ReadonlySet<RuleId> = new Set<RuleId>(['SERIE_NON_MONOTONA'])
