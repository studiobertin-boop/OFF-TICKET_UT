/**
 * Modello strutturato dello schema d'impianto: nodi + collegamenti, senza posizioni.
 *
 * Le convenzioni (quali apparecchiature diventano nodi, quali diventano accessori
 * disegnati sul nodo genitore, quando compare la linea condense) sono desunte dai blocchi
 * AutoCAD reali (`DOCUMENTAZIONE/relazione/Blocchi.pdf`) e da relazioni storiche
 * (`DOCUMENTAZIONE/relazione/*_RELAZIONE_TECNICA_*.pdf`), non inventate:
 *
 * - Disoleatore, scambiatore e recipiente filtro non sono nodi a sé: sono disegnati come
 *   parte del simbolo del nodo genitore (compressore/essiccatore/filtro), con la propria
 *   etichetta e le proprie valvole di sicurezza — un solo "accessorio dipendente" per nodo,
 *   perché la scheda dati non ne prevede più di uno per apparecchiatura.
 * - La valvola di scarico è una decorazione fissa del simbolo, non un dato: non ha un codice
 *   proprio e non entra nel modello. La disegnano **serbatoio, essiccatore e filtro**; il
 *   separatore no (`simboloSeparatore` passa `conScarico: false` — scarica da un codolo nudo,
 *   così nel blocco di riferimento) e il compressore nemmeno. `righeLegenda` si regola su
 *   questo elenco: sbagliarlo mette in legenda un simbolo che nel disegno non c'è.
 * - La valvola di sicurezza invece è un dato (marca/modello a catalogo) e compare nella
 *   tabella "Lista Apparecchiature": resta nel modello come `valvoleSicurezza`.
 */

export type SchemaNodoTipo =
  | 'compressore'
  | 'serbatoio'
  | 'essiccatore'
  | 'filtro'
  | 'separatore'
  | 'tanica'
  | 'pacco_bombole'
  /**
   * Terminale della linea aria: non è un'apparecchiatura di scheda, non ha codice e non entra
   * nella lista. Porta la scritta modificabile («Utenze aria», «Utenze azoto», …) e l'ancora
   * su cui si innesta la tubazione finale, che prima del 12-08-2026 era una freccia disegnata
   * d'ufficio da `renderUscitaUtenze` e quindi non toccabile nell'editor.
   */
  | 'utenze'
  /**
   * Giunzione a quattro attacchi (TEE): dirama la linea, è un nodo vero e non un segno sul tubo
   * (a differenza di valvole e riduttori, che hanno solo un dentro e un fuori). Non entra
   * nella lista apparecchiature né in legenda: non ha codice, non è un dato di scheda.
   */
  | 'giunzione'

export type SchemaGruppo = 'SALA_COMPRESSORI' | 'LINEA_DISTRIBUZIONE' | 'ALTRO'

export interface SchemaValvolaSicurezza {
  /** Codice derivato per la tabella (es. 'S1.1', 'S1.2', 'C1.2'), non un dato di scheda. */
  codice: string
  etichetta: string
}

/** Disoleatore (su compressore), scambiatore (su essiccatore) o recipiente (su filtro). */
export interface SchemaAccessorioDipendente {
  codice: string
  etichetta: string
  valvoleSicurezza: SchemaValvolaSicurezza[]
}

export interface SchemaNodo {
  /**
   * Il codice apparecchiatura di scheda dati (C1, S1, E1, F1, SEP1, ...), oppure l'id riservato
   * `UTENZE` del terminale, che nessun codice di scheda può produrre (vedi `SchemaNodoTipo` qui
   * sopra) — o ancora un codice col prefisso `M-` per i nodi aggiunti a mano dalla palette.
   */
  id: string
  tipo: SchemaNodoTipo
  etichetta: string
  /** Solo per tipo 'serbatoio'. */
  orientamento?: 'VERTICALE' | 'ORIZZONTALE'
  /** Solo per tipo 'filtro': i prefiltri stanno a monte dell'essiccatore, gli altri a valle. */
  prefiltro?: boolean
  gruppo: SchemaGruppo
  valvoleSicurezza: SchemaValvolaSicurezza[]
  accessorio?: SchemaAccessorioDipendente
  /**
   * Da dove viene il nodo. La riconciliazione col contenuto della scheda tocca solo quelli
   * di origine 'scheda': un nodo aggiunto a mano dalla palette è una scelta deliberata.
   */
  origine: 'scheda' | 'manuale'
}

/** Cosa può agganciarsi a un punto di attacco di un simbolo. */
export type SchemaTipoAggancio = 'aria' | 'condensa' | 'valvola_sicurezza'

/**
 * Punto di attacco dichiarato dal simbolo, in coordinate locali al riquadro d'ingombro.
 * È dato puro — nessuna funzione — perché il Blocco 3 lo sposterà su tabella.
 */
export interface SchemaAncora {
  /** Stabile e parlante: entra negli archi salvati, cambiarlo invalida i layout esistenti. */
  id: string
  x: number
  y: number
  /** Mai vuoto: un'ancora che non accetta nulla non serve. */
  accetta: SchemaTipoAggancio[]
}

/** Capo di una tubazione: non più solo il nodo, ma il punto preciso su cui si innesta. */
export interface SchemaCapo {
  nodo: string
  ancora: string
}

/**
 * Chiave del registro simboli. Coincide col tipo, tranne dove la geometria cambia con una
 * variante: il serbatoio orizzontale ha corpo e ancore diversi da quello verticale.
 */
export type ChiaveSimbolo = string

export function chiaveSimbolo(nodo: { tipo: SchemaNodoTipo; orientamento?: 'VERTICALE' | 'ORIZZONTALE' }): ChiaveSimbolo {
  if (nodo.tipo === 'serbatoio') return `serbatoio:${nodo.orientamento ?? 'VERTICALE'}`
  return nodo.tipo
}

export type SchemaArcoStile = 'standard' | 'flessibile' | 'condensa'

export type SchemaSegnoTuboTipo = 'valvola_intercettazione' | 'riduttore_pressione'

/**
 * Segno che vive SULLA tubazione, non un nodo: valvola di intercettazione o riduttore di
 * pressione. Scorre lungo il tratto e lo segue quando un'apparecchiatura si sposta perché la
 * sua posizione è relativa alla polilinea (`t`), non assoluta — a differenza della giunzione,
 * che è un nodo vero con tre attacchi propri.
 */
export interface SchemaSegnoTubo {
  id: string
  tipo: SchemaSegnoTuboTipo
  /** Posizione lungo la polilinea del tratto: 0 = capo Da, 1 = capo A. */
  t: number
}

export interface SchemaArco {
  id: string
  da: SchemaCapo
  a: SchemaCapo
  stile: SchemaArcoStile
  /** Gomiti imposti a mano, in coordinate assolute. Assente: percorso automatico. */
  punti?: { x: number; y: number }[]
  /** Valvole di intercettazione e riduttori di pressione posati sul tratto. */
  segni?: SchemaSegnoTubo[]
}

/** Output di `buildSchemaModel`: struttura logica, senza ancora una disposizione grafica. */
export interface SchemaModel {
  nodi: SchemaNodo[]
  archi: SchemaArco[]
}

export interface SchemaNodoPosizionato extends SchemaNodo {
  x: number
  y: number
}

/**
 * Muro di separazione sala compressori / linea distribuzione, disegnato solo se entrambi i
 * gruppi sono popolati. I varchi non stanno qui: `renderSvg` li ricava dalle tubazioni che
 * attraversano davvero il muro, così restano corretti anche dopo che l'utente sposta un nodo.
 */
export interface SchemaMuroSeparazione {
  x: number
  yMin: number
  yMax: number
}

/** Output di `layout`: stessa struttura logica, con posizioni assegnate. Consumato da `renderSvg` e dall'editor. */
export interface SchemaLayout {
  nodi: SchemaNodoPosizionato[]
  archi: SchemaArco[]
  muro: SchemaMuroSeparazione | null
}
