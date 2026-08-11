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
 * - La valvola di scarico è una decorazione fissa del simbolo (sempre presente su
 *   serbatoio/essiccatore/filtro/separatore/disoleatore), non un dato: non ha un codice
 *   proprio e non entra nel modello.
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
  /** Coincide col codice apparecchiatura di scheda dati (C1, S1, E1, F1, SEP1, ...). */
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
}

export type SchemaArcoStile = 'standard' | 'flessibile' | 'condensa'

export interface SchemaArco {
  id: string
  da: string
  a: string
  stile: SchemaArcoStile
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
