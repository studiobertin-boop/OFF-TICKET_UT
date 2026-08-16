/**
 * Regola unica su cosa può agganciarsi dove. Sta in un file suo perché la consultano il
 * costruttore del modello, l'editor (che rifiuta una connessione illegale mentre la si
 * traccia) e il preflight: tre punti distanti che devono dire la stessa cosa.
 */
import type { Tarature } from './libreria'
import { definizioneDi } from './symbols'
import type { SchemaAncora, SchemaArcoStile, SchemaNodoTipo, SchemaTipoAggancio } from './types'

/** La tubazione flessibile è pur sempre aria: cambia il tratto, non il fluido. */
export function tipoAggancioPerStile(stile: SchemaArcoStile): SchemaTipoAggancio {
  return stile === 'condensa' ? 'condensa' : 'aria'
}

export function ancoraAmmette(ancora: SchemaAncora, stile: SchemaArcoStile): boolean {
  return ancora.accetta.includes(tipoAggancioPerStile(stile))
}

/**
 * Se un attacco ammette lo stile dato. Legge il registro invece di passare da `ancoraDi`: gli
 * serve solo il campo `accetta`, che dipende dal tipo (e dall'orientamento) del nodo e non dal
 * suo contenuto — a differenza di `ancoraDi`, che da quando le ancore possono dipendere dal nodo
 * intero (vedi `ancoreDi`, symbols/index.ts) può correggere una sua coordinata in base
 * all'etichetta. Allargare qui la firma a `SchemaNodo` costringerebbe ogni chiamante
 * (compreso l'editor, che verifica una connessione mentre l'utente la trascina) a costruire un
 * nodo completo solo per sapere se un capo accetta aria o condensa.
 */
export function capoValido(
  nodo: { tipo: SchemaNodoTipo; orientamento?: 'VERTICALE' | 'ORIZZONTALE' },
  ancoraId: string,
  stile: SchemaArcoStile,
  libreria: Tarature = {}
): boolean {
  const ancora = definizioneDi(nodo, libreria).ancore.find((a) => a.id === ancoraId)
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
export function connessioneAmmessa(
  nodoDa: Nodo,
  ancoraIdDa: string,
  nodoA: Nodo,
  ancoraIdA: string,
  libreria: Tarature = {}
): boolean {
  return STILI_PER_AGGANCIO.some(
    (stile) => capoValido(nodoDa, ancoraIdDa, stile, libreria) && capoValido(nodoA, ancoraIdA, stile, libreria)
  )
}

/**
 * Stile con cui una tubazione nuova fra questi due capi deve nascere: 'condensa' se è
 * l'unico stile che entrambi ammettono, altrimenti 'standard' (rigida) — la scelta di
 * default di sempre, che l'utente resta libero di cambiare in flessibile a mano.
 */
export function stileIniziale(
  nodoDa: Nodo,
  ancoraIdDa: string,
  nodoA: Nodo,
  ancoraIdA: string,
  libreria: Tarature = {}
): SchemaArcoStile {
  const ariaAmmessa = capoValido(nodoDa, ancoraIdDa, 'standard', libreria) && capoValido(nodoA, ancoraIdA, 'standard', libreria)
  return ariaAmmessa ? 'standard' : 'condensa'
}
