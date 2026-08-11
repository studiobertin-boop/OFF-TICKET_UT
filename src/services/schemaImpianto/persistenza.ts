/**
 * Salvataggio e ripristino del layout ritoccato.
 *
 * La scheda resta autorevole su *cosa* esiste, il layout salvato su *dove* sta: alla
 * riapertura le due cose vanno rimesse d'accordo senza buttare il lavoro di disposizione.
 * Il muro non si salva — è derivato dalle posizioni e si ricalcola.
 */
import { calcolaMuro, layoutSchema } from './layout'
import type { SchemaArco, SchemaLayout, SchemaModel, SchemaNodoPosizionato } from './types'

const VERSIONE = 1

export interface LayoutSalvato {
  versione: number
  nodi: SchemaNodoPosizionato[]
  archi: SchemaArco[]
}

export function serializzaLayout(layout: SchemaLayout): LayoutSalvato {
  return { versione: VERSIONE, nodi: layout.nodi, archi: layout.archi }
}

export function deserializzaLayout(salvato: LayoutSalvato | null | undefined): SchemaLayout | null {
  if (!salvato || salvato.versione !== VERSIONE) return null
  return { nodi: salvato.nodi, archi: salvato.archi, muro: calcolaMuro(salvato.nodi) }
}

export interface EsitoRiconciliazione {
  layout: SchemaLayout
  aggiunti: string[]
  rimossi: string[]
}

export function riconcilia(salvato: LayoutSalvato, modello: SchemaModel): EsitoRiconciliazione {
  const inScheda = new Set(modello.nodi.map((n) => n.id))
  const salvatiPerId = new Map(salvato.nodi.map((n) => [n.id, n]))

  // Un nodo salvato sopravvive se la scheda lo conosce ancora, o se l'ha messo l'utente.
  const superstiti = salvato.nodi.filter((n) => n.origine === 'manuale' || inScheda.has(n.id))
  const rimossi = salvato.nodi.filter((n) => !superstiti.includes(n)).map((n) => n.id)

  // Le apparecchiature nuove entrano nelle posizioni che l'auto-layout darebbe loro oggi,
  // traslate sotto il disegno esistente: in mezzo coprirebbero quello che c'è già.
  const nuovi = modello.nodi.filter((n) => !salvatiPerId.has(n.id))
  const piede = superstiti.length > 0 ? Math.max(...superstiti.map((n) => n.y)) + 320 : 0
  const automatico = layoutSchema(modello)
  const aggiunti = nuovi.map((n) => n.id)
  const posizionati = nuovi.map((n) => {
    const proposto = automatico.nodi.find((p) => p.id === n.id)!
    return { ...proposto, y: proposto.y + piede }
  })

  const nodi = [...superstiti, ...posizionati]
  const idNodi = new Set(nodi.map((n) => n.id))

  // Gli archi salvati restano solo se entrambi i capi esistono ancora; per le apparecchiature
  // nuove si prendono quelli che il modello propone.
  const archiSalvati = salvato.archi.filter((a) => idNodi.has(a.da.nodo) && idNodi.has(a.a.nodo))
  const idArchi = new Set(archiSalvati.map((a) => a.id))
  const archiNuovi = modello.archi.filter(
    (a) => !idArchi.has(a.id) && (aggiunti.includes(a.da.nodo) || aggiunti.includes(a.a.nodo))
  )
  const archi = [...archiSalvati, ...archiNuovi].filter((a) => idNodi.has(a.da.nodo) && idNodi.has(a.a.nodo))

  return { layout: { nodi, archi, muro: calcolaMuro(nodi) }, aggiunti, rimossi }
}
