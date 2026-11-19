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
  SerbatoioGeneratore,
  Manufacturer
} from '@/types'
import type { CIVAApparecchio, CIVASummaryData, TipoPraticaCIVA } from '@/types/civa'
import { classificaRecipiente, esitoToTipoPratica } from './dm329Classification'
import { naturalSortComparator } from './naturalSort'
import { ARRAY_RECIPIENTI, descrizioneSerbatoioGeneratore } from '@/types/technicalSheet'

export { naturalSortComparator }

/**
 * TS da mostrare sulla scheda CIVA. La scheda dati lo salva nel campo di testo `ts`,
 * precompilato dal catalogo; le schede compilate con i form per tipo ritirati lo tenevano
 * nel campo numerico `ts_temperatura`.
 */
const tsScheda = (ts?: string, legacy?: number): string | undefined => {
  const scritto = (ts ?? '').trim()
  if (scritto) return scritto
  return legacy === undefined || legacy === null ? undefined : String(legacy)
}

/**
 * Determina tipo pratica CIVA in base a volume e pressione
 *
 * Regole:
 * - V < 25L OR (25≤V<50L AND PS<12bar): NESSUNA
 * - V≥50L AND PS≤12bar AND (PS×V≤8000): DICHIARAZIONE
 * - V≥50L AND PS≤12bar AND (PS×V>8000): VERIFICA
 * - V>25L AND PS>12bar: VERIFICA
 *
 * Adattatore su `classificaRecipiente` (utils/dm329Classification), che è la sorgente
 * di verità delle soglie DM329: la relazione tecnica ha bisogno di distinguere i motivi
 * di esclusione, CIVA no.
 *
 * @param volume Volume in litri
 * @param ps Pressione massima ammissibile in bar
 * @returns Tipo pratica CIVA
 */
export function determineTipoPratica(
  volume: number | undefined,
  ps: number | undefined
): TipoPraticaCIVA {
  return esitoToTipoPratica(classificaRecipiente(volume, ps))
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
      ts_temperatura: tsScheda(serbatoio.ts, serbatoio.ts_temperatura),
      categoria_ped: serbatoio.categoria_ped,
      certificazione: serbatoio.certificazione ?? undefined,
      spessimetrica: serbatoio.spessimetrica === true,
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
      ts_temperatura: tsScheda(scambiatore.ts, scambiatore.ts_temperatura),
      categoria_ped: scambiatore.categoria_ped,
      certificazione: scambiatore.certificazione ?? undefined,
      spessimetrica: scambiatore.spessimetrica === true,
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
      ts_temperatura: tsScheda(disoleatore.ts, disoleatore.ts_temperatura),
      categoria_ped: disoleatore.categoria_ped,
      certificazione: disoleatore.certificazione ?? undefined,
      spessimetrica: disoleatore.spessimetrica === true,
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
      ts_temperatura: tsScheda(recipiente.ts, recipiente.ts_temperatura),
      categoria_ped: undefined, // RecipienteFiltro doesn't have categoria_ped field
      certificazione: recipiente.certificazione ?? undefined,
      spessimetrica: recipiente.spessimetrica === true,
      tipoPratica,
      manufacturer,
      parentCodice: recipiente.filtro_associato
    })
  }

  return result
}

/**
 * Estrae apparecchiature CIVA dai serbatoi interni dei generatori di azoto.
 *
 * Sono recipienti a pressione come gli altri (`ARRAY_RECIPIENTI`): ogni array ha il suo
 * estrattore perch� la CIVA espone campi diversi per tipo. Il costruttore � quello del
 * serbatoio; la descrizione viene da `descrizioneSerbatoioGeneratore`.
 */
function extractSerbatoiGeneratore(
  serbatoi: SerbatoioGeneratore[],
  manufacturers: Map<string, Manufacturer>
): CIVAApparecchio[] {
  const result: CIVAApparecchio[] = []

  for (const serbatoio of serbatoi) {
    if (!serbatoio.volume || !serbatoio.ps_pressione_max) {
      continue
    }

    const tipoPratica = determineTipoPratica(serbatoio.volume, serbatoio.ps_pressione_max)
    if (tipoPratica === 'NESSUNA') {
      continue
    }

    const manufacturer = manufacturers.get(serbatoio.marca || '')
    if (!manufacturer) {
      continue
    }

    result.push({
      codice: serbatoio.codice,
      tipo: 'Serbatoio generatore',
      marca: serbatoio.marca || '',
      modello: serbatoio.modello || '',
      descrizione: descrizioneSerbatoioGeneratore(serbatoio),
      n_fabbrica: serbatoio.n_fabbrica || '',
      anno: serbatoio.anno,
      volume: serbatoio.volume,
      ps_pressione_max: serbatoio.ps_pressione_max,
      ts_temperatura: tsScheda(serbatoio.ts, serbatoio.ts_temperatura),
      categoria_ped: serbatoio.categoria_ped,
      certificazione: serbatoio.certificazione ?? undefined,
      spessimetrica: serbatoio.spessimetrica === true,
      tipoPratica,
      manufacturer,
      parentCodice: serbatoio.generatore_associato
    })
  }

  return result
}

/**
 * Filtra e classifica tutte le apparecchiature per CIVA
 *
 * Estrae: Serbatoi, Scambiatori, Disoleatori, Recipienti Filtro, Serbatoi del generatore
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
  allApparecchi.push(...extractSerbatoiGeneratore(equipmentData.serbatoi_generatore || [], manufacturers))

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

  // Tutti gli array di recipienti (serbatoi, scambiatori, disoleatori, recipienti filtro,
  // serbatoi del generatore): stessa forma, un ciclo sulla lista unica.
  for (const array of ARRAY_RECIPIENTI) {
    for (const r of equipmentData[array] ?? []) {
      if (r.marca) names.add(r.marca)
    }
  }

  return Array.from(names)
}
