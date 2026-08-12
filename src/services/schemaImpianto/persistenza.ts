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
  // Copia profonda, non solo degli array: chi tiene il risultato deve avere un'istantanea
  // vera. Senza clonare anche i singoli nodi/archi, un trascinamento successivo nell'editor
  // (che muta x/y in place sullo stesso oggetto) si propagherebbe dentro al "salvato".
  return { versione: VERSIONE, nodi: structuredClone(layout.nodi), archi: structuredClone(layout.archi) }
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

/**
 * Identità di una tubazione per il confronto salvato/modello: i capi (nodo+ancora da un lato
 * e dall'altro) più lo stile. Non l'id: `buildArchi` lo genera con un contatore che riparte
 * a ogni chiamata (`flex-1`, `std-2`, ...), quindi dipende dall'ordine di iterazione (per
 * esempio dall'ordine delle chiavi in `collegamentiCompressoriSerbatoi`) e non è stabile fra
 * una scheda e la successiva. Due archi scollegati possono ricevere lo stesso id per
 * coincidenza: confrontare gli id scarterebbe in silenzio un arco nuovo davvero diverso.
 */
function identitaArco(arco: SchemaArco): string {
  return `${arco.da.nodo}#${arco.da.ancora}->${arco.a.nodo}#${arco.a.ancora}:${arco.stile}`
}

/**
 * Da cosa parte l'editor all'apertura: il layout salvato se è ancora leggibile, altrimenti la
 * proposta automatica. Il controllo di versione sta qui e non nel componente React che chiama
 * questa funzione, così la strada che il dialog percorre davvero è la stessa che i test coprono.
 */
export function layoutIniziale(
  salvato: LayoutSalvato | null | undefined,
  modello: SchemaModel
): EsitoRiconciliazione {
  const ripristinato = deserializzaLayout(salvato)
  if (!ripristinato) return { layout: layoutSchema(modello), aggiunti: [], rimossi: [] }
  return riconcilia(ripristinato, modello)
}

export function riconcilia(salvato: Pick<SchemaLayout, 'nodi' | 'archi'>, modello: SchemaModel): EsitoRiconciliazione {
  const inScheda = new Set(modello.nodi.map((n) => n.id))
  const salvatiPerId = new Map(salvato.nodi.map((n) => [n.id, n]))
  const modelloPerId = new Map(modello.nodi.map((n) => [n.id, n]))

  // Un nodo salvato sopravvive se la scheda lo conosce ancora, o se l'ha messo l'utente. Per
  // quelli di origine scheda, il nodo appena ricostruito da buildSchemaModel sovrascrive il
  // salvato: la scheda resta autorevole su *cosa* è il nodo (etichetta, valvole, accessorio,
  // orientamento...), il layout salvato solo su *dove* sta (x/y). Senza questo passaggio,
  // correggere marca/modello o aggiungere una valvola dopo il primo salvataggio non arriva
  // mai più in relazione (vedi revisione finale, rilievo Critical).
  const superstiti = salvato.nodi
    .filter((n) => n.origine === 'manuale' || inScheda.has(n.id))
    .map((n) => {
      if (n.origine === 'manuale') return n
      const daScheda = modelloPerId.get(n.id)
      return daScheda ? { ...daScheda, x: n.x, y: n.y } : n
    })
  const rimossi = salvato.nodi
    .filter((n) => n.origine !== 'manuale' && !inScheda.has(n.id))
    .map((n) => n.id)

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

  // Gli archi salvati restano per default; per le apparecchiature nuove si aggiungono quelli
  // che il modello propone, a meno che un arco con la stessa identità (capi + stile) non sia
  // già fra i salvati. L'invariante "nessun capo su un nodo assente" si impone una sola volta,
  // alla fine, sull'unione: qui sopra gli elenchi possono ancora contenere un arco salvato che
  // puntava a un nodo appena rimosso, o un arco nuovo verso un nodo che poi risulta scartato.
  const archiSalvati = salvato.archi
  const identitaSalvate = new Set(archiSalvati.map(identitaArco))
  const archiNuovi = modello.archi.filter(
    (a) => !identitaSalvate.has(identitaArco(a)) && (aggiunti.includes(a.da.nodo) || aggiunti.includes(a.a.nodo))
  )
  const archi = [...archiSalvati, ...archiNuovi].filter((a) => idNodi.has(a.da.nodo) && idNodi.has(a.a.nodo))

  return { layout: { nodi, archi, muro: calcolaMuro(nodi) }, aggiunti, rimossi }
}
