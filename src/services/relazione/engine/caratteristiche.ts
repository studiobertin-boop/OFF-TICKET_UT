/**
 * Engine — tabella "caratteristiche apparecchiature".
 *
 * La colonna centrale cambia significato per tipo di apparecchio:
 * - compressore: aria producibile (FAD)
 * - valvola: portata scaricata; pressione = pressione di taratura
 * - recipienti (disoleatore/serbatoio/scambiatore/recipiente filtro): volume; pressione = PS
 * La temperatura usa un minimo convenzionale per tipo + il TS massimo salvato.
 */
import type { SchedaDatiCompleta, ValvolaSicurezza } from '@/types/technicalSheet'
import type { CaratteristicheRow, EngineOptions } from '../types'
import {
  codiceValvolaDisoleatore,
  codiceValvolaSerbatoio,
  formatNumberIT,
  formatTemperatura,
} from '../helpers'

// Minimi convenzionali di temperatura per tipo apparecchio
const TEMP_MIN_RECIPIENTE = -10
const TEMP_MIN_VALVOLA = -10
const TEMP_MIN_SCAMBIATORE = -20

export function buildCaratteristiche(
  scheda: SchedaDatiCompleta,
  options: EngineOptions = {}
): CaratteristicheRow[] {
  const resolve = options.resolveCostruttore ?? ((m?: string) => m ?? '')
  const rows: CaratteristicheRow[] = []

  const base = (
    pos: string,
    descrizione: string,
    marca: string | undefined,
    modello: string | undefined,
    anno: number | undefined,
    nFabbrica: string | undefined
  ) => ({
    pos,
    descrizione,
    costruttore: resolve(marca),
    modello: modello ?? '',
    anno: anno !== undefined ? String(anno) : '',
    nFabbrica: nFabbrica ?? '',
  })

  const valvolaRow = (pos: string, v: ValvolaSicurezza): CaratteristicheRow => ({
    ...base(pos, 'Valvola di sicurezza', v.marca, v.modello, v.anno, v.n_fabbrica),
    capacita: formatNumberIT(v.volume_aria_scaricato),
    pressione: formatNumberIT(v.pressione_taratura),
    temperatura: formatTemperatura(TEMP_MIN_VALVOLA, v.ts_temperatura),
    categoria: v.categoria_ped ?? '',
  })

  // Compressori (+ disoleatori + valvole)
  for (const c of scheda.compressori ?? []) {
    rows.push({
      ...base(c.codice, 'Compressore', c.marca, c.modello, c.anno, c.n_fabbrica),
      capacita: formatNumberIT(c.volume_aria_prodotto),
      pressione: formatNumberIT(c.pressione_max),
      temperatura: '',
      categoria: '',
    })
    const diso = (scheda.disoleatori ?? []).find((d) => d.compressore_associato === c.codice)
    if (diso) {
      rows.push({
        ...base(diso.codice, 'Serbatoio disoleatore', diso.marca, diso.modello, diso.anno, diso.n_fabbrica),
        capacita: formatNumberIT(diso.volume),
        pressione: formatNumberIT(diso.ps_pressione_max),
        temperatura: formatTemperatura(TEMP_MIN_RECIPIENTE, diso.ts_temperatura),
        categoria: diso.categoria_ped ?? '',
      })
      rows.push(valvolaRow(codiceValvolaDisoleatore(diso.codice), diso.valvola_sicurezza))
    }
  }

  // Serbatoi (+ valvole)
  for (const s of scheda.serbatoi ?? []) {
    rows.push({
      ...base(s.codice, 'Serbatoio aria verticale', s.marca, s.modello, s.anno, s.n_fabbrica),
      capacita: formatNumberIT(s.volume),
      pressione: formatNumberIT(s.ps_pressione_max),
      temperatura: formatTemperatura(TEMP_MIN_RECIPIENTE, s.ts_temperatura),
      categoria: s.categoria_ped ?? '',
    })
    rows.push(valvolaRow(codiceValvolaSerbatoio(s.codice), s.valvola_sicurezza))
  }

  // Essiccatori (+ scambiatori)
  for (const e of scheda.essiccatori ?? []) {
    rows.push({
      ...base(e.codice, 'Essiccatore frigorifero', e.marca, e.modello, e.anno, e.n_fabbrica),
      capacita: formatNumberIT(e.volume_aria_trattata),
      pressione: formatNumberIT(e.ps_pressione_max),
      temperatura: '',
      categoria: '',
    })
    const scamb = (scheda.scambiatori ?? []).find((sc) => sc.essiccatore_associato === e.codice)
    if (scamb) {
      rows.push({
        ...base(scamb.codice, 'Scambiatore di calore', scamb.marca, scamb.modello, scamb.anno, scamb.n_fabbrica),
        capacita: formatNumberIT(scamb.volume),
        pressione: formatNumberIT(scamb.ps_pressione_max),
        temperatura: formatTemperatura(TEMP_MIN_SCAMBIATORE, scamb.ts_temperatura),
        categoria: scamb.categoria_ped ?? '',
      })
    }
  }

  // Filtri (+ recipienti)
  for (const f of scheda.filtri ?? []) {
    rows.push({
      ...base(f.codice, 'Filtro', f.marca, f.modello, f.anno, f.n_fabbrica),
      capacita: '',
      pressione: '',
      temperatura: '',
      categoria: '',
    })
    const rec = (scheda.recipienti_filtro ?? []).find((r) => r.filtro_associato === f.codice)
    if (rec) {
      rows.push({
        ...base(rec.codice, 'Recipiente filtro', rec.marca, rec.modello, rec.anno, rec.n_fabbrica),
        capacita: formatNumberIT(rec.volume),
        pressione: formatNumberIT(rec.ps_pressione_max),
        temperatura: formatTemperatura(TEMP_MIN_RECIPIENTE, rec.ts_temperatura),
        categoria: '',
      })
    }
  }

  // Separatori
  for (const sep of scheda.separatori ?? []) {
    rows.push({
      ...base(sep.codice, 'Separatore', sep.marca, sep.modello, sep.anno, sep.n_fabbrica),
      capacita: '',
      pressione: '',
      temperatura: '',
      categoria: '',
    })
  }

  return rows
}
