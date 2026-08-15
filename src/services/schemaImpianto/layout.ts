/**
 * Disposizione automatica dei nodi, in coordinate SVG (origine in alto a sinistra).
 *
 * La geometria ricalca gli schemi reali (`DOCUMENTAZIONE/relazione/*_RELAZIONE_TECNICA_*.pdf`):
 * compressori in riga in basso a sinistra, serbatoi sopra e a destra, catena di trattamento
 * aria (essiccatori/filtri) in riga verso destra, pozzo di raccolta condense in basso a
 * destra. Funzione pura: nessun DOM, testabile in Node.
 */
import { ordinaCatenaTrattamento } from './buildSchemaModel'
import { DIMENSIONI_NODO, INTERLINEA_TESTO, SPESSORE_MURO, TESTO_LIBERO, dimensioniDi } from './symbols'
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
 */
function inviluppoVerticale(nodi: SchemaNodoPosizionato[]): { yMin: number; yMax: number } | null {
  const rilevanti = nodi.filter((n) => n.tipo !== 'utenze')
  if (rilevanti.length === 0) return null
  return {
    yMin: Math.min(...rilevanti.map((n) => n.y)) - MARGINE_SUPERIORE / 2,
    yMax: Math.max(...rilevanti.map((n) => n.y + DIMENSIONI_NODO[n.tipo].altezza)) + MARGINE_SUPERIORE / 2,
  }
}

/**
 * Ascissa proposta per il muro di separazione: segue il bordo destro della sala compressori,
 * null se manca un'apparecchiatura da un lato. Il layout automatico non la usa — nasce sempre
 * senza muro — la chiama solo il pulsante «Muro» della barra dell'editor (`ascissaProposta`,
 * useMuro.ts). L'altezza viene da `inviluppoVerticale`, condivisa con `muroDaAscissa`.
 */
export function calcolaMuro(nodi: SchemaNodoPosizionato[]): SchemaMuroSeparazione | null {
  // Il terminale utenze porta `gruppo: 'LINEA_DISTRIBUZIONE'` — sta davvero a valle — ma non è
  // un'apparecchiatura da separare con un muro, è un raccordo (stesso motivo per cui
  // `ordinaCatenaTrattamento` e `pozzoCondense` lo ignorano, e per cui il Task 6 lo esclude da
  // `righeLista`). Un impianto con un solo compressore e un solo serbatoio in sala, senza altro
  // in linea, non ha muro nel disegno di riferimento del committente pur avendo il terminale
  // «Utenze aria»: contarlo qui produrrebbe un muro che quel riferimento smentisce.
  const inSala = nodi.filter((n) => n.gruppo === 'SALA_COMPRESSORI' && n.tipo !== 'utenze')
  const inLinea = nodi.filter((n) => n.gruppo === 'LINEA_DISTRIBUZIONE' && n.tipo !== 'utenze')
  if (inSala.length === 0 || inLinea.length === 0) return null

  const inviluppo = inviluppoVerticale([...inSala, ...inLinea])
  if (!inviluppo) return null

  return {
    x: Math.max(...inSala.map((n) => n.x + DIMENSIONI_NODO[n.tipo].larghezza)) + PASSO_ORIZZONTALE / 2,
    ...inviluppo,
  }
}

/**
 * Il muro dalla sola ascissa salvata. Dal Blocco D4 il muro e' un oggetto che il committente
 * aggiunge e sposta, ma la sua altezza continua ad adattarsi al disegno: si salva la sola `x`, e
 * l'estensione verticale si ricava qui a ogni ricostruzione. Salvare anche l'altezza sarebbe una
 * seconda fonte di verita', destinata a divergere al primo nodo spostato.
 */
export function muroDaAscissa(x: number, nodi: SchemaNodoPosizionato[]): SchemaMuroSeparazione | null {
  const inviluppo = inviluppoVerticale(nodi)
  return inviluppo ? { x, ...inviluppo } : null
}

/**
 * Dispone i nodi di una riga da sinistra a destra a partire da `xIniziale`, allineandoli
 * per centro verticale su `yCentro`. Ritorna i nodi posizionati e la x raggiunta.
 */
function disponiInRiga(
  nodi: SchemaNodo[],
  xIniziale: number,
  yCentro: number
): { posizionati: SchemaNodoPosizionato[]; xFinale: number } {
  let x = xIniziale
  const posizionati = nodi.map((nodo) => {
    const dim = DIMENSIONI_NODO[nodo.tipo]
    const collocato = posiziona(nodo, x, yCentro - dim.altezza / 2)
    x += dim.larghezza + PASSO_ORIZZONTALE
    return collocato
  })
  return { posizionati, xFinale: x }
}

export function layoutSchema(model: SchemaModel): SchemaLayout {
  const compressori = model.nodi.filter((n) => n.tipo === 'compressore')
  const serbatoi = model.nodi.filter((n) => n.tipo === 'serbatoio')
  // Il pozzo di raccolta condense sta nella corsia bassa: è la tanica, oppure il separatore
  // quando è lui a raccogliere (in quel caso resta fuori dalla catena di trattamento).
  const pozzo = pozzoCondense(model.nodi, model)
  const raccolta = pozzo ? [pozzo] : []
  const catena = ordinaCatenaTrattamento(model.nodi, pozzo)

  const altezzaCompressore = DIMENSIONI_NODO.compressore.altezza
  const altezzaSerbatoio = DIMENSIONI_NODO.serbatoio.altezza

  // I compressori stanno in basso a sinistra; i serbatoi, più alti, sono allineati in modo
  // che la loro base resti sulla stessa quota della base dei compressori.
  const yBase = MARGINE_SUPERIORE + altezzaSerbatoio
  const yCentroCompressori = yBase - altezzaCompressore / 2
  const yCentroSerbatoi = yBase - altezzaSerbatoio / 2

  const rigaCompressori = disponiInRiga(compressori, MARGINE, yCentroCompressori)
  const rigaSerbatoi = disponiInRiga(
    serbatoi,
    rigaCompressori.xFinale + PASSO_VERTICALE,
    yCentroSerbatoi
  )
  // La catena di trattamento sta a valle dei serbatoi, sulla stessa fascia orizzontale.
  const rigaCatena = disponiInRiga(catena, rigaSerbatoi.xFinale, yCentroSerbatoi)

  const yCondense = yBase + CORSIA_CONDENSE
  const rigaRaccolta = disponiInRiga(raccolta, Math.max(rigaCatena.xFinale, MARGINE), yCondense)

  // Il terminale utenze non sta in nessuna riga: si appoggia a destra di tutto ciò che lo
  // precede, con l'ancora (in fondo al codolo) proprio sulla fascia orizzontale dove corrono le
  // tubazioni di linea — così la tubazione che vi arriva entra dritta invece di fare due gomiti
  // per raggiungerlo. Il fondo del riquadro non è più a quota fissa da quando la scritta può
  // andare a capo (`dimensioniDi`, in `symbols/index.ts`, lo fa crescere con le righe): si
  // posiziona quindi da lì, non da `DIMENSIONI_NODO.utenze.altezza`, o con un'etichetta lunga
  // l'ancora scenderebbe sotto la fascia e la tubazione arriverebbe con un gomito.
  const utenze = model.nodi.filter((n) => n.tipo === 'utenze')
  const posizionatiUtenze = utenze.map((n) =>
    posiziona(n, rigaCatena.xFinale, yCentroSerbatoi - dimensioniDi(n).altezza)
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
export function corpoNodo(nodo: SchemaNodoPosizionato): {
  x: number
  y: number
  larghezza: number
  altezza: number
} {
  const dim = DIMENSIONI_NODO[nodo.tipo]

  if (nodo.tipo === 'serbatoio') {
    const orizzontale = nodo.orientamento === 'ORIZZONTALE'
    const w = orizzontale ? dim.larghezza : 84
    const h = orizzontale ? 84 : dim.altezza - 40
    return {
      x: nodo.x + (dim.larghezza - w) / 2,
      y: nodo.y + (orizzontale ? (dim.altezza - h) / 2 : 40),
      larghezza: w,
      altezza: h,
    }
  }

  if (nodo.tipo === 'essiccatore' || nodo.tipo === 'filtro' || nodo.tipo === 'separatore') {
    const semiL = dim.larghezza / 2 - 6
    const semiH = dim.altezza / 2 - 16
    return {
      x: nodo.x + dim.larghezza / 2 - semiL,
      y: nodo.y + dim.altezza / 2 - 6 - semiH,
      larghezza: semiL * 2,
      altezza: semiH * 2,
    }
  }

  if (nodo.tipo === 'tanica') {
    return { x: nodo.x + 6, y: nodo.y + 6, larghezza: dim.larghezza - 12, altezza: dim.altezza - 12 }
  }

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
 * Tiene conto anche del muro, spessore compreso (`SPESSORE_MURO`): finché nasceva da sé fra i
 * due gruppi restava sempre dentro l'inviluppo dei nodi, ma dal Blocco D4 il committente lo
 * trascina dove vuole, e un muro posato a destra di tutto il disegno finiva nel markup ma fuori
 * dal viewBox — visibile sulla tela dell'editor, assente nell'anteprima e nel .docx (revisione
 * finale, rilievo Importante).
 *
 * `layout.testi` legge in modo difensivo (`?? []`) benché `SchemaLayout.testi` sia obbligatorio a
 * livello di tipo (`types.ts`): il produttore che davvero lo dimenticava era `flowALayout`
 * (`conversioneFlow.ts`), corretto insieme a questo campo — non i test o i salvataggi pre-Blocco
 * C2, che passano già da `deserializzaLayout`/`riconcilia` e arrivano qui con `testi` normalizzato.
 * Il ripiego resta perché il tipo è una garanzia statica, non a runtime: un JSON grezzo non ancora
 * passato da `deserializzaLayout` (o un cast che elude il compilatore, come nei test di
 * `serializzazione` qui accanto) può ancora presentarsi senza il campo.
 */
export function dimensioniLayout(layout: SchemaLayout): { larghezza: number; altezza: number } {
  const testi = layout.testi ?? []
  if (layout.nodi.length === 0 && testi.length === 0 && !layout.muro) {
    return { larghezza: MARGINE * 2, altezza: MARGINE * 2 }
  }
  const ingombriTesti = testi.map(ingombroTesto)
  const maxX = Math.max(
    ...layout.nodi.map((n) => n.x + dimensioniDi(n).larghezza),
    ...ingombriTesti.map((i) => i.destra),
    ...(layout.muro ? [layout.muro.x + SPESSORE_MURO] : [])
  )
  const maxY = Math.max(
    ...layout.nodi.map((n) => n.y + dimensioniDi(n).altezza),
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
export function quotaCorsiaCondense(layout: SchemaLayout, altezzaDisegno: number): number {
  const pozzo = pozzoCondense(layout.nodi, layout)
  return pozzo ? corpoNodo(pozzo).y - 40 : altezzaDisegno - MARGINE / 2
}

/**
 * Le due quote che le rotte native impongono al disegno intero, in una chiamata sola.
 * Vivono qui e non in `renderSvg.ts` perché le usa anche l'editor, sullo stesso layout
 * ricostruito dallo stato react-flow (`flowALayout`): se ognuno le calcolasse a modo suo,
 * tela e documento tornerebbero a disegnare percorsi diversi.
 */
export function quoteInstradamento(layout: SchemaLayout): QuoteInstradamento {
  return {
    yCollettore: quotaCollettore(layout),
    yCorsiaCondense: quotaCorsiaCondense(layout, dimensioniLayout(layout).altezza),
  }
}
