/**
 * Traduzione delle scelte salvate dall'operatore (`additional_info.schemaPreferenze`) in ciò che
 * vale adesso, sulla scheda com'è adesso. Funzioni pure: qui vive tutta la logica del pannello
 * della finestra SCHEMA IMPIANTO, così il componente resta muto e provabile per lettura.
 *
 * Le preferenze invecchiano — un'apparecchiatura sparisce, un'altra compare, un gruppo by-pass
 * perde la contiguità — e questo modulo è l'unico posto che sa cosa farne. `pruneAdditionalInfo`
 * (utils/equipmentCodes.ts) toglie prima i riferimenti a codici che la scheda non ha più; qui si
 * fa il resto, che richiede di sapere l'ORDINE, informazione che lì non c'è.
 *
 * Difensivo di proposito: `schemaPreferenze` è dichiarato `z.any()` a Zod, quindi un dato storto
 * arriva fin qui invece di far fallire il salvataggio. Meglio ignorarlo che sollevare a metà
 * generazione dello schema.
 */
import type { SchemaPreferenze } from '@/services/relazione/types'
import type { SchedaDatiCompleta } from '@/types/technicalSheet'
import { ordinaCatenaTrattamento, scaricaCondensa } from './buildSchemaModel'
import type { SchemaNodo } from './types'

/** Le apparecchiature di scheda che entrano nello schema, divise per come si dispongono. */
export interface FamiglieSchema {
  compressori: SchemaNodo[]
  /**
   * Serbatoi e stadi di trattamento in un elenco solo, dal 20-08-2026: negli impianti reali un
   * filtro o un essiccatore può stare PRIMA del primo serbatoio, e con più serbatoi la linea può
   * alternarli. Due elenchi separati non sapevano dirlo, e il pannello non lasciava spostare una
   * riga da uno all'altro.
   */
  linea: SchemaNodo[]
}

export interface PreferenzeRisolte {
  /** Codici dei compressori, da sinistra a destra in sala. */
  ordineCompressori: string[]
  /**
   * La sequenza della linea — serbatoi e stadi insieme — nell'ordine in cui va disegnata da
   * sinistra a destra. È l'ordine che il generatore segue: `buildSchemaModel` collega gli
   * elementi due a due in quest'ordine, e `layoutSchema` li dispone nella stessa fila.
   */
  ordineLinea: string[]
  /**
   * I due sotto-elenchi di `ordineLinea` filtrati per tipo. **Non sono un ordine scelto**: si
   * derivano dalla sequenza, e servono a una cosa sola — tenere `improntaPreferenze` nello stesso
   * formato di prima del 20-08-2026, così le pratiche già consegnate non si vedono comparire
   * l'avviso «Rigenera da capo» solo perché il campo ha cambiato forma.
   */
  ordineSerbatoi: string[]
  ordineStadi: string[]
  /** Chi scarica condensa. Un `Set` e non una mappa: il default è già stato applicato. */
  condense: Set<string>
  /** Gruppi ancora validi, coi membri riordinati secondo `ordineLinea`. */
  bypass: { id: string; stadi: string[] }[]
  /** Id dei gruppi caduti perché non più contigui: da dire all'operatore, non da riparare. */
  bypassScartati: string[]
}

/** Nodo ridotto all'osso: al pannello e all'ordinamento servono id, tipo ed etichetta, non le
 *  valvole né gli accessori che `buildSchemaModel` ricostruisce per il disegno. */
function nodoLeggero(
  id: string,
  tipo: SchemaNodo['tipo'],
  descrizione: string,
  marca?: string,
  extra: Partial<SchemaNodo> = {}
): SchemaNodo {
  return {
    id,
    tipo,
    etichetta: [descrizione, marca?.trim()].filter(Boolean).join(' '),
    gruppo: 'SALA_COMPRESSORI',
    valvoleSicurezza: [],
    origine: 'scheda',
    ...extra,
  }
}

/**
 * Le due famiglie che il pannello mostra, **nell'ordine di default del generatore**.
 *
 * Sta qui e non nel componente perché il generatore dovrà partire dagli stessi elenchi: due
 * ordinamenti scritti in due posti divergerebbero al primo ritocco, e il pannello mostrerebbe una
 * sequenza che il disegno non rispetta.
 *
 * - **Compressori**: ordine di scheda. Non si riordinano fra loro nel disegno (stanno in fila in
 *   sala), ma servono in elenco per il flag delle condense.
 * - **Linea**: serbatoi e apparecchiature di trattamento in un elenco solo, dal 20-08-2026. I
 *   serbatoi vengono prima — ordinati per `ubicazione` in testa a `SALA_COMPRESSORI` (che è anche
 *   il valore assunto quando il campo manca, come in `buildSerbatoioNodi`), poi il resto, `sort`
 *   stabile — seguiti da `ordinaCatenaTrattamento`, la stessa funzione che ordina la catena nel
 *   modello, riusata e non riscritta. Riceve i nodi nello stesso ordine in cui `buildSchemaModel`
 *   li mette nell'array (essiccatori, filtri, separatori), perché quella funzione somma l'indice
 *   di arrivo al rango e con un ordine diverso darebbe un altro risultato. È solo il punto di
 *   partenza: l'operatore può poi intrecciare le due famiglie a piacere (`ordineLinea`).
 */
export function famiglieDaScheda(scheda: SchedaDatiCompleta): FamiglieSchema {
  const compressori = (scheda.compressori ?? []).map((c) => {
    // L'accessorio serve alla sola regola delle condense (`scaricaCondensa` legge
    // `Boolean(nodo.accessorio)`): sul compressore la condensa esce dal disoleatore. Senza questo
    // campo la regola condivisa risponderebbe «nessun compressore scarica» sui nodi leggeri —
    // mentendo al contrario di come mentiva il `() => true` del Blocco 1.
    const diso = (scheda.disoleatori ?? []).find((d) => d.compressore_associato === c.codice)
    return nodoLeggero(c.codice, 'compressore', 'Compressore', c.marca, {
      accessorio: diso
        ? { codice: diso.codice, etichetta: 'Serbatoio disoleatore', valvoleSicurezza: [] }
        : undefined,
    })
  })

  const serbatoi = [...(scheda.serbatoi ?? [])]
    .map((s, indice) => ({ s, indice }))
    .sort((a, b) => {
      const rango = (u?: string) => (u === 'SALA_COMPRESSORI' || !u ? 0 : 1)
      return rango(a.s.ubicazione) - rango(b.s.ubicazione) || a.indice - b.indice
    })
    .map(({ s }) =>
      nodoLeggero(s.codice, 'serbatoio', 'Serbatoio', s.marca, {
        orientamento: s.orientamento ?? 'VERTICALE',
      })
    )

  const stadiGrezzi = [
    ...(scheda.essiccatori ?? []).map((e) => nodoLeggero(e.codice, 'essiccatore', 'Essiccatore', e.marca)),
    ...(scheda.filtri ?? []).map((f) =>
      nodoLeggero(f.codice, 'filtro', 'Filtro', f.marca, { prefiltro: f.tipo === 'PREFILTRO' })
    ),
    ...(scheda.separatori ?? []).map((sep) => nodoLeggero(sep.codice, 'separatore', 'Separatore', sep.marca)),
  ]

  // L'ordine di DEFAULT resta quello di sempre — serbatoi in testa, poi la catena di trattamento
  // per rango di tipo — così una pratica che non apre il pannello genera come prima. La libertà
  // è una possibilità offerta, non un cambiamento imposto.
  return { compressori, linea: [...serbatoi, ...ordinaCatenaTrattamento(stadiGrezzi, null)] }
}

const elenco = (valore: unknown): string[] =>
  Array.isArray(valore) ? valore.filter((v): v is string => typeof v === 'string') : []

/**
 * Ordina secondo l'elenco salvato: prima chi è nominato, nell'ordine in cui è nominato, poi chi
 * non lo è — e questi ultimi **fra loro nell'ordine di default**, non in ordine di arrivo. Senza
 * quest'ultima regola due filtri aggiunti insieme comparirebbero invertiti, e l'operatore
 * dovrebbe riordinare qualcosa che non ha mai toccato.
 */
export function ordinaPerElenco<T extends { id: string }>(elementi: T[], salvato: string[] | undefined): T[] {
  const posizione = new Map(elenco(salvato).map((id, i) => [id, i]))
  return elementi
    .map((elemento, difetto) => ({ elemento, difetto, scelto: posizione.get(elemento.id) }))
    .sort((a, b) => {
      if (a.scelto !== undefined && b.scelto !== undefined) return a.scelto - b.scelto
      if (a.scelto !== undefined) return -1
      if (b.scelto !== undefined) return 1
      return a.difetto - b.difetto
    })
    .map((v) => v.elemento)
}

/**
 * Vero se i codici occupano posizioni consecutive nell'ordine dato. È la condizione perché un
 * by-pass sia disegnabile: due soli TEE, uno prima del primo scavalcato e uno dopo l'ultimo, non
 * possono saltare un'apparecchiatura in mezzo e rimetterla in linea.
 */
export function contigui(codici: string[], ordine: string[]): boolean {
  if (codici.length === 0) return false
  const posizioni = codici.map((c) => ordine.indexOf(c))
  if (posizioni.some((p) => p < 0)) return false
  const min = Math.min(...posizioni)
  const max = Math.max(...posizioni)
  return max - min + 1 === new Set(posizioni).size
}

/**
 * Il primo intero libero, non il successivo del massimo: sciogliendo `bp2` e ricreando un gruppo,
 * l'operatore si ritrova `bp2` invece di `bp3`, e gli id non crescono senza fine su una pratica
 * ritoccata a lungo.
 */
export function prossimoIdBypass(gruppi: { id: string }[]): string {
  const presi = new Set(
    gruppi.map((g) => Number(/^bp(\d+)$/.exec(g.id)?.[1])).filter((n) => Number.isInteger(n))
  )
  let n = 1
  while (presi.has(n)) n++
  return `bp${n}`
}

export function risolviPreferenze(
  preferenze: SchemaPreferenze | undefined,
  famiglie: FamiglieSchema
): PreferenzeRisolte {
  const p = (preferenze ?? {}) as SchemaPreferenze
  const ordineCompressori = ordinaPerElenco(famiglie.compressori, p.ordineCompressori).map((n) => n.id)

  // `ordineLinea` quando c'è; altrimenti si ricostruisce dai due campi di prima del 20-08-2026 —
  // ma elenco per FAMIGLIA, non concatenando i due elenchi grezzi. Il caso normale è una pratica
  // che ha salvato solo `ordineStadi` (il vecchio pannello scriveva quel campo da solo appena si
  // trascinava uno stadio, senza toccare `ordineSerbatoi`): concatenare `[...ordineSerbatoi,
  // ...ordineStadi]` nominerebbe solo gli stadi, e `ordinaPerElenco` spingerebbe in coda tutto
  // ciò che non è nominato — il serbatoio finirebbe in fondo alla linea invece che in testa.
  // Applicando l'elenco salvato alla propria famiglia, chi non è nominato resta al posto di
  // default DENTRO la sua famiglia — serbatoi sempre in testa, come faceva il codice prima del
  // 20-08-2026 — e le due famiglie si concatenano solo alla fine, già ciascuna ordinata.
  const serbatoiFam = famiglie.linea.filter((n) => n.tipo === 'serbatoio')
  const stadiFam = famiglie.linea.filter((n) => n.tipo !== 'serbatoio')
  const salvato = elenco(p.ordineLinea).length > 0
    ? p.ordineLinea
    : [
        ...ordinaPerElenco(serbatoiFam, p.ordineSerbatoi).map((n) => n.id),
        ...ordinaPerElenco(stadiFam, p.ordineStadi).map((n) => n.id),
      ]
  const nodiLinea = ordinaPerElenco(famiglie.linea, salvato)
  const ordineLinea = nodiLinea.map((n) => n.id)
  const ordineSerbatoi = nodiLinea.filter((n) => n.tipo === 'serbatoio').map((n) => n.id)
  const ordineStadi = nodiLinea.filter((n) => n.tipo !== 'serbatoio').map((n) => n.id)

  // Chiave assente = regola per tipo: è ciò che rende indolore il passaggio da «selezione per
  // tipo» a «flag per apparecchiatura» su una pratica salvata prima che il pannello esistesse.
  const scelte = p.condense && typeof p.condense === 'object' ? p.condense : {}
  const condense = new Set<string>()
  for (const nodo of [...famiglie.compressori, ...famiglie.linea]) {
    const scelta = scelte[nodo.id]
    if (typeof scelta === 'boolean' ? scelta : scaricaCondensa(nodo)) condense.add(nodo.id)
  }

  const bypass: { id: string; stadi: string[] }[] = []
  const bypassScartati: string[] = []
  for (const gruppo of Array.isArray(p.bypass) ? p.bypass : []) {
    if (!gruppo || typeof gruppo.id !== 'string') continue
    // Riordinati secondo l'ordine risolto, non secondo com'erano salvati: l'operatore può aver
    // riordinato le righe dopo aver creato il gruppo, e il disegno segue l'ordine, non la memoria.
    const membri = ordineLinea.filter((id) => elenco(gruppo.stadi).includes(id))
    if (membri.length === 0) continue
    if (!contigui(membri, ordineLinea)) {
      bypassScartati.push(gruppo.id)
      continue
    }
    bypass.push({ id: gruppo.id, stadi: membri })
  }

  return { ordineCompressori, ordineLinea, ordineSerbatoi, ordineStadi, condense, bypass, bypassScartati }
}

/**
 * Impronta stabile delle preferenze risolte, per dire all'operatore «il disegno salvato è stato
 * generato con altre scelte: premi Rigenera da capo». Non entra in nessun calcolo geometrico.
 * Le condense si ordinano perché due oggetti uguali scritti in ordine diverso devono dare la
 * stessa impronta, o l'avviso comparirebbe da solo.
 */
export function improntaPreferenze(risolte: PreferenzeRisolte): string {
  // Le chiavi `stadi`/`serbatoi` restano quelle di prima del 20-08-2026, e restano in
  // quest'ORDINE: `JSON.stringify` scrive le chiavi come le trova, e una pratica non riordinata
  // deve produrre la stessa identica stringa di allora — o l'avviso «Rigenera da capo»
  // comparirebbe su ogni pratica già consegnata solo per il cambio di formato.
  //
  // `linea` si aggiunge in coda SOLO quando la sequenza intreccia serbatoi e stadi, cioè quando i
  // due sotto-elenchi filtrati per tipo non bastano più a descriverla: senza, spostare un filtro
  // davanti a un serbatoio non cambierebbe nessuna delle due liste, e l'avviso non comparirebbe
  // mai proprio sul riordino che questo blocco è nato per permettere.
  const canonica = [...risolte.ordineSerbatoi, ...risolte.ordineStadi]
  const intrecciata = risolte.ordineLinea.join(' ') !== canonica.join(' ')
  return JSON.stringify({
    compressori: risolte.ordineCompressori,
    stadi: risolte.ordineStadi,
    serbatoi: risolte.ordineSerbatoi,
    condense: [...risolte.condense].sort(),
    bypass: risolte.bypass.map((g) => ({ id: g.id, stadi: g.stadi })),
    ...(intrecciata ? { linea: risolte.ordineLinea } : {}),
  })
}

/**
 * Vero se il disegno salvato è stato generato con scelte diverse da quelle di adesso, cioè se
 * vale la pena dire all'operatore «premi *Rigenera da capo*».
 *
 * Cambiare ordine, spunte o gruppi **non ridisegna nulla** — è la promessa fatta al committente,
 * per non buttare via il lavoro fatto a mano sulla tela. Senza un avviso, però, quella promessa
 * diventa una trappola: l'operatore compone un by-pass, non vede cambiare niente e non sa perché.
 *
 * **Senza impronta salvata è FALSO**, non vero: è il caso di ogni pratica salvata prima che il
 * campo esistesse, e non si annuncia un cambiamento che non si sa se c'è stato. Vale anche per
 * una stringa vuota, che `additional_info` può portare — Zod lo dichiara permissivo.
 *
 * Sta qui, sotto un test di funzione pura, e non nel componente che mostra l'avviso: la
 * convenzione del progetto è nessun test di interfaccia, e nel componente il confronto finirebbe
 * fuori dalla copertura.
 */
export function preferenzeDaRiapplicare(
  improntaSalvata: string | undefined,
  risolte: PreferenzeRisolte
): boolean {
  if (!improntaSalvata) return false
  return improntaSalvata !== improntaPreferenze(risolte)
}

/**
 * Le preferenze che valgono adesso, partendo dalla scheda. **L'unico ingresso** per chi ha in mano
 * una scheda: pannello e generatore devono passare di qui, o le due strade tornerebbero a
 * divergere sul default delle condense — il difetto che il Blocco 1 aveva lasciato aperto.
 */
export function preferenzeRisolteDaScheda(
  scheda: SchedaDatiCompleta,
  preferenze: SchemaPreferenze | undefined
): PreferenzeRisolte {
  return risolviPreferenze(preferenze, famiglieDaScheda(scheda))
}

/**
 * I collegamenti compressori→serbatoi che valgono adesso, partendo dalla scheda. Stessa regola
 * di `condense` in `risolviPreferenze`: **chiave assente = default** (tutti i compressori
 * collegati al primo serbatoio — il caso più comune, un solo serbatoio in sala), **chiave
 * presente, anche vuota = vince quella**. È la distinzione che permette all'operatore di
 * lasciare deliberatamente un compressore scollegato: se ogni salvataggio venisse riletto come
 * "vuoto = ancora da scegliere", quella scelta non potrebbe mai restare.
 *
 * Difetto trovato su una pratica vera (BADOER INFISSI, 18-08-2026): i campi nascevano vuoti e
 * bastava compilarne uno perché `puoGenerareSchema` desse via libera — con il secondo
 * compressore rimasto invisibile nel disegno, senza che nulla lo segnalasse.
 *
 * Non pota gli id salvati per compressori spariti dalla scheda: è il lavoro di
 * `potaCollegamenti` (equipmentCodes.ts), contro i codici correnti dell'intera pratica, non
 * solo dei compressori. Qui si risponde solo per i compressori che la scheda ha ADESSO.
 */
export function collegamentiRisolti(
  scheda: SchedaDatiCompleta,
  salvato: Record<string, string[]> | undefined
): Record<string, string[]> {
  const primoSerbatoio = scheda.serbatoi?.[0]?.codice
  const risolti: Record<string, string[]> = {}
  for (const compressore of scheda.compressori ?? []) {
    const scelta = salvato?.[compressore.codice]
    risolti[compressore.codice] = scelta ?? (primoSerbatoio ? [primoSerbatoio] : [])
  }
  return risolti
}
