/**
 * Disposizione automatica dei nodi, in coordinate SVG (origine in alto a sinistra).
 *
 * La geometria ricalca gli schemi reali (`DOCUMENTAZIONE/relazione/*_RELAZIONE_TECNICA_*.pdf`):
 * compressori in riga in basso a sinistra, serbatoi sopra e a destra, catena di trattamento
 * aria (essiccatori/filtri) in riga verso destra, pozzo di raccolta condense in basso a
 * destra. Funzione pura: nessun DOM, testabile in Node.
 */
import { assegnaCorsie, capoDiValleDi, eCapoDiMonte } from './bypass'
import { risolviPonti, risolviSegniAncorati } from './segniAncorati'
import type { Tarature } from './libreria'
import {
  DIMENSIONI_NODO,
  INTERLINEA_TESTO,
  MARGINE_SCARICO_SERBATOIO,
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
 * Quanto la dorsale passerebbe sopra il corpo del serbatoio. **Serve solo al RIPIEGO**, dal
 * 18-08-2026: la dorsale la quotano i compressori, e questo numero conta soltanto in un impianto
 * che compressori non ne ha (dove una dorsale non c'e', ma `quotaCollettore` deve comunque tornare
 * un numero). Vedi `quotaCollettore` piu' sotto per il perche' il vincolo del serbatoio e' caduto.
 *
 * Un passo di griglia: la dorsale sfiora la capsula senza toccarla.
 */
export const MARGINE_COLLETTORE = 10
/**
 * Quanto la dorsale passa sopra la cima dei COMPRESSORI. Piu' del margine sul serbatoio: qui il
 * montante deve ospitare la valvola (due passi di griglia sotto la dorsale) e sotto di essa un
 * tratto di flessibile che si veda.
 *
 * **Ottanta unita', misurate su `no bypass.png`**: la dorsale sta a y=135 e la cima dei compressori
 * a y=181, 46 px che alla scala di quell'immagine (0,581 px/unita') fanno 79. Restano cosi' 60
 * unita' di flessibile sotto la valvola, cioe' le quattro ondulazioni che si contano sul
 * riferimento; a 60 ne restavano 40, e se ne vedevano due.
 *
 * **E' l'unica misura che quota la dorsale**, dal 18-08-2026: il vincolo del serbatoio e' caduto
 * (vedi `quotaCollettore` piu' sotto). Prima contava solo col serbatoio ORIZZONTALE, perche' col
 * verticale vinceva sempre il serbatoio e i montanti nascevano lunghi il doppio.
 */
export const MARGINE_COLLETTORE_COMPRESSORI = 80
/**
 * Spazio fra due compressori affiancati. Due passi di griglia: misurato su `no bypass.png`, fra il
 * bordo destro di C1 e quello sinistro di C2 corrono 11,4 px, cioe' ~20 unita' alla scala di
 * quell'immagine (0,581 px/unita', letta dal reticolo da 10 unita' della tela). E' la convenzione
 * 8, «spazi ridotti allo stretto indispensabile»: prima valeva `PASSO_ORIZZONTALE`, 60.
 *
 * Suo e non `PASSO_ORIZZONTALE` perche' quello e' condiviso con `calcolaMuro` e con la corsia di
 * raccolta, che il riferimento non smentisce.
 */
export const PASSO_COMPRESSORI = 20

/**
 * Spazio fra due serbatoi affiancati. Lo stesso dei compressori: i due riferimenti portano un
 * serbatoio solo, quindi questa misura NON e' stata letta su un disegno — e' la scelta simmetrica,
 * l'unica difendibile senza un dato. Se il committente un giorno ne fornisce uno con due serbatoi,
 * si taglia qui senza toccare altro.
 */
export const PASSO_SERBATOI = 20

/**
 * Stacco fra il bordo destro dell'ultimo compressore e quello sinistro del primo serbatoio.
 * Misurato ~90 su `no bypass.png` (53 px).
 *
 * Prima questo stacco non esisteva come nome: valeva `PASSO_ORIZZONTALE + PASSO_VERTICALE` = 140,
 * dove il secondo era dichiarato «distanza VERTICALE fra la riga dei compressori e quella dei
 * serbatoi» e veniva invece sommato all'ascissa. `PASSO_VERTICALE` e' stato tolto per questo: non
 * descriveva cio' che faceva.
 */
export const STACCO_COMPRESSORI_SERBATOI = 90

/**
 * Stacco fra il bordo destro dell'ultimo serbatoio e l'ancora `sx` del primo stadio. Misurato ~73
 * su `no bypass.png` (42,5 px). **Qui si allarga**, dai 60 di `PASSO_ORIZZONTALE`: su questo
 * tratto sta la valvola di riserva all'uscita del serbatoio (convenzione 6), e a 60 le stava
 * stretta. 70 e' la misura arrotondata al passo di griglia.
 */
export const STACCO_SERBATOI_LINEA = 70

/** Corsia in basso riservata alla rete di linee condense e al pozzo di raccolta. */
const CORSIA_CONDENSE = 120
/**
 * Spazio fra l'ancora `dx` di uno stadio e l'ancora `sx` del successivo: **venti unita'**, due
 * passi di griglia. Il passo fra stadi vale quindi 120 (ancore a 100 piu' il gioco), contro i 170
 * di prima del Blocco 2 (riquadro 110 piu' `PASSO_ORIZZONTALE`), che e' la convenzione 3.
 *
 * Deciso dal committente il 18-08-2026, e confermato dalla misura sul riferimento: su
 * `no bypass.png` i centri dei quattro rombi cadono a 331/401/470/540 px, un passo di 69,7 px che
 * alla scala di quell'immagine (0,581 px/unita', letta dal reticolo da 10 unita' della tela) fa
 * **120,0 unita'**.
 *
 * Non e' un valore estetico ma la condizione perche' il collegamento fra due stadi si veda:
 * `simboloRombo` (symbols/index.ts) disegna un codolo di 10 unita' che sporge FUORI da ciascuna
 * delle due punte. A gioco 20 i due codoli si toccano e formano il tratto di tubo; a gioco 0 il
 * codolo sinistro del secondo rombo entrava di 10 unita' nel corpo del primo, e i due simboli
 * sembravano fusi.
 */
export const GIOCO_FRA_STADI = 20

/**
 * Spazio fra l'ancora di una giunzione di by-pass e quella dello stadio vicino, di qua e di la'.
 * Non e' `GIOCO_FRA_STADI`: le quattro ancore della giunzione COINCIDONO nel suo centro
 * (symbols/index.ts), quindi a gioco zero il TEE finirebbe esattamente sulla punta del rombo
 * accanto, e il pallino sparirebbe dentro il simbolo. **E' un pavimento, non un'estetica**: sotto
 * le 10 unita' del codolo — che `simboloRombo` fa sporgere fuori da ciascuna punta — il pallino
 * entra nel tratto di attacco, e sotto lo zero nel corpo del rombo.
 *
 * **Venti unita', misurate su `si bypass.png`** (Blocco 5, scala 0,5575 px/unita' letta dal
 * reticolo da 10 unita' della tela): il centro del TEE di monte sta a x=291,0 — le sue due prese
 * laterali cadono a 285 e 297, cioe' a ±10 unita' — e l'ancora `sx` del primo stadio scavalcato a
 * x=302,5, che fanno 11,5 px, cioe' **20,6 unita'**. Al capo di valle la stessa distanza misura 28.
 *
 * Attenzione a cosa si misura: a x≈293 non c'e' la punta del rombo ma il PALLINO della maniglia,
 * che l'editor disegna sull'ancora, e prenderlo per la punta fa leggere 3 unita' invece di 20. La
 * punta vera e' il vertice sinistro del rombo (`ANCORE_ROMBO`, symbols/index.ts), 10 unita' oltre
 * il codolo che gli sporge davanti.
 *
 * Dal Blocco 5 la stessa misura vale in due situazioni diverse: al capo di MONTE il TEE sta
 * `PASSO_CORSIA_BYPASS` piu' in alto, quindi SOPRA la punta del rombo e non di fianco; al capo di
 * valle sta sulla linea, di fianco. Un passo solo copre entrambe, e i due test in `layout.test.ts`
 * lo dicono separatamente perche' la simmetria non c'e' piu'.
 */
export const PASSO_GIUNZIONE = 20

/**
 * Spazio fra l'ancora dell'ultimo elemento della linea (uno stadio, o il capo di valle di un
 * by-pass) e l'ancora `in` del terminale utenze. Due passi di griglia, la stessa unita' che il
 * modulo usa ovunque per «due elementi vicini» (`GIOCO_FRA_STADI`, `SCARTO_VALVOLA`,
 * `PASSO_GIUNZIONE`): non e' una misura presa su un riferimento — i due PNG del committente non
 * portano un terminale con un'etichetta corta da misurare — ma il valore da correggere per primo
 * se il disegno vero lo smentisce.
 *
 * **Difetto trovato su una pratica vera, non dai test** (BADOER INFISSI, 18-08-2026): il
 * terminale si posava a `rigaCatena.xFinale`, che porta dentro `PASSO_ORIZZONTALE` (60 — un
 * margine fra FAMIGLIE, lo stesso che separa compressori e serbatoi, condiviso con `calcolaMuro`
 * e la corsia di raccolta) piu' meta' della larghezza del proprio riquadro: 170 unita' invece di
 * 20, con la valvola di riserva a meta' di un tratto lunghissimo su entrambi i lati.
 */
export const PASSO_TERMINALE = 20

/**
 * Di quanto la linea di processo SCENDE quando c'e' almeno un by-pass, e di quanto si separano due
 * corsie di ponte che si sovrappongono. Serve perche' il ponte possa correre alla quota dell'uscita
 * del serbatoio senza accavallarcisi.
 *
 * **Novanta unita', misurate su `si bypass.png`**: la corsa del ponte sta a y=74,5 px e la linea
 * di processo a y=125, uno scarto di 50,5 px che alla scala di quell'immagine (0,5575 px/unita',
 * letta dal reticolo da 10 unita' della tela) fa 90,6. Controprova indipendente: con una corsia di
 * 90 e la valvola due passi sotto l'orizzontale, sotto la valvola restano 70 unita' di flessibile,
 * cioe' le tre o quattro ondulazioni che si contano sul riferimento.
 *
 * **E' anche la quota del PONTE**, dal Blocco 5: la linea scende di una corsia proprio perche' il
 * capo di monte di un by-pass possa stare sulla quota dell'uscita del serbatoio, e su
 * `si bypass.png` quei due tratti sono la STESSA orizzontale — una sola riga forte a y=74/75, dal
 * bocchello (x=270) al gomito del ponte (x=575), senza interruzioni. Cio' che tiene separati il
 * tratto che esce dal serbatoio e la corsa del ponte non e' la quota — sono complanari — ma
 * l'ascissa: si toccano sul TEE, e da li' in la' e' ponte.
 *
 * Fino al Blocco 4 la relazione stava in una costante a parte (`ALTEZZA_BYPASS =
 * PASSO_CORSIA_BYPASS`), che serviva a far salire il ponte SOPRA due capi complanari; ora il capo
 * di monte e' gia' li' e quella costante non aveva piu' lettori. Il legame lo fissa un test
 * (`layout.test.ts`, «la giunzione di monte sta invece alla quota dell'uscita del serbatoio»), non
 * piu' un'uguaglianza fra due numeri.
 */
export const PASSO_CORSIA_BYPASS = 90

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
 *
 * `passo` e' lo spazio fra due elementi della riga, e vale `PASSO_ORIZZONTALE` per chi non lo
 * passa: le famiglie hanno passi diversi (`PASSO_COMPRESSORI`, `PASSO_SERBATOI`) dal Blocco 4,
 * la riga della raccolta condense no.
 *
 * **`xFinale` e' il BORDO DESTRO dell'ultimo elemento**, non il bordo piu' un passo. Lo stacco
 * verso cio' che segue lo mette il chiamante, con la costante che ne porta il nome: fino al
 * 18-08-2026 ci finiva dentro un `PASSO_ORIZZONTALE` implicito, e i due stacchi del disegno —
 * compressori → serbatoi e serbatoi → linea — non erano regolabili separatamente. Con la riga
 * vuota `xFinale` resta `xIniziale`, come prima.
 */
function disponiInRiga(
  nodi: SchemaNodo[],
  xIniziale: number,
  quota: number,
  allineamento: 'centro' | 'basso' = 'centro',
  libreria: Tarature = {},
  passo: number = PASSO_ORIZZONTALE
): { posizionati: SchemaNodoPosizionato[]; xFinale: number } {
  let x = xIniziale
  let bordoDestro = xIniziale
  const posizionati = nodi.map((nodo) => {
    // `dimensioniDi`, non `DIMENSIONI_NODO[nodo.tipo]`: per tutti i tipi tranne il serbatoio
    // orizzontale coincidono (Task 4, Blocco 3), ma per lui `DIMENSIONI_NODO['serbatoio']`
    // resta sempre l'ingombro del verticale — leggerlo qui centrerebbe e spazierebbe il nodo
    // sbagliato, quello che l'auto-layout non disegna.
    const dim = dimensioniDi(nodo, libreria)
    const y = allineamento === 'basso' ? quota - dim.altezza : quota - dim.altezza / 2
    const collocato = posiziona(nodo, x, y)
    bordoDestro = x + dim.larghezza
    x = bordoDestro + passo
    return collocato
  })
  return { posizionati, xFinale: bordoDestro }
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
 *
 * L'accumulatore e' l'ascissa della PROSSIMA ANCORA `sx`, non il bordo sinistro del prossimo
 * riquadro. Sui simboli della catena le due formule coincidono — hanno tutti `sx` a `x: 0` — ma
 * non sulla giunzione di un by-pass, le cui quattro ancore stanno nel CENTRO del riquadro: contando
 * per bordi, il gioco davanti al TEE e quello dietro sarebbero diversi senza che nessuno l'abbia
 * chiesto.
 */
/**
 * Le corsie dei ponti, per id del capo di MONTE. Dal Blocco 5 il ponte corre alla quota del suo
 * capo di monte, quindi la corsia non e' piu' una proprieta' del ponte ma della QUOTA a cui qui si
 * posa quel capo: questo e' l'unico posto che la puo' decidere.
 *
 * Gli intervalli sono posizioni nella SEQUENZA e non ascisse: qui la sequenza e' quella che si sta
 * disponendo, e le due danno lo stesso ordine. `assegnaCorsie` e' la stessa funzione che usa
 * `linearizzaConBypass` (bypass.ts) — assegna dal ponte piu' corto al piu' lungo, cosi' con due
 * gruppi annidati e' l'interno a correre in basso — e usarne un'altra farebbe divergere due
 * risposte che devono coincidere.
 *
 * Un capo di monte senza il suo capo di valle nella sequenza non e' un caso da riparare qui: resta
 * senza corsia e si posa sulla linea, come qualunque altra giunzione.
 */
function corsieDeiCapiDiMonte(nodi: SchemaNodo[]): Map<string, number> {
  const posizione = new Map(nodi.map((n, i) => [n.id, i]))
  const capi = nodi
    .filter((nodo) => eCapoDiMonte(nodo.id))
    .map((nodo) => ({
      monte: nodo.id,
      inizio: posizione.get(nodo.id) ?? 0,
      fine: posizione.get(capoDiValleDi(nodo.id)),
    }))
    .filter((capo): capo is { monte: string; inizio: number; fine: number } => capo.fine !== undefined)
  const corsie = assegnaCorsie(capi)
  return new Map(capi.map((capo, i) => [capo.monte, corsie[i]]))
}

function disponiSequenza(
  nodi: SchemaNodo[],
  xIniziale: number,
  quotaLinea: number,
  yBase: number,
  libreria: Tarature = {}
): { posizionati: SchemaNodoPosizionato[]; xFinale: number } {
  // Fra due elementi vale `PASSO_GIUNZIONE` se uno dei due e' un TEE, `PASSO_SERBATOI` fra due
  // serbatoi, `STACCO_SERBATOI_LINEA` quando si passa da un serbatoio a uno stadio o viceversa
  // (li' ci sta la valvola di riserva, convenzione 6), `GIOCO_FRA_STADI` fra due stadi. Sono le
  // stesse misure di prima del 20-08-2026, quando le due righe erano separate: una pratica non
  // riordinata non deve muoversi di un'unita'.
  const gioco = (a: SchemaNodo, b: SchemaNodo) => {
    if (a.tipo === 'giunzione' || b.tipo === 'giunzione') return PASSO_GIUNZIONE
    if (a.tipo === 'serbatoio' && b.tipo === 'serbatoio') return PASSO_SERBATOI
    if (a.tipo === 'serbatoio' || b.tipo === 'serbatoio') return STACCO_SERBATOI_LINEA
    return GIOCO_FRA_STADI
  }

  // La quota del capo di MONTE di un by-pass non e' quella della linea: sta una corsia piu' in
  // alto, cioe' esattamente dove la linea sarebbe stata se non fosse scesa per fargli posto.
  const corsie = corsieDeiCapiDiMonte(nodi)
  const quotaDi = (nodo: SchemaNodo) => {
    const corsia = corsie.get(nodo.id)
    return corsia === undefined ? quotaLinea : quotaLinea - PASSO_CORSIA_BYPASS * (corsia + 1)
  }

  let xAncora = xIniziale
  const posizionati = nodi.map((nodo, i) => {
    const dim = dimensioniDi(nodo, libreria)
    const sx = ancoraDi(nodo, 'sx', libreria)
    const dx = ancoraDi(nodo, 'dx', libreria)
    // I serbatoi restano appoggiati alla quota di base, come quando avevano una riga propria:
    // disporli per ancora come i rombi li staccherebbe da terra, perche' verticale e orizzontale
    // hanno l'ancora `sx` alla stessa quota relativa ma riquadri di altezza diversa. Gli altri si
    // allineano per ancora sulla linea (convenzioni 3 e 4).
    const y = nodo.tipo === 'serbatoio' ? yBase - dim.altezza : quotaDi(nodo) - (sx?.y ?? dim.altezza / 2)
    const collocato = posiziona(nodo, xAncora - (sx?.x ?? 0), y)
    const prossimo = nodi[i + 1]
    xAncora = collocato.x + (dx?.x ?? dim.larghezza) + (prossimo ? gioco(nodo, prossimo) : 0)
    return collocato
  })
  // `xFinale` resta la regola di sempre — bordo destro dell'ultimo riquadro piu' il passo — e non
  // l'ascissa dell'ultima ancora: la usano il terminale utenze e la corsia condense, e stringerla
  // qui sposterebbe anche loro. La compattezza in larghezza e' il Blocco 4.
  //
  // Il passo e' `PASSO_ORIZZONTALE`, tranne quando l'ultimo elemento e' un serbatoio: allora resta
  // `STACCO_SERBATOI_LINEA`, la stessa valvola di riserva di `gioco` qui sopra — non sparisce solo
  // perche' non lo segue piu' uno stadio. Prima del 20-08-2026 questo caso era il ripiego di
  // `disponiCatenaPerAncore` su una catena vuota (`xFinale = xIniziale`, che portava dentro lo
  // stesso stacco preso da `rigaSerbatoi.xFinale + STACCO_SERBATOI_LINEA`): una pratica con un solo
  // serbatoio e senza stadi — o piu' serbatoi e senza stadi — usava gia' questo stacco, non
  // `PASSO_ORIZZONTALE`. Senza questo caso la corsia condense di quella pratica si sposterebbe di
  // 10 unita', in barba al vincolo di pixel-identita' sulle pratiche non riordinate.
  const ultimo = posizionati[posizionati.length - 1]
  const staccoFinale = ultimo?.tipo === 'serbatoio' ? STACCO_SERBATOI_LINEA : PASSO_ORIZZONTALE
  const xFinale = ultimo ? ultimo.x + dimensioniDi(ultimo, libreria).larghezza + staccoFinale : xIniziale
  return { posizionati, xFinale }
}

/**
 * La quota su cui corre la linea di processo: quella dell'uscita del PRIMO SERBATOIO della
 * sequenza, non la sua mezzeria. Dal 20-08-2026 riceve il nodo non ancora posizionato e la quota
 * di base, invece della riga già disposta: coi serbatoi dentro la sequenza la quota serve prima
 * di poterli collocare, e ricavarla dalla riga disposta sarebbe circolare.
 *
 * Il risultato è identico a prima — `yBase - altezza` è esattamente la `y` che l'allineamento
 * basso dava al serbatoio di testa — quindi una pratica non riordinata non si muove.
 */
export function quotaLineaProcesso(
  primoSerbatoio: SchemaNodo | undefined,
  yBase: number,
  ripiego: number,
  libreria: Tarature = {},
  catena: SchemaNodo[] = []
): number {
  const scesa = catena.some((n) => n.tipo === 'giunzione') ? PASSO_CORSIA_BYPASS : 0
  if (!primoSerbatoio) return ripiego + scesa
  const dx = ancoraDi(primoSerbatoio, 'dx', libreria)
  if (!dx) return ripiego + scesa
  return yBase - dimensioniDi(primoSerbatoio, libreria).altezza + dx.y + scesa
}

/**
 * La sequenza della linea di processo, letta da CHI GLI ARCHI COLLEGANO e non ri-derivata per
 * rango di tipo. `ordinaCatenaTrattamento` non conosce le preferenze dell'operatore ne' le
 * giunzioni di un by-pass: dal 18-08-2026 il modello puo' collegare gli stadi in un ordine che
 * quella funzione non saprebbe riprodurre, e disporli con due regole diverse significa disegnare
 * le linee incrociate. Resta l'ordine di DEFAULT dentro `buildSchemaModel`, che e' il posto dove
 * un ordine va deciso; qui si legge quello deciso.
 *
 * Si parte dalla TESTA della linea e si seguono gli archi d'aria. Il `visto` non e' una cautela di
 * stile: un layout riaperto e ricollegato a mano nell'editor puo' contenere un ciclo, e senza si
 * girerebbe in tondo per sempre.
 *
 * Gli stadi che gli archi non raggiungono si appendono in coda nell'ordine di default: uno stadio
 * scollegato (l'operatore ha cancellato una tubazione) e' meglio disegnarlo in fondo che non
 * disegnarlo affatto.
 */
export function catenaDagliArchi(model: SchemaModel, pozzo: SchemaNodo | null): SchemaNodo[] {
  const perId = new Map(model.nodi.map((n) => [n.id, n]))
  // Dal 20-08-2026 il serbatoio e' un elemento di linea come gli altri: puo' stare in mezzo alla
  // catena, con uno stadio prima e uno dopo.
  const inLinea = (n: SchemaNodo): boolean =>
    n.id !== pozzo?.id &&
    (n.tipo === 'serbatoio' ||
      n.tipo === 'essiccatore' ||
      n.tipo === 'filtro' ||
      n.tipo === 'separatore' ||
      n.tipo === 'giunzione')

  const successore = new Map<string, string>()
  // La testa della linea: il bersaglio di una mandata di compressore. Si legge dagli ARCHI e non
  // dalle preferenze perche' questa funzione lavora anche su un layout gia' ritoccato a mano
  // nell'editor, dove le preferenze non arrivano — e perche' «il primo serbatoio», il criterio di
  // prima, non vale piu': la linea puo' cominciare con un filtro.
  let testa: string | undefined
  for (const arco of model.archi) {
    // Solo l'aria: le condense corrono su una rete propria e non dicono nulla sull'ordine della
    // linea. Il primo vince — con due uscite dallo stesso nodo il disegno e' comunque ambiguo, e
    // sceglierne una in silenzio e' meglio che fermarsi.
    if (arco.stile === 'condensa') continue
    if (arco.stile === 'flessibile' && perId.get(arco.da.nodo)?.tipo === 'compressore') {
      testa ??= arco.a.nodo
      continue
    }
    // E nemmeno il ponte di un by-pass, che e' aria ma non e' la linea: da una giunzione di
    // by-pass escono DUE archi, e seguendo il ponte la catena salterebbe di netto tutti gli
    // elementi scavalcati.
    if (arco.forma === 'ponte') continue
    if (!successore.has(arco.da.nodo)) successore.set(arco.da.nodo, arco.a.nodo)
  }

  // Ripiego senza mandate (un layout a cui l'operatore ha staccato i compressori): fra gli
  // elementi di linea che nessun arco raggiunge (i candidati alla testa per esclusione), si
  // preferisce quello che ha davvero un successore — cioè che e' la sorgente di una catena — e si
  // ricade sul primo per ordine d'array solo se nessuno ne ha uno. Un nodo isolato (senza archi ne'
  // in entrata ne' in uscita) che capita prima nell'array non e' la testa della linea: e' un
  // orfano, e prenderlo per testa farebbe scivolare fra gli orfani tutto il resto della catena.
  const bersagli = new Set([...successore.values()])
  const candidati = model.nodi.filter((n) => inLinea(n) && !bersagli.has(n.id))
  testa ??= (candidati.find((n) => successore.has(n.id)) ?? candidati[0])?.id

  const catena: SchemaNodo[] = []
  const visto = new Set<string>()
  // A differenza di prima il nodo di partenza ENTRA nella catena: ora può essere un elemento di
  // linea a tutti gli effetti, non piu' il serbatoio che le stava a monte.
  let corrente = testa
  while (corrente && !visto.has(corrente)) {
    visto.add(corrente)
    const nodo = perId.get(corrente)
    if (nodo && inLinea(nodo)) catena.push(nodo)
    corrente = successore.get(corrente)
  }

  const presi = new Set(catena.map((n) => n.id))
  const orfani = model.nodi.filter((n) => inLinea(n) && n.tipo !== 'giunzione' && !presi.has(n.id))
  return [...catena, ...orfani]
}

export function layoutSchema(model: SchemaModel, libreria: Tarature = {}): SchemaLayout {
  const compressori = model.nodi.filter((n) => n.tipo === 'compressore')
  // Il pozzo di raccolta condense sta nella corsia bassa: è la tanica, oppure il separatore
  // quando è lui a raccogliere (in quel caso resta fuori dalla sequenza della linea).
  const pozzo = pozzoCondense(model.nodi, model)
  const raccolta = pozzo ? [pozzo] : []
  // Una sola sequenza dal 20-08-2026: serbatoi e stadi insieme, nell'ordine che gli archi
  // dichiarano. Prima erano due righe distinte, e il serbatoio stava per forza a monte di tutto.
  const sequenza = catenaDagliArchi(model, pozzo)

  const altezzaCompressore = DIMENSIONI_NODO.compressore.altezza
  const altezzaSerbatoio = DIMENSIONI_NODO.serbatoio.altezza

  // I compressori stanno in basso a sinistra; i serbatoi appoggiano la base sulla stessa quota
  // della loro (`yBase`).
  const yBase = MARGINE_SUPERIORE + altezzaSerbatoio
  const yCentroCompressori = yBase - altezzaCompressore / 2
  const yCentroSerbatoi = yBase - altezzaSerbatoio / 2

  const rigaCompressori = disponiInRiga(
    compressori,
    MARGINE,
    yCentroCompressori,
    'centro',
    libreria,
    PASSO_COMPRESSORI
  )

  // La quota della linea si legge dal primo serbatoio della SEQUENZA (non piu' dalla riga dei
  // serbatoi, che non esiste piu'), prima di disporre: vedi `quotaLineaProcesso`.
  const primoSerbatoio = sequenza.find((n) => n.tipo === 'serbatoio')
  const quotaLinea = quotaLineaProcesso(primoSerbatoio, yBase, yCentroSerbatoi, libreria, sequenza)
  const rigaLinea = disponiSequenza(
    sequenza,
    rigaCompressori.xFinale + STACCO_COMPRESSORI_SERBATOI,
    quotaLinea,
    yBase,
    libreria
  )

  const yCondense = yBase + CORSIA_CONDENSE
  const rigaRaccolta = disponiInRiga(raccolta, Math.max(rigaLinea.xFinale, MARGINE), yCondense, 'centro', libreria)

  // Il terminale utenze non sta in nessuna riga: si appoggia a destra di tutto ciò che lo
  // precede, con l'ancora (in fondo al codolo) proprio sulla fascia orizzontale dove corrono le
  // tubazioni di linea — così la tubazione che vi arriva entra dritta invece di fare due gomiti
  // per raggiungerlo. Il fondo del riquadro non è più a quota fissa da quando la scritta può
  // andare a capo (`dimensioniDi`, in `symbols/index.ts`, lo fa crescere con le righe): si
  // posiziona quindi da lì, non da `DIMENSIONI_NODO.utenze.altezza`, o con un'etichetta lunga
  // l'ancora scenderebbe sotto la fascia e la tubazione arriverebbe con un gomito.
  //
  // L'ascissa NON è `rigaLinea.xFinale`: quella porta dentro `PASSO_ORIZZONTALE`, un margine fra
  // FAMIGLIE che non descrive il terminale — il terminale è la STESSA linea che continua, non una
  // famiglia nuova. Si cerca invece l'arco che arriva a lui (ce n'è al più uno: è lo stesso la cui
  // esistenza ha fatto nascere il nodo, in `buildSchemaModel`) e si parte dalla SUA ancora — così
  // vale anche col by-pass, dove la sorgente è il capo di valle e non un elemento della catena.
  const utenze = model.nodi.filter((n) => n.tipo === 'utenze')
  const nodiPrimaDelTerminale = [
    ...rigaCompressori.posizionati,
    ...rigaLinea.posizionati,
    ...rigaRaccolta.posizionati,
  ]
  const posizionatiUtenze = utenze.map((n) => {
    const larghezza = dimensioniDi(n, libreria).larghezza
    const arcoFinale = model.archi.find((a) => a.a.nodo === n.id)
    const partenza = arcoFinale ? nodiPrimaDelTerminale.find((m) => m.id === arcoFinale.da.nodo) : undefined
    const ancoraPartenza = partenza && arcoFinale ? ancoraDi(partenza, arcoFinale.da.ancora, libreria) : undefined
    // Ripiego se l'arco o il suo capo non si trovano (non dovrebbe capitare: `buildSchemaModel`
    // crea il nodo utenze solo quando quell'arco esiste): resta il vecchio bordo destro, sbagliato
    // ma non `NaN`.
    const bordoSinistro =
      partenza && ancoraPartenza
        ? partenza.x + ancoraPartenza.x + PASSO_TERMINALE - larghezza / 2
        : rigaLinea.xFinale
    return posiziona(n, bordoSinistro, quotaLinea - dimensioniDi(n, libreria).altezza)
  })

  const nodi = [
    ...rigaCompressori.posizionati,
    ...rigaLinea.posizionati,
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

  // Ultimo passo, non uno dei primi: le istruzioni di sola andata si risolvono sulla geometria
  // VERA, che esiste solo dopo che ogni nodo ha la sua posizione. Da qui in poi nessun arco porta
  // piu' una `forma` e nessun segno un `ancoraggio` — vedi `segniAncorati.ts`.
  //
  // I ponti PRIMA degli ancoraggi, e non e' indifferente: le tre valvole del ponte sono ancorate
  // ai suoi vertici, che esistono solo dopo che i gomiti sono scritti. Al contrario si
  // troverebbero i due soli capi, e cadrebbero tutte sul ripiego a meta' tubo.
  const conPonti = risolviPonti(layout, libreria)
  return risolviSegniAncorati(conPonti, quoteInstradamento(conPonti, libreria), libreria)
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
    // di spazio sopra per la valvola di sicurezza e `MARGINE_SCARICO_SERBATOIO` sotto per quella
    // di scarico (dal 19-08-2026) — una sola formula per i due orientamenti, non più un
    // centraggio diverso e una misura fissa (84) indipendente dal riquadro dichiarato.
    return {
      x: nodo.x,
      y: nodo.y + MARGINE_VALVOLA_SERBATOIO,
      larghezza: dim.larghezza,
      altezza: dim.altezza - MARGINE_VALVOLA_SERBATOIO - MARGINE_SCARICO_SERBATOIO,
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
  // **Comandano i COMPRESSORI, e loro soli.** La dorsale esiste per raccogliere i loro montanti,
  // e deve stargli sopra abbastanza da ospitare la valvola (due passi di griglia) piu' un tratto
  // di flessibile che si veda.
  //
  // Il serbatoio NON la vincola, dal 18-08-2026 (decisione del committente sul suo disegno). Il
  // vincolo «passare sopra il corpo del serbatoio» c'era per non entrare nella capsula, ma la
  // dorsale non ci passa mai sopra: si aggancia all'ancora `sx-basso`, che sta sul BORDO SINISTRO
  // (`x: 0` in coordinate locali, symbols/index.ts), quindi la corsa orizzontale finisce dove il
  // serbatoio comincia e da li' scende di FIANCO. Col serbatoio verticale quel vincolo vinceva
  // sempre e teneva la dorsale 90 unita' piu' in alto del necessario: i montanti nascevano lunghi
  // il doppio di quelli del disegno vero, ed e' il difetto che questo chiude. Un test fissa il
  // «di fianco» (`layout.test.ts`): se un giorno la mandata si agganciasse a un'ancora interna,
  // cade li', ed e' quello il momento di rimettere il vincolo.
  //
  // Senza compressori non c'e' dorsale da quotare, ma la funzione deve comunque tornare un
  // numero: si ripiega sui serbatoi, e poi su tutto il resto.
  const cime =
    compressori.length > 0
      ? compressori.map((n) => n.y - MARGINE_COLLETTORE_COMPRESSORI)
      : serbatoi.map((n) => corpoNodo(n, libreria).y - MARGINE_COLLETTORE)
  const riferimento = cime.length > 0 ? cime : layout.nodi.map((n) => n.y - MARGINE_COLLETTORE)
  if (riferimento.length === 0) return MARGINE
  return Math.min(...riferimento)
}

/**
 * Quota della corsia comune delle linee condense: appena sopra il pozzo di raccolta, così le linee
 * vi scendono dentro dall'alto.
 *
 * Col SEPARATORE fa eccezione, e non è un caso particolare capriccioso: lui riceve di FIANCO
 * (ancora `sx`, vedi `buildSchemaModel`), quindi la corsia deve correre alla quota di
 * quell'attacco, non sopra il suo corpo. Con la regola generale la corsia passava 40 unità sopra
 * il rombo e l'ultimo tratto scendeva di 80 per rientrare nel vertice: il gomito verticale a
 * ridosso del simbolo che il committente ha segnalato il 19-08-2026 («l'arrivo è sempre in
 * verticale mentre deve essere in orizzontale»). Per la tanica, che riceve dall'alto, la regola
 * resta quella di prima — è lei il caso in cui la discesa finale è il disegno giusto.
 */
export function quotaCorsiaCondense(layout: SchemaLayout, altezzaDisegno: number, libreria: Tarature = {}): number {
  const pozzo = pozzoCondense(layout.nodi, layout)
  if (!pozzo) return altezzaDisegno - MARGINE / 2
  if (pozzo.tipo === 'separatore') {
    const attacco = ancoraDi(pozzo, 'sx', libreria)
    if (attacco) return pozzo.y + attacco.y
  }
  return corpoNodo(pozzo, libreria).y - 40
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
