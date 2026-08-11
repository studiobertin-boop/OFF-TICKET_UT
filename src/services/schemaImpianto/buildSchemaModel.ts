/**
 * Costruzione del modello logico dello schema (nodi + archi) a partire dai dati già
 * presenti in scheda — nessuna posizione qui, solo la struttura. Vedi `types.ts` per le
 * convenzioni desunte dai blocchi AutoCAD reali su cosa diventa un nodo autonomo e cosa un
 * accessorio disegnato sul nodo genitore.
 *
 * Riusa `elencaValvole`/`codiciValvole*` da `utils/valvoleImpianto.ts`: stessa numerazione
 * (S1.1, C1.2, …) già usata dal motore della relazione, non reinventata qui.
 */
import type {
  Compressore,
  Essiccatore,
  Filtro,
  SchedaDatiCompleta,
  Separatore,
} from '@/types/technicalSheet'
import { elencaValvole } from '@/utils/valvoleImpianto'
import type {
  SchemaAccessorioDipendente,
  SchemaArco,
  SchemaGruppo,
  SchemaModel,
  SchemaNodo,
  SchemaValvolaSicurezza,
} from './types'

export interface BuildSchemaModelInput {
  scheda: SchedaDatiCompleta
  /** `AdditionalInfo.collegamentiCompressoriSerbatoi` — { C1: ['S1','S2'] }. */
  collegamentiCompressoriSerbatoi: Record<string, string[]>
}

/** Etichetta di tabella nello stesso formato delle relazioni storiche: "Compressore KAESER Mod. CSD 90 SFC". */
function etichetta(descrizione: string, marca?: string, modello?: string): string {
  return [descrizione, marca?.trim(), modello?.trim() ? `Mod. ${modello.trim()}` : undefined]
    .filter((parte): parte is string => Boolean(parte))
    .join(' ')
}

function valvoleDiRecipiente(
  valvoleImpianto: ReturnType<typeof elencaValvole>,
  recipiente: string
): SchemaValvolaSicurezza[] {
  return valvoleImpianto
    .filter((v) => v.recipiente === recipiente)
    .map((v) => ({ codice: v.pos, etichetta: etichetta('Valvola di sicurezza', v.valvola.marca, v.valvola.modello) }))
}

function buildAccessorioDisoleatore(
  scheda: SchedaDatiCompleta,
  compressoreCodice: string,
  valvoleImpianto: ReturnType<typeof elencaValvole>
): SchemaAccessorioDipendente | undefined {
  const diso = (scheda.disoleatori ?? []).find((d) => d.compressore_associato === compressoreCodice)
  if (!diso) return undefined
  return {
    codice: diso.codice,
    etichetta: etichetta('Serbatoio disoleatore', diso.marca, diso.modello),
    valvoleSicurezza: valvoleDiRecipiente(valvoleImpianto, diso.codice),
  }
}

function buildCompressoreNodo(
  c: Compressore,
  scheda: SchedaDatiCompleta,
  valvoleImpianto: ReturnType<typeof elencaValvole>
): SchemaNodo {
  return {
    id: c.codice,
    tipo: 'compressore',
    etichetta: etichetta('Compressore', c.marca, c.modello),
    // I compressori non hanno un campo ubicazione proprio in scheda: stanno sempre fisicamente
    // in sala compressori, a differenza dei serbatoi che possono essere spostati in linea.
    gruppo: 'SALA_COMPRESSORI',
    valvoleSicurezza: [],
    accessorio: buildAccessorioDisoleatore(scheda, c.codice, valvoleImpianto),
    origine: 'scheda',
  }
}

function buildSerbatoioNodi(
  scheda: SchedaDatiCompleta,
  valvoleImpianto: ReturnType<typeof elencaValvole>
): SchemaNodo[] {
  return (scheda.serbatoi ?? []).map((s) => ({
    id: s.codice,
    tipo: 'serbatoio',
    etichetta: etichetta('Serbatoio', s.marca, s.modello),
    orientamento: s.orientamento ?? 'VERTICALE',
    gruppo: (s.ubicazione ?? 'SALA_COMPRESSORI') as SchemaGruppo,
    valvoleSicurezza: valvoleDiRecipiente(valvoleImpianto, s.codice),
    origine: 'scheda',
  }))
}

function buildEssiccatoreNodo(e: Essiccatore, scheda: SchedaDatiCompleta): SchemaNodo {
  const scamb = (scheda.scambiatori ?? []).find((sc) => sc.essiccatore_associato === e.codice)
  return {
    id: e.codice,
    tipo: 'essiccatore',
    etichetta: etichetta('Essiccatore frigorifero', e.marca, e.modello),
    // Trattamento aria: nei riferimenti reali sta sempre a valle del serbatoio, verso le utenze.
    gruppo: 'LINEA_DISTRIBUZIONE',
    valvoleSicurezza: [],
    accessorio: scamb
      ? {
          codice: scamb.codice,
          etichetta: etichetta('Scambiatore di calore', scamb.marca, scamb.modello),
          // Lo scambiatore non ha una valvola propria (protetto da valvole altrove, non
          // deducibili automaticamente — vedi commento su `valvole_protezione` nel tipo).
          valvoleSicurezza: [],
        }
      : undefined,
    origine: 'scheda',
  }
}

function buildFiltroNodo(f: Filtro, scheda: SchedaDatiCompleta): SchemaNodo {
  const rec = (scheda.recipienti_filtro ?? []).find((r) => r.filtro_associato === f.codice)
  return {
    id: f.codice,
    tipo: 'filtro',
    etichetta: etichetta('Filtro', f.marca, f.modello),
    prefiltro: f.tipo === 'PREFILTRO',
    gruppo: 'LINEA_DISTRIBUZIONE',
    valvoleSicurezza: [],
    accessorio: rec
      ? {
          codice: rec.codice,
          etichetta: etichetta('Recipiente filtro', rec.marca, rec.modello),
          valvoleSicurezza: [],
        }
      : undefined,
    origine: 'scheda',
  }
}

function buildSeparatoreNodo(sep: Separatore): SchemaNodo {
  return {
    id: sep.codice,
    tipo: 'separatore',
    etichetta: etichetta('Separatore', sep.marca, sep.modello),
    gruppo: 'LINEA_DISTRIBUZIONE',
    valvoleSicurezza: [],
    origine: 'scheda',
  }
}

/**
 * Nodo pozzo di raccolta condense, unico per l'intero impianto (`dati_impianto.raccolta_condense`
 * non è per-serbatoio). `null` se non c'è raccolta (niente rete di linee condense da disegnare).
 */
function buildNodoRaccoltaCondense(scheda: SchedaDatiCompleta): SchemaNodo | null {
  // In produzione il campo arriva sia come stringa sia come array di una voce (il select è
  // nato multiplo): senza normalizzare, l'array non matcha nessun caso e si finisce sul
  // pozzo generico anche quando la scheda dichiara un separatore.
  const grezzo = scheda.dati_impianto?.raccolta_condense
  const modo = (Array.isArray(grezzo) ? grezzo[0] : grezzo)?.toLowerCase()
  if (!modo || modo === 'nessuna') return null

  if (modo === 'separatore') {
    const primo = (scheda.separatori ?? [])[0]
    return primo
      ? buildSeparatoreNodo(primo)
      : {
          id: 'SEP',
          tipo: 'separatore',
          etichetta: 'Separatore',
          gruppo: 'LINEA_DISTRIBUZIONE',
          valvoleSicurezza: [],
          origine: 'scheda',
        }
  }

  if (modo === 'tanica') {
    return {
      id: 'T',
      tipo: 'tanica',
      etichetta: 'Tanica raccolta condense',
      gruppo: 'LINEA_DISTRIBUZIONE',
      valvoleSicurezza: [],
      origine: 'scheda',
    }
  }

  // 'altro': nessun simbolo dedicato nei blocchi di riferimento — riusa la tanica generica.
  return {
    id: 'RC',
    tipo: 'tanica',
    etichetta: 'Raccolta condense',
    gruppo: 'LINEA_DISTRIBUZIONE',
    valvoleSicurezza: [],
    origine: 'scheda',
  }
}

/**
 * Nodi che scaricano condensa nel pozzo di raccolta. Sul compressore la condensa esce dal
 * disoleatore, quindi un compressore che non ne ha (tipicamente a pistoni) resta escluso.
 */
function scaricaCondensa(nodo: SchemaNodo): boolean {
  if (nodo.tipo === 'compressore') return Boolean(nodo.accessorio)
  return nodo.tipo === 'serbatoio' || nodo.tipo === 'essiccatore' || nodo.tipo === 'filtro'
}

/**
 * Ordine della catena di trattamento a valle del serbatoio, come negli schemi reali:
 * prefiltri → essiccatori → filtri di linea. Il pozzo di raccolta condense ne resta fuori
 * anche quando è un separatore: raccoglie condensa, non tratta l'aria di linea (vedi SEP
 * in 555_RELAZIONE_TECNICA).
 *
 * Esportata perché il layout deve disporre i nodi nello stesso ordine in cui il grafo li
 * collega: due ordinamenti diversi produrrebbero un disegno con le linee incrociate.
 */
export function ordinaCatenaTrattamento(
  nodi: SchemaNodo[],
  raccoltaCondense: SchemaNodo | null
): SchemaNodo[] {
  const rango = (nodo: SchemaNodo): number => {
    if (nodo.tipo === 'filtro') return nodo.prefiltro ? 0 : 200
    if (nodo.tipo === 'essiccatore') return 100
    return 300
  }
  // Solo gli stadi di trattamento: un serbatoio ubicato in linea resta un serbatoio e ha già
  // la sua riga nel layout — includerlo qui lo disegnerebbe due volte.
  const stadi: SchemaNodo['tipo'][] = ['essiccatore', 'filtro', 'separatore']
  return nodi
    .filter((n) => stadi.includes(n.tipo) && n.id !== raccoltaCondense?.id)
    .map((nodo, indice) => ({ nodo, chiave: rango(nodo) + indice }))
    .sort((a, b) => a.chiave - b.chiave)
    .map((v) => v.nodo)
}

function buildArchi(nodi: SchemaNodo[], input: BuildSchemaModelInput, raccoltaCondense: SchemaNodo | null): SchemaArco[] {
  const archi: SchemaArco[] = []
  let contatore = 0
  const prossimoId = (prefisso: string) => `${prefisso}-${++contatore}`

  for (const [compressoreId, serbatoiIds] of Object.entries(input.collegamentiCompressoriSerbatoi)) {
    for (const serbatoioId of serbatoiIds) {
      archi.push({
        id: prossimoId('flex'),
        da: { nodo: compressoreId, ancora: 'alto-out' },
        a: { nodo: serbatoioId, ancora: 'sx' },
        stile: 'flessibile',
      })
    }
  }

  const catenaLinea = ordinaCatenaTrattamento(nodi, raccoltaCondense)
  const serbatoiChiave = nodi.filter((n) => n.tipo === 'serbatoio').map((n) => n.id)
  if (catenaLinea.length > 0 && serbatoiChiave.length > 0) {
    archi.push({
      id: prossimoId('std'),
      da: { nodo: serbatoiChiave[0], ancora: 'dx' },
      a: { nodo: catenaLinea[0].id, ancora: 'sx' },
      stile: 'standard',
    })
    for (let i = 0; i < catenaLinea.length - 1; i++) {
      archi.push({
        id: prossimoId('std'),
        da: { nodo: catenaLinea[i].id, ancora: 'dx' },
        a: { nodo: catenaLinea[i + 1].id, ancora: 'sx' },
        stile: 'standard',
      })
    }
  }

  if (raccoltaCondense) {
    for (const nodo of nodi) {
      if (nodo.id === raccoltaCondense.id) continue
      if (scaricaCondensa(nodo)) {
        archi.push({
          id: prossimoId('cond'),
          da: { nodo: nodo.id, ancora: 'basso-out' },
          a: { nodo: raccoltaCondense.id, ancora: 'alto-in' },
          stile: 'condensa',
        })
      }
    }
  }

  return archi
}

export function buildSchemaModel(input: BuildSchemaModelInput): SchemaModel {
  const { scheda } = input
  const valvoleImpianto = elencaValvole(scheda)

  const nodi: SchemaNodo[] = [
    ...(scheda.compressori ?? []).map((c) => buildCompressoreNodo(c, scheda, valvoleImpianto)),
    ...buildSerbatoioNodi(scheda, valvoleImpianto),
    ...(scheda.essiccatori ?? []).map((e) => buildEssiccatoreNodo(e, scheda)),
    ...(scheda.filtri ?? []).map((f) => buildFiltroNodo(f, scheda)),
    ...(scheda.separatori ?? []).map(buildSeparatoreNodo),
  ]

  const raccoltaCondense = buildNodoRaccoltaCondense(scheda)
  if (raccoltaCondense && !nodi.some((n) => n.id === raccoltaCondense.id)) {
    nodi.push(raccoltaCondense)
  }

  return { nodi, archi: buildArchi(nodi, input, raccoltaCondense) }
}

/**
 * Nota sui diametri stampata sotto lo schema, come nelle relazioni storiche
 * ("Collegamenti effettuati con tubazioni da Ø…"). Vuota se la scheda non dichiara diametri:
 * il riquadro sparisce invece di annunciare una misura che nessuno ha rilevato.
 *
 * Legge i DN in mm e non i vecchi campi a testo libero, e ricava gli estremi da tutti e
 * quattro i valori: in scheda capita che min e max siano invertiti.
 */
export function notaTubazioni(scheda: SchedaDatiCompleta): string[] {
  const d = scheda.dati_impianto
  const valori = [d?.dn_sala_min, d?.dn_sala_max, d?.dn_distribuzione_min, d?.dn_distribuzione_max]
    .filter((v): v is number => typeof v === 'number' && v > 0)
  if (valori.length === 0) return []

  const min = Math.min(...valori)
  const max = Math.max(...valori)
  return [
    min === max
      ? `Collegamenti effettuati con tubazioni da Ø${min}mm`
      : `Collegamenti effettuati con tubazioni da Ø${min} a Ø${max}mm`,
  ]
}

/** Il motore può generare solo se c'è almeno un collegamento compressore→serbatoio dichiarato. */
export function puoGenerareSchema(input: BuildSchemaModelInput): boolean {
  const haCompressoreESerbatoio = (input.scheda.compressori?.length ?? 0) > 0 && (input.scheda.serbatoi?.length ?? 0) > 0
  const haCollegamenti = Object.values(input.collegamentiCompressoriSerbatoi).some((s) => s.length > 0)
  return haCompressoreESerbatoio && haCollegamenti
}
