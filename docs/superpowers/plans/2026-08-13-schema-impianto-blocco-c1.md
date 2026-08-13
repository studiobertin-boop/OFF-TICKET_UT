# Schema d'impianto — Blocco C1: piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** far disegnare all'editor le stesse polilinee che il documento disegna anche per gli archi senza gomiti imposti a mano, e riaprire il trascinamento del tratto sulla tubazione flessibile.

**Architecture:** le tre rotte native oggi sepolte in `renderSvg.ts` (collettore del flessibile, spezzata di linea, corsia condense) diventano funzioni pure in `tratti.ts` dietro un ingresso unico `instrada`, che sceglie per stile e resta su `polilineaConGomiti` quando l'arco porta gomiti. Le due quote globali che quelle rotte richiedono (`quotaCollettore`, `quotaCorsiaCondense`) passano da `renderSvg.ts` a `layout.ts` sotto un'unica `quoteInstradamento(layout)`, che l'editor chiama sul layout ricostruito dallo stato react-flow (`flowALayout`) e infila nei dati di ogni arco.

**Tech Stack:** TypeScript (strict=false), React 18, @xyflow/react, MUI 6, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-13-schema-impianto-blocco-c1-instradamento-design.md`.

## Global Constraints

- Si lavora **solo** nel worktree `.claude/worktrees/schema-impianto-dm329`, ramo `worktree-schema-impianto-dm329`, base `db8f07d`. **Nessun merge e nessun push su `main`** finché il committente non lo dice.
- Dev server: `npm run dev -- --port 5176 --strictPort`, dentro il worktree. Verifica se è già attivo (`netstat -ano | grep :5176`) prima di rilanciarlo.
- Verifica di fine task, sempre entrambe: `npx tsc --noEmit` pulito e i test verdi. Baseline prima del Task 1: **876 test su 73 file**, `tsc` pulito.
- **Ogni test nuovo va visto fallire PRIMA di scrivere l'implementazione**, e la prova va nel report con redirezione su file (`> esito.txt 2>&1`), mai trascritta a memoria. Un test che passa su entrambe le implementazioni non discrimina e non vale: in questo modulo dodici giri di riparazione sono nati da qui. Dove un task non aggiunge test nuovi (relocazione di codice), la prova che i test esistenti coprano davvero il cambiamento si produce **rompendo apposta l'implementazione** e allegando il rosso.
- La suite intera impiega oltre 1 minuto e due esecuzioni concorrenti di Vitest fanno morire il worker («Worker exited unexpectedly» di tinypool). Falla lanciare **solo al controller**, una alla volta, in background con redirezione su file. Gli implementatori usano i test mirati (`npx vitest run src/services/schemaImpianto` copre quasi tutto il modulo in pochi secondi; per l'editor `npx vitest run src/components/schemaImpianto`).
- Commit convenzionali, in italiano, uno per task salvo dove il piano ne chiede due.
- Le verifiche in pagina le fa il controller, non l'implementatore. Se un implementatore riceve l'autorizzazione al browser, **è vietato premere «Genera comunque .docx»**: scrive su una pratica di produzione.
- **Non rifinire i simboli esistenti** e non toccare TEE, etichette multi-riga o testi liberi: sono il Blocco C2, fuori perimetro qui.
- Se l'implementazione scopre che il piano sbaglia o è incompleto, **il piano si corregge nello stesso commit del codice**, come parte del task e non come nota a margine.

### Trappole già pagate su questo modulo

- `addEdge` di react-flow **scarta i duplicati**: una connessione che sembra rifiutata può essere solo già esistente.
- `onlyRenderVisibleElements` toglie dal DOM i nodi fuori vista; `minZoom` è a 0.1 apposta (Critical del Blocco B), non alzarlo.
- Ogni ancora ha **due handle sovrapposti**: selezionarli con `.react-flow__handle.source[...]` e `.target[...]`, mai con `.first()`/`.last()`.
- Il layer HTML portale di `EdgeLabelRenderer` (gomiti e segni) è dipinto **sopra** il layer SVG dei tubi: un clic su un gomito non arriva mai al tubo sotto.

## File Structure

| File | Responsabilità dopo il blocco |
|---|---|
| `src/services/schemaImpianto/tratti.ts` | **Tutta** la geometria della polilinea: raccordi, gomiti, onda, punti su tratto, trascinamento e — nuovo — le tre rotte native più `instrada`, unico ingresso che dà forma a un tubo. Nessuna conoscenza di nodi, layout o React. |
| `src/services/schemaImpianto/layout.ts` | Posizioni, ingombri, corpi dei nodi e — nuovo — le due quote globali di instradamento sotto `quoteInstradamento`. Le sposta qui il fatto che dipendono da `pozzoCondense`/`corpoNodo`/`dimensioniLayout`, che vivono già qui. |
| `src/services/schemaImpianto/renderSvg.ts` | Resa grafica del documento: onda, tratteggio, frecce, tabella, legenda. Smette di sapere *che forma* ha un tubo e di calcolare le quote: chiede l'una a `instrada`, le altre a `quoteInstradamento`. |
| `src/components/schemaImpianto/conversioneFlow.ts` | Ponte layout↔react-flow e — nuovo — `polilineaDellArco`, la funzione pura che dà la polilinea di un arco dell'editor. È il punto in cui il test può prendere il lato editor senza montare React. |
| `src/components/schemaImpianto/SchemaEditor.tsx` | Calcola le quote una volta per aggiornamento e le passa nei dati degli archi. |
| `src/components/schemaImpianto/SchemaEdgeTubazione.tsx` | Disegna l'arco chiamando `polilineaDellArco`; riapre il trascinamento del tratto sul flessibile. |

Test toccati: `src/services/schemaImpianto/__tests__/tratti.test.ts`, `.../layout.test.ts`, e il nuovo `src/components/schemaImpianto/__tests__/instradamentoCondiviso.test.ts`.

---

### Task 1: le tre rotte native e `instrada` in `tratti.ts`

**Files:**
- Modify: `src/services/schemaImpianto/tratti.ts`
- Test: `src/services/schemaImpianto/__tests__/tratti.test.ts`

**Interfaces:**
- Consumes: `Punto`, `polilineaConGomiti` (già in `tratti.ts`); il tipo `SchemaArcoStile` da `./types` (`types.ts` non importa nulla, nessun ciclo).
- Produces: `AVVICINAMENTO: number`, `QuoteInstradamento`, `rottaFlessibile(pDa, pA, yCollettore): Punto[]`, `rottaLinea(pDa, pA): Punto[]`, `rottaCondensa(pDa, pA, yCorsia): Punto[]`, `instrada(stile, pDa, pA, gomiti, quote): Punto[]`.

- [ ] **Step 1: Scrivi i test che falliscono**

In coda a `src/services/schemaImpianto/__tests__/tratti.test.ts`, e aggiungi gli import nuovi in testa al file (`instrada`, `rottaCondensa`, `rottaFlessibile`, `rottaLinea` accanto a quelli già presenti):

```ts
describe('rotte native', () => {
  it('la mandata flessibile sale al collettore, corre in orizzontale e scende accanto al bocchello', () => {
    // xDiscesa = 400 - AVVICINAMENTO(34) = 366: il montante di discesa si stacca dal fianco
    // del recipiente invece di correre sul suo contorno.
    expect(rottaFlessibile({ x: 100, y: 500 }, { x: 400, y: 300 }, 200)).toEqual([
      { x: 100, y: 500 },
      { x: 100, y: 200 },
      { x: 366, y: 200 },
      { x: 366, y: 300 },
      { x: 400, y: 300 },
    ])
  })

  it('la mandata di linea gira a metà strada', () => {
    expect(rottaLinea({ x: 0, y: 100 }, { x: 200, y: 300 })).toEqual([
      { x: 0, y: 100 },
      { x: 100, y: 100 },
      { x: 100, y: 300 },
      { x: 200, y: 300 },
    ])
  })

  it('la linea condense scende sulla corsia comune e poi nel pozzo', () => {
    expect(rottaCondensa({ x: 50, y: 100 }, { x: 300, y: 400 }, 450)).toEqual([
      { x: 50, y: 100 },
      { x: 50, y: 450 },
      { x: 300, y: 450 },
      { x: 300, y: 400 },
    ])
  })
})

describe('instrada', () => {
  const quote = { yCollettore: 200, yCorsiaCondense: 450 }

  it('sceglie la rotta nativa dello stile quando l’arco non ha gomiti', () => {
    const pDa = { x: 100, y: 500 }
    const pA = { x: 400, y: 300 }
    expect(instrada('flessibile', pDa, pA, undefined, quote)).toEqual(rottaFlessibile(pDa, pA, 200))
    expect(instrada('standard', pDa, pA, [], quote)).toEqual(rottaLinea(pDa, pA))
    expect(instrada('condensa', pDa, pA, [], quote)).toEqual(rottaCondensa(pDa, pA, 450))
  })

  it('i gomiti imposti a mano vincono su ogni rotta nativa', () => {
    const pDa = { x: 100, y: 500 }
    const pA = { x: 400, y: 300 }
    const gomiti = [{ x: 250, y: 500 }]
    for (const stile of ['flessibile', 'standard', 'condensa'] as const) {
      expect(instrada(stile, pDa, pA, gomiti, quote)).toEqual(polilineaConGomiti(pDa, gomiti, pA))
    }
  })

  it('la rotta nativa non è mai il semplice angolo singolo che l’editor disegnava', () => {
    // Il difetto del committente in forma di test: la tela faceva due tratti, il documento
    // quattro. Se questa asserzione diventa verde, l'unificazione è tornata indietro.
    const pDa = { x: 100, y: 500 }
    const pA = { x: 400, y: 300 }
    expect(instrada('flessibile', pDa, pA, [], quote)).not.toEqual(polilineaConGomiti(pDa, [], pA))
  })
})
```

- [ ] **Step 2: Esegui i test e verifica che falliscano**

```bash
npx vitest run src/services/schemaImpianto/__tests__/tratti.test.ts > task-1-rosso.txt 2>&1
```

Atteso: fallimenti con `rottaFlessibile is not a function` (e omologhi). Allega il file al report.

- [ ] **Step 3: Implementa**

In `src/services/schemaImpianto/tratti.ts`, in testa aggiungi l'import del tipo:

```ts
import type { SchemaArcoStile } from './types'
```

e in coda al file:

```ts
/**
 * Rientro del montante rispetto al fianco del recipiente: evita che corra sul contorno.
 * Duplicata da `renderSvg.ts` (che dichiara ancora la propria `AVVICINAMENTO = 34` privata,
 * fino al Task 3 che la farà sparire in favore di questa): finché le due copie coesistono,
 * niente le tiene sincronizzate. Vive qui, e non in `renderSvg.ts`, perché è geometria del
 * tratto, non della resa grafica, e serve a chi instrada da entrambe le parti.
 */
export const AVVICINAMENTO = 34

/**
 * Le due quote che il disegno intero impone alle rotte native: dipendono da dove stanno
 * TUTTI i nodi, non dai due capi dell'arco, quindi chi instrada le riceve invece di
 * ricavarsele (un arco non ha, né deve avere, una vista sul layout globale).
 * Le calcola `quoteInstradamento` in `layout.ts`.
 */
export interface QuoteInstradamento {
  yCollettore: number
  yCorsiaCondense: number
}

/**
 * Mandata compressore → serbatoio: montante dal cielo del compressore fino al collettore
 * comune, tratto orizzontale, discesa accanto al bocchello. È la resa degli schemi reali,
 * dove più compressori confluiscono sulla stessa linea invece di attraversarsi.
 */
export function rottaFlessibile(pDa: Punto, pA: Punto, yCollettore: number): Punto[] {
  const xDiscesa = pA.x - AVVICINAMENTO
  return [
    { x: pDa.x, y: pDa.y },
    { x: pDa.x, y: yCollettore },
    { x: xDiscesa, y: yCollettore },
    { x: xDiscesa, y: pA.y },
    { x: pA.x, y: pA.y },
  ]
}

/** Mandata di linea fra due stadi di trattamento: spezzata che gira a metà strada. */
export function rottaLinea(pDa: Punto, pA: Punto): Punto[] {
  const xMedia = (pDa.x + pA.x) / 2
  return [
    { x: pDa.x, y: pDa.y },
    { x: xMedia, y: pDa.y },
    { x: xMedia, y: pA.y },
    { x: pA.x, y: pA.y },
  ]
}

/**
 * Linea condense: scende dallo scarico del nodo, corre sulla corsia comune e scende nel pozzo
 * di raccolta dall'alto — il pozzo sta sotto la corsia, come negli schemi reali.
 */
export function rottaCondensa(pDa: Punto, pA: Punto, yCorsia: number): Punto[] {
  return [
    { x: pDa.x, y: pDa.y },
    { x: pDa.x, y: yCorsia },
    { x: pA.x, y: yCorsia },
    { x: pA.x, y: pA.y },
  ]
}

/**
 * L'unico posto che decide la forma di un tubo. Lo chiamano il render del documento
 * (`renderSvg.ts`) e la tela dell'editor (`SchemaEdgeTubazione.tsx` via `polilineaDellArco`):
 * finché passano di qui non possono più disegnare due percorsi diversi per lo stesso arco,
 * che è esattamente il difetto che il Blocco C1 chiude.
 *
 * I gomiti imposti a mano vincono su ogni rotta nativa: da quel momento il percorso è una
 * scelta dell'utente e nessuna euristica deve sovrascriverla.
 */
export function instrada(
  stile: SchemaArcoStile,
  pDa: Punto,
  pA: Punto,
  gomiti: Punto[] | undefined,
  quote: QuoteInstradamento
): Punto[] {
  if (gomiti && gomiti.length > 0) return polilineaConGomiti(pDa, gomiti, pA)
  if (stile === 'flessibile') return rottaFlessibile(pDa, pA, quote.yCollettore)
  if (stile === 'condensa') return rottaCondensa(pDa, pA, quote.yCorsiaCondense)
  return rottaLinea(pDa, pA)
}
```

- [ ] **Step 4: Esegui i test e verifica che passino**

```bash
npx vitest run src/services/schemaImpianto/__tests__/tratti.test.ts > task-1-verde.txt 2>&1
npx tsc --noEmit > task-1-tsc.txt 2>&1
```

Atteso: tutti verdi, `task-1-tsc.txt` vuoto.

- [ ] **Step 5: Commit**

```bash
git add src/services/schemaImpianto/tratti.ts src/services/schemaImpianto/__tests__/tratti.test.ts
git commit -m "feat(schema-impianto): le tre rotte native e instrada, unico ingresso della forma di un tubo"
```

---

### Task 2: le quote di instradamento in `layout.ts`

**Files:**
- Modify: `src/services/schemaImpianto/layout.ts`
- Modify: `src/services/schemaImpianto/renderSvg.ts:326-338` (rimozione delle due funzioni), `:345-346` (uso della nuova)
- Test: `src/services/schemaImpianto/__tests__/layout.test.ts`

**Interfaces:**
- Consumes: `QuoteInstradamento` da `./tratti` (Task 1); `pozzoCondense`, `corpoNodo`, `dimensioniLayout`, `MARGINE` già in `layout.ts`.
- Produces: `quoteInstradamento(layout: SchemaLayout): QuoteInstradamento`.

**Nota per chi implementa:** `renderSvg.ts` ha un proprio `const MARGINE = 40` (riga 26) e `layout.ts` ne ha uno identico (riga 52). Le due funzioni spostate useranno quello di `layout.ts`: **verifica che valgano entrambi 40 prima di spostare**, o la relocazione cambierebbe i numeri del documento.

- [ ] **Step 1: Scrivi il test che fallisce**

In coda a `src/services/schemaImpianto/__tests__/layout.test.ts`. L'unico import da aggiungere è `quoteInstradamento`, accanto a quelli da `../layout` alla riga 11: `dimensioniLayout` e il tipo `SchemaLayout` ci sono già.

```ts
describe('quoteInstradamento', () => {
  /** Layout minimo scritto a mano: numeri fissi, così i valori attesi sono verificabili a occhio. */
  function layoutDiProva(): SchemaLayout {
    return {
      nodi: [
        // Più in alto del serbatoio più alto: se `quotaCollettore` perdesse il filtro
        // `tipo === 'serbatoio'` e considerasse tutti i nodi, il minimo cadrebbe qui e il
        // primo test lo scoprirebbe (atteso resterebbe 380 solo col filtro applicato).
        {
          id: 'C1', tipo: 'compressore', etichetta: 'Compressore', gruppo: 'SALA_COMPRESSORI',
          valvoleSicurezza: [], origine: 'scheda', x: 100, y: 200,
        },
        {
          id: 'S1', tipo: 'serbatoio', orientamento: 'VERTICALE', etichetta: 'Serbatoio',
          gruppo: 'SALA_COMPRESSORI', valvoleSicurezza: [], origine: 'scheda', x: 500, y: 400,
        },
        // Secondo serbatoio, più in basso del primo: separa `Math.min` da `Math.max` fra i
        // serbatoi, che con un solo serbatoio coinciderebbero e lascerebbero passare la
        // mutazione min→max senza che nessun test se ne accorga.
        {
          id: 'S2', tipo: 'serbatoio', orientamento: 'VERTICALE', etichetta: 'Serbatoio',
          gruppo: 'SALA_COMPRESSORI', valvoleSicurezza: [], origine: 'scheda', x: 700, y: 620,
        },
        {
          id: 'T1', tipo: 'tanica', etichetta: 'Raccolta condense', gruppo: 'ALTRO',
          valvoleSicurezza: [], origine: 'scheda', x: 200, y: 900,
        },
      ],
      archi: [
        { id: 'a1', da: { nodo: 'C1', ancora: 'basso-out' }, a: { nodo: 'T1', ancora: 'alto-in' }, stile: 'condensa' },
      ],
      muro: null,
    }
  }

  it('mette il collettore mezzo margine sopra il serbatoio più alto', () => {
    // Serbatoio a y=400, MARGINE=40: 400 - 20 = 380.
    expect(quoteInstradamento(layoutDiProva()).yCollettore).toBe(380)
  })

  it('mette la corsia condense 40 unità sopra il corpo del pozzo di raccolta', () => {
    // Tanica a y=900, il suo corpo comincia 6 più in basso (corpoNodo): 906 - 40 = 866.
    expect(quoteInstradamento(layoutDiProva()).yCorsiaCondense).toBe(866)
  })

  it('senza pozzo di raccolta la corsia va in fondo al disegno', () => {
    const layout = layoutDiProva()
    layout.nodi = layout.nodi.filter((n) => n.tipo !== 'tanica')
    layout.archi = []
    // Nessun pozzo: la corsia scende a mezzo margine dal fondo della tela, non resta a 866.
    const attesa = dimensioniLayout(layout).altezza - 20
    expect(quoteInstradamento(layout).yCorsiaCondense).toBe(attesa)
  })
})
```

- [ ] **Step 2: Esegui il test e verifica che fallisca**

```bash
npx vitest run src/services/schemaImpianto/__tests__/layout.test.ts > task-2-rosso.txt 2>&1
```

Atteso: `quoteInstradamento is not a function`.

- [ ] **Step 3: Sposta le due funzioni e aggiungi l'ingresso unico**

In `src/services/schemaImpianto/layout.ts`, aggiungi l'import del tipo in testa:

```ts
import type { QuoteInstradamento } from './tratti'
```

e in coda al file, **copiate verbatim** da `renderSvg.ts:326-338` (solo la parola `export` in più):

```ts
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
```

In `src/services/schemaImpianto/renderSvg.ts`: cancella le due funzioni locali (righe 326-338), aggiungi `quoteInstradamento` all'import da `./layout` (riga 8) e sostituisci le righe 345-346 e 352:

```ts
  const quote = quoteInstradamento(layout)
```

```ts
  const archi = renderArchi(layout, quote.yCorsiaCondense, quote.yCollettore)
```

- [ ] **Step 4: Esegui i test e verifica che passino**

```bash
npx vitest run src/services/schemaImpianto > task-2-verde.txt 2>&1
npx tsc --noEmit > task-2-tsc.txt 2>&1
```

Atteso: tutto il modulo verde (i test di `renderSvg` provano che la relocazione non ha cambiato un solo numero del documento), `tsc` pulito.

- [ ] **Step 5: Commit**

```bash
git add src/services/schemaImpianto/layout.ts src/services/schemaImpianto/renderSvg.ts src/services/schemaImpianto/__tests__/layout.test.ts
git commit -m "refactor(schema-impianto): le quote di collettore e corsia condense passano in layout.ts"
```

---

### Task 3: `renderSvg.ts` delega la forma a `instrada`

**Files:**
- Modify: `src/services/schemaImpianto/renderSvg.ts:31` (rimozione di `AVVICINAMENTO`), `:72-154` (le tre `renderMandata*`), `:163-186` (`renderArchi`), `:352`

**Interfaces:**
- Consumes: `instrada`, `QuoteInstradamento` da `./tratti` (Task 1); `quoteInstradamento` da `./layout` (Task 2).
- Produces: nessuna interfaccia nuova. `renderArchi` cambia firma: `renderArchi(layout: SchemaLayout, quote: QuoteInstradamento)`.

Questo task **non aggiunge test**: sposta la scelta dei punti dalle tre funzioni di resa a `instrada`, e i test esistenti di `renderSvg` sono la rete. Che siano una rete vera va dimostrato, non supposto — vedi Step 4.

- [ ] **Step 1: Riscrivi le tre funzioni di resa**

In `src/services/schemaImpianto/renderSvg.ts`, togli `const AVVICINAMENTO = 34` (riga 31, ora esportata da `tratti.ts`) e aggiungi `instrada` e il tipo `QuoteInstradamento` all'import da `./tratti` (riga 20). Poi:

```ts
/**
 * Mandata compressore → serbatoio, resa ondulata come i flessibili dei blocchi di riferimento.
 * La FORMA la decide `instrada` (tratti.ts), condivisa con l'editor: qui resta solo la resa
 * grafica — l'onda e la punta di freccia.
 */
function renderMandataCompressore(
  da: SchemaNodoPosizionato,
  ancoraDa: string,
  a: SchemaNodoPosizionato,
  ancoraA: string,
  quote: QuoteInstradamento,
  gomiti?: Punto[]
): { svg: string; punti: Punto[] } {
  const pDa = posizioneAncora(da, ancoraDa)
  const pA = posizioneAncora(a, ancoraA)
  const punti = instrada('flessibile', pDa, pA, gomiti, quote)
  const svg = `<path d="${ondula(punti)}" fill="none" stroke="#000" stroke-width="${TRATTO}" marker-end="url(#freccia)" />`
  return { svg, punti }
}

/** Mandata di linea fra due stadi di trattamento. Forma da `instrada`, resa continua. */
function renderMandataLinea(
  da: SchemaNodoPosizionato,
  ancoraDa: string,
  a: SchemaNodoPosizionato,
  ancoraA: string,
  quote: QuoteInstradamento,
  gomiti?: Punto[],
  frecciaFinale = true
): { svg: string; punti: Punto[] } {
  const pDa = posizioneAncora(da, ancoraDa)
  const pA = posizioneAncora(a, ancoraA)
  const punti = instrada('standard', pDa, pA, gomiti, quote)
  const freccia = frecciaFinale ? ' marker-end="url(#freccia)"' : ''
  const svg = `<path d="${percorso(punti)}" fill="none" stroke="#000" stroke-width="${TRATTO}"${freccia} />`
  return { svg, punti }
}

/** Linea condense. Forma da `instrada`, resa tratteggiata. */
function renderLineaCondense(
  da: SchemaNodoPosizionato,
  ancoraDa: string,
  a: SchemaNodoPosizionato,
  ancoraA: string,
  quote: QuoteInstradamento,
  gomiti?: Punto[]
): { svg: string; punti: Punto[] } {
  const pDa = posizioneAncora(da, ancoraDa)
  const pA = posizioneAncora(a, ancoraA)
  const punti = instrada('condensa', pDa, pA, gomiti, quote)
  const svg = `<path d="${percorso(punti)}" fill="none" stroke="#000" stroke-width="${TRATTO}" stroke-dasharray="10 7" marker-end="url(#freccia)" />`
  return { svg, punti }
}
```

- [ ] **Step 2: Aggiorna i due chiamanti**

In `renderArchi` (riga 163), sostituisci i due parametri numerici con le quote e aggiorna le tre chiamate:

```ts
function renderArchi(
  layout: SchemaLayout,
  quote: QuoteInstradamento
): { svg: string; varchi: number[] } {
```

```ts
    const reso =
      arco.stile === 'condensa'
        ? renderLineaCondense(da, arco.da.ancora, a, arco.a.ancora, quote, arco.punti)
        : arco.stile === 'flessibile'
          ? renderMandataCompressore(da, arco.da.ancora, a, arco.a.ancora, quote, arco.punti)
          : renderMandataLinea(da, arco.da.ancora, a, arco.a.ancora, quote, arco.punti, a.tipo !== 'utenze')
```

e in `renderSvg` (riga 352):

```ts
  const archi = renderArchi(layout, quote)
```

- [ ] **Step 3: Esegui i test e verifica che passino**

```bash
npx vitest run src/services/schemaImpianto > task-3-verde.txt 2>&1
npx tsc --noEmit > task-3-tsc.txt 2>&1
```

Atteso: tutto verde, `tsc` pulito. Se qualcosa è rosso, la relocazione ha cambiato il documento: **non aggiustare il test**, aggiusta la rotta.

- [ ] **Step 4: Dimostra che i test coprono davvero la relocazione**

Rompi apposta `rottaFlessibile` in `tratti.ts` (`const xDiscesa = pA.x + AVVICINAMENTO`, segno invertito), riesegui e allega il rosso:

```bash
npx vitest run src/services/schemaImpianto > task-3-rottura-deliberata.txt 2>&1
```

Atteso: **almeno un test rosso**. Se restano tutti verdi, i test non coprono la rotta e il task non è finito: aggiungi in `renderSvg.test.ts` un test che asserisce i punti della mandata flessibile, vedilo fallire con la rottura in piedi, e solo allora ripristina. Poi ripristina il segno e riesegui `npx vitest run src/services/schemaImpianto > task-3-verde-2.txt 2>&1`.

- [ ] **Step 5: Commit**

```bash
git add src/services/schemaImpianto/renderSvg.ts
git commit -m "refactor(schema-impianto): il render del documento chiede la forma dei tubi a instrada"
```

---

### Task 4: `polilineaDellArco` e il test dell'accordo fra tela e documento

**Files:**
- Modify: `src/components/schemaImpianto/conversioneFlow.ts`
- Modify: `src/components/schemaImpianto/SchemaEdgeTubazione.tsx:24-49` (solo il campo `quote` in `SchemaEdgeData`)
- Create: `src/components/schemaImpianto/__tests__/instradamentoCondiviso.test.ts`

**Interfaces:**
- Consumes: `instrada`, `QuoteInstradamento`, `Punto` da `@/services/schemaImpianto/tratti`; `quoteInstradamento` da `@/services/schemaImpianto/layout`; `SchemaEdgeData` da `../SchemaEdgeTubazione`.
- Produces: `polilineaDellArco(pDa: Punto, pA: Punto, data: SchemaEdgeData | undefined): Punto[]`; `SchemaEdgeData.quote?: QuoteInstradamento`.

Questo è il task cardine: il test che segue è la definizione eseguibile del difetto trovato dal committente.

- [ ] **Step 1: Aggiungi il campo `quote` a `SchemaEdgeData`**

In `src/components/schemaImpianto/SchemaEdgeTubazione.tsx`, dentro l'interfaccia (dopo `segni`):

```ts
  /**
   * Quote di instradamento del disegno intero (`quoteInstradamento`, layout.ts): dipendono da
   * dove stanno TUTTI i nodi, non dai due capi dell'arco, quindi un arco le riceve invece di
   * ricavarsele — non ha, né deve avere, una vista sul layout globale.
   *
   * Il campo esiste perché `polilineaDellArco` (conversioneFlow.ts) lo consuma, ma oggi
   * NESSUNO lo valorizza: `SchemaEditor` non calcola ancora le quote e questo componente
   * disegna tuttora con `polilineaConGomiti` (vedi il commento in testa al file). Il cablaggio
   * è del task successivo.
   */
  quote?: QuoteInstradamento
```

Il commento dice «oggi nessuno lo valorizza» perché è vero a fine Task 4: chi calcola le quote
e chi le infila negli archi arriva col Task 5. Il Task 5 deve quindi riscrivere questo commento
(e la NOTA in coda a quello di `polilineaDellArco`, Step 5) quando il cablaggio esiste davvero.

con l'import del tipo aggiunto alla riga 20 (`import { ondula, percorso, ... type QuoteInstradamento }`).

- [ ] **Step 2: Scrivi il test che fallisce**

Crea `src/components/schemaImpianto/__tests__/instradamentoCondiviso.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  makeCompressore,
  makeDatiImpianto,
  makeEssiccatore,
  makeScheda,
  makeSerbatoio,
} from '@/services/relazione/__tests__/fixtures'
import { buildSchemaModel } from '@/services/schemaImpianto/buildSchemaModel'
import { layoutSchema, quoteInstradamento } from '@/services/schemaImpianto/layout'
import { posizioneAncora } from '@/services/schemaImpianto/renderSvg'
import { instrada } from '@/services/schemaImpianto/tratti'
import { ancoraDi } from '@/services/schemaImpianto/symbols'
import type { SchemaLayout, SchemaNodo } from '@/services/schemaImpianto/types'
import { flowALayout, layoutAFlow, polilineaDellArco } from '../conversioneFlow'
import type { SchemaEdgeData } from '../SchemaEdgeTubazione'

/**
 * Impianto con tutti e tre gli stili di tubazione: flessibile compressore→serbatoio,
 * mandata di linea serbatoio→essiccatore→utenze, condense verso la tanica.
 */
function layoutCompleto(): SchemaLayout {
  const scheda = makeScheda({
    compressori: [makeCompressore({ ha_disoleatore: false })],
    serbatoi: [makeSerbatoio({ orientamento: 'VERTICALE' })],
    essiccatori: [makeEssiccatore()],
    dati_impianto: makeDatiImpianto({ raccolta_condense: 'tanica' }),
  })
  return layoutSchema(buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } }))
}

describe('accordo fra la tela dell’editor e il documento', () => {
  it('per ogni arco, tela e documento producono la STESSA polilinea', () => {
    const layout = layoutCompleto()
    const { nodes, edges } = layoutAFlow(layout)

    // Lato editor: le quote nascono dal layout ricostruito dallo stato react-flow, e i due
    // capi dalla posizione del nodo più l'ancora — è ciò che react-flow passa come
    // sourceX/sourceY, perché `SchemaNodeSymbol` centra l'handle esattamente sull'ancora.
    const quote = quoteInstradamento(flowALayout(nodes, edges))
    const posizioneFlow = (nodoId: string, ancoraId: string) => {
      const node = nodes.find((n) => n.id === nodoId)!
      const { nodo } = node.data as { nodo: SchemaNodo }
      const ancora = ancoraDi(nodo, ancoraId)!
      return { x: node.position.x + ancora.x, y: node.position.y + ancora.y }
    }

    expect(edges.length).toBeGreaterThan(2)
    for (const edge of edges) {
      const arco = layout.archi.find((a) => a.id === edge.id)!
      const dalDocumento = instrada(
        arco.stile,
        posizioneAncora(layout.nodi.find((n) => n.id === arco.da.nodo)!, arco.da.ancora),
        posizioneAncora(layout.nodi.find((n) => n.id === arco.a.nodo)!, arco.a.ancora),
        arco.punti,
        quoteInstradamento(layout)
      )
      const dallaTela = polilineaDellArco(
        posizioneFlow(edge.source, edge.sourceHandle!),
        posizioneFlow(edge.target, edge.targetHandle!),
        { ...(edge.data as SchemaEdgeData), quote }
      )
      expect(dallaTela, `arco ${edge.id} (${arco.stile})`).toEqual(dalDocumento)
    }
  })

  it('i gomiti imposti a mano restano l’ultima parola anche sulla tela', () => {
    const layout = layoutCompleto()
    const flessibile = layout.archi.find((a) => a.stile === 'flessibile')!
    flessibile.punti = [{ x: 42, y: 42 }]
    const { nodes, edges } = layoutAFlow(layout)
    const quote = quoteInstradamento(flowALayout(nodes, edges))
    const edge = edges.find((e) => e.id === flessibile.id)!

    const polilinea = polilineaDellArco(
      { x: 0, y: 0 },
      { x: 200, y: 200 },
      { ...(edge.data as SchemaEdgeData), quote }
    )
    expect(polilinea).toContainEqual({ x: 42, y: 42 })
  })
})
```

- [ ] **Step 3: Esegui il test e verifica che fallisca**

```bash
npx vitest run src/components/schemaImpianto/__tests__/instradamentoCondiviso.test.ts > task-4-rosso.txt 2>&1
```

Atteso: `polilineaDellArco is not a function`.

- [ ] **Step 4: Implementa PRIMA la versione sbagliata, quella di oggi**

Serve a dimostrare che il test cattura il difetto vero, non solo l'assenza della funzione. In `src/components/schemaImpianto/conversioneFlow.ts`, in coda:

```ts
export function polilineaDellArco(pDa: Punto, pA: Punto, data: SchemaEdgeData | undefined): Punto[] {
  return polilineaConGomiti(pDa, data?.punti ?? [], pA)
}
```

Import da aggiungere in testa a `conversioneFlow.ts`: `instrada`, `polilineaConGomiti` e il tipo `Punto` da `@/services/schemaImpianto/tratti`, e `SchemaEdgeData` da `./SchemaEdgeTubazione` (`SchemaArcoStile` è già importato — lo usa `flowALayout` alla riga 55). `instrada` serve solo dallo Step 5 in poi: mettilo subito, così l'import non cambia due volte.

```bash
npx vitest run src/components/schemaImpianto/__tests__/instradamentoCondiviso.test.ts > task-4-rosso-vero.txt 2>&1
```

Atteso: il primo test fallisce mostrando **due polilinee diverse** sull'arco flessibile (2-3 punti contro 5), che è il difetto segnalato dal committente. Il secondo test passa già. Allega il file: è la prova che il test discrimina.

- [ ] **Step 5: Implementa la versione giusta**

Sostituisci il corpo appena scritto:

```ts
/**
 * Polilinea di un arco dell'editor: la stessa che il documento disegnerà per quell'arco,
 * perché passa dalla stessa `instrada` (tratti.ts). Vive qui e non dentro
 * `SchemaEdgeTubazione` per poter essere provata senza montare react-flow — il componente
 * si limita a chiamarla con i capi che react-flow gli passa.
 *
 * Senza `quote` (che `SchemaEditor` calcola a ogni aggiornamento e infila nei dati di ogni
 * arco) non c'è modo di ricostruire le rotte native, e si ripiega sul raccordo semplice: è
 * una rete di sicurezza per il tipo, non un caso previsto: se compare sulla tela, il
 * cablaggio delle quote si è rotto.
 *
 * NOTA sullo stato attuale del repo: quel cablaggio non c'è ancora. `SchemaEditor` non
 * calcola le quote, nessuno valorizza `SchemaEdgeData.quote` e `SchemaEdgeTubazione` non
 * chiama questa funzione — disegna ancora da sé con `polilineaConGomiti`. Finché il task
 * successivo non collega le due cose, l'unico chiamante è il test dell'accordo fra tela e
 * documento (`__tests__/instradamentoCondiviso.test.ts`).
 */
export function polilineaDellArco(pDa: Punto, pA: Punto, data: SchemaEdgeData | undefined): Punto[] {
  const stile = (data?.stile ?? 'standard') as SchemaArcoStile
  if (!data?.quote) return polilineaConGomiti(pDa, data?.punti ?? [], pA)
  return instrada(stile, pDa, pA, data.punti, data.quote)
}
```

- [ ] **Step 6: Esegui i test e verifica che passino**

```bash
npx vitest run src/components/schemaImpianto > task-4-verde.txt 2>&1
npx tsc --noEmit > task-4-tsc.txt 2>&1
```

Atteso: verdi, `tsc` pulito.

- [ ] **Step 7: Commit**

```bash
git add src/components/schemaImpianto/conversioneFlow.ts src/components/schemaImpianto/SchemaEdgeTubazione.tsx src/components/schemaImpianto/__tests__/instradamentoCondiviso.test.ts
git commit -m "feat(schema-impianto): polilineaDellArco e il test dell'accordo fra tela e documento"
```

---

### Task 5: l'editor calcola le quote e disegna con la rotta vera

**Files:**
- Modify: `src/components/schemaImpianto/SchemaEditor.tsx:168-182` (commento e nuovo `useMemo`), `:235-242` (fusione dei dati degli archi)
- Modify: `src/components/schemaImpianto/SchemaEdgeTubazione.tsx:1-16` (commento di testa), `:24-49` (docblock di `SchemaEdgeData.quote` e di `onTrascinaTratto`), `:263`
- Modify: `src/components/schemaImpianto/conversioneFlow.ts` (nuova `fondiDatiArchi`, docblock di `polilineaDellArco`)
- Modify: `src/services/schemaImpianto/tratti.ts` (docblock di `instrada`; firma e docblock di `trascinaTratto` — vedi correzione «giro di riparazione 1» più sotto)
- Modify: `src/components/schemaImpianto/useTrascinamentoTratto.ts` (riceve `quote`, la passa a `trascinaTratto`)
- Create: `src/components/schemaImpianto/__tests__/fondiDatiArchi.test.ts`
- Modify: `src/services/schemaImpianto/__tests__/tratti.test.ts` (firma nuova nei test esistenti di `trascinaTratto`, due test nuovi sulla regressione)

**Interfaces:**
- Consumes: `quoteInstradamento` da `@/services/schemaImpianto/layout`; `polilineaDellArco` da `./conversioneFlow` (Task 4).
- Produces: `fondiDatiArchi` in `./conversioneFlow` (funzione pura, nuova in questo task). Da qui in poi ogni arco della tela porta `data.quote`. `trascinaTratto` (tratti.ts) cambia firma: riceve anche `stile` e `quote`.

**Corretto in revisione (dopo il Task 4):** il piano diceva «nessun test automatico nuovo», motivato dal fatto che la fusione dei tre elenchi di archi vive dentro un `useMemo` di `SchemaEditor`, dove nessun test arriva (niente UI test, CLAUDE.md). Non è più vero: il ramo di ripiego di `polilineaDellArco` (`!data?.quote` → `polilineaConGomiti`) è una rete di sicurezza per il tipo, non coperta da nulla — se scattasse sulla tela, il difetto originale (rotte diverse fra editor e documento) tornerebbe in silenzio. Questo task estrae quindi la fusione in una funzione pura, `fondiDatiArchi` (conversioneFlow.ts), che prende i tre elenchi di archi più le quote e restituisce l'elenco fuso; il `useMemo` di `SchemaEditor` diventa una chiamata a questa funzione. Un test nuovo, `__tests__/fondiDatiArchi.test.ts`, prova l'invariante — ogni arco fuso porta `quote` valorizzato, e i callback dei tre hook sopravvivono alla fusione — SENZA fissare il comportamento del ripiego stesso (che non deve mai scattare sulla tela reale).

**Corretto in revisione (giro di riparazione 1) — Critical reale introdotto da questo task:** cablare `polilineaDellArco` dentro `SchemaEdgeTubazione` (Step 3) senza toccare `trascinaTratto` rompe il trascinamento del tratto per OGNI arco senza gomiti a mano — il caso di default, e proprio quello che il blocco doveva sistemare. `indiceTrattoPiuVicino` numera l'indice sulla polilinea VERA (`polilineaDellArco`/`instrada`), ma `trascinaTratto` ricostruiva `full` con `polilineaConGomiti(pDa, gomiti, pA)`: per uno stile senza gomiti le due polilinee hanno geometria e numero di tratti diversi, quindi l'indice numera un tratto diverso, oppure cade fuori dalla polilinea più corta e il gesto non fa nulla. Fix: `trascinaTratto` riceve `stile` e `quote` in più (stessa firma di `instrada`, con `indiceTratto`/`delta` in coda) e ricostruisce `full` con `instrada(stile, pDa, pA, gomiti, quote)`, non più con `polilineaConGomiti` da sola — così numera esattamente i tratti che l'utente vede, gomiti a mano compresi (`instrada` ci ripiega comunque quando ce ne sono). La `quote` non è nei dati dell'arco che questo hook legge (`stato.edges`, non quello fuso da `fondiDatiArchi`): `useTrascinamentoTratto` la riceve come quarto parametro, calcolato da `SchemaEditor` una volta per aggiornamento, la stessa istanza che finisce anche in `fondiDatiArchi`. Due test nuovi in `tratti.test.ts` (`describe('trascinaTratto')`) fissano i due scenari numerici trovati in revisione: uno stile `standard` senza gomiti dove il tratto verticale afferrato deve finire a x=130 (non x=230, l'indirizzo sbagliato della versione rotta), e uno stile `condensa` senza gomiti dove il gesto deve produrre uno spostamento reale (non `[]`, il no-op silenzioso della versione rotta).

- [ ] **Step 1: Calcola le quote nell'editor**

In `src/components/schemaImpianto/SchemaEditor.tsx`, aggiungi `quoteInstradamento` all'import da `@/services/schemaImpianto/layout` (riga 56) e inserisci, subito prima dell'`useMemo` dell'anteprima (riga 178):

```ts
  // Quote di instradamento (collettore della mandata flessibile, corsia delle condense):
  // dipendono da dove stanno TUTTI i nodi, non dal singolo arco, quindi si calcolano qui una
  // volta per aggiornamento e viaggiano nei dati di ogni arco. È la stessa funzione che usa
  // renderSvg, sullo stesso layout ricostruito dallo stato: calcolarle a modo proprio qui
  // rimetterebbe in piedi la divergenza fra tela e documento che questo blocco ha chiuso.
  // Ricalcolarle a ogni spostamento è voluto: le linee si riassestano mentre si trascina un
  // nodo, esattamente come farà il documento.
  const quote = useMemo(
    () => quoteInstradamento(flowALayout(stato.nodes, stato.edges)),
    [stato.nodes, stato.edges]
  )
```

- [ ] **Step 2: Estrai la fusione in una funzione pura e passa le quote a ogni arco**

La fusione dei tre elenchi di archi (riga 235) non resta dentro l'`useMemo` di `SchemaEditor`: si estrae in `conversioneFlow.ts`, accanto a `polilineaDellArco`, perché solo lì un test può arrivare a provare che ogni arco fuso porta `quote`.

In `src/components/schemaImpianto/conversioneFlow.ts`:

```ts
export function fondiDatiArchi(
  edgesConGomitiBase: Edge[],
  edgesConSegni: Edge[],
  edgesConTrascinamento: Edge[],
  quote: QuoteInstradamento
): Edge[] {
  return edgesConGomitiBase.map((e, i) => ({
    ...e,
    data: {
      ...e.data,
      ...edgesConSegni[i]?.data,
      ...edgesConTrascinamento[i]?.data,
      quote,
    } as SchemaEdgeData,
  }))
}
```

In `SchemaEditor.tsx`, l'`useMemo` diventa una chiamata a questa funzione:

```ts
  const edgesConGomiti = useMemo(
    () => fondiDatiArchi(edgesConGomitiBase, edgesConSegni, edgesConTrascinamento, quote),
    [edgesConGomitiBase, edgesConSegni, edgesConTrascinamento, quote]
  )
```

`quote` non entra nel modello salvato: `flowALayout` mappa esplicitamente `stile`, `punti` e `segni`, e ignora il resto dei dati dell'arco.

- [ ] **Step 2bis: Scrivi il test dell'invariante e vedilo fallire**

Crea `src/components/schemaImpianto/__tests__/fondiDatiArchi.test.ts`: costruisce i tre elenchi come li produrrebbero `useGomiti`, `useSegniTubo` e `useTrascinamentoTratto` (stesso id/capi per indice, un callback diverso ciascuno), chiama `fondiDatiArchi` e verifica che ogni arco fuso porti `quote` valorizzato e che i tre callback sopravvivano. Per vederlo fallire davvero, scrivi prima `fondiDatiArchi` SENZA il campo `quote` nella fusione, lancia il test e redirigi l'esito su file; poi aggiungi `quote` e rilancia. Non un test che fissa il comportamento del ripiego (`polilineaDellArco` senza `quote` → angolo singolo): quel ramo non deve mai scattare sulla tela reale, e un test così lo cementerebbe invece di proteggere dall'invariante.

- [ ] **Step 3: Fai disegnare l'arco con la rotta vera**

In `src/components/schemaImpianto/SchemaEdgeTubazione.tsx`, sostituisci la riga 263:

```ts
  // Stessa geometria del render statico (renderSvg.ts) per OGNI arco, con o senza gomiti:
  // editor e documento concordano sulla forma della linea — non più un'approssimazione.
  const polilinea = polilineaDellArco(pDa, pA, edgeData)
```

aggiungendo l'import di `polilineaDellArco` da `./conversioneFlow` e togliendo `polilineaConGomiti` dagli import se non resta usato altrove nel file.

- [ ] **Step 4: Riscrivi i commenti che oggi dichiarano il limite**

Non sono due, sono cinque, e vanno controllati uno per uno: il commento di testa di `SchemaEdgeTubazione.tsx` (righe 1-16), quello in `SchemaEditor.tsx` (righe ~168-177), il docblock di `polilineaDellArco` (conversioneFlow.ts), il docblock di `instrada` (tratti.ts) e il docblock del campo `SchemaEdgeData.quote` — tutti dicevano, in una forma o nell'altra, che il cablaggio non c'era ancora. Il giro di riparazione 1 aggiunge un sesto commento da riscrivere dopo il fix: il docblock di `onTrascinaTratto` (SchemaEdgeTubazione.tsx), che nominava `polilineaConGomiti` come la polilinea resa — falso una volta che `trascinaTratto` ricostruisce con `instrada`. I primi due erano stati corretti a fine Blocco B **proprio perché prima dicevano il falso**, e vanno tenuti onesti. Riscrivili così:

`SchemaEdgeTubazione.tsx`, righe 1-16:

```ts
/**
 * Collegamento dell'editor. I tre stili corrispondono alle convenzioni del CAD: rigida
 * continua, flessibile ondulata, condense tratteggiata.
 *
 * La forma della linea è la STESSA del render statico (`renderSvg.ts`) per ogni arco, con o
 * senza gomiti imposti a mano: entrambi passano da `instrada` (tratti.ts), l'editor tramite
 * `polilineaDellArco`. È questa condivisione a rendere sensato trascinare un tratto sulla
 * tela — quello che si sposta è lo stesso tratto che il .docx disegnerà. L'anteprima resta
 * comunque il giudice dell'aspetto finale, perché disegna anche ciò che la tela non mostra
 * affatto (tabella, legenda, nota sui diametri).
 */
```

`SchemaEditor.tsx`, righe 169-177 (il commento sopra l'`useMemo` dell'anteprima), per intero:

```ts
  // La tela di react-flow mostra nodi e archi — terminale utenze compreso, che dal 12-08-2026
  // è un nodo come gli altri e si ritocca qui — ma non muro, nota e tabella. Dal Blocco C1 le
  // linee hanno la stessa forma del render statico in ogni caso, con o senza gomiti imposti a
  // mano (`instrada` condivisa, vedi SchemaEdgeTubazione.tsx). L'anteprima qui accanto resta
  // comunque il giudice dell'aspetto finale — è la stessa funzione che produce il PNG del
  // .docx — perché disegna anche ciò che la tela non mostra affatto.
```

- [ ] **Step 5: Verifica**

```bash
npx vitest run src/components/schemaImpianto > task-5-verde.txt 2>&1
npx vitest run src/services/schemaImpianto > task-5-fix1-servizi.txt 2>&1
npx tsc --noEmit > task-5-tsc.txt 2>&1
npx eslint src/components/schemaImpianto > task-5-eslint.txt 2>&1
```

Atteso: verdi, `tsc` pulito, nessun errore di lint (attenzione agli import rimasti orfani). La seconda riga (`src/services/schemaImpianto`) è la correzione del giro di riparazione 1: la firma nuova di `trascinaTratto` vive lì, non sotto `src/components`.

- [ ] **Step 6: Commit**

```bash
git add src/components/schemaImpianto/SchemaEditor.tsx src/components/schemaImpianto/SchemaEdgeTubazione.tsx \
  src/components/schemaImpianto/conversioneFlow.ts src/components/schemaImpianto/useTrascinamentoTratto.ts \
  src/components/schemaImpianto/__tests__/fondiDatiArchi.test.ts \
  src/services/schemaImpianto/tratti.ts src/services/schemaImpianto/__tests__/tratti.test.ts
git commit -m "feat(schema-impianto): la tela disegna le rotte vere, quote calcolate dall'editor"
```

---

### Task 6: il trascinamento del tratto si riapre sul flessibile

**Files:**
- Modify: `src/components/schemaImpianto/SchemaEdgeTubazione.tsx:281-302` (commento e `pointerEvents`)

**Interfaces:**
- Consumes: `polilineaDellArco` (Task 5). Nessuna interfaccia nuova.

- [ ] **Step 1: Riapri il gesto**

Nel `<path>` invisibile dell'area di trascinamento, sostituisci la riga dello stile:

```tsx
        style={{ cursor: 'move', pointerEvents: 'all' }}
```

- [ ] **Step 2: Riscrivi il commento che motivava l'esclusione**

Il blocco di commento sopra il `<path>` (righe 281-296) spiega perché il flessibile era escluso. La ragione è caduta col Task 5 e va detto, non cancellato in silenzio — sostituisci gli ultimi due capoversi con:

```tsx
       * Attiva anche sul flessibile (fino al Blocco C1 era spenta lì): la sua polilinea dritta
       * ora coincide sempre con quella che il documento disegnerà, e l'onda non è altro che la
       * decorazione di quella stessa linea. Finché le due divergevano, un'area di presa
       * sagomata sulla dritta avrebbe spostato il tubo altrove da dove l'utente lo vede; ora è
       * lo stesso tubo, e il committente lo ha chiesto esplicitamente.
```

- [ ] **Step 3: Verifica**

```bash
npx vitest run src/components/schemaImpianto > task-6-verde.txt 2>&1
npx tsc --noEmit > task-6-tsc.txt 2>&1
```

Atteso: verdi, `tsc` pulito. Il comportamento si prova in pagina nel Task 7: `useTrascinamentoTratto` è già coperto dai suoi test unitari, mentre `pointerEvents` non è osservabile senza un browser.

- [ ] **Step 4: Commit**

```bash
git add src/components/schemaImpianto/SchemaEdgeTubazione.tsx
git commit -m "feat(schema-impianto): il tratto della tubazione flessibile torna trascinabile"
```

---

### Task 7: verifica in pagina e revisione finale del ramo

**Files:** nessuno (salvo correzioni che emergano).

Questa la fa **il controller**, non un implementatore.

- [ ] **Step 1: Suite intera e tsc, una sola esecuzione**

```bash
npx vitest run > finale-vitest.txt 2>&1
npx tsc --noEmit > finale-tsc.txt 2>&1
```

Atteso: almeno 876 test più quelli nuovi, tutti verdi; `tsc` vuoto.

- [ ] **Step 2: Verifica in pagina sulla pratica vera**

Dev server sulla 5176. Pratica `c6f56ca5-d57b-408c-a4e5-69a207812b0d` (LOWA R&D SRL) → `/requests/<id>/technical-details` → «Genera relazione» → «Rifinisci schema». Da provare, con `page.mouse` via `browser_run_code_unsafe` (non `PointerEvent` sintetici):

1. La mandata dai compressori sulla tela ha montante, tratto sul collettore e discesa — non più un angolo solo — e **coincide con l'anteprima** accanto.
2. Le mandate di linea girano a metà strada, le condense corrono sulla corsia comune: stesso confronto con l'anteprima.
3. Il tratto della flessibile si trascina, e i gomiti ai capi si aggiustano da soli.
4. Spostando un serbatoio, collettore e corsia si riassestano; l'anteprima resta d'accordo con la tela.
5. Un gomito imposto a mano su un arco flessibile continua a vincere sulla rotta nativa.

Chiudere con «Annulla modifiche» + «Annulla». **Mai premere «Genera comunque .docx»**: scrive su una pratica di produzione.

- [ ] **Step 3: Revisione finale del ramo intero**

Diff dell'intero blocco (`db8f07d..HEAD`) a un revisore fresco, come nei blocchi precedenti. I rilievi codificabili a basso rischio si correggono subito; quelli che cambiano il documento generato diventano domande per il committente, non decisioni del revisore.

- [ ] **Step 4: Aggiorna il ledger**

`.superpowers/sdd/2026-08-13-schema-impianto-blocco-c1/progress.md`: cause vere dei difetti trovati, decisioni prese, debito rimandato. La storia git non racconta i perché.

- [ ] **Step 5: Consegna al committente**

Riepilogo di cosa provare in pagina, con dichiarati i due comportamenti nuovi e visibili: le linee che si riassestano mentre si trascina un nodo, e la flessibile trascinabile nel tratto. Nessun merge su `main` finché non lo dice lui.
