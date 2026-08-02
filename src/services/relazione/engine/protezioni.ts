/**
 * Engine — §5.3 SISTEMI DI PROTEZIONE E CONTROLLO.
 *
 * Due tabelle, perché le apparecchiature non condividono gli stessi presidi:
 * 1. serbatoi — scarico condensa, finitura interna, ancoraggio, manometro sono dati
 *    effettivamente rilevati in scheda;
 * 2. altre apparecchiature soggette al DM329 (disoleatori, scambiatori, recipienti
 *    filtro) — di queste si conoscono solo le valvole che le proteggono e il manometro.
 *
 * Le apparecchiature escluse dal campo di applicazione non compaiono: l'inclusione
 * deriva dagli esiti di §5.2, così le due sezioni non possono divergere.
 */
import type {
  SchedaDatiCompleta,
  Serbatoio,
  FinituraInternaOption,
} from '@/types/technicalSheet'
import type {
  EsitoRow,
  ProtezioneAltraRow,
  ProtezioneRow,
  ProtezioniModel,
  ValvolaProtezione,
} from '../types'
import { codiciValvoleSerbatoio, descrizioneSerbatoio, formatNumberIT, valvoleDi } from '../helpers'
import { comportaAdempimento } from '@/utils/dm329Classification'
import { codiciValvoleDisoleatore, risolviValvole } from '@/utils/valvoleImpianto'
import type { ValvolaImpianto } from '@/utils/valvoleImpianto'

const SCARICO_LABEL: Record<string, string> = {
  AUTOMATICO: 'Automatico',
  MANUALE: 'Manuale',
  ASSENTE: 'Assente',
}

const FINITURA_LABEL: Record<FinituraInternaOption, string> = {
  VERNICIATO: 'Verniciato',
  ZINCATO: 'Zincato',
  VITROFLEX: 'Vitroflex',
  ALTRO: 'Altro',
}

/** Il manometro di disoleatori e scambiatori è integrato nella macchina. */
const MANOMETRO_A_BORDO = 'a bordo macchina'
/** I recipienti filtro non portano manometro. */
const MANOMETRO_ASSENTE = '-'

/**
 * La pressione di taratura non compare qui: §6.2 la riporta per esteso accanto alla PS
 * del recipiente, che è il confronto che conta. Ripeterla in §5.3 era ridondante.
 */
function valvolaProtezione(pos: string, v: ValvolaImpianto['valvola']): ValvolaProtezione {
  return {
    pos,
    nFabbrica: v.n_fabbrica ?? '',
  }
}

function manometroLabel(s: Serbatoio): string {
  const parti: string[] = []
  if (s.manometro?.fondo_scala != null) {
    parti.push(`fondo scala ${formatNumberIT(s.manometro.fondo_scala)} bar`)
  }
  if (s.manometro?.segno_rosso != null) {
    parti.push(`segno rosso ${formatNumberIT(s.manometro.segno_rosso)} bar`)
  }
  return parti.join(' · ')
}

export function buildProtezioni(
  scheda: SchedaDatiCompleta,
  esiti: EsitoRow[]
): ProtezioniModel {
  // Solo le apparecchiature con un adempimento effettivo entrano nella sezione.
  const soggette = new Set(
    esiti.filter((e) => comportaAdempimento(e.esito)).map((e) => e.pos)
  )

  const serbatoi: ProtezioneRow[] = []
  for (const s of scheda.serbatoi ?? []) {
    if (!soggette.has(s.codice)) continue
    const valvole = valvoleDi(s.valvola_sicurezza, s.valvole_aggiuntive)
    serbatoi.push({
      pos: s.codice,
      apparecchiatura: descrizioneSerbatoio(s),
      valvole: codiciValvoleSerbatoio(s.codice, valvole.length).map((pos, i) =>
        valvolaProtezione(pos, valvole[i])
      ),
      scaricoCondensa: s.scarico ? (SCARICO_LABEL[s.scarico] ?? '') : '',
      finituraInterna: s.finitura_interna ? FINITURA_LABEL[s.finitura_interna] : '',
      ancoraggio: s.ancorato_terra === true ? 'Sì' : s.ancorato_terra === false ? 'No' : '',
      manometro: manometroLabel(s),
    })
  }

  const altre: ProtezioneAltraRow[] = []

  // Disoleatori: portano una valvola propria.
  for (const c of scheda.compressori ?? []) {
    const diso = (scheda.disoleatori ?? []).find((d) => d.compressore_associato === c.codice)
    if (!diso || !soggette.has(diso.codice)) continue
    const valvole = valvoleDi(diso.valvola_sicurezza, diso.valvole_aggiuntive)
    altre.push({
      pos: diso.codice,
      apparecchiatura: 'Serbatoio disoleatore',
      valvole: codiciValvoleDisoleatore(diso.codice, valvole.length).map((pos, i) =>
        valvolaProtezione(pos, valvole[i])
      ),
      manometro: MANOMETRO_A_BORDO,
    })
  }

  // Scambiatori e recipienti filtro: non hanno valvola propria, sono protetti da
  // valvole poste altrove nell'impianto. Il legame è dichiarato in scheda
  // (`valvole_protezione`) perché non è deducibile dagli altri dati.
  for (const scamb of scheda.scambiatori ?? []) {
    if (!soggette.has(scamb.codice)) continue
    altre.push({
      pos: scamb.codice,
      apparecchiatura: 'Scambiatore di calore',
      valvole: risolviValvole(scheda, scamb.valvole_protezione).map((v) =>
        valvolaProtezione(v.pos, v.valvola)
      ),
      manometro: MANOMETRO_A_BORDO,
    })
  }

  for (const rec of scheda.recipienti_filtro ?? []) {
    if (!soggette.has(rec.codice)) continue
    altre.push({
      pos: rec.codice,
      apparecchiatura: 'Recipiente filtro',
      valvole: risolviValvole(scheda, rec.valvole_protezione).map((v) =>
        valvolaProtezione(v.pos, v.valvola)
      ),
      manometro: MANOMETRO_ASSENTE,
    })
  }

  return { serbatoi, altre, haAltre: altre.length > 0 }
}
