/**
 * Factory di fixture per i test dell'engine relazione.
 * Ogni factory ha default validi e accetta override parziali.
 */
import type { Customer } from '@/types'
import type {
  SchedaDatiCompleta,
  DatiGenerali,
  DatiImpianto,
  Compressore,
  Disoleatore,
  Serbatoio,
  Essiccatore,
  Scambiatore,
  Filtro,
  RecipienteFiltro,
  Separatore,
  ValvolaSicurezza,
} from '@/types/technicalSheet'
import type { AdditionalInfo } from '../types'

export function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 'cust-1',
    ragione_sociale: 'ACME S.r.l.',
    telefono: null,
    pec: null,
    descrizione_attivita: 'produzione di componenti meccanici',
    via: 'Via Roma',
    numero_civico: '10',
    cap: '31020',
    comune: 'San Polo di Piave',
    provincia: 'TV',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

export function makeDatiGenerali(overrides: Partial<DatiGenerali> = {}): DatiGenerali {
  return {
    data_sopralluogo: '01/06/2026',
    nome_tecnico: 'Mario Rossi',
    cliente: 'ACME S.r.l.',
    ...overrides,
  }
}

export function makeDatiImpianto(overrides: Partial<DatiImpianto> = {}): DatiImpianto {
  return {
    sede_imp_uguale_legale: true,
    sede_impianto: '',
    indirizzo_impianto: '',
    raccolta_condense: 'tanica',
    ...overrides,
  }
}

export function makeValvola(overrides: Partial<ValvolaSicurezza> = {}): ValvolaSicurezza {
  return {
    marca: 'PADOVAN VALERIO snc',
    modello: 'TW3',
    n_fabbrica: '000000',
    pressione_taratura: 14,
    volume_aria_scaricato: 10518,
    categoria_ped: 'IV',
    ...overrides,
  }
}

export function makeCompressore(overrides: Partial<Compressore> = {}): Compressore {
  return {
    codice: 'C1',
    marca: 'KAESER',
    modello: 'CSD 105 SFC',
    n_fabbrica: 'CSD.5/5697',
    anno: 2019,
    pressione_max: 12,
    volume_aria_prodotto: 8350,
    ha_disoleatore: true,
    ...overrides,
  }
}

export function makeDisoleatore(overrides: Partial<Disoleatore> = {}): Disoleatore {
  return {
    codice: 'C1.1',
    compressore_associato: 'C1',
    marca: 'AIR COM S.r.l.',
    modello: '25ADK1',
    n_fabbrica: '6203',
    anno: 2019,
    volume: 75,
    ps_pressione_max: 16,
    ts_temperatura: 120,
    categoria_ped: 'III',
    valvola_sicurezza: makeValvola({ n_fabbrica: '759924/6' }),
    ...overrides,
  }
}

export function makeSerbatoio(overrides: Partial<Serbatoio> = {}): Serbatoio {
  return {
    codice: 'S1',
    marca: 'SICC TECH s.r.l.',
    modello: '2000-20011R2',
    n_fabbrica: '19.02986.025',
    anno: 2019,
    volume: 2000,
    ps_pressione_max: 11.5,
    ts_temperatura: 120,
    categoria_ped: 'IV',
    finitura_interna: 'ZINCATO',
    ancorato_terra: true,
    scarico: 'AUTOMATICO',
    valvola_sicurezza: makeValvola({
      modello: 'TA21',
      n_fabbrica: '484725/7',
      pressione_taratura: 10.8,
      volume_aria_scaricato: 32142,
    }),
    ...overrides,
  }
}

export function makeEssiccatore(overrides: Partial<Essiccatore> = {}): Essiccatore {
  return {
    codice: 'E1',
    marca: 'FRIULAIR S.r.l.',
    modello: 'ACT 160',
    n_fabbrica: 'ACT160AM3M085',
    anno: 2024,
    ps_pressione_max: 14,
    volume_aria_trattata: 16000,
    ha_scambiatore: true,
    ...overrides,
  }
}

export function makeScambiatore(overrides: Partial<Scambiatore> = {}): Scambiatore {
  return {
    codice: 'E1.1',
    essiccatore_associato: 'E1',
    marca: 'RAAL S.A.',
    modello: 'RACF 31000-0',
    n_fabbrica: '00117-19-24',
    anno: 2024,
    ps_pressione_max: 14,
    ts_temperatura: 120,
    volume: 16000,
    categoria_ped: 'II',
    ...overrides,
  }
}

export function makeFiltro(overrides: Partial<Filtro> = {}): Filtro {
  return {
    codice: 'F1',
    marca: 'FRIULAIR',
    modello: 'FILTRO',
    n_fabbrica: 'F-001',
    anno: 2024,
    ha_recipiente: false,
    ...overrides,
  }
}

export function makeRecipienteFiltro(
  overrides: Partial<RecipienteFiltro> = {}
): RecipienteFiltro {
  return {
    codice: 'F1.1',
    filtro_associato: 'F1',
    marca: 'FRIULAIR',
    modello: 'REC',
    n_fabbrica: 'R-001',
    anno: 2024,
    ps_pressione_max: 16,
    ts_temperatura: 120,
    volume: 75,
    ...overrides,
  }
}

export function makeSeparatore(overrides: Partial<Separatore> = {}): Separatore {
  return {
    codice: 'SEP1',
    marca: 'JORC',
    modello: 'SEP',
    n_fabbrica: 'SEP-001',
    anno: 2024,
    ...overrides,
  }
}

/**
 * Scheda dati completa "minima valida": 1 compressore con disoleatore,
 * 1 serbatoio, 1 essiccatore con scambiatore, 1 filtro. Override per scenario.
 */
export function makeScheda(overrides: Partial<SchedaDatiCompleta> = {}): SchedaDatiCompleta {
  return {
    stato: 'completa',
    dati_generali: makeDatiGenerali(),
    dati_impianto: makeDatiImpianto(),
    serbatoi: [makeSerbatoio()],
    compressori: [makeCompressore()],
    disoleatori: [makeDisoleatore()],
    essiccatori: [makeEssiccatore()],
    scambiatori: [makeScambiatore()],
    filtri: [makeFiltro()],
    recipienti_filtro: [],
    separatori: [],
    ...overrides,
  }
}

export function makeAdditionalInfo(overrides: Partial<AdditionalInfo> = {}): AdditionalInfo {
  return {
    descrizioneAttivita: 'produzione di componenti meccanici',
    compressoriGiri: { C1: 'variabili' },
    spessimetrica: [],
    collegamentiCompressoriSerbatoi: {},
    ...overrides,
  }
}
