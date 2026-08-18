/**
 * Costruzione del modello logico dello schema (nodi + archi) a partire dai dati già
 * presenti in scheda — nessuna posizione qui, solo la struttura. Vedi `types.ts` per le
 * convenzioni desunte dai blocchi AutoCAD reali su cosa diventa un nodo autonomo e cosa un
 * accessorio disegnato sul nodo genitore.
 *
 * Riusa `elencaValvole`/`codiciValvole*` da `utils/valvoleImpianto.ts`: stessa numerazione
 * (S1.1, C1.2, …) già usata dal motore della relazione, non reinventata qui.
 */
import type {
  Compressore,
  Essiccatore,
  Filtro,
  SchedaDatiCompleta,
  Separatore,
} from '@/types/technicalSheet'
import { elencaValvole } from '@/utils/valvoleImpianto'
import { eCapoDiMonte, eTeeBypass, linearizzaConBypass, nodoGiunzioneBypass } from './bypass'
import type { Tarature } from './libreria'
// `import type` e non un import di valore: `preferenze.ts` importa `ordinaCatenaTrattamento` e
// `scaricaCondensa` da QUI, e un import vero chiuderebbe il cerchio. I tipi spariscono in
// compilazione, quindi a runtime la dipendenza resta a senso unico.
import type { PreferenzeRisolte } from './preferenze'
import { ancoraDi } from './symbols'
import type {
  SchemaAccessorioDipendente,
  SchemaArco,
  SchemaArcoStile,
  SchemaGruppo,
  SchemaModel,
  SchemaNodo,
  SchemaSegnoTubo,
  SchemaValvolaSicurezza,
} from './types'

export interface BuildSchemaModelInput {
  scheda: SchedaDatiCompleta
  /** `AdditionalInfo.collegamentiCompressoriSerbatoi` — { C1: ['S1','S2'] }. */
  collegamentiCompressoriSerbatoi: Record<string, string[]>
  /**
   * Le scelte dell'operatore GIA' RISOLTE (`preferenzeRisolteDaScheda`). Assenti: i default di
   * sempre — ordine per rango di tipo, condense per tipo, nessun by-pass — cosi' una pratica che
   * non ha mai aperto il pannello genera esattamente come prima.
   */
  preferenze?: PreferenzeRisolte
  /**
   * La libreria dei simboli, da cui si legge l'ESISTENZA delle ancore e mai la loro geometria
   * (vedi `ancoraMandata`).
   */
  libreria?: Tarature
}

/** Etichetta di tabella nello stesso formato delle relazioni storiche: "Compressore KAESER Mod. CSD 90 SFC". */
function etichetta(descrizione: string, marca?: string, modello?: string): string {
  return [descrizione, marca?.trim(), modello?.trim() ? `Mod. ${modello.trim()}` : undefined]
    .filter((parte): parte is string => Boolean(parte))
    .join(' ')
}

function valvoleDiRecipiente(
  valvoleImpianto: ReturnType<typeof elencaValvole>,
  recipiente: string
): SchemaValvolaSicurezza[] {
  return valvoleImpianto
    .filter((v) => v.recipiente === recipiente)
    .map((v) => ({ codice: v.pos, etichetta: etichetta('Valvola di sicurezza', v.valvola.marca, v.valvola.modello) }))
}

function buildAccessorioDisoleatore(
  scheda: SchedaDatiCompleta,
  compressoreCodice: string,
  valvoleImpianto: ReturnType<typeof elencaValvole>
): SchemaAccessorioDipendente | undefined {
  const diso = (scheda.disoleatori ?? []).find((d) => d.compressore_associato === compressoreCodice)
  if (!diso) return undefined
  return {
    codice: diso.codice,
    etichetta: etichetta('Serbatoio disoleatore', diso.marca, diso.modello),
    valvoleSicurezza: valvoleDiRecipiente(valvoleImpianto, diso.codice),
  }
}

function buildCompressoreNodo(
  c: Compressore,
  scheda: SchedaDatiCompleta,
  valvoleImpianto: ReturnType<typeof elencaValvole>
): SchemaNodo {
  return {
    id: c.codice,
    tipo: 'compressore',
    etichetta: etichetta('Compressore', c.marca, c.modello),
    // I compressori non hanno un campo ubicazione proprio in scheda: stanno sempre fisicamente
    // in sala compressori, a differenza dei serbatoi che possono essere spostati in linea.
    gruppo: 'SALA_COMPRESSORI',
    valvoleSicurezza: [],
    accessorio: buildAccessorioDisoleatore(scheda, c.codice, valvoleImpianto),
    origine: 'scheda',
  }
}

function buildSerbatoioNodi(
  scheda: SchedaDatiCompleta,
  valvoleImpianto: ReturnType<typeof elencaValvole>
): SchemaNodo[] {
  return (scheda.serbatoi ?? []).map((s) => ({
    id: s.codice,
    tipo: 'serbatoio',
    etichetta: etichetta('Serbatoio', s.marca, s.modello),
    orientamento: s.orientamento ?? 'VERTICALE',
    gruppo: (s.ubicazione ?? 'SALA_COMPRESSORI') as SchemaGruppo,
    valvoleSicurezza: valvoleDiRecipiente(valvoleImpianto, s.codice),
    origine: 'scheda',
  }))
}

function buildEssiccatoreNodo(e: Essiccatore, scheda: SchedaDatiCompleta): SchemaNodo {
  const scamb = (scheda.scambiatori ?? []).find((sc) => sc.essiccatore_associato === e.codice)
  return {
    id: e.codice,
    tipo: 'essiccatore',
    etichetta: etichetta('Essiccatore frigorifero', e.marca, e.modello),
    // Sta sempre a valle del serbatoio nella catena di trattamento (ordinaCatenaTrattamento,
    // sotto), ma quello è l'ordine delle tubazioni, non la stanza in cui sta fisicamente: solo
    // il serbatoio può essere ubicato fuori sala compressori (campo `ubicazione` in scheda).
    // L'essiccatore ci resta sempre, altrimenti il muro separerebbe sala compressori e linea di
    // distribuzione anche quando non c'è nessuna apparecchiatura vera fuori dalla sala.
    gruppo: 'SALA_COMPRESSORI',
    valvoleSicurezza: [],
    accessorio: scamb
      ? {
          codice: scamb.codice,
          etichetta: etichetta('Scambiatore di calore', scamb.marca, scamb.modello),
          // Lo scambiatore non ha una valvola propria (protetto da valvole altrove, non
          // deducibili automaticamente — vedi commento su `valvole_protezione` nel tipo).
          valvoleSicurezza: [],
        }
      : undefined,
    origine: 'scheda',
  }
}

function buildFiltroNodo(f: Filtro, scheda: SchedaDatiCompleta): SchemaNodo {
  const rec = (scheda.recipienti_filtro ?? []).find((r) => r.filtro_associato === f.codice)
  return {
    id: f.codice,
    tipo: 'filtro',
    etichetta: etichetta('Filtro', f.marca, f.modello),
    prefiltro: f.tipo === 'PREFILTRO',
    // Stessa ragione dell'essiccatore (vedi lì): solo il serbatoio può stare fuori sala.
    gruppo: 'SALA_COMPRESSORI',
    valvoleSicurezza: [],
    accessorio: rec
      ? {
          codice: rec.codice,
          etichetta: etichetta('Recipiente filtro', rec.marca, rec.modello),
          valvoleSicurezza: [],
        }
      : undefined,
    origine: 'scheda',
  }
}

function buildSeparatoreNodo(sep: Separatore): SchemaNodo {
  return {
    id: sep.codice,
    tipo: 'separatore',
    etichetta: etichetta('Separatore', sep.marca, sep.modello),
    // Stessa ragione dell'essiccatore (vedi lì): solo il serbatoio può stare fuori sala. Vale
    // anche quando questo stesso nodo fa da pozzo di raccolta condense (raccolta_condense:
    // 'separatore' più sotto lo riusa per id: è la stessa apparecchiatura, non due) — a
    // differenza della tanica generica, che non è un'apparecchiatura vera e resta in linea.
    gruppo: 'SALA_COMPRESSORI',
    valvoleSicurezza: [],
    origine: 'scheda',
  }
}

/**
 * Nodo pozzo di raccolta condense, unico per l'intero impianto (`dati_impianto.raccolta_condense`
 * non è per-serbatoio). `null` se non c'è raccolta (niente rete di linee condense da disegnare).
 */
function buildNodoRaccoltaCondense(scheda: SchedaDatiCompleta): SchemaNodo | null {
  // In produzione il campo arriva sia come stringa sia come array di una voce (il select è
  // nato multiplo): senza normalizzare, l'array non matcha nessun caso e si finisce sul
  // pozzo generico anche quando la scheda dichiara un separatore.
  const grezzo = scheda.dati_impianto?.raccolta_condense
  const modo = (Array.isArray(grezzo) ? grezzo[0] : grezzo)?.toLowerCase()
  if (!modo || modo === 'nessuna') return null

  if (modo === 'separatore') {
    const primo = (scheda.separatori ?? [])[0]
    return primo
      ? buildSeparatoreNodo(primo)
      : {
          id: 'SEP',
          tipo: 'separatore',
          etichetta: 'Separatore',
          // A differenza di `buildSeparatoreNodo`: qui non c'è un'apparecchiatura vera in
          // scheda, solo il pozzo generico che la dichiarazione di raccolta condense impone —
          // stessa natura di `tanica`/'altro' qui sotto, non del separatore come stadio di
          // trattamento.
          gruppo: 'LINEA_DISTRIBUZIONE',
          valvoleSicurezza: [],
          origine: 'scheda',
        }
  }

  if (modo === 'tanica') {
    return {
      id: 'T',
      tipo: 'tanica',
      etichetta: 'Tanica raccolta condense',
      gruppo: 'LINEA_DISTRIBUZIONE',
      valvoleSicurezza: [],
      origine: 'scheda',
    }
  }

  // 'altro': nessun simbolo dedicato nei blocchi di riferimento — riusa la tanica generica.
  return {
    id: 'RC',
    tipo: 'tanica',
    etichetta: 'Raccolta condense',
    gruppo: 'LINEA_DISTRIBUZIONE',
    valvoleSicurezza: [],
    origine: 'scheda',
  }
}

/**
 * Nodi che scaricano condensa nel pozzo di raccolta. Sul compressore la condensa esce dal
 * disoleatore, quindi un compressore che non ne ha (tipicamente a pistoni) resta escluso.
 *
 * Esportata dal 18-08-2026: e' la regola di DEFAULT che il pannello delle preferenze mostra
 * spuntata finche' l'operatore non sceglie (`risolviPreferenze`). Nel Blocco 1 il pannello ne
 * usava una propria — `() => true` — e la spunta mostrata in finestra mentiva sul disegno che
 * sarebbe uscito: un compressore a pistoni compariva spuntato e non scaricava. Una domanda, una
 * risposta sola.
 */
export function scaricaCondensa(nodo: SchemaNodo): boolean {
  if (nodo.tipo === 'compressore') return Boolean(nodo.accessorio)
  return nodo.tipo === 'serbatoio' || nodo.tipo === 'essiccatore' || nodo.tipo === 'filtro'
}

/**
 * Ordine della catena di trattamento a valle del serbatoio, come negli schemi reali:
 * prefiltri → essiccatori → filtri di linea. Il pozzo di raccolta condense ne resta fuori
 * anche quando è un separatore: raccoglie condensa, non tratta l'aria di linea (vedi SEP
 * in 555_RELAZIONE_TECNICA).
 *
 * Esportata perché il layout deve disporre i nodi nello stesso ordine in cui il grafo li
 * collega: due ordinamenti diversi produrrebbero un disegno con le linee incrociate.
 */
export function ordinaCatenaTrattamento(
  nodi: SchemaNodo[],
  raccoltaCondense: SchemaNodo | null
): SchemaNodo[] {
  const rango = (nodo: SchemaNodo): number => {
    if (nodo.tipo === 'filtro') return nodo.prefiltro ? 0 : 200
    if (nodo.tipo === 'essiccatore') return 100
    return 300
  }
  // Solo gli stadi di trattamento: un serbatoio ubicato in linea resta un serbatoio e ha già
  // la sua riga nel layout — includerlo qui lo disegnerebbe due volte.
  const stadi: SchemaNodo['tipo'][] = ['essiccatore', 'filtro', 'separatore']
  return nodi
    .filter((n) => stadi.includes(n.tipo) && n.id !== raccoltaCondense?.id)
    .map((nodo, indice) => ({ nodo, chiave: rango(nodo) + indice }))
    .sort((a, b) => a.chiave - b.chiave)
    .map((v) => v.nodo)
}

/**
 * Terminale della linea aria. Sempre presente quando c'è una linea da terminare: prima del
 * 12-08-2026 lo disegnava `renderUscitaUtenze` scegliendo da sé il nodo più a destra, una
 * regola che qui non si può nemmeno valutare — il modello si costruisce prima che le posizioni
 * esistano. La regola diventa topologica: l'ultimo stadio di trattamento, o il serbatoio da cui
 * la linea parte quando di stadi non ce ne sono.
 */
export const ID_UTENZE = 'UTENZE'

function nodoUtenze(): SchemaNodo {
  return {
    id: ID_UTENZE,
    tipo: 'utenze',
    // Due righe dal 17-08-2026: il committente vuole «aria» a capo sotto «Utenze». L'a capo sta
    // nell'etichetta e non in una regola che spezza da sé sull'ultima parola — così resta
    // modificabile dal dialogo, e nessun'altra etichetta se lo ritrova imposto.
    etichetta: 'Utenze\naria',
    gruppo: 'LINEA_DISTRIBUZIONE',
    valvoleSicurezza: [],
    // Origine 'scheda' e non 'manuale': fa parte della proposta automatica, quindi la
    // riconciliazione lo rimette se manca. Cancellarlo nell'editor lo fa tornare alla
    // riapertura, ed è la conseguenza accettata dal committente.
    origine: 'scheda',
  }
}

/**
 * L'ancora del serbatoio a cui arriva la mandata del compressore: quella BASSA, come nei disegni
 * di riferimento — la dorsale scende con un gradino e si aggancia al fianco in basso, non a 160
 * unita' piu' in alto (convenzione 2).
 *
 * Si legge l'ESISTENZA dell'ancora, mai la sua geometria: `sx-basso` non c'e' sul serbatoio
 * ORIZZONTALE (symbols/index.ts), e una taratura permanente puo' toglierlo anche al verticale.
 * Chiederlo comunque farebbe ripiegare `posizioneAncora` sul centro del corpo del serbatoio — un
 * tubo attaccato in mezzo alla pancia: sbagliato ma plausibile, il peggior tipo di errore.
 */
function ancoraMandata(serbatoio: SchemaNodo | undefined, libreria: Tarature): string {
  if (!serbatoio) return 'sx'
  return ancoraDi(serbatoio, 'sx-basso', libreria) ? 'sx-basso' : 'sx'
}

/**
 * Quanto una valvola di intercettazione sta lontano dal gomito, lungo il tubo. Due passi di
 * griglia dal 18-08-2026, uno prima. **Un numero solo per la mandata del compressore
 * (convenzione 1) e per i montanti del ponte (convenzione 5)**: sono valvole che nel disegno
 * finiscono affiancate, e a misure diverse starebbero a quote diverse.
 */
const SCARTO_VALVOLA = 20

function buildArchi(nodi: SchemaNodo[], input: BuildSchemaModelInput, raccoltaCondense: SchemaNodo | null): SchemaArco[] {
  const archi: SchemaArco[] = []
  let contatore = 0
  const prossimoId = (prefisso: string) => `${prefisso}-${++contatore}`
  const libreria = input.libreria ?? {}

  /**
   * Valvola di intercettazione DUE passi di griglia lontano dal vertice dato, sul tratto che
   * scende. Erano uno fino al 18-08-2026, quando il committente le ha abbassate correggendo a mano
   * il disegno generato (convenzione 1, che diceva «un passo»: il disegno vero ne vuole due).
   *
   * **Lo stesso numero vale per le valvole del ponte** (convenzione 5): due valvole affiancate nel
   * disegno — quella della mandata e quella del montante di un by-pass — starebbero altrimenti a
   * quote diverse. Un test lega esplicitamente le due misure.
   *
   * `verso` dice da che parte del vertice sta la valvola LUNGO la polilinea: −1 sul tratto
   * entrante (il montante che sale verso il gomito), +1 su quello uscente (il montante che
   * ridiscende dopo il gomito).
   *
   * La `t` nasce a 0,5 come ripiego: se la geometria non si risolve la valvola compare a meta'
   * tubo, sbagliata ma visibile e correggibile a mano, che e' meglio di un'eccezione a meta'
   * generazione.
   */
  const valvolaAlVertice = (
    vertice: number,
    stileAValle?: SchemaArcoStile,
    verso: -1 | 1 = -1
  ): SchemaSegnoTubo => ({
    id: prossimoId('segno'),
    tipo: 'valvola_intercettazione',
    t: 0.5,
    stileAValle,
    ancoraggio: { tipo: 'vertice', vertice, scarto: verso * SCARTO_VALVOLA },
  })

  /** Valvola di intercettazione a meta' di un tratto: la riserva e quella al centro della corsa
   *  orizzontale del ponte, che dal Blocco 5 e' il tratto 0 per tutt'e due. */
  const valvolaAMeta = (tratto: number, stileAValle?: SchemaArcoStile): SchemaSegnoTubo => ({
    id: prossimoId('segno'),
    tipo: 'valvola_intercettazione',
    t: 0.5,
    stileAValle,
    ancoraggio: { tipo: 'meta', tratto },
  })

  /** Valvola di riserva, a meta' del primo tratto (convenzione 6). */
  const valvolaDiRiserva = (): SchemaSegnoTubo[] => [valvolaAMeta(0)]

  const perId = new Map(nodi.map((n) => [n.id, n]))

  for (const [compressoreId, serbatoiIds] of Object.entries(input.collegamentiCompressoriSerbatoi)) {
    for (const serbatoioId of serbatoiIds) {
      archi.push({
        id: prossimoId('flex'),
        da: { nodo: compressoreId, ancora: 'alto-out' },
        a: { nodo: serbatoioId, ancora: ancoraMandata(perId.get(serbatoioId), libreria) },
        stile: 'flessibile',
        // Il montante sale flessibile fino alla valvola, e da li' in su e' rigido (convenzione 1):
        // il vertice 1 della rotta flessibile e' il punto in cui il montante incontra la dorsale,
        // e lo scarto e' quanto la valvola sta sotto di essa.
        segni: [valvolaAlVertice(1, 'standard')],
      })
    }
  }

  // L'ordine scelto dall'operatore vince su quello di default; senza preferenze resta
  // `ordinaCatenaTrattamento`, il generatore di sempre.
  const catenaDiDefault = ordinaCatenaTrattamento(nodi, raccoltaCondense)
  const catenaLinea = input.preferenze
    ? input.preferenze.ordineStadi
        .map((id) => catenaDiDefault.find((n) => n.id === id))
        .filter((n): n is SchemaNodo => Boolean(n))
    : catenaDiDefault

  // Le giunzioni dei by-pass entrano nella sequenza della linea: da qui in giu' si ragiona sulla
  // SEQUENZA (stadi e TEE insieme), non piu' sulla catena dei soli stadi. Un gruppo non contiguo,
  // vuoto o su stadi che la catena non ha cade qui senza rumore (vedi `bypass.ts`).
  const { sequenza, ponti } = linearizzaConBypass(catenaLinea, input.preferenze?.bypass ?? [])

  // Convenzione 6: la valvola di riserva e' quella con cui l'operatore isola la sezione. Con un
  // by-pass che scavalca il primo (o l'ultimo) stadio quella valvola c'e' gia' sul ponte, e
  // metterne una seconda a un passo di distanza e' cio' che nei riferimenti non si vede. La
  // domanda si pone sulla SEQUENZA — «il capo della linea e' un TEE?» — e non sull'elenco degli
  // stadi scavalcati: e' la stessa regola, detta dove e' vera anche quando il gruppo e' caduto.
  const capoDiTee = (nodo: SchemaNodo | undefined) => nodo?.tipo === 'giunzione'

  const serbatoiChiave = nodi.filter((n) => n.tipo === 'serbatoio').map((n) => n.id)
  if (sequenza.length > 0 && serbatoiChiave.length > 0) {
    archi.push({
      id: prossimoId('std'),
      da: { nodo: serbatoiChiave[0], ancora: 'dx' },
      a: { nodo: sequenza[0].id, ancora: 'sx' },
      stile: 'standard',
      ...(capoDiTee(sequenza[0]) ? {} : { segni: valvolaDiRiserva() }),
    })
    for (let i = 0; i < sequenza.length - 1; i++) {
      // Dal capo di MONTE di un by-pass la linea esce dal BASSO: quel TEE sta alla quota
      // dell'uscita del serbatoio (Blocco 5) e il tubo scende sulla sua ascissa fino alla punta
      // dello stadio scavalcato. E' il LATO imposto a dare la forma: con `dx` la rotta correrebbe
      // orizzontale sopra lo stadio e scenderebbe sulla sua punta, che nel riferimento non c'e'.
      const dalCapoDiMonte = eCapoDiMonte(sequenza[i].id)
      // Nessun segno fra due stadi consecutivi: le valvole d'ufficio a meta' tratto spariscono
      // (convenzione 6). L'arco pero' si emette SEMPRE, anche quando i due stadi sono adiacenti e
      // il tratto e' degenere: e' il tessuto che ripara il disegno appena l'operatore li separa.
      //
      // L'unico che porta un segno e' il montante che scende dal capo di monte, e degenere non e'
      // mai: fra i suoi due capi c'e' sempre una corsia intera. La valvola e' il MIRROR della
      // convenzione 1 — rigido dal TEE fino a due passi sotto, flessibile da li' in giu', come la
      // mandata del compressore ma col tubo che scende invece di salire. Vertice 0 con scarto
      // positivo: `tDaAncoraggio` (tratti.ts) lo gestisce, il tratto su cui muoversi e'
      // `lunghezze[0]`, che esiste.
      archi.push({
        id: prossimoId('std'),
        da: { nodo: sequenza[i].id, ancora: dalCapoDiMonte ? 'basso' : 'dx' },
        a: { nodo: sequenza[i + 1].id, ancora: 'sx' },
        stile: 'standard',
        ...(dalCapoDiMonte ? { segni: [valvolaAlVertice(0, 'flessibile', 1)] } : {}),
      })
    }
  }

  // Tubazione finale verso le utenze. Il nodo esiste solo se ha da chi partire, quindi qui si
  // decide anche se `buildSchemaModel` deve aggiungerlo (vedi `sorgente`, sotto).
  const ultimo = sequenza.length > 0 ? sequenza[sequenza.length - 1] : undefined
  const sorgente = ultimo ? ultimo.id : serbatoiChiave[0]
  if (sorgente) {
    archi.push({
      id: prossimoId('ut'),
      da: { nodo: sorgente, ancora: 'dx' },
      a: { nodo: ID_UTENZE, ancora: 'in' },
      stile: 'standard',
      ...(capoDiTee(ultimo) ? {} : { segni: valvolaDiRiserva() }),
    })
  }

  // I ponti DOPO tutti gli archi della linea, e non e' indifferente: da una giunzione di by-pass
  // escono due archi, e `catenaDagliArchi` (layout.ts) segue il primo che trova. Emettendo il
  // ponte per primo la catena salterebbe tutti gli stadi scavalcati.
  //
  // Non e' pero' l'unica difesa — sarebbe fragile, basta che un domani qualcuno riordini questa
  // funzione: `catenaDagliArchi` salta gli archi `forma: 'ponte'` per conto suo, e il test che lo
  // fissa mette il ponte per primo di proposito.
  for (const ponte of ponti) {
    archi.push({
      id: prossimoId('bp'),
      // Il capo di monte si stacca di FIANCO — il ponte corre alla sua stessa quota, che dal
      // Blocco 5 e' quella dell'uscita del serbatoio — e quello di valle riceve dall'ALTO, perche'
      // il ponte gli scende addosso. I due lati imposti sono cio' che da' al ponte la sua forma
      // anche senza il gomito che il layout gli scrive.
      da: { nodo: ponte.inizio, ancora: 'dx' },
      a: { nodo: ponte.fine, ancora: 'alto' },
      // RIGIDO dalla partenza (Blocco 5): la corsa orizzontale e' rigida, e la valvola del gomito
      // passa a flessibile la sola gamba che scende sul capo di valle (convenzione 5). La terza
      // valvola del by-pass non e' piu' qui: sta sul montante che scende dal capo di monte.
      stile: 'standard',
      forma: 'ponte',
      segni: [
        // Tratto 0 = la corsa orizzontale, vertice 1 = il gomito. Li fissa `risolviPonti`
        // (segniAncorati.ts), che emette esattamente UN gomito: cambiarne il numero sposta
        // entrambe le valvole.
        valvolaAMeta(0),
        valvolaAlVertice(1, 'flessibile', 1),
      ],
    })
  }

  if (raccoltaCondense) {
    // La tanica riceve dall'alto; il separatore, quando fa da pozzo, riceve di fianco — la
    // corsia condense negli schemi storici entra nel suo vertice sinistro, non dal cielo
    // (555_RELAZIONE_TECNICA_00-2025.pdf pag. 3).
    const ancoraArrivo = raccoltaCondense.tipo === 'separatore' ? 'sx' : 'alto-in'
    for (const nodo of nodi) {
      if (nodo.id === raccoltaCondense.id) continue
      // Il flag per apparecchiatura, col default per tipo gia' applicato da `risolviPreferenze`:
      // dal 18-08-2026 la selezione non e' piu' per tipo (convenzione 7).
      if (input.preferenze ? input.preferenze.condense.has(nodo.id) : scaricaCondensa(nodo)) {
        archi.push({
          id: prossimoId('cond'),
          da: { nodo: nodo.id, ancora: 'basso-out' },
          a: { nodo: raccoltaCondense.id, ancora: ancoraArrivo },
          stile: 'condensa',
        })
      }
    }
  }

  return archi
}

/**
 * Riordina secondo l'elenco scelto dall'operatore. L'ordine dell'ARRAY e' l'ordine del disegno:
 * `layoutSchema` filtra per tipo e dispone in fila nell'ordine in cui trova i nodi qui. Riordinare
 * a valle, nel layout, vorrebbe dire avere due ordinamenti — che e' esattamente il difetto che
 * `catenaDagliArchi` e' nato per chiudere.
 *
 * `indexOf` torna -1 per un id non nominato, che lo porterebbe in testa: non capita, perche'
 * `risolviPreferenze` restituisce elenchi COMPLETI (ogni apparecchiatura di scheda ci compare,
 * nominata o no). Sta scritto perche' chi passa di qui non lo sa.
 */
function perElenco(elenco: string[] | undefined, elementi: SchemaNodo[]): SchemaNodo[] {
  if (!elenco) return elementi
  return [...elementi].sort((a, b) => elenco.indexOf(a.id) - elenco.indexOf(b.id))
}

export function buildSchemaModel(input: BuildSchemaModelInput): SchemaModel {
  const { scheda } = input
  const valvoleImpianto = elencaValvole(scheda)

  const nodi: SchemaNodo[] = [
    ...perElenco(
      input.preferenze?.ordineCompressori,
      (scheda.compressori ?? []).map((c) => buildCompressoreNodo(c, scheda, valvoleImpianto))
    ),
    ...perElenco(input.preferenze?.ordineSerbatoi, buildSerbatoioNodi(scheda, valvoleImpianto)),
    ...(scheda.essiccatori ?? []).map((e) => buildEssiccatoreNodo(e, scheda)),
    ...(scheda.filtri ?? []).map((f) => buildFiltroNodo(f, scheda)),
    ...(scheda.separatori ?? []).map(buildSeparatoreNodo),
  ]

  const raccoltaCondense = buildNodoRaccoltaCondense(scheda)
  if (raccoltaCondense && !nodi.some((n) => n.id === raccoltaCondense.id)) {
    nodi.push(raccoltaCondense)
  }

  // Il terminale entra nei nodi solo se `buildArchi` ha davvero una sorgente da cui farlo
  // partire: un arco verso un nodo assente, o un nodo senza tubazione, sarebbero entrambi
  // incoerenti. Si decide guardando gli archi appena costruiti, unica fonte.
  const archi = buildArchi(nodi, input, raccoltaCondense)
  if (archi.some((a) => a.a.nodo === ID_UTENZE)) nodi.push(nodoUtenze())

  // Le giunzioni dei by-pass entrano come il terminale: guardando gli ARCHI appena costruiti,
  // unica fonte. Un gruppo caduto in `linearizzaConBypass` non ha lasciato archi, e cosi' non
  // lascia nemmeno due TEE appesi nel vuoto. L'ordine nell'array non conta per loro — non stanno
  // in nessuna riga di `layoutSchema`, ci arrivano da `catenaDagliArchi` — ma resta deterministico
  // perche' segue quello degli archi.
  for (const id of new Set(archi.flatMap((a) => [a.da.nodo, a.a.nodo]).filter(eTeeBypass))) {
    nodi.push(nodoGiunzioneBypass(id))
  }

  return { nodi, archi }
}

/** Estremi dei valori dichiarati in una coppia di DN, o `null` se non ne è dichiarato nessuno. */
function estremiDn(valori: (number | undefined)[]): { min: number; max: number } | null {
  const noti = valori.filter((v): v is number => typeof v === 'number' && v > 0)
  if (noti.length === 0) return null
  return { min: Math.min(...noti), max: Math.max(...noti) }
}

/** «Ø15 a Ø25mm», oppure «Ø15mm» quando gli estremi coincidono o ne è noto uno solo. */
function misuraDn({ min, max }: { min: number; max: number }): string {
  return min === max ? `Ø${min}mm` : `Ø${min} a Ø${max}mm`
}

/**
 * Nota sui diametri stampata sotto lo schema, come nelle relazioni storiche. Vuota se la scheda
 * non dichiara diametri: il riquadro sparisce invece di annunciare una misura che nessuno ha
 * rilevato. Legge i DN in mm e non i vecchi campi a testo libero.
 *
 * Le due coppie si leggono separate: fino al 17-08-2026 i quattro valori finivano in un unico
 * min/max, e i diametri delle linee di distribuzione si mescolavano a quelli dei collegamenti in
 * sala senza mai essere nominati. Dentro ciascuna coppia gli estremi si ricavano comunque dai
 * valori presenti, perché in scheda capita di trovarli scambiati.
 *
 * Senza collegamenti in sala non si stampa nulla, nemmeno se le linee di distribuzione sono
 * dichiarate: scelta del committente, il riquadro parla dei collegamenti.
 */
export function notaTubazioni(scheda: SchedaDatiCompleta): string[] {
  const d = scheda.dati_impianto
  const sala = estremiDn([d?.dn_sala_min, d?.dn_sala_max])
  if (!sala) return []

  const righe = [`Collegamenti effettuati con tubazioni da ${misuraDn(sala)}`]
  const distribuzione = estremiDn([d?.dn_distribuzione_min, d?.dn_distribuzione_max])
  if (distribuzione) righe.push(`Linee effettuate con tubazioni da ${misuraDn(distribuzione)}`)
  return righe
}

/** Il motore può generare solo se c'è almeno un collegamento compressore→serbatoio dichiarato. */
export function puoGenerareSchema(input: BuildSchemaModelInput): boolean {
  const haCompressoreESerbatoio = (input.scheda.compressori?.length ?? 0) > 0 && (input.scheda.serbatoi?.length ?? 0) > 0
  const haCollegamenti = Object.values(input.collegamentiCompressoriSerbatoi).some((s) => s.length > 0)
  return haCompressoreESerbatoio && haCollegamenti
}
