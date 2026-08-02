/**
 * Engine — §2.1 DESCRIZIONE GENERALE DELL'IMPIANTO.
 *
 * Produce l'elenco delle sezioni principali. È l'unico punto della relazione in cui la
 * prosa dipende ancora dalla configurazione: la strategia per contenerne la
 * combinatoria è raggruppare le apparecchiature omogenee e differenziare solo
 * sull'attributo che varia davvero.
 *
 * Esempio: con tre compressori tutti a vite di cui uno a giri fissi, il tipo si fattorizza
 * fuori ("n°3 compressori rotativi a vite di cui uno a giri fissi e due a giri
 * variabili"); se differiscono anche i tipi, il descrittore va dentro ai gruppi
 * ("n°2 compressori di cui uno rotativo a vite a giri fissi ed uno silenziato a pistoni").
 *
 * Le condizioni di installazione non stanno più qui: sono diventate la tabella §2.2
 * (`condizioniInstallazione.ts`), e i paragrafi invarianti vivono nel template.
 */
import type {
  SchedaDatiCompleta,
  Compressore,
  Serbatoio,
  TipoCompressore,
} from '@/types/technicalSheet'
import type { AdditionalInfo, DescrizioneGeneraleModel, TipoGiri } from '../types'
import { joinConLaE, numeroInLettere, plurale } from '../helpers'

// ---------------------------------------------------------------------------
// Sezione di pompaggio
// ---------------------------------------------------------------------------

const TIPO_COMPRESSORE: Record<TipoCompressore, { singolare: string; plurale: string }> = {
  VITE: { singolare: 'rotativo a vite', plurale: 'rotativi a vite' },
  PISTONI: { singolare: 'a pistoni', plurale: 'a pistoni' },
  SCROLL: { singolare: 'scroll', plurale: 'scroll' },
  CENTRIFUGO: { singolare: 'centrifugo', plurale: 'centrifughi' },
}

const GIRI: Record<TipoGiri, string> = {
  fissi: 'a giri fissi',
  variabili: 'a giri variabili tramite inverter',
}

/** Descrittore costruttivo: "silenziati a pistoni", "rotativo a vite". */
function descrittoreTipo(c: Compressore, count: number): string {
  const tipo = TIPO_COMPRESSORE[c.tipo ?? 'VITE']
  const base = count === 1 ? tipo.singolare : tipo.plurale
  if (!c.silenziato) return base
  return `${count === 1 ? 'silenziato' : 'silenziati'} ${base}`
}

/** Chiave di raggruppamento costruttivo: tipo + silenziato. */
function chiaveTipo(c: Compressore): string {
  return `${c.tipo ?? 'VITE'}|${c.silenziato ? 'S' : ''}`
}

function sezionePompaggio(
  compressori: Compressore[],
  giriMap: AdditionalInfo['compressoriGiri']
): string {
  const n = compressori.length
  const intro = `Sezione di pompaggio costituita da n°${n} ${plurale(
    n,
    'compressore',
    'compressori'
  )}`
  if (n === 0) return intro

  // Il dato di catalogo, riportato nella scheda, ha la precedenza: `additional_info` resta il
  // ripiego per i modelli su cui il catalogo non sa ancora nulla.
  const giriDi = (c: Compressore) => {
    const g = c.giri ?? giriMap?.[c.codice]
    return g ? GIRI[g] : ''
  }
  const tipiDistinti = new Set(compressori.map(chiaveTipo))
  const giriDistinti = new Set(compressori.map(giriDi))

  // Configurazione omogenea: un solo periodo, nessun elenco.
  if (tipiDistinti.size === 1 && giriDistinti.size === 1) {
    return [intro, descrittoreTipo(compressori[0], n), giriDi(compressori[0])]
      .filter(Boolean)
      .join(' ')
  }

  // Tipo comune: si fattorizza fuori e si differenzia sui soli giri.
  if (tipiDistinti.size === 1) {
    const perGiri = new Map<string, number>()
    for (const c of compressori) {
      const g = giriDi(c)
      perGiri.set(g, (perGiri.get(g) ?? 0) + 1)
    }
    const voci = [...perGiri].map(([g, k]) => [numeroInLettere(k), g].filter(Boolean).join(' '))
    return `${intro} ${descrittoreTipo(compressori[0], n)} di cui ${joinConLaE(voci)}`
  }

  // Tipi diversi: il descrittore completo entra in ciascun gruppo.
  const gruppi = new Map<string, { esempio: Compressore; giri: string; count: number }>()
  for (const c of compressori) {
    const k = `${chiaveTipo(c)}|${giriDi(c)}`
    const esistente = gruppi.get(k)
    if (esistente) esistente.count += 1
    else gruppi.set(k, { esempio: c, giri: giriDi(c), count: 1 })
  }
  const voci = [...gruppi.values()].map((g) =>
    [numeroInLettere(g.count), descrittoreTipo(g.esempio, g.count), g.giri]
      .filter(Boolean)
      .join(' ')
  )
  return `${intro} di cui ${joinConLaE(voci)}`
}

// ---------------------------------------------------------------------------
// Sezioni di accumulo
// ---------------------------------------------------------------------------

const UBICAZIONE: Record<string, { singolare: string; plurale: string }> = {
  SALA_COMPRESSORI: {
    singolare: 'ubicato in sala compressori',
    plurale: 'ubicati in sala compressori',
  },
  LINEA_DISTRIBUZIONE: {
    singolare: 'dislocato lungo la linea di distribuzione',
    plurale: 'dislocati lungo la linea di distribuzione',
  },
}

function descrizioneAccumulo(serbatoi: Serbatoio[], etichettaLinea: string): string {
  const n = serbatoi.length
  const orientamenti = new Set(serbatoi.map((s) => s.orientamento ?? 'VERTICALE'))
  const orientamento =
    orientamenti.size === 1
      ? [...orientamenti][0] === 'ORIZZONTALE'
        ? plurale(n, 'orizzontale', 'orizzontali')
        : plurale(n, 'verticale', 'verticali')
      : ''

  const intro =
    `Sezione di accumulo ed alimentazione delle linee ${etichettaLinea} costituita da ` +
    `n°${n} ${plurale(n, 'serbatoio polmone', 'serbatoi polmone')}` +
    (orientamento ? ` ${orientamento}` : '')

  // Le ubicazioni si elencano solo se effettivamente diverse fra loro.
  const perUbicazione = new Map<string, number>()
  for (const s of serbatoi) {
    const u = s.ubicazione ?? 'SALA_COMPRESSORI'
    const chiave = u === 'ALTRO' ? (s.ubicazione_altro?.trim() || 'ALTRO') : u
    perUbicazione.set(chiave, (perUbicazione.get(chiave) ?? 0) + 1)
  }
  if (perUbicazione.size <= 1) return intro

  const voci = [...perUbicazione].map(([chiave, k]) => {
    const label = UBICAZIONE[chiave]
    const testo = label ? (k === 1 ? label.singolare : label.plurale) : chiave
    return `${numeroInLettere(k)} ${testo}`
  })
  return `${intro} di cui ${joinConLaE(voci)}`
}

// ---------------------------------------------------------------------------
// Sezione trattamento aria
// ---------------------------------------------------------------------------

function sezioneTrattamento(scheda: SchedaDatiCompleta): string {
  const filtri = scheda.filtri ?? []
  const nPre = filtri.filter((f) => f.tipo === 'PREFILTRO').length
  const nLinea = filtri.length - nPre
  const nE = scheda.essiccatori?.length ?? 0

  const parti: string[] = []
  if (nPre > 0) parti.push(`n°${nPre} ${plurale(nPre, 'prefiltro', 'prefiltri')}`)
  if (nE > 0) {
    parti.push(
      `n°${nE} ${plurale(nE, 'essiccatore', 'essiccatori')} d'aria a ciclo frigorifero`
    )
  }
  if (nLinea > 0) {
    parti.push(`n°${nLinea} ${plurale(nLinea, 'filtro', 'filtri')} di linea`)
  }
  return `Sezione trattamento aria costituita da ${joinConLaE(parti)}`
}

// ---------------------------------------------------------------------------
// Assemblaggio
// ---------------------------------------------------------------------------

/** Etichetta della linea servita da un gruppo di serbatoi. */
function etichettaFluido(s: Serbatoio): string {
  if (s.fluido === 'AZOTO') return 'azoto'
  if (s.fluido === 'ALTRO') return s.fluido_altro?.trim().toLowerCase() || 'altro fluido'
  return 'aria compressa'
}

export function buildDescrizioneGenerale(
  scheda: SchedaDatiCompleta,
  additionalInfo: AdditionalInfo
): DescrizioneGeneraleModel {
  const compressori = scheda.compressori ?? []
  const serbatoi = scheda.serbatoi ?? []
  const sezioni: string[] = []

  if (compressori.length > 0) {
    sezioni.push(sezionePompaggio(compressori, additionalInfo.compressoriGiri))
  }

  // Una sezione di accumulo per ciascun fluido, aria compressa per prima.
  const perFluido = new Map<string, Serbatoio[]>()
  for (const s of serbatoi) {
    const etichetta = etichettaFluido(s)
    const gruppo = perFluido.get(etichetta)
    if (gruppo) gruppo.push(s)
    else perFluido.set(etichetta, [s])
  }
  const etichetteOrdinate = [...perFluido.keys()].sort((a, b) =>
    a === 'aria compressa' ? -1 : b === 'aria compressa' ? 1 : a.localeCompare(b)
  )
  for (const etichetta of etichetteOrdinate) {
    sezioni.push(descrizioneAccumulo(perFluido.get(etichetta)!, etichetta))
  }

  if ((scheda.essiccatori?.length ?? 0) > 0 || (scheda.filtri?.length ?? 0) > 0) {
    sezioni.push(sezioneTrattamento(scheda))
  }

  if ((scheda.separatori?.length ?? 0) > 0) {
    sezioni.push('Raccolta e trattamento delle condense tramite separatore acqua olio')
  }
  const raccolta = scheda.dati_impianto?.raccolta_condense
  if (raccolta === 'tanica') {
    sezioni.push('Raccolta delle condense in tanica dedicata')
  } else if (raccolta === 'altro') {
    sezioni.push('Raccolta delle condense in recipiente dedicato')
  }

  return { sezioni }
}
