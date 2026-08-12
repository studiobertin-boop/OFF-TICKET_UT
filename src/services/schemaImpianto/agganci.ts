/**
 * Regola unica su cosa può agganciarsi dove. Sta in un file suo perché la consultano il
 * costruttore del modello, l'editor (che rifiuta una connessione illegale mentre la si
 * traccia) e il preflight: tre punti distanti che devono dire la stessa cosa.
 */
import { ancoraDi } from './symbols'
import type { SchemaAncora, SchemaArcoStile, SchemaNodoTipo, SchemaTipoAggancio } from './types'

/** La tubazione flessibile è pur sempre aria: cambia il tratto, non il fluido. */
export function tipoAggancioPerStile(stile: SchemaArcoStile): SchemaTipoAggancio {
  return stile === 'condensa' ? 'condensa' : 'aria'
}

export function ancoraAmmette(ancora: SchemaAncora, stile: SchemaArcoStile): boolean {
  return ancora.accetta.includes(tipoAggancioPerStile(stile))
}

export function capoValido(
  nodo: { tipo: SchemaNodoTipo; orientamento?: 'VERTICALE' | 'ORIZZONTALE' },
  ancoraId: string,
  stile: SchemaArcoStile
): boolean {
  const ancora = ancoraDi(nodo, ancoraId)
  return Boolean(ancora && ancoraAmmette(ancora, stile))
}

type Nodo = { tipo: SchemaNodoTipo; orientamento?: 'VERTICALE' | 'ORIZZONTALE' }

/** Gli stili esistenti si riducono a due agganci distinti: 'standard' e 'flessibile' sono
 *  entrambi aria, quindi verificarli entrambi è ridondante — uno vale per l'altro. */
const STILI_PER_AGGANCIO: SchemaArcoStile[] = ['standard', 'condensa']

/**
 * Vero se almeno uno stile di tubazione è ammesso da entrambi i capi. Serve a decidere se
 * l'utente può tracciare la connessione mentre la trascina: valutarla sempre con 'standard'
 * (l'unico stile con cui `onConnect` crea la tubazione) rifiuterebbe ogni linea condense,
 * perché nessuna ancora che accetta condensa accetta anche aria.
 */
export function connessioneAmmessa(nodoDa: Nodo, ancoraIdDa: string, nodoA: Nodo, ancoraIdA: string): boolean {
  return STILI_PER_AGGANCIO.some((stile) => capoValido(nodoDa, ancoraIdDa, stile) && capoValido(nodoA, ancoraIdA, stile))
}

/**
 * Stile con cui una tubazione nuova fra questi due capi deve nascere: 'condensa' se è
 * l'unico stile che entrambi ammettono, altrimenti 'standard' (rigida) — la scelta di
 * default di sempre, che l'utente resta libero di cambiare in flessibile a mano.
 */
export function stileIniziale(nodoDa: Nodo, ancoraIdDa: string, nodoA: Nodo, ancoraIdA: string): SchemaArcoStile {
  const ariaAmmessa = capoValido(nodoDa, ancoraIdDa, 'standard') && capoValido(nodoA, ancoraIdA, 'standard')
  return ariaAmmessa ? 'standard' : 'condensa'
}
