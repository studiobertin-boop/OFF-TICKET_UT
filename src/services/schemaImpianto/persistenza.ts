/**
 * Salvataggio e ripristino del layout ritoccato.
 *
 * La scheda resta autorevole su *cosa* esiste, il layout salvato su *dove* sta: alla
 * riapertura le due cose vanno rimesse d'accordo senza buttare il lavoro di disposizione.
 * Del muro si salva la sola ascissa: l'altezza resta derivata dalle posizioni.
 */
import { ancoraAmmette } from './agganci'
import { layoutSchema, muroDaAscissa, DIMENSIONI_NODO, pozzoCondense } from './layout'
import type { Tarature } from './libreria'
import { ancoraDi, ancoreDi, dimensioniDi } from './symbols'
import type { SchemaArco, SchemaCapo, SchemaLayout, SchemaModel, SchemaNodo, SchemaNodoPosizionato, SchemaTestoLibero } from './types'

const VERSIONE = 1

export interface LayoutSalvato {
  versione: number
  nodi: SchemaNodoPosizionato[]
  archi: SchemaArco[]
  /** Assente sui layout salvati prima del Blocco C2: un campo nuovo e opzionale, non un cambio
   *  di formato — per questo non alza `VERSIONE` (vedi `deserializzaLayout`). */
  testi?: SchemaTestoLibero[]
  /**
   * Ascissa del muro di separazione. Assente: nessun muro — il caso di ogni salvataggio scritto
   * prima del Blocco D4, e di ogni pratica finche' il committente non lo aggiunge. Campo nuovo e
   * opzionale, non un cambio di formato: per questo non alza `VERSIONE`, che invece butterebbe
   * via l'intero layout salvato. Del muro si salva SOLO l'ascissa: l'altezza si ricava al disegno
   * (`muroDaAscissa`, layout.ts).
   */
  muroX?: number
  /**
   * Taratura di pratica: vale solo per la pratica aperta, sopra la taratura permanente
   * (tabella `schema_simboli`, Task 9) e sotto nessuno — è l'ultimo strato che parla
   * (`risolviLibreria`, libreria.ts). È il SEME di quello strato, non lo strato stesso: chi apre
   * la pratica lo legge da qui una volta e da lì in poi tiene il valore vivo in memoria, che una
   * taratura decisa nella sessione aggiorna. Per questo `layoutIniziale` non lo rilegge (vedi lì).
   *
   * Assente: nessuna correzione locale, questa pratica
   * disegna con permanente+registro come ogni altra. Campo nuovo e opzionale, non un cambio
   * di formato — stessa ragione già decisa per `muroX`: alzare `VERSIONE` butterebbe via il
   * layout salvato di OGNI pratica esistente, perché `deserializzaLayout` lo respinge in
   * blocco quando la versione non combacia.
   */
  simboli?: Tarature
}

/**
 * `simboli`: la taratura di questa pratica da scrivere insieme al layout, se questa sessione
 * ne ha una. Non viene da `layout` — `SchemaLayout` non la porta, perché è un dato di
 * libreria e non di geometria, esattamente come la libreria che ogni chiamante di
 * `layoutSchema`/`renderSvg` passa già a parte — il chiamante la passa esplicita.
 */
export function serializzaLayout(layout: SchemaLayout, simboli?: Tarature): LayoutSalvato {
  // Copia profonda, non solo degli array: chi tiene il risultato deve avere un'istantanea
  // vera. Senza clonare anche i singoli nodi/archi, un trascinamento successivo nell'editor
  // (che muta x/y in place sullo stesso oggetto) si propagherebbe dentro al "salvato".
  return {
    versione: VERSIONE,
    nodi: structuredClone(layout.nodi),
    archi: structuredClone(layout.archi),
    testi: structuredClone(layout.testi ?? []),
    ...(layout.muro ? { muroX: layout.muro.x } : {}),
    // Omesso, non `{}`, quando non c'è nulla da tarare: un `simboli: {}` scritto sempre
    // renderebbe "assente" e "tarata a vuoto" indistinguibili nel salvato, come già per `muroX`.
    ...(simboli && Object.keys(simboli).length > 0 ? { simboli: structuredClone(simboli) } : {}),
  }
}

/**
 * Vero se `salvato` è abbastanza riconoscibile da poter essere usato: a monte Zod lo accetta
 * come `z.any()`, quindi qui deve reggersi da solo. Un `tipo` che il registro simboli non
 * conosce (ritirato, o un JSON modificato a mano) altrimenti arriva intonso fino a
 * `muroDaAscissa`/`definizioneDi`, che si aspettano di trovarlo sempre — e in produzione lo
 * schianto sarebbe una schermata bianca all'apertura del dialog invece del ripiego
 * sull'auto-layout.
 */
function contenutoRiconoscibile(salvato: LayoutSalvato): boolean {
  if (!Array.isArray(salvato.nodi) || !Array.isArray(salvato.archi)) return false
  return salvato.nodi.every((n) => Boolean(n) && typeof n === 'object' && n.tipo in DIMENSIONI_NODO)
}

export function deserializzaLayout(
  salvato: LayoutSalvato | null | undefined,
  libreria: Tarature = {}
): SchemaLayout | null {
  if (!salvato || salvato.versione !== VERSIONE) return null
  if (!contenutoRiconoscibile(salvato)) return null
  return {
    nodi: salvato.nodi,
    archi: salvato.archi,
    muro: typeof salvato.muroX === 'number' ? muroDaAscissa(salvato.muroX, salvato.nodi, libreria) : null,
    testi: salvato.testi ?? [],
  }
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
 *
 * `simboli`: la taratura di pratica accumulata in questa sessione (Task 12, il modo taratura
 * sulla tela — «usa solo questa volta»), inoltrata a `serializzaLayout` senza altra logica qui:
 * questa funzione decide SE scrivere un layout, non COSA porta con sé quando lo fa. Assente:
 * nessuna taratura di pratica da salvare, come ogni chiamante prima del Task 12.
 */
export function layoutDaPersistere(
  layoutCorrente: SchemaLayout | null,
  layoutRicalcolato: boolean,
  layoutSalvato: LayoutSalvato | null | undefined,
  simboli?: Tarature
): LayoutSalvato | undefined {
  if (layoutCorrente) return serializzaLayout(layoutCorrente, simboli)
  if (layoutRicalcolato) return undefined
  return layoutSalvato ?? undefined
}

export interface EsitoRiconciliazione {
  layout: SchemaLayout
  /**
   * Tutti i nodi che la riconciliazione ha collocato: elenco vero, a uso interno. Comprende il
   * terminale utenze, che è un nodo a tutti gli effetti.
   */
  aggiunti: string[]
  /**
   * Quelli di cui vale la pena avvisare l'utente: è `aggiunti` senza i nodi che non sono
   * apparecchiature — vedi `daAnnunciare`. Il terminale utenze non viene dalla scheda, e
   * annunciarlo come «Aggiunte dalla scheda: UTENZE» sarebbe falso su entrambi i fronti, una
   * volta su ogni pratica già salvata; le giunzioni di un by-pass compaiono e spariscono quando
   * l'operatore crea o scioglie un gruppo, e non sono una notizia sulla scheda dati.
   *
   * Due elenchi invece di uno solo filtrato in presentazione: quale nodo sia un'apparecchiatura
   * è cognizione di dominio, e qui sta sotto un test di funzione pura, mentre nel componente
   * finirebbe fuori dalla copertura (la convenzione del progetto è: nessun test di UI).
   */
  aggiuntiDaScheda: string[]
  rimossi: string[]
  /**
   * Quante tubazioni salvate sono state buttate perché nessuno dei loro capi trovava più
   * un'ancora che accettasse quel fluido (`capoRiattaccato` → `null`). Un numero e non un elenco:
   * gli id degli archi non sono stabili fra una scheda e la successiva (vedi `identitaArco`),
   * quindi nominarli direbbe all'utente meno di quanto sembri.
   *
   * Va detto, e finora non lo era: una taratura permanente che cambi `accetta` fa sparire tubi da
   * ogni pratica riaperta, senza che nessuno se ne accorga finché non guarda il disegno. La
   * guardia gemella dentro la sessione esiste già (`togliAncoraSelezionata`/`tornaADefault`,
   * SchemaEditor.tsx), che rifiutano il gesto invece di lasciar cadere il tubo: qui il gesto è già
   * stato fatto, altrove e magari da un altro, e resta solo da dirlo (revisione finale, rilievo
   * Importante).
   *
   * NON conta gli archi caduti insieme al loro NODO: quelli sono già raccontati da `rimossi`, e
   * contarli due volte trasformerebbe una rimozione annunciata in un allarme in più.
   */
  archiScartati: number
}

/**
 * Identità di una tubazione per il confronto salvato/modello: i capi (nodo+ancora da un lato
 * e dall'altro) più lo stile. Non l'id: `buildArchi` lo genera con un contatore che riparte
 * a ogni chiamata (`flex-1`, `std-2`, ...), quindi dipende dall'ordine di iterazione (per
 * esempio dall'ordine delle chiavi in `collegamentiCompressoriSerbatoi`) e non è stabile fra
 * una scheda e la successiva. Due archi scollegati possono ricevere lo stesso id per
 * coincidenza: confrontare gli id scarterebbe in silenzio un arco nuovo davvero diverso.
 */
/**
 * Vale la pena nominarlo all'operatore quando compare o sparisce? Solo le APPARECCHIATURE: il
 * terminale utenze non viene dalla scheda e non e' una di loro, e nemmeno le giunzioni di un
 * by-pass, che compaiono e spariscono da se' quando l'operatore crea o scioglie un gruppo —
 * annunciarle come «rimosse perche' non piu' in scheda» sarebbe falso su entrambi i fronti.
 *
 * Sta qui, sotto un test di funzione pura, e non nel componente che compone l'avviso: quale nodo
 * sia un'apparecchiatura e' cognizione di dominio, e nel componente finirebbe fuori dalla
 * copertura (la convenzione del progetto e': nessun test di interfaccia).
 */
function daAnnunciare(nodo: SchemaNodo): boolean {
  return nodo.tipo !== 'utenze' && nodo.tipo !== 'giunzione'
}

function identitaArco(arco: SchemaArco): string {
  return `${arco.da.nodo}#${arco.da.ancora}->${arco.a.nodo}#${arco.a.ancora}:${arco.stile}`
}

/**
 * Da cosa parte l'editor all'apertura: il layout salvato se è ancora leggibile, altrimenti la
 * proposta automatica. Il controllo di versione sta qui e non nel componente React che chiama
 * questa funzione, così la strada che il dialog percorre davvero è la stessa che i test coprono.
 *
 * `libreria` è la libreria GIÀ RISOLTA — permanenti fuse con la taratura di pratica — e non il
 * solo strato permanente: la fusione (`risolviLibreria`) avviene una volta sola nel chiamante,
 * che è anche il punto da cui la stessa libreria va al disegno e all'editor
 * (`SchemaImpiantoSection.tsx`). Qui NON si rifonde con `salvato.simboli`, benché sia a portata di
 * mano: quel campo è solo il SEME dello strato di pratica — chi monta la sezione lo legge da
 * `additional_info` e lo tiene come stato vivo — e rifonderlo qui farebbe vincere il valore
 * salvato su quello deciso e non ancora scritto. Finché le due fonti coincidono la differenza non
 * si vede; appena divergono, il layout nascerebbe con una libreria diversa da quella con cui il
 * documento viene poi disegnato (revisione finale, rilievo Importante).
 */
export function layoutIniziale(
  salvato: LayoutSalvato | null | undefined,
  modello: SchemaModel,
  libreria: Tarature = {}
): EsitoRiconciliazione {
  const ripristinato = deserializzaLayout(salvato, libreria)
  if (!ripristinato)
    return {
      layout: layoutSchema(modello, libreria),
      aggiunti: [],
      aggiuntiDaScheda: [],
      rimossi: [],
      archiScartati: 0,
    }
  return riconcilia(ripristinato, modello, libreria)
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
  nodo: SchemaNodo,
  nodi: SchemaNodoPosizionato[],
  archi: SchemaArco[],
  libreria: Tarature = {}
): { x: number; y: number } | null {
  const pozzo = pozzoCondense(nodi, { archi })
  const inLinea = nodi.filter((n) => n.tipo !== 'compressore' && n.tipo !== 'utenze' && n.id !== pozzo?.id)
  if (inLinea.length === 0) return null
  const ultimo = inLinea.reduce((a, b) => (a.x > b.x ? a : b))
  // `dimensioniDi`, non `DIMENSIONI_NODO[ultimo.tipo]`: stesso difetto già corretto in
  // `calcolaMuro`/`ascissaProposta` (Task 4) — se il nodo più a destra è un serbatoio
  // orizzontale, l'ingombro indicizzato sul verticale (100×300 invece di 310×140) metterebbe il
  // terminale utenze sopra il serbatoio invece che alla sua destra.
  const dim = dimensioniDi(ultimo, libreria)
  return {
    x: ultimo.x + dim.larghezza + 50,
    y: ultimo.y + dim.altezza / 2 - dimensioniDi(nodo, libreria).altezza,
  }
}

/**
 * Se l'ancora di un capo non è più compatibile con lo stile dell'arco nella definizione
 * corrente del suo nodo — una taratura, permanente o di pratica, gliel'ha tolta, o ne ha
 * lasciato l'id ma cambiato il fluido che accetta — il capo si riattacca all'ancora
 * compatibile più vicina, invece di restare puntato lì. Compatibile secondo `accetta`
 * (`ancoraAmmette`): un tubo d'aria non deve finire sull'ancora della condensa solo perché è
 * la più vicina — né restarci per il solo fatto che l'id combacia ancora, che è esattamente il
 * caso in cui il modo taratura riassegna un id esistente a un altro fluido senza toglierlo.
 * "Più vicina" è misurata contro il CENTRO del nodo all'altro capo — l'unico riferimento
 * geometrico disponibile qui: dove stava l'ancora sparita non è recuperabile, nessuna taratura
 * precedente resta salvata da nessuna parte.
 *
 * Nessuna ancora compatibile: `null`. Il chiamante scarta l'intero arco — la stessa sorte che
 * `riconcilia` riserva già oggi a un capo il cui NODO (non solo l'ancora) è sparito: un
 * riferimento che non risolve si scarta, non si indovina (vedi il filtro su `idNodi` qui sotto).
 */
function capoRiattaccato(
  capo: SchemaCapo,
  nodo: SchemaNodoPosizionato,
  altro: SchemaNodoPosizionato,
  stile: SchemaArco['stile'],
  libreria: Tarature
): SchemaCapo | null {
  // Non basta che l'id si trovi ancora (`ancoraDi`): va anche verificato che quell'ancora
  // ammetta tuttora lo stile dell'arco, o un id rimasto ma riassegnato a un altro fluido
  // (accetta cambiato da una taratura, senza toccare l'id) sfuggirebbe al riattacco.
  const attuale = ancoraDi(nodo, capo.ancora, libreria)
  if (attuale && ancoraAmmette(attuale, stile)) return capo
  const compatibili = ancoreDi(nodo, libreria).filter((a) => ancoraAmmette(a, stile))
  if (compatibili.length === 0) return null
  const centroAltro = {
    x: altro.x + dimensioniDi(altro, libreria).larghezza / 2,
    y: altro.y + dimensioniDi(altro, libreria).altezza / 2,
  }
  const distanza2 = (a: { x: number; y: number }) => (nodo.x + a.x - centroAltro.x) ** 2 + (nodo.y + a.y - centroAltro.y) ** 2
  const piuVicina = compatibili.reduce((migliore, corrente) => (distanza2(corrente) < distanza2(migliore) ? corrente : migliore))
  return { nodo: capo.nodo, ancora: piuVicina.id }
}

/**
 * Riceve ciò che restituisce `deserializzaLayout` — un `SchemaLayout`, con `muro` e non
 * `muroX` — perché è quello che le passa davvero `layoutIniziale`, l'unica strada che la
 * produzione percorre. Prima della revisione finale il parametro dichiarava `muroX?: number`
 * come se ricevesse un `LayoutSalvato`: TypeScript non lo segnalava (il campo era opzionale, e
 * `ripristinato` è una variabile, non un letterale — niente controllo delle proprietà in
 * eccesso), ma a runtime il muro salvato non veniva mai letto. Vedi revisione finale, rilievo
 * Critico.
 *
 * `testi` resta opzionale, benché `SchemaLayout.testi` sia obbligatorio: `deserializzaLayout`
 * lo normalizza sempre a `[]`, ma qualche test costruisce ancora un salvato "grezzo" senza
 * passare da lì (un `LayoutSalvato` scritto prima del Blocco C2 non ce l'ha).
 * `Pick<SchemaLayout, 'nodi' | 'archi' | 'testi'>` imporrebbe `testi` obbligatorio e romperebbe
 * quelle chiamate.
 */
export function riconcilia(
  salvato: Pick<SchemaLayout, 'nodi' | 'archi'> & { testi?: SchemaTestoLibero[]; muro?: SchemaLayout['muro'] },
  modello: SchemaModel,
  libreria: Tarature = {}
): EsitoRiconciliazione {
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
  // Le giunzioni restano fuori dagli avvisi come il terminale utenze (vedi `daAnnunciare`): non
  // sono apparecchiature, non vengono dalla scheda e non entrano in lista. Sciogliendo un
  // by-pass l'operatore leggerebbe «Rimosse perche' non piu' in scheda: BP1-IN, BP1-OUT» —
  // falso su entrambi i fronti, esattamente come lo sarebbe stato «Aggiunte dalla scheda:
  // UTENZE».
  const rimossi = salvato.nodi
    .filter((n) => n.origine !== 'manuale' && !inScheda.has(n.id) && daAnnunciare(n))
    .map((n) => n.id)

  // Le apparecchiature nuove entrano nelle posizioni che l'auto-layout darebbe loro oggi,
  // traslate sotto il disegno esistente: in mezzo coprirebbero quello che c'è già.
  const nuovi = modello.nodi.filter((n) => !salvatiPerId.has(n.id))
  const piede = superstiti.length > 0 ? Math.max(...superstiti.map((n) => n.y)) + 320 : 0
  const automatico = layoutSchema(modello, libreria)
  const aggiunti = nuovi.map((n) => n.id)
  const aggiuntiDaScheda = nuovi.filter(daAnnunciare).map((n) => n.id)
  const posizionati = nuovi.map((n) => {
    const proposto = automatico.nodi.find((p) => p.id === n.id)!
    if (n.tipo === 'utenze') {
      const dedicata = posizioneTerminale(n, superstiti, modello.archi, libreria)
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
  // Gli archi che si RIPESCANO vengono dal layout automatico, non dal modello: stessi id e stessa
  // identita', ma con le `t` dei segni gia' risolte e coi gomiti del ponte scritti. Presi dal
  // modello entrerebbero nel salvataggio con la valvola a meta' tubo (la `t: 0.5` di ripiego) e
  // con un by-pass collassato in una retta sovrapposta alla linea di processo — un disegno che
  // esiste ma che il by-pass non si vede.
  const archiProposti = automatico.archi
  const archiNuovi = archiProposti.filter(
    (a) =>
      !identitaSalvate.has(identitaArco(a)) &&
      (aggiunti.includes(a.da.nodo) || aggiunti.includes(a.a.nodo)) &&
      // La tubazione del terminale non passa da qui: la governa la regola qui sotto. Per la
      // strada generica basta che uno dei capi sia fra gli `aggiunti`, e aggiungendo uno stadio
      // alla catena di uno schema già salvato quel criterio ne creava una seconda (E1→UTENZE)
      // accanto a quella salvata (S1→UTENZE), entrambe convergenti sul codolo.
      a.a.nodo !== idTerminale
  )
  // Nodo esistente non basta più: se una taratura ha tolto l'ancora che l'arco cita, il capo
  // va riattaccato (o l'arco scartato, se non c'è dove) prima di restituire il layout — vedi
  // `capoRiattaccato`. `nodiPerId`, non `salvatiPerId`/`modelloPerId` sopra: quelle mappano
  // sui nodi PRIMA della riconciliazione, questa sui nodi DOPO (posizioni e taratura di adesso,
  // le sole con cui un capo riattaccato ha senso).
  const nodiPerId = new Map(nodi.map((n) => [n.id, n]))
  // Il conto degli archi buttati per mancanza di ancore compatibili si tiene QUI e non a valle
  // confrontando le lunghezze: fra `archiSalvati + archiNuovi` e il risultato ci sono anche il
  // filtro sui nodi assenti e l'aggiunta della tubazione del terminale, che scartati non sono.
  let archiScartati = 0
  const archi = [...archiSalvati, ...archiNuovi]
    .filter((a) => idNodi.has(a.da.nodo) && idNodi.has(a.a.nodo))
    .map((arco) => {
      const nodoDa = nodiPerId.get(arco.da.nodo)!
      const nodoA = nodiPerId.get(arco.a.nodo)!
      const capoDa = capoRiattaccato(arco.da, nodoDa, nodoA, arco.stile, libreria)
      const capoA = capoRiattaccato(arco.a, nodoA, nodoDa, arco.stile, libreria)
      if (!capoDa || !capoA) {
        archiScartati += 1
        return null
      }
      return capoDa === arco.da && capoA === arco.a ? arco : { ...arco, da: capoDa, a: capoA }
    })
    .filter((a): a is SchemaArco => a !== null)

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
    const proposto = archiProposti.find((a) => a.a.nodo === idTerminale && idNodi.has(a.da.nodo))
    if (proposto) archi.push(proposto)
  }

  // Invariante della catena, sullo stampo di quella del terminale qui sopra: **ogni nodo che il
  // modello raggiunge con una tubazione d'aria entrante deve averne ancora una** dopo la
  // riconciliazione; se l'ha persa, si riprende quella proposta.
  //
  // Il caso che ripara e' lo scioglimento di un by-pass. I due TEE cadono e con loro i cinque
  // archi che li toccavano, ma l'arco sostitutivo S1 → F1 non veniva ripescato: `archiNuovi` lo
  // prende solo se un capo e' fra i nodi AGGIUNTI, e sciogliendo un gruppo non si aggiunge
  // nulla. Il primo stadio restava scollegato su un disegno riaperto.
  //
  // Si legge dal MODELLO chi deve avere un ingresso, e non lo si decide per tipo: il primo
  // serbatoio e i compressori non ricevono aria per natura, e inventare loro una tubazione
  // sarebbe peggio del difetto che si ripara.
  //
  // Conseguenza accettata: un operatore che nell'editor stacca DELIBERATAMENTE uno stadio se lo
  // ritrova ricollegato alla riapertura. Le due situazioni sono indistinguibili da qui, e fra un
  // disegno con uno stadio a mezz'aria e uno ricollegato d'ufficio si sceglie il secondo — la
  // stessa scelta gia' fatta per il terminale.
  const conIngresso = (elenco: SchemaArco[], id: string) =>
    elenco.some((a) => a.stile !== 'condensa' && a.a.nodo === id)
  for (const nodo of nodi) {
    if (!conIngresso(modello.archi, nodo.id) || conIngresso(archi, nodo.id)) continue
    const proposto = archiProposti.find(
      (a) => a.stile !== 'condensa' && a.a.nodo === nodo.id && idNodi.has(a.da.nodo)
    )
    if (proposto) archi.push(proposto)
  }

  // I testi liberi sopravvivono sempre, senza confronto col modello: sono manuali per
  // definizione (nessun codice di scheda li produce, nessuna riga di scheda li nomina), quindi
  // stanno nella stessa categoria dei nodi di origine 'manuale' sopra — la scheda dati non li
  // conosce e non ha titolo per cancellarli o correggerli.
  const testi = salvato.testi ?? []

  // Il muro e' manuale per definizione (lo aggiunge il committente dalla barra), quindi sta
  // nella stessa categoria dei testi qui sopra: si ricostruisce dalla sola ascissa salvata, sui
  // nodi appena riconciliati (cosi' l'altezza segue le posizioni di adesso, non quelle salvate),
  // e non sparisce mai per un confronto con la scheda che non lo riguarda. Si legge
  // `salvato.muro?.x`, non una `muroX` che il chiamante vero (`layoutIniziale`) non passa mai:
  // vedi il commento sulla firma di questa funzione.
  const muro = salvato.muro ? muroDaAscissa(salvato.muro.x, nodi, libreria) : null

  return { layout: { nodi, archi, muro, testi }, aggiunti, aggiuntiDaScheda, rimossi, archiScartati }
}
