/**
 * Salvataggio e ripristino del layout ritoccato.
 *
 * La scheda resta autorevole su *cosa* esiste, il layout salvato su *dove* sta: alla
 * riapertura le due cose vanno rimesse d'accordo senza buttare il lavoro di disposizione.
 * Il muro non si salva — è derivato dalle posizioni e si ricalcola.
 */
import { calcolaMuro, layoutSchema, DIMENSIONI_NODO, pozzoCondense } from './layout'
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

/**
 * Vero se `salvato` è abbastanza riconoscibile da poter essere usato: a monte Zod lo accetta
 * come `z.any()`, quindi qui deve reggersi da solo. Un `tipo` che il registro simboli non
 * conosce (ritirato, o un JSON modificato a mano) altrimenti arriva intonso fino a
 * `calcolaMuro`/`definizioneDi`, che si aspettano di trovarlo sempre — e in produzione lo
 * schianto sarebbe una schermata bianca all'apertura del dialog invece del ripiego
 * sull'auto-layout.
 */
function contenutoRiconoscibile(salvato: LayoutSalvato): boolean {
  if (!Array.isArray(salvato.nodi) || !Array.isArray(salvato.archi)) return false
  return salvato.nodi.every((n) => Boolean(n) && typeof n === 'object' && n.tipo in DIMENSIONI_NODO)
}

export function deserializzaLayout(salvato: LayoutSalvato | null | undefined): SchemaLayout | null {
  if (!salvato || salvato.versione !== VERSIONE) return null
  if (!contenutoRiconoscibile(salvato)) return null
  return { nodi: salvato.nodi, archi: salvato.archi, muro: calcolaMuro(salvato.nodi) }
}

/**
 * Cosa scrivere in `additional_info.schemaLayout` al salvataggio: il layout in memoria se
 * c'è; altrimenti, solo se questa sessione del dialog non ha *mai* deliberatamente ricalcolato
 * il layout, il layout già persistito, come ripiego.
 *
 * `layoutRicalcolato` distingue «nessun layout» da «layout non ancora ricalcolato»: `false`
 * copre generazione automatica non ancora partita (`puoGenerare` falso), fallita
 * (`rasterizzaSvg` ha lanciato) o non ancora finita (salvataggio durante il calcolo
 * asincrono) — in tutti questi casi il layout in memoria è `null` per un incidente, non per
 * scelta, e senza ripiego un salvataggio in quel momento cancellerebbe la disposizione già
 * persistita. `true` con layout `null` è invece una scelta esplicita dell'utente (disegno
 * AutoCAD caricato, o «Rimuovi»): lì non si ripiega, si scrive «nessun layout» per davvero.
 */
export function layoutDaPersistere(
  layoutCorrente: SchemaLayout | null,
  layoutRicalcolato: boolean,
  layoutSalvato: LayoutSalvato | null | undefined
): LayoutSalvato | undefined {
  if (layoutCorrente) return serializzaLayout(layoutCorrente)
  if (layoutRicalcolato) return undefined
  return layoutSalvato ?? undefined
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

/**
 * Dove far comparire il terminale utenze in un layout salvato che non ce l'ha. La strada
 * generica dei nodi nuovi (sotto tutto il disegno) qui sarebbe sbagliata: il terminale chiude
 * la linea aria, e messo in fondo alla tela costringerebbe la sua tubazione a risalire tutto il
 * foglio. Si riapplica invece, alle posizioni salvate, la stessa regola geometrica che usava
 * `renderUscitaUtenze` prima del 12-08-2026 — a destra dell'ultimo stadio della linea, con
 * l'ancora alla quota del suo centro — così chi riapre un disegno lo ritrova dove ha sempre
 * visto la freccia.
 *
 * Il pozzo di raccolta condense va escluso dai candidati, e non è sempre la tanica: quando la
 * scheda dichiara `raccolta_condense: 'separatore'` è un separatore a farne le veci, e sta
 * comunque nella corsia bassa in basso a destra — abbastanza a destra da rischiare di risultare
 * il nodo più a destra in assoluto. Si esclude quindi con `pozzoCondense` (la stessa funzione
 * che usava `renderUscitaUtenze`), non con un controllo sul solo tipo `tanica`.
 */
function posizioneTerminale(
  nodi: SchemaNodoPosizionato[],
  archi: SchemaArco[]
): { x: number; y: number } | null {
  const pozzo = pozzoCondense(nodi, { archi })
  const inLinea = nodi.filter((n) => n.tipo !== 'compressore' && n.tipo !== 'utenze' && n.id !== pozzo?.id)
  if (inLinea.length === 0) return null
  const ultimo = inLinea.reduce((a, b) => (a.x > b.x ? a : b))
  const dim = DIMENSIONI_NODO[ultimo.tipo]
  return {
    x: ultimo.x + dim.larghezza + 50,
    y: ultimo.y + dim.altezza / 2 - DIMENSIONI_NODO.utenze.altezza,
  }
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
      if (!daScheda) return n
      // Il terminale utenze è l'unico nodo di origine 'scheda' la cui etichetta l'utente può
      // cambiare (le altre vengono dalla scheda dati e vanno riscritte da lì): riscriverla
      // renderebbe inutile poterla cambiare.
      const etichetta = n.tipo === 'utenze' ? n.etichetta : daScheda.etichetta
      return { ...daScheda, etichetta, x: n.x, y: n.y }
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
    if (n.tipo === 'utenze') {
      const dedicata = posizioneTerminale(superstiti, modello.archi)
      if (dedicata) return { ...proposto, ...dedicata }
    }
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
  const idTerminale = nodi.find((n) => n.tipo === 'utenze')?.id
  const archiNuovi = modello.archi.filter(
    (a) =>
      !identitaSalvate.has(identitaArco(a)) &&
      (aggiunti.includes(a.da.nodo) || aggiunti.includes(a.a.nodo)) &&
      // La tubazione del terminale non passa da qui: la governa la regola qui sotto. Per la
      // strada generica basta che uno dei capi sia fra gli `aggiunti`, e aggiungendo uno stadio
      // alla catena di uno schema già salvato quel criterio ne creava una seconda (E1→UTENZE)
      // accanto a quella salvata (S1→UTENZE), entrambe convergenti sul codolo.
      a.a.nodo !== idTerminale
  )
  const archi = [...archiSalvati, ...archiNuovi].filter((a) => idNodi.has(a.da.nodo) && idNodi.has(a.a.nodo))

  // Invariante del terminale: ha sempre esattamente una tubazione entrante; se dopo la
  // riconciliazione non ne ha nessuna, si prende quella del modello. Il controllo va qui, DOPO
  // il filtro sui capi assenti, o conterebbe archi che stanno per essere scartati — è proprio
  // il caso che ripara: togliendo l'ultimo stadio della catena, l'arco salvato E1→UTENZE cade
  // insieme a E1 e il terminale resterebbe a mezz'aria, simbolo senza tubo.
  //
  // Non «scartare sempre l'arco salvato e riprendere quello del modello»: l'utente PUÒ tracciare
  // a mano la tubazione al terminale — è uno dei motivi per cui il terminale è diventato un
  // elemento — e buttare via il suo tracciato a ogni riapertura contraddirebbe il principio che
  // il layout salvato è autorevole su *dove* passano le cose.
  if (idTerminale && !archi.some((a) => a.a.nodo === idTerminale)) {
    const dalModello = modello.archi.find((a) => a.a.nodo === idTerminale && idNodi.has(a.da.nodo))
    if (dalModello) archi.push(dalModello)
  }

  return { layout: { nodi, archi, muro: calcolaMuro(nodi) }, aggiunti, rimossi }
}
