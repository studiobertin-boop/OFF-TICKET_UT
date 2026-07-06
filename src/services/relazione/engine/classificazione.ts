/**
 * Engine — sezione CLASSIFICAZIONE DELLE APPARECCHIATURE.
 *
 * Seleziona in modo deterministico una delle 5 alternative per compressori,
 * essiccatori e serbatoi in base a conteggio e presenza di apparecchio associato
 * (o tipo pratica per i serbatoi), risolvendo posizioni, plurali e sotto-flag.
 *
 * ⚠️ TESTI LEGALI: trascritti dal modello annotato (RELAZIONE TECNICA_esempio.pdf).
 * Vanno validati legalmente prima dell'uso in produzione.
 */
import type { SchedaDatiCompleta, Serbatoio } from '@/types/technicalSheet'
import type { AdditionalInfo, ClassificazioneBlocco, ClassificazioneModel } from '../types'
import { determineTipoPratica } from '@/utils/civaFiltering'
import { formatNumberIT, joinConLaE } from '../helpers'

// ---------------------------------------------------------------------------
// Compressori
// ---------------------------------------------------------------------------

function classCompressori(
  scheda: SchedaDatiCompleta,
  additionalInfo: AdditionalInfo
): ClassificazioneBlocco {
  const compressori = scheda.compressori ?? []
  const disoleatori = scheda.disoleatori ?? []
  const disoDi = (codice: string) => disoleatori.find((d) => d.compressore_associato === codice)
  const conDiso = compressori.filter((c) => disoDi(c.codice))
  const n = compressori.length

  const escluso = (pos: string) =>
    `il serbatoio disoleatore a servizio del compressore, individuato alla posizione ${pos}, ` +
    `ha volume inferiore a 25 litri e pertanto escluso dal campo di applicazione del ` +
    `D.M. 329/2004 ai sensi dell'art. 2.i del medesimo decreto.`
  const verifica = (pos: string) =>
    `il serbatoio disoleatore a servizio del compressore, individuato alla posizione ${pos}, ` +
    `ha volume superiore a 25 litri e pressione massima ammissibile superiore a 12 bar e ` +
    `pertanto, secondo quanto disposto dal combinato degli artt. 4 e 5 del DM329/2004, ` +
    `risulta soggetto a verifica di messa in servizio.`

  let alternativa = 0
  let testo = ''

  if (n === 1 && conDiso.length === 0) {
    alternativa = 1
    testo = escluso(compressori[0].codice)
  } else if (n === 1 && conDiso.length === 1) {
    alternativa = 2
    testo = verifica(disoDi(compressori[0].codice)!.codice)
  } else if (n > 1 && conDiso.length === 0) {
    alternativa = 3
    testo =
      `i serbatoi disoleatori a servizio dei compressori individuati alle posizioni ` +
      `${joinConLaE(compressori.map((c) => c.codice))} hanno volume inferiore a 25 litri e ` +
      `pertanto sono esclusi dal campo di applicazione del D.M. 329/2004 ai sensi dell'art. 2.i ` +
      `del medesimo decreto.`
  } else if (n > 1 && conDiso.length === n) {
    alternativa = 5
    testo =
      `i serbatoi disoleatori a servizio dei compressori, individuati alle posizioni ` +
      `${joinConLaE(conDiso.map((c) => disoDi(c.codice)!.codice))}, hanno volume superiore a 25 ` +
      `litri e pressione massima ammissibile superiore a 12 bar e pertanto, secondo quanto ` +
      `disposto dal combinato degli artt. 4 e 5 del DM329/2004, risultano soggetti a verifica ` +
      `di messa in servizio.`
  } else if (n > 1) {
    alternativa = 4
    testo = compressori
      .map((c) => {
        const diso = disoDi(c.codice)
        return diso ? `- ${verifica(diso.codice)}` : `- ${escluso(c.codice)}`
      })
      .join('\n')
  }

  // Addon spessimetrica per i disoleatori sottoposti a verifica spessimetrica
  const spess = additionalInfo.spessimetrica ?? []
  const addon = compressori
    .map((c) => disoDi(c.codice))
    .filter((d): d is NonNullable<typeof d> => !!d && spess.includes(d.codice))
    .map(
      (d) =>
        `In considerazione della data di produzione e delle frequenze delle verifiche di ` +
        `integrità previste dall'art.3 del D.lgs. 93/2000, il serbatoio disoleatore del ` +
        `compressore ${d.compressore_associato} è stato sottoposto a verifica spessimetrica, ` +
        `con esito positivo.`
    )
  if (addon.length > 0) {
    testo += `\n${addon.join('\n')}`
  }

  return { alternativa, testo }
}

// ---------------------------------------------------------------------------
// Essiccatori
// ---------------------------------------------------------------------------

function classEssiccatori(scheda: SchedaDatiCompleta): ClassificazioneBlocco {
  const essiccatori = scheda.essiccatori ?? []
  const scambiatori = scheda.scambiatori ?? []
  const scambDi = (codice: string) => scambiatori.find((s) => s.essiccatore_associato === codice)
  const conScamb = essiccatori.filter((e) => scambDi(e.codice))
  const n = essiccatori.length

  const escluso = (pos: string) =>
    `Si tratta di una apparecchiatura, individuata alla posizione ${pos}, priva di recipienti ` +
    `di volume superiore a 25 litri e pertanto escluso dal campo di applicazione del ` +
    `D.M. 329/2004 ai sensi dell'art. 2.i del medesimo decreto.`
  const verifica = (posE: string, posS: string) =>
    `Si tratta di una apparecchiatura, individuata alla posizione ${posE}, dotata di uno ` +
    `scambiatore di calore in pressione, individuato alla posizione ${posS}, con volume ` +
    `superiore a 25 litri e pressione massima ammissibile superiore a 12 bar e pertanto, ` +
    `secondo quanto disposto dal combinato degli artt. 4 e 5 del DM329/2004, risulta soggetto ` +
    `a verifica di messa in servizio.`

  let alternativa = 0
  let testo = ''

  if (n === 1 && conScamb.length === 0) {
    alternativa = 1
    testo = escluso(essiccatori[0].codice)
  } else if (n === 1 && conScamb.length === 1) {
    alternativa = 2
    testo = verifica(essiccatori[0].codice, scambDi(essiccatori[0].codice)!.codice)
  } else if (n > 1 && conScamb.length === 0) {
    alternativa = 3
    testo =
      `Si tratta di apparecchiature, individuate alle posizioni ` +
      `${joinConLaE(essiccatori.map((e) => e.codice))}, prive di recipienti di volume superiore ` +
      `a 25 litri e pertanto escluse dal campo di applicazione del D.M. 329/2004 ai sensi ` +
      `dell'art. 2.i del medesimo decreto.`
  } else if (n > 1 && conScamb.length === n) {
    alternativa = 5
    testo =
      `Si tratta di apparecchiature, individuate alle posizioni ` +
      `${joinConLaE(essiccatori.map((e) => e.codice))}, dotate di scambiatori di calore in ` +
      `pressione, individuati alle posizioni ` +
      `${joinConLaE(conScamb.map((e) => scambDi(e.codice)!.codice))}, con volume superiore a 25 ` +
      `litri e pressione massima ammissibile superiore a 12 bar e pertanto, secondo quanto ` +
      `disposto dal combinato degli artt. 4 e 5 del DM329/2004, risulta soggetto a verifica di ` +
      `messa in servizio.`
  } else if (n > 1) {
    alternativa = 4
    testo = essiccatori
      .map((e) => {
        const s = scambDi(e.codice)
        return s
          ? `- l'essiccatore ${e.codice} è una apparecchiatura, individuata alla posizione ` +
              `${e.codice}, dotata di uno scambiatore di calore in pressione, individuato alla ` +
              `posizione ${s.codice}, con volume superiore a 25 litri e pressione massima ` +
              `ammissibile superiore a 12 bar e pertanto, secondo quanto disposto dal combinato ` +
              `degli artt. 4 e 5 del DM329/2004, risulta soggetto a verifica di messa in servizio.`
          : `- l'essiccatore ${e.codice} è una apparecchiatura, individuata alla posizione ` +
              `${e.codice}, priva di recipienti di volume superiore a 25 litri e pertanto escluso ` +
              `dal campo di applicazione del D.M. 329/2004 ai sensi dell'art. 2.i del medesimo decreto.`
      })
      .join('\n')
  }

  return { alternativa, testo }
}

// ---------------------------------------------------------------------------
// Serbatoi
// ---------------------------------------------------------------------------

function dettaglioSerbatoio(s: Serbatoio): string {
  const scarico =
    s.scarico === 'AUTOMATICO' ? 'automatico' : s.scarico === 'MANUALE' ? 'manuale' : ''
  let d =
    `È completo di scaricatore di condensa ${scarico} per prevenire l'accumulo di acqua in ` +
    `grado di originare fenomeni di corrosione localizzata.`
  if (s.finitura_interna === 'ZINCATO') {
    d += ` I fenomeni di corrosione sono inoltre minimizzati dalla finitura superficiale zincata.`
  } else if (s.finitura_interna === 'VITROFLEX') {
    d += ` I fenomeni di corrosione sono inoltre minimizzati dalla finitura superficiale vetrificata.`
  }
  const ancorato = s.ancorato_terra ? ' ancorato a terra' : ''
  let manometro = ''
  if (s.manometro?.fondo_scala != null && s.manometro?.segno_rosso != null) {
    manometro =
      ` riportante fondo scala a ${formatNumberIT(s.manometro.fondo_scala)} bar e segno rosso a ` +
      `${formatNumberIT(s.manometro.segno_rosso)} bar`
  }
  d += ` Risulta inoltre${ancorato}, dotato di manometro di controllo della pressione${manometro}.`
  return d.replace(/\s+/g, ' ').trim()
}

function coreSerbatoio(s: Serbatoio): string {
  const v = s.volume ?? 0
  const ps = s.ps_pressione_max ?? 0
  const psv = ps * v
  const soggetto = determineTipoPratica(v, ps) === 'VERIFICA'
  const confronto = psv > 8000 ? 'superiore' : 'inferiore'
  const esito = soggetto
    ? 'risulta soggetto a verifica di messa in servizio'
    : 'non risulta soggetto a verifica di messa in servizio ma esclusivamente a dichiarazione di messa in servizio'
  return (
    `il serbatoio individuato alla posizione ${s.codice} ha volume pari a ${formatNumberIT(v)} ` +
    `litri e pressione massima ammissibile pari a ${formatNumberIT(ps)}. Il prodotto Ps x V è ` +
    `pari a ${formatNumberIT(psv)} e quindi ${confronto} a 8000. Pertanto, secondo quanto ` +
    `disposto dal combinato degli artt. 4 e 5 del DM329/2004, ${esito}. ${dettaglioSerbatoio(s)}`
  )
}

function classSerbatoi(scheda: SchedaDatiCompleta): ClassificazioneBlocco {
  const serbatoi = scheda.serbatoi ?? []
  const isVerifica = (s: Serbatoio) => determineTipoPratica(s.volume, s.ps_pressione_max) === 'VERIFICA'
  const ver = serbatoi.filter(isVerifica)
  const n = serbatoi.length

  const introMulti =
    'Rientrano nel campo di applicazione del D.M. 329/2004.\n' +
    'Tutti i serbatoi di accumulo presenti sono dotati di valvole di sicurezza opportunamente ' +
    'dimensionate, come dimostrato nel seguito del presente documento. In particolare:\n'

  let alternativa = 0
  let testo = ''

  if (n === 1 && ver.length === 0) {
    alternativa = 1
    testo = `Rientra nel campo di applicazione del D.M. 329/2004.\nIn particolare, ${coreSerbatoio(serbatoi[0])}`
  } else if (n === 1 && ver.length === 1) {
    alternativa = 2
    testo = `Rientra nel campo di applicazione del D.M. 329/2004.\nIn particolare, ${coreSerbatoio(serbatoi[0])}`
  } else if (n > 1 && ver.length === 0) {
    alternativa = 3
    testo = introMulti + serbatoi.map((s) => `- ${coreSerbatoio(s)}`).join('\n')
  } else if (n > 1 && ver.length === n) {
    alternativa = 5
    testo = introMulti + serbatoi.map((s) => `- ${coreSerbatoio(s)}`).join('\n')
  } else if (n > 1) {
    alternativa = 4
    testo = introMulti + serbatoi.map((s) => `- ${coreSerbatoio(s)}`).join('\n')
  }

  return { alternativa, testo }
}

export function buildClassificazione(
  scheda: SchedaDatiCompleta,
  additionalInfo: AdditionalInfo
): ClassificazioneModel {
  return {
    compressori: classCompressori(scheda, additionalInfo),
    essiccatori: classEssiccatori(scheda),
    serbatoi: classSerbatoi(scheda),
  }
}
