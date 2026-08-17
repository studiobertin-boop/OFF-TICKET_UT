/**
 * I tre strati della libreria dei simboli e la loro risoluzione.
 *
 * default di fabbrica (REGISTRO_SIMBOLI) → taratura permanente (tabella) → taratura di
 * questa pratica (dentro il layout salvato). L'ultimo che parla vince, e vince PER INTERO:
 * traslazione, scala e ancore sono interdipendenti, e fonderle per campi produrrebbe
 * stati mai visti sullo schermo.
 *
 * Dati puri, nessun accesso alla rete e nessuno stato di modulo: la libreria risolta viene
 * passata come parametro esplicito alle porte del registro. Un registro globale mutabile
 * renderebbe il disegno dipendente da quale pratica è stata aperta per ultima.
 */
import type { ChiaveSimbolo, SchemaAncora } from './types'

export interface TaraturaSimbolo {
  /** Traslazione della sagoma dentro il sistema del nodo. Le ANCORE non la subiscono. */
  dx: number
  dy: number
  /** Scala della sagoma. Le scritte si contro-scalano, vedi `simboloTrasformato`. */
  sx: number
  sy: number
  /** Ancore in coordinate finali, già sui multipli di PASSO_GRIGLIA. */
  ancore: SchemaAncora[]
}

export type Tarature = Partial<Record<ChiaveSimbolo, TaraturaSimbolo>>

export const TARATURA_NEUTRA: TaraturaSimbolo = { dx: 0, dy: 0, sx: 1, sy: 1, ancore: [] }

export function risolviLibreria(permanenti: Tarature, diPratica: Tarature): Tarature {
  return { ...permanenti, ...diPratica }
}

export function taraturaDi(libreria: Tarature, chiave: ChiaveSimbolo): TaraturaSimbolo | undefined {
  return libreria[chiave]
}
