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
