/**
 * Disposizione automatica dei nodi, in coordinate SVG (origine in alto a sinistra).
 *
 * La geometria ricalca gli schemi reali (`DOCUMENTAZIONE/relazione/*_RELAZIONE_TECNICA_*.pdf`):
 * compressori in riga in basso a sinistra, serbatoi sopra e a destra, catena di trattamento
 * aria (essiccatori/filtri) in riga verso destra, pozzo di raccolta condense in basso a
 * destra. Funzione pura: nessun DOM, testabile in Node.
 */
import { ordinaCatenaTrattamento } from './buildSchemaModel'
import type { Tarature } from './libreria'
import {
  DIMENSIONI_NODO,
  INTERLINEA_TESTO,
  MARGINE_VALVOLA_SERBATOIO,
  SPESSORE_MURO,
  TESTO_LIBERO,
  dimensioniDi,
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
 * Vero se il nodo riceve esclusivamente linee condense: è il segno che fa da pozzo di
 * raccolta e non da stadio di trattamento dell'aria. Si legge dagli archi invece di
 * ripetere qui la regola su `raccolta_condense`, che vive già in `buildSchemaModel`.
 */
export function riceveSoloCondensa(id: string, model: Pick<SchemaModel, 'archi'>): boolean {
  const entranti = model.archi.filter((a) => a.a.nodo === id)
  return entranti.length > 0 && entranti.every((a) => a.stile === 'condensa')
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
    nodi.find((n) => n.tipo === 'tanica' || (n.tipo === 'separatore' && riceveSoloCondensa(n.id, archi))) ??
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
/** Distanza verticale fra la riga dei compressori e quella dei serbatoi. */
const PASSO_VERTICALE = 80
/** Corsia in basso riservata alla rete di linee condense e al pozzo di raccolta. */
const CORSIA_CONDENSE = 120

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

export function layoutSchema(model: SchemaModel, libreria: Tarature = {}): SchemaLayout {
  const compressori = model.nodi.filter((n) => n.tipo === 'compressore')
  const serbatoi = model.nodi.filter((n) => n.tipo === 'serbatoio')
  // Il pozzo di raccolta condense sta nella corsia bassa: è la tanica, oppure il separatore
  // quando è lui a raccogliere (in quel caso resta fuori dalla catena di trattamento).
  const pozzo = pozzoCondense(model.nodi, model)
  const raccolta = pozzo ? [pozzo] : []
  const catena = ordinaCatenaTrattamento(model.nodi, pozzo)

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
  // La catena di trattamento sta a valle dei serbatoi, sulla stessa fascia orizzontale.
  const rigaCatena = disponiInRiga(catena, rigaSerbatoi.xFinale, yCentroSerbatoi, 'centro', libreria)

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
    posiziona(n, rigaCatena.xFinale, yCentroSerbatoi - dimensioniDi(n, libreria).altezza)
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
  return { nodi, archi: model.archi, muro: null, testi: [] }
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
  const maxX = Math.max(
    ...layout.nodi.map((n) => n.x + dimensioniDi(n, libreria).larghezza),
    ...ingombriTesti.map((i) => i.destra),
    ...(layout.muro ? [layout.muro.x + SPESSORE_MURO] : [])
  )
  const maxY = Math.max(
    ...layout.nodi.map((n) => n.y + dimensioniDi(n, libreria).altezza),
    ...ingombriTesti.map((i) => i.basso)
  )
  return { larghezza: maxX + MARGINE, altezza: maxY + MARGINE }
}

/** Quota del collettore di mandata: appena sopra la fascia dei serbatoi, così i montanti dei compressori vi confluiscono senza attraversare nulla. */
export function quotaCollettore(layout: SchemaLayout): number {
  const serbatoi = layout.nodi.filter((n) => n.tipo === 'serbatoio')
  const riferimento = serbatoi.length > 0 ? serbatoi : layout.nodi
  if (riferimento.length === 0) return MARGINE
  return Math.min(...riferimento.map((n) => n.y)) - MARGINE / 2
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
    yCollettore: quotaCollettore(layout),
    yCorsiaCondense: quotaCorsiaCondense(layout, dimensioniLayout(layout, libreria).altezza, libreria),
  }
}
