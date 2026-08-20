# Ordine libero della linea nello schema d'impianto — piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fondere serbatoi e stadi di trattamento in un'unica sequenza liberamente ordinabile, così che filtri ed essiccatori possano precedere il primo serbatoio e alternarsi ai serbatoi lungo la linea.

**Architecture:** Le preferenze passano da due ordini separati (`ordineSerbatoi`, `ordineStadi`) a un unico `ordineLinea`, ricostruito dai due vecchi campi per le pratiche già salvate. Il generatore degli archi collega la sequenza elemento-per-elemento senza distinguere il tipo, e manda la tubazione del compressore al primo elemento qualunque esso sia. Il layout fonde le due righe (serbatoi, catena) in una sola, disposta per ancore ma con i serbatoi ancora appoggiati alla quota di base.

**Tech Stack:** TypeScript (strict=false), Vitest, React 18 + MUI 6, `@dnd-kit` per il trascinamento.

**Spec:** [`docs/superpowers/specs/2026-08-20-ordine-libero-linea-schema-design.md`](../specs/2026-08-20-ordine-libero-linea-schema-design.md)

## Global Constraints

- **Nessun test di interfaccia.** La convenzione del progetto è provare la logica nei moduli puri; i componenti React impaginano e basta. Il Task 4 non porta test propri: la sua logica è già coperta dai Task 1–3.
- **Nessun gesto nel pannello ridisegna nulla.** Le preferenze si applicano solo con «Rigenera da capo». Promessa fatta al committente, non negoziabile.
- **`collegamentiCompressoriSerbatoi` conserva il significato attuale** (quale compressore alimenta quale serbatoio) perché `services/relazione/engine/valvole.ts` ne ricava la portata delle valvole di sicurezza. Cambia solo dove la mandata viene *disegnata*.
- **Le pratiche con UN serbatoio devono riaprirsi identiche**: stesso ordine, stesso disegno al pixel, nessun avviso «Rigenera da capo» spurio.
- **Le pratiche con PIÙ serbatoi cambiano disegno, ed è voluto.** Oggi solo il primo serbatoio apre la linea e gli altri restano accumulatori paralleli, ciascuno collegato ai suoi compressori; con la sequenza unificata i serbatoi entrano tutti in catena e le mandate convergono sulla testa (decisioni 2 e 4 della spec). Non è una regressione da riparare: è il cambiamento richiesto. Va però **verificato su una pratica vera prima di chiudere** (Task 5) e detto al committente, perché tocca disegni già consegnati.
- **Comandi di verifica:** `npx tsc --noEmit`, `npx vitest run`, `npx eslint src`. Verdi tutti e tre prima di considerare chiuso il lavoro.
- **Commenti in italiano**, nello stile del modulo che si tocca: si scrive *perché*, non *cosa*.

---

### Task 1: `ordineLinea` — tipo, risoluzione e migrazione

Il cuore del cambiamento. `FamiglieSchema` passa da tre famiglie a due (`compressori`, `linea`), e `risolviPreferenze` produce un `ordineLinea` unico. Per non far comparire l'avviso «Rigenera da capo» su ogni pratica consegnata, `PreferenzeRisolte` continua a esporre `ordineSerbatoi`/`ordineStadi` **derivati per tipo** dalla sequenza, e `improntaPreferenze` li usa come prima.

**Files:**
- Modify: `src/services/relazione/types.ts:45-59` (`SchemaPreferenze`)
- Modify: `src/services/schemaImpianto/preferenze.ts:20-39` (`FamiglieSchema`, `PreferenzeRisolte`), `:78-113` (`famiglieDaScheda`), `:165-215` (`risolviPreferenze`, `improntaPreferenze`)
- Test: `src/services/schemaImpianto/__tests__/preferenze.test.ts`

**Interfaces:**
- Consumes: niente (primo task).
- Produces:
  - `SchemaPreferenze.ordineLinea?: string[]`
  - `FamiglieSchema = { compressori: SchemaNodo[]; linea: SchemaNodo[] }`
  - `PreferenzeRisolte.ordineLinea: string[]` — la sequenza da disegnare
  - `PreferenzeRisolte.ordineSerbatoi: string[]` / `.ordineStadi: string[]` — derivati per tipo da `ordineLinea`, solo per l'impronta
  - `famiglieDaScheda(scheda): FamiglieSchema`
  - `risolviPreferenze(preferenze, famiglie): PreferenzeRisolte`

- [ ] **Step 1: Aggiungi `ordineLinea` al tipo delle preferenze**

In `src/services/relazione/types.ts`, dentro `SchemaPreferenze`, sostituisci i due campi d'ordine con tre (i vecchi restano in sola lettura, per le pratiche salvate):

```ts
  /** Ordine dei compressori in sala, da sinistra a destra. Default: ordine di scheda. */
  ordineCompressori?: string[]
  /**
   * Ordine della linea: serbatoi e stadi di trattamento insieme, da sinistra a destra. Dal
   * 20-08-2026 è UN elenco solo, perché filtri ed essiccatori possono precedere il primo
   * serbatoio e alternarsi ai serbatoi lungo la linea — cosa che due elenchi separati non
   * sapevano esprimere. Chi non è nominato segue in coda, nell'ordine di default.
   */
  ordineLinea?: string[]
  /**
   * @deprecated Sostituiti da `ordineLinea` il 20-08-2026. Si LEGGONO ancora — è da qui che
   * `risolviPreferenze` ricostruisce la sequenza delle pratiche salvate prima — ma non si
   * scrivono più. Toglierli farebbe perdere l'ordine a ogni pratica già consegnata.
   */
  ordineStadi?: string[]
  /** @deprecated Vedi `ordineStadi`. */
  ordineSerbatoi?: string[]
```

- [ ] **Step 2: Scrivi i test che falliscono per la nuova risoluzione**

In `src/services/schemaImpianto/__tests__/preferenze.test.ts`, sostituisci la costante `famiglie` in testa al file (riga 37) e aggiungi il blocco di test. Le famiglie ora sono due:

```ts
const linea = [
  nodo('S1', 'serbatoio'),
  nodo('S2', 'serbatoio'),
  nodo('F1'),
  nodo('E1', 'essiccatore'),
  nodo('F2'),
  nodo('F3'),
]
const famiglie = { compressori, linea }
```

```ts
describe('ordineLinea', () => {
  it('senza preferenze mette i serbatoi in testa e gli stadi di seguito', () => {
    const r = risolviPreferenze(undefined, famiglie)
    expect(r.ordineLinea).toEqual(['S1', 'S2', 'F1', 'E1', 'F2', 'F3'])
  })

  it('accetta uno stadio prima del primo serbatoio', () => {
    const r = risolviPreferenze({ ordineLinea: ['F1', 'S1', 'E1', 'S2'] }, famiglie)
    expect(r.ordineLinea).toEqual(['F1', 'S1', 'E1', 'S2', 'F2', 'F3'])
  })

  it('ricostruisce la sequenza dai due campi vecchi quando ordineLinea manca', () => {
    // Ogni pratica salvata prima del 20-08-2026: deve riaprirsi con lo stesso ordine di allora,
    // cioè serbatoi e poi stadi, ciascuno nel proprio ordine salvato.
    const r = risolviPreferenze({ ordineSerbatoi: ['S2', 'S1'], ordineStadi: ['F2', 'F1'] }, famiglie)
    expect(r.ordineLinea).toEqual(['S2', 'S1', 'F2', 'F1', 'E1', 'F3'])
  })

  it('ordineLinea vince sui due campi vecchi quando ci sono entrambi', () => {
    const r = risolviPreferenze(
      { ordineLinea: ['F1', 'S1'], ordineSerbatoi: ['S2', 'S1'], ordineStadi: ['F3'] },
      famiglie
    )
    expect(r.ordineLinea.slice(0, 2)).toEqual(['F1', 'S1'])
  })

  it('espone serbatoi e stadi derivati per tipo dalla sequenza', () => {
    const r = risolviPreferenze({ ordineLinea: ['F1', 'S2', 'E1', 'S1'] }, famiglie)
    expect(r.ordineSerbatoi).toEqual(['S2', 'S1'])
    expect(r.ordineStadi).toEqual(['F1', 'E1', 'F2', 'F3'])
  })

  it('valuta la contiguità dei by-pass sulla sequenza unificata', () => {
    // S1 sta in mezzo: E1 e F1 non sono più attaccati, il gruppo cade.
    const r = risolviPreferenze(
      { ordineLinea: ['E1', 'S1', 'F1'], bypass: [{ id: 'bp1', stadi: ['E1', 'F1'] }] },
      famiglie
    )
    expect(r.bypass).toEqual([])
    expect(r.bypassScartati).toEqual(['bp1'])
  })

  it('tiene un by-pass che scavalca un serbatoio, se è contiguo', () => {
    const r = risolviPreferenze(
      { ordineLinea: ['F1', 'S1', 'E1'], bypass: [{ id: 'bp1', stadi: ['S1', 'E1'] }] },
      famiglie
    )
    expect(r.bypass).toEqual([{ id: 'bp1', stadi: ['S1', 'E1'] }])
  })

  it('tiene un by-pass su una sola apparecchiatura', () => {
    const r = risolviPreferenze({ bypass: [{ id: 'bp1', stadi: ['E1'] }] }, famiglie)
    expect(r.bypass).toEqual([{ id: 'bp1', stadi: ['E1'] }])
  })
})

describe('impronta e pratiche migrate', () => {
  it('una pratica migrata non produce un avviso spurio', () => {
    // L'impronta salvata è quella scritta col formato vecchio; la sequenza ricostruita dai due
    // campi è la stessa di allora, quindi l'impronta deve combaciare e l'avviso «Rigenera da
    // capo» non deve comparire su una pratica che nessuno ha toccato.
    const salvate = { ordineSerbatoi: ['S1', 'S2'], ordineStadi: ['F1', 'E1', 'F2', 'F3'] }
    const risolte = risolviPreferenze(salvate, famiglie)
    const improntaVecchia = JSON.stringify({
      compressori: ['C1', 'C2'],
      stadi: ['F1', 'E1', 'F2', 'F3'],
      serbatoi: ['S1', 'S2'],
      condense: [...risolte.condense].sort(),
      bypass: [],
    })
    expect(preferenzeDaRiapplicare(improntaVecchia, risolte)).toBe(false)
  })

  it('un intreccio fra serbatoi e stadi cambia l’impronta', () => {
    // Filtrando per tipo, ['F1','S1'] e ['S1','F1'] darebbero gli stessi due sotto-elenchi:
    // senza la chiave `linea` l'avviso non comparirebbe mai su un riordino di questo tipo.
    const dritta = risolviPreferenze({ ordineLinea: ['S1', 'S2', 'F1', 'E1', 'F2', 'F3'] }, famiglie)
    const intrecciata = risolviPreferenze({ ordineLinea: ['F1', 'S1', 'S2', 'E1', 'F2', 'F3'] }, famiglie)
    expect(improntaPreferenze(dritta)).not.toBe(improntaPreferenze(intrecciata))
  })
})
```

Aggiorna anche i test già presenti che nominano `famiglie` con tre campi o `r.ordineStadi`/`r.ordineSerbatoi` come ordini *scelti*: `risolviPreferenze` → `'senza preferenze usa i default'` (righe 137-146) ora si aspetta `ordineLinea`, e il caso `'scarta un gruppo che ha perso la contiguità'` (righe 186-194) passa `ordineLinea: ['E1','F1','F2','F3']` al posto di `ordineStadi`. Il blocco `famiglieDaScheda` (righe 39-77) va aggiornato: `.serbatoi` e `.stadi` diventano un solo `.linea`.

- [ ] **Step 3: Esegui i test e verifica che falliscano**

Run: `npx vitest run src/services/schemaImpianto/__tests__/preferenze.test.ts`
Expected: FAIL — `ordineLinea` non esiste su `PreferenzeRisolte`, `famiglie.linea` non è letto da `risolviPreferenze`.

- [ ] **Step 4: Riscrivi `FamiglieSchema` e `famiglieDaScheda`**

In `src/services/schemaImpianto/preferenze.ts`, sostituisci l'interfaccia (righe 20-25):

```ts
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
```

E il `return` di `famiglieDaScheda` (riga 112), lasciando invariato tutto il calcolo che lo precede:

```ts
  // L'ordine di DEFAULT resta quello di sempre — serbatoi in testa, poi la catena di trattamento
  // per rango di tipo — così una pratica che non apre il pannello genera come prima. La libertà
  // è una possibilità offerta, non un cambiamento imposto.
  return { compressori, linea: [...serbatoi, ...ordinaCatenaTrattamento(stadiGrezzi, null)] }
```

- [ ] **Step 5: Riscrivi `risolviPreferenze` e `improntaPreferenze`**

Sostituisci l'intestazione di `PreferenzeRisolte` (righe 27-39):

```ts
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
```

Nel corpo di `risolviPreferenze` sostituisci le righe 170-172 e il ciclo delle condense (riga 178), e il blocco `bypass` (riga 189-191) che valuta la contiguità:

```ts
  const ordineCompressori = ordinaPerElenco(famiglie.compressori, p.ordineCompressori).map((n) => n.id)

  // `ordineLinea` quando c'è; altrimenti si ricostruisce dai due campi di prima del 20-08-2026,
  // nell'ordine serbatoi-poi-stadi che è esattamente la sequenza che quelle pratiche hanno. Una
  // pratica salvata prima si riapre così com'era, senza che nessuno debba riordinarla a mano.
  const salvato = elenco(p.ordineLinea).length > 0
    ? p.ordineLinea
    : [...elenco(p.ordineSerbatoi), ...elenco(p.ordineStadi)]
  const nodiLinea = ordinaPerElenco(famiglie.linea, salvato)
  const ordineLinea = nodiLinea.map((n) => n.id)
  const ordineSerbatoi = nodiLinea.filter((n) => n.tipo === 'serbatoio').map((n) => n.id)
  const ordineStadi = nodiLinea.filter((n) => n.tipo !== 'serbatoio').map((n) => n.id)
```

```ts
  for (const nodo of [...famiglie.compressori, ...famiglie.linea]) {
```

```ts
    const membri = ordineLinea.filter((id) => elenco(gruppo.stadi).includes(id))
    if (membri.length === 0) continue
    if (!contigui(membri, ordineLinea)) {
```

E il `return` finale:

```ts
  return { ordineCompressori, ordineLinea, ordineSerbatoi, ordineStadi, condense, bypass, bypassScartati }
```

Poi `improntaPreferenze` (righe 207-215):

```ts
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
  const intrecciata = risolte.ordineLinea.join(' ') !== canonica.join(' ')
  return JSON.stringify({
    compressori: risolte.ordineCompressori,
    stadi: risolte.ordineStadi,
    serbatoi: risolte.ordineSerbatoi,
    condense: [...risolte.condense].sort(),
    bypass: risolte.bypass.map((g) => ({ id: g.id, stadi: g.stadi })),
    ...(intrecciata ? { linea: risolte.ordineLinea } : {}),
  })
}
```

- [ ] **Step 6: Esegui i test e verifica che passino**

Run: `npx vitest run src/services/schemaImpianto/__tests__/preferenze.test.ts`
Expected: PASS. Se `buildSchemaModel.test.ts` o il pannello non compilano è atteso — li sistemano i Task 2 e 4.

- [ ] **Step 7: Commit**

```bash
git add src/services/relazione/types.ts src/services/schemaImpianto/preferenze.ts src/services/schemaImpianto/__tests__/preferenze.test.ts
git commit -m "feat(schema): ordine unico della linea nelle preferenze

Serbatoi e stadi in un solo ordineLinea, ricostruito dai due campi vecchi
per le pratiche salvate. L'impronta resta nel formato di prima quando la
sequenza non intreccia le due famiglie, cosi' le pratiche consegnate non
vedono comparire l'avviso di rigenerazione."
```

---

### Task 2: Archi sulla sequenza unificata

`buildArchi` smette di trattare "serbatoio → stadi" come due tronconi. La mandata dei compressori punta al primo elemento della sequenza (decisione 4 della spec) e gli archi di linea collegano gli elementi a due a due fino alle utenze.

**Files:**
- Modify: `src/services/schemaImpianto/buildSchemaModel.ts:299-312` (`ancoraMandata`), `:322-509` (`buildArchi`), `:511-562` (`perElenco`, `buildSchemaModel`)
- Test: `src/services/schemaImpianto/__tests__/buildSchemaModel.test.ts`

**Interfaces:**
- Consumes: `PreferenzeRisolte.ordineLinea` (Task 1).
- Produces: nessuna firma pubblica nuova. `ordinaCatenaTrattamento` resta esportata e invariata (la usa `preferenze.ts` per il default e `layout.ts` per gli orfani).

- [ ] **Step 1: Scrivi i test che falliscono**

In `src/services/schemaImpianto/__tests__/buildSchemaModel.test.ts`, aggiungi in coda:

```ts
describe('ordine libero della linea', () => {
  const scheda = makeScheda({
    compressori: [makeCompressore({ codice: 'C1' })],
    serbatoi: [makeSerbatoio({ codice: 'S1', ubicazione: 'SALA_COMPRESSORI' })],
    filtri: [makeFiltro({ codice: 'F1', tipo: 'PREFILTRO' })],
    essiccatori: [makeEssiccatore({ codice: 'E1' })],
    dati_impianto: makeDatiImpianto({ raccolta_condense: 'nessuna' }),
  })

  /** Gli archi d'aria come coppie «da → a», per leggere la catena a colpo d'occhio. */
  const aria = (model: SchemaModel) =>
    model.archi.filter((a) => a.stile !== 'condensa').map((a) => `${a.da.nodo}>${a.a.nodo}`)

  it('con un filtro in testa, la mandata del compressore arriva al filtro', () => {
    const model = buildSchemaModel({
      scheda,
      collegamentiCompressoriSerbatoi: { C1: ['S1'] },
      preferenze: preferenzeRisolteDaScheda(scheda, { ordineLinea: ['F1', 'S1', 'E1'] }),
    })
    const mandata = model.archi.find((a) => a.stile === 'flessibile')
    expect(mandata?.da.nodo).toBe('C1')
    expect(mandata?.a.nodo).toBe('F1')
  })

  it('collega la sequenza in serie fino alle utenze', () => {
    const model = buildSchemaModel({
      scheda,
      collegamentiCompressoriSerbatoi: { C1: ['S1'] },
      preferenze: preferenzeRisolteDaScheda(scheda, { ordineLinea: ['F1', 'S1', 'E1'] }),
    })
    expect(aria(model)).toEqual(['C1>F1', 'F1>S1', 'S1>E1', 'E1>UTENZE'])
  })

  it('senza preferenze resta la sequenza di sempre: serbatoio, poi gli stadi', () => {
    // Non-regressione: una pratica che non ha mai aperto il pannello genera come prima.
    const model = buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })
    expect(aria(model)).toEqual(['C1>S1', 'S1>F1', 'F1>E1', 'E1>UTENZE'])
  })

  it('la mandata si aggancia all’ancora sx del rombo quando la testa è uno stadio', () => {
    // `sx-basso` non esiste sul rombo: chiederlo comunque farebbe ripiegare `posizioneAncora`
    // sul centro del simbolo, cioè un tubo attaccato in mezzo alla sagoma.
    const model = buildSchemaModel({
      scheda,
      collegamentiCompressoriSerbatoi: { C1: ['S1'] },
      preferenze: preferenzeRisolteDaScheda(scheda, { ordineLinea: ['F1', 'S1', 'E1'] }),
    })
    expect(model.archi.find((a) => a.stile === 'flessibile')?.a.ancora).toBe('sx')
  })

  it('un by-pass che scavalca un serbatoio produce i suoi due TEE e il ponte', () => {
    const model = buildSchemaModel({
      scheda,
      collegamentiCompressoriSerbatoi: { C1: ['S1'] },
      preferenze: preferenzeRisolteDaScheda(scheda, {
        ordineLinea: ['F1', 'S1', 'E1'],
        bypass: [{ id: 'bp1', stadi: ['S1'] }],
      }),
    })
    expect(model.nodi.map((n) => n.id)).toEqual(expect.arrayContaining(['BP1-IN', 'BP1-OUT']))
    const ponte = model.archi.find((a) => a.forma === 'ponte')
    expect(ponte?.da.nodo).toBe('BP1-IN')
    expect(ponte?.a.nodo).toBe('BP1-OUT')
  })
})
```

Aggiungi agli import in testa al file quelli che mancano: `makeEssiccatore` da `@/services/relazione/__tests__/fixtures`, `preferenzeRisolteDaScheda` da `../preferenze`, e il tipo `SchemaModel` da `../types`.

- [ ] **Step 2: Esegui i test e verifica che falliscano**

Run: `npx vitest run src/services/schemaImpianto/__tests__/buildSchemaModel.test.ts`
Expected: FAIL — la mandata punta a `S1` invece che a `F1`, e la catena esclude i serbatoi.

- [ ] **Step 3: Generalizza `ancoraMandata`**

Sostituisci la funzione (righe 299-312):

```ts
/**
 * L'ancora a cui arriva la mandata del compressore. Sul serbatoio è quella BASSA, come nei disegni
 * di riferimento — la dorsale scende con un gradino e si aggancia al fianco in basso, non a 160
 * unita' piu' in alto (convenzione 2). Su uno stadio di trattamento — dal 20-08-2026 la testa
 * della linea può essere un filtro o un essiccatore — quell'ancora non esiste, e si usa `sx`.
 *
 * Si legge l'ESISTENZA dell'ancora, mai la sua geometria: `sx-basso` non c'e' sul serbatoio
 * ORIZZONTALE (symbols/index.ts), non c'e' sul rombo, e una taratura permanente puo' toglierlo
 * anche al verticale. Chiederlo comunque farebbe ripiegare `posizioneAncora` sul centro del corpo
 * — un tubo attaccato in mezzo alla pancia: sbagliato ma plausibile, il peggior tipo di errore.
 */
function ancoraMandata(testa: SchemaNodo | undefined, libreria: Tarature): string {
  if (!testa) return 'sx'
  return ancoraDi(testa, 'sx-basso', libreria) ? 'sx-basso' : 'sx'
}
```

- [ ] **Step 4: Riscrivi il corpo di `buildArchi`**

In `buildArchi`, sostituisci il blocco che va dalla costruzione della catena (riga 388) fino alla chiusura dell'arco verso le utenze (riga 455). Le mandate dei compressori si spostano DOPO la costruzione della sequenza, perché ora devono sapere qual è il primo elemento:

```ts
  // L'ordine scelto dall'operatore vince su quello di default; senza preferenze resta serbatoi in
  // testa e poi `ordinaCatenaTrattamento`, il generatore di sempre.
  const serbatoiDiScheda = nodi.filter((n) => n.tipo === 'serbatoio' && n.id !== raccoltaCondense?.id)
  const lineaDiDefault = [...serbatoiDiScheda, ...ordinaCatenaTrattamento(nodi, raccoltaCondense)]
  const catenaLinea = input.preferenze
    ? input.preferenze.ordineLinea
        .map((id) => lineaDiDefault.find((n) => n.id === id))
        .filter((n): n is SchemaNodo => Boolean(n))
    : lineaDiDefault

  // Le giunzioni dei by-pass entrano nella sequenza della linea: da qui in giu' si ragiona sulla
  // SEQUENZA (elementi e TEE insieme), non piu' sulla catena dei soli stadi. Un gruppo non
  // contiguo, vuoto o su elementi che la linea non ha cade qui senza rumore (vedi `bypass.ts`).
  const { sequenza, ponti } = linearizzaConBypass(catenaLinea, input.preferenze?.bypass ?? [])

  // Convenzione 6: la valvola di riserva e' quella con cui l'operatore isola la sezione. Con un
  // by-pass che scavalca il primo (o l'ultimo) elemento quella valvola c'e' gia' sul ponte, e
  // metterne una seconda a un passo di distanza e' cio' che nei riferimenti non si vede.
  const capoDiTee = (nodo: SchemaNodo | undefined) => nodo?.tipo === 'giunzione'

  // **La testa della linea, non il primo serbatoio**: dal 20-08-2026 la mandata del compressore
  // arriva a cio' che sta per primo nella sequenza, qualunque sia il suo tipo. Un filtro si mette
  // davanti proprio perche' l'aria ci passi PRIMA di entrare nel serbatoio, e disegnare la mandata
  // sul serbatoio la farebbe scavalcare il filtro che l'operatore ha appena messo in testa.
  //
  // `collegamentiCompressoriSerbatoi` non cambia significato: resta «quale compressore alimenta
  // quale serbatoio», ed e' da li' che `engine/valvole.ts` ricava la portata delle valvole di
  // sicurezza. Qui se ne legge solo QUANTE mandate disegnare e da quale compressore partono.
  const testa = sequenza[0]
  for (const [compressoreId, serbatoiIds] of Object.entries(input.collegamentiCompressoriSerbatoi)) {
    if (serbatoiIds.length === 0 || !testa) continue
    archi.push({
      id: prossimoId('flex'),
      da: { nodo: compressoreId, ancora: 'alto-out' },
      a: { nodo: testa.id, ancora: ancoraMandata(testa, libreria) },
      stile: 'flessibile',
      // Il montante sale flessibile fino alla valvola, e da li' in su e' rigido (convenzione 1):
      // il vertice 1 della rotta flessibile e' il punto in cui il montante incontra la dorsale,
      // e lo scarto e' quanto la valvola sta sotto di essa.
      segni: [valvolaAlVertice(1, 'standard')],
    })
  }

  // Gli elementi della sequenza si collegano a due a due, senza piu' distinguere il tipo: un
  // serbatoio in mezzo alla linea riceve e manda sulle stesse ancore `sx`/`dx` di uno stadio.
  for (let i = 0; i < sequenza.length - 1; i++) {
    // Dal capo di MONTE di un by-pass la linea esce dal BASSO: quel TEE sta alla quota
    // dell'uscita del serbatoio (Blocco 5) e il tubo scende sulla sua ascissa fino alla punta
    // dell'elemento scavalcato. E' il LATO imposto a dare la forma.
    const dalCapoDiMonte = eCapoDiMonte(sequenza[i].id)
    // La valvola di riserva sta sul PRIMO tratto della linea (convenzione 6), cioè quello che
    // esce dalla testa: prima del 20-08-2026 era l'arco «serbatoio → primo stadio», che è lo
    // stesso tratto detto quando la testa era per forza un serbatoio.
    const primoTratto = i === 0 && !capoDiTee(sequenza[0])
    archi.push({
      id: prossimoId('std'),
      da: { nodo: sequenza[i].id, ancora: dalCapoDiMonte ? 'basso' : 'dx' },
      a: { nodo: sequenza[i + 1].id, ancora: 'sx' },
      stile: 'standard',
      ...(dalCapoDiMonte
        ? { segni: [valvolaAlVertice(0, 'flessibile', 1)] }
        : primoTratto
          ? { segni: valvolaDiRiserva() }
          : {}),
    })
  }

  // Tubazione finale verso le utenze. Il nodo esiste solo se ha da chi partire, quindi qui si
  // decide anche se `buildSchemaModel` deve aggiungerlo (vedi `sorgente`, sotto).
  const ultimo = sequenza[sequenza.length - 1]
  if (ultimo) {
    archi.push({
      id: prossimoId('ut'),
      da: { nodo: ultimo.id, ancora: 'dx' },
      a: { nodo: ID_UTENZE, ancora: 'in' },
      stile: 'standard',
      ...(capoDiTee(ultimo) ? {} : { segni: valvolaDiRiserva() }),
    })
  }
```

- [ ] **Step 5: Allinea `buildSchemaModel` alla sequenza**

`perElenco` non serve più per i serbatoi (l'ordine lo decide `ordineLinea` dentro `buildArchi`), ma l'ARRAY dei nodi deve comunque rispettarlo: `layoutSchema` filtra per tipo e dispone nell'ordine in cui li trova. Sostituisci il blocco `nodi` (righe 530-539):

```ts
  const nodi: SchemaNodo[] = [
    ...perElenco(
      input.preferenze?.ordineCompressori,
      (scheda.compressori ?? []).map((c) => buildCompressoreNodo(c, scheda, valvoleImpianto))
    ),
    // Un elenco solo per tutta la linea, dal 20-08-2026: `perElenco` con `ordineLinea` mette i
    // serbatoi e gli stadi nell'ordine scelto dall'operatore, intrecciati come li ha voluti.
    ...perElenco(input.preferenze?.ordineLinea, [
      ...buildSerbatoioNodi(scheda, valvoleImpianto),
      ...(scheda.essiccatori ?? []).map((e) => buildEssiccatoreNodo(e, scheda)),
      ...(scheda.filtri ?? []).map((f) => buildFiltroNodo(f, scheda)),
      ...(scheda.separatori ?? []).map(buildSeparatoreNodo),
    ]),
  ]
```

- [ ] **Step 6: Esegui i test e verifica che passino**

Run: `npx vitest run src/services/schemaImpianto/__tests__/buildSchemaModel.test.ts`
Expected: PASS, compresi i test preesistenti sui by-pass e sulle condense.

- [ ] **Step 7: Commit**

```bash
git add src/services/schemaImpianto/buildSchemaModel.ts src/services/schemaImpianto/__tests__/buildSchemaModel.test.ts
git commit -m "feat(schema): collega la linea nell'ordine scelto, testa compresa

La mandata del compressore arriva al primo elemento della sequenza invece
che al primo serbatoio, e gli archi di linea collegano gli elementi due a
due senza distinguere il tipo. I collegamenti compressori->serbatoi
conservano il significato che hanno per il calcolo delle valvole."
```

---

### Task 3: Layout — catena dagli archi e riga unica

`catenaDagliArchi` deve comprendere i serbatoi e trovare la testa dagli archi (lavora anche su layout ritoccati a mano, dove le preferenze non arrivano). `layoutSchema` fonde le due righe in una.

**Files:**
- Modify: `src/services/schemaImpianto/layout.ts:415-455` (`disponiCatenaPerAncore`), `:472-483` (`quotaLineaProcesso`), `:501-536` (`catenaDagliArchi`), `:538-630` (`layoutSchema`)
- Test: `src/services/schemaImpianto/__tests__/layout.test.ts`

**Interfaces:**
- Consumes: gli archi prodotti dal Task 2.
- Produces:
  - `catenaDagliArchi(model: SchemaModel, pozzo: SchemaNodo | null): SchemaNodo[]` — firma invariata, ora comprende i serbatoi e include il nodo di testa
  - `quotaLineaProcesso(testa: SchemaNodo | undefined, yBase: number, ripiego: number, libreria?: Tarature, catena?: SchemaNodo[]): number` — **firma cambiata**: riceve il nodo non posizionato e la quota di base

- [ ] **Step 1: Scrivi i test che falliscono**

In `src/services/schemaImpianto/__tests__/layout.test.ts`, aggiungi:

```ts
describe('linea con ordine libero', () => {
  const scheda = makeScheda({
    compressori: [makeCompressore({ codice: 'C1' })],
    serbatoi: [makeSerbatoio({ codice: 'S1', ubicazione: 'SALA_COMPRESSORI' })],
    filtri: [makeFiltro({ codice: 'F1', tipo: 'PREFILTRO' })],
    essiccatori: [makeEssiccatore({ codice: 'E1' })],
    dati_impianto: makeDatiImpianto({ raccolta_condense: 'nessuna' }),
  })

  const modelConOrdine = (ordineLinea: string[]) =>
    buildSchemaModel({
      scheda,
      collegamentiCompressoriSerbatoi: { C1: ['S1'] },
      preferenze: preferenzeRisolteDaScheda(scheda, { ordineLinea }),
    })

  it('la catena comprende i serbatoi e parte dalla testa della mandata', () => {
    const model = modelConOrdine(['F1', 'S1', 'E1'])
    expect(catenaDagliArchi(model, null).map((n) => n.id)).toEqual(['F1', 'S1', 'E1'])
  })

  it('dispone gli elementi nell’ordine scelto, da sinistra a destra', () => {
    const layout = layoutSchema(modelConOrdine(['F1', 'S1', 'E1']))
    const x = (id: string) => layout.nodi.find((n) => n.id === id)!.x
    expect(x('F1')).toBeLessThan(x('S1'))
    expect(x('S1')).toBeLessThan(x('E1'))
  })

  it('il serbatoio resta appoggiato alla quota di base anche in mezzo alla linea', () => {
    // Disporlo «per ancore» come i rombi lo staccherebbe da terra: i due orientamenti hanno
    // l'ancora `sx` alla stessa quota relativa ma riquadri di altezza diversa.
    const dritta = layoutSchema(modelConOrdine(['S1', 'F1', 'E1']))
    const intrecciata = layoutSchema(modelConOrdine(['F1', 'S1', 'E1']))
    const base = (l: typeof dritta, id: string) => {
      const n = l.nodi.find((m) => m.id === id)!
      return n.y + dimensioniDi(n, {}).altezza
    }
    expect(base(intrecciata, 'S1')).toBe(base(dritta, 'S1'))
  })

  it('regge una linea senza serbatoi, col ripiego sulla quota di sempre', () => {
    // Già possibile prima del 20-08-2026 (`quotaLineaProcesso` aveva il ripiego): la mandata
    // arriva al primo stadio e nulla si rompe.
    const senzaSerbatoi = makeScheda({
      compressori: [makeCompressore({ codice: 'C1' })],
      serbatoi: [],
      filtri: [makeFiltro({ codice: 'F1', tipo: 'PREFILTRO' })],
      essiccatori: [makeEssiccatore({ codice: 'E1' })],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'nessuna' }),
    })
    const model = buildSchemaModel({ scheda: senzaSerbatoi, collegamentiCompressoriSerbatoi: { C1: [] } })
    const layout = layoutSchema(model)
    expect(layout.nodi.every((n) => Number.isFinite(n.x) && Number.isFinite(n.y))).toBe(true)
  })

  it('senza preferenze il disegno è identico a quello di prima', () => {
    // Non-regressione al pixel: una pratica mai riordinata non deve muoversi di un'unità.
    const model = buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })
    const layout = layoutSchema(model)
    const x = (id: string) => layout.nodi.find((n) => n.id === id)!.x
    expect(x('S1')).toBeLessThan(x('F1'))
    expect(x('F1')).toBeLessThan(x('E1'))
    // L'ancora `sx` di F1 cade a STACCO_SERBATOI_LINEA dal bordo destro di S1, come sempre.
    const s1 = layout.nodi.find((n) => n.id === 'S1')!
    expect(x('F1')).toBe(s1.x + dimensioniDi(s1, {}).larghezza + STACCO_SERBATOI_LINEA)
  })
})
```

Aggiungi agli import ciò che manca: `catenaDagliArchi`, `STACCO_SERBATOI_LINEA` da `../layout`, `dimensioniDi` da `../symbols`, `preferenzeRisolteDaScheda` da `../preferenze`, e le fixture `makeEssiccatore`/`makeFiltro`/`makeDatiImpianto` se non già importate.

- [ ] **Step 2: Esegui i test e verifica che falliscano**

Run: `npx vitest run src/services/schemaImpianto/__tests__/layout.test.ts`
Expected: FAIL — `catenaDagliArchi` esclude i serbatoi, e `F1` finisce a destra di `S1` anche quando l'ordine dice il contrario.

- [ ] **Step 3: Generalizza `catenaDagliArchi`**

Sostituisci il corpo (righe 501-536), lasciando la docstring aggiornata:

```ts
export function catenaDagliArchi(model: SchemaModel, pozzo: SchemaNodo | null): SchemaNodo[] {
  const perId = new Map(model.nodi.map((n) => [n.id, n]))
  // Dal 20-08-2026 il serbatoio è un elemento di linea come gli altri: può stare in mezzo alla
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
  // dalle preferenze perché questa funzione lavora anche su un layout già ritoccato a mano
  // nell'editor, dove le preferenze non arrivano — e perché «il primo serbatoio», il criterio di
  // prima, non vale più: la linea può cominciare con un filtro.
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

  // Ripiego senza mandate (un layout a cui l'operatore ha staccato i compressori): il primo
  // elemento di linea che nessun arco d'aria raggiunge, cioè la testa per esclusione.
  const bersagli = new Set([...successore.values()])
  testa ??= model.nodi.find((n) => inLinea(n) && !bersagli.has(n.id))?.id

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
```

- [ ] **Step 4: Sostituisci `disponiCatenaPerAncore` con `disponiSequenza`**

Rinomina la funzione e aggiungi il criterio di allineamento per tipo. Sostituisci la firma e il corpo (righe 415-446), lasciando invariato il calcolo di `xFinale` (righe 447-454):

```ts
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
```

- [ ] **Step 5: Riscrivi `quotaLineaProcesso`**

Riceve il nodo di testa non ancora posizionato: con i serbatoi dentro la sequenza, la quota va nota **prima** di disporre la riga. Sostituisci (righe 472-483):

```ts
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
```

- [ ] **Step 6: Fondi le due righe in `layoutSchema`**

Sostituisci le righe 539-583 (dalla dichiarazione di `compressori` fino alla chiusura di `rigaCatena`):

```ts
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
```

Poi sostituisci ogni riferimento residuo a `rigaSerbatoi` e `rigaCatena` con `rigaLinea`: nella riga della raccolta condense (riga 586), in `nodiPrimaDelTerminale` (righe 602-607), nel ripiego del terminale (riga 619) e nell'array `nodi` finale (righe 623-629). L'array diventa:

```ts
  const nodi = [
    ...rigaCompressori.posizionati,
    ...rigaLinea.posizionati,
    ...rigaRaccolta.posizionati,
    ...posizionatiUtenze,
  ]
```

- [ ] **Step 7: Esegui la suite intera**

Run: `npx vitest run`
Expected: PASS. I test di `renderSvg.test.ts` e `instradamentoCondiviso.test.ts` toccano la stessa geometria: se cade qualcosa lì è un vero cambio di disegno, da capire prima di proseguire — non un test da aggiornare al volo.

- [ ] **Step 8: Commit**

```bash
git add src/services/schemaImpianto/layout.ts src/services/schemaImpianto/__tests__/layout.test.ts
git commit -m "feat(schema): una sola fila per serbatoi e stadi di trattamento

catenaDagliArchi comprende i serbatoi e trova la testa dalla mandata dei
compressori invece che dal primo serbatoio. I serbatoi restano appoggiati
alla quota di base anche in mezzo alla linea, e le misure fra elementi
sono quelle di prima: una pratica non riordinata non si muove."
```

---

### Task 4: Pannello — una sola sezione trascinabile

Le sotto-sezioni "Serbatoi" e "Linea di trattamento" si fondono in una, con un solo `DndContext`. Le caselle del by-pass compaiono su tutte le righe della linea. Nessun test: la logica sta nei moduli puri, già coperti.

**Files:**
- Modify: `src/components/relazione/PannelloPreferenzeSchema.tsx:183-201` (famiglie e mappa per id), `:208-218` (`riordina`), `:228-246` (contiguità e creazione), `:251-301` (`gruppo`), `:341-350` (corpo della tabella)

**Interfaces:**
- Consumes: `famiglieDaScheda` → `{ compressori, linea }`, `PreferenzeRisolte.ordineLinea` (Task 1).
- Produces: niente.

- [ ] **Step 1: Aggiorna la mappa per id e la firma di `riordina`**

La mappa (righe 197-201) legge le due famiglie nuove:

```ts
  const perId = useMemo(() => {
    const mappa = new Map<string, SchemaNodo>()
    for (const n of [...famiglie.compressori, ...famiglie.linea]) mappa.set(n.id, n)
    return mappa
  }, [famiglie])
```

E `riordina` (righe 208-218) accetta solo le due chiavi rimaste:

```ts
  const riordina =
    (chiave: 'ordineCompressori' | 'ordineLinea', ordineCorrente: string[]) =>
    ({ active, over }: DragEndEvent) => {
```

- [ ] **Step 2: Sposta la contiguità sulla sequenza unificata**

Riga 228:

```ts
  const selezioneContigua = contigui(selezionati, risolte.ordineLinea)
```

E dentro `creaBypass` (riga 241):

```ts
          stadi: risolte.ordineLinea.filter((id) => selezionati.includes(id)),
```

- [ ] **Step 3: Aggiorna la firma di `gruppo` e il corpo della tabella**

Nella funzione `gruppo` (righe 251-257) cambia solo il tipo della chiave:

```ts
  const gruppo = (
    titolo: string,
    spiegazione: string,
    ordine: string[],
    chiave: 'ordineCompressori' | 'ordineLinea',
    conBypass = false
  ) =>
```

E il corpo della tabella (righe 341-351) passa da tre sezioni a due:

```ts
          <TableBody>
            {gruppo('Compressori', 'Ordine in sala, da sinistra a destra.', risolte.ordineCompressori, 'ordineCompressori')}
            {/* Serbatoi e stadi in una sezione sola, con un `DndContext` solo: è ciò che permette
                di trascinare un filtro davanti al primo serbatoio. I compressori restano a parte —
                mescolarne uno fra i filtri resta un gesto che il disegno non sa rendere. */}
            {gruppo(
              'Linea',
              'Serbatoi e apparecchiature di trattamento, da sinistra a destra. Il primo elemento riceve la mandata dei compressori.',
              risolte.ordineLinea,
              'ordineLinea',
              true
            )}
          </TableBody>
```

- [ ] **Step 4: Aggiorna il piè di pagina del by-pass**

Riga 355 e il testo di aiuto (righe 366-374): sostituisci `risolte.ordineStadi.length` con `risolte.ordineLinea.length`, e nella dizione parla di «apparecchiature» invece che di stadi — ora un by-pass può scavalcare anche un serbatoio.

- [ ] **Step 5: Aggiorna la testata del file**

Il commento in cima (righe 10-15) descrive tre sotto-sezioni e il motivo per cui ciascuna ha il proprio contesto. Riscrivilo:

```ts
 * Due sotto-sezioni, non più tre: dal 20-08-2026 serbatoi e apparecchiature di trattamento stanno
 * nella stessa «Linea», con un solo `DndContext`, perché un filtro o un essiccatore può dover
 * precedere il primo serbatoio. I compressori restano una sezione a sé col proprio contesto:
 * infilarne uno fra i filtri sarebbe un gesto che il disegno non sa rendere.
```

- [ ] **Step 6: Verifica che compili e che il resto sia verde**

Run: `npx tsc --noEmit && npx vitest run && npx eslint src`
Expected: tutti e tre verdi. `tsc` è il vero collaudo di questo task: se un consumatore di `ordineStadi`/`ordineSerbatoi` è rimasto indietro, esce qui.

- [ ] **Step 7: Commit**

```bash
git add src/components/relazione/PannelloPreferenzeSchema.tsx
git commit -m "feat(schema): una sola sezione trascinabile per la linea

Serbatoi e apparecchiature di trattamento nella stessa tabella, con un solo
contesto di trascinamento: un filtro si puo' finalmente portare davanti al
primo serbatoio. Le caselle del by-pass valgono su tutte le righe."
```

---

### Task 5: Collaudo sul disegno vero

I test provano la logica; questo task prova il **disegno**. Il banco di confronto SVG va inforcato ora, non prima: misura la differenza fra il disegno di ieri e quello di oggi, e va guardato quando entrambi esistono.

**Files:**
- Modify (se emergono difetti): `src/services/schemaImpianto/layout.ts`, `src/services/schemaImpianto/bypass.ts`
- Test: `src/services/schemaImpianto/__tests__/bancoSimboli.test.ts`

**Interfaces:**
- Consumes: tutto ciò che i Task 1–4 producono.
- Produces: niente.

- [ ] **Step 1: Verifica il ponte del by-pass sopra un serbatoio**

Il ponte corre su una corsia sopra la linea (`PASSO_CORSIA_BYPASS`), misurata quando gli elementi scavalcati erano rombi alti 110. Un serbatoio verticale è alto 300 e porta la valvola di sicurezza sopra il corpo. Genera il caso e guarda dove cade il ponte:

```ts
it('il ponte di un by-pass non attraversa il serbatoio che scavalca', () => {
  const scheda = makeScheda({
    compressori: [makeCompressore({ codice: 'C1' })],
    serbatoi: [makeSerbatoio({ codice: 'S1', ubicazione: 'SALA_COMPRESSORI' })],
    filtri: [makeFiltro({ codice: 'F1', tipo: 'PREFILTRO' })],
    essiccatori: [makeEssiccatore({ codice: 'E1' })],
    dati_impianto: makeDatiImpianto({ raccolta_condense: 'nessuna' }),
  })
  const model = buildSchemaModel({
    scheda,
    collegamentiCompressoriSerbatoi: { C1: ['S1'] },
    preferenze: preferenzeRisolteDaScheda(scheda, {
      ordineLinea: ['F1', 'S1', 'E1'],
      bypass: [{ id: 'bp1', stadi: ['S1'] }],
    }),
  })
  const layout = layoutSchema(model)
  const tee = layout.nodi.find((n) => n.id === 'BP1-IN')!
  const s1 = layout.nodi.find((n) => n.id === 'S1')!
  // Il TEE di monte sta sulla corsia del ponte: deve restare SOPRA la cima del serbatoio, o il
  // ponte gli passa dentro — attraverso la valvola di sicurezza che sta sul cielo del corpo.
  expect(tee.y).toBeLessThan(s1.y)
})
```

Run: `npx vitest run src/services/schemaImpianto/__tests__/layout.test.ts`
Se fallisce, la corsia va calcolata sull'ingombro reale degli elementi scavalcati invece che su `PASSO_CORSIA_BYPASS` fisso: è un difetto da chiudere qui, non da accettare.

- [ ] **Step 2: Inforca il banco di confronto SVG**

Run: `npx vitest run src/services/schemaImpianto/__tests__/bancoSimboli.test.ts`
Expected: PASS. Se il banco misura zero differenze su ogni caso, **verifica che stia davvero confrontando qualcosa**: un banco che non è agganciato al blocco che si sta toccando misura zero e sembra un successo.

- [ ] **Step 3: Non-regressione su una pratica reale**

Apri una pratica già consegnata che ha uno schema salvato (le pratiche BADOER INFISSI hanno layout e preferenze in `additional_info`). Riaprila **senza toccare nulla**:

- la sezione «Linea» mostra i serbatoi in testa e poi gli stadi, nello stesso ordine di prima;
- non compare l'avviso «Rigenera da capo»;
- premendo «Rigenera da capo» il disegno che esce è quello di prima.

Per leggere le preferenze salvate senza aprire l'interfaccia, interroga la Data API con le credenziali di `.env.local` (vedi CLAUDE.md): `dm329_technical_data`, colonna `additional_info`, chiave `schemaPreferenze`.

- [ ] **Step 4: Prova il caso che ha originato il lavoro**

Nella stessa pratica, trascina l'essiccatore prima del primo serbatoio e premi «Rigenera da capo». Attese:

- la mandata del compressore arriva all'essiccatore;
- la linea prosegue essiccatore → serbatoio → resto → utenze;
- nessuna tubazione incrociata, nessun tubo attaccato in mezzo a una sagoma.

- [ ] **Step 5: Guarda cosa succede a una pratica con più serbatoi**

Il cambiamento previsto e voluto (vedi i vincoli globali): i serbatoi che oggi stanno in parallelo, ciascuno con la sua mandata, entrano in catena e le mandate convergono sulla testa. Trova una pratica con due o più serbatoi, rigenera e **guarda il disegno**:

- ogni serbatoio è raggiunto dalla linea, nessuno resta appeso senza tubazioni;
- le mandate dei compressori non si incrociano fra loro;
- la §2.3 della relazione e il calcolo delle valvole restano quelli di prima — `collegamentiCompressoriSerbatoi` non ha cambiato significato, quindi `engine/valvole.ts` deve dare gli stessi numeri.

Se il disegno esce peggiore di quello di prima su un caso reale, **fermati e riferiscilo** invece di aggiustarlo a mano nell'editor: significa che la decisione 2 della spec va rivista col committente.

- [ ] **Step 6: Verifica finale e commit**

Run: `npx tsc --noEmit && npx vitest run && npx eslint src`

```bash
git add -A
git commit -m "test(schema): collaudo del ponte sopra un serbatoio scavalcato"
```

---

## Note per chi esegue

- **`ordinaCatenaTrattamento` resta esportata**, ma cambia chi la usa: `preferenze.ts` (ordine di default) e `buildSchemaModel.ts` (default quando non ci sono preferenze). In `layout.ts` **non serve più** — gli orfani ora si leggono da `model.nodi`, che è già nell'ordine deciso dal generatore, e riordinarli per rango di tipo rimetterebbe in piedi il secondo ordinamento che `catenaDagliArchi` è nata per chiudere. Togli l'import da `layout.ts` quando fai il Task 3, o ESLint lo segnala.
- **`bypass.ts` non si tocca.** `linearizzaConBypass` lavora già su una catena generica e calcola la contiguità per posizione: passandogli la sequenza unificata, i by-pass su singoli e gruppi adiacenti continuano a funzionare e si estendono ai serbatoi senza modifiche. Se ti trovi a doverlo cambiare, fermati: probabilmente stai passando la sequenza sbagliata.
- **Il DB di produzione è interrogabile direttamente** (CLAUDE.md): non chiedere di caricare dati a mano dalla dashboard.
- **Lo schema del DB non cambia.** `schemaPreferenze` vive dentro la colonna JSONB `additional_info`, dichiarata `z.any()`: nessuna migrazione.
