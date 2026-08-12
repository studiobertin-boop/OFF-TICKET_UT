# Schema d'impianto — Blocco A: piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** fare del tratto finale verso le utenze un elemento vero e spostabile con la scritta modificabile, aggiungere in coda alla lista apparecchiature la legenda dei simboli presenti nel disegno, ondulare la tubazione flessibile per tutta la sua lunghezza, e saldare prima il debito di `conversioneFlow.ts`.

**Architecture:** il motore dello schema è una catena di funzioni pure — `buildSchemaModel` (modello logico) → `layoutSchema` (posizioni) → `renderSvg` (SVG statico) — affiancata da un editor react-flow che converte avanti e indietro con `conversioneFlow.ts` e persiste in `additional_info.schemaLayout`. Il blocco aggiunge un tipo di nodo (`utenze`) che percorre tutta la catena, una funzione pura nuova per l'ondulazione condivisa fra render statico ed editor, e una seconda famiglia di righe nella tabella.

**Tech Stack:** TypeScript (strict=false), React 18, @xyflow/react, MUI 6, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-12-schema-impianto-utenze-legenda-design.md`

## Global Constraints

- Si lavora **solo** nel worktree `.claude/worktrees/schema-impianto-dm329`, ramo `worktree-schema-impianto-dm329`. **Nessun merge e nessun push su `main`** finché il committente non lo dice.
- Dev server: `npm run dev -- --port 5176 --strictPort`, lanciato dentro il worktree.
- Verifica di fine task, sempre entrambe: `npx tsc --noEmit` pulito e `npx vitest run` verde. Baseline prima del Task 1: **730 test su 58 file**.
- **Ogni test nuovo va visto fallire PRIMA di scrivere l'implementazione**, se serve rompendo apposta il codice esistente. Un test che passa su entrambe le implementazioni non discrimina e non vale: nel blocco precedente cinque giri di riparazione sono nati da questo.
- **Non rifinire i simboli esistenti.** Il committente fornirà i suoi blocchi CAD e li attrezzeremo con un'interfaccia dedicata: qualunque ritocco estetico ai simboli attuali è lavoro buttato. Le sole modifiche grafiche ammesse sono quelle che questo piano prescrive.
- Commit convenzionali, in italiano, uno per task salvo dove il piano ne chiede due.
- Le verifiche in pagina le fa il controller, non l'implementatore. Se un implementatore riceve l'autorizzazione al browser, **è vietato premere «Genera comunque .docx»**: scrive su una pratica di produzione.
- Se l'implementazione scopre che il piano sbaglia o è incompleto, **il piano si corregge nello stesso commit del codice**, come parte del task e non come nota a margine.

### Tre trappole che fanno concludere il falso

- `addEdge` di react-flow **scarta i duplicati**: una connessione che sembra rifiutata può essere solo già esistente. Per provare un aggancio servono due ancore non già collegate.
- `onlyRenderVisibleElements` toglie dal DOM i nodi fuori vista: non sono persi, «Fit View» li riporta.
- Ogni ancora ha **due handle sovrapposti**: selezionarli con `.react-flow__handle.source[...]` e `.target[...]`, mai con `.first()`/`.last()`.

### Nota d'ordine rispetto alla spec

La spec elenca la legenda prima del flessibile ondulato. Il piano li inverte: il campione «tubazione flessibile» della legenda **riusa la funzione di ondulazione**, quindi questa dev'essere già in casa. Nessun contenuto cambia, solo la sequenza.

---

### Task 1: Il test che manca a `conversioneFlow.ts`

Modulo interamente puro, oggi senza alcun test, e punto d'origine di tre difetti del ramo precedente. Nessuna modifica al codice di produzione: solo la rete che il Task 2 userà.

**Files:**
- Create: `src/components/schemaImpianto/__tests__/conversioneFlow.test.ts`

**Interfaces:**
- Consumes: `layoutAFlow(layout: SchemaLayout): { nodes: Node[]; edges: Edge[] }` e `flowALayout(nodes: Node[], edges: Edge[]): SchemaLayout` da `../conversioneFlow`; `TIPO_NODO_FLOW`, `TIPO_ARCO_FLOW` dallo stesso file.
- Produces: niente. È un task di sola copertura.

- [ ] **Step 1: Scrivere il test dell'andata e ritorno e quello di `position` che vince**

Crea `src/components/schemaImpianto/__tests__/conversioneFlow.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import type { Node } from '@xyflow/react'
import type { SchemaLayout } from '@/services/schemaImpianto/types'
import { TIPO_ARCO_FLOW, TIPO_NODO_FLOW, flowALayout, layoutAFlow } from '../conversioneFlow'
import type { SchemaNodeData } from '../SchemaNodeSymbol'

/** Layout minimo ma completo: due nodi, un arco con ancore vere, stile e gomiti imposti. */
function layoutDiProva(): SchemaLayout {
  return {
    nodi: [
      {
        id: 'S1',
        tipo: 'serbatoio',
        etichetta: 'Serbatoio ACME',
        orientamento: 'VERTICALE',
        gruppo: 'SALA_COMPRESSORI',
        valvoleSicurezza: [],
        origine: 'scheda',
        x: 100,
        y: 200,
      },
      {
        id: 'F1',
        tipo: 'filtro',
        etichetta: 'Filtro ACME',
        gruppo: 'LINEA_DISTRIBUZIONE',
        valvoleSicurezza: [],
        origine: 'scheda',
        x: 400,
        y: 220,
      },
    ],
    archi: [
      {
        id: 'std-1',
        da: { nodo: 'S1', ancora: 'dx' },
        a: { nodo: 'F1', ancora: 'sx' },
        stile: 'flessibile',
        punti: [{ x: 300, y: 260 }],
      },
    ],
    muro: null,
  }
}

describe('layoutAFlow / flowALayout', () => {
  it('l’andata e ritorno conserva ancore, punti e stile', () => {
    const layout = layoutDiProva()
    const { nodes, edges } = layoutAFlow(layout)
    const tornato = flowALayout(nodes, edges)

    expect(tornato.nodi).toEqual(layout.nodi)
    expect(tornato.archi).toEqual(layout.archi)
  })

  it('traduce le ancore negli handle di react-flow e non altrove', () => {
    const { nodes, edges } = layoutAFlow(layoutDiProva())

    expect(nodes.map((n) => n.type)).toEqual([TIPO_NODO_FLOW, TIPO_NODO_FLOW])
    expect(nodes.map((n) => n.position)).toEqual([
      { x: 100, y: 200 },
      { x: 400, y: 220 },
    ])
    expect(edges[0].type).toBe(TIPO_ARCO_FLOW)
    expect(edges[0].sourceHandle).toBe('dx')
    expect(edges[0].targetHandle).toBe('sx')
  })

  it('alla conferma vince `position`, non la copia dentro `data.nodo`', () => {
    // Nell'editor un trascinamento aggiorna SOLO `position` (applyNodeChanges); una copia
    // divergente in `data.nodo` è esattamente lo stato in cui il ramo precedente ha prodotto
    // tre difetti. Qui si fissa chi comanda.
    const { nodes, edges } = layoutAFlow(layoutDiProva())
    const spostati: Node[] = nodes.map((n) =>
      n.id === 'S1' ? { ...n, position: { x: 777, y: 888 } } : n
    )

    const tornato = flowALayout(spostati, edges)
    const s1 = tornato.nodi.find((n) => n.id === 'S1')!

    expect(s1.x).toBe(777)
    expect(s1.y).toBe(888)
  })

  it('conserva i campi non posizionali del nodo attraverso il giro', () => {
    const { nodes, edges } = layoutAFlow(layoutDiProva())
    const tornato = flowALayout(nodes, edges)
    const s1 = tornato.nodi.find((n) => n.id === 'S1')!

    expect(s1.etichetta).toBe('Serbatoio ACME')
    expect(s1.orientamento).toBe('VERTICALE')
    expect(s1.origine).toBe('scheda')
    expect((nodes[0].data as SchemaNodeData).nodo.id).toBe('S1')
  })
})
```

- [ ] **Step 2: Vedere il terzo test fallire, rompendo apposta l'implementazione**

Il test «vince `position`» deve discriminare davvero. In `src/components/schemaImpianto/conversioneFlow.ts`, dentro `flowALayout`, **commenta temporaneamente** le due righe che sovrascrivono le coordinate:

```ts
  const nodi = nodes.map((n) => ({
    ...((n.data as SchemaNodeData).nodo satisfies SchemaNodoPosizionato),
    // x: n.position.x,
    // y: n.position.y,
  }))
```

Run: `npx vitest run src/components/schemaImpianto/__tests__/conversioneFlow.test.ts`
Expected: **FAIL** su «alla conferma vince `position`» (`expected 777, received 100`).

Se invece passa, il test non discrimina e va rifatto prima di proseguire.

- [ ] **Step 3: Ripristinare l'implementazione**

Togli i commenti: le due righe tornano attive. Nessun'altra modifica a `conversioneFlow.ts` in questo task.

- [ ] **Step 4: Vedere tutti i test passare**

Run: `npx vitest run src/components/schemaImpianto/__tests__/conversioneFlow.test.ts`
Expected: **PASS**, 4 test.

Run: `npx tsc --noEmit` → nessun errore.
Run: `npx vitest run` → verde, 734 test su 59 file.

- [ ] **Step 5: Commit**

```bash
git add src/components/schemaImpianto/__tests__/conversioneFlow.test.ts
git commit -m "test(schema-impianto): copre l'andata e ritorno di conversioneFlow e il primato di position"
```

---

### Task 2: Via `x`/`y` da `data.nodo`

Il disallineamento fra `position` e la copia in `data.nodo` ha morso tre volte nel ramo precedente (frecce, allineamento, distribuzione). `flowALayout` già ignora quella copia: qui si toglie la possibilità stessa di leggerla. Commit suo, subito dopo la rete del Task 1.

**Files:**
- Modify: `src/services/schemaImpianto/symbols/index.ts` (firme di `DefinizioneSimbolo.disegna`, `simboloDi`, e delle otto funzioni `simbolo*`)
- Modify: `src/components/schemaImpianto/SchemaNodeSymbol.tsx:9-11` (`SchemaNodeData`)
- Modify: `src/components/schemaImpianto/conversioneFlow.ts:15-36`
- Modify: `src/components/schemaImpianto/SchemaEditor.tsx` (`sposta`, `aggiungiNodo`)
- Modify: `src/components/schemaImpianto/useGomiti.ts:96-97`
- Modify: `src/components/schemaImpianto/useAllineamentoSelezione.ts:38-48, 61-71`

**Interfaces:**
- Consumes: i test del Task 1.
- Produces: `SchemaNodeData { nodo: SchemaNodo }` — da qui in poi **nessun consumatore dell'editor può leggere `data.nodo.x`/`.y`, perché non esistono più**. Le funzioni di disegno accettano `SchemaNodo`.

- [ ] **Step 1: Restringere il tipo che le funzioni di disegno chiedono**

In `src/services/schemaImpianto/symbols/index.ts`, cambia l'import e le firme. L'import diventa:

```ts
import type { SchemaNodoTipo, SchemaNodo, SchemaAncora, ChiaveSimbolo } from '../types'
```

Poi sostituisci **ogni** occorrenza di `nodo: SchemaNodoPosizionato` con `nodo: SchemaNodo` nelle firme di: `simboloCompressore`, `simboloSerbatoio`, `simboloRombo`, `simboloEssiccatore`, `simboloFiltro`, `simboloSeparatore`, `simboloTanica`, `simboloPaccoBombole`, nel campo `disegna` di `DefinizioneSimbolo`, e in `simboloDi`. Nessun corpo cambia: quelle funzioni leggono solo `id`, `tipo`, `orientamento`, `etichetta`, `accessorio` e `valvoleSicurezza`.

```ts
export interface DefinizioneSimbolo {
  dimensioni: { larghezza: number; altezza: number }
  ancore: SchemaAncora[]
  disegna: (nodo: SchemaNodo) => string
}
```

```ts
/** Frammento SVG del nodo in coordinate locali (senza traslazione). */
export function simboloDi(nodo: SchemaNodo): string {
  return definizioneDi(nodo).disegna(nodo)
}
```

`SchemaNodoPosizionato` estende `SchemaNodo`, quindi `renderSvg` continua a passare i suoi nodi posizionati senza modifiche.

- [ ] **Step 2: Togliere `x`/`y` dal dato che l'editor porta in giro**

In `src/components/schemaImpianto/SchemaNodeSymbol.tsx`:

```ts
import { definizioneDi, simboloDi } from '@/services/schemaImpianto/symbols'
import type { SchemaAncora, SchemaNodo } from '@/services/schemaImpianto/types'

export interface SchemaNodeData extends Record<string, unknown> {
  /**
   * Il nodo SENZA posizione: nell'editor l'unica coordinata viva è `Node.position`, che
   * `applyNodeChanges` aggiorna a ogni trascinamento e che `flowALayout` legge alla conferma.
   * Una seconda copia qui dentro divergerebbe al primo gesto — è la causa dei difetti di
   * frecce, allineamento e distribuzione del blocco «fondamenta».
   */
  nodo: SchemaNodo
}
```

- [ ] **Step 3: Adeguare la conversione**

In `src/components/schemaImpianto/conversioneFlow.ts`, `layoutAFlow` deve spogliare il nodo delle coordinate prima di metterlo in `data`, e `flowALayout` rimetterle da `position`:

```ts
export function layoutAFlow(layout: SchemaLayout): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = layout.nodi.map(({ x, y, ...nodo }) => ({
    id: nodo.id,
    type: TIPO_NODO_FLOW,
    position: { x, y },
    data: { nodo } satisfies SchemaNodeData,
  }))
```

```ts
export function flowALayout(nodes: Node[], edges: Edge[]): SchemaLayout {
  const nodi: SchemaNodoPosizionato[] = nodes.map((n) => ({
    ...(n.data as SchemaNodeData).nodo,
    x: n.position.x,
    y: n.position.y,
  }))
```

- [ ] **Step 4: Togliere le pezze che esistevano solo per la divergenza**

In `src/components/schemaImpianto/useGomiti.ts`, le due righe che rimettevano insieme le due fonti diventano un'unica lettura di `position`:

```ts
      const datiPartenza = { ...(nodoPartenza.data as SchemaNodeData).nodo, ...nodoPartenza.position }
      const datiArrivo = { ...(nodoArrivo.data as SchemaNodeData).nodo, ...nodoArrivo.position }
```

resta **identico** nel testo ma ora è l'unico modo di ottenere le coordinate, non una precauzione: aggiorna il commento sopra, che oggi dice «La posizione conta più di quella salvata in `data.nodo.x/y`», in:

```ts
      // Le coordinate vivono solo in `position`: `data.nodo` non le ha più (vedi SchemaNodeData).
```

In `src/components/schemaImpianto/useAllineamentoSelezione.ts`, le due funzioni costruiscono i nodi posizionati per `allinea`/`distribuisci` e **riscrivono solo `position`**, lasciando `data` intatto. In `applicaAllineamento`:

```ts
        const nodi = s.nodes
          .filter((n) => selezionati.has(n.id))
          .map((n) => ({ ...(n.data as SchemaNodeData).nodo, x: n.position.x, y: n.position.y }))
        const spostati = new Map(allinea(nodi, bordo).map((n) => [n.id, n]))
        return {
          ...s,
          nodes: s.nodes.map((n) => {
            const nuovo = spostati.get(n.id)
            return nuovo ? { ...n, position: { x: nuovo.x, y: nuovo.y } } : n
          }),
        }
```

e identicamente in `applicaDistribuzione` con `distribuisci(nodi, asse)`. Sostituisci il commento lungo che spiegava perché non leggere `data.nodo.x/y` con:

```ts
        // `data.nodo` non porta più le coordinate: `position` è l'unica fonte, e resta l'unica
        // cosa da riscrivere quando l'allineamento sposta un nodo.
```

- [ ] **Step 5: Adeguare i due punti dell'editor che scrivevano `data.nodo.x/y`**

In `src/components/schemaImpianto/SchemaEditor.tsx`, dentro `sposta`, l'ultima riga del `map`:

```ts
          const x = n.position.x + dx
          const y = n.position.y + dy
          return { ...n, position: { x, y } }
```

(la riga `const nodo = (n.data as SchemaNodeData).nodo` diventa inutile: toglila, e con essa il commento che spiegava perché non leggere `data.nodo`, sostituendolo con `// Le coordinate vivono solo in position.`)

Dentro `aggiungiNodo`, il nodo creato non porta più `...posizione`:

```ts
        const nodo = {
          id,
          tipo: voce.tipo,
          etichetta: voce.etichetta,
          gruppo: 'LINEA_DISTRIBUZIONE' as const,
          valvoleSicurezza: [],
          // Un'apparecchiatura presa dalla palette è una scelta deliberata dell'utente, non
          // qualcosa che la riconciliazione con la scheda deve poter cancellare.
          origine: 'manuale' as const,
        }
```

- [ ] **Step 6: Verificare che il compilatore non trovi più nessun lettore**

Run: `npx tsc --noEmit`
Expected: nessun errore. Se ne restano, sono punti che leggevano `data.nodo.x`/`.y` e che il piano non ha elencato: **correggili e aggiungi il file all'elenco Files di questo task nello stesso commit.**

Controprova che non sia rimasto nulla:

Run: `git grep -n "data.nodo.x\|data.nodo.y\|nodo.x, y: n.position" -- src/components`
Expected: nessun risultato.

- [ ] **Step 7: Vedere la suite verde**

Run: `npx vitest run`
Expected: verde, 734 test su 59 file. I test del Task 1 passano invariati: `flowALayout` continua a produrre gli stessi `SchemaNodoPosizionato`.

- [ ] **Step 8: Commit**

```bash
git add src/services/schemaImpianto/symbols/index.ts src/components/schemaImpianto
git commit -m "refactor(schema-impianto): toglie x/y da data.nodo, position resta l'unica fonte"
```

---

### Task 3: Il tipo di nodo `utenze` e il suo simbolo

Solo registro e disegno: il nodo non entra ancora in nessun modello. Deliverable verificabile da solo.

**Files:**
- Modify: `src/services/schemaImpianto/types.ts:20-28` (`SchemaNodoTipo`)
- Modify: `src/services/schemaImpianto/symbols/index.ts` (`DIMENSIONI`, `simboloUtenze`, `REGISTRO_SIMBOLI`, `DIMENSIONI_NODO`)
- Modify: `src/services/schemaImpianto/__tests__/simboli.test.ts`

**Interfaces:**
- Consumes: `SchemaNodo`, `testo`, `traccia` da `symbols/index.ts`.
- Produces: tipo `'utenze'` in `SchemaNodoTipo`; `REGISTRO_SIMBOLI.utenze` con `dimensioni { larghezza: 190, altezza: 120 }` e l'unica ancora `{ id: 'in', x: 12, y: 120, accetta: ['aria'] }`; `simboloUtenze(nodo: SchemaNodo): string`.

- [ ] **Step 1: Scrivere i test del simbolo**

In coda a `src/services/schemaImpianto/__tests__/simboli.test.ts` aggiungi:

```ts
describe('simbolo «Alle utenze»', () => {
  const utenze = {
    id: 'UTENZE',
    tipo: 'utenze' as const,
    etichetta: 'Utenze aria',
    gruppo: 'LINEA_DISTRIBUZIONE' as const,
    valvoleSicurezza: [],
    origine: 'scheda' as const,
  }

  it('disegna la scritta che il nodo porta, non una cablata nel codice', () => {
    expect(simboloDi(utenze)).toContain('>Utenze aria</text>')
    expect(simboloDi({ ...utenze, etichetta: 'Utenze azoto' })).toContain('>Utenze azoto</text>')
  })

  it('disegna il codolo tratteggiato e la punta di freccia piena', () => {
    const svg = simboloDi(utenze)
    // Tratteggio come le altre linee di servizio del disegno.
    expect(svg).toContain('stroke-dasharray="10 7"')
    // La punta è un triangolo pieno, non un marker: nell'editor il simbolo vive in un <svg>
    // suo, dove i <defs> di renderSvg non esistono e un marker-end non verrebbe disegnato.
    // Il path completo (non il solo `fill="#000"`, che compare già sul <text> della scritta e
    // quindi non discriminerebbe un'implementazione priva del triangolo) prova che il
    // triangolo esiste davvero, con la geometria attesa.
    expect(svg).toContain('<path d="M 6 27 L 12 14 L 18 27 Z" fill="#000" />')
    expect(svg).not.toContain('marker-end')
  })

  it('dichiara una sola ancora, in basso al codolo, che accetta aria', () => {
    const def = definizioneDi(utenze)
    expect(def.ancore).toEqual([{ id: 'in', x: 12, y: 120, accetta: ['aria'] }])
    expect(def.dimensioni).toEqual({ larghezza: 190, altezza: 120 })
  })

  it('l’ancora accetta l’aria e rifiuta la condensa', () => {
    expect(capoValido(utenze, 'in', 'standard')).toBe(true)
    expect(capoValido(utenze, 'in', 'flessibile')).toBe(true)
    expect(capoValido(utenze, 'in', 'condensa')).toBe(false)
  })
})
```

Il file oggi importa solo `REGISTRO_SIMBOLI`, `definizioneDi`, `ancoraDi`: **`simboloDi` e `capoValido` mancano entrambi.** Aggiungi in testa:

```ts
import { REGISTRO_SIMBOLI, definizioneDi, ancoraDi, simboloDi } from '../symbols'
import { capoValido } from '../agganci'
```

- [ ] **Step 2: Vedere i test fallire**

Run: `npx vitest run src/services/schemaImpianto/__tests__/simboli.test.ts`
Expected: **FAIL** — il tipo `'utenze'` non esiste (errore di compilazione in Vitest) e `REGISTRO_SIMBOLI.utenze` è `undefined`.

- [ ] **Step 3: Aggiungere il tipo**

In `src/services/schemaImpianto/types.ts`:

```ts
export type SchemaNodoTipo =
  | 'compressore'
  | 'serbatoio'
  | 'essiccatore'
  | 'filtro'
  | 'separatore'
  | 'tanica'
  | 'pacco_bombole'
  /**
   * Terminale della linea aria: non è un'apparecchiatura di scheda, non ha codice e non entra
   * nella lista. Porta la scritta modificabile («Utenze aria», «Utenze azoto», …) e l'ancora
   * su cui si innesta la tubazione finale, che prima del 12-08-2026 era una freccia disegnata
   * d'ufficio da `renderUscitaUtenze` e quindi non toccabile nell'editor.
   */
  | 'utenze'
```

- [ ] **Step 4: Disegnare il simbolo e registrarlo**

In `src/services/schemaImpianto/symbols/index.ts`, aggiungi l'ingombro in `DIMENSIONI`:

```ts
  pacco_bombole: { larghezza: 120, altezza: 100 },
  utenze: { larghezza: 190, altezza: 120 },
```

la funzione di disegno, subito dopo `simboloPaccoBombole`:

```ts
/**
 * Terminale «Alle utenze»: codolo tratteggiato che sale dall'ancora, punta di freccia e la
 * scritta accanto. Riproduce la forma del disegno di riferimento del committente
 * (`DOCUMENTAZIONE/relazione/schema.png`), dove il tratteggio è corto e il tratto prima è
 * tubazione vera.
 *
 * La punta è un triangolo pieno e non un `marker-end`: nell'editor `SchemaNodeSymbol` monta il
 * simbolo in un `<svg>` suo, senza i `<defs>` che `renderSvg` dichiara, e un marker non
 * verrebbe disegnato affatto.
 */
export function simboloUtenze(nodo: SchemaNodo): string {
  const { altezza } = DIMENSIONI.utenze
  const x = 12
  const yPunta = 14
  return [
    `<path d="M ${x} ${altezza} L ${x} ${yPunta + 12}" fill="none" stroke="#000" stroke-width="${TRATTO}" stroke-dasharray="10 7" />`,
    `<path d="M ${x - 6} ${yPunta + 13} L ${x} ${yPunta} L ${x + 6} ${yPunta + 13} Z" fill="#000" />`,
    testo(x + 18, yPunta + 6, nodo.etichetta, 18, 'start'),
  ].join('')
}
```

e la voce nel registro, dopo `pacco_bombole`:

```ts
  utenze: {
    dimensioni: DIMENSIONI.utenze,
    // Una sola: la linea aria ci arriva e finisce lì. Sta in fondo al codolo, dove il
    // tratteggio comincia, così la tubazione entrante e il codolo formano un tratto continuo.
    ancore: [{ id: 'in', x: 12, y: 120, accetta: ['aria'] }],
    disegna: simboloUtenze,
  },
```

infine l'ingombro riesportato:

```ts
  pacco_bombole: REGISTRO_SIMBOLI.pacco_bombole.dimensioni,
  utenze: REGISTRO_SIMBOLI.utenze.dimensioni,
```

- [ ] **Step 5: Vedere i test passare**

Run: `npx vitest run src/services/schemaImpianto/__tests__/simboli.test.ts`
Expected: **PASS**.

Run: `npx tsc --noEmit`
Expected: nessun errore. `SchemaNodoTipo` è usato in `Record<SchemaNodoTipo, …>` in `DIMENSIONI` e `DIMENSIONI_NODO`: se uno dei due non ha la voce nuova, il compilatore lo dice qui.

Run: `npx vitest run`
Expected: verde.

- [ ] **Step 6: Commit**

```bash
git add src/services/schemaImpianto/types.ts src/services/schemaImpianto/symbols/index.ts src/services/schemaImpianto/__tests__/simboli.test.ts
git commit -m "feat(schema-impianto): il terminale «Alle utenze» diventa un simbolo del registro"
```

---

### Task 4: `buildSchemaModel` crea il nodo utenze e la sua tubazione

**Files:**
- Modify: `src/services/schemaImpianto/buildSchemaModel.ts` (`buildArchi`, `buildSchemaModel`)
- Modify: `src/services/schemaImpianto/__tests__/buildSchemaModel.test.ts`
- Modify: `docs/superpowers/specs/2026-08-12-schema-impianto-utenze-legenda-design.md` (una frase, vedi Step 5)

**Interfaces:**
- Consumes: `REGISTRO_SIMBOLI.utenze` e il tipo `'utenze'` dal Task 3.
- Produces: nel modello, un nodo `{ id: 'UTENZE', tipo: 'utenze', etichetta: 'Utenze aria', gruppo: 'LINEA_DISTRIBUZIONE', valvoleSicurezza: [], origine: 'scheda' }` e un arco `{ id: 'ut-N', da: { nodo: <ultimo stadio>, ancora: 'dx' }, a: { nodo: 'UTENZE', ancora: 'in' }, stile: 'standard' }`.

- [ ] **Step 1: Scrivere i test**

In coda a `src/services/schemaImpianto/__tests__/buildSchemaModel.test.ts`:

```ts
describe('terminale verso le utenze', () => {
  it('nasce con la tubazione che parte dall’ultimo stadio della catena di trattamento', () => {
    const scheda = makeScheda({
      compressori: [makeCompressore({ ha_disoleatore: false })],
      disoleatori: [],
      serbatoi: [makeSerbatoio()],
      essiccatori: [makeEssiccatore()],
      scambiatori: [],
      filtri: [makeFiltro({ codice: 'F1', tipo: 'FILTRO' })],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
    })
    const modello = buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })

    const utenze = modello.nodi.find((n) => n.tipo === 'utenze')!
    expect(utenze.id).toBe('UTENZE')
    expect(utenze.etichetta).toBe('Utenze aria')
    expect(utenze.origine).toBe('scheda')

    // La catena è E1 → F1 (i filtri di linea stanno a valle dell'essiccatore): l'ultimo è F1.
    const arco = modello.archi.find((a) => a.a.nodo === 'UTENZE')!
    expect(arco.da).toEqual({ nodo: 'F1', ancora: 'dx' })
    expect(arco.a).toEqual({ nodo: 'UTENZE', ancora: 'in' })
    expect(arco.stile).toBe('standard')
  })

  it('senza catena di trattamento parte dal serbatoio che alimenta la linea', () => {
    const scheda = makeScheda({
      compressori: [makeCompressore({ ha_disoleatore: false })],
      disoleatori: [],
      serbatoi: [makeSerbatoio()],
      essiccatori: [],
      scambiatori: [],
      filtri: [],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
    })
    const modello = buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })

    expect(modello.archi.find((a) => a.a.nodo === 'UTENZE')!.da).toEqual({ nodo: 'S1', ancora: 'dx' })
  })

  it('non nasce affatto se non c’è né catena né serbatoio', () => {
    const scheda = makeScheda({
      compressori: [makeCompressore({ ha_disoleatore: false })],
      disoleatori: [],
      serbatoi: [],
      essiccatori: [],
      scambiatori: [],
      filtri: [],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
    })
    const modello = buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: {} })

    expect(modello.nodi.some((n) => n.tipo === 'utenze')).toBe(false)
    expect(modello.archi.some((a) => a.a.nodo === 'UTENZE')).toBe(false)
  })

  it('resta fuori dalla catena di trattamento e dal pozzo di raccolta condense', () => {
    const scheda = makeScheda({
      compressori: [makeCompressore({ ha_disoleatore: false })],
      disoleatori: [],
      serbatoi: [makeSerbatoio()],
      essiccatori: [makeEssiccatore()],
      scambiatori: [],
      filtri: [],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'tanica' }),
    })
    const modello = buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })
    const utenze = modello.nodi.find((n) => n.tipo === 'utenze')!

    expect(ordinaCatenaTrattamento(modello.nodi, null).map((n) => n.id)).not.toContain('UTENZE')
    expect(pozzoCondense(modello.nodi, modello)?.id).not.toBe(utenze.id)
    // E non riceve né emette condensa.
    expect(modello.archi.some((a) => a.stile === 'condensa' && a.a.nodo === 'UTENZE')).toBe(false)
    expect(modello.archi.some((a) => a.stile === 'condensa' && a.da.nodo === 'UTENZE')).toBe(false)
  })
})
```

Aggiungi agli import del file, se mancano: `ordinaCatenaTrattamento` da `../buildSchemaModel`, `pozzoCondense` da `../layout`, e le fixture `makeEssiccatore`/`makeFiltro` da `@/services/relazione/__tests__/fixtures`.

- [ ] **Step 2: Vedere i test fallire**

Run: `npx vitest run src/services/schemaImpianto/__tests__/buildSchemaModel.test.ts`
Expected: **FAIL** — nessun nodo di tipo `utenze` esiste nel modello.

- [ ] **Step 3: Creare nodo e arco**

In `src/services/schemaImpianto/buildSchemaModel.ts`, sopra `buildArchi`, aggiungi:

```ts
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
    etichetta: 'Utenze aria',
    gruppo: 'LINEA_DISTRIBUZIONE',
    valvoleSicurezza: [],
    // Origine 'scheda' e non 'manuale': fa parte della proposta automatica, quindi la
    // riconciliazione lo rimette se manca. Cancellarlo nell'editor lo fa tornare alla
    // riapertura, ed è la conseguenza accettata dal committente.
    origine: 'scheda',
  }
}
```

Dentro `buildArchi`, subito **dopo** il blocco della catena di trattamento e **prima** di quello delle condense, aggiungi:

```ts
  // Tubazione finale verso le utenze. Il nodo esiste solo se ha da chi partire, quindi qui si
  // decide anche se `buildSchemaModel` deve aggiungerlo (vedi `sorgenteUtenze`).
  const sorgente = catenaLinea.length > 0 ? catenaLinea[catenaLinea.length - 1].id : serbatoiChiave[0]
  if (sorgente) {
    archi.push({
      id: prossimoId('ut'),
      da: { nodo: sorgente, ancora: 'dx' },
      a: { nodo: ID_UTENZE, ancora: 'in' },
      stile: 'standard',
    })
  }
```

In `buildSchemaModel`, dopo l'aggiunta del pozzo di raccolta condense e **prima** della `return`:

```ts
  // Il terminale entra nei nodi solo se `buildArchi` ha davvero una sorgente da cui farlo
  // partire: un arco verso un nodo assente, o un nodo senza tubazione, sarebbero entrambi
  // incoerenti. Si decide guardando gli archi appena costruiti, unica fonte.
  const archi = buildArchi(nodi, input, raccoltaCondense)
  if (archi.some((a) => a.a.nodo === ID_UTENZE)) nodi.push(nodoUtenze())

  return { nodi, archi }
```

(sostituisce la `return { nodi, archi: buildArchi(nodi, input, raccoltaCondense) }` attuale).

- [ ] **Step 4: Vedere i test passare**

Run: `npx vitest run src/services/schemaImpianto/__tests__/buildSchemaModel.test.ts`
Expected: **PASS**.

Run: `npx vitest run`
Expected: **alcuni test di `renderSvg.test.ts` e `layout.test.ts` possono fallire** perché il modello ha ora un nodo in più che nessuno posiziona. È atteso e i Task 5 e 6 lo chiudono. Annota quali falliscono nel report: se ne fallisce uno che non riguarda posizioni o conteggi di nodi, indagalo prima di proseguire.

Run: `npx tsc --noEmit` → nessun errore.

- [ ] **Step 5: Correggere la frase della spec che questo task ha reso imprecisa**

La spec dice «l'ultimo della catena di trattamento, altrimenti l'ultimo serbatoio». Il codice usa il serbatoio **da cui la linea parte** (`serbatoiChiave[0]`, lo stesso che alimenta la catena), perché due regole diverse per la stessa linea produrrebbero un disegno con le tubazioni incrociate. In `docs/superpowers/specs/2026-08-12-schema-impianto-utenze-legenda-design.md`, sostituisci

> l'ultimo della catena di trattamento, altrimenti l'ultimo serbatoio

con

> l'ultimo della catena di trattamento, altrimenti il serbatoio da cui la linea parte — lo stesso che alimenta la catena

- [ ] **Step 6: Commit**

```bash
git add src/services/schemaImpianto/buildSchemaModel.ts src/services/schemaImpianto/__tests__/buildSchemaModel.test.ts docs/superpowers/specs/2026-08-12-schema-impianto-utenze-legenda-design.md
git commit -m "feat(schema-impianto): il modello costruisce il terminale utenze e la sua tubazione"
```

---

### Task 5: `layoutSchema` colloca il terminale

**Files:**
- Modify: `src/services/schemaImpianto/layout.ts` (`layoutSchema`)
- Modify: `src/services/schemaImpianto/__tests__/layout.test.ts`

**Interfaces:**
- Consumes: il nodo `utenze` nel modello (Task 4), `DIMENSIONI_NODO.utenze` (Task 3).
- Produces: il nodo `UTENZE` posizionato a destra della catena, con l'ancora `in` alla quota della fascia orizzontale su cui corrono le tubazioni di linea.

- [ ] **Step 1: Scrivere il test**

In coda a `src/services/schemaImpianto/__tests__/layout.test.ts`:

```ts
describe('collocazione del terminale utenze', () => {
  function layoutConUtenze() {
    const scheda = makeScheda({
      compressori: [makeCompressore({ ha_disoleatore: false })],
      disoleatori: [],
      serbatoi: [makeSerbatoio()],
      essiccatori: [makeEssiccatore()],
      scambiatori: [],
      filtri: [],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
    })
    return layoutSchema(buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } }))
  }

  it('sta a destra di tutto il resto della linea', () => {
    const layout = layoutConUtenze()
    const utenze = layout.nodi.find((n) => n.tipo === 'utenze')!
    const altri = layout.nodi.filter((n) => n.tipo !== 'utenze')

    expect(utenze.x).toBeGreaterThan(Math.max(...altri.map((n) => n.x)))
  })

  it('mette l’ancora alla quota della fascia su cui corrono le tubazioni di linea', () => {
    const layout = layoutConUtenze()
    const utenze = layout.nodi.find((n) => n.tipo === 'utenze')!
    const essiccatore = layout.nodi.find((n) => n.tipo === 'essiccatore')!

    // L'ancora `in` sta in fondo al codolo: la sua quota assoluta è y + altezza.
    const quotaAncora = utenze.y + DIMENSIONI_NODO.utenze.altezza
    const centroEssiccatore = essiccatore.y + DIMENSIONI_NODO.essiccatore.altezza / 2

    expect(quotaAncora).toBe(centroEssiccatore)
  })

  it('allarga il disegno fino a comprendere la scritta', () => {
    const layout = layoutConUtenze()
    const utenze = layout.nodi.find((n) => n.tipo === 'utenze')!

    expect(dimensioniLayout(layout).larghezza).toBeGreaterThanOrEqual(
      utenze.x + DIMENSIONI_NODO.utenze.larghezza
    )
  })
})
```

Aggiungi agli import quel che manca: `dimensioniLayout` e `DIMENSIONI_NODO` da `../layout`, `makeEssiccatore` dalle fixture.

- [ ] **Step 2: Vedere i test fallire**

Run: `npx vitest run src/services/schemaImpianto/__tests__/layout.test.ts`
Expected: **FAIL** con `utenze` non trovato fra i nodi posizionati (`layoutSchema` non lo dispone, quindi lo perde).

- [ ] **Step 3: Collocare il nodo**

In `src/services/schemaImpianto/layout.ts`, dentro `layoutSchema`, dopo `const rigaRaccolta = …` e prima di `const nodi = [`:

```ts
  // Il terminale utenze non sta in nessuna riga: si appoggia a destra di tutto ciò che lo
  // precede, con l'ancora (in fondo al codolo, vedi il registro simboli) proprio sulla fascia
  // orizzontale dove corrono le tubazioni di linea — così la tubazione che vi arriva entra
  // dritta invece di fare due gomiti per raggiungerlo.
  const utenze = model.nodi.filter((n) => n.tipo === 'utenze')
  const posizionatiUtenze = utenze.map((n) =>
    posiziona(n, rigaCatena.xFinale, yCentroSerbatoi - DIMENSIONI_NODO.utenze.altezza)
  )
```

e includili nell'elenco:

```ts
  const nodi = [
    ...rigaCompressori.posizionati,
    ...rigaSerbatoi.posizionati,
    ...rigaCatena.posizionati,
    ...rigaRaccolta.posizionati,
    ...posizionatiUtenze,
  ]
```

- [ ] **Step 4: Vedere i test passare**

Run: `npx vitest run src/services/schemaImpianto/__tests__/layout.test.ts`
Expected: **PASS**.

Run: `npx tsc --noEmit` → nessun errore.

Run: `npx vitest run` → i test di `renderSvg.test.ts` possono ancora fallire (doppia uscita utenze: il nodo nuovo più la vecchia freccia automatica). Il Task 6 li chiude.

- [ ] **Step 5: Commit**

```bash
git add src/services/schemaImpianto/layout.ts src/services/schemaImpianto/__tests__/layout.test.ts
git commit -m "feat(schema-impianto): il layout colloca il terminale utenze in fondo alla linea"
```

---

### Task 6: Via la freccia automatica; il terminale fuori dalla lista

Chiude il doppio disegno: da qui l'uscita verso le utenze esiste **solo** come nodo.

**Files:**
- Modify: `src/services/schemaImpianto/renderSvg.ts` (import, `SPAZIO_UTENZE`, `centro`, `renderMandataLinea`, `renderArchi`, `renderUscitaUtenze`, `righeLista`, `renderSvg`)
- Modify: `src/services/schemaImpianto/__tests__/renderSvg.test.ts`

**Interfaces:**
- Consumes: nodo `utenze` posizionato (Task 5).
- Produces: `righeLista` salta i nodi di tipo `utenze`; `renderMandataLinea(da, ancoraDa, a, ancoraA, gomiti?, frecciaFinale = true)`.

- [ ] **Step 1: Aggiornare e aggiungere i test**

In `src/services/schemaImpianto/__tests__/renderSvg.test.ts`, il test «disegna l'uscita verso le utenze aria» resta valido ma va reso esplicito su **da dove** viene la scritta. Sostituiscilo con:

```ts
  it('disegna l’uscita verso le utenze come nodo, non più come freccia d’ufficio', () => {
    const scheda = makeScheda({
      compressori: [makeCompressore({ ha_disoleatore: false })],
      disoleatori: [],
      serbatoi: [makeSerbatoio({ orientamento: 'ORIZZONTALE' })],
      essiccatori: [],
      scambiatori: [],
      filtri: [],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
    })
    const layout = layoutSchema(
      buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })
    )
    const utenze = layout.nodi.find((n) => n.tipo === 'utenze')!
    utenze.etichetta = 'Utenze azoto'

    const svg = renderSvg(layout)
    // La scritta viene dal nodo: cambiarla nel layout la cambia nel disegno.
    expect(svg).toContain('>Utenze azoto</text>')
    expect(svg).not.toContain('>Utenze aria</text>')
    // Una sola uscita: se la freccia automatica sopravvivesse, di terminali se ne vedrebbero due.
    expect(svg.match(/stroke-dasharray="10 7"/g) ?? []).toHaveLength(1)
  })

  it('il terminale utenze non compare fra le apparecchiature in lista', () => {
    const scheda = makeScheda({
      compressori: [makeCompressore({ ha_disoleatore: false })],
      disoleatori: [],
      serbatoi: [makeSerbatoio()],
      essiccatori: [],
      scambiatori: [],
      filtri: [],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
    })
    const layout = layoutSchema(
      buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })
    )

    expect(layout.nodi.some((n) => n.tipo === 'utenze')).toBe(true)
    expect(righeLista(layout).map((r) => r.codice)).not.toContain('UTENZE')
  })

  it('la tubazione che arriva al terminale non porta una seconda punta di freccia', () => {
    const scheda = makeScheda({
      compressori: [makeCompressore({ ha_disoleatore: false })],
      disoleatori: [],
      serbatoi: [makeSerbatoio()],
      essiccatori: [makeEssiccatore()],
      scambiatori: [],
      filtri: [],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
    })
    const layout = layoutSchema(
      buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })
    )
    const svg = renderSvg(layout)

    // Gli archi con marker sono tutti tranne quello verso il terminale, che ha già la sua
    // punta disegnata dentro il simbolo: due frecce a 120 unità l'una dall'altra sulla stessa
    // linea si leggerebbero come due terminali.
    const conFreccia = svg.match(/marker-end="url\(#freccia\)"/g) ?? []
    expect(conFreccia).toHaveLength(layout.archi.length - 1)
  })
```

Il test «tratteggia le linee condense e lascia continue le altre» conta `condense.length + 1`: il `+ 1` era l'uscita automatica e ora è il codolo del nodo, quindi il conteggio resta esatto. **Aggiorna solo il commento** dentro quel test:

```ts
    // Una linea tratteggiata per ogni scarico condensa, più il codolo del terminale utenze.
```

- [ ] **Step 2: Vedere i test fallire**

Run: `npx vitest run src/services/schemaImpianto/__tests__/renderSvg.test.ts`
Expected: **FAIL** — due tratteggi invece di uno (freccia automatica + codolo), `>Utenze aria</text>` ancora presente perché cablato, `UTENZE` presente in `righeLista`, e una freccia di troppo.

- [ ] **Step 3: Togliere la freccia automatica**

In `src/services/schemaImpianto/renderSvg.ts`:

1. Cancella per intero la funzione `renderUscitaUtenze` (righe 221-240 incluso il suo commento) e la costante `SPAZIO_UTENZE` (righe 17-18).
2. Cancella la funzione `centro` (righe 87-91): la usava solo `renderUscitaUtenze`.
3. Nell'import da `./layout`, togli `DIMENSIONI_NODO`, rimasto senza lettori:

```ts
import { corpoNodo, dimensioniLayout, pozzoCondense } from './layout'
```

4. In `renderSvg`, togli `const uscita = …` e il suo contributo alla larghezza e all'elenco:

```ts
  const archi = renderArchi(layout, yCorsiaCondense, yCollettore)

  const larghezzaTabella = COLONNA_CODICE + 620 + MARGINE * 2
  const larghezzaTotale = Math.max(dimensioniDisegno.larghezza, larghezzaTabella)
```

e nell'array finale togli la riga `uscita.svg,`. La larghezza del disegno ora comprende già la scritta, perché il terminale è un nodo e `dimensioniLayout` lo misura.

- [ ] **Step 4: Escludere il terminale dalla lista**

In `righeLista`, in testa al ciclo:

```ts
  for (const nodo of layout.nodi) {
    // Il terminale utenze è un raccordo, non un'apparecchiatura: non ha codice né marca, e in
    // tabella occuperebbe una riga che non dice nulla. La legenda spiegherà i simboli, non lui.
    if (nodo.tipo === 'utenze') continue
    righe.push({ codice: nodo.id, descrizione: nodo.etichetta })
```

- [ ] **Step 5: Togliere la seconda punta di freccia**

`renderMandataLinea` prende un parametro in coda e lo usa per il marker:

```ts
/** Mandata di linea fra due stadi di trattamento: tratto orizzontale con valvola in ingresso. */
function renderMandataLinea(
  da: SchemaNodoPosizionato,
  ancoraDa: string,
  a: SchemaNodoPosizionato,
  ancoraA: string,
  gomiti?: Punto[],
  frecciaFinale = true
): { svg: string; punti: Punto[] } {
```

e, alla fine del corpo:

```ts
  const freccia = frecciaFinale ? ' marker-end="url(#freccia)"' : ''
  const svg =
    `<path d="${percorso(punti)}" fill="none" stroke="#000" stroke-width="${TRATTO}"${freccia} />` +
    valvolaIntercettazione(pA.x - 22, pA.y)
  return { svg, punti }
```

In `renderArchi`, la chiamata passa il flag:

```ts
          : renderMandataLinea(da, arco.da.ancora, a, arco.a.ancora, arco.punti, a.tipo !== 'utenze')
```

con questo commento sopra il `for`:

```ts
  // La tubazione che finisce sul terminale utenze non porta la propria punta di freccia: quel
  // simbolo ne disegna già una in cima al codolo, e due punte sulla stessa linea a poche decine
  // di unità l'una dall'altra si leggono come due terminali distinti.
```

- [ ] **Step 6: Vedere i test passare**

Run: `npx vitest run src/services/schemaImpianto/__tests__/renderSvg.test.ts`
Expected: **PASS**.

Run: `npx tsc --noEmit`
Expected: nessun errore, e in particolare nessun «declared but never read»: se ne compare uno, è un residuo di `renderUscitaUtenze` da togliere.

Run: `npx vitest run`
Expected: **verde, tutta la suite**. Da qui in poi non ci sono più test rossi in sospeso.

- [ ] **Step 7: Commit**

```bash
git add src/services/schemaImpianto/renderSvg.ts src/services/schemaImpianto/__tests__/renderSvg.test.ts
git commit -m "feat(schema-impianto): l'uscita verso le utenze esiste solo come nodo, mai più disegnata d'ufficio"
```

---

### Task 7: La riconciliazione rimette il terminale nei layout già salvati

Gli schemi salvati prima di oggi non hanno quel nodo. La strada generica li mette **sotto** il disegno (`piede + 320`), che per un terminale sarebbe sbagliato: finirebbe in fondo alla tela con la tubazione che risale tutto il foglio.

**Files:**
- Modify: `src/services/schemaImpianto/persistenza.ts` (`riconcilia`)
- Modify: `src/services/schemaImpianto/__tests__/persistenza.test.ts`

**Interfaces:**
- Consumes: `ID_UTENZE` da `./buildSchemaModel` (Task 4), `DIMENSIONI_NODO` da `./layout`.
- Produces: nessuna firma nuova. `riconcilia` colloca il nodo `utenze` mancante con la regola geometrica della vecchia freccia.

- [ ] **Step 1: Scrivere i test**

In coda a `src/services/schemaImpianto/__tests__/persistenza.test.ts`:

```ts
describe('terminale utenze nei layout salvati prima che esistesse', () => {
  /** Un layout salvato «vecchio»: quello che il motore produce oggi, meno il terminale. */
  function salvatoSenzaUtenze(modello: ReturnType<typeof modelloDiProva>) {
    const layout = layoutSchema(modello)
    return {
      nodi: layout.nodi.filter((n) => n.tipo !== 'utenze'),
      archi: layout.archi.filter((a) => a.a.nodo !== 'UTENZE'),
    }
  }

  it('lo aggiunge, con la sua tubazione', () => {
    const modello = modelloDiProva(['C1'])
    const esito = riconcilia(salvatoSenzaUtenze(modello), modello)

    expect(esito.aggiunti).toContain('UTENZE')
    expect(esito.layout.nodi.some((n) => n.tipo === 'utenze')).toBe(true)
    expect(esito.layout.archi.some((a) => a.a.nodo === 'UTENZE')).toBe(true)
  })

  it('lo mette dove cadeva la freccia automatica, non in fondo alla tela', () => {
    const modello = modelloDiProva(['C1'])
    const salvato = salvatoSenzaUtenze(modello)
    const esito = riconcilia(salvato, modello)
    const utenze = esito.layout.nodi.find((n) => n.tipo === 'utenze')!

    // La regola della vecchia `renderUscitaUtenze`: a destra del nodo più a destra escluso il
    // pozzo condense, con l'ancora alla quota del suo centro.
    const ultimo = salvato.nodi
      .filter((n) => n.tipo !== 'compressore' && n.tipo !== 'tanica')
      .reduce((a, b) => (a.x > b.x ? a : b))
    const dimUltimo = DIMENSIONI_NODO[ultimo.tipo]

    expect(utenze.x).toBe(ultimo.x + dimUltimo.larghezza + 50)
    expect(utenze.y + DIMENSIONI_NODO.utenze.altezza).toBe(ultimo.y + dimUltimo.altezza / 2)

    // Il ripiego generico l'avrebbe buttato sotto tutto il disegno: qui non deve succedere.
    const piede = Math.max(...salvato.nodi.map((n) => n.y))
    expect(utenze.y).toBeLessThan(piede + 320)
  })

  it('non lo duplica se il layout salvato ce l’ha già, e non ne sposta la posizione', () => {
    const modello = modelloDiProva(['C1'])
    const salvato = { ...salvatoSenzaUtenze(modello) }
    salvato.nodi = [
      ...salvato.nodi,
      {
        id: 'UTENZE',
        tipo: 'utenze',
        etichetta: 'Utenze azoto',
        gruppo: 'LINEA_DISTRIBUZIONE',
        valvoleSicurezza: [],
        origine: 'scheda',
        x: 1234,
        y: 56,
      },
    ]
    const esito = riconcilia(salvato, modello)
    const utenze = esito.layout.nodi.filter((n) => n.tipo === 'utenze')

    expect(utenze).toHaveLength(1)
    expect(utenze[0].x).toBe(1234)
    expect(utenze[0].y).toBe(56)
    expect(esito.aggiunti).not.toContain('UTENZE')
  })

  it('la scritta scelta dall’utente sopravvive alla riapertura', () => {
    // Il terminale è di origine 'scheda', quindi la riconciliazione riscriverebbe i suoi campi
    // dal modello: l'etichetta però è l'unica cosa che l'utente può cambiare, e perderla a ogni
    // riapertura renderebbe inutile poterla cambiare.
    const modello = modelloDiProva(['C1'])
    const salvato = { ...salvatoSenzaUtenze(modello) }
    salvato.nodi = [
      ...salvato.nodi,
      {
        id: 'UTENZE',
        tipo: 'utenze',
        etichetta: 'Utenze azoto',
        gruppo: 'LINEA_DISTRIBUZIONE',
        valvoleSicurezza: [],
        origine: 'scheda',
        x: 900,
        y: 100,
      },
    ]

    const esito = riconcilia(salvato, modello)
    expect(esito.layout.nodi.find((n) => n.tipo === 'utenze')!.etichetta).toBe('Utenze azoto')
  })
})
```

Aggiungi agli import: `DIMENSIONI_NODO` e `layoutSchema` da `../layout`.

- [ ] **Step 2: Vedere i test fallire**

Run: `npx vitest run src/services/schemaImpianto/__tests__/persistenza.test.ts`
Expected: **FAIL** — il terminale viene aggiunto ma sotto il disegno (`y` pari a `piede + 320`), e la scritta scelta dall'utente viene riscritta con «Utenze aria» dal modello.

- [ ] **Step 3: Collocare il terminale e conservarne la scritta**

In `src/services/schemaImpianto/persistenza.ts`, aggiungi l'import:

```ts
import { ID_UTENZE } from './buildSchemaModel'
import { calcolaMuro, layoutSchema, DIMENSIONI_NODO } from './layout'
```

Sopra `riconcilia`, aggiungi:

```ts
/**
 * Dove far comparire il terminale utenze in un layout salvato che non ce l'ha. La strada
 * generica dei nodi nuovi (sotto tutto il disegno) qui sarebbe sbagliata: il terminale chiude
 * la linea aria, e messo in fondo alla tela costringerebbe la sua tubazione a risalire tutto il
 * foglio. Si riapplica invece, alle posizioni salvate, la stessa regola geometrica che usava
 * `renderUscitaUtenze` prima del 12-08-2026 — a destra dell'ultimo stadio della linea, con
 * l'ancora alla quota del suo centro — così chi riapre un disegno lo ritrova dove ha sempre
 * visto la freccia.
 */
function posizioneTerminale(nodi: SchemaNodoPosizionato[]): { x: number; y: number } | null {
  const inLinea = nodi.filter((n) => n.tipo !== 'compressore' && n.tipo !== 'tanica' && n.tipo !== 'utenze')
  if (inLinea.length === 0) return null
  const ultimo = inLinea.reduce((a, b) => (a.x > b.x ? a : b))
  const dim = DIMENSIONI_NODO[ultimo.tipo]
  return {
    x: ultimo.x + dim.larghezza + 50,
    y: ultimo.y + dim.altezza / 2 - DIMENSIONI_NODO.utenze.altezza,
  }
}
```

Dentro `riconcilia`, dopo il calcolo di `superstiti` e prima di `const nodi = [...superstiti, ...posizionati]`, cambia il `map` dei nuovi in modo che il terminale prenda la sua posizione dedicata:

```ts
  const posizionati = nuovi.map((n) => {
    const proposto = automatico.nodi.find((p) => p.id === n.id)!
    if (n.tipo === 'utenze') {
      const dedicata = posizioneTerminale(superstiti)
      if (dedicata) return { ...proposto, ...dedicata }
    }
    return { ...proposto, y: proposto.y + piede }
  })
```

Infine, nella costruzione dei `superstiti`, il terminale conserva l'etichetta scelta dall'utente:

```ts
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
```

- [ ] **Step 4: Vedere i test passare**

Run: `npx vitest run src/services/schemaImpianto/__tests__/persistenza.test.ts`
Expected: **PASS**.

Run: `npx tsc --noEmit` → nessun errore.
Run: `npx vitest run` → verde.

- [ ] **Step 5: Commit**

```bash
git add src/services/schemaImpianto/persistenza.ts src/services/schemaImpianto/__tests__/persistenza.test.ts
git commit -m "feat(schema-impianto): la riconciliazione rimette il terminale utenze dove cadeva la freccia"
```

---

### Task 8: L'ondulazione, funzione pura in un file suo

Serve a tre consumatori — il render statico, l'editor e il campione della legenda — quindi non può vivere dentro `renderSvg.ts`, che `symbols/index.ts` non può importare senza chiudere un ciclo.

**Files:**
- Create: `src/services/schemaImpianto/tratti.ts`
- Create: `src/services/schemaImpianto/__tests__/tratti.test.ts`
- Modify: `src/services/schemaImpianto/renderSvg.ts` (import di `Punto`, `renderMandataCompressore`, via `ondeVerticali`)

**Interfaces:**
- Consumes: niente.
- Produces: `interface Punto { x: number; y: number }` e `ondula(punti: Punto[]): string` da `./tratti`. `renderSvg.ts` continua a esportare `Punto` per i consumatori esistenti.

- [ ] **Step 1: Scrivere i test**

Crea `src/services/schemaImpianto/__tests__/tratti.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { ondula, PASSO_ONDA } from '../tratti'

/** Coppie (x,y) di tutti i punti d'arrivo dei comandi Q, nell'ordine. */
function arriviQ(d: string): [number, number][] {
  return [...d.matchAll(/Q [-\d.]+ [-\d.]+ ([-\d.]+) ([-\d.]+)/g)].map((m) => [
    Number(m[1]),
    Number(m[2]),
  ])
}

describe('ondula', () => {
  it('parte dal primo punto e arriva esattamente sull’ultimo', () => {
    const d = ondula([
      { x: 0, y: 0 },
      { x: 50, y: 0 },
    ])
    expect(d.startsWith('M 0 0')).toBe(true)
    expect(arriviQ(d).at(-1)).toEqual([50, 0])
  })

  it('mette un’onda ogni PASSO_ONDA unità', () => {
    const d = ondula([
      { x: 0, y: 0 },
      { x: 50, y: 0 },
    ])
    expect(arriviQ(d)).toHaveLength(50 / PASSO_ONDA)
  })

  it('ondula anche in verticale, sfalsando la x invece della y', () => {
    const orizzontale = ondula([
      { x: 0, y: 0 },
      { x: 50, y: 0 },
    ])
    const verticale = ondula([
      { x: 0, y: 0 },
      { x: 0, y: 50 },
    ])
    // Un'implementazione che sposta sempre la y darebbe controlli con x costante: qui la x dei
    // punti di controllo deve variare, ed è ciò che distingue le due direzioni.
    const controlliX = [...verticale.matchAll(/Q ([-\d.]+) /g)].map((m) => Number(m[1]))
    expect(new Set(controlliX).size).toBeGreaterThan(1)
    expect(orizzontale).not.toBe(verticale)
  })

  it('alterna i lati: due onde consecutive non stanno dalla stessa parte', () => {
    const d = ondula([
      { x: 0, y: 0 },
      { x: 50, y: 0 },
    ])
    const controlliY = [...d.matchAll(/Q [-\d.]+ ([-\d.]+) /g)].map((m) => Number(m[1]))
    expect(controlliY[0]).toBe(-controlliY[1])
  })

  it('riparte a ogni vertice, così gli spigoli restano netti', () => {
    const d = ondula([
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 30 },
    ])
    // Il vertice dev'essere toccato esattamente, non tagliato da un'onda a cavallo.
    expect(arriviQ(d)).toContainEqual([50, 0])
    expect(arriviQ(d).at(-1)).toEqual([50, 30])
  })

  it('un tratto più corto di un’onda resta un’onda sola, e finisce dove deve', () => {
    const d = ondula([
      { x: 0, y: 0 },
      { x: 3, y: 0 },
    ])
    expect(arriviQ(d)).toHaveLength(1)
    expect(arriviQ(d)[0]).toEqual([3, 0])
  })

  it('salta i tratti di lunghezza nulla senza produrre NaN', () => {
    const d = ondula([
      { x: 10, y: 10 },
      { x: 10, y: 10 },
      { x: 10, y: 40 },
    ])
    expect(d).not.toContain('NaN')
    expect(arriviQ(d).at(-1)).toEqual([10, 40])
  })
})
```

- [ ] **Step 2: Vedere i test fallire**

Run: `npx vitest run src/services/schemaImpianto/__tests__/tratti.test.ts`
Expected: **FAIL** — `../tratti` non esiste.

- [ ] **Step 3: Scrivere la funzione**

Crea `src/services/schemaImpianto/tratti.ts`:

```ts
/**
 * Geometria dei tratti di tubazione, condivisa da chi disegna: il render statico
 * (`renderSvg.ts`), l'editor (`SchemaEdgeTubazione.tsx`) e i campioni della legenda
 * (`symbols/index.ts`). Sta in un file suo perché `symbols` non può importare `renderSvg`
 * senza chiudere un ciclo, e perché è geometria pura, verificabile senza DOM.
 */

export interface Punto {
  x: number
  y: number
}

/** Mezzo periodo dell'onda del flessibile, in unità SVG. */
export const PASSO_ONDA = 5
/** Quanto l'onda si scosta dall'asse del tubo. */
export const AMPIEZZA_ONDA = 5

/**
 * Tracciato ondulato che segue una polilinea: convenzione CAD della tubazione flessibile.
 *
 * L'onda è perpendicolare alla direzione di ogni tratto e **riparte a ogni vertice**, così gli
 * spigoli restano netti come nei blocchi di riferimento invece di essere smussati da un'onda a
 * cavallo di due tratti. Il numero di mezzi periodi si adatta alla lunghezza e il passo si
 * ridistribuisce, perché il tratto deve finire esattamente sull'ancora e non a un'onda di
 * distanza: un tubo che non tocca il bocchello è un errore di disegno visibile.
 *
 * La polilinea passata resta la verità geometrica del percorso — chi calcola i varchi nel muro
 * continua a lavorare su quella, non su questo tracciato.
 */
export function ondula(punti: Punto[]): string {
  if (punti.length === 0) return ''
  const parti = [`M ${punti[0].x} ${punti[0].y}`]

  for (let i = 1; i < punti.length; i++) {
    const a = punti[i - 1]
    const b = punti[i]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const lunghezza = Math.hypot(dx, dy)
    // Due punti coincidenti (gomito posato sull'ancora): niente da ondulare, e dividere per
    // zero riempirebbe il tracciato di NaN.
    if (lunghezza === 0) continue

    const ux = dx / lunghezza
    const uy = dy / lunghezza
    // Perpendicolare alla direzione del tratto: è su questa che l'onda oscilla.
    const px = -uy
    const py = ux

    const mezziPeriodi = Math.max(1, Math.round(lunghezza / PASSO_ONDA))
    const passo = lunghezza / mezziPeriodi

    for (let k = 0; k < mezziPeriodi; k++) {
      const verso = k % 2 === 0 ? 1 : -1
      const inizio = k * passo
      const fine = inizio + passo
      const mezzo = inizio + passo / 2
      const cx = a.x + ux * mezzo + px * AMPIEZZA_ONDA * verso
      const cy = a.y + uy * mezzo + py * AMPIEZZA_ONDA * verso
      const ex = a.x + ux * fine
      const ey = a.y + uy * fine
      parti.push(`Q ${arrotonda(cx)} ${arrotonda(cy)} ${arrotonda(ex)} ${arrotonda(ey)}`)
    }
  }

  return parti.join(' ')
}

/** Due decimali bastano al disegno e tengono l'SVG leggibile nei test. */
function arrotonda(valore: number): number {
  return Math.round(valore * 100) / 100
}
```

- [ ] **Step 4: Vedere i test passare**

Run: `npx vitest run src/services/schemaImpianto/__tests__/tratti.test.ts`
Expected: **PASS**, 7 test.

- [ ] **Step 5: Far ondulare il flessibile nel render statico**

In `src/services/schemaImpianto/renderSvg.ts`:

1. Sostituisci la definizione locale di `Punto` con l'import, e riesportala per chi già la importa da qui:

```ts
import { ondula, type Punto } from './tratti'

export type { Punto }
```

(togli il blocco `export interface Punto { x: number; y: number }` alle righe 22-25).

2. Cancella la funzione `ondeVerticali` (righe 93-100): l'onda non è più un ricciolo sul montante.

3. In `renderMandataCompressore`, la linea diventa il tracciato ondulato per tutta la sua lunghezza:

```ts
  // Il flessibile è ondulato da un capo all'altro, come nei blocchi di riferimento: prima del
  // 12-08-2026 l'onda era un ricciolo di 40 unità sul solo montante, e la legenda — che ne
  // mostra un campione — rendeva la differenza evidente.
  const linea = `<path d="${ondula(punti)}" fill="none" stroke="#000" stroke-width="${TRATTO}" marker-end="url(#freccia)" />`
  // La valvola sta sul montante: farfalla verticale, in linea col tubo.
  const svg = linea + valvolaIntercettazione(pDa.x, pDa.y - 62, 'verticale')
  return { svg, punti }
```

Nota: `punti` resta la polilinea liscia e continua a essere restituito così, perché `renderArchi` ne ricava i varchi nel muro con `quoteAttraversamento`.

- [ ] **Step 6: Aggiungere il test che lega le due cose**

In `src/services/schemaImpianto/__tests__/renderSvg.test.ts`, in coda:

```ts
  it('disegna il flessibile ondulato per tutta la lunghezza, non a riccioli', () => {
    const svg = svgMinimo()
    const flessibile = svg.match(/<path d="M [^"]*Q [^"]*" fill="none" stroke="#000"[^>]*marker-end/g) ?? []

    expect(flessibile.length).toBeGreaterThan(0)
    // Molte onde, non le quattro del vecchio ricciolo da 40 unità.
    expect((flessibile[0].match(/Q /g) ?? []).length).toBeGreaterThan(8)
  })

  it('i varchi nel muro si calcolano sulla polilinea liscia, non sull’onda', () => {
    // Se `quoteAttraversamento` ricevesse il tracciato ondulato, i tratti orizzontali non
    // sarebbero più orizzontali e nessun varco si aprirebbe: il muro tornerebbe pieno.
    const scheda = makeScheda({
      compressori: [makeCompressore({ ha_disoleatore: false })],
      disoleatori: [],
      serbatoi: [makeSerbatoio({ ubicazione: 'LINEA_DISTRIBUZIONE' })],
      essiccatori: [],
      scambiatori: [],
      filtri: [],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
    })
    const layout = layoutSchema(
      buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })
    )

    expect(layout.muro).not.toBeNull()
    const svg = renderSvg(layout)

    // I tronconi pieni del muro sono i rect di spessore 14. Se `quoteAttraversamento` non
    // trovasse più tratti orizzontali, non si aprirebbe nessun varco e i tronconi coprirebbero
    // l'intera altezza del muro: è questo il confronto che discrimina, non il loro numero (con
    // un varco a ridosso di un estremo il troncone resta uno solo).
    const altezze = [...svg.matchAll(/<rect x="[\d.]+" y="[-\d.]+" width="14" height="([\d.]+)"/g)].map(
      (m) => Number(m[1])
    )
    const coperto = altezze.reduce((s, h) => s + h, 0)
    const altezzaMuro = layout.muro!.yMax - layout.muro!.yMin

    expect(altezze.length).toBeGreaterThan(0)
    expect(coperto).toBeLessThan(altezzaMuro)
  })
```

Run: `npx vitest run src/services/schemaImpianto/__tests__/renderSvg.test.ts`
Expected: **PASS**.

Se il secondo test non passasse perché nella configurazione scelta il muro non nasce o nessuna linea lo attraversa, **non allentarlo**: cambia la configurazione della scheda finché non c'è davvero un compressore da un lato e un serbatoio dall'altro, e annota nel report la configurazione usata.

- [ ] **Step 7: Verifica e commit**

Run: `npx tsc --noEmit` → nessun errore (`ondeVerticali` non deve restare importata o dichiarata).
Run: `npx vitest run` → verde.

```bash
git add src/services/schemaImpianto/tratti.ts src/services/schemaImpianto/__tests__/tratti.test.ts src/services/schemaImpianto/renderSvg.ts src/services/schemaImpianto/__tests__/renderSvg.test.ts
git commit -m "feat(schema-impianto): il flessibile è ondulato per tutta la lunghezza del tratto"
```

---

### Task 9: Il flessibile ondulato anche sulla tela dell'editor

Chiude anche il commento che oggi promette un'ondulazione che il componente non disegna.

**Files:**
- Modify: `src/components/schemaImpianto/SchemaEdgeTubazione.tsx:1-4, 121-161`

**Interfaces:**
- Consumes: `ondula` da `@/services/schemaImpianto/tratti` (Task 8).
- Produces: niente di nuovo.

- [ ] **Step 1: Disegnare l'onda**

In `src/components/schemaImpianto/SchemaEdgeTubazione.tsx`, aggiungi l'import:

```ts
import { ondula } from '@/services/schemaImpianto/tratti'
```

e sostituisci il calcolo del percorso (righe 143-148) con:

```ts
  // Quando ci sono gomiti imposti a mano, il percorso è la polilinea che passa per loro:
  // getSmoothStepPath serve solo a piazzare l'etichetta, non più a disegnare la linea.
  const punti = edgeData?.punti ?? []
  const polilinea = [{ x: sourceX, y: sourceY }, ...punti, { x: targetX, y: targetY }]
  // Il flessibile si riconosce dall'onda, come nel disegno finale e nel campione di legenda:
  // per averla serve una polilinea, quindi qui si rinuncia alla rotta `smoothstep` e si va
  // dritti da un capo all'altro. È una delle approssimazioni dichiarate della tela — il
  // giudice dell'aspetto resta il pannello di anteprima, che disegna la rotta vera.
  const path =
    stile === 'flessibile'
      ? ondula(polilinea)
      : punti.length
        ? [`M ${sourceX} ${sourceY}`, ...punti.map((p) => `L ${p.x} ${p.y}`), `L ${targetX} ${targetY}`].join(' ')
        : pathAutomatico
```

- [ ] **Step 2: Rendere onesto il commento in testa al file**

Sostituisci le righe 1-4 con:

```tsx
/**
 * Collegamento dell'editor. I tre stili corrispondono alle convenzioni del CAD: rigida
 * continua, flessibile ondulata, condense tratteggiata.
 *
 * Il flessibile rinuncia alla rotta `smoothstep` di react-flow perché l'onda richiede una
 * polilinea: sulla tela va quindi dritto da un capo all'altro, mentre il pannello di anteprima
 * mostra la rotta vera. È l'approssimazione già dichiarata per il resto della tela, non un
 * difetto.
 */
```

- [ ] **Step 3: Verificare**

Run: `npx tsc --noEmit` → nessun errore.
Run: `npx vitest run` → verde (nessun test di UI: la suite non cambia).

Verifica visiva **del controller**, non dell'implementatore, alla fine del blocco.

- [ ] **Step 4: Commit**

```bash
git add src/components/schemaImpianto/SchemaEdgeTubazione.tsx
git commit -m "feat(schema-impianto): la tela disegna il flessibile ondulato, e il commento smette di mentire"
```

---

### Task 10: La legenda dei simboli in coda alla lista

**Files:**
- Modify: `src/services/schemaImpianto/symbols/index.ts` (campioni per la legenda)
- Modify: `src/services/schemaImpianto/renderSvg.ts` (`RigaTabella`, `righeLista`, `righeLegenda`, `renderTabella`, `renderSvg`)
- Modify: `src/services/schemaImpianto/types.ts` (commento sulla valvola di scarico)
- Modify: `src/services/schemaImpianto/__tests__/renderSvg.test.ts`

**Interfaces:**
- Consumes: `ondula` (Task 8), `valvolaIntercettazione`/`valvolaScarico` dal registro.
- Produces:

```ts
export type CellaSinistra = { codice: string } | { simbolo: string }
export interface RigaTabella { sinistra: CellaSinistra; descrizione: string }
export function righeLista(layout: SchemaLayout): RigaTabella[]
export function righeLegenda(layout: SchemaLayout): RigaTabella[]
export function campioneTubazione(stile: SchemaArcoStile): string  // in symbols/index.ts
```

**Attenzione:** `righeLista` cambia forma di ritorno (`{ codice, descrizione }` → `{ sinistra, descrizione }`). I test esistenti che fanno `righeLista(layout).map((r) => r.codice)` vanno adeguati nello stesso task.

- [ ] **Step 1: Scrivere i test**

In coda a `src/services/schemaImpianto/__tests__/renderSvg.test.ts`:

```ts
describe('legenda dei simboli', () => {
  function descrizioni(layout: Parameters<typeof righeLegenda>[0]) {
    return righeLegenda(layout).map((r) => r.descrizione)
  }

  function layoutCon(opzioni: { condense: boolean; essiccatore: boolean }) {
    const scheda = makeScheda({
      compressori: [makeCompressore({ ha_disoleatore: false })],
      disoleatori: [],
      serbatoi: [makeSerbatoio()],
      essiccatori: opzioni.essiccatore ? [makeEssiccatore()] : [],
      scambiatori: [],
      filtri: [],
      dati_impianto: makeDatiImpianto({
        raccolta_condense: opzioni.condense ? 'tanica' : 'Nessuna',
      }),
    })
    return layoutSchema(buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } }))
  }

  it('elenca i simboli presenti, nell’ordine stabilito', () => {
    expect(descrizioni(layoutCon({ condense: true, essiccatore: true }))).toEqual([
      'Valvola di intercettazione',
      'Valvola di scarico',
      'Tubazione rigida',
      'Tubazione flessibile',
      'Linea condense',
    ])
  })

  it('tace sulla linea condense quando l’impianto non ne ha', () => {
    expect(descrizioni(layoutCon({ condense: false, essiccatore: true }))).not.toContain('Linea condense')
  })

  it('mette la valvola di scarico solo se un simbolo la disegna davvero', () => {
    // La disegnano serbatoio, essiccatore e filtro. NON il separatore (`conScarico: false`,
    // «scarica da un codolo nudo») e non il compressore: il commento in testa a types.ts
    // diceva il contrario, ed è il commento a sbagliare.
    const conSerbatoio = layoutCon({ condense: false, essiccatore: false })
    expect(descrizioni(conSerbatoio)).toContain('Valvola di scarico')

    const soloSeparatore: typeof conSerbatoio = {
      ...conSerbatoio,
      nodi: conSerbatoio.nodi.map((n) =>
        n.tipo === 'serbatoio' ? { ...n, tipo: 'separatore' as const, orientamento: undefined } : n
      ),
    }
    expect(descrizioni(soloSeparatore)).not.toContain('Valvola di scarico')
  })

  it('non ripete la valvola di sicurezza, che ha già la sua riga con codice', () => {
    const scheda = makeScheda({
      compressori: [makeCompressore({ ha_disoleatore: false })],
      disoleatori: [],
      serbatoi: [makeSerbatoio({ valvola_sicurezza: makeValvola() })],
      essiccatori: [],
      scambiatori: [],
      filtri: [],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
    })
    const layout = layoutSchema(
      buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })
    )

    expect(righeLista(layout).some((r) => r.descrizione.startsWith('Valvola di sicurezza'))).toBe(true)
    expect(descrizioni(layout)).not.toContain('Valvola di sicurezza')
  })

  it('la cella di sinistra porta un simbolo, non un codice', () => {
    const righe = righeLegenda(layoutCon({ condense: true, essiccatore: true }))
    expect(righe.every((r) => 'simbolo' in r.sinistra)).toBe(true)
    expect(righeLista(layoutCon({ condense: true, essiccatore: true })).every((r) => 'codice' in r.sinistra)).toBe(true)
  })

  it('il campione del flessibile è ondulato come il tubo che rappresenta', () => {
    const riga = righeLegenda(layoutCon({ condense: true, essiccatore: true })).find(
      (r) => r.descrizione === 'Tubazione flessibile'
    )!
    expect((riga.sinistra as { simbolo: string }).simbolo).toContain('Q ')
  })

  it('la tabella disegna la legenda sotto le apparecchiature e cresce di conseguenza', () => {
    const layout = layoutCon({ condense: true, essiccatore: true })
    const svg = renderSvg(layout)

    expect(svg).toContain('Valvola di intercettazione')
    expect(svg).toContain('Tubazione flessibile')
    // L'altezza totale deve tenere conto anche delle righe di legenda: se non lo facesse, le
    // ultime righe finirebbero fuori dalla viewBox e sparirebbero dal PNG.
    const altezza = Number(svg.match(/height="(\d+(?:\.\d+)?)"/)![1])
    const righeTotali = righeLista(layout).length + righeLegenda(layout).length
    expect(altezza).toBeGreaterThan(34 * righeTotali)
  })
})
```

Aggiungi `righeLegenda` agli import da `../renderSvg`, e `makeValvola`/`makeEssiccatore` dalle fixture se mancano.

Adegua inoltre i tre test esistenti che leggono `r.codice`: `righeLista(layout).map((r) => r.codice)` diventa

```ts
righeLista(layout).map((r) => (r.sinistra as { codice: string }).codice)
```

- [ ] **Step 2: Vedere i test fallire**

Run: `npx vitest run src/services/schemaImpianto/__tests__/renderSvg.test.ts`
Expected: **FAIL** — `righeLegenda` non esiste.

- [ ] **Step 3: I campioni, nel registro dei simboli**

In `src/services/schemaImpianto/symbols/index.ts`, aggiungi l'import di `ondula` e del tipo dello stile:

```ts
import { ondula } from '../tratti'
import type { SchemaArcoStile, SchemaNodoTipo, SchemaNodo, SchemaAncora, ChiaveSimbolo } from '../types'
```

e, dopo `valvolaScarico`, la funzione:

```ts
/**
 * Campione di tubazione per la legenda: un tratto orizzontale centrato sull'origine, reso con
 * lo stesso stile che `renderSvg` dà alla tubazione vera. Riusare qui la funzione che disegna
 * (`ondula`) invece di ridisegnare un'onda a mano è ciò che tiene campione e disegno d'accordo
 * per costruzione: un'onda «di legenda» diversa da quella dei tubi sarebbe una didascalia falsa.
 */
export function campioneTubazione(stile: SchemaArcoStile): string {
  const meta = 30
  const capi = [
    { x: -meta, y: 0 },
    { x: meta, y: 0 },
  ]
  if (stile === 'flessibile') {
    return `<path d="${ondula(capi)}" fill="none" stroke="#000" stroke-width="${TRATTO}" />`
  }
  const tratteggio = stile === 'condensa' ? ' stroke-dasharray="10 7"' : ''
  return `<path d="M ${-meta} 0 L ${meta} 0" fill="none" stroke="#000" stroke-width="${TRATTO}"${tratteggio} />`
}
```

- [ ] **Step 4: Le righe della legenda**

In `src/services/schemaImpianto/renderSvg.ts`, aggiungi agli import da `./symbols` quel che serve:

```ts
import {
  ancoraDi,
  campioneTubazione,
  escapeXml,
  simboloDi,
  simboloMuro,
  valvolaIntercettazione,
  valvolaScarico,
  TRATTO,
} from './symbols'
```

Sostituisci la firma di `righeLista` e introduci i tipi, subito sopra di essa:

```ts
/**
 * La colonna di sinistra della tabella porta due cose diverse: il codice di un'apparecchiatura,
 * o il disegno di un simbolo che la legenda spiega. Un tipo che le distingue evita di dedurre
 * dal contenuto quale delle due sia.
 */
export type CellaSinistra = { codice: string } | { simbolo: string }

export interface RigaTabella {
  sinistra: CellaSinistra
  descrizione: string
}

/** Tipi di nodo il cui simbolo disegna la valvola di scarico. Il commento in testa a `types.ts`
 *  elencava anche separatore e disoleatore: `simboloSeparatore` la esclude di proposito
 *  (`conScarico: false`) e il compressore non la disegna affatto. */
const CON_VALVOLA_SCARICO: SchemaNodoTipo[] = ['serbatoio', 'essiccatore', 'filtro']

/**
 * Legenda dei simboli, in coda alla lista apparecchiature come negli schemi del committente
 * (`DOCUMENTAZIONE/relazione/schema.png`): il simbolo al posto del codice, il suo nome accanto.
 *
 * Compaiono solo i simboli che il disegno contiene davvero — una legenda che spiega ciò che non
 * c'è fa cercare al lettore qualcosa che non troverà. La valvola di sicurezza resta fuori: ha
 * già la sua riga con codice, marca e modello, e la legenda spiega solo ciò che nessuna riga
 * codificata identifica.
 */
export function righeLegenda(layout: SchemaLayout): RigaTabella[] {
  const stili = new Set(layout.archi.map((a) => a.stile))
  const righe: RigaTabella[] = []

  // La disegnano le mandate, rigide e flessibili: nessuna linea condense la porta.
  if (stili.has('standard') || stili.has('flessibile')) {
    righe.push({ sinistra: { simbolo: valvolaIntercettazione(0, 0) }, descrizione: 'Valvola di intercettazione' })
  }
  if (layout.nodi.some((n) => CON_VALVOLA_SCARICO.includes(n.tipo))) {
    righe.push({ sinistra: { simbolo: valvolaScarico(0, -4) }, descrizione: 'Valvola di scarico' })
  }
  if (stili.has('standard')) {
    righe.push({ sinistra: { simbolo: campioneTubazione('standard') }, descrizione: 'Tubazione rigida' })
  }
  if (stili.has('flessibile')) {
    righe.push({ sinistra: { simbolo: campioneTubazione('flessibile') }, descrizione: 'Tubazione flessibile' })
  }
  if (stili.has('condensa')) {
    righe.push({ sinistra: { simbolo: campioneTubazione('condensa') }, descrizione: 'Linea condense' })
  }

  return righe
}
```

e adegua `righeLista` a produrre `RigaTabella`:

```ts
export function righeLista(layout: SchemaLayout): RigaTabella[] {
  const righe: RigaTabella[] = []
  for (const nodo of layout.nodi) {
    if (nodo.tipo === 'utenze') continue
    righe.push({ sinistra: { codice: nodo.id }, descrizione: nodo.etichetta })
    if (nodo.accessorio) {
      righe.push({ sinistra: { codice: nodo.accessorio.codice }, descrizione: nodo.accessorio.etichetta })
      for (const v of nodo.accessorio.valvoleSicurezza) {
        righe.push({ sinistra: { codice: v.codice }, descrizione: v.etichetta })
      }
    }
    for (const v of nodo.valvoleSicurezza) {
      righe.push({ sinistra: { codice: v.codice }, descrizione: v.etichetta })
    }
  }
  return righe
}
```

Aggiungi `SchemaNodoTipo` all'import dei tipi in testa al file.

- [ ] **Step 5: Disegnare le due forme di cella**

Sostituisci il corpo del `forEach` di `renderTabella` (e la firma) con:

```ts
function renderTabella(righe: RigaTabella[], larghezza: number, yTop: number): string {
```

```ts
  righe.forEach((riga, i) => {
    const y = yTop + RIGA_TABELLA * (i + 1)
    // La cella di sinistra ospita il codice o il simbolo: il simbolo è disegnato in coordinate
    // locali centrate sull'origine (vedi `campioneTubazione`), quindi basta traslarlo al centro
    // della cella.
    const sinistra =
      'codice' in riga.sinistra
        ? `<text x="${x + COLONNA_CODICE / 2}" y="${y + RIGA_TABELLA / 2}" font-family="${FONT}" font-size="16" text-anchor="middle" dominant-baseline="central" fill="#000">${escapeXml(riga.sinistra.codice)}</text>`
        : `<g transform="translate(${x + COLONNA_CODICE / 2} ${y + RIGA_TABELLA / 2})">${riga.sinistra.simbolo}</g>`

    parti.push(
      `<rect x="${x}" y="${y}" width="${w}" height="${RIGA_TABELLA}" fill="none" stroke="#000" stroke-width="1" />`,
      `<line x1="${x + COLONNA_CODICE}" y1="${y}" x2="${x + COLONNA_CODICE}" y2="${y + RIGA_TABELLA}" stroke="#000" stroke-width="1" />`,
      sinistra,
      `<text x="${x + COLONNA_CODICE + 12}" y="${y + RIGA_TABELLA / 2}" font-family="${FONT}" font-size="16" dominant-baseline="central" fill="#000">${escapeXml(riga.descrizione)}</text>`
    )
  })
```

- [ ] **Step 6: Sommare le righe della legenda all'altezza**

In `renderSvg`:

```ts
  const righe = [...righeLista(layout), ...righeLegenda(layout)]
```

Nient'altro cambia: `altezzaTotale` e `renderTabella` leggono già `righe`.

- [ ] **Step 7: Correggere il commento che mi ha tratto in inganno**

In `src/services/schemaImpianto/types.ts`, nel commento in testa, sostituisci

> - La valvola di scarico è una decorazione fissa del simbolo (sempre presente su
>   serbatoio/essiccatore/filtro/separatore/disoleatore), non un dato: non ha un codice
>   proprio e non entra nel modello.

con

> - La valvola di scarico è una decorazione fissa del simbolo, non un dato: non ha un codice
>   proprio e non entra nel modello. La disegnano **serbatoio, essiccatore e filtro**; il
>   separatore no (`simboloSeparatore` passa `conScarico: false` — scarica da un codolo nudo,
>   così nel blocco di riferimento) e il compressore nemmeno. `righeLegenda` si regola su
>   questo elenco: sbagliarlo mette in legenda un simbolo che nel disegno non c'è.

- [ ] **Step 8: Vedere i test passare**

Run: `npx vitest run src/services/schemaImpianto/__tests__/renderSvg.test.ts`
Expected: **PASS**.

Run: `npx tsc --noEmit`
Expected: nessun errore. Se qualche consumatore fuori da `renderSvg.ts` leggeva `righe.codice`, il compilatore lo segnala: **correggilo e aggiungi il file all'elenco Files di questo task nello stesso commit.**

Run: `npx vitest run` → verde.

- [ ] **Step 9: Commit**

```bash
git add src/services/schemaImpianto/renderSvg.ts src/services/schemaImpianto/symbols/index.ts src/services/schemaImpianto/types.ts src/services/schemaImpianto/__tests__/renderSvg.test.ts
git commit -m "feat(schema-impianto): legenda dei simboli in coda alla lista apparecchiature"
```

---

### Task 11: La scritta del terminale si cambia con un doppio clic

**Files:**
- Modify: `src/components/schemaImpianto/SchemaEditor.tsx`

**Interfaces:**
- Consumes: `SchemaNodeData` (Task 2), tipo `'utenze'` (Task 3).
- Produces: niente per altri task. È l'ultimo.

- [ ] **Step 1: Aggiungere lo stato e il gestore del doppio clic**

In `src/components/schemaImpianto/SchemaEditor.tsx`, aggiungi agli import di MUI `Dialog`, `DialogActions`, `DialogContent`, `DialogTitle`, `TextField`, e a quelli di react-flow il tipo `Node` (già presente).

Dentro `SchemaEditorInterno`, accanto agli altri `useState`:

```ts
  // Rinomina del terminale utenze. Solo di quello: le etichette delle apparecchiature vengono
  // dalla scheda dati e la riconciliazione le riscrive alla riapertura (è la regola che tiene
  // la §2.3 aggiornata quando si corregge marca o modello), quindi permettere di cambiarle qui
  // sarebbe una modifica che si perde in silenzio.
  const [rinomina, setRinomina] = useState<{ id: string; valore: string } | null>(null)

  const onNodeDoubleClick = useCallback((_: React.MouseEvent, nodo: Node) => {
    const dati = (nodo.data as SchemaNodeData).nodo
    if (dati.tipo !== 'utenze') return
    setRinomina({ id: nodo.id, valore: dati.etichetta })
  }, [])

  const confermaRinomina = useCallback(() => {
    if (!rinomina) return
    const { id, valore } = rinomina
    const etichetta = valore.trim()
    setRinomina(null)
    if (!etichetta) return
    // Passa da `applica`, non da `aggiornaSenzaCronologia`: è un gesto come lo spostamento, e
    // un solo Ctrl+Z deve annullarlo.
    applica((s) => ({
      ...s,
      nodes: s.nodes.map((n) =>
        n.id === id
          ? { ...n, data: { nodo: { ...(n.data as SchemaNodeData).nodo, etichetta } } satisfies SchemaNodeData }
          : n
      ),
    }))
  }, [applica, rinomina])
```

- [ ] **Step 2: Collegare il gestore alla tela**

Fra le prop di `<ReactFlow>`, accanto a `onEdgeDoubleClick`:

```tsx
          onNodeDoubleClick={onNodeDoubleClick}
```

- [ ] **Step 3: Il campo di testo**

Subito prima della `</Stack>` che chiude il componente (dopo lo `Stack` dei pulsanti Annulla/Conferma):

```tsx
      <Dialog open={rinomina !== null} onClose={() => setRinomina(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Scritta del terminale</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            label="Testo"
            helperText="Per esempio «Utenze aria», «Utenze azoto»."
            value={rinomina?.valore ?? ''}
            onChange={(e) => setRinomina((r) => (r ? { ...r, valore: e.target.value } : r))}
            onKeyDown={(e) => {
              // Il dialog vive dentro l'editor, che ascolta le frecce e Ctrl+Z sull'intera
              // finestra: senza fermarli qui, scrivere nel campo sposterebbe il nodo selezionato.
              e.stopPropagation()
              if (e.key === 'Enter') confermaRinomina()
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRinomina(null)}>Lascia com'è</Button>
          <Button variant="contained" onClick={confermaRinomina}>
            Cambia scritta
          </Button>
        </DialogActions>
      </Dialog>
```

Il pulsante di rinuncia si chiama «Lascia com'è» e non «Annulla»: nel dialog ci sono già un «Annulla» dell'editor e un «Annulla» del dialog esterno, e un terzo li renderebbe indistinguibili.

- [ ] **Step 4: Verificare**

Run: `npx tsc --noEmit` → nessun errore.
Run: `npx vitest run` → verde.

- [ ] **Step 5: Commit**

```bash
git add src/components/schemaImpianto/SchemaEditor.tsx
git commit -m "feat(schema-impianto): la scritta del terminale utenze si cambia con un doppio clic"
```

---

## Verifica finale del blocco

Da eseguire **dopo** il Task 11, prima di dichiarare chiuso il blocco. Le prove in pagina le fa il controller.

- [ ] `npx tsc --noEmit` pulito.
- [ ] `npx vitest run` verde; annotare il totale e confrontarlo con la baseline di 730 su 58 file.
- [ ] `git status` pulito.
- [ ] Dev server sulla 5176; pratica `c6f56ca5-d57b-408c-a4e5-69a207812b0d` (LOWA R&D SRL) → `/requests/<id>/technical-details` → «Genera relazione» → «Rifinisci schema».
- [ ] Nell'anteprima: **un solo** terminale «Utenze aria», con la sua tubazione; nessuna seconda freccia.
- [ ] Il terminale si seleziona, si sposta col mouse e con le frecce, e un Ctrl+Z riporta indietro un gesto per volta.
- [ ] Si traccia a mano una tubazione dall'uscita di un'apparecchiatura all'ancora del terminale. Ricorda: `addEdge` scarta i duplicati, quindi parti da un'ancora **non** già collegata al terminale.
- [ ] Doppio clic sul terminale, la scritta diventa «Utenze azoto», l'anteprima la recepisce, un Ctrl+Z la riporta a «Utenze aria».
- [ ] La legenda compare in coda alla tabella, con i soli simboli presenti, e il campione del flessibile è ondulato come il tubo disegnato sopra.
- [ ] Il flessibile è ondulato per tutta la lunghezza sia in anteprima sia sulla tela.
- [ ] «Genera comunque .docx», poi estrarre il PNG della §2.3 e ispezionarlo: terminale, legenda e ondulazione come in anteprima.
- [ ] Riaprire il dialog **senza ricaricare** e verificare che scritta e posizione del terminale siano quelle salvate; poi ricaricare e riverificare.
- [ ] Aprire una pratica il cui `schemaLayout` salvato **non** ha il terminale (o simularlo togliendo il nodo dal JSON in banca dati su una copia) e verificare che compaia a destra della linea, non in fondo alla tela.

---

## Auto-revisione del piano

**Copertura della spec.** Ogni sezione ha il suo task: debito → Task 1-2; elemento «Alle utenze» → Task 3 (simbolo), 4 (modello), 5 (layout), 6 (via la freccia automatica, fuori dalla lista), 7 (layout salvati); scritta modificabile → Task 11; legenda → Task 10; flessibile ondulato → Task 8 (render statico) e 9 (editor); commento di `types.ts` → Task 10 Step 7. La spec cita anche `deserializzaLayout` che accetta il tipo nuovo: è coperto senza codice nuovo, perché `contenutoRiconoscibile` verifica `n.tipo in DIMENSIONI_NODO` e il Task 3 aggiunge la voce — il Task 7 lo esercita per la via dei layout salvati.

**Nessun segnaposto.** Ogni step porta il codice vero, non la sua descrizione. I due punti in cui il piano ammette di poter essere incompleto (Task 2 Step 6 e Task 10 Step 8) prescrivono cosa fare: correggere e aggiornare l'elenco Files nello stesso commit.

**Coerenza dei nomi.** `ID_UTENZE` è dichiarato nel Task 4 e consumato nel 7. `ondula`/`PASSO_ONDA`/`Punto` sono dichiarati nel Task 8 e consumati nei Task 9 e 10. `RigaTabella`/`CellaSinistra`/`righeLegenda`/`campioneTubazione` nascono nel Task 10 e non servono ad altri. L'ancora del terminale si chiama `in` ovunque; il suo id di nodo è `UTENZE` ovunque; l'ingombro `190×120` è lo stesso nel Task 3, nel test del Task 5 e nella formula del Task 7.
