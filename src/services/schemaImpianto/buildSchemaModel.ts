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
  SchemaSegnoTubo,
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
    // Sta sempre a valle del serbatoio nella catena di trattamento (ordinaCatenaTrattamento,
    // sotto), ma quello è l'ordine delle tubazioni, non la stanza in cui sta fisicamente: solo
    // il serbatoio può essere ubicato fuori sala compressori (campo `ubicazione` in scheda).
    // L'essiccatore ci resta sempre, altrimenti il muro separerebbe sala compressori e linea di
    // distribuzione anche quando non c'è nessuna apparecchiatura vera fuori dalla sala.
    gruppo: 'SALA_COMPRESSORI',
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
    // Stessa ragione dell'essiccatore (vedi lì): solo il serbatoio può stare fuori sala.
    gruppo: 'SALA_COMPRESSORI',
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
    // Stessa ragione dell'essiccatore (vedi lì): solo il serbatoio può stare fuori sala. Vale
    // anche quando questo stesso nodo fa da pozzo di raccolta condense (raccolta_condense:
    // 'separatore' più sotto lo riusa per id: è la stessa apparecchiatura, non due) — a
    // differenza della tanica generica, che non è un'apparecchiatura vera e resta in linea.
    gruppo: 'SALA_COMPRESSORI',
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
          // A differenza di `buildSeparatoreNodo`: qui non c'è un'apparecchiatura vera in
          // scheda, solo il pozzo generico che la dichiarazione di raccolta condense impone —
          // stessa natura di `tanica`/'altro' qui sotto, non del separatore come stadio di
          // trattamento.
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
 *
 * Esportata dal 18-08-2026: e' la regola di DEFAULT che il pannello delle preferenze mostra
 * spuntata finche' l'operatore non sceglie (`risolviPreferenze`). Nel Blocco 1 il pannello ne
 * usava una propria — `() => true` — e la spunta mostrata in finestra mentiva sul disegno che
 * sarebbe uscito: un compressore a pistoni compariva spuntato e non scaricava. Una domanda, una
 * risposta sola.
 */
export function scaricaCondensa(nodo: SchemaNodo): boolean {
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

/**
 * Terminale della linea aria. Sempre presente quando c'è una linea da terminare: prima del
 * 12-08-2026 lo disegnava `renderUscitaUtenze` scegliendo da sé il nodo più a destra, una
 * regola che qui non si può nemmeno valutare — il modello si costruisce prima che le posizioni
 * esistano. La regola diventa topologica: l'ultimo stadio di trattamento, o il serbatoio da cui
 * la linea parte quando di stadi non ce ne sono.
 */
export const ID_UTENZE = 'UTENZE'

function nodoUtenze(): SchemaNodo {
  return {
    id: ID_UTENZE,
    tipo: 'utenze',
    // Due righe dal 17-08-2026: il committente vuole «aria» a capo sotto «Utenze». L'a capo sta
    // nell'etichetta e non in una regola che spezza da sé sull'ultima parola — così resta
    // modificabile dal dialogo, e nessun'altra etichetta se lo ritrova imposto.
    etichetta: 'Utenze\naria',
    gruppo: 'LINEA_DISTRIBUZIONE',
    valvoleSicurezza: [],
    // Origine 'scheda' e non 'manuale': fa parte della proposta automatica, quindi la
    // riconciliazione lo rimette se manca. Cancellarlo nell'editor lo fa tornare alla
    // riapertura, ed è la conseguenza accettata dal committente.
    origine: 'scheda',
  }
}

function buildArchi(nodi: SchemaNodo[], input: BuildSchemaModelInput, raccoltaCondense: SchemaNodo | null): SchemaArco[] {
  const archi: SchemaArco[] = []
  let contatore = 0
  const prossimoId = (prefisso: string) => `${prefisso}-${++contatore}`
  // Ogni arco flessibile o di linea nasce con una valvola di intercettazione a metà tratto:
  // prima del 12-08-2026 la valvola la disegnava `renderSvg` d'ufficio a un punto fisso, ora è
  // un segno vero seminato qui, spostabile nell'editor e letto dalla legenda (Task 3/4).
  const segnoValvolaDiDefault = (): SchemaSegnoTubo[] => [
    { id: prossimoId('segno'), tipo: 'valvola_intercettazione', t: 0.5 },
  ]

  for (const [compressoreId, serbatoiIds] of Object.entries(input.collegamentiCompressoriSerbatoi)) {
    for (const serbatoioId of serbatoiIds) {
      archi.push({
        id: prossimoId('flex'),
        da: { nodo: compressoreId, ancora: 'alto-out' },
        a: { nodo: serbatoioId, ancora: 'sx' },
        stile: 'flessibile',
        segni: segnoValvolaDiDefault(),
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
      segni: segnoValvolaDiDefault(),
    })
    for (let i = 0; i < catenaLinea.length - 1; i++) {
      archi.push({
        id: prossimoId('std'),
        da: { nodo: catenaLinea[i].id, ancora: 'dx' },
        a: { nodo: catenaLinea[i + 1].id, ancora: 'sx' },
        stile: 'standard',
        segni: segnoValvolaDiDefault(),
      })
    }
  }

  // Tubazione finale verso le utenze. Il nodo esiste solo se ha da chi partire, quindi qui si
  // decide anche se `buildSchemaModel` deve aggiungerlo (vedi `sorgente`, sotto).
  const sorgente = catenaLinea.length > 0 ? catenaLinea[catenaLinea.length - 1].id : serbatoiChiave[0]
  if (sorgente) {
    archi.push({
      id: prossimoId('ut'),
      da: { nodo: sorgente, ancora: 'dx' },
      a: { nodo: ID_UTENZE, ancora: 'in' },
      stile: 'standard',
    })
  }

  if (raccoltaCondense) {
    // La tanica riceve dall'alto; il separatore, quando fa da pozzo, riceve di fianco — la
    // corsia condense negli schemi storici entra nel suo vertice sinistro, non dal cielo
    // (555_RELAZIONE_TECNICA_00-2025.pdf pag. 3).
    const ancoraArrivo = raccoltaCondense.tipo === 'separatore' ? 'sx' : 'alto-in'
    for (const nodo of nodi) {
      if (nodo.id === raccoltaCondense.id) continue
      if (scaricaCondensa(nodo)) {
        archi.push({
          id: prossimoId('cond'),
          da: { nodo: nodo.id, ancora: 'basso-out' },
          a: { nodo: raccoltaCondense.id, ancora: ancoraArrivo },
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

  // Il terminale entra nei nodi solo se `buildArchi` ha davvero una sorgente da cui farlo
  // partire: un arco verso un nodo assente, o un nodo senza tubazione, sarebbero entrambi
  // incoerenti. Si decide guardando gli archi appena costruiti, unica fonte.
  const archi = buildArchi(nodi, input, raccoltaCondense)
  if (archi.some((a) => a.a.nodo === ID_UTENZE)) nodi.push(nodoUtenze())

  return { nodi, archi }
}

/** Estremi dei valori dichiarati in una coppia di DN, o `null` se non ne è dichiarato nessuno. */
function estremiDn(valori: (number | undefined)[]): { min: number; max: number } | null {
  const noti = valori.filter((v): v is number => typeof v === 'number' && v > 0)
  if (noti.length === 0) return null
  return { min: Math.min(...noti), max: Math.max(...noti) }
}

/** «Ø15 a Ø25mm», oppure «Ø15mm» quando gli estremi coincidono o ne è noto uno solo. */
function misuraDn({ min, max }: { min: number; max: number }): string {
  return min === max ? `Ø${min}mm` : `Ø${min} a Ø${max}mm`
}

/**
 * Nota sui diametri stampata sotto lo schema, come nelle relazioni storiche. Vuota se la scheda
 * non dichiara diametri: il riquadro sparisce invece di annunciare una misura che nessuno ha
 * rilevato. Legge i DN in mm e non i vecchi campi a testo libero.
 *
 * Le due coppie si leggono separate: fino al 17-08-2026 i quattro valori finivano in un unico
 * min/max, e i diametri delle linee di distribuzione si mescolavano a quelli dei collegamenti in
 * sala senza mai essere nominati. Dentro ciascuna coppia gli estremi si ricavano comunque dai
 * valori presenti, perché in scheda capita di trovarli scambiati.
 *
 * Senza collegamenti in sala non si stampa nulla, nemmeno se le linee di distribuzione sono
 * dichiarate: scelta del committente, il riquadro parla dei collegamenti.
 */
export function notaTubazioni(scheda: SchedaDatiCompleta): string[] {
  const d = scheda.dati_impianto
  const sala = estremiDn([d?.dn_sala_min, d?.dn_sala_max])
  if (!sala) return []

  const righe = [`Collegamenti effettuati con tubazioni da ${misuraDn(sala)}`]
  const distribuzione = estremiDn([d?.dn_distribuzione_min, d?.dn_distribuzione_max])
  if (distribuzione) righe.push(`Linee effettuate con tubazioni da ${misuraDn(distribuzione)}`)
  return righe
}

/** Il motore può generare solo se c'è almeno un collegamento compressore→serbatoio dichiarato. */
export function puoGenerareSchema(input: BuildSchemaModelInput): boolean {
  const haCompressoreESerbatoio = (input.scheda.compressori?.length ?? 0) > 0 && (input.scheda.serbatoi?.length ?? 0) > 0
  const haCollegamenti = Object.values(input.collegamentiCompressoriSerbatoi).some((s) => s.length > 0)
  return haCompressoreESerbatoio && haCollegamenti
}
