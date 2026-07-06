/**
 * Engine — tabella "procedura DM329" (Dichiarazione / Verifica messa in servizio).
 *
 * Regole (dal modello annotato):
 * - compressore con disoleatore associato → Verifica sul gruppo (Cx, Cx.1, Cx.2);
 *   senza disoleatore → nessun flag.
 * - serbatoio: PS×V > 8000 → Verifica, altrimenti Dichiarazione (via determineTipoPratica),
 *   flag esteso alla valvola Sx.1.
 * - essiccatore con scambiatore → Verifica (Ex, Ex.1); senza → nessun flag.
 * - filtro con recipiente → Verifica (Fx, Fx.1); senza → nessun flag.
 * - separatori e altri apparecchi → nessun flag.
 */
import type { SchedaDatiCompleta, ValvolaSicurezza } from '@/types/technicalSheet'
import type { EngineOptions, ProceduraRow } from '../types'
import { determineTipoPratica } from '@/utils/civaFiltering'
import { codiceValvolaDisoleatore, codiceValvolaSerbatoio } from '../helpers'

type Flags = Pick<ProceduraRow, 'dichiarazione' | 'verifica'>

const NO_FLAG: Flags = { dichiarazione: false, verifica: false }

export function buildProceduraDM329(
  scheda: SchedaDatiCompleta,
  options: EngineOptions = {}
): ProceduraRow[] {
  const resolve = options.resolveCostruttore ?? ((m?: string) => m ?? '')
  const rows: ProceduraRow[] = []

  const row = (
    pos: string,
    descrizione: string,
    marca: string | undefined,
    modello: string | undefined,
    nFabbrica: string | undefined,
    flags: Flags
  ): ProceduraRow => ({
    pos,
    descrizione,
    costruttore: resolve(marca),
    modello: modello ?? '',
    nFabbrica: nFabbrica ?? '',
    ...flags,
  })

  const valvolaRow = (pos: string, v: ValvolaSicurezza, flags: Flags) =>
    row(pos, 'Valvola di sicurezza', v.marca, v.modello, v.n_fabbrica, flags)

  // Compressori (+ disoleatori + valvole)
  for (const c of scheda.compressori ?? []) {
    const diso = (scheda.disoleatori ?? []).find((d) => d.compressore_associato === c.codice)
    const flags: Flags = diso ? { dichiarazione: false, verifica: true } : NO_FLAG
    rows.push(row(c.codice, 'Compressore', c.marca, c.modello, c.n_fabbrica, flags))
    if (diso) {
      rows.push(
        row(diso.codice, 'Serbatoio disoleatore', diso.marca, diso.modello, diso.n_fabbrica, flags)
      )
      rows.push(valvolaRow(codiceValvolaDisoleatore(diso.codice), diso.valvola_sicurezza, flags))
    }
  }

  // Serbatoi (+ valvole)
  for (const s of scheda.serbatoi ?? []) {
    const tipo = determineTipoPratica(s.volume, s.ps_pressione_max)
    const flags: Flags = {
      dichiarazione: tipo === 'DICHIARAZIONE',
      verifica: tipo === 'VERIFICA',
    }
    rows.push(row(s.codice, 'Serbatoio aria verticale', s.marca, s.modello, s.n_fabbrica, flags))
    rows.push(valvolaRow(codiceValvolaSerbatoio(s.codice), s.valvola_sicurezza, flags))
  }

  // Essiccatori (+ scambiatori)
  for (const e of scheda.essiccatori ?? []) {
    const scamb = (scheda.scambiatori ?? []).find((sc) => sc.essiccatore_associato === e.codice)
    const flags: Flags = scamb ? { dichiarazione: false, verifica: true } : NO_FLAG
    rows.push(row(e.codice, 'Essiccatore frigorifero', e.marca, e.modello, e.n_fabbrica, flags))
    if (scamb) {
      rows.push(
        row(scamb.codice, 'Scambiatore di calore', scamb.marca, scamb.modello, scamb.n_fabbrica, flags)
      )
    }
  }

  // Filtri (+ recipienti)
  for (const f of scheda.filtri ?? []) {
    const rec = (scheda.recipienti_filtro ?? []).find((r) => r.filtro_associato === f.codice)
    const flags: Flags = rec ? { dichiarazione: false, verifica: true } : NO_FLAG
    rows.push(row(f.codice, 'Filtro', f.marca, f.modello, f.n_fabbrica, flags))
    if (rec) {
      rows.push(row(rec.codice, 'Recipiente filtro', rec.marca, rec.modello, rec.n_fabbrica, flags))
    }
  }

  // Separatori (nessun flag)
  for (const sep of scheda.separatori ?? []) {
    rows.push(row(sep.codice, 'Separatore', sep.marca, sep.modello, sep.n_fabbrica, NO_FLAG))
  }

  return rows
}
