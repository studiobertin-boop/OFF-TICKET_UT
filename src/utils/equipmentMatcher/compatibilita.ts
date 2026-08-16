import { readSpec } from '@/services/equipmentAudit'
import { EQUIPMENT_DEFS, type EquipmentKind } from '@/components/technicalSheet/table/equipmentConfig'
import type { EquipmentCatalogItem } from '@/types'
import type { OCRExtractedData } from '@/types/ocr'

/** Scostamento ammesso fra la pressione letta e quella a catalogo, in bar. */
const TOLLERANZA_PRESSIONE = 0.05

export interface ConfrontoSpec {
  /** Chiave di `specs` a catalogo. */
  campo: string
  /** Come si chiama nel popup. */
  etichetta: string
  valoreCatalogo: number | string | null
  valoreLetto: number | null
  esito: 'conferma' | 'diverge' | 'non_letto'
}

/**
 * Cosa l'OCR sa leggere di questo tipo, e con quale spec di catalogo va confrontato.
 *
 * Non è la stessa cosa di `specsMap`: lì c'è tutto ciò che il catalogo dichiara, qui solo
 * ciò che una targhetta può smentire. `ts` non compare mai — lo schema di estrazione non lo
 * prevede — e sui compressori manca il volume, perché l'OCR del compressore non estrae il
 * FAD: su quel tipo l'unico discriminante tecnico è la pressione. Per lo stesso motivo
 * l'essiccatore non confronta la portata `q`: `schemaPerTipo` gli estrae solo `pressione_max`.
 */
const CAMPI_CONFRONTABILI: Record<
  EquipmentKind,
  { campo: string; etichetta: string; da: 'volume' | 'pressione_max'; tolleranza: number }[]
> = {
  serbatoio: [
    { campo: 'volume', etichetta: 'Volume', da: 'volume', tolleranza: 0 },
    { campo: 'ps', etichetta: 'PS', da: 'pressione_max', tolleranza: TOLLERANZA_PRESSIONE },
  ],
  disoleatore: [
    { campo: 'volume', etichetta: 'Volume', da: 'volume', tolleranza: 0 },
    { campo: 'ps', etichetta: 'PS', da: 'pressione_max', tolleranza: TOLLERANZA_PRESSIONE },
  ],
  scambiatore: [
    { campo: 'volume', etichetta: 'Volume', da: 'volume', tolleranza: 0 },
    { campo: 'ps', etichetta: 'PS', da: 'pressione_max', tolleranza: TOLLERANZA_PRESSIONE },
  ],
  recipiente: [
    { campo: 'volume', etichetta: 'Volume', da: 'volume', tolleranza: 0 },
    { campo: 'ps', etichetta: 'PS', da: 'pressione_max', tolleranza: TOLLERANZA_PRESSIONE },
  ],
  compressore: [
    { campo: 'pressione_max', etichetta: 'Pressione max', da: 'pressione_max', tolleranza: TOLLERANZA_PRESSIONE },
  ],
  essiccatore: [
    { campo: 'ps', etichetta: 'PS', da: 'pressione_max', tolleranza: TOLLERANZA_PRESSIONE },
  ],
  valvola: [
    { campo: 'ptar', etichetta: 'Ptar', da: 'pressione_max', tolleranza: TOLLERANZA_PRESSIONE },
  ],
  filtro: [],
  separatore: [],
}

/**
 * La pressione che la targhetta dichiara, per il tipo dato.
 *
 * Sulle valvole non c'è un campo numerico: l'estrazione restituisce `diametro_pressione`,
 * una stringa come `1/2" 13 bar` da cui la taratura va ricavata.
 */
const pressioneLetta = (kind: EquipmentKind, dati: OCRExtractedData): number | null => {
  if (kind === 'valvola') {
    const grezzo = dati.diametro_pressione
    if (!grezzo) return null
    const m = grezzo.replace(',', '.').match(/(\d+(?:\.\d+)?)\s*bar/i)
    return m ? Number(m[1]) : null
  }
  return dati.pressione_max ?? null
}

/**
 * Confronta, campo per campo, ciò che la targhetta dichiara con ciò che la riga di catalogo
 * afferma. Un dato che l'OCR non ha letto vale `non_letto`: una targhetta rovinata riduce la
 * certezza, non deve escludere candidati.
 */
export function confrontaSpecs(
  kind: EquipmentKind,
  datiOcr: OCRExtractedData,
  riga: EquipmentCatalogItem
): ConfrontoSpec[] {
  const def = EQUIPMENT_DEFS[kind]
  return CAMPI_CONFRONTABILI[kind].map(({ campo, etichetta, da, tolleranza }) => {
    const valoreCatalogo = readSpec(def.catalogType, riga.specs ?? {}, campo)
    const valoreLetto = da === 'volume' ? (datiOcr.volume ?? null) : pressioneLetta(kind, datiOcr)

    if (valoreLetto === null || valoreCatalogo === null || valoreCatalogo === '') {
      return { campo, etichetta, valoreCatalogo, valoreLetto, esito: 'non_letto' as const }
    }

    const numeroCatalogo = Number(valoreCatalogo)
    if (Number.isNaN(numeroCatalogo)) {
      return { campo, etichetta, valoreCatalogo, valoreLetto, esito: 'non_letto' as const }
    }

    const combacia = Math.abs(numeroCatalogo - valoreLetto) <= tolleranza
    return {
      campo,
      etichetta,
      valoreCatalogo,
      valoreLetto,
      esito: combacia ? ('conferma' as const) : ('diverge' as const),
    }
  })
}

/** Nessun dato letto contraddice questa riga. */
export const eCompatibile = (confronti: ConfrontoSpec[]): boolean =>
  !confronti.some((c) => c.esito === 'diverge')

/** Almeno un dato letto conferma attivamente questa riga. */
export const haConferme = (confronti: ConfrontoSpec[]): boolean =>
  confronti.some((c) => c.esito === 'conferma')
