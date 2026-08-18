/**
 * Disposizione automatica dei nodi, in coordinate SVG (origine in alto a sinistra).
 *
 * La geometria ricalca gli schemi reali (`DOCUMENTAZIONE/relazione/*_RELAZIONE_TECNICA_*.pdf`):
 * compressori in riga in basso a sinistra, serbatoi sopra e a destra, catena di trattamento
 * aria (essiccatori/filtri) in riga verso destra, pozzo di raccolta condense in basso a
 * destra. Funzione pura: nessun DOM, testabile in Node.
 */
import { ordinaCatenaTrattamento } from './buildSchemaModel'
import { risolviSegniAncorati } from './segniAncorati'
import type { Tarature } from './libreria'
import {
  DIMENSIONI_NODO,
  INTERLINEA_TESTO,
  MARGINE_VALVOLA_SERBATOIO,
  SPESSORE_MURO,
  TESTO_LIBERO,
  ancoraDi,
  dimensioniDi,
  riquadroDi,
} from './symbols'
import type { QuoteInstradamento } from './tratti'
import type {
  SchemaLayout,
  SchemaModel,
  SchemaMuroSeparazione,
  SchemaNodo,
  SchemaNodoPosizionato,
  SchemaTestoLibero,
} from './types'

/**
 * Vero se una tubazione d'aria tocca il nodo, in entrata o in uscita. E' il criterio con cui si
 * distingue un separatore che TRATTA l'aria di linea da uno che RACCOGLIE condensa. Si legge dagli
 * archi invece di ripetere qui la regola su `raccolta_condense`, che vive gia' in
 * `buildSchemaModel`.
 *
 * Fino al 18-08-2026 il criterio era «riceve solo condensa», che guarda gli archi ENTRANTI. Col
 * flag per apparecchiatura l'operatore puo' spegnere ogni scarico: un pozzo senza piu' archi
 * entranti smetteva di essere riconosciuto, e `catenaDagliArchi` lo raccoglieva fra gli orfani
 * trascinandolo dentro la catena di trattamento — un'apparecchiatura che salta dalla corsia bassa
 * alla linea di processo perche' e' stata tolta una spunta. Guardare l'aria invece della condensa
 * e' la stessa domanda posta dalla parte che non dipende dalle spunte.
 *
 * Il caso limite noto: un separatore di linea a cui l'operatore stacca a mano, nell'editor,
 * entrambe le tubazioni d'aria diventa un pozzo, e la corsia condense si riquota su di lui. E' un
 * disegno gia' incoerente di suo, e fra le due letture si sceglie quella che non dipende da una
 * spunta.
 */
export function toccatoDaAria(id: string, model: Pick<SchemaModel, 'archi'>): boolean {
  return model.archi.some((a) => a.stile !== 'condensa' && (a.da.nodo === id || a.a.nodo === id))
}

/**
 * Il nodo che fa da pozzo di raccolta condense. È una tanica, oppure il separatore quando è
 * lui a raccogliere: in entrambi i casi non è uno stadio della linea aria, e chi disegna deve
 * saperlo per non farne partire l'uscita verso le utenze.
 */
export function pozzoCondense<T extends SchemaNodo>(
  nodi: T[],
  archi: Pick<SchemaModel, 'archi'>
): T | null {
  return (
    nodi.find((n) => n.tipo === 'tanica' || (n.tipo === 'separatore' && !toccatoDaAria(n.id, archi))) ??
    null
  )
}

/**
 * Ingombri nominali per tipo, in unità SVG. Il render disegna dentro questi riquadri.
 * Ora nascono nel registro dei simboli (stessa geometria che disegna): riesportati qui
 * perché `renderSvg`, `SchemaNodeSymbol` e l'editor già importano `DIMENSIONI_NODO` da
 * `layout.ts` e non serve toccarli.
 */
export { DIMENSIONI_NODO }

const MARGINE = 40
/**
 * Spazio sopra le apparecchiature: ci passa il collettore di mandata, la quota su cui
 * confluiscono i montanti dei compressori (vedi `quotaCollettore` più sotto in questo file). Non
 * ci passa più nient'altro: il terminale utenze, che prima del 12-08-2026 era una freccia
 * disegnata qui sopra, oggi è un nodo e sta nella fascia delle tubazioni di linea.
 *
 * Esportata perché è anche il margine, sopra e sotto, con cui `calcolaMuro` allarga l'inviluppo
 * verticale dei nodi: il test che fissa quella relazione la importa invece di ripetere il numero.
 */
export const MARGINE_SUPERIORE = 110
const PASSO_ORIZZONTALE = 60
/**
 * Quanto la dorsale dei compressori passa sopra il corpo del serbatoio (`quotaCollettore`).
 * Un passo di griglia: la dorsale sfiora la capsula senza toccarla. Da guardare nel Blocco 4
 * insieme alle altre distanze — e' una delle misure che il committente ha corretto a mano sul
 * disegno del 18-08-2026.
 */
export const MARGINE_COLLETTORE = 10
/**
 * Quanto la dorsale passa sopra la cima dei COMPRESSORI. Piu' del margine sul serbatoio: qui il
 * montante deve ospitare la valvola (due passi di griglia sotto la dorsale) e sotto di essa un
 * tratto di flessibile che si veda. Conta solo quando i compressori sono piu' alti del corpo del
 * serbatoio — cioe' col serbatoio ORIZZONTALE; col verticale detta sempre il serbatoio.
 */
export const MARGINE_COLLETTORE_COMPRESSORI = 60
/** Distanza verticale fra la riga dei compressori e quella dei serbatoi. */
const PASSO_VERTICALE = 80
/** Corsia in basso riservata alla rete di linee condense e al pozzo di raccolta. */
const CORSIA_CONDENSE = 120
/**
 * Spazio fra l'ancora `dx` di uno stadio e l'ancora `sx` del successivo. **Zero**: il committente
 * vuole le ancore coincidenti — passo 100 invece dei 170 di prima (riquadro 110 piu'
 * `PASSO_ORIZZONTALE`), che e' la convenzione 3.
 *
 * Da guardare nel Blocco 4, non da decidere qui: i rombi portano codoli da 10 unita' che sporgono
 * FUORI dal riquadro (`simboloRombo`, symbols/index.ts), quindi a gioco 0 il codolo destro di ogni
 * stadio entra di 10 unita' nella punta del vicino. Se il disegno lo mostra, il valore giusto e'
 * 20: i codoli si toccano e formano il collegamento, che e' cio' che si vede nei due riferimenti.
 */
export const GIOCO_FRA_STADI = 0

function posiziona(nodo: SchemaNodo, x: number, y: number): SchemaNodoPosizionato {
  return { ...nodo, x, y }
}

/**
 * Inviluppo verticale delle apparecchiature che un muro separa, allargato sopra e sotto dello
 * stesso margine usato sopra le apparecchiature nel resto del disegno. Il terminale utenze non
 * conta: e' un raccordo, non qualcosa da separare (stesso motivo per cui `ordinaCatenaTrattamento`
 * e `pozzoCondense` lo ignorano). Uno solo per `calcolaMuro` e `muroDaAscissa`, o «cosa il muro
 * deve separare» tornerebbe ad avere due definizioni.
 *
 * `yMin` non scende mai sotto zero: la pagina comincia a `y=0` (`renderSvg`, viewBox), e il muro è
 * una decorazione che attraversa il disegno, non ciò che decide dove comincia la pagina. Senza
 * questo fermo, un'apparecchiatura a meno di `MARGINE_SUPERIORE / 2` dal bordo superiore (per
 * esempio trascinata a `y=20`, con un margine di 55) produceva un `yMin` negativo e la cima del
 * muro finiva tagliata fuori dal viewBox — a differenza del fondo (vedi il commento su
 * `dimensioniLayout` più sotto), qui non c'è una tabella sotto che assorba lo sforo: il `viewBox`
 * comincia davvero a zero, e nulla aggiunto più in basso rimedia a qualcosa che sta sopra il bordo
 * superiore. Fix condiviso apposta fra `calcolaMuro` e `muroDaAscissa` (revisione finale del
 * Blocco D4, dopo il rilievo Importante su `dimensioniLayout`): entrambe soffrivano lo stesso
 * difetto perché entrambe passano da qui.
 */
function inviluppoVerticale(
  nodi: SchemaNodoPosizionato[],
  libreria: Tarature = {}
): { yMin: number; yMax: number } | null {
  const rilevanti = nodi.filter((n) => n.tipo !== 'utenze')
  if (rilevanti.length === 0) return null
  return {
    yMin: Math.max(0, Math.min(...rilevanti.map((n) => n.y)) - MARGINE_SUPERIORE / 2),
    // `dimensioniDi`, non `DIMENSIONI_NODO[n.tipo]`: il serbatoio orizzontale ha un ingombro
    // proprio, diverso da quello indicizzato per tipo (Task 4, Blocco 3) — leggerlo da lì darebbe
    // al muro l'altezza sbagliata per un impianto con un serbatoio orizzontale al bordo.
    yMax: Math.max(...rilevanti.map((n) => n.y + dimensioniDi(n, libreria).altezza)) + MARGINE_SUPERIORE / 2,
  }
}

/**
 * Ascissa proposta per il muro di separazione: segue il bordo destro della sala compressori,
 * null se manca un'apparecchiatura da un lato. Il layout automatico non la usa — nasce sempre
 * senza muro — la chiama solo il pulsante «Muro» della barra dell'editor (`ascissaProposta`,
 * useMuro.ts). L'altezza viene da `inviluppoVerticale`, condivisa con `muroDaAscissa`.
 */
export function calcolaMuro(nodi: SchemaNodoPosizionato[], libreria: Tarature = {}): SchemaMuroSeparazione | null {
  // Il terminale utenze porta `gruppo: 'LINEA_DISTRIBUZIONE'` — sta davvero a valle — ma non è
  // un'apparecchiatura da separare con un muro, è un raccordo (stesso motivo per cui
  // `ordinaCatenaTrattamento` e `pozzoCondense` lo ignorano, e per cui il Task 6 lo esclude da
  // `righeLista`). Un impianto con un solo compressore e un solo serbatoio in sala, senza altro
  // in linea, non ha muro nel disegno di riferimento del committente pur avendo il terminale
  // «Utenze aria»: contarlo qui produrrebbe un muro che quel riferimento smentisce.
  const inSala = nodi.filter((n) => n.gruppo === 'SALA_COMPRESSORI' && n.tipo !== 'utenze')
  const inLinea = nodi.filter((n) => n.gruppo === 'LINEA_DISTRIBUZIONE' && n.tipo !== 'utenze')
  if (inSala.length === 0 || inLinea.length === 0) return null

  const inviluppo = inviluppoVerticale([...inSala, ...inLinea], libreria)
  if (!inviluppo) return null

  return {
    // `dimensioniDi`, stessa ragione di `inviluppoVerticale` qui sopra: il serbatoio orizzontale
    // in sala compressori ha un bordo destro diverso da quello che `DIMENSIONI_NODO['serbatoio']`
    // (sempre il verticale) gli attribuirebbe.
    x: Math.max(...inSala.map((n) => n.x + dimensioniDi(n, libreria).larghezza)) + PASSO_ORIZZONTALE / 2,
    ...inviluppo,
  }
}

/**
 * Il muro dalla sola ascissa salvata. Dal Blocco D4 il muro e' un oggetto che il committente
 * aggiunge e sposta, ma la sua altezza continua ad adattarsi al disegno: si salva la sola `x`, e
 * l'estensione verticale si ricava qui a ogni ricostruzione. Salvare anche l'altezza sarebbe una
 * seconda fonte di verita', destinata a divergere al primo nodo spostato.
 */
export function muroDaAscissa(
  x: number,
  nodi: SchemaNodoPosizionato[],
  libreria: Tarature = {}
): SchemaMuroSeparazione | null {
  const inviluppo = inviluppoVerticale(nodi, libreria)
  return inviluppo ? { x, ...inviluppo } : null
}

/**
 * Dispone i nodi di una riga da sinistra a destra a partire da `xIniziale`, allineati sul
 * riferimento verticale `quota`: per centro (`'centro'`, il default) o per base (`'basso'`).
 *
 * `'basso'` allinea la BASE di ciascun nodo a `quota`, letta dalla sua altezza vera
 * (`dimensioniDi`) — non dall'altezza di un tipo assunta uniforme per l'intera riga. Serve al
 * solo `rigaSerbatoi` (Task 4 fix round 1): un serbatoio orizzontale è alto meno di metà di uno
 * verticale, e centrarlo sulla stessa quota calcolata per il verticale (il difetto di prima)
 * portava la sua base a decine di unità sopra quella dei compressori — il commento su
 * `layoutSchema`, "i serbatoi... sono allineati in modo che la loro base resti sulla stessa
 * quota della base dei compressori", era vero solo per un serbatoio verticale. Gli altri
 * chiamanti (compressori, catena, raccolta) hanno un'altezza uniforme per tipo: per loro
 * centro e base producono la stessa x/y di prima, `'centro'` resta il default apposta per non
 * toccarli.
 */
function disponiInRiga(
  nodi: SchemaNodo[],
  xIniziale: number,
  quota: number,
  allineamento: 'centro' | 'basso' = 'centro',
  libreria: Tarature = {}
): { posizionati: SchemaNodoPosizionato[]; xFinale: number } {
  let x = xIniziale
  const posizionati = nodi.map((nodo) => {
    // `dimensioniDi`, non `DIMENSIONI_NODO[nodo.tipo]`: per tutti i tipi tranne il serbatoio
    // orizzontale coincidono (Task 4, Blocco 3), ma per lui `DIMENSIONI_NODO['serbatoio']`
    // resta sempre l'ingombro del verticale — leggerlo qui centrerebbe e spazierebbe il nodo
    // sbagliato, quello che l'auto-layout non disegna.
    const dim = dimensioniDi(nodo, libreria)
    const y = allineamento === 'basso' ? quota - dim.altezza : quota - dim.altezza / 2
    const collocato = posiziona(nodo, x, y)
    x += dim.larghezza + PASSO_ORIZZONTALE
    return collocato
  })
  return { posizionati, xFinale: x }
}

/**
 * La catena di trattamento disposta per ANCORE e non per riquadri: l'ancora `sx` di ogni stadio
 * cade sulla quota della linea, e l'avanzamento e' la distanza fra l'ancora `dx` di uno e la `sx`
 * del successivo. Sono le convenzioni 3 e 4 insieme — la stessa regola detta sull'asse x e
 * sull'asse y.
 *
 * Il ripiego sul riquadro (`dim.altezza / 2`, `dim.larghezza`) vale per un simbolo che non
 * dichiara quelle ancore: mai per i tre rombi, che le hanno tutte, ma una taratura permanente puo'
 * sostituire l'elenco delle ancore (`ancoreDi`) e nulla le impone di tenerle.
 */
function disponiCatenaPerAncore(
  nodi: SchemaNodo[],
  xIniziale: number,
  quotaLinea: number,
  libreria: Tarature = {}
): { posizionati: SchemaNodoPosizionato[]; xFinale: number } {
  let x = xIniziale
  const posizionati = nodi.map((nodo) => {
    const dim = dimensioniDi(nodo, libreria)
    const sx = ancoraDi(nodo, 'sx', libreria)
    const dx = ancoraDi(nodo, 'dx', libreria)
    const collocato = posiziona(nodo, x, quotaLinea - (sx?.y ?? dim.altezza / 2))
    x = collocato.x + (dx?.x ?? dim.larghezza) + GIOCO_FRA_STADI
    return collocato
  })
  // `xFinale` resta la regola di sempre — bordo destro dell'ultimo riquadro piu' il passo — e non
  // l'ascissa dell'ultima ancora: la usano il terminale utenze e la corsia condense, e stringerla
  // qui sposterebbe anche loro. La compattezza in larghezza e' il Blocco 4.
  const ultimo = posizionati[posizionati.length - 1]
  const xFinale = ultimo
    ? ultimo.x + dimensioniDi(ultimo, libreria).larghezza + PASSO_ORIZZONTALE
    : xIniziale
  return { posizionati, xFinale }
}

/**
 * Quota su cui corre la linea di processo: quella dell'ancora `dx` del serbatoio di testa
 * (convenzione 4). Fino al 18-08-2026 la catena era centrata sulla mezzeria dei serbatoi, 55 unita'
 * piu' in basso, e la linea nasceva con un gomito che nei disegni di riferimento non c'e' — che
 * l'operatore raddrizzava a mano su ogni pratica.
 *
 * Senza serbatoi si ripiega sulla quota di prima: un impianto di soli stadi non ha un'uscita a cui
 * allinearsi, e sollevare la linea al bordo del foglio sarebbe peggio che lasciarla dov'era.
 */
export function quotaLineaProcesso(
  serbatoi: SchemaNodoPosizionato[],
  ripiego: number,
  libreria: Tarature = {}
): number {
  const testa = serbatoi[0]
  if (!testa) return ripiego
  const dx = ancoraDi(testa, 'dx', libreria)
  return dx ? testa.y + dx.y : ripiego
}

/**
 * La sequenza della linea di processo, letta da CHI GLI ARCHI COLLEGANO e non ri-derivata per
 * rango di tipo. `ordinaCatenaTrattamento` non conosce le preferenze dell'operatore ne' le
 * giunzioni di un by-pass: dal 18-08-2026 il modello puo' collegare gli stadi in un ordine che
 * quella funzione non saprebbe riprodurre, e disporli con due regole diverse significa disegnare
 * le linee incrociate. Resta l'ordine di DEFAULT dentro `buildSchemaModel`, che e' il posto dove
 * un ordine va deciso; qui si legge quello deciso.
 *
 * Si parte dal serbatoio di testa e si seguono gli archi d'aria. Il `visto` non e' una cautela di
 * stile: un layout riaperto e ricollegato a mano nell'editor puo' contenere un ciclo, e senza si
 * girerebbe in tondo per sempre.
 *
 * Gli stadi che gli archi non raggiungono si appendono in coda nell'ordine di default: uno stadio
 * scollegato (l'operatore ha cancellato una tubazione) e' meglio disegnarlo in fondo che non
 * disegnarlo affatto.
 */
export function catenaDagliArchi(model: SchemaModel, pozzo: SchemaNodo | null): SchemaNodo[] {
  const perId = new Map(model.nodi.map((n) => [n.id, n]))
  const inLinea = (n: SchemaNodo): boolean =>
    n.id !== pozzo?.id &&
    (n.tipo === 'essiccatore' || n.tipo === 'filtro' || n.tipo === 'separatore' || n.tipo === 'giunzione')

  const successore = new Map<string, string>()
  for (const arco of model.archi) {
    // Solo l'aria: le condense corrono su una rete propria e non dicono nulla sull'ordine della
    // linea. Il primo vince — con due uscite dallo stesso nodo il disegno e' comunque ambiguo, e
    // sceglierne una in silenzio e' meglio che fermarsi.
    if (arco.stile === 'condensa') continue
    if (!successore.has(arco.da.nodo)) successore.set(arco.da.nodo, arco.a.nodo)
  }

  const serbatoioDiTesta = model.nodi.find((n) => n.tipo === 'serbatoio')
  const catena: SchemaNodo[] = []
  const visto = new Set<string>()
  let corrente = serbatoioDiTesta ? successore.get(serbatoioDiTesta.id) : undefined
  while (corrente && !visto.has(corrente)) {
    visto.add(corrente)
    const nodo = perId.get(corrente)
    if (nodo && inLinea(nodo)) catena.push(nodo)
    corrente = successore.get(corrente)
  }

  const presi = new Set(catena.map((n) => n.id))
  const orfani = ordinaCatenaTrattamento(model.nodi, pozzo).filter((n) => !presi.has(n.id))
  return [...catena, ...orfani]
}

export function layoutSchema(model: SchemaModel, libreria: Tarature = {}): SchemaLayout {
  const compressori = model.nodi.filter((n) => n.tipo === 'compressore')
  const serbatoi = model.nodi.filter((n) => n.tipo === 'serbatoio')
  // Il pozzo di raccolta condense sta nella corsia bassa: è la tanica, oppure il separatore
  // quando è lui a raccogliere (in quel caso resta fuori dalla catena di trattamento).
  const pozzo = pozzoCondense(model.nodi, model)
  const raccolta = pozzo ? [pozzo] : []
  const catena = catenaDagliArchi(model, pozzo)

  const altezzaCompressore = DIMENSIONI_NODO.compressore.altezza
  const altezzaSerbatoio = DIMENSIONI_NODO.serbatoio.altezza

  // I compressori stanno in basso a sinistra; i serbatoi sono allineati in modo che la base di
  // OGNUNO (non solo del tipo, letta con `dimensioniDi`: fix round 1 del Task 4) resti sulla
  // stessa quota della base dei compressori — `yBase`, allineamento 'basso' su `disponiInRiga`.
  const yBase = MARGINE_SUPERIORE + altezzaSerbatoio
  const yCentroCompressori = yBase - altezzaCompressore / 2
  const yCentroSerbatoi = yBase - altezzaSerbatoio / 2

  const rigaCompressori = disponiInRiga(compressori, MARGINE, yCentroCompressori, 'centro', libreria)
  const rigaSerbatoi = disponiInRiga(
    serbatoi,
    rigaCompressori.xFinale + PASSO_VERTICALE,
    yBase,
    'basso',
    libreria
  )
  // La catena di trattamento sta a valle dei serbatoi, sulla quota della loro USCITA — non piu'
  // sulla loro mezzeria (`yCentroSerbatoi`, che resta il ripiego quando serbatoi non ce ne sono).
  const quotaLinea = quotaLineaProcesso(rigaSerbatoi.posizionati, yCentroSerbatoi, libreria)
  const rigaCatena = disponiCatenaPerAncore(catena, rigaSerbatoi.xFinale, quotaLinea, libreria)

  const yCondense = yBase + CORSIA_CONDENSE
  const rigaRaccolta = disponiInRiga(raccolta, Math.max(rigaCatena.xFinale, MARGINE), yCondense, 'centro', libreria)

  // Il terminale utenze non sta in nessuna riga: si appoggia a destra di tutto ciò che lo
  // precede, con l'ancora (in fondo al codolo) proprio sulla fascia orizzontale dove corrono le
  // tubazioni di linea — così la tubazione che vi arriva entra dritta invece di fare due gomiti
  // per raggiungerlo. Il fondo del riquadro non è più a quota fissa da quando la scritta può
  // andare a capo (`dimensioniDi`, in `symbols/index.ts`, lo fa crescere con le righe): si
  // posiziona quindi da lì, non da `DIMENSIONI_NODO.utenze.altezza`, o con un'etichetta lunga
  // l'ancora scenderebbe sotto la fascia e la tubazione arriverebbe con un gomito.
  const utenze = model.nodi.filter((n) => n.tipo === 'utenze')
  const posizionatiUtenze = utenze.map((n) =>
    posiziona(n, rigaCatena.xFinale, quotaLinea - dimensioniDi(n, libreria).altezza)
  )

  const nodi = [
    ...rigaCompressori.posizionati,
    ...rigaSerbatoi.posizionati,
    ...rigaCatena.posizionati,
    ...rigaRaccolta.posizionati,
    ...posizionatiUtenze,
  ]

  // `testi` è sempre presente, mai assente: `deserializzaLayout` e `riconcilia` (persistenza.ts)
  // normalizzano allo stesso modo un layout riletto o riconciliato, e l'auto-layout non fa
  // eccezione. Da `SchemaLayout.testi` obbligatorio (types.ts) in poi non è più solo una
  // convenzione tenuta da questa funzione: `tsc` segnala chiunque costruisca un `SchemaLayout`
  // senza — è così che si è scoperto che `flowALayout` (`conversioneFlow.ts`) lo dimenticava,
  // un percorso di produzione (la conferma nell'editor) che avrebbe perso in silenzio le
  // annotazioni di un disegno riaperto ora che l'editor permette di posarne.
  //
  // Dal Blocco D4 il muro e' un oggetto del committente, non un derivato: nasce solo quando lo
  // aggiunge dalla barra.
  const layout: SchemaLayout = { nodi, archi: model.archi, muro: null, testi: [] }

  // Ultimo passo, non uno dei primi: gli ancoraggi si risolvono sulla polilinea VERA, che esiste
  // solo dopo che ogni nodo ha la sua posizione. Da qui in poi nessun segno porta piu'
  // un'istruzione di ancoraggio — contratto di sola andata, vedi `segniAncorati.ts`.
  return risolviSegniAncorati(layout, quoteInstradamento(layout, libreria), libreria)
}

/**
 * Riquadro del corpo effettivamente disegnato, che nella maggior parte dei simboli è più
 * piccolo del riquadro di ingombro (che comprende etichette, valvole di sicurezza sopra e
 * valvola di scarico sotto). Le tubazioni si attaccano a questo, non all'ingombro, o
 * resterebbero staccate dal simbolo.
 */
export function corpoNodo(
  nodo: SchemaNodoPosizionato,
  libreria: Tarature = {}
): {
  x: number
  y: number
  larghezza: number
  altezza: number
} {
  // `dimensioniDi`, non `DIMENSIONI_NODO[nodo.tipo]` né `definizioneDi(...).dimensioni`: è la
  // sola delle tre che riflette una taratura (attraverso l'inviluppo, symbols/index.ts). Senza,
  // il pozzo di raccolta condense tarato — tanica o separatore, sono i due tipi che
  // `pozzoCondense` può restituire — lascerebbe `quotaCorsiaCondense` leggere l'altezza del
  // registro invariata, e l'intera corsia condense del documento correrebbe alla quota
  // sbagliata (fix round 1, Task 7).
  const dim = dimensioniDi(nodo, libreria)

  if (nodo.tipo === 'serbatoio') {
    // Il riquadro proprio del nodo (verticale o orizzontale, Task 4), non l'ingombro indicizzato
    // per tipo: quello resta sempre il verticale. La stessa geometria di `simboloSerbatoio`
    // (symbols/index.ts): il corpo riempie il riquadro in larghezza, con `MARGINE_VALVOLA_SERBATOIO`
    // di spazio sopra per la valvola di sicurezza — una sola formula per i due orientamenti, non
    // più un centraggio diverso e una misura fissa (84) indipendente dal riquadro dichiarato.
    return {
      x: nodo.x,
      y: nodo.y + MARGINE_VALVOLA_SERBATOIO,
      larghezza: dim.larghezza,
      altezza: dim.altezza - MARGINE_VALVOLA_SERBATOIO,
    }
  }

  if (nodo.tipo === 'essiccatore' || nodo.tipo === 'filtro' || nodo.tipo === 'separatore') {
    // Stesso rombo di `simboloRombo` (symbols/index.ts): `cx=cy=semiL = larghezza/2-5`,
    // `semiH = altezza/2-15`. Duplicato qui, non importato, perché quella funzione disegna e
    // questa misura — la stessa ragione per cui le altre variabili di questo file leggono
    // `dimensioniDi` invece del registro (fix round 1, Task 8, Blocco 3: prima duplicava la
    // vecchia geometria del rombo, -6/-16, invece di quella vera — lo stesso difetto trovato
    // in `ANCORE_ROMBO` e `simboloSeparatore`, qui una terza volta). Il riquadro del corpo è il
    // bounding box dei quattro vertici (dove le tubazioni si attaccano davvero), non il rombo.
    const cx = dim.larghezza / 2 - 5
    const cy = dim.altezza / 2 - 5
    const semiL = dim.larghezza / 2 - 5
    const semiH = dim.altezza / 2 - 15
    return {
      x: nodo.x + cx - semiL,
      y: nodo.y + cy - semiH,
      larghezza: semiL * 2,
      altezza: semiH * 2,
    }
  }

  // La tanica non ha più un caso a sé (fix round 1, Task 4): il rettangolo disegnato è il
  // riquadro stesso, non più rientrato di 6 unità — coincide col ramo generico qui sotto.
  return { x: nodo.x, y: nodo.y, larghezza: dim.larghezza, altezza: dim.altezza }
}

/**
 * Ingombro stimato di un'annotazione libera, con la stessa approssimazione già usata per la
 * scritta del terminale utenze (`dimensioniDi`, in `symbols/index.ts`): la larghezza sulla riga
 * più lunga, un carattere largo in media `TESTO_LIBERO.larghezzaCarattere` volte il corpo;
 * l'altezza sul numero di righe, con l'interlinea del blocco di testo. La costante del carattere
 * si legge da `TESTO_LIBERO` — la stessa che usa `dimensioniDi` per il terminale — apposta: due
 * `0.5` scritti a mano in due file diversi potrebbero divergere in silenzio se uno dei due
 * venisse ritoccato senza l'altro. Non è tipografia vera — misurare i glifi richiederebbe un DOM
 * che queste funzioni non hanno — serve solo a decidere quanto allargare la tela.
 *
 * Esportata perché la usa anche l'editor: un'annotazione nuova nasce sotto tutto il disegno
 * (`piedeDelDisegno` in SchemaEditor.tsx), e «sotto» comprende le annotazioni già posate, o due
 * scritte create di seguito finirebbero esattamente l'una sull'altra.
 */
export function ingombroTesto(testo: SchemaTestoLibero): { destra: number; basso: number } {
  const righe = testo.contenuto.split('\n')
  const piuLunga = Math.max(...righe.map((r) => r.length))
  return {
    destra: testo.x + piuLunga * TESTO_LIBERO.dimensione * TESTO_LIBERO.larghezzaCarattere,
    basso: testo.y + (righe.length - 1) * TESTO_LIBERO.dimensione * INTERLINEA_TESTO,
  }
}

/**
 * Bordo sinistro e bordo destro del disegno, in coordinate della tela. `dimensioniLayout` ne
 * deriva la propria larghezza, `renderSvg` ne ricava il centro su cui posare nota e tabella, e la
 * posa dei nuovi oggetti (`sopraIlBordoSinistro`, posaNuoviOggetti.ts) ne legge il bordo destro:
 * un punto di verità solo, perché due percorsi paralleli sullo stesso ingombro divergerebbero al
 * primo ritocco a uno dei due.
 *
 * Gli ingredienti sono quelli che `dimensioniLayout` già usava, e le ragioni per cui li sceglie
 * sono nel suo commento qui sotto: `riquadroDi` per i nodi, `ingombroTesto` per le annotazioni, e
 * il muro col suo spessore.
 */
export function estensioneOrizzontale(
  nodi: SchemaNodoPosizionato[],
  testi: SchemaTestoLibero[],
  muro: SchemaMuroSeparazione | null,
  libreria: Tarature = {}
): { sinistra: number; destra: number } {
  if (nodi.length === 0 && testi.length === 0 && !muro) {
    return { sinistra: MARGINE, destra: MARGINE }
  }
  const riquadri = nodi.map((n) => ({ nodo: n, riquadro: riquadroDi(n, libreria) }))
  const sinistra = Math.min(
    ...riquadri.map(({ nodo, riquadro }) => nodo.x + riquadro.x),
    ...testi.map((t) => t.x),
    ...(muro ? [muro.x] : [])
  )
  const destra = Math.max(
    ...riquadri.map(({ nodo, riquadro }) => nodo.x + riquadro.x + riquadro.larghezza),
    ...testi.map((t) => ingombroTesto(t).destra),
    ...(muro ? [muro.x + SPESSORE_MURO] : [])
  )
  return { sinistra, destra }
}

/**
 * Riquadro complessivo del disegno, usato da `renderSvg` per la viewBox. Legge l'ingombro dei
 * nodi con `dimensioniDi` e non da `DIMENSIONI_NODO`: la scritta del terminale utenze è libera, e
 * con la larghezza fissa del registro una scritta lunga sporgerebbe oltre il bordo destro della
 * tela e finirebbe tagliata nel PNG. Tiene conto anche dei testi liberi, per lo stesso motivo:
 * un'annotazione trascinata oltre l'ultima apparecchiatura non deve finire tagliata nel PNG.
 *
 * Tiene conto anche del muro sull'asse orizzontale, spessore compreso (`SPESSORE_MURO`): finché
 * nasceva da sé fra i due gruppi restava sempre dentro l'inviluppo dei nodi, ma dal Blocco D4 il
 * committente lo trascina dove vuole, e un muro posato a destra di tutto il disegno finiva nel
 * markup ma fuori dal viewBox — visibile sulla tela dell'editor, assente nell'anteprima e nel
 * .docx (revisione finale, rilievo Importante).
 *
 * Sull'asse verticale il fondo del muro NON è fra i candidati di `maxY`, di proposito: sarebbe il
 * gemello del fix sopra (`inviluppoVerticale` allarga il muro di `MARGINE_SUPERIORE / 2`, 55,
 * mentre qui la pagina si allarga di solo `MARGINE`, 40), ma qui il gemello è stato provato e
 * scartato in revisione finale (secondo rilievo). Chi consuma un `renderSvg` vero non vede mai
 * questo scarto: `renderSvg` disegna sempre la tabella "Lista apparecchiature" sotto il disegno
 * (un muro esiste solo se c'è almeno un'apparecchiatura per gruppo, quindi la tabella ha sempre
 * almeno 2 righe, ≥182 unità di margine) — più del disavanzo massimo possibile fra il fondo del
 * muro e questo `maxY` (al più `MARGINE_SUPERIORE/2 − MARGINE` = 15 unità, perché l'insieme di nodi
 * che allarga il muro è sempre un sottoinsieme di quello che allarga `maxY` qui). Includerlo
 * comunque avrebbe due costi reali per un difetto che non si manifesta mai: 55 unità di spazio
 * vuoto in più fra disegno e tabella in OGNI schema con muro (non solo quelli al limite), e uno
 * spostamento delle quote di instradamento — `quoteInstradamento` legge proprio questa `altezza` —
 * cioè delle tubazioni, sul documento consegnato. La prova che il fondo resta comunque dentro
 * l'SVG vero è un test su `renderSvg`, non su questa funzione (`layout.test.ts`).
 *
 * `layout.testi` legge in modo difensivo (`?? []`) benché `SchemaLayout.testi` sia obbligatorio a
 * livello di tipo (`types.ts`): il produttore che davvero lo dimenticava era `flowALayout`
 * (`conversioneFlow.ts`), corretto insieme a questo campo — non i test o i salvataggi pre-Blocco
 * C2, che passano già da `deserializzaLayout`/`riconcilia` e arrivano qui con `testi` normalizzato.
 * Il ripiego resta perché il tipo è una garanzia statica, non a runtime: un JSON grezzo non ancora
 * passato da `deserializzaLayout` (o un cast che elude il compilatore, come nei test di
 * `serializzazione` qui accanto) può ancora presentarsi senza il campo.
 */
export function dimensioniLayout(
  layout: SchemaLayout,
  libreria: Tarature = {}
): { larghezza: number; altezza: number } {
  const testi = layout.testi ?? []
  if (layout.nodi.length === 0 && testi.length === 0 && !layout.muro) {
    return { larghezza: MARGINE * 2, altezza: MARGINE * 2 }
  }
  const ingombriTesti = testi.map(ingombroTesto)
  // `riquadroDi`, non `dimensioniDi`: il bordo destro di un nodo è il suo angolo PIÙ la larghezza.
  // Coincidono per ogni simbolo non tarato (angolo a zero), ma una taratura che porta la sagoma
  // all'indietro dei pallini fa cominciare il riquadro a coordinate negative, e sommare la sola
  // larghezza dichiarerebbe un bordo destro più a destra di dove il disegno arriva davvero — cioè
  // margine bianco in più nel PNG, e le quote d'instradamento (`quoteInstradamento` legge questa
  // altezza) spostate.
  const riquadri = layout.nodi.map((n) => ({ nodo: n, riquadro: riquadroDi(n, libreria) }))
  const destra = estensioneOrizzontale(layout.nodi, testi, layout.muro, libreria).destra
  const maxY = Math.max(
    ...riquadri.map(({ nodo, riquadro }) => nodo.y + riquadro.y + riquadro.altezza),
    ...ingombriTesti.map((i) => i.basso)
  )
  return { larghezza: destra + MARGINE, altezza: maxY + MARGINE }
}

/**
 * Quota del collettore di mandata: appena sopra il CORPO del serbatoio, cosi' i montanti dei
 * compressori vi confluiscono senza attraversare nulla e senza salire piu' del necessario.
 *
 * Il corpo e non il riquadro (correzione del committente sul disegno, 18-08-2026). Il riquadro del
 * serbatoio comprende `MARGINE_VALVOLA_SERBATOIO` (40 unita') di spazio sopra la capsula per la
 * valvola di sicurezza: misurando da li' il collettore correva 60 unita' piu' in alto del
 * necessario, e i montanti dei compressori nascevano lunghi il doppio di quelli del disegno vero.
 * Ora la dorsale sfiora la cima della capsula, passando sotto la valvola.
 *
 * `corpoNodo` e non `n.y + MARGINE_VALVOLA_SERBATOIO`: la stessa geometria che disegna, e l'unica
 * che vale anche per il serbatoio orizzontale e per un simbolo tarato.
 */
export function quotaCollettore(layout: SchemaLayout, libreria: Tarature = {}): number {
  const serbatoi = layout.nodi.filter((n) => n.tipo === 'serbatoio')
  const compressori = layout.nodi.filter((n) => n.tipo === 'compressore')
  // I due vincoli, entrambi obbligatori: la dorsale passa sopra il corpo dei serbatoi (per non
  // entrare nella capsula) e sopra i compressori (per non attraversarli, e perche' i loro montanti
  // devono SALIRE). Vince il piu' alto dei due — cioe' la quota minore.
  //
  // Il caso che lo impone e' il serbatoio ORIZZONTALE, il cui corpo sta piu' in basso della cima
  // dei compressori: guardando il solo serbatoio, la dorsale sarebbe finita sotto di loro, il
  // montante si sarebbe accorciato a 10 unita' e la valvola ancorata sarebbe collassata sul capo
  // del tubo (`t: 0`).
  // I due margini sono diversi perche' i due vincoli lo sono: sopra il serbatoio la dorsale deve
  // solo non toccare la capsula, sopra il compressore deve ospitare il montante — la valvola due
  // passi sotto la dorsale piu' un tratto di flessibile che si veda.
  const cime = [
    ...serbatoi.map((n) => corpoNodo(n, libreria).y - MARGINE_COLLETTORE),
    ...compressori.map((n) => n.y - MARGINE_COLLETTORE_COMPRESSORI),
  ]
  const riferimento = cime.length > 0 ? cime : layout.nodi.map((n) => n.y - MARGINE_COLLETTORE)
  if (riferimento.length === 0) return MARGINE
  return Math.min(...riferimento)
}

/** Quota della corsia comune delle linee condense: appena sopra il pozzo di raccolta, così le linee vi scendono dentro dall'alto. */
export function quotaCorsiaCondense(layout: SchemaLayout, altezzaDisegno: number, libreria: Tarature = {}): number {
  const pozzo = pozzoCondense(layout.nodi, layout)
  return pozzo ? corpoNodo(pozzo, libreria).y - 40 : altezzaDisegno - MARGINE / 2
}

/**
 * Le due quote che le rotte native impongono al disegno intero, in una chiamata sola.
 * Vivono qui e non in `renderSvg.ts` perché le usa anche l'editor, sullo stesso layout
 * ricostruito dallo stato react-flow (`flowALayout`): se ognuno le calcolasse a modo suo,
 * tela e documento tornerebbero a disegnare percorsi diversi.
 */
export function quoteInstradamento(layout: SchemaLayout, libreria: Tarature = {}): QuoteInstradamento {
  return {
    yCollettore: quotaCollettore(layout, libreria),
    yCorsiaCondense: quotaCorsiaCondense(layout, dimensioniLayout(layout, libreria).altezza, libreria),
  }
}
