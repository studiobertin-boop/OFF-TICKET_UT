/**
 * Engine — §5.2 TABELLA DEGLI ESITI DM 329/2004.
 *
 * Sostituisce insieme la vecchia tabella "procedura" a spunte e l'intera sezione di
 * prosa "classificazione" (che riscriveva a parole lo stesso verdetto in 15 varianti).
 * Ogni apparecchiatura diventa una riga con i valori che le relazioni storiche
 * esplicitavano nel testo: volume, PS, PS×V, categoria, adempimento, riferimento
 * normativo, stato INAIL, verifica di integrità.
 *
 * Le decisioni giuridiche vengono da `utils/dm329Classification`: qui si formatta soltanto.
 */
import type {
  SchedaDatiCompleta,
  Serbatoio,
  ValvolaSicurezza,
  CategoriaPED,
} from '@/types/technicalSheet'
import type { AdditionalInfo, EngineOptions, EsitoRow } from '../types'
import type { EsitoDM329 } from '@/utils/dm329Classification'
import { classificaRecipiente, comportaAdempimento } from '@/utils/dm329Classification'
import { calculateCategoriaPED } from '@/utils/categoriaPedCalculator'
import {
  codiciValvoleDisoleatore,
  codiciValvoleSerbatoio,
  descrizioneSerbatoio,
  formatNumberIT,
} from '../helpers'

// ---------------------------------------------------------------------------
// Etichette degli esiti — l'unico punto in cui il verdetto diventa testo
// ---------------------------------------------------------------------------

const ETICHETTE: Record<EsitoDM329, { adempimento: string; riferimento: string }> = {
  ESCLUSO_VOLUME: {
    adempimento: 'Escluso',
    riferimento: 'art. 2 comma i D.M. 329/2004',
  },
  ESCLUSO_NO_RECIPIENTE: {
    adempimento: 'Escluso',
    riferimento: 'art. 2 comma i D.M. 329/2004',
  },
  SOTTO_SOGLIA: {
    adempimento: 'Nessun adempimento',
    riferimento: 'artt. 4 e 5 D.M. 329/2004',
  },
  DICHIARAZIONE: {
    adempimento: 'Dichiarazione di messa in servizio',
    riferimento: 'art. 5 comma 1 lettera c D.M. 329/2004',
  },
  VERIFICA: {
    adempimento: 'Verifica e dichiarazione di messa in servizio',
    riferimento: 'artt. 4 e 5 D.M. 329/2004',
  },
  ESCLUSO_COMPRESSORE: {
    adempimento: 'Escluso',
    riferimento: 'art. 1 comma 3 lettera L D.lgs. 93/2000',
  },
  ESCLUSO_TUBAZIONE: {
    adempimento: 'Escluso',
    riferimento: 'art. 3 comma bb D.M. 329/2004',
  },
}

const DATI_INSUFFICIENTI = { adempimento: 'Dati insufficienti', riferimento: '' }

function etichette(esito: EsitoDM329 | null) {
  return esito ? ETICHETTE[esito] : DATI_INSUFFICIENTI
}

// ---------------------------------------------------------------------------
// Formattazioni
// ---------------------------------------------------------------------------

/**
 * Stato INAIL: già immatricolato (con matricola se nota) oppure nuova richiesta,
 * quest'ultima solo quando l'esito comporta effettivamente un adempimento.
 */
function statoInail(
  esito: EsitoDM329 | null,
  giaDenunciato: boolean | undefined,
  matricola: string | undefined
): string {
  if (giaDenunciato) {
    const m = matricola?.trim()
    return m ? `Già immatricolato n.m. ${m}` : 'Già immatricolato'
  }
  return comportaAdempimento(esito) ? 'Nuova richiesta' : ''
}

/** Categoria dichiarata se presente, altrimenti calcolata da PS × V. */
function categoria(
  dichiarata: CategoriaPED | undefined,
  ps: number | undefined,
  volume: number | undefined
): string {
  return dichiarata ?? calculateCategoriaPED(ps, volume) ?? ''
}

// ---------------------------------------------------------------------------
// Costruzione delle righe
// ---------------------------------------------------------------------------

export function buildEsiti(
  scheda: SchedaDatiCompleta,
  additionalInfo: AdditionalInfo,
  options: EngineOptions = {}
): EsitoRow[] {
  const resolve = options.resolveCostruttore ?? ((m?: string) => m ?? '')
  const spessimetrica = new Set(additionalInfo.spessimetrica ?? [])
  const gruppi: EsitoRow[][] = []

  /**
   * Stato INAIL e verifica di integrità sono proprietà del gruppo, non della singola
   * riga: a INAIL si immatricola il recipiente, e il capogruppo con le sue valvole fanno
   * parte della stessa pratica. I valori si consolidano sulla prima riga — una cella
   * vuota accanto a un capogruppo si leggerebbe come "nessun adempimento" — e in fase di
   * render le celle vengono fuse verticalmente sull'intero gruppo.
   */
  const finalizzaGruppo = (righe: EsitoRow[]): EsitoRow[] => {
    if (righe.length === 0) return righe
    const chiave = righe[0].pos
    const stato = righe.map((r) => r.statoInail).find(Boolean) ?? ''
    const verifica = righe.some((r) => r.verificaIntegrita)
    return righe.map((r, i) => ({
      ...r,
      gruppo: chiave,
      statoInail: i === 0 ? stato : '',
      verificaIntegrita: i === 0 ? verifica : false,
    }))
  }

  /** Riga di un recipiente in pressione: classifica e formatta i numeri. */
  const rigaRecipiente = (args: {
    pos: string
    apparecchiatura: string
    marca?: string
    modello?: string
    volume?: number
    ps?: number
    categoriaPed?: CategoriaPED
    giaDenunciato?: boolean
    matricolaInail?: string
  }): { row: EsitoRow; esito: EsitoDM329 | null } => {
    const esito = classificaRecipiente(args.volume, args.ps)
    const { adempimento, riferimento } = etichette(esito)
    // Sotto i 25 litri volume e pressione non concorrono ad alcuna valutazione:
    // riportarli inviterebbe il lettore a rifare un conto che non va fatto.
    const mostraNumeri = esito !== 'ESCLUSO_VOLUME'
    const psPerV =
      mostraNumeri && args.volume && args.ps ? formatNumberIT(args.ps * args.volume) : ''

    return {
      esito,
      row: {
        pos: args.pos,
        gruppo: '',
        apparecchiatura: args.apparecchiatura,
        costruttore: resolve(args.marca),
        modello: args.modello ?? '',
        esito,
        recipiente: true,
        volume: mostraNumeri ? formatNumberIT(args.volume) : '',
        ps: mostraNumeri ? formatNumberIT(args.ps) : '',
        psPerV,
        categoria: categoria(args.categoriaPed, args.ps, args.volume),
        adempimento,
        riferimento,
        statoInail: statoInail(esito, args.giaDenunciato, args.matricolaInail),
        verificaIntegrita: spessimetrica.has(args.pos),
      },
    }
  }

  /**
   * Riga di una valvola di sicurezza. La valvola non è un recipiente: eredita
   * l'adempimento del recipiente che protegge, come nelle relazioni storiche.
   */
  const rigaValvola = (pos: string, v: ValvolaSicurezza, esito: EsitoDM329 | null): EsitoRow => {
    const { adempimento, riferimento } = etichette(esito)
    return {
      pos,
      gruppo: '',
      apparecchiatura: 'Valvola di sicurezza',
      costruttore: resolve(v.marca),
      modello: v.modello ?? '',
      // La valvola è un accessorio di sicurezza, non un recipiente: non concorre
      // alla riqualificazione periodica, quindi nessun esito proprio.
      esito: null,
      recipiente: false,
      volume: '',
      ps: '',
      psPerV: '',
      categoria: v.categoria_ped ?? 'IV',
      adempimento,
      riferimento,
      statoInail: '',
      verificaIntegrita: false,
    }
  }

  /** Riga di un'apparecchiatura che non è un recipiente (compressore, essiccatore, filtro). */
  const rigaNonRecipiente = (args: {
    pos: string
    apparecchiatura: string
    marca?: string
    modello?: string
    esito: EsitoDM329 | null
  }): EsitoRow => {
    const { adempimento, riferimento } = etichette(args.esito)
    return {
      pos: args.pos,
      gruppo: '',
      apparecchiatura: args.apparecchiatura,
      costruttore: resolve(args.marca),
      modello: args.modello ?? '',
      // Non è un recipiente: l'eventuale adempimento è quello del recipiente che
      // contiene, e va imputato a quello ai fini della riqualificazione periodica.
      esito: null,
      recipiente: false,
      volume: '',
      ps: '',
      psPerV: '',
      categoria: '',
      adempimento,
      riferimento,
      statoInail: '',
      verificaIntegrita: spessimetrica.has(args.pos),
    }
  }

  const valvoleDi = (principale: ValvolaSicurezza, aggiuntive?: ValvolaSicurezza[]) => [
    principale,
    ...(aggiuntive ?? []),
  ]

  // --- Compressori (+ disoleatore + valvole) --------------------------------
  for (const c of scheda.compressori ?? []) {
    const diso = (scheda.disoleatori ?? []).find((d) => d.compressore_associato === c.codice)
    const g: EsitoRow[] = []

    // Il compressore è sempre escluso; cambia il motivo. Senza disoleatore è privo di
    // recipienti in pressione (art. 2 comma i), con disoleatore vale l'esclusione
    // specifica dei compressori (art. 1 comma 3 lettera L).
    g.push(
      rigaNonRecipiente({
        pos: c.codice,
        apparecchiatura: 'Compressore',
        marca: c.marca,
        modello: c.modello,
        esito: diso ? 'ESCLUSO_COMPRESSORE' : 'ESCLUSO_NO_RECIPIENTE',
      })
    )

    if (diso) {
      const { row, esito } = rigaRecipiente({
        pos: diso.codice,
        apparecchiatura: 'Serbatoio disoleatore',
        marca: diso.marca,
        modello: diso.modello,
        volume: diso.volume,
        ps: diso.ps_pressione_max,
        categoriaPed: diso.categoria_ped,
        giaDenunciato: diso.gia_denunciato,
        matricolaInail: diso.matricola_inail,
      })
      g.push(row)

      const valvole = valvoleDi(diso.valvola_sicurezza, diso.valvole_aggiuntive)
      codiciValvoleDisoleatore(diso.codice, valvole.length).forEach((pos, i) => {
        g.push(rigaValvola(pos, valvole[i], esito))
      })
    }
    gruppi.push(finalizzaGruppo(g))
  }

  // --- Serbatoi (+ valvole) -------------------------------------------------
  for (const s of scheda.serbatoi ?? []) {
    const { row, esito } = rigaRecipiente({
      pos: s.codice,
      apparecchiatura: descrizioneSerbatoio(s),
      marca: s.marca,
      modello: s.modello,
      volume: s.volume,
      ps: s.ps_pressione_max,
      categoriaPed: s.categoria_ped,
      giaDenunciato: s.gia_denunciato,
      matricolaInail: s.matricola_inail,
    })
    const g: EsitoRow[] = [row]

    const valvole = valvoleDi(s.valvola_sicurezza, s.valvole_aggiuntive)
    codiciValvoleSerbatoio(s.codice, valvole.length).forEach((pos, i) => {
      g.push(rigaValvola(pos, valvole[i], esito))
    })
    gruppi.push(finalizzaGruppo(g))
  }

  // --- Essiccatori (+ scambiatore) ------------------------------------------
  for (const e of scheda.essiccatori ?? []) {
    const scamb = (scheda.scambiatori ?? []).find((sc) => sc.essiccatore_associato === e.codice)

    if (!scamb) {
      gruppi.push(
        finalizzaGruppo([
          rigaNonRecipiente({
            pos: e.codice,
            apparecchiatura: 'Essiccatore frigorifero',
            marca: e.marca,
            modello: e.modello,
            esito: 'ESCLUSO_NO_RECIPIENTE',
          }),
        ])
      )
      continue
    }

    const { row, esito } = rigaRecipiente({
      pos: scamb.codice,
      apparecchiatura: 'Scambiatore di calore',
      marca: scamb.marca,
      modello: scamb.modello,
      volume: scamb.volume,
      ps: scamb.ps_pressione_max,
      categoriaPed: scamb.categoria_ped,
      giaDenunciato: scamb.gia_denunciato,
      matricolaInail: scamb.matricola_inail,
    })
    // L'essiccatore non è un recipiente: eredita l'esito dello scambiatore che contiene.
    gruppi.push(
      finalizzaGruppo([
        rigaNonRecipiente({
          pos: e.codice,
          apparecchiatura: 'Essiccatore frigorifero',
          marca: e.marca,
          modello: e.modello,
          esito,
        }),
        row,
      ])
    )
  }

  // --- Filtri (+ recipiente) ------------------------------------------------
  for (const f of scheda.filtri ?? []) {
    const rec = (scheda.recipienti_filtro ?? []).find((r) => r.filtro_associato === f.codice)

    if (!rec) {
      gruppi.push(
        finalizzaGruppo([
          rigaNonRecipiente({
            pos: f.codice,
            apparecchiatura: 'Filtro',
            marca: f.marca,
            modello: f.modello,
            esito: 'ESCLUSO_NO_RECIPIENTE',
          }),
        ])
      )
      continue
    }

    const { row, esito } = rigaRecipiente({
      pos: rec.codice,
      apparecchiatura: 'Recipiente filtro',
      marca: rec.marca,
      modello: rec.modello,
      volume: rec.volume,
      ps: rec.ps_pressione_max,
      categoriaPed: rec.categoria_ped,
      giaDenunciato: rec.gia_denunciato,
      matricolaInail: rec.matricola_inail,
    })
    gruppi.push(
      finalizzaGruppo([
        rigaNonRecipiente({
          pos: f.codice,
          apparecchiatura: 'Filtro',
          marca: f.marca,
          modello: f.modello,
          esito,
        }),
        row,
      ])
    )
  }

  // --- Separatori -----------------------------------------------------------
  // Non sono attrezzature a pressione: nessun esito da dichiarare.
  for (const sep of scheda.separatori ?? []) {
    gruppi.push(
      finalizzaGruppo([
        {
          pos: sep.codice,
          gruppo: '',
          apparecchiatura: 'Separatore acqua-olio',
          costruttore: resolve(sep.marca),
          modello: sep.modello ?? '',
          esito: null,
          recipiente: false,
          volume: '',
          ps: '',
          psPerV: '',
          categoria: '',
          adempimento: 'Non applicabile',
          riferimento: '',
          statoInail: '',
          verificaIntegrita: false,
        },
      ])
    )
  }

  return gruppi.flat()
}

/**
 * Dimensione di ciascun gruppo, nell'ordine in cui le righe compaiono in tabella.
 * È l'informazione che serve alla fusione verticale delle celle in fase di render.
 */
export function dimensioniGruppi(esiti: EsitoRow[]): number[] {
  const out: number[] = []
  let precedente: string | null = null
  for (const r of esiti) {
    if (r.gruppo !== precedente) {
      out.push(1)
      precedente = r.gruppo
    } else {
      out[out.length - 1] += 1
    }
  }
  return out
}
