/**
 * CIVA Filtering Logic
 *
 * Filtra apparecchiature per caricamento CIVA e determina tipo pratica
 */

import type {
  SchedaDatiCompleta,
  Serbatoio,
  Scambiatore,
  Disoleatore,
  RecipienteFiltro,
  Manufacturer
} from '@/types'
import type { CIVAApparecchio, CIVASummaryData, TipoPraticaCIVA } from '@/types/civa'

/**
 * Determina tipo pratica CIVA in base a volume e pressione
 *
 * Regole:
 * - V < 25L OR (25≤V<50L AND PS<12bar): NESSUNA
 * - V≥50L AND PS≤12bar AND (PS×V≤8000): DICHIARAZIONE
 * - V≥50L AND PS≤12bar AND (PS×V>8000): VERIFICA
 * - V>25L AND PS>12bar: VERIFICA
 *
 * @param volume Volume in litri
 * @param ps Pressione massima ammissibile in bar
 * @returns Tipo pratica CIVA
 */
export function determineTipoPratica(
  volume: number | undefined,
  ps: number | undefined
): TipoPraticaCIVA {
  // Valida input
  if (!volume || !ps || volume <= 0 || ps <= 0) {
    return 'NESSUNA'
  }

  // V < 25L: nessun caricamento
  if (volume < 25) {
    return 'NESSUNA'
  }

  // 25≤V<50L AND PS<12bar: nessun caricamento
  if (volume >= 25 && volume < 50 && ps < 12) {
    return 'NESSUNA'
  }

  // V≥50L AND PS≤12bar
  if (volume >= 50 && ps <= 12) {
    const psxv = ps * volume
    // PS×V≤8000: DICHIARAZIONE
    if (psxv <= 8000) {
      return 'DICHIARAZIONE'
    }
    // PS×V>8000: VERIFICA
    return 'VERIFICA'
  }

  // V>25L AND PS>12bar: VERIFICA
  if (volume > 25 && ps > 12) {
    return 'VERIFICA'
  }

  // Default: nessun caricamento
  return 'NESSUNA'
}

/**
 * Estrae apparecchiature CIVA da Serbatoi
 */
function extractSerbatoi(
  serbatoi: Serbatoio[],
  manufacturers: Map<string, Manufacturer>
): CIVAApparecchio[] {
  const result: CIVAApparecchio[] = []

  for (const serbatoio of serbatoi) {
    // Verifica dati necessari
    if (!serbatoio.volume || !serbatoio.ps_pressione_max) {
      continue
    }

    const tipoPratica = determineTipoPratica(serbatoio.volume, serbatoio.ps_pressione_max)

    // Escludi se non richiede CIVA
    if (tipoPratica === 'NESSUNA') {
      continue
    }

    // Recupera manufacturer
    const manufacturer = manufacturers.get(serbatoio.marca || '')
    if (!manufacturer) {
      continue
    }

    result.push({
      codice: serbatoio.codice,
      tipo: 'Serbatoio',
      marca: serbatoio.marca || '',
      modello: serbatoio.modello || '',
      n_fabbrica: serbatoio.n_fabbrica || '',
      anno: serbatoio.anno,
      volume: serbatoio.volume,
      ps_pressione_max: serbatoio.ps_pressione_max,
      ts_temperatura: serbatoio.ts_temperatura,
      categoria_ped: serbatoio.categoria_ped,
      tipoPratica,
      manufacturer
    })
  }

  return result
}

/**
 * Estrae apparecchiature CIVA da Scambiatori
 */
function extractScambiatori(
  scambiatori: Scambiatore[],
  manufacturers: Map<string, Manufacturer>
): CIVAApparecchio[] {
  const result: CIVAApparecchio[] = []

  for (const scambiatore of scambiatori) {
    // Verifica dati necessari
    if (!scambiatore.volume || !scambiatore.ps_pressione_max) {
      continue
    }

    const tipoPratica = determineTipoPratica(scambiatore.volume, scambiatore.ps_pressione_max)

    // Escludi se non richiede CIVA
    if (tipoPratica === 'NESSUNA') {
      continue
    }

    // Recupera manufacturer
    const manufacturer = manufacturers.get(scambiatore.marca || '')
    if (!manufacturer) {
      continue
    }

    result.push({
      codice: scambiatore.codice,
      tipo: 'Scambiatore',
      marca: scambiatore.marca || '',
      modello: scambiatore.modello || '',
      n_fabbrica: scambiatore.n_fabbrica || '',
      anno: scambiatore.anno,
      volume: scambiatore.volume,
      ps_pressione_max: scambiatore.ps_pressione_max,
      ts_temperatura: scambiatore.ts_temperatura,
      categoria_ped: scambiatore.categoria_ped,
      tipoPratica,
      manufacturer,
      parentCodice: scambiatore.essiccatore_associato
    })
  }

  return result
}

/**
 * Estrae apparecchiature CIVA da Disoleatori
 */
function extractDisoleatori(
  disoleatori: Disoleatore[],
  manufacturers: Map<string, Manufacturer>
): CIVAApparecchio[] {
  const result: CIVAApparecchio[] = []

  for (const disoleatore of disoleatori) {
    // Verifica dati necessari
    if (!disoleatore.volume || !disoleatore.ps_pressione_max) {
      continue
    }

    const tipoPratica = determineTipoPratica(disoleatore.volume, disoleatore.ps_pressione_max)

    // Escludi se non richiede CIVA
    if (tipoPratica === 'NESSUNA') {
      continue
    }

    // Recupera manufacturer
    const manufacturer = manufacturers.get(disoleatore.marca || '')
    if (!manufacturer) {
      continue
    }

    result.push({
      codice: disoleatore.codice,
      tipo: 'Disoleatore',
      marca: disoleatore.marca || '',
      modello: disoleatore.modello || '',
      n_fabbrica: disoleatore.n_fabbrica || '',
      anno: disoleatore.anno,
      volume: disoleatore.volume,
      ps_pressione_max: disoleatore.ps_pressione_max,
      ts_temperatura: disoleatore.ts_temperatura,
      categoria_ped: disoleatore.categoria_ped,
      tipoPratica,
      manufacturer,
      parentCodice: disoleatore.compressore_associato
    })
  }

  return result
}

/**
 * Estrae apparecchiature CIVA da Recipienti Filtro
 */
function extractRecipientiFiltro(
  recipienti: RecipienteFiltro[],
  manufacturers: Map<string, Manufacturer>
): CIVAApparecchio[] {
  const result: CIVAApparecchio[] = []

  for (const recipiente of recipienti) {
    // Verifica dati necessari
    if (!recipiente.volume || !recipiente.ps_pressione_max) {
      continue
    }

    const tipoPratica = determineTipoPratica(recipiente.volume, recipiente.ps_pressione_max)

    // Escludi se non richiede CIVA
    if (tipoPratica === 'NESSUNA') {
      continue
    }

    // Recupera manufacturer
    const manufacturer = manufacturers.get(recipiente.marca || '')
    if (!manufacturer) {
      continue
    }

    result.push({
      codice: recipiente.codice,
      tipo: 'Recipiente Filtro',
      marca: recipiente.marca || '',
      modello: recipiente.modello || '',
      n_fabbrica: recipiente.n_fabbrica || '',
      anno: recipiente.anno,
      volume: recipiente.volume,
      ps_pressione_max: recipiente.ps_pressione_max,
      ts_temperatura: recipiente.ts_temperatura,
      categoria_ped: undefined, // RecipienteFiltro doesn't have categoria_ped field
      tipoPratica,
      manufacturer,
      parentCodice: recipiente.filtro_associato
    })
  }

  return result
}

/**
 * Natural sort comparator for equipment codes
 * Ordina: S1, S2, ..., S10, E1, E1.1, E2, ...
 */
function naturalSortComparator(a: string, b: string): number {
  const regex = /([A-Z]+)(\d+)(?:\.(\d+))?/
  const matchA = a.match(regex)
  const matchB = b.match(regex)

  if (!matchA || !matchB) {
    return a.localeCompare(b)
  }

  const [, letterA, numA, subNumA] = matchA
  const [, letterB, numB, subNumB] = matchB

  // Compare letters
  if (letterA !== letterB) {
    return letterA.localeCompare(letterB)
  }

  // Compare main numbers
  const numCompare = parseInt(numA, 10) - parseInt(numB, 10)
  if (numCompare !== 0) {
    return numCompare
  }

  // Compare sub-numbers (e.g., E1.1 vs E1.2)
  const subA = subNumA ? parseInt(subNumA, 10) : 0
  const subB = subNumB ? parseInt(subNumB, 10) : 0
  return subA - subB
}

/**
 * Filtra e classifica tutte le apparecchiature per CIVA
 *
 * Estrae: Serbatoi, Scambiatori, Disoleatori, Recipienti Filtro
 * Esclude: Compressori, Valvole, Filtri, Separatori
 *
 * @param equipmentData Scheda dati completa
 * @param manufacturers Map di manufacturers per marca
 * @returns Apparecchiature classificate per tipo pratica
 */
export function filterCIVAEquipment(
  equipmentData: SchedaDatiCompleta,
  manufacturers: Map<string, Manufacturer>
): CIVASummaryData {
  const allApparecchi: CIVAApparecchio[] = []

  // Estrai apparecchiature da ogni categoria
  allApparecchi.push(...extractSerbatoi(equipmentData.serbatoi || [], manufacturers))
  allApparecchi.push(...extractScambiatori(equipmentData.scambiatori || [], manufacturers))
  allApparecchi.push(...extractDisoleatori(equipmentData.disoleatori || [], manufacturers))
  allApparecchi.push(...extractRecipientiFiltro(equipmentData.recipienti_filtro || [], manufacturers))

  // Ordina: primary by tipoPratica (DICHIARAZIONE < VERIFICA), secondary by codice (natural sort)
  allApparecchi.sort((a, b) => {
    // Primary sort: DICHIARAZIONE before VERIFICA
    if (a.tipoPratica !== b.tipoPratica) {
      return a.tipoPratica === 'DICHIARAZIONE' ? -1 : 1
    }
    // Secondary sort: natural sort by codice
    return naturalSortComparator(a.codice, b.codice)
  })

  // Separa in dichiarazioni e verifiche
  const dichiarazioni = allApparecchi.filter(app => app.tipoPratica === 'DICHIARAZIONE')
  const verifiche = allApparecchi.filter(app => app.tipoPratica === 'VERIFICA')

  return {
    dichiarazioni,
    verifiche
  }
}

/**
 * Estrae lista unica di marche (manufacturer names) dalle apparecchiature
 * Utile per caricare i manufacturers necessari
 */
export function extractManufacturerNames(equipmentData: SchedaDatiCompleta): string[] {
  const names = new Set<string>()

  // Serbatoi
  equipmentData.serbatoi?.forEach(s => {
    if (s.marca) names.add(s.marca)
  })

  // Scambiatori
  equipmentData.scambiatori?.forEach(s => {
    if (s.marca) names.add(s.marca)
  })

  // Disoleatori
  equipmentData.disoleatori?.forEach(d => {
    if (d.marca) names.add(d.marca)
  })

  // Recipienti Filtro
  equipmentData.recipienti_filtro?.forEach(r => {
    if (r.marca) names.add(r.marca)
  })

  return Array.from(names)
}
