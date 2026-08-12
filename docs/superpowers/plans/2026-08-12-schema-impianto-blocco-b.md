# Schema d'impianto — Blocco B: piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** aggiungere la giunzione/TEE come nodo a tre attacchi, trasformare valvole di intercettazione e riduttori di pressione in segni che vivono sulla tubazione (trascinabili, rimovibili, non più disegnati d'ufficio), e permettere di trascinare in blocco un tratto dritto di tubazione con i gomiti ai capi che si aggiustano da soli.

**Architecture:** stessa catena di funzioni pure del blocco precedente — `buildSchemaModel` → `layoutSchema` → `renderSvg` — più l'editor react-flow con `conversioneFlow.ts`. Il blocco aggiunge un tipo di nodo (`giunzione`), un nuovo tipo di dato che vive sull'arco e non sul nodo (`SchemaSegnoTubo`), e sposta la geometria della polilinea (`raccordoOrtogonale`, `polilineaConGomiti`) da `renderSvg.ts` a `tratti.ts` perché sia condivisa fra render statico, editor e il nuovo trascinamento del tratto — lo stesso motivo per cui `ondula()` vive già lì.

**Tech Stack:** TypeScript (strict=false), React 18, @xyflow/react, MUI 6, Vitest.

**Spec:** questo piano non ha un documento di spec separato — le decisioni sono già state prese col committente in un giro di brainstorming (vedi `.superpowers/sdd/2026-08-11-schema-impianto-fondamenta/progress.md`, voce «DECISIONI DEL COMMITTENTE (12-08-2026...)», punti A2/A3) e la sezione «Fuori» di `docs/superpowers/specs/2026-08-12-schema-impianto-utenze-legenda-design.md`. La sezione «Decisioni di progetto» qui sotto colma il livello implementativo che quelle decisioni non fissano.

## Global Constraints

- Si lavora **solo** nel worktree `.claude/worktrees/schema-impianto-dm329`, ramo `worktree-schema-impianto-dm329`. **Nessun merge e nessun push su `main`** finché il committente non lo dice.
- Dev server: `npm run dev -- --port 5176 --strictPort`, lanciato dentro il worktree. Verifica se è già attivo prima di rilanciarlo.
- Verifica di fine task, sempre entrambe: `npx tsc --noEmit` pulito e `npx vitest run` verde. Baseline prima del Task 1: **850 test su 71 file** (dopo la fusione di `main` nel ramo, misurata il 12-08-2026).
- **Ogni test nuovo va visto fallire PRIMA di scrivere l'implementazione**, se serve rompendo apposta il codice esistente, e la prova va nel report con redirezione su file (`> esito.txt 2>&1`), mai trascritta a memoria. Un test che passa su entrambe le implementazioni non discrimina e non vale: nei due blocchi precedenti dieci giri di riparazione sono nati da questo.
- **Non rifinire i simboli esistenti** (compressore, serbatoio, essiccatore, filtro, separatore, tanica, pacco bombole, utenze). Il committente fornirà i suoi blocchi CAD e li attrezzeremo con un'interfaccia dedicata: ritoccarli oggi è lavoro buttato. I simboli **nuovi** di questo blocco (giunzione, riduttore di pressione) sono geometria segnaposto, non un simbolo AutoCAD di riferimento — verranno sostituiti dallo stesso import futuro, quindi restano semplici apposta.
- La suite intera impiega oltre 2 minuti e due esecuzioni concorrenti di Vitest fanno morire il worker («Worker exited unexpectedly» di tinypool). Falla lanciare **solo al controller**, una alla volta, in background con redirezione su file. Gli implementatori usano i test mirati (`npx vitest run src/services/schemaImpianto` copre quasi tutto il modulo in pochi secondi; per i componenti React `npx vitest run src/components/schemaImpianto`).
- Commit convenzionali, in italiano, uno per task salvo dove il piano ne chiede due.
- Le verifiche in pagina le fa il controller, non l'implementatore. Se un implementatore riceve l'autorizzazione al browser, **è vietato premere «Genera comunque .docx»**: scrive su una pratica di produzione.
- Se l'implementazione scopre che il piano sbaglia o è incompleto, **il piano si corregge nello stesso commit del codice**, come parte del task e non come nota a margine.

### Tre trappole che fanno concludere il falso

- `addEdge` di react-flow **scarta i duplicati**: una connessione che sembra rifiutata può essere solo già esistente. Per provare un aggancio servono due ancore non già collegate.
- `onlyRenderVisibleElements` toglie dal DOM i nodi fuori vista: non sono persi, «Fit View» li riporta.
- Ogni ancora ha **due handle sovrapposti**: selezionarli con `.react-flow__handle.source[...]` e `.target[...]`, mai con `.first()`/`.last()`.

## Decisioni di progetto

Le tre feature erano già decise a livello di prodotto col committente (vedi sopra); qui sotto le scelte tecniche che quel livello non fissa, motivate per chi le rilegge dopo.

### 1. Giunzione/TEE

Nuovo `SchemaNodoTipo = 'giunzione'`. Simbolo segnaposto: tre monconi di tubo che confluiscono in un punto pieno (nessun codice disegnato — il nodo non entra in `righeLista`, mostrare un id senza una riga che lo spieghi confonderebbe). Tre ancore identiche (`sx`, `dx`, `basso`), tutte `accetta: ['aria']`: il TEE dirama la linea aria, non la condensa — se in futuro servirà anche lì, si aggiunge un'ancora, non si tocca questa. È un nodo vero (non un raccordo come `utenze`): **non** va escluso da `calcolaMuro`, `ordinaCatenaTrattamento` o `pozzoCondense` — quei filtri lo ignorano già perché non è nessuno dei tipi che cercano, senza bisogno di una riga dedicata. Entra in palette come le altre apparecchiature manuali (nessuna scheda dati lo produce), prefisso `G`.

### 2. Valvole e riduttori come segni sulla tubazione

Oggi `renderMandataCompressore`/`renderMandataLinea` disegnano una valvola di intercettazione **d'ufficio**, su ogni arco `standard`/`flessibile`, a un punto fisso non modificabile. Il committente vuole l'opposto: un segno che l'utente aggiunge, sposta lungo il tubo e toglie. Le due cose non possono coesistere sullo stesso arco senza confondere l'utente (quale valvola sta trascinando?), quindi la valvola d'ufficio **sparisce** e il suo posto lo prende un segno vero, seminato di default da `buildSchemaModel` così il disegno automatico non perde la valvola che aveva sempre avuto — ma ora è un dato che l'utente può cancellare o spostare, non più una certezza del rendering.

Il segno vive sull'**arco**, non sul nodo (`SchemaArco.segni?: SchemaSegnoTubo[]`), con una posizione **relativa** alla polilinea (`t`, 0=capo Da, 1=capo A) e non assoluta: è così che «scorre col tubo» quando un'apparecchiatura si sposta, senza bisogno di ricalcolare nulla a mano — la stessa polilinea che il render già ricalcola a ogni disegno porta il segno con sé.

La posizione di default (`t = 0.5`, punto medio) è diversa da quella di prima (vicino a un capo): scelta pratica, non estetica — se al committente non piace è una costante da spostare, non una riscrittura. Vedi «Rischi».

Il riduttore di pressione è un secondo tipo di segno, stesso meccanismo, simbolo diverso (farfalla della valvola più uno stelo di regolazione, per distinguerlo a colpo d'occhio). La riga di legenda «Valvola di intercettazione» oggi compare se il disegno ha almeno un arco `standard`/`flessibile` (perché prima la valvola era automatica); da questo blocco deve invece guardare se **esiste davvero un segno di quel tipo**, o la legenda spiegherebbe un simbolo che l'utente ha cancellato.

### 3. Trascinamento del tratto

«I gomiti ai capi si aggiustano da soli» richiede che editor e render concordino sulla stessa polilinea ortogonale: oggi il render statico la costruisce con `raccordoOrtogonale`/`polilineaConGomiti` (in `renderSvg.ts`), mentre l'editor per gli archi `standard`/`condensa` senza gomiti usa la rotta `smoothstep` di react-flow — un algoritmo diverso, con angoli arrotondati che quelle due funzioni non producono. Trascinare un tratto che nell'editor non è disegnato dalla stessa geometria che lo sposterebbe sarebbe incoerente. Le due funzioni si spostano quindi in `tratti.ts` (il file già dedicato alla geometria condivisa, per lo stesso motivo per cui ci vive `ondula()`) e l'editor smette di usare `getSmoothStepPath`, adottando `polilineaConGomiti` per **tutti** gli stili: è una correzione, non solo una preparazione, perché chiude l'approssimazione dichiarata nei commenti di `SchemaEdgeTubazione.tsx` e `SchemaEditor.tsx`.

La geometria del trascinamento (`trascinaTratto`) sposta i due capi del tratto afferrato della sola coordinata perpendicolare al tratto (delta.y se il tratto è orizzontale, delta.x se verticale) e **ricongiunge** ogni capo al suo vicino fisso (l'ancora, se il tratto tocca direttamente un'apparecchiatura, o il gomito successivo/precedente) con un raccordo che preserva la nuova posizione del capo spostato e non quella del vicino — è esattamente il gomito «che si aggiusta da solo»: se il tratto tocca un'ancora, ne nasce uno nuovo lì vicino; se tocca già un gomito, quel gomito trasla e basta.

## Impatto sui file

| File | Cosa cambia |
|---|---|
| `services/schemaImpianto/types.ts` | tipo `giunzione`; tipo `SchemaSegnoTuboTipo`/`SchemaSegnoTubo`; `segni?` su `SchemaArco` |
| `services/schemaImpianto/symbols/index.ts` | `simboloGiunzione`, `riduttorePressione`, voce `giunzione` nel registro, `DIMENSIONI`/`DIMENSIONI_NODO` estesi |
| `services/schemaImpianto/tratti.ts` | `puntoSuTratto`, `tSuTratto`, `raccordoOrtogonale`, `polilineaConGomiti` (spostate da `renderSvg.ts`), `trascinaTratto` |
| `services/schemaImpianto/buildSchemaModel.ts` | semina un segno `valvola_intercettazione` su ogni arco `standard`/`flessibile` nuovo |
| `services/schemaImpianto/renderSvg.ts` | `righeLista` salta `giunzione`; `renderArchi` disegna i segni dall'arco invece della valvola d'ufficio; `righeLegenda` guarda i segni veri, riga nuova per il riduttore; import di `raccordoOrtogonale`/`polilineaConGomiti` da `tratti.ts` con re-export per non rompere gli import esistenti nei test |
| `components/schemaImpianto/conversioneFlow.ts` | `segni` passa attraverso `layoutAFlow`/`flowALayout` |
| `components/schemaImpianto/SchemaEdgeTubazione.tsx` | `SchemaEdgeData.segni` + callback; disegno e trascinamento dei segni; routing con `polilineaConGomiti` per tutti gli stili (via nuovo `useTrascinamentoTratto`); commento di testa aggiornato |
| `components/schemaImpianto/useSegniTubo.ts` | **nuovo**: aggiungere/spostare/rimuovere un segno, stesso pattern di `useGomiti.ts` |
| `components/schemaImpianto/useTrascinamentoTratto.ts` | **nuovo**: trascinamento del tratto, stesso pattern di cronologia di `useGomiti.ts` |
| `components/schemaImpianto/SchemaEditor.tsx` | voce `giunzione` in `PALETTE`; pulsanti «+ Valvola»/«+ Riduttore»; cablaggio dei due hook nuovi; commento su «la tela è un'approssimazione» corretto |

L'elenco è quello previsto adesso: se l'implementazione ne scopre altri, **il piano si corregge nello stesso commit del codice**.

## Rischi e questioni aperte

- **Posizione di default dei segni (`t = 0.5`).** Diversa dalla vecchia valvola automatica (vicino a un capo). Da mostrare al committente; se preferisce altro è una costante.
- **Simboli segnaposto.** Giunzione e riduttore sono geometria minima, non blocchi CAD: verranno sostituiti quando arriva l'import dei blocchi del committente (fuori perimetro).
- **Il TEE non entra nella palette delle ancore che accettano condensa.** Se in futuro servirà diramare una linea condense, l'ancora `accetta` andrà estesa — non è un caso oggi raggiungibile (nessun impianto nei riferimenti diramà la condensa) quindi non lo si copre con un test che non discriminerebbe nulla.
- **Instradamento unificato (Task 8/9).** Cambia la forma delle linee `standard`/`condensa` nell'editor per gli archi senza gomiti (angoli netti invece che smussati da `smoothstep`): è un miglioramento di coerenza col render statico, ma è un cambiamento visibile da segnalare al committente in verifica finale.

---

### Task 1: Il nodo giunzione/TEE

**Files:**
- Modify: `src/services/schemaImpianto/types.ts` (`SchemaNodoTipo`)
- Modify: `src/services/schemaImpianto/symbols/index.ts` (`DIMENSIONI`, `REGISTRO_SIMBOLI`, `DIMENSIONI_NODO`, nuova `simboloGiunzione`)
- Modify: `src/services/schemaImpianto/__tests__/simboli.test.ts`

**Interfaces:**
- Consumes: `SchemaAncora`, `DefinizioneSimbolo`, `traccia()` (locale a `symbols/index.ts`).
- Produces: `SchemaNodoTipo` include `'giunzione'`; `REGISTRO_SIMBOLI.giunzione: DefinizioneSimbolo` con `ancore: [{id:'sx',...},{id:'dx',...},{id:'basso',...}]`, tutte `accetta:['aria']`. Consumato dal Task 2 e da `buildSchemaModel`/`layout.ts`/`renderSvg.ts` senza modifiche (passano già per `definizioneDi`/`ancoraDi`/`simboloDi`, generici sul tipo).

- [ ] **Step 1: Scrivere il test del simbolo, prima che esista**

Apri `src/services/schemaImpianto/__tests__/simboli.test.ts`, guarda come sono strutturati i test esistenti (`describe('simboli')` con un test per ogni `simbolo*`) e aggiungi:

```ts
describe('simboloGiunzione', () => {
  it('disegna tre monconi di tubo che confluiscono in un punto pieno, senza testo', () => {
    const svg = REGISTRO_SIMBOLI.giunzione.disegna({
      id: 'M-G1',
      tipo: 'giunzione',
      etichetta: 'Giunzione',
      gruppo: 'LINEA_DISTRIBUZIONE',
      valvoleSicurezza: [],
      origine: 'manuale',
    })
    expect(svg).not.toContain('<text')
    expect((svg.match(/<path/g) ?? []).length).toBe(3)
    expect(svg).toContain('<circle')
  })

  it('ha tre ancore che accettano aria, dentro l’ingombro dichiarato', () => {
    const def = REGISTRO_SIMBOLI.giunzione
    expect(def.ancore.map((a) => a.id).sort()).toEqual(['basso', 'dx', 'sx'])
    for (const ancora of def.ancore) {
      expect(ancora.accetta).toEqual(['aria'])
      expect(ancora.x).toBeGreaterThanOrEqual(0)
      expect(ancora.x).toBeLessThanOrEqual(def.dimensioni.larghezza)
      expect(ancora.y).toBeGreaterThanOrEqual(0)
      expect(ancora.y).toBeLessThanOrEqual(def.dimensioni.altezza)
    }
  })
})
```

Aggiungi l'import di `REGISTRO_SIMBOLI` in testa al file se non c'è già (verifica: oggi il file importa già `dimensioniDi` e le funzioni `simbolo*` singole — aggiungi `REGISTRO_SIMBOLI` all'elenco).

- [ ] **Step 2: Eseguire e verificare il rosso**

Run: `npx vitest run src/services/schemaImpianto/__tests__/simboli.test.ts > ../../../../.superpowers/sdd/2026-08-12-schema-impianto-utenze-legenda/task-b1-rosso.txt 2>&1`

Expected: FAIL — `giunzione` non esiste né in `SchemaNodoTipo` né in `REGISTRO_SIMBOLI` (errore di tipo TypeScript sollevato da `vitest`/`esbuild`, o `REGISTRO_SIMBOLI.giunzione` `undefined` a runtime).

- [ ] **Step 3: Implementare**

In `src/services/schemaImpianto/types.ts`, estendi `SchemaNodoTipo` (riga 22-36):

```ts
export type SchemaNodoTipo =
  | 'compressore'
  | 'serbatoio'
  | 'essiccatore'
  | 'filtro'
  | 'separatore'
  | 'tanica'
  | 'pacco_bombole'
  | 'utenze'
  /**
   * Giunzione a tre attacchi (TEE): dirama la linea, è un nodo vero e non un segno sul tubo
   * (a differenza di valvole e riduttori, che hanno solo un dentro e un fuori). Non entra
   * nella lista apparecchiature né in legenda: non ha codice, non è un dato di scheda.
   */
  | 'giunzione'
```

In `src/services/schemaImpianto/symbols/index.ts`, aggiungi `giunzione` a `DIMENSIONI` (riga 24-33):

```ts
const DIMENSIONI: Record<SchemaNodoTipo, { larghezza: number; altezza: number }> = {
  compressore: { larghezza: 160, altezza: 150 },
  serbatoio: { larghezza: 150, altezza: 260 },
  essiccatore: { larghezza: 110, altezza: 110 },
  filtro: { larghezza: 110, altezza: 110 },
  separatore: { larghezza: 110, altezza: 110 },
  tanica: { larghezza: 80, altezza: 70 },
  pacco_bombole: { larghezza: 120, altezza: 100 },
  utenze: { larghezza: 190, altezza: 120 },
  giunzione: { larghezza: 50, altezza: 50 },
}
```

Aggiungi la funzione di disegno, subito dopo `simboloPaccoBombole` (prima della sezione UTENZE):

```ts
/**
 * Giunzione a tre attacchi (TEE): simbolo segnaposto, non un blocco CAD di riferimento — tre
 * monconi che confluiscono in un punto pieno. Nessun testo: il nodo non ha una riga in
 * `righeLista` che ne spieghi un codice, e disegnarlo comunque confonderebbe.
 */
export function simboloGiunzione(): string {
  const cx = 25
  const cy = 25
  return [
    traccia(`M 0 ${cy} L ${cx} ${cy}`),
    traccia(`M ${2 * cx} ${cy} L ${cx} ${cy}`),
    traccia(`M ${cx} ${2 * cy} L ${cx} ${cy}`),
    `<circle cx="${cx}" cy="${cy}" r="4" fill="#000" />`,
  ].join('')
}
```

Nota: `disegna` in `DefinizioneSimbolo` ha firma `(nodo: SchemaNodo) => string`; `simboloGiunzione` non legge `nodo` (nessun accessorio, nessuna variante). Registrala con un adattatore inline nel Task successivo, oppure dalle una firma compatibile: `export function simboloGiunzione(_nodo: SchemaNodo): string { ... }` — usa questa seconda forma per restare coerente con le altre `simbolo*`.

Aggiungi la voce al registro, dopo `pacco_bombole` (riga 439-443):

```ts
  giunzione: {
    dimensioni: DIMENSIONI.giunzione,
    ancore: [
      { id: 'sx', x: 0, y: 25, accetta: ['aria'] },
      { id: 'dx', x: 50, y: 25, accetta: ['aria'] },
      { id: 'basso', x: 25, y: 50, accetta: ['aria'] },
    ],
    disegna: simboloGiunzione,
  },
```

Aggiungi `giunzione` a `DIMENSIONI_NODO` (riga 488-497):

```ts
  giunzione: REGISTRO_SIMBOLI.giunzione.dimensioni,
```

- [ ] **Step 4: Eseguire e verificare il verde**

Run: `npx vitest run src/services/schemaImpianto/__tests__/simboli.test.ts > ../../../../.superpowers/sdd/2026-08-12-schema-impianto-utenze-legenda/task-b1-verde.txt 2>&1`

Expected: PASS, tutti i test del file.

Run anche: `npx tsc --noEmit > ../../../../.superpowers/sdd/2026-08-12-schema-impianto-utenze-legenda/task-b1-tsc.txt 2>&1` — deve restare pulito (`DIMENSIONI`/`DIMENSIONI_NODO` sono `Record<SchemaNodoTipo,...>`: se ne dimentichi una voce il compilatore lo dice da sé).

- [ ] **Step 5: Commit**

```bash
git add src/services/schemaImpianto/types.ts src/services/schemaImpianto/symbols/index.ts src/services/schemaImpianto/__tests__/simboli.test.ts
git commit -m "feat(schema-impianto): aggiunge il nodo giunzione/TEE a tre attacchi"
```

---

### Task 2: TEE nell'editor: palette e fuori dalla lista apparecchiature

**Files:**
- Modify: `src/services/schemaImpianto/renderSvg.ts` (`righeLista`)
- Modify: `src/components/schemaImpianto/SchemaEditor.tsx` (`PALETTE`)
- Modify: `src/services/schemaImpianto/__tests__/renderSvg.test.ts`

**Interfaces:**
- Consumes: `REGISTRO_SIMBOLI.giunzione` dal Task 1.
- Produces: nessuna nuova funzione — solo comportamento osservabile (righeLista, palette).

- [ ] **Step 1: Scrivere il test su `righeLista`**

In `src/services/schemaImpianto/__tests__/renderSvg.test.ts`, vicino al test esistente «il terminale utenze non compare fra le apparecchiature in lista» (riga 98), aggiungi:

```ts
it('la giunzione non compare fra le apparecchiature in lista', () => {
  const scheda = makeScheda({
    compressori: [makeCompressore({ ha_disoleatore: false })],
    disoleatori: [],
    serbatoi: [makeSerbatoio()],
    essiccatori: [],
    scambiatori: [],
    filtri: [],
    dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
  })
  const layout = layoutSchema(buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } }))
  layout.nodi.push({
    id: 'M-G1',
    tipo: 'giunzione',
    etichetta: 'Giunzione',
    gruppo: 'LINEA_DISTRIBUZIONE',
    valvoleSicurezza: [],
    origine: 'manuale',
    x: 500,
    y: 300,
  })

  const codici = righeLista(layout).map((r) => (r.sinistra as { codice: string }).codice)
  expect(codici).not.toContain('M-G1')
})
```

- [ ] **Step 2: Eseguire e verificare il rosso**

Run: `npx vitest run src/services/schemaImpianto/__tests__/renderSvg.test.ts -t "la giunzione non compare" > ../../../../.superpowers/sdd/2026-08-12-schema-impianto-utenze-legenda/task-b2-rosso.txt 2>&1`

Expected: FAIL — `righeLista` oggi salta solo `'utenze'`, quindi `M-G1` compare in `codici`.

- [ ] **Step 3: Implementare**

In `src/services/schemaImpianto/renderSvg.ts`, riga 245 (dentro `righeLista`):

```ts
    if (nodo.tipo === 'utenze' || nodo.tipo === 'giunzione') continue
```

In `src/components/schemaImpianto/SchemaEditor.tsx`, aggiungi una voce a `PALETTE` (riga 72-79):

```ts
const PALETTE: { tipo: SchemaNodoTipo; etichetta: string; prefisso: string }[] = [
  { tipo: 'serbatoio', etichetta: 'Serbatoio', prefisso: 'S' },
  { tipo: 'filtro', etichetta: 'Filtro', prefisso: 'F' },
  { tipo: 'essiccatore', etichetta: 'Essiccatore', prefisso: 'E' },
  { tipo: 'separatore', etichetta: 'Separatore', prefisso: 'SEP' },
  { tipo: 'tanica', etichetta: 'Raccolta condense', prefisso: 'T' },
  { tipo: 'pacco_bombole', etichetta: 'Pacco bombole', prefisso: 'PB' },
  { tipo: 'giunzione', etichetta: 'Giunzione (TEE)', prefisso: 'G' },
]
```

Nessun'altra modifica: `aggiungiNodo` (riga 285-312) è già generico sul `tipo`, e `codiceLibero` (riga 145-151) sul `prefisso`.

- [ ] **Step 4: Eseguire e verificare il verde**

Run: `npx vitest run src/services/schemaImpianto/__tests__/renderSvg.test.ts > ../../../../.superpowers/sdd/2026-08-12-schema-impianto-utenze-legenda/task-b2-verde.txt 2>&1`

Expected: PASS, tutto il file (non solo il test nuovo: verifica che non hai rotto `righeLista` per `utenze`).

Run: `npx tsc --noEmit > ../../../../.superpowers/sdd/2026-08-12-schema-impianto-utenze-legenda/task-b2-tsc.txt 2>&1` — pulito.

- [ ] **Step 5: Commit**

```bash
git add src/services/schemaImpianto/renderSvg.ts src/components/schemaImpianto/SchemaEditor.tsx src/services/schemaImpianto/__tests__/renderSvg.test.ts
git commit -m "feat(schema-impianto): la giunzione entra in palette e resta fuori dalla lista apparecchiature"
```

---

### Task 3: Il tipo `SchemaSegnoTubo` e la geometria `puntoSuTratto`/`tSuTratto`

Solo geometria pura, nessun collegamento al resto del motore ancora: prepara i Task 4-7.

**Files:**
- Modify: `src/services/schemaImpianto/types.ts` (`SchemaSegnoTuboTipo`, `SchemaSegnoTubo`, `SchemaArco.segni`)
- Modify: `src/services/schemaImpianto/tratti.ts` (`puntoSuTratto`, `tSuTratto`)
- Modify: `src/services/schemaImpianto/__tests__/tratti.test.ts`

**Interfaces:**
- Consumes: `Punto` da `tratti.ts` (già esiste).
- Produces: `puntoSuTratto(punti: Punto[], t: number): { punto: Punto; orizzontale: boolean }` — posizione lungo una polilinea GIÀ RISOLTA (compresi i gomiti automatici), a frazione `t` della lunghezza totale, più l'orientamento del tratto locale. `tSuTratto(punti: Punto[], p: Punto): number` — l'inversa: la `t` del punto della polilinea più vicino a `p`. Consumati dal Task 5 (render), dal Task 7 (editor: disegno e trascinamento dei segni).

- [ ] **Step 1: Scrivere i test, prima che le funzioni esistano**

Apri `src/services/schemaImpianto/__tests__/tratti.test.ts`, guarda lo stile dei test su `ondula` e aggiungi:

```ts
describe('puntoSuTratto', () => {
  const orizzontale = [
    { x: 0, y: 100 },
    { x: 200, y: 100 },
  ]
  const conAngolo = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 50 },
  ]

  it('t=0 e t=1 cadono esattamente sui due capi', () => {
    expect(puntoSuTratto(orizzontale, 0).punto).toEqual({ x: 0, y: 100 })
    expect(puntoSuTratto(orizzontale, 1).punto).toEqual({ x: 200, y: 100 })
  })

  it('t=0.5 cade a metà della lunghezza totale, non del solo primo tratto', () => {
    // Primo tratto lungo 100, secondo lungo 50: metà dei 150 totali cade a 75 sul primo tratto.
    const risultato = puntoSuTratto(conAngolo, 0.5)
    expect(risultato.punto).toEqual({ x: 75, y: 0 })
    expect(risultato.orizzontale).toBe(true)
  })

  it('riconosce il tratto verticale dopo l’angolo', () => {
    // 100/150 = 0.667: appena oltre l'angolo, sul tratto verticale.
    const risultato = puntoSuTratto(conAngolo, 0.7)
    expect(risultato.orizzontale).toBe(false)
    expect(risultato.punto.x).toBe(100)
  })
})

describe('tSuTratto', () => {
  const conAngolo = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 50 },
  ]

  it('è l’inversa di puntoSuTratto sui punti che restituisce', () => {
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const { punto } = puntoSuTratto(conAngolo, t)
      expect(tSuTratto(conAngolo, punto)).toBeCloseTo(t, 5)
    }
  })

  it('un punto fuori dalla polilinea si proietta sul tratto più vicino, non sul più lontano', () => {
    // (100, 25) è a distanza 0 dal tratto verticale, a metà della sua lunghezza (25 su 50):
    // lunghezza percorsa = 100 (primo tratto) + 25 = 125, su un totale di 150 -> t = 5/6.
    expect(tSuTratto(conAngolo, { x: 100, y: 25 })).toBeCloseTo(5 / 6, 2)
  })
})
```

- [ ] **Step 2: Eseguire e verificare il rosso**

Run: `npx vitest run src/services/schemaImpianto/__tests__/tratti.test.ts > ../../../../.superpowers/sdd/2026-08-12-schema-impianto-utenze-legenda/task-b3-rosso.txt 2>&1`

Expected: FAIL — `puntoSuTratto`/`tSuTratto` non esistono ancora.

- [ ] **Step 3: Implementare**

In `src/services/schemaImpianto/types.ts`, dopo `SchemaArcoStile` (riga 109), aggiungi:

```ts
export type SchemaSegnoTuboTipo = 'valvola_intercettazione' | 'riduttore_pressione'

/**
 * Segno che vive SULLA tubazione, non un nodo: valvola di intercettazione o riduttore di
 * pressione. Scorre lungo il tratto e lo segue quando un'apparecchiatura si sposta perché la
 * sua posizione è relativa alla polilinea (`t`), non assoluta — a differenza della giunzione,
 * che è un nodo vero con tre attacchi propri.
 */
export interface SchemaSegnoTubo {
  id: string
  tipo: SchemaSegnoTuboTipo
  /** Posizione lungo la polilinea del tratto: 0 = capo Da, 1 = capo A. */
  t: number
}
```

Estendi `SchemaArco` (riga 111-118) con un campo:

```ts
export interface SchemaArco {
  id: string
  da: SchemaCapo
  a: SchemaCapo
  stile: SchemaArcoStile
  /** Gomiti imposti a mano, in coordinate assolute. Assente: percorso automatico. */
  punti?: { x: number; y: number }[]
  /** Valvole di intercettazione e riduttori di pressione posati sul tratto. */
  segni?: SchemaSegnoTubo[]
}
```

In `src/services/schemaImpianto/tratti.ts`, dopo `ondula` (fine del file), aggiungi:

```ts
/**
 * Punto lungo una polilinea GIÀ RISOLTA (compresi i gomiti automatici di
 * `polilineaConGomiti`) a una frazione `t` della lunghezza totale — non del numero di
 * segmenti, o un tratto lungo poco sposterebbe il segno quanto uno lungo molto. Ritorna anche
 * se il tratto locale è orizzontale, per orientare il simbolo (`valvolaIntercettazione` e
 * `riduttorePressione` vogliono sapere se sono su un montante o su un tratto in linea).
 */
export function puntoSuTratto(punti: Punto[], t: number): { punto: Punto; orizzontale: boolean } {
  if (punti.length === 0) return { punto: { x: 0, y: 0 }, orizzontale: true }
  if (punti.length === 1) return { punto: punti[0], orizzontale: true }

  const lunghezze = punti.slice(1).map((p, i) => Math.hypot(p.x - punti[i].x, p.y - punti[i].y))
  const totale = lunghezze.reduce((s, l) => s + l, 0)
  const target = Math.max(0, Math.min(1, t)) * totale

  let percorsa = 0
  for (let i = 0; i < lunghezze.length; i++) {
    const l = lunghezze[i]
    if (percorsa + l >= target || i === lunghezze.length - 1) {
      const frazioneLocale = l === 0 ? 0 : (target - percorsa) / l
      const a = punti[i]
      const b = punti[i + 1]
      return {
        punto: { x: a.x + (b.x - a.x) * frazioneLocale, y: a.y + (b.y - a.y) * frazioneLocale },
        orizzontale: a.y === b.y,
      }
    }
    percorsa += l
  }
  return { punto: punti[punti.length - 1], orizzontale: true }
}

/**
 * Inversa di `puntoSuTratto`: la `t` del punto della polilinea più vicino a un punto libero
 * (es. dove il mouse ha rilasciato un segno trascinato). Proietta su ogni segmento, bloccando
 * la proiezione ai suoi estremi, e tiene il segmento a distanza minima — così un rilascio
 * fuori dalla linea si aggancia al tratto più vicino, non al primo della lista.
 */
export function tSuTratto(punti: Punto[], p: Punto): number {
  if (punti.length < 2) return 0

  const lunghezze = punti.slice(1).map((pt, i) => Math.hypot(pt.x - punti[i].x, pt.y - punti[i].y))
  const totale = lunghezze.reduce((s, l) => s + l, 0)
  if (totale === 0) return 0

  let percorsa = 0
  let migliore = { distanza: Infinity, t: 0 }
  for (let i = 0; i < lunghezze.length; i++) {
    const a = punti[i]
    const b = punti[i + 1]
    const l = lunghezze[i]
    const frazioneLocale =
      l === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / (l * l)))
    const proiezione = { x: a.x + (b.x - a.x) * frazioneLocale, y: a.y + (b.y - a.y) * frazioneLocale }
    const distanza = Math.hypot(p.x - proiezione.x, p.y - proiezione.y)
    if (distanza < migliore.distanza) migliore = { distanza, t: (percorsa + frazioneLocale * l) / totale }
    percorsa += l
  }
  return migliore.t
}
```

- [ ] **Step 4: Eseguire e verificare il verde**

Run: `npx vitest run src/services/schemaImpianto/__tests__/tratti.test.ts > ../../../../.superpowers/sdd/2026-08-12-schema-impianto-utenze-legenda/task-b3-verde.txt 2>&1`

Expected: PASS, tutto il file.

Run: `npx tsc --noEmit > ../../../../.superpowers/sdd/2026-08-12-schema-impianto-utenze-legenda/task-b3-tsc.txt 2>&1` — pulito.

- [ ] **Step 5: Commit**

```bash
git add src/services/schemaImpianto/types.ts src/services/schemaImpianto/tratti.ts src/services/schemaImpianto/__tests__/tratti.test.ts
git commit -m "feat(schema-impianto): tipo SchemaSegnoTubo e geometria puntoSuTratto/tSuTratto"
```

---

### Task 4: Il simbolo del riduttore di pressione e le righe di legenda

**Files:**
- Modify: `src/services/schemaImpianto/symbols/index.ts` (`riduttorePressione`)
- Modify: `src/services/schemaImpianto/renderSvg.ts` (`righeLegenda`)
- Modify: `src/services/schemaImpianto/__tests__/simboli.test.ts`
- Modify: `src/services/schemaImpianto/__tests__/renderSvg.test.ts`

**Interfaces:**
- Consumes: `valvolaIntercettazione`, `traccia` (locali a `symbols/index.ts`); `SchemaSegnoTubo` dal Task 3.
- Produces: `riduttorePressione(x: number, y: number, orientamento?: 'orizzontale' | 'verticale'): string`, stessa forma di `valvolaIntercettazione`. Consumata dal Task 5 (render dei segni) e qui stesso (campione di legenda).

- [ ] **Step 1: Scrivere i test**

In `src/services/schemaImpianto/__tests__/simboli.test.ts`:

```ts
describe('riduttorePressione', () => {
  it('contiene la farfalla della valvola di intercettazione più uno stelo di regolazione', () => {
    const valvola = valvolaIntercettazione(50, 50)
    const riduttore = riduttorePressione(50, 50)
    // Stesso corpo della valvola (farfalla), riconoscibile perché il riduttore lo contiene
    // per intero: è la valvola con un elemento in più, non un disegno indipendente.
    expect(riduttore).toContain(valvola)
    expect(riduttore).not.toBe(valvola)
    expect(riduttore).toContain('<rect')
  })

  it('ruota lo stelo con l’orientamento, come la valvola sottostante', () => {
    const orizzontale = riduttorePressione(50, 50, 'orizzontale')
    const verticale = riduttorePressione(50, 50, 'verticale')
    expect(orizzontale).not.toBe(verticale)
  })
})
```

In `src/services/schemaImpianto/__tests__/renderSvg.test.ts`, vicino ai test esistenti sulla legenda (cerca `righeLegenda` nel file per orientarti sullo stile), aggiungi:

```ts
describe('righeLegenda — riduttore di pressione', () => {
  function layoutConSegno(segni: SchemaSegnoTubo[]) {
    const scheda = makeScheda({
      compressori: [makeCompressore({ ha_disoleatore: false })],
      disoleatori: [],
      serbatoi: [makeSerbatoio()],
      essiccatori: [],
      scambiatori: [],
      filtri: [],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
    })
    const layout = layoutSchema(buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } }))
    layout.archi[0].segni = segni
    return layout
  }

  it('compare solo se il disegno ha davvero un riduttore', () => {
    const senza = layoutConSegno([{ id: 'v1', tipo: 'valvola_intercettazione', t: 0.5 }])
    const con = layoutConSegno([{ id: 'r1', tipo: 'riduttore_pressione', t: 0.5 }])

    expect(righeLegenda(senza).map((r) => r.descrizione)).not.toContain('Riduttore di pressione')
    expect(righeLegenda(con).map((r) => r.descrizione)).toContain('Riduttore di pressione')
  })

  it('la valvola di intercettazione in legenda guarda i segni veri, non lo stile dell’arco', () => {
    // Prima di questo blocco la riga compariva per ogni arco standard/flessibile: da qui in
    // poi la valvola è un segno che l'utente può togliere, e se l'ha tolta la legenda non
    // deve promettere un simbolo che il disegno non ha più.
    const senzaValvole = layoutConSegno([])
    expect(righeLegenda(senzaValvole).map((r) => r.descrizione)).not.toContain('Valvola di intercettazione')
  })
})
```

Aggiungi `import type { SchemaSegnoTubo } from '../types'` in testa al file se non già presente.

- [ ] **Step 2: Eseguire e verificare il rosso**

Run: `npx vitest run src/services/schemaImpianto/__tests__/simboli.test.ts src/services/schemaImpianto/__tests__/renderSvg.test.ts > ../../../../.superpowers/sdd/2026-08-12-schema-impianto-utenze-legenda/task-b4-rosso.txt 2>&1`

Expected: FAIL — `riduttorePressione` non esiste; la riga «Valvola di intercettazione» compare ancora per lo stile dell'arco, non per i segni (il secondo test del secondo blocco fallisce nel modo giusto: il rosso deve mostrare che con `senzaValvole` la riga compare comunque, cioè il comportamento vecchio sopravvive finché non implementi).

- [ ] **Step 3: Implementare**

In `src/services/schemaImpianto/symbols/index.ts`, dopo `valvolaIntercettazione`:

```ts
/**
 * Riduttore di pressione: la stessa farfalla della valvola di intercettazione più uno stelo
 * di regolazione, per distinguerlo a colpo d'occhio. Simbolo segnaposto (vedi nota di testa
 * al file sui simboli nuovi di questo blocco), non un blocco CAD del committente.
 */
export function riduttorePressione(
  x: number,
  y: number,
  orientamento: 'orizzontale' | 'verticale' = 'orizzontale'
): string {
  const base = valvolaIntercettazione(x, y, orientamento)
  const stelo =
    orientamento === 'orizzontale'
      ? traccia(`M ${x} ${y - 8} L ${x} ${y - 16}`) +
        `<rect x="${x - 5}" y="${y - 22}" width="10" height="6" fill="none" stroke="#000" stroke-width="${TRATTO}" />`
      : traccia(`M ${x + 8} ${y} L ${x + 16} ${y}`) +
        `<rect x="${x + 16}" y="${y - 5}" width="6" height="10" fill="none" stroke="#000" stroke-width="${TRATTO}" />`
  return base + stelo
}
```

In `src/services/schemaImpianto/renderSvg.ts`, importa `riduttorePressione` (riga 9-18, accanto a `valvolaIntercettazione`/`valvolaScarico`) e riscrivi `righeLegenda` (riga 269-291):

```ts
export function righeLegenda(layout: SchemaLayout): RigaTabella[] {
  const stili = new Set(layout.archi.map((a) => a.stile))
  const segni = layout.archi.flatMap((a) => a.segni ?? [])
  const righe: RigaTabella[] = []

  if (segni.some((s) => s.tipo === 'valvola_intercettazione')) {
    righe.push({ sinistra: { simbolo: valvolaIntercettazione(0, 0) }, descrizione: 'Valvola di intercettazione' })
  }
  if (segni.some((s) => s.tipo === 'riduttore_pressione')) {
    righe.push({ sinistra: { simbolo: riduttorePressione(0, 0) }, descrizione: 'Riduttore di pressione' })
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

Il commento sopra la funzione (righe 260-268) resta valido; aggiorna solo la frase sulla valvola di intercettazione, che oggi dice implicitamente «la disegnano le mandate»: sostituiscila con una nota che la presenza si legge dai segni, non dallo stile — la disegnano le mandate solo indirettamente, tramite il segno che `buildSchemaModel` semina (Task 5).

- [ ] **Step 4: Eseguire e verificare il verde**

Run: `npx vitest run src/services/schemaImpianto/__tests__/simboli.test.ts src/services/schemaImpianto/__tests__/renderSvg.test.ts > ../../../../.superpowers/sdd/2026-08-12-schema-impianto-utenze-legenda/task-b4-verde.txt 2>&1`

Expected: PASS. Nota: i test PREESISTENTI su `righeLegenda` che si aspettavano la valvola di intercettazione per la sola presenza di un arco `standard`/`flessibile` (senza impostare `segni`) ora falliranno, perché `layoutSchema`/`buildSchemaModel` non seminano ancora segni (arriva nel Task 5) — è atteso: se cadono, verificane il motivo esatto (deve essere «nessun segno», non un altro errore) e lasciali rossi, li richiude il Task 5. Annota nel report quali test restano rossi e perché.

Run: `npx tsc --noEmit > ../../../../.superpowers/sdd/2026-08-12-schema-impianto-utenze-legenda/task-b4-tsc.txt 2>&1` — pulito.

- [ ] **Step 5: Commit**

```bash
git add src/services/schemaImpianto/symbols/index.ts src/services/schemaImpianto/renderSvg.ts src/services/schemaImpianto/__tests__/simboli.test.ts src/services/schemaImpianto/__tests__/renderSvg.test.ts
git commit -m "feat(schema-impianto): simbolo del riduttore di pressione e legenda basata sui segni veri"
```

---

### Task 5: I segni sostituiscono la valvola disegnata d'ufficio

Chiude i rossi lasciati dal Task 4: `buildSchemaModel` semina il segno di default, `renderArchi` lo disegna e smette di disegnare la valvola a un punto fisso.

**Files:**
- Modify: `src/services/schemaImpianto/buildSchemaModel.ts` (`buildArchi`)
- Modify: `src/services/schemaImpianto/renderSvg.ts` (`renderMandataCompressore`, `renderMandataLinea`, `renderArchi`)
- Modify: `src/services/schemaImpianto/__tests__/buildSchemaModel.test.ts`
- Modify: `src/services/schemaImpianto/__tests__/renderSvg.test.ts`

**Interfaces:**
- Consumes: `SchemaSegnoTubo` (Task 3), `puntoSuTratto` (Task 3), `riduttorePressione`/`valvolaIntercettazione` (Task 4).
- Produces: nessuna funzione nuova esportata — comportamento osservabile su `buildSchemaModel(...).archi[].segni` e sull'SVG di `renderArchi`.

- [ ] **Step 1: Scrivere il test su `buildSchemaModel`**

In `src/services/schemaImpianto/__tests__/buildSchemaModel.test.ts`, vicino ai test su `buildArchi`/gli archi standard, aggiungi (importa anche `ID_UTENZE` da `../buildSchemaModel` se il file non lo importa già):

```ts
it('ogni arco standard e flessibile nasce con un segno di valvola di intercettazione', () => {
  const scheda = makeScheda({
    compressori: [makeCompressore({ ha_disoleatore: false })],
    disoleatori: [],
    serbatoi: [makeSerbatoio()],
    essiccatori: [makeEssiccatore()],
    filtri: [],
    dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
  })
  const model = buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })

  // Esclude l'arco verso ID_UTENZE: è 'standard' ma è il codolo del terminale, non riceve
  // un segno (vedi la sezione «Implementare» qui sotto — il difetto originale del piano
  // includeva quell'arco in questo filtro, contraddicendo la sua stessa istruzione più avanti).
  const rigideOFlessibili = model.archi.filter(
    (a) => (a.stile === 'standard' || a.stile === 'flessibile') && a.a.nodo !== ID_UTENZE
  )
  expect(rigideOFlessibili.length).toBeGreaterThan(0)
  for (const arco of rigideOFlessibili) {
    expect(arco.segni).toHaveLength(1)
    expect(arco.segni![0].tipo).toBe('valvola_intercettazione')
    expect(arco.segni![0].t).toBeGreaterThan(0)
    expect(arco.segni![0].t).toBeLessThan(1)
  }
})

it('gli archi condensa non hanno segni: la valvola non serve sullo scarico', () => {
  const scheda = makeScheda({ dati_impianto: makeDatiImpianto({ raccolta_condense: 'tanica' }) })
  const model = buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })
  const condensa = model.archi.filter((a) => a.stile === 'condensa')
  expect(condensa.length).toBeGreaterThan(0)
  for (const arco of condensa) expect(arco.segni ?? []).toHaveLength(0)
})
```

In `src/services/schemaImpianto/__tests__/renderSvg.test.ts`, aggiungi un test che discrimini la posizione (non solo la presenza) del simbolo:

```ts
it('disegna il segno di valvola nel punto che il suo `t` indica, non in un punto fisso', () => {
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
  const arco = layout.archi.find((a) => a.stile === 'flessibile')!
  arco.segni = [{ id: 'v1', tipo: 'valvola_intercettazione', t: 0 }]
  const conTAZero = renderSvg(layout)

  arco.segni = [{ id: 'v1', tipo: 'valvola_intercettazione', t: 1 }]
  const conTAUno = renderSvg(layout)

  // Stesso simbolo (stesso `<path` di valvolaIntercettazione), ma non nello stesso punto:
  // altrimenti `t` non conterebbe nulla.
  expect(conTAZero).not.toBe(conTAUno)
})
```

- [ ] **Step 2: Eseguire e verificare il rosso**

Run: `npx vitest run src/services/schemaImpianto/__tests__/buildSchemaModel.test.ts src/services/schemaImpianto/__tests__/renderSvg.test.ts > ../../../../.superpowers/sdd/2026-08-12-schema-impianto-utenze-legenda/task-b5-rosso.txt 2>&1`

Expected: FAIL sui test nuovi (nessun `segni` seminato, `renderArchi` non li legge ancora), e i test del Task 4 rimasti rossi ora nel report devono comparire ancora rossi qui (li chiude questo task, verificalo nel giro verde).

- [ ] **Step 3: Implementare**

In `src/services/schemaImpianto/buildSchemaModel.ts`, dentro `buildArchi` (riga 257-323), semina il segno sugli archi flessibili (mandata compressore→serbatoio, riga 264-270) e su quelli standard di linea (riga 276-289). Aggiungi un contatore dedicato e una funzione di comodo subito sopra `buildArchi`:

```ts
let contatoreSegni = 0
function segnoValvolaDiDefault(): SchemaSegnoTubo[] {
  return [{ id: `segno-${++contatoreSegni}`, tipo: 'valvola_intercettazione', t: 0.5 }]
}
```

Nota: il contatore va dichiarato **dentro** `buildArchi` (non a livello di modulo) o due chiamate successive a `buildSchemaModel` nella stessa sessione del processo produrrebbero id crescenti fra chiamate diverse — innocuo per l'id in sé (`identitaArco` in `persistenza.ts` non lo usa) ma non necessario e sorprendente nei test. Dichiaralo subito dopo `let contatore = 0` (riga 259) e passa `prossimoId` come prefisso, riusando lo stesso schema:

```ts
function buildArchi(nodi: SchemaNodo[], input: BuildSchemaModelInput, raccoltaCondense: SchemaNodo | null): SchemaArco[] {
  const archi: SchemaArco[] = []
  let contatore = 0
  const prossimoId = (prefisso: string) => `${prefisso}-${++contatore}`
  const segnoValvolaDiDefault = (): SchemaSegnoTubo[] => [
    { id: prossimoId('segno'), tipo: 'valvola_intercettazione', t: 0.5 },
  ]

  for (const [compressoreId, serbatoiIds] of Object.entries(input.collegamentiCompressoriSerbatoi)) {
    for (const serbatoioId of serbatoiIds) {
      archi.push({
        id: prossimoId('flex'),
        da: { nodo: compressoreId, ancora: 'alto-out' },
        a: { nodo: serbatoioId, ancora: 'sx' },
        stile: 'flessibile',
        segni: segnoValvolaDiDefault(),
      })
    }
  }

  const catenaLinea = ordinaCatenaTrattamento(nodi, raccoltaCondense)
  const serbatoiChiave = nodi.filter((n) => n.tipo === 'serbatoio').map((n) => n.id)
  if (catenaLinea.length > 0 && serbatoiChiave.length > 0) {
    archi.push({
      id: prossimoId('std'),
      da: { nodo: serbatoiChiave[0], ancora: 'dx' },
      a: { nodo: catenaLinea[0].id, ancora: 'sx' },
      stile: 'standard',
      segni: segnoValvolaDiDefault(),
    })
    for (let i = 0; i < catenaLinea.length - 1; i++) {
      archi.push({
        id: prossimoId('std'),
        da: { nodo: catenaLinea[i].id, ancora: 'dx' },
        a: { nodo: catenaLinea[i + 1].id, ancora: 'sx' },
        stile: 'standard',
        segni: segnoValvolaDiDefault(),
      })
    }
  }
  // ... l'arco verso ID_UTENZE e quelli 'condensa' restano SENZA `segni`: invariati.
```

Non serve toccare l'arco verso `ID_UTENZE` (riga 296-302, stile `'standard'` ma senza valvola prima e senza ora — il terminale ha già il proprio codolo) né gli archi condensa (riga 304-320). Aggiungi l'import di `SchemaSegnoTubo` in testa al file.

In `src/services/schemaImpianto/renderSvg.ts`:

1. Importa `puntoSuTratto` da `./tratti` (riga 19, accanto a `ondula`) e `riduttorePressione` (già importata dal Task 4).
2. Togli la riga della valvola d'ufficio da `renderMandataCompressore` (riga 126): `const svg = linea + valvolaIntercettazione(pDa.x, pDa.y - 62, 'verticale')` diventa `const svg = linea`.
3. Togli la riga corrispondente da `renderMandataLinea` (riga 152-154):

```ts
  const svg = `<path d="${percorso(punti)}" fill="none" stroke="#000" stroke-width="${TRATTO}"${freccia} />`
```

4. In `renderArchi` (riga 186-215), disegna i segni dopo aver calcolato `reso`:

```ts
function renderArchi(
  layout: SchemaLayout,
  yCorsiaCondense: number,
  yCollettore: number
): { svg: string; varchi: number[] } {
  const indice = new Map(layout.nodi.map((n) => [n.id, n]))
  const parti: string[] = []
  const varchi: number[] = []

  for (const arco of layout.archi) {
    const da = indice.get(arco.da.nodo)
    const a = indice.get(arco.a.nodo)
    if (!da || !a) continue

    const reso =
      arco.stile === 'condensa'
        ? renderLineaCondense(da, arco.da.ancora, a, arco.a.ancora, yCorsiaCondense, arco.punti)
        : arco.stile === 'flessibile'
          ? renderMandataCompressore(da, arco.da.ancora, a, arco.a.ancora, yCollettore, arco.punti)
          : renderMandataLinea(da, arco.da.ancora, a, arco.a.ancora, arco.punti, a.tipo !== 'utenze')

    parti.push(reso.svg)
    for (const segno of arco.segni ?? []) {
      const { punto, orizzontale } = puntoSuTratto(reso.punti, segno.t)
      const disegnaSegno = segno.tipo === 'riduttore_pressione' ? riduttorePressione : valvolaIntercettazione
      parti.push(disegnaSegno(punto.x, punto.y, orizzontale ? 'orizzontale' : 'verticale'))
    }
    if (layout.muro) varchi.push(...quoteAttraversamento(reso.punti, layout.muro.x))
  }

  return { svg: parti.join(''), varchi }
}
```

Il commento sopra `renderArchi` (righe 185, 195-197) parlava della doppia punta di freccia sul terminale: resta valido e non lo tocchi; aggiungi una riga che spiega che i segni si disegnano qui, non nelle funzioni `renderMandata*`, perché la loro posizione dipende dalla polilinea RESA (`reso.punti`), non da quella richiesta.

- [ ] **Step 4: Eseguire e verificare il verde**

Run: `npx vitest run src/services/schemaImpianto/__tests__/buildSchemaModel.test.ts src/services/schemaImpianto/__tests__/renderSvg.test.ts src/services/schemaImpianto/__tests__/simboli.test.ts > ../../../../.superpowers/sdd/2026-08-12-schema-impianto-utenze-legenda/task-b5-verde.txt 2>&1`

Expected: PASS, incluso ogni test lasciato rosso dal Task 4.

Run: `npx vitest run src/services/schemaImpianto > ../../../../.superpowers/sdd/2026-08-12-schema-impianto-utenze-legenda/task-b5-modulo.txt 2>&1` — tutto il modulo verde (`layout.test.ts`/`persistenza.test.ts` potrebbero avere fixture che confrontano `archi` con `toEqual`: se cadono per il nuovo campo `segni`, aggiornale nello stesso commit, sono adeguamenti meccanici).

Run: `npx tsc --noEmit > ../../../../.superpowers/sdd/2026-08-12-schema-impianto-utenze-legenda/task-b5-tsc.txt 2>&1` — pulito.

- [ ] **Step 5: Commit**

```bash
git add src/services/schemaImpianto/buildSchemaModel.ts src/services/schemaImpianto/renderSvg.ts src/services/schemaImpianto/__tests__/buildSchemaModel.test.ts src/services/schemaImpianto/__tests__/renderSvg.test.ts
git commit -m "feat(schema-impianto): la valvola di intercettazione diventa un segno seminato, non più disegnata d'ufficio"
```

---

### Task 6: I segni attraversano `conversioneFlow`

**Files:**
- Modify: `src/components/schemaImpianto/conversioneFlow.ts`
- Modify: `src/components/schemaImpianto/SchemaEdgeTubazione.tsx` (solo `SchemaEdgeData`)
- Modify: `src/components/schemaImpianto/__tests__/conversioneFlow.test.ts`

**Interfaces:**
- Consumes: `SchemaSegnoTubo` (Task 3).
- Produces: `SchemaEdgeData.segni?: SchemaSegnoTubo[]`. `layoutAFlow`/`flowALayout` portano `segni` avanti e indietro come già fanno con `punti`.

- [ ] **Step 1: Estendere il test dell'andata e ritorno**

In `src/components/schemaImpianto/__tests__/conversioneFlow.test.ts`, aggiungi un segno alla fixture `layoutDiProva` (nell'arco esistente) e un'asserzione dedicata:

```ts
// Nella funzione layoutDiProva(), nell'arco 'std-1':
        stile: 'flessibile',
        punti: [{ x: 300, y: 260 }],
        segni: [{ id: 'v1', tipo: 'valvola_intercettazione', t: 0.5 }],
```

```ts
it('l’andata e ritorno conserva anche i segni sulla tubazione', () => {
  const layout = layoutDiProva()
  const { nodes, edges } = layoutAFlow(layout)
  const tornato = flowALayout(nodes, edges)

  expect(tornato.archi[0].segni).toEqual(layout.archi[0].segni)
})

it('un arco senza segni torna senza segni, non con un array vuoto inventato', () => {
  const layout = layoutDiProva()
  delete layout.archi[0].segni
  const { nodes, edges } = layoutAFlow(layout)
  const tornato = flowALayout(nodes, edges)

  expect(tornato.archi[0].segni).toBeUndefined()
})
```

Il primo test esistente («l'andata e ritorno conserva ancore, punti e stile», che usa `toEqual` sull'intero `tornato.archi`) coprirebbe già `segni` una volta che la fixture lo contiene — verificalo dopo l'implementazione, non serve duplicarlo.

- [ ] **Step 2: Eseguire e verificare il rosso**

Run: `npx vitest run src/components/schemaImpianto/__tests__/conversioneFlow.test.ts > ../../../../.superpowers/sdd/2026-08-12-schema-impianto-utenze-legenda/task-b6-rosso.txt 2>&1`

Expected: FAIL — `layoutAFlow` non scrive `segni` in `data`, `flowALayout` non lo rilegge.

- [ ] **Step 3: Implementare**

In `src/components/schemaImpianto/SchemaEdgeTubazione.tsx`, estendi `SchemaEdgeData` (riga 15-25):

```ts
export interface SchemaEdgeData extends Record<string, unknown> {
  stile: SchemaArcoStile
  /** Gomiti imposti a mano, in coordinate assolute: disegnano la polilinea imposta. */
  punti?: { x: number; y: number }[]
  /** Valvole di intercettazione e riduttori di pressione posati sul tratto. */
  segni?: SchemaSegnoTubo[]
  onSpostaGomito?: (indice: number, posizione: { x: number; y: number }, concluso: boolean) => void
  onRimuoviGomito?: (indice: number) => void
}
```

Aggiungi l'import di `SchemaSegnoTubo` dal tipo condiviso (riga 13: `import type { SchemaArcoStile, SchemaSegnoTubo } from '@/services/schemaImpianto/types'`).

In `src/components/schemaImpianto/conversioneFlow.ts`, aggiorna `layoutAFlow` (riga 25-33):

```ts
  const edges: Edge[] = layout.archi.map((arco) => ({
    id: arco.id,
    source: arco.da.nodo,
    target: arco.a.nodo,
    sourceHandle: arco.da.ancora,
    targetHandle: arco.a.ancora,
    type: TIPO_ARCO_FLOW,
    data: { stile: arco.stile, punti: arco.punti, segni: arco.segni } satisfies SchemaEdgeData,
  }))
```

E `flowALayout` (riga 43-60):

```ts
export function flowALayout(nodes: Node[], edges: Edge[]): SchemaLayout {
  const nodi: SchemaNodoPosizionato[] = nodes.map((n) => ({
    ...(n.data as SchemaNodeData).nodo,
    x: n.position.x,
    y: n.position.y,
  }))
  return {
    nodi,
    archi: edges.map((e) => ({
      id: e.id,
      da: { nodo: e.source, ancora: e.sourceHandle ?? '' },
      a: { nodo: e.target, ancora: e.targetHandle ?? '' },
      stile: ((e.data as SchemaEdgeData | undefined)?.stile ?? 'standard') as SchemaArcoStile,
      punti: (e.data as SchemaEdgeData | undefined)?.punti,
      segni: (e.data as SchemaEdgeData | undefined)?.segni,
    })),
    muro: calcolaMuro(nodi),
  }
}
```

- [ ] **Step 4: Eseguire e verificare il verde**

Run: `npx vitest run src/components/schemaImpianto/__tests__/conversioneFlow.test.ts > ../../../../.superpowers/sdd/2026-08-12-schema-impianto-utenze-legenda/task-b6-verde.txt 2>&1`

Expected: PASS.

Run: `npx tsc --noEmit > ../../../../.superpowers/sdd/2026-08-12-schema-impianto-utenze-legenda/task-b6-tsc.txt 2>&1` — pulito.

- [ ] **Step 5: Commit**

```bash
git add src/components/schemaImpianto/conversioneFlow.ts src/components/schemaImpianto/SchemaEdgeTubazione.tsx src/components/schemaImpianto/__tests__/conversioneFlow.test.ts
git commit -m "feat(schema-impianto): i segni sulla tubazione attraversano conversioneFlow"
```

---

### Task 7: I segni nell'editor — disegno, aggiunta, trascinamento, rimozione

Task più grande del blocco: disegnare i segni sull'arco nell'editor, farli trascinare lungo il tubo (cambia solo `t`), toglierli con doppio clic, e due pulsanti in barra per aggiungerne uno alla tubazione selezionata. Un solo task perché le quattro parti si verificano solo insieme (non ha senso trascinare un segno che non si disegna).

**Files:**
- Create: `src/components/schemaImpianto/useSegniTubo.ts`
- Modify: `src/components/schemaImpianto/SchemaEdgeTubazione.tsx` (componente `SchemaSegno`, disegno dei segni)
- Modify: `src/components/schemaImpianto/SchemaEditor.tsx` (pulsanti «+ Valvola»/«+ Riduttore», cablaggio dell'hook)
- Create: `src/components/schemaImpianto/__tests__/useSegniTubo.test.ts` (solo la parte pura: la funzione di aggiunta/rimozione, non gli eventi puntatore — quelli si verificano in pagina)

**Interfaces:**
- Consumes: `SchemaSegnoTubo`, `tSuTratto`, `puntoSuTratto` (Task 3), `SchemaEdgeData.segni` (Task 6), `riduttorePressione`/`valvolaIntercettazione` (Task 4).
- Produces: `useSegniTubo<T extends {nodes,edges}>(stato: T, applica, aggiornaSenzaCronologia): { aggiungiSegno(arcoId: string, tipo: SchemaSegnoTuboTipo): void; edgesConSegni: Edge[] }` — stesso pattern di `useGomiti`. Consumato da `SchemaEditor.tsx`.

- [ ] **Step 1: Scrivere il test della parte pura**

`useSegniTubo` mescola stato React e geometria pura; isola quest'ultima in una funzione esportata a parte così si testa senza render. Crea `src/components/schemaImpianto/__tests__/useSegniTubo.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { segnoAggiunto, segniSenzaIndice } from '../useSegniTubo'

describe('segnoAggiunto', () => {
  it('aggiunge un segno a metà tratto con un id nuovo', () => {
    const risultato = segnoAggiunto([{ id: 'v1', tipo: 'valvola_intercettazione', t: 0.2 }], 'riduttore_pressione')
    expect(risultato).toHaveLength(2)
    expect(risultato[1]).toMatchObject({ tipo: 'riduttore_pressione', t: 0.5 })
    expect(risultato[1].id).not.toBe('v1')
  })

  it('parte da un arco senza segni', () => {
    const risultato = segnoAggiunto(undefined, 'valvola_intercettazione')
    expect(risultato).toHaveLength(1)
  })
})

describe('segniSenzaIndice', () => {
  it('toglie solo il segno all’indice indicato', () => {
    const segni = [
      { id: 'a', tipo: 'valvola_intercettazione' as const, t: 0.2 },
      { id: 'b', tipo: 'riduttore_pressione' as const, t: 0.6 },
    ]
    expect(segniSenzaIndice(segni, 0)).toEqual([segni[1]])
  })
})
```

- [ ] **Step 2: Eseguire e verificare il rosso**

Run: `npx vitest run src/components/schemaImpianto/__tests__/useSegniTubo.test.ts > ../../../../.superpowers/sdd/2026-08-12-schema-impianto-utenze-legenda/task-b7-rosso.txt 2>&1`

Expected: FAIL — il file `useSegniTubo.ts` non esiste.

- [ ] **Step 3: Implementare**

Crea `src/components/schemaImpianto/useSegniTubo.ts`, sul modello di `useGomiti.ts` (stessa tripletta `stato`/`applica`/`aggiornaSenzaCronologia`, stesso pattern di `edgesConGomiti`):

```ts
/**
 * Segni che vivono sulla tubazione (valvole di intercettazione, riduttori di pressione):
 * aggiungerli da un pulsante di barra, trascinarli lungo il tratto (cambia solo `t`),
 * toglierli con un doppio clic. Isolato dall'editor per lo stesso motivo di useGomiti.ts.
 */
import { useCallback, useMemo, useRef } from 'react'
import { useReactFlow, type Edge, type Node } from '@xyflow/react'
import type { SchemaSegnoTubo, SchemaSegnoTuboTipo } from '@/services/schemaImpianto/types'
import type { SchemaEdgeData } from './SchemaEdgeTubazione'

interface StatoConNodiEdArchi {
  nodes: Node[]
  edges: Edge[]
}

type Aggiorna<T> = (prossimo: T | ((corrente: T) => T)) => void

let contatoreSegni = 0

/** Segno nuovo a metà del tratto: punto di partenza pratico, l'utente lo trascina da lì. */
export function segnoAggiunto(esistenti: SchemaSegnoTubo[] | undefined, tipo: SchemaSegnoTuboTipo): SchemaSegnoTubo[] {
  return [...(esistenti ?? []), { id: `segno-editor-${++contatoreSegni}`, tipo, t: 0.5 }]
}

export function segniSenzaIndice(segni: SchemaSegnoTubo[], indice: number): SchemaSegnoTubo[] {
  return segni.filter((_, i) => i !== indice)
}

export function useSegniTubo<T extends StatoConNodiEdArchi>(
  stato: T,
  applica: Aggiorna<T>,
  aggiornaSenzaCronologia: Aggiorna<T>
) {
  const { screenToFlowPosition } = useReactFlow()

  // Un gesto solo (un clic sul pulsante): sempre in cronologia, come creare un gomito.
  const aggiungiSegno = useCallback(
    (arcoId: string, tipo: SchemaSegnoTuboTipo) => {
      applica((s) => ({
        ...s,
        edges: s.edges.map((e) =>
          e.id !== arcoId
            ? e
            : {
                ...e,
                data: {
                  ...(e.data as SchemaEdgeData),
                  segni: segnoAggiunto((e.data as SchemaEdgeData).segni, tipo),
                } satisfies SchemaEdgeData,
              }
        ),
      }))
    },
    [applica]
  )

  // Stesso principio del trascinamento del gomito: il PRIMO evento del gesto entra in
  // cronologia, i successivi no (vedi useGomiti.ts, spostaGomito).
  const trascinamentoSegnoAvviato = useRef(false)

  const spostaSegno = useCallback(
    (arcoId: string, indice: number, nuovaT: number, concluso: boolean) => {
      const primoEventoDelGesto = !trascinamentoSegnoAvviato.current
      trascinamentoSegnoAvviato.current = !concluso
      const aggiorna = primoEventoDelGesto ? applica : aggiornaSenzaCronologia
      aggiorna((s) => ({
        ...s,
        edges: s.edges.map((e) => {
          if (e.id !== arcoId) return e
          const segni = [...((e.data as SchemaEdgeData).segni ?? [])]
          if (!segni[indice]) return e
          segni[indice] = { ...segni[indice], t: Math.max(0, Math.min(1, nuovaT)) }
          return { ...e, data: { ...(e.data as SchemaEdgeData), segni } satisfies SchemaEdgeData }
        }),
      }))
    },
    [applica, aggiornaSenzaCronologia]
  )

  const rimuoviSegno = useCallback(
    (arcoId: string, indice: number) => {
      applica((s) => ({
        ...s,
        edges: s.edges.map((e) => {
          if (e.id !== arcoId) return e
          const segni = segniSenzaIndice((e.data as SchemaEdgeData).segni ?? [], indice)
          return { ...e, data: { ...(e.data as SchemaEdgeData), segni } satisfies SchemaEdgeData }
        }),
      }))
    },
    [applica]
  )

  const edgesConSegni = useMemo(
    () =>
      stato.edges.map((e) => ({
        ...e,
        data: {
          ...(e.data as SchemaEdgeData),
          onSpostaSegno: (indice: number, punto: { x: number; y: number }, concluso: boolean) => {
            // La conversione punto->t la fa SchemaEdgeTubazione (conosce la polilinea resa);
            // qui arriva già la `t`, non un punto schermo. Vedi il Task 8: onSpostaSegno
            // riceve `t` direttamente, non screenToFlowPosition — screenToFlowPosition serve
            // solo dentro SchemaEdgeTubazione per tradurre l'evento puntatore in coordinate
            // flow prima di proiettarle sulla polilinea con tSuTratto.
            void punto
            spostaSegno(e.id, indice, 0, concluso)
          },
          onRimuoviSegno: (indice: number) => rimuoviSegno(e.id, indice),
        } satisfies SchemaEdgeData,
      })),
    [stato.edges, spostaSegno, rimuoviSegno]
  )

  return { aggiungiSegno, spostaSegno, edgesConSegni, screenToFlowPosition }
}
```

**Correzione da fare mentre implementi**: la bozza sopra ha un `onSpostaSegno` placeholder che non torna bene (passa `0` invece della `t` vera, e il commento lo ammette). La ragione è che `tSuTratto` ha bisogno della polilinea RESA (con gomiti e ancore), che `useSegniTubo` non ha — la conosce solo `SchemaEdgeTubazione`, che la calcola già per disegnare. **Sposta quindi il calcolo di `t` dentro `SchemaEdgeTubazione`** (Step successivo, componente `SchemaSegno`): `onSpostaSegno` esposto da questo hook deve avere firma `(indice: number, t: number, concluso: boolean) => void` e basta, senza `screenToFlowPosition` né conversione qui. Riscrivi `edgesConSegni` di conseguenza:

```ts
  const edgesConSegni = useMemo(
    () =>
      stato.edges.map((e) => ({
        ...e,
        data: {
          ...(e.data as SchemaEdgeData),
          onSpostaSegno: (indice: number, t: number, concluso: boolean) => spostaSegno(e.id, indice, t, concluso),
          onRimuoviSegno: (indice: number) => rimuoviSegno(e.id, indice),
        } satisfies SchemaEdgeData,
      })),
    [stato.edges, spostaSegno, rimuoviSegno]
  )

  return { aggiungiSegno, edgesConSegni }
```

E togli `useReactFlow`/`screenToFlowPosition` dall'hook (non servono più qui): l'import di `useReactFlow` va rimosso.

Estendi `SchemaEdgeData` (già fatto nel Task 6) con le due callback:

```ts
  onSpostaSegno?: (indice: number, t: number, concluso: boolean) => void
  onRimuoviSegno?: (indice: number) => void
```

In `src/components/schemaImpianto/SchemaEdgeTubazione.tsx`, aggiungi il componente `SchemaSegno` (sul modello di `SchemaGomito`, righe 49-125) subito dopo `SchemaGomito`:

```ts
interface SchemaSegnoProps {
  indice: number
  punto: { x: number; y: number }
  tipo: SchemaSegnoTuboTipo
  polilinea: Punto[]
  onSposta?: (indice: number, t: number, concluso: boolean) => void
  onRimuovi?: (indice: number) => void
}

/** Maniglia di un segno (valvola o riduttore): trascinarla cambia `t`, non la posizione
 *  assoluta — proietta il punto del puntatore sulla polilinea con `tSuTratto`, così il segno
 *  resta sempre SUL tubo anche se lo si trascina un po' fuori. */
function SchemaSegno({ indice, punto, tipo, polilinea, onSposta, onRimuovi }: SchemaSegnoProps) {
  const { screenToFlowPosition } = useReactFlow()
  const mossoRef = useRef(false)

  const suPointerDown = useCallback((e: React.PointerEvent<SVGGElement>) => {
    e.stopPropagation()
    mossoRef.current = false
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [])

  const suPointerMove = useCallback(
    (e: React.PointerEvent<SVGGElement>) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
      e.stopPropagation()
      mossoRef.current = true
      const libero = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      onSposta?.(indice, tSuTratto(polilinea, libero), false)
    },
    [indice, onSposta, polilinea, screenToFlowPosition]
  )

  const suPointerUp = useCallback(
    (e: React.PointerEvent<SVGGElement>) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
      e.stopPropagation()
      e.currentTarget.releasePointerCapture(e.pointerId)
      if (mossoRef.current) {
        const libero = screenToFlowPosition({ x: e.clientX, y: e.clientY })
        onSposta?.(indice, tSuTratto(polilinea, libero), true)
      }
    },
    [indice, onSposta, polilinea, screenToFlowPosition]
  )

  const suDoppioClic = useCallback(
    (e: React.MouseEvent<SVGGElement>) => {
      e.stopPropagation()
      onRimuovi?.(indice)
    },
    [indice, onRimuovi]
  )

  const disegna = tipo === 'riduttore_pressione' ? riduttorePressione : valvolaIntercettazione

  return (
    <g
      className="nopan"
      onPointerDown={suPointerDown}
      onPointerMove={suPointerMove}
      onPointerUp={suPointerUp}
      onDoubleClick={suDoppioClic}
      style={{ cursor: 'move', pointerEvents: 'all' }}
      dangerouslySetInnerHTML={{ __html: disegna(punto.x, punto.y) }}
    />
  )
}
```

Nota: `<g dangerouslySetInnerHTML>` su SVG funziona come su HTML in React 18. Se preferisci evitarlo per coerenza con `SchemaGomito` (che non lo usa), disegna un piccolo cerchio interattivo trasparente sovrapposto al simbolo invece di iniettarne l'HTML — ma allora il simbolo vero va reso separatamente (non interattivo) e il cerchio serve solo da maniglia. Scegli la prima forma (più semplice, un solo elemento) a meno che la revisione non trovi un problema concreto con `dangerouslySetInnerHTML` su un nodo `<g>` in questo contesto (i simboli passano già da `escapeXml` sulle etichette, e qui non c'è etichetta).

Aggiungi gli import necessari in testa al file: `type SchemaSegnoTubo, type Punto` da `@/services/schemaImpianto/types`/`./tratti` (verifica dove vive `Punto` — è esportato da `tratti.ts`), `riduttorePressione, valvolaIntercettazione, tSuTratto` da `@/services/schemaImpianto/symbols` e `.../tratti`.

Nel componente `SchemaEdgeTubazione` (righe 127-205), dopo aver calcolato `polilinea` (riga 152), disegna i segni dentro `EdgeLabelRenderer`, accanto ai gomiti:

```tsx
        {(edgeData?.segni ?? []).map((segno, indice) => {
          const { punto } = puntoSuTratto(polilinea, segno.t)
          return (
            <SchemaSegno
              key={`${id}-segno-${indice}`}
              indice={indice}
              punto={punto}
              tipo={segno.tipo}
              polilinea={polilinea}
              onSposta={edgeData?.onSpostaSegno}
              onRimuovi={edgeData?.onRimuoviSegno}
            />
          )
        })}
```

**Attenzione**: `SchemaSegno` qui sopra è un `<g>` posizionato in coordinate ASSOLUTE del flow (`punto.x`/`punto.y`, dagli stessi assi di `sourceX`/`targetX`), mentre `EdgeLabelRenderer` di react-flow traduce i suoi figli in coordinate SCHERMO tramite `transform: translate(...)` — esattamente come fa già `SchemaGomito` (righe 112-114: `transform: translate(-50%, -50%) translate(${punto.x}px, ${punto.y}px)`), ma quello è un `<div>` fuori dall'SVG (`EdgeLabelRenderer` monta i figli in un layer HTML separato, non dentro il `<svg>`). Un `<g>` con `dangerouslySetInnerHTML` di un frammento SVG **non funziona dentro `EdgeLabelRenderer`** (non è SVG lì dentro). Correggi così: disegna `SchemaSegno` come un `<div>` con `transform`, esattamente come `SchemaGomito`, e dentro usa un `<svg>` piccolo (stile `position:absolute`, `overflow: visible`) che ospita il simbolo via `dangerouslySetInnerHTML` centrato sull'origine — il simbolo (`valvolaIntercettazione`/`riduttorePressione`) è già parametrico su `x`/`y`, quindi chiamalo con `(0, 0)` e trasla il contenitore, non il simbolo:

```tsx
function SchemaSegno({ indice, punto, tipo, polilinea, onSposta, onRimuovi }: SchemaSegnoProps) {
  const { screenToFlowPosition } = useReactFlow()
  const mossoRef = useRef(false)

  const suPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation()
    mossoRef.current = false
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [])

  const suPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
      e.stopPropagation()
      mossoRef.current = true
      const libero = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      onSposta?.(indice, tSuTratto(polilinea, libero), false)
    },
    [indice, onSposta, polilinea, screenToFlowPosition]
  )

  const suPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
      e.stopPropagation()
      e.currentTarget.releasePointerCapture(e.pointerId)
      if (mossoRef.current) {
        const libero = screenToFlowPosition({ x: e.clientX, y: e.clientY })
        onSposta?.(indice, tSuTratto(polilinea, libero), true)
      }
    },
    [indice, onSposta, polilinea, screenToFlowPosition]
  )

  const suDoppioClic = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.stopPropagation()
      onRimuovi?.(indice)
    },
    [indice, onRimuovi]
  )

  const disegna = tipo === 'riduttore_pressione' ? riduttorePressione : valvolaIntercettazione

  return (
    <div
      className="nopan"
      onPointerDown={suPointerDown}
      onPointerMove={suPointerMove}
      onPointerUp={suPointerUp}
      onDoubleClick={suDoppioClic}
      style={{
        position: 'absolute',
        transform: `translate(-50%, -50%) translate(${punto.x}px, ${punto.y}px)`,
        width: 40,
        height: 40,
        cursor: 'move',
        pointerEvents: 'all',
      }}
    >
      <svg width={40} height={40} viewBox="-20 -20 40 40" style={{ overflow: 'visible' }} dangerouslySetInnerHTML={{ __html: disegna(0, 0) }} />
    </div>
  )
}
```

Questa è la versione da tenere (sostituisce il primo tentativo con `<g>`, che non funziona dentro `EdgeLabelRenderer`). Aggiorna il JSX di rendering nel componente principale di conseguenza (resta uguale a quanto scritto sopra, `SchemaSegno` ora è un `<div>`).

In `src/components/schemaImpianto/SchemaEditor.tsx`, cablaggio:

1. Importa `useSegniTubo` e il tipo `SchemaSegnoTuboTipo`.
2. Dopo la riga dell'hook `useGomiti` (riga 214), aggiungi:

```ts
  const { aggiungiSegno, edgesConSegni } = useSegniTubo(stato, applica, aggiornaSenzaCronologia)
```

3. `edgesConGomiti` e `edgesConSegni` derivano ENTRAMBI da `stato.edges` con dati aggiuntivi diversi (uno aggiunge `onSpostaGomito`/`onRimuoviGomito`, l'altro `onSpostaSegno`/`onRimuoviSegno`) — **vanno fusi**, non passati entrambi a `<ReactFlow edges={...}>` (il secondo sovrascriverebbe il primo). Cambia la firma di `useGomiti`/`useSegniTubo` non serve: più semplice comporli qui:

```ts
  const edgesConGomiti = useMemo(
    () =>
      edgesConGomitiBase.map((e, i) => ({
        ...e,
        data: { ...e.data, ...edgesConSegni[i]?.data } as SchemaEdgeData,
      })),
    [edgesConGomitiBase, edgesConSegni]
  )
```

Per farlo pulito, rinomina la destrutturazione di `useGomiti` da `edgesConGomiti` a `edgesConGomitiBase` (riga 214) e aggiungi il `useMemo` sopra subito dopo la riga di `useSegniTubo`. Importa `useMemo` se non già in uso (è già importato, riga 7).

4. Aggiungi i due pulsanti in barra, dopo il gruppo «Tubazione:» (dopo riga 510, prima del `<Divider>` che segue):

```tsx
        <Divider orientation="vertical" flexItem />

        <Typography variant="caption" color="text.secondary">
          Segni:
        </Typography>
        <Button
          size="small"
          onClick={() => selezione.edges[0] && aggiungiSegno(selezione.edges[0].id, 'valvola_intercettazione')}
          disabled={selezione.edges.length !== 1}
        >
          + Valvola
        </Button>
        <Button
          size="small"
          onClick={() => selezione.edges[0] && aggiungiSegno(selezione.edges[0].id, 'riduttore_pressione')}
          disabled={selezione.edges.length !== 1}
        >
          + Riduttore
        </Button>
```

5. Passa `edgesConGomiti` (il risultato fuso) a `<ReactFlow edges={edgesConGomiti} ...>` — il nome resta lo stesso di prima, solo la sua costruzione cambia.

- [ ] **Step 4: Eseguire e verificare il verde**

Run: `npx vitest run src/components/schemaImpianto > ../../../../.superpowers/sdd/2026-08-12-schema-impianto-utenze-legenda/task-b7-verde.txt 2>&1`

Expected: PASS, incluso `useSegniTubo.test.ts`.

Run: `npx tsc --noEmit > ../../../../.superpowers/sdd/2026-08-12-schema-impianto-utenze-legenda/task-b7-tsc.txt 2>&1` — pulito.

**Autorizzazione al browser per QUESTO task**: la logica pura è testata, ma disegno/trascinamento/rimozione dei segni sono interazione DOM che nessun test automatico copre (convenzione del progetto: niente test di UI). Chiedi al controller l'autorizzazione a verificare in pagina prima di dichiarare il task chiuso: aggiungi una valvola e un riduttore alla stessa tubazione, trascina ciascuno lungo il tubo (deve restare appoggiato al tratto, non staccarsi), doppio clic per toglierne uno. **Vietato premere «Genera comunque .docx»**.

- [ ] **Step 5: Commit**

```bash
git add src/components/schemaImpianto/useSegniTubo.ts src/components/schemaImpianto/SchemaEdgeTubazione.tsx src/components/schemaImpianto/SchemaEditor.tsx src/components/schemaImpianto/__tests__/useSegniTubo.test.ts
git commit -m "feat(schema-impianto): i segni sulla tubazione si disegnano, si aggiungono, si trascinano e si tolgono nell'editor"
```

---

### Task 8: La geometria del trascinamento del tratto

Solo geometria pura: relocazione di `raccordoOrtogonale`/`polilineaConGomiti` in `tratti.ts` e la nuova `trascinaTratto`. Nessuna interazione ancora (Task 9).

**Files:**
- Modify: `src/services/schemaImpianto/tratti.ts` (`raccordoOrtogonale`, `polilineaConGomiti`, `trascinaTratto`)
- Modify: `src/services/schemaImpianto/renderSvg.ts` (rimuove le due funzioni spostate, le re-importa)
- Modify: `src/services/schemaImpianto/__tests__/renderSvg.test.ts` (aggiorna l'import di `raccordoOrtogonale`)
- Modify: `src/services/schemaImpianto/__tests__/tratti.test.ts`

**Interfaces:**
- Consumes: `Punto` (già in `tratti.ts`).
- Produces: `raccordoOrtogonale(da: Punto, a: Punto): Punto[]` e `polilineaConGomiti(inizio: Punto, gomiti: Punto[], fine: Punto): Punto[]` (stesse firme di prima, ora esportate da `tratti.ts`); `trascinaTratto(pDa: Punto, gomiti: Punto[], pA: Punto, indiceTratto: number, delta: Punto): Punto[]` — nuovi gomiti dopo aver trascinato il tratto fra i punti `indiceTratto`/`indiceTratto+1` della polilinea RISOLTA. Consumate dal Task 9.

- [ ] **Step 1: Scrivere i test di `trascinaTratto`, prima che esista**

In `src/services/schemaImpianto/__tests__/tratti.test.ts`:

```ts
describe('trascinaTratto', () => {
  it('un tratto orizzontale fra due gomiti trasla entrambi sulla y, la x non cambia', () => {
    const pDa = { x: 0, y: 0 }
    const pA = { x: 300, y: 300 }
    const gomiti = [
      { x: 100, y: 100 },
      { x: 200, y: 100 },
    ]
    // La polilinea risolta è: pDa(0,0) -> raccordo(0,100)? verifichiamolo indirettamente:
    // il tratto orizzontale fra i due gomiti è quello all'indice corretto una volta risolta
    // la polilinea completa — usa polilineaConGomiti per trovarlo, non un indice a occhio.
    const full = polilineaConGomiti(pDa, gomiti, pA)
    const indiceTratto = full.findIndex(
      (p, i) => full[i + 1] && p.y === full[i + 1].y && p.x === 100 && full[i + 1].x === 200
    )
    expect(indiceTratto).toBeGreaterThanOrEqual(0)

    const nuovi = trascinaTratto(pDa, gomiti, pA, indiceTratto, { x: 0, y: 50 })
    // I due gomiti che delimitavano il tratto ora stanno a y=150, x invariate.
    expect(nuovi).toContainEqual({ x: 100, y: 150 })
    expect(nuovi).toContainEqual({ x: 200, y: 150 })
  })

  it('trascinare il tratto che tocca l’ancora Da fa nascere un gomito nuovo, l’ancora non si sposta', () => {
    const pDa = { x: 0, y: 0 }
    const pA = { x: 200, y: 0 }
    // Nessun gomito: full = [pDa, pA] (un solo tratto orizzontale, indice 0).
    const nuovi = trascinaTratto(pDa, [], pA, 0, { x: 0, y: 40 })
    // Un gomito nuovo vicino a pDa (stessa x, nuova y) e uno vicino a pA (stessa x di pA,
    // nuova y): il tratto centrale è quello che si è davvero spostato.
    expect(nuovi.length).toBeGreaterThanOrEqual(1)
    const full = polilineaConGomiti(pDa, nuovi, pA)
    expect(full[0]).toEqual(pDa)
    expect(full[full.length - 1]).toEqual(pA)
    // Nessun punto della nuova polilinea è alla y originale in mezzo al tracciato: il tratto
    // dritto centrale è salito di 40.
    const centrali = full.slice(1, -1)
    expect(centrali.some((p) => p.y === 40)).toBe(true)
  })

  it('un indice fuori range non tocca i gomiti', () => {
    const pDa = { x: 0, y: 0 }
    const pA = { x: 100, y: 100 }
    const gomiti = [{ x: 50, y: 50 }]
    expect(trascinaTratto(pDa, gomiti, pA, 99, { x: 10, y: 10 })).toEqual(gomiti)
  })
})
```

- [ ] **Step 2: Eseguire e verificare il rosso**

Run: `npx vitest run src/services/schemaImpianto/__tests__/tratti.test.ts > ../../../../.superpowers/sdd/2026-08-12-schema-impianto-utenze-legenda/task-b8-rosso.txt 2>&1`

Expected: FAIL — `polilineaConGomiti`/`trascinaTratto` non sono ancora esportate da `tratti.ts` (oggi `polilineaConGomiti` è locale a `renderSvg.ts`).

- [ ] **Step 3: Implementare**

In `src/services/schemaImpianto/tratti.ts`, aggiungi (dopo `Punto`, prima di `ondula` o dopo — l'ordine non conta, mantieni i commenti di testa esistenti):

```ts
/**
 * Raccorda due punti con due tratti ortogonali. Il verso lo decide la distanza maggiore:
 * si esce nella direzione in cui c'è più strada, che è il modo in cui si instrada a mano.
 * Spostata qui da `renderSvg.ts` perché la usa anche l'editor (routing unificato, vedi
 * `trascinaTratto` più sotto), non solo il render statico.
 */
export function raccordoOrtogonale(da: Punto, a: Punto): Punto[] {
  if (da.x === a.x || da.y === a.y) return [a]
  return Math.abs(a.x - da.x) >= Math.abs(a.y - da.y)
    ? [{ x: a.x, y: da.y }, a]
    : [{ x: da.x, y: a.y }, a]
}

/** Polilinea che parte dall'ancora, tocca i gomiti imposti e arriva all'altra ancora. */
export function polilineaConGomiti(inizio: Punto, gomiti: Punto[], fine: Punto): Punto[] {
  const punti: Punto[] = [inizio]
  let corrente = inizio
  for (const g of [...gomiti, fine]) {
    punti.push(...raccordoOrtogonale(corrente, g))
    corrente = g
  }
  return punti
}

/**
 * Raccordo che preserva l'asse del tratto trascinato: il gomito nuovo (se serve) sta sulla
 * coordinata di `fisso` lungo l'asse perpendicolare al tratto e su quella di `daPreservare`
 * lungo l'asse del tratto — così il tratto appena spostato resta esattamente dov'è stato
 * messo, e solo il moncone che lo ricongiunge al capo fisso si allunga o si accorcia. È
 * diverso da `raccordoOrtogonale`, che sceglie il verso in base alla distanza maggiore: qui
 * il verso è dettato dall'orientamento del tratto trascinato, non da un'euristica.
 */
function raccordaPreservando(fisso: Punto, daPreservare: Punto, orizzontale: boolean): Punto[] {
  const allineato = orizzontale ? fisso.y === daPreservare.y : fisso.x === daPreservare.x
  if (allineato) return [daPreservare]
  const gomito = orizzontale ? { x: fisso.x, y: daPreservare.y } : { x: daPreservare.x, y: fisso.y }
  return [gomito, daPreservare]
}

/**
 * Nuovi gomiti dopo aver trascinato in blocco il tratto dritto fra `full[indiceTratto]` e
 * `full[indiceTratto+1]`, numerazione della polilinea COMPLETA (`polilineaConGomiti`: ancore
 * e gomiti auto-inseriti compresi) di `delta`. Il tratto resta ortogonale per costruzione
 * (`raccordoOrtogonale` lo garantisce a monte): si sposta la sola coordinata condivisa dai
 * due capi (y se il tratto è orizzontale, x se verticale) e si ricongiungono i vicini — è il
 * modo in cui «i gomiti ai capi si aggiustano da soli»: se un capo tocca un'ancora, ne nasce
 * uno nuovo lì vicino (l'ancora non si sposta mai); se tocca già un gomito, quel gomito
 * trasla e basta, perché `raccordaPreservando` lo trova già allineato.
 */
export function trascinaTratto(
  pDa: Punto,
  gomiti: Punto[],
  pA: Punto,
  indiceTratto: number,
  delta: Punto
): Punto[] {
  const full = polilineaConGomiti(pDa, gomiti, pA)
  const a = full[indiceTratto]
  const b = full[indiceTratto + 1]
  if (!a || !b) return gomiti

  const orizzontale = a.y === b.y
  const sposta = (p: Punto): Punto => (orizzontale ? { x: p.x, y: p.y + delta.y } : { x: p.x + delta.x, y: p.y })
  const nuovoA = sposta(a)
  const nuovoB = sposta(b)

  const precedente = full[indiceTratto - 1] ?? pDa
  const successivo = full[indiceTratto + 2] ?? pA

  const nuovaPolilinea: Punto[] = [
    pDa,
    ...full.slice(1, indiceTratto),
    ...raccordaPreservando(precedente, nuovoA, orizzontale),
    nuovoB,
    ...raccordaPreservando(successivo, nuovoB, orizzontale),
    ...full.slice(indiceTratto + 3),
  ]

  return nuovaPolilinea
    .filter((p, i, arr) => i === 0 || p.x !== arr[i - 1].x || p.y !== arr[i - 1].y)
    .slice(1, -1)
}
```

In `src/services/schemaImpianto/renderSvg.ts`, togli le definizioni locali di `raccordoOrtogonale` (riga 54-59) e `polilineaConGomiti` (riga 62-70), e importale da `./tratti` (riga 19):

```ts
import { ondula, raccordoOrtogonale, polilineaConGomiti, type Punto } from './tratti'
```

`raccordoOrtogonale` era già esportata da `renderSvg.ts` (usata dai test con `import { raccordoOrtogonale } from '../renderSvg'`); con questo cambio non lo è più direttamente. In `src/services/schemaImpianto/__tests__/renderSvg.test.ts`, sposta l'import:

```ts
import { raccordoOrtogonale } from '../tratti'
```

(togli `raccordoOrtogonale` dall'elenco importato da `'../renderSvg'` alla riga 14).

- [ ] **Step 4: Eseguire e verificare il verde**

Run: `npx vitest run src/services/schemaImpianto > ../../../../.superpowers/sdd/2026-08-12-schema-impianto-utenze-legenda/task-b8-verde.txt 2>&1`

Expected: PASS, tutto il modulo (la relocazione non deve cambiare alcun output di `renderSvg`, solo dove le funzioni vivono).

Run: `npx tsc --noEmit > ../../../../.superpowers/sdd/2026-08-12-schema-impianto-utenze-legenda/task-b8-tsc.txt 2>&1` — pulito.

- [ ] **Step 5: Commit**

```bash
git add src/services/schemaImpianto/tratti.ts src/services/schemaImpianto/renderSvg.ts src/services/schemaImpianto/__tests__/renderSvg.test.ts src/services/schemaImpianto/__tests__/tratti.test.ts
git commit -m "refactor(schema-impianto): raccordoOrtogonale/polilineaConGomiti in tratti.ts, aggiunge trascinaTratto"
```

---

### Task 9: Il trascinamento del tratto nell'editor

Ultimo task di funzionalità: instradamento unificato (tutti gli stili usano `polilineaConGomiti`, non più `getSmoothStepPath` per rigida/condensa) e il gesto di trascinamento.

**Files:**
- Create: `src/components/schemaImpianto/useTrascinamentoTratto.ts`
- Modify: `src/components/schemaImpianto/SchemaEdgeTubazione.tsx` (routing unificato, area di trascinamento del tratto)
- Modify: `src/components/schemaImpianto/SchemaEditor.tsx` (cablaggio dell'hook, commento corretto)
- Modify: `src/components/schemaImpianto/__tests__/useTrascinamentoTratto.test.ts` (solo la parte pura, come nel Task 7)

**Interfaces:**
- Consumes: `trascinaTratto`, `polilineaConGomiti` (Task 8).
- Produces: `useTrascinamentoTratto<T>(stato, applica, aggiornaSenzaCronologia): { edgesConTrascinamento: Edge[] }` con la stessa tripletta di cronologia degli altri hook.

- [ ] **Step 1: Scrivere il test della parte pura**

La geometria (`trascinaTratto`) è già testata nel Task 8; qui il test copre solo l'orchestrazione (quale indice di segmento corrisponde a un punto cliccato — riusa la stessa logica di `indiceInserimento` in `useGomiti.ts`, che identifica il segmento più vicino). Crea `src/components/schemaImpianto/__tests__/useTrascinamentoTratto.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { indiceTrattoPiuVicino } from '../useTrascinamentoTratto'

describe('indiceTrattoPiuVicino', () => {
  it('trova il tratto orizzontale quando il clic cade su di esso', () => {
    const full = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ]
    expect(indiceTrattoPiuVicino(full, { x: 50, y: 0 })).toBe(0)
  })

  it('trova il tratto verticale quando il clic cade su quello', () => {
    const full = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ]
    expect(indiceTrattoPiuVicino(full, { x: 100, y: 80 })).toBe(1)
  })
})
```

- [ ] **Step 2: Eseguire e verificare il rosso**

Run: `npx vitest run src/components/schemaImpianto/__tests__/useTrascinamentoTratto.test.ts > ../../../../.superpowers/sdd/2026-08-12-schema-impianto-utenze-legenda/task-b9-rosso.txt 2>&1`

Expected: FAIL — il file non esiste.

- [ ] **Step 3: Implementare**

Crea `src/components/schemaImpianto/useTrascinamentoTratto.ts`:

```ts
/**
 * Trascinamento in blocco di un tratto dritto di tubazione: si afferra un tratto e lo si fa
 * scorrere, i gomiti ai capi si aggiustano da soli (`trascinaTratto`, in tratti.ts). Gesto
 * distinto da quello dei gomiti (useGomiti.ts): lì si crea/sposta/toglie un punto, qui si
 * sposta un intero tratto già esistente fra due punti (ancore o gomiti che siano).
 */
import { useCallback, useMemo, useRef } from 'react'
import { useReactFlow, type Edge, type Node } from '@xyflow/react'
import { trascinaTratto, type Punto } from '@/services/schemaImpianto/tratti'
import type { SchemaEdgeData } from './SchemaEdgeTubazione'

interface StatoConNodiEdArchi {
  nodes: Node[]
  edges: Edge[]
}

type Aggiorna<T> = (prossimo: T | ((corrente: T) => T)) => void

/** Distanza fra un punto e il segmento (proiezione bloccata agli estremi). Stessa formula di
 *  `distanzaDaSegmento` in useGomiti.ts: duplicata qui per non introdurre un accoppiamento
 *  fra due hook che restano concettualmente indipendenti. */
function distanzaDaSegmento(p: Punto, a: Punto, b: Punto): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lunghezzaQuadra = dx * dx + dy * dy
  const t = lunghezzaQuadra === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lunghezzaQuadra))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

/** Indice del tratto (fra `full[i]` e `full[i+1]`) più vicino a un punto. */
export function indiceTrattoPiuVicino(full: Punto[], p: Punto): number {
  let indiceMigliore = 0
  let distanzaMinima = Infinity
  for (let i = 0; i < full.length - 1; i++) {
    const d = distanzaDaSegmento(p, full[i], full[i + 1])
    if (d < distanzaMinima) {
      distanzaMinima = d
      indiceMigliore = i
    }
  }
  return indiceMigliore
}

export function useTrascinamentoTratto<T extends StatoConNodiEdArchi>(
  stato: T,
  applica: Aggiorna<T>,
  aggiornaSenzaCronologia: Aggiorna<T>
) {
  const { screenToFlowPosition } = useReactFlow()

  // Stesso principio di useGomiti.ts: il PRIMO evento del gesto entra in cronologia.
  const trascinamentoAvviato = useRef(false)
  // Punto di riferimento dell'ultimo evento, per calcolare il delta incrementale del prossimo.
  const ultimoPuntoRef = useRef<Punto | null>(null)

  const trascinaSegmento = useCallback(
    (arcoId: string, pDa: Punto, pA: Punto, indiceTratto: number, puntoLibero: Punto, concluso: boolean) => {
      const primoEventoDelGesto = !trascinamentoAvviato.current
      if (primoEventoDelGesto) ultimoPuntoRef.current = puntoLibero
      trascinamentoAvviato.current = !concluso
      const riferimento = ultimoPuntoRef.current ?? puntoLibero
      const delta = { x: puntoLibero.x - riferimento.x, y: puntoLibero.y - riferimento.y }
      ultimoPuntoRef.current = puntoLibero

      const aggiorna = primoEventoDelGesto ? applica : aggiornaSenzaCronologia
      aggiorna((s) => ({
        ...s,
        edges: s.edges.map((e) => {
          if (e.id !== arcoId) return e
          const gomiti = (e.data as SchemaEdgeData).punti ?? []
          const nuovi = trascinaTratto(pDa, gomiti, pA, indiceTratto, delta)
          return { ...e, data: { ...(e.data as SchemaEdgeData), punti: nuovi } satisfies SchemaEdgeData }
        }),
      }))
    },
    [applica, aggiornaSenzaCronologia]
  )

  const edgesConTrascinamento = useMemo(
    () =>
      stato.edges.map((e) => ({
        ...e,
        data: {
          ...(e.data as SchemaEdgeData),
          onTrascinaTratto: (pDa: Punto, pA: Punto, indiceTratto: number, puntoLibero: Punto, concluso: boolean) =>
            trascinaSegmento(e.id, pDa, pA, indiceTratto, puntoLibero, concluso),
        } satisfies SchemaEdgeData,
      })),
    [stato.edges, trascinaSegmento]
  )

  return { edgesConTrascinamento, screenToFlowPosition }
}
```

Estendi `SchemaEdgeData` (in `SchemaEdgeTubazione.tsx`) con:

```ts
  onTrascinaTratto?: (pDa: Punto, pA: Punto, indiceTratto: number, puntoLibero: Punto, concluso: boolean) => void
```

Nel componente `SchemaEdgeTubazione`, sostituisci l'uso di `getSmoothStepPath` (righe 141-162) con il routing unificato:

```ts
export function SchemaEdgeTubazione({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  selected,
  markerEnd,
}: EdgeProps) {
  const { screenToFlowPosition } = useReactFlow()
  const edgeData = data as SchemaEdgeData | undefined
  const stile = (edgeData?.stile ?? 'standard') as SchemaArcoStile
  const pDa: Punto = { x: sourceX, y: sourceY }
  const pA: Punto = { x: targetX, y: targetY }
  const punti = edgeData?.punti ?? []
  // Stessa geometria del render statico (renderSvg.ts): editor e disegno finale concordano
  // sulla forma della linea, angoli netti compresi — non più un'approssimazione a parte.
  const polilinea = polilineaConGomiti(pDa, punti, pA)
  const path = stile === 'flessibile' ? ondula(polilinea) : percorso(polilinea)
  const { punto: puntoEtichetta } = puntoSuTratto(polilinea, 0.5)
  const labelX = puntoEtichetta.x
  const labelY = puntoEtichetta.y
```

(`sourcePosition`/`targetPosition` non servono più: toglili dalla destrutturazione dei props e, se `EdgeProps` li richiede comunque nel tipo, ignorali senza distruggerli — non è necessario destrutturarli per usarli.)

Aggiungi la funzione `percorso` (identica a quella privata di `renderSvg.ts`, riga 46-48) come funzione locale del file o, meglio, spostala anche lei in `tratti.ts` accanto a `polilineaConGomiti` — se la sposti, aggiorna anche `renderSvg.ts` per importarla invece di definirla. Preferisci questa seconda strada: coerente col resto del task.

```ts
// in tratti.ts
export function percorso(punti: Punto[]): string {
  return punti.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
}
```

(in `renderSvg.ts`, togli la definizione locale di `percorso`, riga 46-48, e importala da `./tratti`.)

Dopo `<BaseEdge>`, aggiungi l'area di trascinamento invisibile — un `<path>` largo e trasparente sovrapposto alla polilinea, che intercetta il gesto SOLO quando non cade su un gomito o un segno (quelli fermano la propagazione per conto proprio, come già fanno):

```tsx
      <path
        d={percorso(polilinea)}
        fill="none"
        stroke="transparent"
        strokeWidth={16}
        style={{ cursor: 'move', pointerEvents: stile === 'flessibile' ? 'none' : 'all' }}
        onPointerDown={(e) => {
          e.stopPropagation()
          ;(e.currentTarget as SVGPathElement).setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => {
          if (!(e.currentTarget as SVGPathElement).hasPointerCapture(e.pointerId)) return
          e.stopPropagation()
          const libero = screenToFlowPosition({ x: e.clientX, y: e.clientY })
          const indice = indiceTrattoPiuVicino(polilinea, libero)
          edgeData?.onTrascinaTratto?.(pDa, pA, indice, libero, false)
        }}
        onPointerUp={(e) => {
          if (!(e.currentTarget as SVGPathElement).hasPointerCapture(e.pointerId)) return
          e.stopPropagation()
          ;(e.currentTarget as SVGPathElement).releasePointerCapture(e.pointerId)
          const libero = screenToFlowPosition({ x: e.clientX, y: e.clientY })
          const indice = indiceTrattoPiuVicino(polilinea, libero)
          edgeData?.onTrascinaTratto?.(pDa, pA, indice, libero, true)
        }}
      />
```

**Decisione presa mentre implementi**: sul flessibile l'area di trascinamento è disattivata (`pointerEvents: 'none'`) perché la sua polilinea visibile è l'onda (`ondula(polilinea)`), non `polilinea` stessa — un'area di hit-test sagomata sulla polilinea DRITTA, sovrapposta a un disegno ONDULATO, sposterebbe il tratto in un punto diverso da dove l'utente vede il tubo, ed è peggio di non offrire il gesto lì. **Segnala questa scelta di perimetro nel report**: il flessibile resta trascinabile SOLO nei suoi gomiti (il gesto esistente), non nel tratto. Se il committente lo trova limitante in verifica, si riapre — non è nel piano perché la spec del blocco parla di «tratto dritto», e l'onda non lo è.

Aggiorna il commento di testa al file (righe 1-9): non parla più di rinunciare a `smoothstep` solo per il flessibile — ora nessuno stile lo usa. Riscrivilo per dire che tutti gli stili condividono `polilineaConGomiti` col render statico, e che è quella condivisione a rendere possibile trascinare un tratto con la certezza che sia lo stesso tratto che il .docx disegnerà.

In `src/components/schemaImpianto/SchemaEditor.tsx`:

1. Importa `useTrascinamentoTratto`.
2. Dopo la riga di `useSegniTubo`, aggiungi:

```ts
  const { edgesConTrascinamento } = useTrascinamentoTratto(stato, applica, aggiornaSenzaCronologia)
```

3. Fondi anche questo terzo elenco nel `useMemo` che compone `edgesConGomiti` (Task 7, Step 3, punto 3):

```ts
  const edgesConGomiti = useMemo(
    () =>
      edgesConGomitiBase.map((e, i) => ({
        ...e,
        data: { ...e.data, ...edgesConSegni[i]?.data, ...edgesConTrascinamento[i]?.data } as SchemaEdgeData,
      })),
    [edgesConGomitiBase, edgesConSegni, edgesConTrascinamento]
  )
```

4. Correggi il commento sulla tela come «approssimazione» (riga 166-170): non è più vero che «instrada le linee a modo suo» — da questo task l'editor instrada come il render statico. Riformula tenendo solo ciò che resta vero (niente muro/nota/tabella sulla tela, l'anteprima resta il giudice dell'aspetto).

- [ ] **Step 4: Eseguire e verificare il verde**

Run: `npx vitest run src/components/schemaImpianto > ../../../../.superpowers/sdd/2026-08-12-schema-impianto-utenze-legenda/task-b9-verde.txt 2>&1`

Expected: PASS.

Run: `npx tsc --noEmit > ../../../../.superpowers/sdd/2026-08-12-schema-impianto-utenze-legenda/task-b9-tsc.txt 2>&1` — pulito.

**Autorizzazione al browser per QUESTO task**, come nel Task 7: chiedi al controller di verificare in pagina prima di dichiarare chiuso. Prova su una tubazione `standard` con almeno un gomito esistente: afferra il tratto centrale e trascinalo, verifica che i gomiti ai capi si spostino da soli e che la tubazione resti collegata alle ancore; prova anche un tratto SENZA gomiti (deve nascerne uno). Confronta col pannello di anteprima: la forma deve coincidere. **Vietato premere «Genera comunque .docx»**.

- [ ] **Step 5: Commit**

```bash
git add src/components/schemaImpianto/useTrascinamentoTratto.ts src/components/schemaImpianto/SchemaEdgeTubazione.tsx src/components/schemaImpianto/SchemaEditor.tsx src/components/schemaImpianto/__tests__/useTrascinamentoTratto.test.ts src/services/schemaImpianto/tratti.ts src/services/schemaImpianto/renderSvg.ts
git commit -m "feat(schema-impianto): trascinamento del tratto di tubazione, instradamento unificato editor/render"
```

---

### Task 10: Verifica in pagina e revisione finale del blocco (controller)

Non un task per un implementatore: lo fa il controller, come da convenzione del progetto («le verifiche in pagina le fa il controller»).

- [ ] **Step 1**: suite intera in background, con redirezione su file: `npx vitest run > .superpowers/sdd/2026-08-12-schema-impianto-utenze-legenda/blocco-b-finale-vitest.txt 2>&1` — deve superare la baseline di 850 test.
- [ ] **Step 2**: `npx tsc --noEmit` pulito.
- [ ] **Step 3**: sulla pratica `c6f56ca5-d57b-408c-a4e5-69a207812b0d` (LOWA R&D SRL), `/requests/<id>/technical-details` → «Genera relazione» → «Rifinisci schema»:
  - aggiungi una giunzione dalla palette, collegala con due tubazioni (un dentro, un fuori) su due dei suoi tre attacchi;
  - aggiungi una valvola e un riduttore a una tubazione esistente, trascina entrambi lungo il tubo, verifica che restino appoggiati; togline uno con doppio clic;
  - afferra un tratto dritto (con e senza gomiti preesistenti) e trascinalo, verifica che i gomiti ai capi si aggiustino da soli e il tubo resti collegato;
  - conferma lo schema e controlla l'anteprima: giunzione senza codice né riga in lista, legenda con «Riduttore di pressione» solo se ne hai lasciato uno, tratto trascinato coerente fra tela e anteprima.
  - **Vietato premere «Genera comunque .docx»**: per sola lettura, chiudi con «Annulla modifiche» poi «Annulla».
- [ ] **Step 4**: aggiorna `.superpowers/sdd/2026-08-12-schema-impianto-utenze-legenda/progress.md` con l'esito di ogni task (stato, cause vere di eventuali difetti, decisioni di perimetro prese durante l'implementazione) — è il ledger che la storia git non racconta, per chi riprende il lavoro dopo.
- [ ] **Step 5**: se tutto verde e verificato, segnala al committente che il Blocco B (e quindi il modulo intero) è pronto per la sua decisione su quando integrare in `main` — nessun merge senza la sua parola, per la regola fissata in `RIPRESA.md`.
