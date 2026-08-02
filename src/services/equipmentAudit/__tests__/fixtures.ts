import type { EquipmentCatalogType } from '@/types'
import type { AuditInput, AuditOptions, CatalogRow, SheetEquipmentRef } from '../types'

/**
 * Casi tratti dal catalogo di produzione.
 *
 * Sono la specifica eseguibile del motore: ognuno è stato verificato a mano sui
 * dati reali prima di essere scritto qui, e i numeri che compaiono nei test sono
 * quelli osservati, non inventati.
 */

let seq = 0

export function row(
  tipo: EquipmentCatalogType | null,
  marca: string,
  modello: string,
  specs: Record<string, unknown> = {},
  extra: Partial<CatalogRow> = {}
): CatalogRow {
  return {
    id: `row-${++seq}`,
    tipoLegacy: null,
    tipoApparecchiatura: tipo,
    marca,
    modello,
    specs,
    isActive: true,
    usageCount: 0,
    ...extra,
  }
}

export const OPTIONS_BASE: AuditOptions = { includeSheets: false, includeHeuristics: false }
export const OPTIONS_TUTTO: AuditOptions = { includeSheets: true, includeHeuristics: true }

export function input(
  catalog: CatalogRow[],
  overrides: Partial<AuditInput> = {}
): AuditInput {
  return {
    catalog,
    sheets: [],
    dismissals: [],
    options: OPTIONS_BASE,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Compressori — la portata cala al crescere della pressione di esercizio
// ---------------------------------------------------------------------------

/** Errore di ordine di grandezza: a 10 bar manca uno zero (1353 invece di ~13530). */
export const CSDX_165 = (): CatalogRow[] => [
  row('Compressori', 'KAESER KOMPRESSOREN SE', 'CSDX 165 (@10bar)', { volume: '1353', pressione: '10' }),
  row('Compressori', 'KAESER KOMPRESSOREN SE', 'CSDX 165 (@13bar)', { volume: '11490', pressione: '13' }),
]

/** Stesso difetto, con il nome nella forma «max». */
export const CSD_125 = (): CatalogRow[] => [
  row('Compressori', 'KAESER KOMPRESSOREN SE', 'CSD 125 (max10bar)', { volume: '1090', pressione: '10' }),
  row('Compressori', 'KAESER KOMPRESSOREN SE', 'CSD 125 (max15bar)', { volume: '8060', pressione: '15' }),
]

/** Scarto contenuto: incoerente, ma non riconducibile a una cifra persa. */
export const AIRCENTER_12 = (): CatalogRow[] => [
  row('Compressori', 'KAESER KOMPRESSOREN SE', 'AIRCENTER 12 (@10bar)', { volume: '770', pressione: '11' }),
  row('Compressori', 'KAESER KOMPRESSOREN SE', 'AIRCENTER 12 (@13bar)', { volume: '1010', pressione: '11' }),
]

/** Serie corretta: a pressione maggiore corrisponde portata minore. */
export const GA_18_COERENTE = (): CatalogRow[] => [
  row('Compressori', 'ATLAS COPCO AIRPOWER N.V.', 'GA 18 (@8,5bar)', { volume: '3420', pressione: '8.5' }),
  row('Compressori', 'ATLAS COPCO AIRPOWER N.V.', 'GA 18 (@10bar)', { volume: '2900', pressione: '10' }),
]

/** KAESER: il nome porta la pressione di esercizio, gli specs quella massima. */
export const KAESER_ASD_40 = () =>
  row('Compressori', 'KAESER KOMPRESSOREN SE', 'ASD 40 (@13bar)', { volume: '2580', pressione: '15' })

/** CECCATO: le due pressioni coincidono. */
export const CECCATO_COINCIDENTE = () =>
  row('Compressori', 'CECCATO ARIA COMPRESSA S.R.L.', 'CSM 20 (@10bar)', { volume: '1790', pressione: '10' })

/** Pressione massima inferiore a quella di esercizio: da segnalare, mai convertire. */
export const PS_INCOERENTE = () =>
  row('Compressori', 'KAESER KOMPRESSOREN SE', 'AIRCENTER 15 (@13bar)', { volume: '1260', pressione: '11' })

// ---------------------------------------------------------------------------
// Valvole di sicurezza
// ---------------------------------------------------------------------------

export const VALVOLE_COERENTI = (): CatalogRow[] => [
  row('Valvole di sicurezza', 'PADOVAN VALERIO snc', 'TW3 (@11bar)', { volume: '8415', pressione: '11' }),
  row('Valvole di sicurezza', 'PADOVAN VALERIO snc', 'TW3 (@14,5bar)', { volume: '10800', pressione: '14.5' }),
]

/** Violazione sintetica: a taratura maggiore scarica meno. */
export const VALVOLE_INCOERENTI = (): CatalogRow[] => [
  row('Valvole di sicurezza', 'PADOVAN VALERIO snc', 'TX9 (@10bar)', { volume: '9000', pressione: '10' }),
  row('Valvole di sicurezza', 'PADOVAN VALERIO snc', 'TX9 (@14bar)', { volume: '6000', pressione: '14' }),
]

/** Portata registrata come «maggiore di»: non convertibile in numero. */
export const VALVOLA_NON_NUMERICA = () =>
  row('Valvole di sicurezza', 'PADOVAN VALERIO snc', 'TW1 (@13,50bar)', {
    volume: '>4854',
    pressione: '13.5',
  })

// ---------------------------------------------------------------------------
// Serie di modelli
// ---------------------------------------------------------------------------

/** FRIULAIR: progressione impeccabile, il numero è circa la portata diviso cento. */
export const FRIULAIR_AMD = (): CatalogRow[] => [
  row('Essiccatori', 'FRIULAIR S.r.l.', 'AMD 105', { volume: '10500', pressione: '14' }),
  row('Essiccatori', 'FRIULAIR S.r.l.', 'AMD 130', { volume: '13000', pressione: '14' }),
  row('Essiccatori', 'FRIULAIR S.r.l.', 'AMD 168', { volume: '16800', pressione: '14' }),
]

/** Falso positivo noto: ASK 34 e ASK 35 sono generazioni diverse, non un errore. */
export const KAESER_ASK = (): CatalogRow[] => [
  row('Compressori', 'KAESER KOMPRESSOREN SE', 'ASK 32 (@13bar)', { volume: '2200', pressione: '13' }),
  row('Compressori', 'KAESER KOMPRESSOREN SE', 'ASK 34 (@13bar)', { volume: '2500', pressione: '13' }),
  row('Compressori', 'KAESER KOMPRESSOREN SE', 'ASK 35 (@13bar)', { volume: '2350', pressione: '13' }),
]

// ---------------------------------------------------------------------------
// Formati dei dati tecnici
// ---------------------------------------------------------------------------

export const SERBATOIO_LEGACY = () =>
  row('Serbatoi', 'SICC TECH s.r.l.', 'SC 500', {
    volume: '500',
    pressione: '11',
    temperatura: '-10 ÷ +120',
    categoria_ped: 'IV',
  })

export const SERBATOIO_CANONICO = () =>
  row('Serbatoi', 'SICC TECH s.r.l.', '725 - 12783', {
    volume: 725,
    ps: 11,
    ts: 120,
    categoria_ped: 'IV',
  })

/** Riga del seed dimostrativo: nessun tipo, deducibile dalla vecchia colonna. */
export const RIGA_SENZA_TIPO = () =>
  row(null, 'Atlas Copco', 'GA 30', { potenza_kw: 30, portata_m3_min: 2.8 }, { tipoLegacy: 'Compressore' })

// ---------------------------------------------------------------------------
// Schede dati
// ---------------------------------------------------------------------------

export function sheetRef(
  catalogType: EquipmentCatalogType,
  marca: string | null,
  modello: string | null,
  values: Record<string, number | string> = {},
  extra: Partial<SheetEquipmentRef> = {}
): SheetEquipmentRef {
  return {
    technicalDataId: 'sheet-1',
    requestId: 'req-1',
    codicePratica: 'PR-2026-001',
    path: 'compressori[0]',
    codice: 'C1',
    kind: 'compressore',
    catalogType,
    marca,
    modello,
    values,
    ...extra,
  }
}

/** Scheda con serbatoio, valvola obbligatoria annidata, valvola aggiuntiva e compressore. */
export const EQUIPMENT_DATA_ESEMPIO = {
  dati_generali: { qualcosa: true },
  serbatoi: [
    {
      codice: 'S1',
      marca: 'SICC TECH s.r.l.',
      modello: 'SC 500',
      volume: 500,
      ps_pressione_max: 11,
      valvola_sicurezza: {
        marca: 'PADOVAN VALERIO snc',
        modello: 'TW3',
        pressione_taratura: 11,
        volume_aria_scaricato: 8415,
      },
      valvole_aggiuntive: [
        { marca: 'PADOVAN VALERIO snc', modello: 'TA11', pressione_taratura: 10.8 },
      ],
    },
    // Riga vuota lasciata dal form: non è un censimento.
    { codice: 'S2', valvola_sicurezza: {} },
  ],
  compressori: [
    {
      codice: 'C1',
      marca: 'KAESER KOMPRESSOREN SE',
      modello: 'ASD 40',
      // Campo deprecato: le schede vecchie lo usano ancora al posto di volume_aria_prodotto.
      fad: 2580,
      pressione_max: 15,
    },
  ],
  filtri: [],
}
