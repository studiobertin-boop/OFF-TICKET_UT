/**
 * Raggruppamento delle apparecchiature per la dichiarazione dell'installatore.
 *
 * Riusa lo stesso predicato di `civaFiltering.ts` (`comportaAdempimento` su
 * `classificaRecipiente`) per decidere chi è "oggetto di denuncia o verifica INAIL", ma a
 * differenza di `filterCIVAEquipment` — che produce una lista piatta di soli dipendenti —
 * qui il dipendente soggetto va abbinato alla sua unità madre (compressore, essiccatore,
 * filtro), perché è così che la dichiarazione dell'installatore descrive l'impianto: un
 * compressore compare sempre come intestazione del suo gruppo anche se di per sé escluso
 * dal DM329, il dipendente no se non è soggetto.
 *
 * Alla soglia DM329 si aggiunge un secondo filtro, che `filterCIVAEquipment` non ha: le
 * apparecchiature marcate «già denunciato» restano fuori — vedi `daDichiarare`.
 */
import type { Compressore, Essiccatore, Filtro, SchedaDatiCompleta } from '@/types/technicalSheet'
import { classificaRecipiente, comportaAdempimento } from '@/utils/dm329Classification'
import { naturalSortComparator } from '@/utils/naturalSort'

export interface ApparecchiaturaRiga {
  tipo: string
  marca?: string
  modello?: string
  n_fabbrica?: string
}

export interface RigaTabella {
  principale: ApparecchiaturaRiga | null
  dipendente: ApparecchiaturaRiga
  /** Codice del dipendente (o del recipiente standalone), per l'ordinamento naturale. */
  codiceOrdinamento: string
}

/**
 * Va dichiarato? Deve comportare adempimento **e** non essere già a matricola INAIL.
 *
 * La dichiarazione accompagna la denuncia di messa in servizio: riguarda quindi le sole
 * apparecchiature che si stanno denunciando adesso. Un recipiente marcato «già denunciato»
 * INAIL lo ha già a matricola, e ripeterlo qui lo farebbe risultare in denuncia due volte.
 */
const daDichiarare = (riga: {
  volume?: number
  ps_pressione_max?: number
  gia_denunciato?: boolean
}): boolean =>
  !riga.gia_denunciato && comportaAdempimento(classificaRecipiente(riga.volume, riga.ps_pressione_max))

const principaleDi = (
  apparecchio: Compressore | Essiccatore | Filtro | undefined,
  tipo: string
): ApparecchiaturaRiga | null =>
  apparecchio ? { tipo, marca: apparecchio.marca, modello: apparecchio.modello, n_fabbrica: apparecchio.n_fabbrica } : null

export function raggruppaApparecchiatureInstallatore(scheda: SchedaDatiCompleta): RigaTabella[] {
  const righe: RigaTabella[] = []

  for (const d of scheda.disoleatori ?? []) {
    if (!daDichiarare(d)) continue
    const compressore = scheda.compressori?.find((c) => c.codice === d.compressore_associato)
    righe.push({
      principale: principaleDi(compressore, 'Compressore'),
      dipendente: { tipo: 'Serbatoio disoleatore', marca: d.marca, modello: d.modello, n_fabbrica: d.n_fabbrica },
      codiceOrdinamento: d.codice,
    })
  }

  for (const s of scheda.scambiatori ?? []) {
    if (!daDichiarare(s)) continue
    const essiccatore = scheda.essiccatori?.find((e) => e.codice === s.essiccatore_associato)
    righe.push({
      principale: principaleDi(essiccatore, 'Essiccatore frigorifero'),
      dipendente: { tipo: 'Scambiatore di calore', marca: s.marca, modello: s.modello, n_fabbrica: s.n_fabbrica },
      codiceOrdinamento: s.codice,
    })
  }

  for (const r of scheda.recipienti_filtro ?? []) {
    if (!daDichiarare(r)) continue
    const filtro = scheda.filtri?.find((f) => f.codice === r.filtro_associato)
    righe.push({
      principale: principaleDi(filtro, 'Filtro'),
      dipendente: { tipo: 'Recipiente filtro', marca: r.marca, modello: r.modello, n_fabbrica: r.n_fabbrica },
      codiceOrdinamento: r.codice,
    })
  }

  for (const s of scheda.serbatoi ?? []) {
    if (!daDichiarare(s)) continue
    const tipo = s.orientamento === 'ORIZZONTALE' ? 'Serbatoio aria orizzontale' : 'Serbatoio aria verticale'
    righe.push({
      principale: null,
      dipendente: { tipo, marca: s.marca, modello: s.modello, n_fabbrica: s.n_fabbrica },
      codiceOrdinamento: s.codice,
    })
  }

  return righe.sort((a, b) => naturalSortComparator(a.codiceOrdinamento, b.codiceOrdinamento))
}
