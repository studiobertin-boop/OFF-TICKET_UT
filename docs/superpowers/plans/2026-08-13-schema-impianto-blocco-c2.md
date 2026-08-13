# Schema d'impianto — Blocco C2: piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** trasformare il TEE in un punto di giunzione neutro con quattro attacchi, permettere che la scritta del terminale utenze vada a capo, e aggiungere alla tela campi di testo liberi che si creano, si scrivono su più righe, si trascinano e si cancellano.

**Architecture:** tre pezzi indipendenti che condividono una sola funzione nuova di disegno del testo (`testoMultiRiga`, in `symbols/index.ts`). Il TEE cambia solo simbolo e ancore nel registro. Il terminale utenze diventa un nodo il cui ingombro dipende dal contenuto su entrambe le dimensioni, il che obbliga la sua ancora a seguire l'altezza invece di restare a quota fissa. I testi liberi sono un quarto tipo di dato del layout (`SchemaTestoLibero`), che vive accanto a nodi e archi senza essere né l'uno né l'altro: nessuna ancora, nessuna tubazione, nessuna riga in lista apparecchiature o in legenda.

**Tech Stack:** TypeScript (strict=false), React 18, @xyflow/react, MUI 6, Vitest.

**Spec:** le decisioni di prodotto sono quelle prese col committente il 13-08-2026 e registrate in `docs/superpowers/specs/2026-08-13-schema-impianto-blocco-c1-instradamento-design.md`, sezione «Perimetro → Fuori». La sezione «Decisioni di progetto» qui sotto colma il livello implementativo che quelle decisioni non fissano.

## Global Constraints

- Si lavora **solo** nel worktree `.claude/worktrees/schema-impianto-dm329`, ramo `worktree-schema-impianto-dm329`, base `8ed3a6b` (Blocco C1 chiuso). **Nessun merge e nessun push su `main`** finché il committente non lo dice.
- Dev server: `npm run dev -- --port 5176 --strictPort`, dentro il worktree. Verifica se è già attivo (`netstat -ano | grep :5176`) prima di rilanciarlo.
- Verifica di fine task, sempre: `npx tsc --noEmit` pulito e i test mirati verdi, ognuno con la sua redirezione su file. Baseline prima del Task 1: **898 test su 75 file**, `tsc` pulito.
- **Ogni test nuovo va visto fallire PRIMA di scrivere l'implementazione**, e la prova va prodotta con redirezione su file (`> esito.txt 2>&1`), mai trascritta. Un rosso da «funzione non definita» **non basta** dove il test deve provare un comportamento: in quel caso si implementa prima la versione sbagliata (o si muta quella esistente) e si allega quel rosso. Nel Blocco C1 quattro test che non discriminavano sono stati scoperti così, e il difetto più grave è stato trovato solo misurando in pagina.
- La suite intera impiega circa 2 minuti e due esecuzioni concorrenti di Vitest fanno morire il worker. La lancia **solo il controller**, una alla volta, in background con redirezione su file. Gli implementatori usano i test mirati: `npx vitest run src/services/schemaImpianto` e `npx vitest run src/components/schemaImpianto`.
- Commit convenzionali, in italiano, uno per task salvo dove il piano ne chiede due.
- Le verifiche in pagina le fa il controller. Se un implementatore riceve l'autorizzazione al browser, **è vietato premere «Genera comunque .docx»**: scrive su una pratica di produzione.
- **Non rifinire i simboli esistenti** (compressore, serbatoio, essiccatore, filtro, separatore, tanica, pacco bombole, valvole, riduttori). Il committente fornirà i suoi blocchi CAD e li attrezzeremo con un'interfaccia dedicata: ritoccarli oggi è lavoro buttato. Il TEE fa eccezione **solo** perché il committente ne ha chiesto esplicitamente il cambio di forma.
- I commenti devono descrivere lo stato **reale del repo a fine task**, non quello che il blocco avrà alla fine: nel C1 sette rilievi su otto task hanno riguardato commenti che affermavano il falso.
- Se l'implementazione scopre che il piano sbaglia o è incompleto, **il piano si corregge nello stesso commit del codice**, come parte del task e non come nota a margine. Nel C1 è successo cinque volte, ogni volta a ragione.

### Trappole già pagate su questo modulo

- `addEdge` di react-flow **scarta i duplicati**: una connessione che sembra rifiutata può essere solo già esistente.
- `onlyRenderVisibleElements` toglie dal DOM i nodi fuori vista; `minZoom` è a 0.1 apposta (Critical del Blocco B), non alzarlo.
- Ogni ancora ha **due handle sovrapposti**: selezionarli con `.react-flow__handle.source[...]` e `.target[...]`, mai con `.first()`/`.last()`.
- Il layer HTML portale (`EdgeLabelRenderer`, `ViewportPortal`) è dipinto **sopra** il layer SVG dei tubi e vince sempre il clic, per ordine nel DOM.
- react-flow passa all'arco il **bordo esterno** dell'handle, non il centro dell'ancora: per questo dal Blocco C1 i capi degli archi si calcolano con `posizioneAncora` e viaggiano nei dati dell'arco (`capiDegliArchi`). Non tornare a `sourceX/sourceY`.
- Un gesto del mouse che «non fa nulla» può essere finito sul pane di react-flow, che panna la tela senza cambiare il disegno: controllare `document.elementFromPoint` prima di concludere.
- **Nessuno schema reale è ancora salvato**: il committente ha dichiarato il 13-08-2026 di non usare ancora l'editor per i propri disegni. Non c'è quindi dato da preservare, e nessuna scelta di questo blocco va motivata con la retrocompatibilità — se una motivazione del genere compare in un commento, è falsa. Resta invece vero che gli identificativi delle ancore finiscono negli archi salvati, e che cambiarli senza motivo prepara un'incompatibilità per il giorno in cui i disegni veri esisteranno.

## Decisioni di progetto

### 1. TEE: pallino neutro con quattro attacchi

Il committente ha scelto fra tre strade (pallino neutro / nodo ruotabile a mano / segno orientato lungo il tubo) e ha preso la prima: **il simbolo perde i tre monconi e diventa un punto pieno, con quattro ancore sempre disponibili** — sinistra, destra, alto, basso. Non c'è rotazione da modellare perché tutte le direzioni esistono contemporaneamente, e la forma a T la disegnano le tubazioni che ci arrivano.

Gli identificativi delle tre ancore esistenti (`sx`, `dx`, `basso`) **non cambiano** e si aggiunge `alto`. Non è per retrocompatibilità — il committente ha dichiarato il 13-08-2026 che non usa ancora l'editor per i suoi schemi, quindi non c'è alcun layout salvato da preservare — ma perché quegli identificativi finiscono negli archi salvati e cambiarli senza motivo introdurrebbe un'incompatibilità gratuita il giorno in cui i disegni veri cominceranno a esistere.

L'ingombro scende da 50×50 a **16×16** con il pallino di raggio 5 al centro: con l'ingombro grande, le ancore stanno sul bordo del riquadro e fra la fine del tubo e il pallino resterebbero 25 unità di vuoto per lato — quattro buchi visibili. A 16×16 il vuoto massimo è 3 unità, invisibile a spessore di tratto 2. È un cambiamento **visibile sui TEE già disegnati**: il simbolo si rimpicciolisce e i tubi collegati si riattaccano più vicino al centro. È voluto, e va mostrato al committente in verifica.

### 2. Testo su più righe

Una funzione sola, `testoMultiRiga`, che spezza il contenuto sugli `\n` ed emette un `<tspan>` per riga con interlinea fissa. La usano il terminale utenze e i testi liberi; `testo()` resta per tutto il resto (codici, etichette, tabella), che è a riga singola per natura.

L'interlinea è **1,25 volte la dimensione del carattere**: sotto, le righe si toccano nei glifi discendenti; sopra, il blocco si sfilaccia.

**Il terminale utenze cresce in due dimensioni, non più in una.** Oggi `dimensioniDi` allarga il riquadro sulla lunghezza dell'etichetta; da questo blocco l'altezza deve crescere col numero di righe. E qui c'è la trappola: l'ancora `in` del terminale è dichiarata nel registro a **y=120 fisso**, cioè in fondo al riquadro alto 120. Se il riquadro cresce e l'ancora resta ferma, la tubazione si attacca a metà del codolo invece che alla sua base. Serve quindi che le ancore di un nodo possano dipendere **dal nodo**, non solo dal suo tipo: è il Task 4, e va fatto prima di allargare il riquadro.

### 3. Testi liberi: un quarto tipo di dato, non un nodo

`SchemaTestoLibero { id, x, y, contenuto }` vive in `SchemaLayout.testi`, accanto a `nodi` e `archi`. **Non** è un `SchemaNodo**: non ha ancore, non entra in `righeLista` né in legenda, non conta per il muro, nessuna tubazione può attaccarcisi. È lo stesso principio già applicato ai segni sulla tubazione nel Blocco B — un'annotazione non è un'apparecchiatura.

Nell'editor **non** diventa un nodo di react-flow, benché sarebbe comodo (trascinamento e cancellazione gratis): diciannove punti del codice dell'editor leggono `(n.data as SchemaNodeData).nodo` da ogni nodo dello stato, e infilare lì elementi di forma diversa significherebbe rendere robusti tutti quei punti, con un rischio di regressione silenziosa che questo modulo ha già pagato caro. I testi vivono in una lista separata dello stato dell'editor e si disegnano nel `ViewportPortal` (dove già stanno le guide di allineamento), col trascinamento scritto a mano sul pattern di `SchemaGomito` — cattura del puntatore, guardia «si è mosso davvero», un solo passo di cronologia per gesto.

Nella riconciliazione con la scheda dati i testi **sopravvivono sempre**: sono per definizione un'aggiunta manuale, come i nodi di origine `'manuale'`.

## File Structure

| File | Responsabilità dopo il blocco |
|---|---|
| `src/services/schemaImpianto/symbols/index.ts` | Simboli e ingombri. Nuova `testoMultiRiga`; `simboloGiunzione` diventa il pallino; `simboloUtenze` scrive su più righe; `dimensioniDi` calcola larghezza **e** altezza del terminale; nuova `ancoreDi(nodo)` per le ancore che dipendono dal nodo. |
| `src/services/schemaImpianto/types.ts` | Nuovo `SchemaTestoLibero`; `SchemaLayout.testi`. |
| `src/services/schemaImpianto/renderSvg.ts` | Disegna i testi liberi nel documento; `posizioneAncora` passa da `ancoreDi`. |
| `src/services/schemaImpianto/layout.ts` | `dimensioniLayout` tiene conto anche dei testi liberi nel riquadro del disegno. |
| `src/services/schemaImpianto/persistenza.ts` | I testi liberi si salvano, si rileggono e sopravvivono alla riconciliazione. |
| `src/components/schemaImpianto/conversioneFlow.ts` | I testi liberi passano fra layout e stato dell'editor. |
| `src/components/schemaImpianto/useTestiLiberi.ts` | **nuovo**: aggiungere, spostare, modificare e togliere un testo, con la cronologia — stesso pattern di `useSegniTubo.ts`. |
| `src/components/schemaImpianto/TestiLiberi.tsx` | **nuovo**: il disegno dei testi sulla tela e il loro trascinamento, dentro `ViewportPortal`. |
| `src/components/schemaImpianto/SchemaEditor.tsx` | Pulsante in palette, cablaggio dell'hook, dialog di scrittura condiviso fra terminale e testi liberi. |
| `src/components/schemaImpianto/SchemaNodeSymbol.tsx` | Gli handle si posizionano sulle ancore di `ancoreDi`, non su quelle del registro. |

---

### Task 1: il TEE diventa un punto di giunzione con quattro attacchi

**Files:**
- Modify: `src/services/schemaImpianto/symbols/index.ts` (`DIMENSIONI.giunzione`, `simboloGiunzione`, voce `giunzione` del registro)
- Test: `src/services/schemaImpianto/__tests__/simboli.test.ts`

**Interfaces:**
- Consumes: `traccia`, `DIMENSIONI`, `REGISTRO_SIMBOLI` già in `symbols/index.ts`.
- Produces: nessuna firma nuova. Il registro espone per `giunzione` quattro ancore: `sx` (0,8), `dx` (16,8), `alto` (8,0), `basso` (8,16), tutte `accetta: ['aria']`.

- [ ] **Step 1: Scrivi i test che falliscono**

In `src/services/schemaImpianto/__tests__/simboli.test.ts`, sostituisci i test esistenti della giunzione (cercali con `giunzione`) con:

```ts
describe('giunzione', () => {
  const nodo = { id: 'M-G1', tipo: 'giunzione' as const, etichetta: 'Giunzione', gruppo: 'LINEA_DISTRIBUZIONE' as const, valvoleSicurezza: [], origine: 'manuale' as const }

  it('è un punto pieno senza monconi: la forma a T la disegnano le tubazioni', () => {
    const svg = simboloGiunzione(nodo)
    expect(svg).toContain('<circle')
    // Nessun tratto disegnato: prima del Blocco C2 il simbolo aveva tre monconi che
    // restavano visibili anche senza tubazioni collegate.
    expect(svg).not.toContain('<path')
  })

  it('ha quattro attacchi, uno per lato, tutti sull’aria', () => {
    const ancore = REGISTRO_SIMBOLI.giunzione.ancore
    expect(ancore.map((a) => a.id).sort()).toEqual(['alto', 'basso', 'dx', 'sx'])
    expect(ancore.every((a) => a.accetta.length === 1 && a.accetta[0] === 'aria')).toBe(true)
  })

  it('gli attacchi stanno sui bordi del riquadro, il pallino al centro', () => {
    const { larghezza, altezza } = REGISTRO_SIMBOLI.giunzione.dimensioni
    const per = (id: string) => REGISTRO_SIMBOLI.giunzione.ancore.find((a) => a.id === id)!
    expect(per('sx')).toMatchObject({ x: 0, y: altezza / 2 })
    expect(per('dx')).toMatchObject({ x: larghezza, y: altezza / 2 })
    expect(per('alto')).toMatchObject({ x: larghezza / 2, y: 0 })
    expect(per('basso')).toMatchObject({ x: larghezza / 2, y: altezza })
  })

  it('il pallino copre quasi tutto il riquadro: fra tubo e giunzione non resta un buco visibile', () => {
    // Con l'ingombro grande del Blocco B (50x50) fra la fine del tubo e il pallino restavano
    // 25 unità di vuoto per lato. Il vuoto massimo tollerato è di poche unità, invisibile a
    // spessore di tratto 2.
    const { larghezza } = REGISTRO_SIMBOLI.giunzione.dimensioni
    const raggio = Number(/r="([\d.]+)"/.exec(simboloGiunzione(nodo))![1])
    expect(larghezza / 2 - raggio).toBeLessThanOrEqual(3)
  })
})
```

- [ ] **Step 2: Esegui i test e verifica che falliscano**

```bash
npx vitest run src/services/schemaImpianto/__tests__/simboli.test.ts > task-1-rosso.txt 2>&1
```

Atteso: rossi sul numero di ancore (tre invece di quattro), sulla presenza di `<path>` e sulle coordinate.

- [ ] **Step 3: Implementa**

In `src/services/schemaImpianto/symbols/index.ts`, in `DIMENSIONI`:

```ts
  giunzione: { larghezza: 16, altezza: 16 },
```

Sostituisci `simboloGiunzione`:

```ts
/**
 * Giunzione (TEE): un punto pieno, senza monconi. Fino al Blocco B disegnava tre tratti verso
 * sinistra, destra e basso, che restavano visibili anche quando nessuna tubazione ci arrivava
 * e fissavano il ramo di diramazione verso il basso; il committente ha chiesto un attacco
 * libero da qualunque lato, e la forma a T (o a croce, o a gomito) la disegnano ora le
 * tubazioni che ci arrivano davvero.
 *
 * Il pallino riempie quasi tutto il riquadro apposta: le ancore stanno sui bordi, e un
 * disco piccolo al centro di un riquadro grande lascerebbe un buco visibile fra la fine di
 * ogni tubo e la giunzione.
 */
export function simboloGiunzione(_nodo: SchemaNodo): string {
  const { larghezza, altezza } = DIMENSIONI.giunzione
  return `<circle cx="${larghezza / 2}" cy="${altezza / 2}" r="5" fill="#000" />`
}
```

e nel registro:

```ts
  giunzione: {
    dimensioni: DIMENSIONI.giunzione,
    // Quattro attacchi sempre disponibili, uno per lato: non c'è un «davanti», quindi non
    // c'è nulla da ruotare. Gli identificativi sx/dx/basso sono quelli del Blocco B, così i
    // TEE già salvati nelle pratiche restano collegati; `alto` è nuovo.
    ancore: [
      { id: 'sx', x: 0, y: 8, accetta: ['aria'] },
      { id: 'dx', x: 16, y: 8, accetta: ['aria'] },
      { id: 'alto', x: 8, y: 0, accetta: ['aria'] },
      { id: 'basso', x: 8, y: 16, accetta: ['aria'] },
    ],
    disegna: simboloGiunzione,
  },
```

- [ ] **Step 4: Esegui i test e verifica che passino**

```bash
npx vitest run src/services/schemaImpianto > task-1-verde.txt 2>&1
npx tsc --noEmit > task-1-tsc.txt 2>&1
```

Atteso: modulo verde, `tsc` pulito. Se qualche test di `layout`/`renderSvg` cade per l'ingombro cambiato, **leggi cosa asserisce prima di toccarlo**: se dipende dal 50×50 della giunzione è legittimo aggiornarlo, se invece riguarda altro hai rotto qualcosa.

- [ ] **Step 5: Commit**

```bash
git add src/services/schemaImpianto/symbols/index.ts src/services/schemaImpianto/__tests__/simboli.test.ts
git commit -m "feat(schema-impianto): il TEE diventa un punto di giunzione con quattro attacchi"
```

---

### Task 2: `testoMultiRiga`, la funzione di disegno condivisa

**Files:**
- Modify: `src/services/schemaImpianto/symbols/index.ts`
- Test: `src/services/schemaImpianto/__tests__/simboli.test.ts`

**Interfaces:**
- Consumes: `FONT`, `escapeXml` già in `symbols/index.ts`.
- Produces: `testoMultiRiga(x: number, y: number, contenuto: string, dimensione?: number, ancora?: 'middle' | 'start' | 'end'): string` (esportata) e `INTERLINEA_TESTO = 1.25` (esportata).

- [ ] **Step 1: Scrivi i test che falliscono**

```ts
describe('testoMultiRiga', () => {
  it('mette una riga per ogni capoverso, incolonnate sulla stessa ascissa', () => {
    const svg = testoMultiRiga(10, 20, 'Utenze aria\nreparto 2', 18, 'start')
    const tspan = [...svg.matchAll(/<tspan x="([\d.]+)" y="([\d.]+)">([^<]*)<\/tspan>/g)]
    expect(tspan).toHaveLength(2)
    expect(tspan.map((m) => m[3])).toEqual(['Utenze aria', 'reparto 2'])
    expect(tspan.map((m) => m[1])).toEqual(['10', '10'])
  })

  it('distanzia le righe di un’interlinea proporzionale al corpo', () => {
    const svg = testoMultiRiga(0, 100, 'a\nb\nc', 20)
    const y = [...svg.matchAll(/y="([\d.]+)"/g)].map((m) => Number(m[1]))
    expect(y).toEqual([100, 125, 150])
  })

  it('una riga sola resta una riga sola, senza spaziature inventate', () => {
    const svg = testoMultiRiga(5, 5, 'Utenze aria', 18, 'start')
    expect([...svg.matchAll(/<tspan/g)]).toHaveLength(1)
  })

  it('protegge i caratteri speciali come il testo a riga singola', () => {
    expect(testoMultiRiga(0, 0, 'a & b\n<c>')).toContain('a &amp; b')
    expect(testoMultiRiga(0, 0, 'a & b\n<c>')).toContain('&lt;c&gt;')
  })
})
```

- [ ] **Step 2: Esegui i test e verifica che falliscano**

```bash
npx vitest run src/services/schemaImpianto/__tests__/simboli.test.ts > task-2-rosso.txt 2>&1
```

Atteso: `testoMultiRiga is not a function`.

- [ ] **Step 3: Implementa**

Accanto a `testo()` in `src/services/schemaImpianto/symbols/index.ts`:

```ts
/**
 * Interlinea, in multipli del corpo del carattere. Sotto 1,2 le righe si toccano nei glifi
 * discendenti; molto sopra, il blocco di testo si sfilaccia e non si legge più come un'unità.
 */
export const INTERLINEA_TESTO = 1.25

/**
 * Testo che va a capo sugli `\n`. Un `<text>` SVG non manda a capo da sé — un `\n` dentro il
 * contenuto verrebbe reso come uno spazio — quindi ogni riga è un `<tspan>` con la propria
 * ascissa e ordinata, incolonnate sulla stessa `x`.
 *
 * `x`/`y` sono il primo capo della PRIMA riga (o il suo centro, secondo `ancora`): le righe
 * successive scendono. Chi calcola l'ingombro di un testo deve quindi tenere conto che il
 * blocco cresce verso il basso — vedi `dimensioniDi` per il terminale utenze.
 */
export function testoMultiRiga(
  x: number,
  y: number,
  contenuto: string,
  dimensione = 20,
  ancora: 'middle' | 'start' | 'end' = 'middle'
): string {
  const righe = contenuto.split('\n')
  const tspan = righe
    .map((riga, i) => `<tspan x="${x}" y="${y + i * dimensione * INTERLINEA_TESTO}">${escapeXml(riga)}</tspan>`)
    .join('')
  return `<text font-family="${FONT}" font-size="${dimensione}" text-anchor="${ancora}" dominant-baseline="central" fill="#000">${tspan}</text>`
}
```

- [ ] **Step 4: Esegui i test e verifica che passino**

```bash
npx vitest run src/services/schemaImpianto/__tests__/simboli.test.ts > task-2-verde.txt 2>&1
npx tsc --noEmit > task-2-tsc.txt 2>&1
```

- [ ] **Step 5: Commit**

```bash
git add src/services/schemaImpianto/symbols/index.ts src/services/schemaImpianto/__tests__/simboli.test.ts
git commit -m "feat(schema-impianto): testoMultiRiga, il testo che va a capo sugli a-capo"
```

---

### Task 3: le ancore possono dipendere dal nodo, non solo dal suo tipo

**Files:**
- Modify: `src/services/schemaImpianto/symbols/index.ts` (`ancoraDi`, nuova `ancoreDi`)
- Modify: `src/components/schemaImpianto/SchemaNodeSymbol.tsx` (gli handle si posano sulle ancore del nodo)
- Test: `src/services/schemaImpianto/__tests__/simboli.test.ts`

**Interfaces:**
- Consumes: `definizioneDi`, `dimensioniDi`, `REGISTRO_SIMBOLI`.
- Produces: `ancoreDi(nodo: SchemaNodo): SchemaAncora[]` (esportata). `ancoraDi(nodo: SchemaNodo, id: string)` cambia firma: riceve il nodo intero (prima bastavano `tipo` e `orientamento`) e delega a `ancoreDi`.

Questo task **non cambia ancora nulla di visibile**: prepara il terreno perché il Task 4 possa far crescere il riquadro del terminale senza staccarne la tubazione. Va fatto prima, e da solo, perché tocca una funzione che tutto il modulo usa.

- [ ] **Step 1: Scrivi il test che fallisce**

```ts
describe('ancoreDi', () => {
  const terminale = (etichetta: string) => ({
    id: 'UTENZE', tipo: 'utenze' as const, etichetta, gruppo: 'LINEA_DISTRIBUZIONE' as const,
    valvoleSicurezza: [], origine: 'scheda' as const,
  })

  it('per un nodo qualunque restituisce le ancore del registro, intatte', () => {
    const compressore = { id: 'C1', tipo: 'compressore' as const, etichetta: 'C', gruppo: 'SALA_COMPRESSORI' as const, valvoleSicurezza: [], origine: 'scheda' as const }
    expect(ancoreDi(compressore)).toEqual(REGISTRO_SIMBOLI.compressore.ancore)
  })

  it('l’attacco del terminale utenze sta in fondo al riquadro, anche quando il riquadro cresce', () => {
    // Il codolo del terminale parte dal fondo del riquadro: se l'ancora restasse alla quota
    // fissa del registro mentre il riquadro si allunga, la tubazione si attaccherebbe a metà
    // del codolo invece che alla sua base.
    const corta = terminale('Utenze aria')
    const lunga = terminale('Utenze aria\nreparto verniciatura\ne collaudo')
    expect(ancoreDi(corta).find((a) => a.id === 'in')!.y).toBe(dimensioniDi(corta).altezza)
    expect(ancoreDi(lunga).find((a) => a.id === 'in')!.y).toBe(dimensioniDi(lunga).altezza)
  })
})
```

- [ ] **Step 2: Esegui il test e verifica che fallisca**

```bash
npx vitest run src/services/schemaImpianto/__tests__/simboli.test.ts > task-3-rosso.txt 2>&1
```

Atteso: `ancoreDi is not a function`. (Il secondo test resterà comunque banale finché il Task 4 non fa crescere l'altezza: qui `dimensioniDi` dà ancora 120 per entrambe. È voluto — il test è scritto in modo da restare vero e da diventare **discriminante** appena l'altezza varia.)

- [ ] **Step 3: Implementa**

In `symbols/index.ts`, sostituendo l'attuale `ancoraDi`:

```ts
/**
 * Le ancore di un nodo. Coincidono con quelle del registro per tutti i tipi tranne il
 * terminale utenze, il cui riquadro cresce con la scritta (vedi `dimensioniDi`): il suo
 * attacco sta in fondo al riquadro, dove comincia il codolo, quindi segue l'altezza invece
 * di restare alla quota fissa dichiarata nel registro.
 *
 * Il registro resta la fonte per la forma e per gli identificativi — che entrano negli archi
 * salvati e non possono cambiare — e questa funzione è l'unico posto dove una coordinata
 * dipende dal contenuto del nodo.
 */
export function ancoreDi(nodo: SchemaNodo): SchemaAncora[] {
  const ancore = definizioneDi(nodo).ancore
  if (nodo.tipo !== 'utenze') return ancore
  const { altezza } = dimensioniDi(nodo)
  return ancore.map((a) => (a.id === 'in' ? { ...a, y: altezza } : a))
}

export function ancoraDi(nodo: SchemaNodo, id: string): SchemaAncora | undefined {
  return ancoreDi(nodo).find((a) => a.id === id)
}
```

I chiamanti sono quattro, e vanno trattati diversamente:

- `src/services/schemaImpianto/renderSvg.ts:44` (`posizioneAncora`): riceve già un `SchemaNodoPosizionato`, non cambia nulla.
- `src/services/schemaImpianto/agganci.ts:23` (`capoValido`): riceve solo `{ tipo, orientamento? }`, perché gli serve unicamente il campo `accetta` dell'ancora — che dipende dal tipo e non dal contenuto del nodo. **Non allargare la sua firma a `SchemaNodo`**: fallo leggere direttamente dal registro con `definizioneDi(nodo).ancore.find((a) => a.id === ancoraId)`. Chiedere un nodo intero a chi deve solo sapere se un attacco accetta l'aria significherebbe costringere ogni chiamante a costruirne uno finto.
- `src/services/schemaImpianto/__tests__/simboli.test.ts:44-45`: passano oggetti parziali `{ tipo, orientamento }` a `ancoraDi`; aggiornali a nodi completi (aggiungi `id`, `etichetta`, `gruppo`, `valvoleSicurezza: []`, `origine`).
- `src/components/schemaImpianto/__tests__/instradamentoCondiviso.test.ts:72`: passa già un nodo completo.

In `src/components/schemaImpianto/SchemaNodeSymbol.tsx`, la riga che itera `def.ancore` deve iterare `ancoreDi(nodo)`, o gli handle resterebbero alla quota vecchia mentre il riquadro cresce — e i capi degli archi, che dal Blocco C1 si calcolano con `posizioneAncora`, finirebbero in un punto diverso da dove l'utente vede l'attacco.

- [ ] **Step 4: Esegui i test e verifica che passino**

```bash
npx vitest run src/services/schemaImpianto > task-3-servizi.txt 2>&1
npx vitest run src/components/schemaImpianto > task-3-componenti.txt 2>&1
npx tsc --noEmit > task-3-tsc.txt 2>&1
```

`tsc` è qui il controllo che conta: la firma cambiata deve aver fatto emergere ogni chiamante non aggiornato.

- [ ] **Step 5: Commit**

```bash
git add src/services/schemaImpianto/symbols/index.ts src/components/schemaImpianto/SchemaNodeSymbol.tsx src/services/schemaImpianto/__tests__/simboli.test.ts
git commit -m "refactor(schema-impianto): le ancore di un nodo possono dipendere dal nodo"
```

---

### Task 4: la scritta del terminale utenze va a capo

**Files:**
- Modify: `src/services/schemaImpianto/symbols/index.ts` (`UTENZE`, `simboloUtenze`, `dimensioniDi`)
- Test: `src/services/schemaImpianto/__tests__/simboli.test.ts`

**Interfaces:**
- Consumes: `testoMultiRiga`, `INTERLINEA_TESTO` (Task 2); `ancoreDi` (Task 3).
- Produces: nessuna firma nuova. `dimensioniDi` restituisce d'ora in poi un'altezza variabile per il terminale utenze.

- [ ] **Step 1: Scrivi i test che falliscono**

```ts
describe('terminale utenze su più righe', () => {
  const terminale = (etichetta: string) => ({
    id: 'UTENZE', tipo: 'utenze' as const, etichetta, gruppo: 'LINEA_DISTRIBUZIONE' as const,
    valvoleSicurezza: [], origine: 'scheda' as const,
  })

  it('disegna una riga per capoverso', () => {
    const svg = simboloUtenze(terminale('Utenze aria\nreparto 2'))
    expect([...svg.matchAll(/<tspan/g)]).toHaveLength(2)
    expect(svg).toContain('>Utenze aria</tspan>')
    expect(svg).toContain('>reparto 2</tspan>')
  })

  it('la larghezza si misura sulla riga più lunga, non su tutto il contenuto', () => {
    // Con la misura sull'intera stringa, due righe corte darebbero un riquadro largo quanto
    // la loro somma: la tela del documento crescerebbe a vuoto di centinaia di unità.
    const dueRigheCorte = dimensioniDi(terminale('Utenze aria\nreparto 2'))
    const unaRigaLunga = dimensioniDi(terminale('Utenze aria reparto 2'))
    expect(dueRigheCorte.larghezza).toBeLessThan(unaRigaLunga.larghezza)
  })

  it('l’altezza cresce col numero di righe, e solo quando serve', () => {
    const una = dimensioniDi(terminale('Utenze aria'))
    const due = dimensioniDi(terminale('Utenze aria\nreparto 2'))
    const otto = dimensioniDi(terminale(Array.from({ length: 8 }, (_, i) => `riga ${i}`).join('\n')))
    expect(due.altezza).toBe(una.altezza)
    expect(otto.altezza).toBeGreaterThan(una.altezza)
    // Tutte le righe stanno dentro il riquadro: l'ultima non sporge sotto il bordo.
    const ultimaRiga = 20 + 7 * 18 * 1.25
    expect(otto.altezza).toBeGreaterThanOrEqual(ultimaRiga)
  })

  it('il codolo parte dal fondo del riquadro, che è dove si attacca la tubazione', () => {
    const lungo = terminale(Array.from({ length: 8 }, (_, i) => `riga ${i}`).join('\n'))
    const altezza = dimensioniDi(lungo).altezza
    // 12 è `UTENZE.x`, l'ascissa del codolo: la costante non è esportata, quindi il test la
    // fissa come letterale — se cambia, questo test deve accorgersene.
    expect(simboloUtenze(lungo)).toContain(`M 12 ${altezza}`)
    expect(ancoreDi(lungo).find((a) => a.id === 'in')!.y).toBe(altezza)
  })
})
```

- [ ] **Step 2: Esegui i test e verifica che falliscano**

```bash
npx vitest run src/services/schemaImpianto/__tests__/simboli.test.ts > task-4-rosso.txt 2>&1
```

Atteso: il primo test rosso (nessun `<tspan>`: oggi `simboloUtenze` usa `testo()`), il terzo rosso (l'altezza non cambia mai), il quarto rosso (il codolo parte da `DIMENSIONI.utenze.altezza`, non dall'altezza effettiva).

- [ ] **Step 3: Implementa**

In `UTENZE` aggiungi il margine sotto l'ultima riga:

```ts
  /** Aria fra l'ultima riga della scritta e il fondo del riquadro. */
  margineInferiore: 10,
```

In `simboloUtenze`, usa l'altezza effettiva e il testo multi-riga:

```ts
export function simboloUtenze(nodo: SchemaNodo): string {
  const { altezza } = dimensioniDi(nodo)
  const x = UTENZE.x
  const yPunta = 14
  return [
    `<path d="M ${x} ${altezza} L ${x} ${yPunta + 12}" fill="none" stroke="#000" stroke-width="${TRATTO}" stroke-dasharray="10 7" />`,
    `<path d="M ${x - 6} ${yPunta + 13} L ${x} ${yPunta} L ${x + 6} ${yPunta + 13} Z" fill="#000" />`,
    testoMultiRiga(x + UTENZE.rientroScritta, yPunta + 6, nodo.etichetta, UTENZE.dimensioneScritta, 'start'),
  ].join('')
}
```

e in `dimensioniDi`, per il solo terminale:

```ts
  const righe = nodo.etichetta.split('\n')
  const piuLunga = Math.max(...righe.map((r) => r.length))
  const scritta = piuLunga * UTENZE.dimensioneScritta * UTENZE.larghezzaCarattere
  const larghezzaNecessaria = UTENZE.x + UTENZE.rientroScritta + scritta + UTENZE.margineDestro
  // La prima riga è centrata a `yPunta + 6` = 20; ogni riga successiva scende di un'interlinea.
  const ultimaRiga = 20 + (righe.length - 1) * UTENZE.dimensioneScritta * INTERLINEA_TESTO
  const altezzaNecessaria = ultimaRiga + UTENZE.margineInferiore
  return {
    larghezza: Math.max(dimensioni.larghezza, Math.ceil(larghezzaNecessaria)),
    altezza: Math.max(dimensioni.altezza, Math.ceil(altezzaNecessaria)),
  }
```

- [ ] **Step 4: Esegui i test e verifica che passino**

```bash
npx vitest run src/services/schemaImpianto > task-4-servizi.txt 2>&1
npx vitest run src/components/schemaImpianto > task-4-componenti.txt 2>&1
npx tsc --noEmit > task-4-tsc.txt 2>&1
```

- [ ] **Step 5: Verifica che il test dell'ancora ora discrimini**

Il secondo test del Task 3 diventa significativo solo adesso. Provalo: fissa temporaneamente l'ancora `in` alla quota del registro (togli il ramo `utenze` da `ancoreDi`), riesegui, e allega il rosso:

```bash
npx vitest run src/services/schemaImpianto/__tests__/simboli.test.ts > task-4-rosso-ancora.txt 2>&1
```

Atteso: rosso sul test «l'attacco del terminale utenze sta in fondo al riquadro». **Ripristina** e verifica con `git diff` che non resti traccia.

- [ ] **Step 6: Commit**

```bash
git add src/services/schemaImpianto/symbols/index.ts src/services/schemaImpianto/__tests__/simboli.test.ts
git commit -m "feat(schema-impianto): la scritta del terminale utenze va a capo"
```

---

### Task 5: il dialog di scrittura accetta più righe

**Files:**
- Modify: `src/components/schemaImpianto/SchemaEditor.tsx` (il dialog «Scritta del terminale» e la gestione dei tasti)

**Interfaces:**
- Consumes: lo stato `rinomina` e `confermaRinomina` già presenti.
- Produces: nessuna. Da qui in poi il campo accetta gli a-capo e si conferma col pulsante o con Ctrl+Invio.

Nessun test automatico: è un componente React, e questo modulo non li monta nei test (CLAUDE.md, «no UI test»). La prova è la verifica in pagina del Task 11. **Non inventare un test che finga di coprirlo.**

- [ ] **Step 1: Rendi il campo multi-riga**

Nel `TextField` del dialog, aggiungi `multiline` e un numero di righe minimo, mantenendo `autoFocus` e il resto delle prop già presenti:

```tsx
            multiline
            minRows={2}
            maxRows={8}
```

- [ ] **Step 2: Cambia la regola dei tasti**

Oggi il dialog conferma con Invio premuto dentro il campo di testo. In un campo multi-riga Invio deve andare a capo, o una scritta su più righe è impossibile da comporre. Sostituisci la condizione dell'`onKeyDown` del `Dialog`:

```tsx
          // Invio va a capo: il campo è multi-riga dal Blocco C2, e confermare su Invio
          // renderebbe impossibile comporre la seconda riga. Resta la scorciatoia da
          // tastiera, con il modificatore — la stessa convenzione dei campi di commento —
          // mentre la strada principale è il pulsante.
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && scrittaValida) confermaRinomina()
```

rimuovendo la variabile `daCampoDiTesto` e il commento che la spiegava, se non resta usata altrove: descriveva perché Invio confermava solo dal campo di testo, e da questo task quella spiegazione è falsa.

- [ ] **Step 3: Aggiorna l'aiuto per l'utente**

Il pulsante di conferma resta la strada principale. Aggiungi sotto il campo una riga di aiuto discreta (`helperText` del `TextField`) che dica come si va a capo e come si conferma da tastiera, con le stesse parole che useresti a voce: «Invio va a capo · Ctrl+Invio conferma».

- [ ] **Step 4: Verifica**

```bash
npx vitest run src/components/schemaImpianto > task-5-verde.txt 2>&1
npx tsc --noEmit > task-5-tsc.txt 2>&1
npx eslint src/components/schemaImpianto > task-5-eslint.txt 2>&1
```

- [ ] **Step 5: Commit**

```bash
git add src/components/schemaImpianto/SchemaEditor.tsx
git commit -m "feat(schema-impianto): la scritta del terminale si compone su più righe"
```

---

### Task 6: il testo libero entra nel modello e nel salvataggio

**Files:**
- Modify: `src/services/schemaImpianto/types.ts`
- Modify: `src/services/schemaImpianto/persistenza.ts`
- Test: `src/services/schemaImpianto/__tests__/persistenza.test.ts`

**Interfaces:**
- Consumes: `SchemaLayout`, `LayoutSalvato`, `riconcilia` già esistenti.
- Produces: `SchemaTestoLibero { id: string; x: number; y: number; contenuto: string }`; `SchemaLayout.testi?: SchemaTestoLibero[]`; `LayoutSalvato.testi?: SchemaTestoLibero[]`.

- [ ] **Step 1: Scrivi i test che falliscono**

In `src/services/schemaImpianto/__tests__/persistenza.test.ts`:

```ts
describe('testi liberi', () => {
  const testo = { id: 'T1', x: 100, y: 200, contenuto: 'Linea azoto\nal reparto 2' }

  it('si salvano e si rileggono', () => {
    const layout = { nodi: [], archi: [], muro: null, testi: [testo] }
    const salvato = serializzaLayout(layout)
    expect(salvato.testi).toEqual([testo])
    expect(deserializzaLayout(salvato)!.testi).toEqual([testo])
  })

  it('il salvataggio è un’istantanea: modificare il layout dopo non tocca il salvato', () => {
    const layout = { nodi: [], archi: [], muro: null, testi: [{ ...testo }] }
    const salvato = serializzaLayout(layout)
    layout.testi![0].contenuto = 'cambiato'
    expect(salvato.testi![0].contenuto).toBe('Linea azoto\nal reparto 2')
  })

  it('un layout salvato prima di questo blocco si rilegge senza testi, non in errore', () => {
    const vecchio = { versione: 1, nodi: [], archi: [] }
    expect(deserializzaLayout(vecchio)!.testi).toEqual([])
  })

  it('sopravvivono alla riconciliazione con la scheda, come i nodi aggiunti a mano', () => {
    const modello = { nodi: [], archi: [] }
    const esito = riconcilia({ nodi: [], archi: [], testi: [testo] }, modello)
    expect(esito.layout.testi).toEqual([testo])
  })
})
```

- [ ] **Step 2: Esegui i test e verifica che falliscano**

```bash
npx vitest run src/services/schemaImpianto/__tests__/persistenza.test.ts > task-6-rosso.txt 2>&1
```

Atteso: rossi su `testi` undefined.

- [ ] **Step 3: Implementa**

In `types.ts`:

```ts
/**
 * Annotazione libera sulla tela: una scritta che l'utente piazza dove vuole, senza legarla a
 * un'apparecchiatura. Non è un nodo — non ha ancore, nessuna tubazione può attaccarcisi, non
 * entra nella lista apparecchiature né in legenda — ed è lo stesso principio già applicato ai
 * segni sulla tubazione: un'annotazione non è un'apparecchiatura.
 */
export interface SchemaTestoLibero {
  id: string
  /** Coordinate assolute del primo capo della prima riga, in unità del disegno. */
  x: number
  y: number
  /** Può contenere a-capo: lo disegna `testoMultiRiga`. */
  contenuto: string
}
```

e in `SchemaLayout`, dopo `archi`:

```ts
  /** Annotazioni libere. Assente sui layout salvati prima del Blocco C2. */
  testi?: SchemaTestoLibero[]
```

In `persistenza.ts`: aggiungi `testi?: SchemaTestoLibero[]` a `LayoutSalvato`; in `serializzaLayout` clona anche i testi (`structuredClone(layout.testi ?? [])`); in `deserializzaLayout` restituisci `testi: salvato.testi ?? []`; in `riconcilia` accetta `Pick<SchemaLayout, 'nodi' | 'archi' | 'testi'>` e riporta `testi: salvato.testi ?? []` nel layout risultante, con un commento che dice perché passano intatti (sono manuali per definizione: la scheda dati non li produce e non può contraddirli).

**Non alzare `VERSIONE`**: un campo nuovo e opzionale non rende illeggibile un salvataggio vecchio, quindi alzarla farebbe scartare layout perfettamente leggibili senza guadagnare nulla. (Il committente ha dichiarato il 13-08-2026 di non usare ancora l'editor per i suoi schemi: oggi non ci sono disegni veri da perdere, ma la regola vale comunque perché la versione serve a segnalare i formati **incompatibili**, e questo non lo è.)

- [ ] **Step 4: Esegui i test e verifica che passino**

```bash
npx vitest run src/services/schemaImpianto > task-6-verde.txt 2>&1
npx tsc --noEmit > task-6-tsc.txt 2>&1
```

- [ ] **Step 5: Commit**

```bash
git add src/services/schemaImpianto/types.ts src/services/schemaImpianto/persistenza.ts src/services/schemaImpianto/__tests__/persistenza.test.ts
git commit -m "feat(schema-impianto): il testo libero entra nel modello e nel salvataggio"
```

---

### Task 7: il documento disegna i testi liberi

**Files:**
- Modify: `src/services/schemaImpianto/renderSvg.ts`
- Modify: `src/services/schemaImpianto/layout.ts` (`dimensioniLayout`)
- Test: `src/services/schemaImpianto/__tests__/renderSvg.test.ts`, `.../layout.test.ts`

**Interfaces:**
- Consumes: `testoMultiRiga`, `INTERLINEA_TESTO` (Task 2); `SchemaTestoLibero` (Task 6).
- Produces: `TESTO_LIBERO = { dimensione: 18 }` esportata da `symbols/index.ts` (stessa dimensione della scritta del terminale, come deciso col committente).

- [ ] **Step 1: Scrivi i test che falliscono**

In `renderSvg.test.ts`. Il file ha già l'helper `svgMinimo(noteTubazioni?)` (riga 19), che però costruisce il layout al suo interno e restituisce direttamente l'SVG: qui serve il layout, quindi costruiscilo come fa lui, con le stesse fixture:

```ts
describe('testi liberi', () => {
  function layoutConTesti(testi: { id: string; x: number; y: number; contenuto: string }[]) {
    const scheda = makeScheda({
      compressori: [makeCompressore({ ha_disoleatore: false })],
      disoleatori: [],
      serbatoi: [makeSerbatoio({ orientamento: 'ORIZZONTALE' })],
      essiccatori: [],
      scambiatori: [],
      filtri: [],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
    })
    const layout = layoutSchema(buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } }))
    return { ...layout, testi }
  }

  it('li disegna nel documento, con gli a-capo', () => {
    const svg = renderSvg(layoutConTesti([{ id: 'T1', x: 300, y: 400, contenuto: 'Linea azoto\nal reparto 2' }]))
    expect(svg).toContain('>Linea azoto</tspan>')
    expect(svg).toContain('>al reparto 2</tspan>')
  })

  it('non entrano né in lista apparecchiature né in legenda', () => {
    const svg = renderSvg(layoutConTesti([{ id: 'T1', x: 300, y: 400, contenuto: 'Nota di prova' }]))
    const tabella = svg.slice(svg.indexOf('LISTA APPARECCHIATURE'))
    expect(tabella).not.toContain('Nota di prova')
  })

  it('un layout senza testi resta identico a prima', () => {
    // Il blocco non deve cambiare i documenti che non hanno annotazioni: senza questa
    // asserzione, un separatore o uno spazio in più passerebbe inosservato.
    expect(renderSvg(layoutConTesti([]))).toBe(renderSvg({ ...layoutConTesti([]), testi: undefined }))
  })
})
```

In `layout.test.ts`:

```ts
it('la tela si allarga per contenere un testo libero che sporge oltre le apparecchiature', () => {
  const layout = layoutSchema(buildSchemaModel({ scheda: makeScheda({}), collegamentiCompressoriSerbatoi: {} }))
  const senza = dimensioniLayout(layout)
  const con = dimensioniLayout({ ...layout, testi: [{ id: 'T1', x: senza.larghezza + 500, y: senza.altezza + 300, contenuto: 'Nota' }] })
  expect(con.larghezza).toBeGreaterThan(senza.larghezza)
  expect(con.altezza).toBeGreaterThan(senza.altezza)
})
```

- [ ] **Step 2: Esegui i test e verifica che falliscano**

```bash
npx vitest run src/services/schemaImpianto/__tests__/renderSvg.test.ts src/services/schemaImpianto/__tests__/layout.test.ts > task-7-rosso.txt 2>&1
```

- [ ] **Step 3: Implementa**

In `symbols/index.ts`, accanto a `UTENZE`:

```ts
/** Le annotazioni libere usano lo stesso carattere e lo stesso corpo della scritta del terminale. */
export const TESTO_LIBERO = { dimensione: UTENZE.dimensioneScritta }
```

In `renderSvg.ts`, una funzione accanto alle altre di disegno:

```ts
/**
 * Annotazioni libere: solo testo, nessuna cornice. Si disegnano dopo i nodi e le tubazioni,
 * così una scritta posata su un tubo resta leggibile.
 */
function renderTestiLiberi(testi: SchemaTestoLibero[]): string {
  return testi.map((t) => testoMultiRiga(t.x, t.y, t.contenuto, TESTO_LIBERO.dimensione, 'start')).join('')
}
```

e chiamala dentro `renderSvg` con `layout.testi ?? []`, dopo il disegno degli archi e dei nodi.

In `layout.ts`, `dimensioniLayout` deve considerare anche i testi: per ognuno, la larghezza si stima sulla riga più lunga (`riga.length * TESTO_LIBERO.dimensione * 0.5`, la stessa approssimazione già usata per il terminale) e l'altezza sul numero di righe (`(righe.length - 1) * TESTO_LIBERO.dimensione * INTERLINEA_TESTO`). Un testo trascinato fuori dal disegno non deve finire tagliato nel PNG.

- [ ] **Step 4: Esegui i test e verifica che passino**

```bash
npx vitest run src/services/schemaImpianto > task-7-verde.txt 2>&1
npx tsc --noEmit > task-7-tsc.txt 2>&1
```

- [ ] **Step 5: Commit**

```bash
git add src/services/schemaImpianto/renderSvg.ts src/services/schemaImpianto/layout.ts src/services/schemaImpianto/symbols/index.ts src/services/schemaImpianto/__tests__/renderSvg.test.ts src/services/schemaImpianto/__tests__/layout.test.ts
git commit -m "feat(schema-impianto): il documento disegna le annotazioni libere"
```

---

### Task 8: i testi liberi attraversano il ponte verso l'editor

**Files:**
- Modify: `src/components/schemaImpianto/conversioneFlow.ts`
- Test: `src/components/schemaImpianto/__tests__/conversioneFlow.test.ts`

**Interfaces:**
- Consumes: `SchemaTestoLibero` (Task 6).
- Produces: `layoutAFlow(layout)` restituisce anche `testi: SchemaTestoLibero[]`; `flowALayout(nodes, edges, testi?: SchemaTestoLibero[])` li riporta nel layout.

- [ ] **Step 1: Scrivi i test che falliscono**

```ts
describe('testi liberi fra layout e stato dell’editor', () => {
  const testo = { id: 'T1', x: 100, y: 200, contenuto: 'Nota\nsu due righe' }

  it('vanno e tornano identici', () => {
    const layout = { nodi: [], archi: [], muro: null, testi: [testo] }
    const flow = layoutAFlow(layout)
    expect(flow.testi).toEqual([testo])
    expect(flowALayout(flow.nodes, flow.edges, flow.testi).testi).toEqual([testo])
  })

  it('un layout senza testi produce una lista vuota, non undefined', () => {
    expect(layoutAFlow({ nodi: [], archi: [], muro: null }).testi).toEqual([])
  })

  it('chi non passa i testi non se li inventa', () => {
    expect(flowALayout([], []).testi).toEqual([])
  })
})
```

- [ ] **Step 2: Esegui i test e verifica che falliscano**

```bash
npx vitest run src/components/schemaImpianto/__tests__/conversioneFlow.test.ts > task-8-rosso.txt 2>&1
```

- [ ] **Step 3: Implementa**

`layoutAFlow` restituisce `{ nodes, edges, testi: layout.testi ?? [] }`; `flowALayout(nodes, edges, testi: SchemaTestoLibero[] = [])` mette `testi` nel layout risultante. I testi passano **per copia di riferimento, senza trasformazioni**: non sono nodi di react-flow e non hanno nulla da convertire — il ponte esiste solo perché lo stato dell'editor e il layout hanno forme diverse.

- [ ] **Step 4: Esegui i test e verifica che passino**

```bash
npx vitest run src/components/schemaImpianto > task-8-verde.txt 2>&1
npx tsc --noEmit > task-8-tsc.txt 2>&1
```

`tsc` segnalerà i chiamanti di `layoutAFlow`/`flowALayout` da aggiornare: in `SchemaEditor.tsx` il layout corrente deve ora portarsi dietro i testi dello stato.

- [ ] **Step 5: Commit**

```bash
git add src/components/schemaImpianto/conversioneFlow.ts src/components/schemaImpianto/__tests__/conversioneFlow.test.ts
git commit -m "feat(schema-impianto): i testi liberi passano fra layout e stato dell'editor"
```

---

### Task 9: creare, spostare, modificare e togliere un testo

**Files:**
- Create: `src/components/schemaImpianto/useTestiLiberi.ts`
- Test: `src/components/schemaImpianto/__tests__/useTestiLiberi.test.ts`

**Interfaces:**
- Consumes: lo stato dell'editor, che da questo task porta `testi: SchemaTestoLibero[]`; `applica` e `aggiornaSenzaCronologia` di `useSchemaHistory`.
- Produces, come **funzioni pure esportate** (è il pattern di `useSegniTubo.ts`, che esporta `segnoAggiunto` e `segniSenzaIndice` e le fa provare direttamente dai test, senza montare React):
  - `testoAggiunto(testi: SchemaTestoLibero[], posizione: { x: number; y: number }, contenuto?: string): SchemaTestoLibero[]`
  - `testiConSpostamento(testi: SchemaTestoLibero[], id: string, posizione: { x: number; y: number }): SchemaTestoLibero[]`
  - `testiConContenuto(testi: SchemaTestoLibero[], id: string, contenuto: string): SchemaTestoLibero[]`
  - `testiSenza(testi: SchemaTestoLibero[], id: string): SchemaTestoLibero[]`
  - l'hook `useTestiLiberi(stato, applica, aggiornaSenzaCronologia)` che restituisce `{ aggiungiTesto(posizione): string, spostaTesto(id, posizione, concluso): void, modificaTesto(id, contenuto): void, rimuoviTesto(id): void }`. `aggiungiTesto` restituisce l'id creato, così il chiamante può aprire subito il dialog su quel testo.

Le funzioni vivono in un file loro e non dentro `SchemaEditor.tsx` per lo stesso motivo di `useGomiti`/`useSegniTubo`/`useTrascinamentoTratto`: quel file è già a 788 righe e cresce a ogni blocco.

- [ ] **Step 1: Scrivi i test che falliscono**

Crea `src/components/schemaImpianto/__tests__/useTestiLiberi.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { testoAggiunto, testiConContenuto, testiConSpostamento, testiSenza } from '../useTestiLiberi'

const due = [
  { id: 'T1', x: 10, y: 20, contenuto: 'primo' },
  { id: 'T2', x: 30, y: 40, contenuto: 'secondo\nsu due righe' },
]

describe('testoAggiunto', () => {
  it('mette il testo nella posizione data, in coda', () => {
    const risultato = testoAggiunto(due, { x: 100, y: 200 })
    expect(risultato).toHaveLength(3)
    expect(risultato[2]).toMatchObject({ x: 100, y: 200, contenuto: '' })
  })

  it('non riusa un id già presente, nemmeno dopo una cancellazione in mezzo', () => {
    // Un contatore ingenuo sulla lunghezza darebbe 'T3' anche qui, cioè un id già in uso.
    const conBuco = [{ id: 'T1', x: 0, y: 0, contenuto: 'a' }, { id: 'T3', x: 0, y: 0, contenuto: 'c' }]
    const risultato = testoAggiunto(conBuco, { x: 1, y: 1 })
    expect(conBuco.map((t) => t.id)).not.toContain(risultato[2].id)
  })

  it('parte anche da una tela senza testi', () => {
    expect(testoAggiunto([], { x: 5, y: 5 })).toHaveLength(1)
  })
})

describe('testiConSpostamento', () => {
  it('cambia le coordinate del testo indicato e lascia intatti contenuto e vicini', () => {
    const risultato = testiConSpostamento(due, 'T2', { x: 300, y: 400 })
    expect(risultato[1]).toEqual({ id: 'T2', x: 300, y: 400, contenuto: 'secondo\nsu due righe' })
    expect(risultato[0]).toEqual(due[0])
  })

  it('un id sconosciuto non cambia nulla', () => {
    expect(testiConSpostamento(due, 'T9', { x: 0, y: 0 })).toEqual(due)
  })
})

describe('testiConContenuto', () => {
  it('cambia il contenuto senza spostare il testo', () => {
    const risultato = testiConContenuto(due, 'T1', 'nuovo\ntesto')
    expect(risultato[0]).toEqual({ id: 'T1', x: 10, y: 20, contenuto: 'nuovo\ntesto' })
  })
})

describe('testiSenza', () => {
  it('toglie solo il testo indicato', () => {
    expect(testiSenza(due, 'T1')).toEqual([due[1]])
  })
})
```

Ogni asserzione confronta valori veri: un test che verifica solo «non lancia» non discrimina.

- [ ] **Step 2: Esegui i test e verifica che falliscano**

```bash
npx vitest run src/components/schemaImpianto/__tests__/useTestiLiberi.test.ts > task-9-rosso.txt 2>&1
```

- [ ] **Step 3: Implementa**

Le quattro funzioni pure, poi l'hook. Per gli id, un contatore che **salta quelli già usati** invece di contare gli elementi, come fa `codiceLibero` per i nodi:

```ts
function idLibero(testi: SchemaTestoLibero[]): string {
  const usati = new Set(testi.map((t) => t.id))
  for (let i = 1; ; i++) {
    const id = `T${i}`
    if (!usati.has(id)) return id
  }
}
```

L'hook segue `useSegniTubo.ts` e la stessa regola di cronologia degli altri gesti: **il primo evento di un gesto entra in cronologia, gli intermedi no**. Durante un trascinamento arrivano molti eventi al secondo, e registrarli tutti svuoterebbe la cronologia (profonda 10) di stati intermedi, rendendo Ctrl+Z inutile; registrare solo l'ultimo è peggio ancora, perché a quel punto lo stato «precedente» è già quello finale (vedi il giro di riparazione 1 del Blocco A). Tieni quindi un `useRef` che dice se il gesto in corso ha già registrato il suo stato di partenza, come fa `useTrascinamentoTratto.ts`.

- [ ] **Step 4: Esegui i test e verifica che passino**

```bash
npx vitest run src/components/schemaImpianto > task-9-verde.txt 2>&1
npx tsc --noEmit > task-9-tsc.txt 2>&1
```

- [ ] **Step 5: Commit**

```bash
git add src/components/schemaImpianto/useTestiLiberi.ts src/components/schemaImpianto/__tests__/useTestiLiberi.test.ts
git commit -m "feat(schema-impianto): creare, spostare e togliere un testo libero"
```

---

### Task 10: i testi liberi sulla tela

**Files:**
- Create: `src/components/schemaImpianto/TestiLiberi.tsx`
- Modify: `src/components/schemaImpianto/SchemaEditor.tsx` (stato, palette, portale, dialog)

**Interfaces:**
- Consumes: `useTestiLiberi` (Task 9); `TESTO_LIBERO` e `INTERLINEA_TESTO` (Task 2/7); il dialog di scrittura multi-riga (Task 5).
- Produces: nessuna firma pubblica nuova.

Nessun test automatico: componente React. La prova è la verifica in pagina del Task 11.

- [ ] **Step 1: Porta i testi nello stato dell'editor**

`StatoEditor` acquisisce `testi: SchemaTestoLibero[]`; lo stato iniziale li prende da `layoutAFlow(layout)`; `layoutCorrente` li passa a `flowALayout`. Da qui la cronologia (annulla/rifai) li copre gratis, perché lavora sull'intero stato.

- [ ] **Step 2: Disegna i testi sulla tela**

`TestiLiberi.tsx` riceve l'elenco dei testi e le callback dell'hook, e li disegna dentro `ViewportPortal` — lo stesso portale dove già vivono le guide di allineamento — ognuno come un `<div>` posizionato con `transform: translate(Xpx, Ypx)`, carattere `Arial, Helvetica, sans-serif`, corpo `TESTO_LIBERO.dimensione`, interlinea `INTERLINEA_TESTO`, `whiteSpace: 'pre'` perché gli a-capo si vedano.

Il trascinamento è il pattern già collaudato di `SchemaGomito` (in `SchemaEdgeTubazione.tsx`): cattura del puntatore, conversione da coordinate schermo a coordinate della tela con `screenToFlowPosition`, e la **guardia «si è mosso davvero»**, senza la quale un clic senza trascinamento consuma uno stato di cronologia (difetto trovato nel Task 9 del Blocco B):

```tsx
  const { screenToFlowPosition } = useReactFlow()
  const mossoRef = useRef(false)

  // …dentro il div del singolo testo:
      onPointerDown={(e) => {
        e.stopPropagation()
        mossoRef.current = false
        ;(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        if (!(e.currentTarget as HTMLDivElement).hasPointerCapture(e.pointerId)) return
        mossoRef.current = true
        onSposta(testo.id, screenToFlowPosition({ x: e.clientX, y: e.clientY }), false)
      }}
      onPointerUp={(e) => {
        if (!(e.currentTarget as HTMLDivElement).hasPointerCapture(e.pointerId)) return
        ;(e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId)
        if (mossoRef.current) onSposta(testo.id, screenToFlowPosition({ x: e.clientX, y: e.clientY }), true)
      }}
      onDoubleClick={(e) => {
        e.stopPropagation()
        onModifica(testo.id)
      }}
```

Il punto di presa è l'angolo del blocco di testo, non il suo centro: `screenToFlowPosition` dà la posizione del puntatore, e usarla direttamente come nuova `x`/`y` farebbe saltare il testo sotto il cursore al primo movimento. Conserva lo scostamento fra puntatore e origine del testo al `pointerdown` e sottrailo a ogni movimento.

- [ ] **Step 3: Aggiungi il pulsante alla palette**

Accanto alle voci della palette, un pulsante «+ Testo» che crea un testo con contenuto iniziale vuoto **e apre subito il dialog**: una scritta vuota sulla tela non si vedrebbe, e l'utente non saprebbe dove ha cliccato. Se l'utente annulla il dialog di una scritta appena creata, il testo va rimosso — non deve restare un'annotazione invisibile.

Il testo nasce nella stessa fascia dove nascono i nodi nuovi (sotto il disegno esistente, vedi `piedeDelDisegno`), non al centro della tela: sopra il disegno coprirebbe quello che c'è già.

- [ ] **Step 4: Generalizza il dialog di scrittura**

Il dialog del Task 5 serve ora due casi: la scritta del terminale e il testo libero. Estendi lo stato che lo governa perché sappia su cosa sta scrivendo, e cambia il titolo di conseguenza («Scritta del terminale» / «Testo sul disegno»). La validazione «non vuoto» vale per entrambi: per il terminale perché resterebbe senza dicitura, per il testo libero perché resterebbe invisibile.

- [ ] **Step 5: Verifica**

```bash
npx vitest run src/components/schemaImpianto > task-10-verde.txt 2>&1
npx tsc --noEmit > task-10-tsc.txt 2>&1
npx eslint src/components/schemaImpianto > task-10-eslint.txt 2>&1
```

- [ ] **Step 6: Commit**

```bash
git add src/components/schemaImpianto/TestiLiberi.tsx src/components/schemaImpianto/SchemaEditor.tsx
git commit -m "feat(schema-impianto): i testi liberi si creano, si scrivono e si trascinano sulla tela"
```

---

### Task 11: verifica in pagina e revisione finale del ramo

**Files:** nessuno, salvo correzioni che emergano.

La fa **il controller**, non un implementatore.

- [ ] **Step 1: Suite intera e tsc, una sola esecuzione**

```bash
npx vitest run > finale-vitest.txt 2>&1
npx tsc --noEmit > finale-tsc.txt 2>&1
```

- [ ] **Step 2: Verifica in pagina sulla pratica vera**

Dev server sulla 5176, pratica `c6f56ca5-d57b-408c-a4e5-69a207812b0d` → «Genera relazione» → «Rifinisci schema». Da provare, con `page.mouse` via `browser_run_code_unsafe`:

1. **TEE**: aggiungerne uno dalla palette, collegarvi tubazioni da **tutti e quattro** i lati (serve `alto`, l'ancora nuova), verificare che il simbolo sia un punto e che fra tubo e giunzione non resti un buco.
2. **Terminale multi-riga**: doppio clic sul terminale, scrivere due righe con Invio, confermare, e verificare che il disegno e l'anteprima concordino e che la tubazione resti attaccata alla base del codolo.
3. **Testo libero**: crearne uno, scriverlo su due righe, trascinarlo, riaprirlo e modificarlo, cancellarlo. Verificare che compaia nell'anteprima e che **non** compaia nella tabella delle apparecchiature né in legenda.
4. **Persistenza**: nessuna scrittura in banca dati (chiudere con «Annulla modifiche» + «Annulla»; **mai** «Genera comunque .docx»). Se serve provare il salvataggio, farlo su una pratica di prova, non su questa.
5. **Annullamento**: un Ctrl+Z dopo ognuno dei gesti sopra deve riportare indietro di un passo solo.

- [ ] **Step 3: Revisione finale del ramo intero**

Diff dell'intero blocco a un revisore fresco, sul modello del C1. I rilievi codificabili a basso rischio si correggono subito; quelli che cambiano il documento generato diventano domande per il committente.

- [ ] **Step 4: Aggiorna il ledger e consegna**

Nel ledger: cause vere dei difetti trovati, decisioni prese, debito rimandato. Nella consegna: dichiarare i due cambiamenti visibili sui disegni già esistenti — **il TEE si rimpicciolisce** e **il terminale utenze può crescere in altezza** — perché si vedranno su ogni pratica riaperta.
