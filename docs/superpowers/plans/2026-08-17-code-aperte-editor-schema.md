# Le code aperte dell'editor dello schema d'impianto — piano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** chiudere le code aperte del modulo — la posa dei nuovi oggetti, il Ctrl+Z dopo un Canc, il
trascinamento sopra il bordo, gli spazi nelle annotazioni, «Rigenera da capo», il TEE sulle linee
condense — e togliere alla generazione della relazione i due riporti automatici su dati condivisi.

**Architecture:** sette modifiche indipendenti, in fila per comodità di revisione. Cinque stanno
nell'editor (`SchemaEditor.tsx`, `posaNuoviOggetti.ts`, `symbols/index.ts`,
`SchemaImpiantoSection.tsx`), una nel registro degli agganci (`agganci.ts` + `symbols/index.ts`),
una nel dialogo della relazione (`RelazioneDataDialog.tsx`). In coda, una prova in pagina e una
pulizia di dati di produzione.

**Tech Stack:** TypeScript, React 18, react-flow (`@xyflow/react`), Vitest, Supabase.

**Spec:** `docs/superpowers/specs/2026-08-17-code-aperte-editor-schema-design.md`

## Global Constraints

- **I tre riferimenti SVG NON si muovono** (`src/services/schemaImpianto/__tests__/fixtures/svgRiferimento*.ts`). Nessuna voce di questo piano cambia il disegno: un riferimento che si muove qui è un difetto, non un aggiornamento da accettare. Unica eccezione dichiarata: il Task 4 (`xml:space`) aggiunge un attributo al tag `<text>` delle annotazioni, e i fixture che ne contengono uno si muovono di quel solo attributo — va verificato che sia quello e nient'altro.
- **Questo piano si esegue DOPO** `2026-08-17-lista-e-diametri-schema.md`: il Task 1 consuma `estensioneOrizzontale`, introdotta là.
- **Tre comandi verdi prima di chiudere qualunque task:** `npx vitest run`, `npx tsc --noEmit`, `npx eslint src/components/schemaImpianto src/services/schemaImpianto --max-warnings 0`.
- **Niente `prettier --write`.**
- **Ogni test nuovo va visto cadere per mutazione**, e ripristinato **da una copia** (`cp` prima, `cp` indietro), **mai** con `git checkout`.
- **Nessun test di interfaccia per i componenti** (`CLAUDE.md`): la logica provabile sta negli hook e nei servizi. I Task 2, 3 e 5 toccano componenti e si provano **in pagina**, non con test.
- **Non esportare funzioni da file di componenti:** `react-refresh/only-export-components` fa cadere il gate del lint.
- **Sui dati di produzione:** credenziali in `.env.local`, `curl` e mai `urllib`, mai stampare le chiavi. Le pratiche con layout salvato devono restare **due**: ORVED (`a8bbdbe1-f7ad-40d9-86a0-9483b5dcc7f4`) e LOWA R&D (`c6f56ca5-d57b-408c-a4e5-69a207812b0d`).

---

## File Structure

- `src/components/schemaImpianto/posaNuoviOggetti.ts` — posa a destra quando sopra non c'è spazio.
- `src/components/schemaImpianto/SchemaEditor.tsx` — fusione delle due voci di cronologia del Canc; vincolo `y >= 0` sul trascinamento.
- `src/services/schemaImpianto/symbols/index.ts` — `xml:space` sul testo multiriga; ancore della giunzione che accettano anche la condensa.
- `src/services/schemaImpianto/agganci.ts` — il commento sull'invariante che cade.
- `src/components/relazione/SchemaImpiantoSection.tsx` — «Rigenera da capo» conserva le annotazioni.
- `src/components/relazione/RelazioneDataDialog.tsx` — via i due riporti automatici e l'avviso che li riguardava.

---

### Task 1: l'oggetto nuovo si posa a destra quando sopra non c'è spazio

**Files:**
- Modify: `src/components/schemaImpianto/posaNuoviOggetti.ts`
- Modify: `src/components/schemaImpianto/SchemaEditor.tsx:586`, `:1160` (le due chiamate)
- Test: `src/components/schemaImpianto/__tests__/sopraIlBordoSinistro.test.ts`

**Interfaces:**
- Consumes: `estensioneOrizzontale(nodi, testi, muro, libreria)` da `@/services/schemaImpianto/layout` (piano precedente, Task 2); `riquadroDi` non serve — la conversione dei nodi react-flow passa da `data.nodo`.
- Produces: `sopraIlBordoSinistro(nodes: Node[], testi: SchemaTestoLibero[], libreria?: Tarature): { x: number; y: number }` — **firma allargata di un terzo parametro**.

- [ ] **Step 1: Riscrivi il test del caso senza spazio, e aggiungine due**

Nel file di test, sostituisci il caso «non manda l'oggetto fuori dalla tela quando il disegno tocca
il bordo alto» e aggiungi i due nuovi:

```ts
  // Fino al 17-08-2026 la posa scendeva a zero e l'oggetto nasceva addosso a quelli esistenti.
  // Non si può scendere sotto zero: `dimensioniLayout` misura il disegno solo dal bordo in giù,
  // e un nodo a ordinata negativa verrebbe tagliato nel documento.
  it('quando sopra non c’è spazio si posa a destra di tutto, alla quota della cima', () => {
    const nodes = [nodo('C1', 40, 10), nodo('S1', 300, 10)]
    const posizione = sopraIlBordoSinistro(nodes, [])

    expect(posizione.y).toBe(10)
    expect(posizione.x).toBeGreaterThan(300)
  })

  it('quando sopra lo spazio c’è, resta incolonnato a sinistra', () => {
    const nodes = [nodo('C1', 200, 400), nodo('S1', 500, 400)]
    const posizione = sopraIlBordoSinistro(nodes, [])

    expect(posizione.x).toBe(200)
    expect(posizione.y).toBeLessThan(400)
  })

  it('anche la posa a destra aggancia alla griglia', () => {
    const posizione = sopraIlBordoSinistro([nodo('C1', 47, 13)], [])
    expect(posizione.x % 10).toBe(0)
    expect(posizione.y % 10).toBe(0)
  })
```

Il `nodo()` di quel file costruisce un `Node` con `data: {}`. Va allargato perché la funzione ora
legge `data.nodo` per conoscere l'ingombro:

```ts
function nodo(id: string, x: number, y: number): Node {
  return {
    id,
    type: 'x',
    position: { x, y },
    data: { nodo: { id, tipo: 'serbatoio', etichetta: id, origine: 'scheda' } },
  } as unknown as Node
}
```

Allinea i campi obbligatori a quelli che `SchemaNodo` dichiara in `types.ts`.

- [ ] **Step 2: Vedi cadere i test**

Run: `npx vitest run src/components/schemaImpianto/__tests__/sopraIlBordoSinistro.test.ts`
Expected: FAIL su «quando sopra non c'è spazio si posa a destra di tutto»: riceve `y = 0` e
`x = 40`.

- [ ] **Step 3: Implementa**

```ts
import type { Node } from '@xyflow/react'
import { allineaAllaGriglia } from '@/services/schemaImpianto/griglia'
import { estensioneOrizzontale } from '@/services/schemaImpianto/layout'
import type { Tarature } from '@/services/schemaImpianto/libreria'
import type { SchemaNodoPosizionato, SchemaTestoLibero } from '@/services/schemaImpianto/types'
import type { SchemaNodeData } from './SchemaNodeSymbol'

/**
 * Aria fra la cima del disegno e ciò che si posa sopra di essa: quanto basta perché
 * l'apparecchiatura più alta della palette non finisca addosso a ciò che c'era già.
 */
const STACCO_NUOVO_OGGETTO = 160

/** Lo stesso stacco, applicato a destra quando sopra non c'è spazio. */
const STACCO_LATERALE = 80

/**
 * Nuovo oggetto incolonnato sul bordo sinistro di quello più a sinistra — di solito il
 * compressore — e appena sopra la cima del disegno. Fino al 17-08-2026 nasceva sotto tutto il
 * disegno, e su uno schema alto bisognava inseguirlo scorrendo.
 *
 * Quando sopra la cima non c'è spazio — un disegno che comincia a quota 90 e un serbatoio alto
 * 260 — la posa NON si schiaccia a zero, dove finirebbe addosso a ciò che c'è già: l'oggetto va a
 * destra di tutto il disegno, alla quota della cima. Sotto zero non si può andare, perché
 * `dimensioniLayout` misura il disegno solo dal bordo in giù e un nodo a ordinata negativa
 * verrebbe tagliato nel documento.
 *
 * Le annotazioni contano quanto le apparecchiature: `x`/`y` di un testo SONO il suo capo
 * alto-sinistro.
 */
export function sopraIlBordoSinistro(
  nodes: Node[],
  testi: SchemaTestoLibero[],
  libreria: Tarature = {}
): { x: number; y: number } {
  const ascisse = [...nodes.map((n) => n.position.x), ...testi.map((t) => t.x)]
  const cime = [...nodes.map((n) => n.position.y), ...testi.map((t) => t.y)]
  if (ascisse.length === 0) return { x: 40, y: 40 }

  const cima = Math.min(...cime)
  const quotaSopra = allineaAllaGriglia(cima - STACCO_NUOVO_OGGETTO)
  if (quotaSopra >= 0) return { x: allineaAllaGriglia(Math.min(...ascisse)), y: quotaSopra }

  // Nessuno spazio sopra: si va a destra dell'ingombro vero del disegno, non della sola ascissa
  // dei nodi — un simbolo largo finirebbe altrimenti sotto il nuovo oggetto.
  const nodi: SchemaNodoPosizionato[] = nodes.map((n) => ({
    ...(n.data as SchemaNodeData).nodo,
    x: n.position.x,
    y: n.position.y,
  }))
  const destra = estensioneOrizzontale(nodi, testi, null, libreria).destra
  return { x: allineaAllaGriglia(destra + STACCO_LATERALE), y: allineaAllaGriglia(cima) }
}
```

In `SchemaEditor.tsx`, passa la libreria alle due chiamate:

```ts
const posizione = sopraIlBordoSinistro(s.nodes, s.testi, libreriaEffettiva)
```
```ts
aggiungiTesto((s) => sopraIlBordoSinistro(s.nodes, s.testi, libreriaEffettiva), contenuto)
```

Verifica che `libreriaEffettiva` sia in ambito in entrambi i punti e aggiungila alle dipendenze dei
`useCallback` che le contengono.

- [ ] **Step 4: Verifica che passino**

Run: `npx vitest run src/components/schemaImpianto/__tests__/sopraIlBordoSinistro.test.ts`
Expected: PASS, 7 test.

- [ ] **Step 5: Mutazione**

```bash
cp src/components/schemaImpianto/posaNuoviOggetti.ts /tmp/posa.bak
```

Muta `if (quotaSopra >= 0)` in `if (quotaSopra >= -1000)`.
Expected: FAIL su «quando sopra non c'è spazio si posa a destra di tutto».

Poi muta `y: allineaAllaGriglia(cima)` in `y: 0`.
Expected: FAIL sullo stesso test, sulla riga della quota.

```bash
cp /tmp/posa.bak src/components/schemaImpianto/posaNuoviOggetti.ts
```

- [ ] **Step 6: I tre comandi, e commit**

```bash
npx vitest run && npx tsc --noEmit && npx eslint src/components/schemaImpianto src/services/schemaImpianto --max-warnings 0
git add src/components/schemaImpianto/posaNuoviOggetti.ts src/components/schemaImpianto/__tests__/sopraIlBordoSinistro.test.ts src/components/schemaImpianto/SchemaEditor.tsx
git commit -m "fix(schema): l'oggetto nuovo non nasce piu addosso al disegno"
```

---

### Task 2: Ctrl+Z dopo un Canc riporta anche le tubazioni

**Files:**
- Modify: `src/components/schemaImpianto/SchemaEditor.tsx:395-428`
- Test: nessuno (componente; si prova in pagina allo Step 4).

**Interfaces:**
- Consumes: `applica`, `aggiornaSenzaCronologia` da `useSchemaHistory`.
- Produces: niente.

**Il rischio di questo task è rompere il trascinamento**, che ha già avuto un giro di riparazione
suo. Il commento lungo a `trascinamentoNodoAvviato` spiega perché il **primo** evento di posizione
entra in cronologia e non l'ultimo: **leggilo prima di toccare, e non riscriverlo.**

- [ ] **Step 1: Aggiungi il segnale per il gesto di rimozione**

Sotto `trascinamentoNodoAvviato`, aggiungi:

```ts
// Un Canc su un'apparecchiatura collegata fa chiamare a react-flow DUE gestori: `onNodesChange`
// con un `remove` e `onEdgesChange` con un altro, in due chiamate distinte dello stesso giro di
// eventi. Fino al 17-08-2026 ciascuno scriveva la propria voce di cronologia, e Ctrl+Z ne
// annullava una sola: tornava il nodo, non le sue tubazioni.
//
// Stesso rimedio del trascinamento qui sopra, per la stessa ragione: il PRIMO `remove` del gesto
// registra, gli altri no. Il segnale si azzera al termine del giro di eventi (`queueMicrotask`),
// non a tempo: due Canc consecutivi, o un Canc subito dopo un trascinamento, restano due gesti
// distinti e due voci distinte.
const rimozioneAvviata = useRef(false)

const primaRimozioneDelGesto = useCallback(() => {
  if (rimozioneAvviata.current) return false
  rimozioneAvviata.current = true
  queueMicrotask(() => {
    rimozioneAvviata.current = false
  })
  return true
}, [])
```

- [ ] **Step 2: Falla usare ai due gestori**

In `onNodesChange`, sostituisci la riga di `registraInCronologia`:

```ts
      const registraInCronologia =
        primoEventoDelGesto || (changes.some((c) => c.type === 'remove') && primaRimozioneDelGesto())
```

In `onEdgesChange`:

```ts
      const concludeUnGesto = changes.some((c) => c.type === 'remove') && primaRimozioneDelGesto()
```

Aggiungi `primaRimozioneDelGesto` alle dipendenze di entrambi i `useCallback`.

**Attenzione all'ordine di valutazione:** `primaRimozioneDelGesto()` ha un effetto collaterale, e in
`onNodesChange` deve stare **dopo** il controllo su `remove`, altrimenti un trascinamento
consumerebbe il segnale. Il `&&` con il `some` davanti garantisce esattamente questo.

- [ ] **Step 3: I tre comandi**

```bash
npx vitest run && npx tsc --noEmit && npx eslint src/components/schemaImpianto src/services/schemaImpianto --max-warnings 0
```

Expected: 1266 test verdi, nessun warning nuovo. I riferimenti SVG non si muovono.

- [ ] **Step 4: Prova in pagina — è qui che si verifica davvero**

Avvia il dev server come descritto nel Task 8, verificando da quale worktree gira. Poi, su una
pratica con layout salvato:

1. Seleziona un'apparecchiatura **collegata da almeno una tubazione**, premi Canc. Spariscono nodo
   e tubazioni.
2. Ctrl+Z. **Devono tornare entrambi**, in un colpo solo.
3. Trascina un'apparecchiatura, rilascia, Ctrl+Z: deve tornare al punto di partenza — la
   riparazione del trascinamento non deve essersi rotta.
4. Canc, Canc su due apparecchiature diverse, poi Ctrl+Z due volte: devono tornare una per volta,
   non tutte insieme.
5. Trascina un'apparecchiatura e subito dopo premi Canc su un'altra, poi Ctrl+Z: deve tornare la
   cancellata, non lo spostamento.

Escape chiude l'editor scartando le modifiche: usalo per uscire senza salvare.

- [ ] **Step 5: Commit**

```bash
git add src/components/schemaImpianto/SchemaEditor.tsx
git commit -m "fix(schema): annullare un Canc riporta l'apparecchiatura con le sue tubazioni"
```

---

### Task 3: un'apparecchiatura non si trascina sopra il bordo

**Files:**
- Modify: `src/components/schemaImpianto/SchemaEditor.tsx` (dentro `onNodesChange`)
- Test: nessuno (componente).

- [ ] **Step 1: Vincola le variazioni di posizione**

Dentro `onNodesChange`, prima di applicare le variazioni, riporta a zero le ordinate negative:

```ts
      // Muro invisibile al bordo alto: `dimensioniLayout` (layout.ts) misura il disegno da zero
      // in giù, quindi ciò che si trascina sopra quota zero sparisce nel .docx. Difetto
      // preesistente ai blocchi D, chiuso il 17-08-2026 vincolando il gesto invece di allargare
      // la pagina verso l'alto: allargarla cambierebbe la geometria di ogni documento generato.
      const vincolate = changes.map((c) =>
        c.type === 'position' && c.position && c.position.y < 0
          ? { ...c, position: { ...c.position, y: 0 } }
          : c
      )
```

e usa `vincolate` al posto di `changes` nella chiamata ad `applyNodeChanges`. **Le righe che
decidono la cronologia continuano a leggere `changes`:** riguardano il tipo degli eventi, non le
loro coordinate, e cambiarle qui confonderebbe due cose diverse.

- [ ] **Step 2: I tre comandi**

```bash
npx vitest run && npx tsc --noEmit && npx eslint src/components/schemaImpianto src/services/schemaImpianto --max-warnings 0
```

- [ ] **Step 3: Prova in pagina**

Trascina un'apparecchiatura verso l'alto oltre il bordo della tela: deve fermarsi al bordo e
restare afferrata (il gesto continua, il nodo non sale). Rilascia, apri l'anteprima: il nodo c'è
tutto, non tagliato.

- [ ] **Step 4: Commit**

```bash
git add src/components/schemaImpianto/SchemaEditor.tsx
git commit -m "fix(schema): un'apparecchiatura non si trascina piu fuori dal bordo alto"
```

---

### Task 4: gli spazi multipli nelle annotazioni si vedono

**Files:**
- Modify: `src/services/schemaImpianto/symbols/index.ts:183-195` (`testoMultiRiga`)
- Test: `src/services/schemaImpianto/__tests__/simboli.test.ts`

- [ ] **Step 1: Scrivi il test che cade**

```ts
  // Senza `xml:space`, l'SVG collassa gli spazi consecutivi: chi allinea qualcosa a colpi di
  // spazio dentro un'annotazione non ottiene ciò che vede mentre scrive.
  it('conserva gli spazi consecutivi di un’annotazione', () => {
    const svg = testoMultiRiga(0, 0, 'A    B', 18, 'start')
    expect(svg).toContain('xml:space="preserve"')
    expect(svg).toContain('A    B')
  })
```

- [ ] **Step 2: Vedi cadere**

Run: `npx vitest run src/services/schemaImpianto/__tests__/simboli.test.ts -t "spazi consecutivi"`
Expected: FAIL, `xml:space` assente.

- [ ] **Step 3: Implementa**

In `testoMultiRiga`, aggiungi l'attributo al tag `<text>`:

```ts
  return `<text xml:space="preserve" font-family="${FONT}" font-size="${dimensione}" text-anchor="${ancora}" dominant-baseline="central" fill="#000">${tspan}</text>`
```

- [ ] **Step 4: Verifica, e leggi cosa si è mosso nei fixture**

Run: `npx vitest run`

**È l'unica eccezione dichiarata al vincolo «i riferimenti non si muovono».** I fixture che
contengono un `testoMultiRiga` — quelli con annotazioni o con la scritta del terminale utenze —
guadagnano `xml:space="preserve"` sul tag `<text>`. Verifica nel diff che **sia solo quello**:
nessuna coordinata, nessun `tspan` in più o in meno. Poi aggiorna i fixture interessati.

- [ ] **Step 5: Mutazione**

```bash
cp src/services/schemaImpianto/symbols/index.ts /tmp/symbols.bak
```
Togli l'attributo. Expected: FAIL sul test nuovo.
```bash
cp /tmp/symbols.bak src/services/schemaImpianto/symbols/index.ts
```

- [ ] **Step 6: I tre comandi, e commit**

```bash
npx vitest run && npx tsc --noEmit && npx eslint src/components/schemaImpianto src/services/schemaImpianto --max-warnings 0
git add src/services/schemaImpianto/symbols/index.ts src/services/schemaImpianto/__tests__/simboli.test.ts src/services/schemaImpianto/__tests__/fixtures
git commit -m "fix(schema): gli spazi multipli di un'annotazione non si perdono piu"
```

Il messaggio deve dire quali fixture si sono mossi e di quale solo attributo.

---

### Task 5: «Rigenera da capo» conserva le annotazioni

**Files:**
- Modify: `src/components/relazione/SchemaImpiantoSection.tsx:337-342`
- Test: nessuno (componente).

- [ ] **Step 1: Implementa**

```ts
  const rigenera = useCallback(() => {
    // Via d'uscita quando il disegno salvato non va più bene: si riparte dalla scheda,
    // scartando sia il layout ritoccato sia l'esito della riconciliazione che lo riguardava.
    //
    // Le annotazioni no. Sono testo scritto a mano che nessuna fonte sa ricostruire, a differenza
    // di posizioni, gomiti, segni e taratura, che il pulsante promette di scartare e che dalla
    // scheda si rifanno. Fino al 17-08-2026 sparivano insieme al resto, senza modo di recuperarle.
    setEsitoRiconciliazione(null)
    const daZero = layoutSchema(buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi }), libreria)
    void disegna({ ...daZero, testi: layout?.testi ?? [] })
  }, [collegamentiCompressoriSerbatoi, disegna, layout, libreria, scheda])
```

Verifica che `layout` (lo stato a riga 108) sia davvero il layout corrente e non quello salvato:
se il nome in ambito è diverso, usa quello giusto.

- [ ] **Step 2: I tre comandi**

```bash
npx vitest run && npx tsc --noEmit && npx eslint src/components/schemaImpianto src/services/schemaImpianto --max-warnings 0
```

- [ ] **Step 3: Prova in pagina**

Apri l'editor, aggiungi un'annotazione, sposta un'apparecchiatura, salva. Premi «Rigenera da capo»:
l'apparecchiatura torna al suo posto d'ufficio, **l'annotazione resta**.

- [ ] **Step 4: Commit**

```bash
git add src/components/relazione/SchemaImpiantoSection.tsx
git commit -m "fix(schema): rigenerare da capo non butta piu le annotazioni scritte a mano"
```

---

### Task 6: la giunzione accetta anche la condensa

**Files:**
- Modify: `src/services/schemaImpianto/symbols/index.ts:1049-1053` (ancore della giunzione)
- Modify: `src/services/schemaImpianto/agganci.ts:44-49` (il commento che diventa falso)
- Test: `src/services/schemaImpianto/__tests__/agganci.test.ts` (o dove stanno i test di `capoValido`)

- [ ] **Step 1: Scrivi il test che cade**

```ts
  // Un TEE inserito su una linea condense lasciava due archi condensa attaccati ad ancore che
  // dichiaravano di accettare solo aria: uno stato che l'editor rifiuterebbe se lo si disegnasse
  // a mano. Dal 17-08-2026 la giunzione accetta entrambi i tipi.
  it('la giunzione accetta sia l’aria sia la condensa su ogni suo lato', () => {
    for (const ancora of ['sx', 'dx', 'alto', 'basso']) {
      expect(capoValido({ tipo: 'giunzione' }, ancora, 'standard')).toBe(true)
      expect(capoValido({ tipo: 'giunzione' }, ancora, 'condensa')).toBe(true)
    }
  })
```

- [ ] **Step 2: Vedi cadere**

Expected: FAIL sul caso `'condensa'`.

- [ ] **Step 3: Allarga le quattro ancore**

In `symbols/index.ts`, cambia `accetta: ['aria']` in `accetta: ['aria', 'condensa']` su tutte e
quattro le ancore della giunzione, e aggiungi al commento del blocco:

```
    // Accettano entrambi i tipi dal 17-08-2026: un TEE inserito su una linea condense lasciava
    // altrimenti due archi condensa attaccati ad ancore che dichiaravano solo aria — uno stato
    // che l'editor rifiuterebbe se lo si disegnasse a mano.
```

- [ ] **Step 4: Correggi il commento che è appena diventato falso**

In `agganci.ts`, il commento di `connessioneAmmessa` afferma «nessuna ancora che accetta condensa
accetta anche aria». **Da oggi è falso.** Riscrivilo **accorciando invece di precisare** — un
commento che non enumera casi non può enumerarli male:

```ts
/**
 * Vero se almeno uno stile di tubazione è ammesso da entrambi i capi. Serve a decidere se
 * l'utente può tracciare la connessione mentre la trascina: valutarla sempre con 'standard'
 * (l'unico stile con cui `onConnect` crea la tubazione) rifiuterebbe le linee condense fra capi
 * che l'aria non l'accettano.
 */
```

Controlla se altri commenti nel file, o in `inserimentoTee.ts`, si appoggiano allo stesso
invariante: **correggerne uno ne rende falso un altro**, ed è la classe di difetto che questo
modulo produce di continuo. Cerca con `grep -rn "condensa" src/services/schemaImpianto/*.ts` e
leggi ogni occorrenza in commento.

- [ ] **Step 5: Verifica il caso di frontiera dichiarato in specifica**

Aggiungi il test che fissa il comportamento accettato, così nessuno lo scopra per caso:

```ts
  // Conseguenza accettata dell'allargamento: fra due giunzioni l'aria è ammessa da entrambi i
  // capi, quindi una tubazione tracciata a mano fra due TEE di una linea condense nasce ad aria e
  // va cambiata a mano. Segnalato al committente il 17-08-2026.
  it('fra due giunzioni la tubazione nuova nasce ad aria', () => {
    expect(stileIniziale({ tipo: 'giunzione' }, 'dx', { tipo: 'giunzione' }, 'sx')).toBe('standard')
  })
```

- [ ] **Step 6: I tre comandi, e commit**

```bash
npx vitest run && npx tsc --noEmit && npx eslint src/components/schemaImpianto src/services/schemaImpianto --max-warnings 0
```

I riferimenti SVG non si muovono: `accetta` non entra nel disegno.

```bash
git add src/services/schemaImpianto/symbols/index.ts src/services/schemaImpianto/agganci.ts src/services/schemaImpianto/__tests__
git commit -m "fix(schema): il TEE su una linea condense non produce piu agganci incoerenti"
```

---

### Task 7: la generazione della relazione smette di riscrivere dati condivisi

**Files:**
- Modify: `src/components/relazione/RelazioneDataDialog.tsx`
- Test: nessuno (componente).

**Interfaces:**
- Consumes: niente.
- Produces: niente. Spariscono `riportaGiriACatalogo`, `riportaDescrizioneInAnagrafica`, `mostraEsitoGenerazione` e l'interfaccia `EsitoRiportoGiri`.

- [ ] **Step 1: Togli le due chiamate e l'avviso d'esito**

In `handleGenera`, sostituisci le tre righe finali (`riportaDescrizioneInAnagrafica`,
`riportaGiriACatalogo`, `mostraEsitoGenerazione`) con il solo avviso di riuscita:

```ts
      toast.success('Relazione generata e scaricata.')
      onClose()
```

Correggi anche il commento poco sopra (`// Non bloccante, come riportaDescrizioneInAnagrafica/
riportaGiriACatalogo qui sotto: …`), che nomina due funzioni che stanno per sparire.

- [ ] **Step 2: Togli le funzioni, per intero**

Cancella `riportaDescrizioneInAnagrafica`, l'interfaccia `EsitoRiportoGiri`,
`riportaGiriACatalogo` e `mostraEsitoGenerazione` con i loro commenti di testa. **Non lasciarle
spente:** codice morto in piedi è la premessa del prossimo commento falso.

Aggiungi, sopra `handleGenera`, la ragione:

```ts
  /**
   * Genera e scarica, e basta. Fino al 17-08-2026 la generazione riscriveva anche due dati
   * CONDIVISI fra tutte le pratiche — la regolazione dei giri in `equipment_catalog` e la
   * descrizione attività sull'anagrafica del cliente — senza dirlo e senza chiedere: un valore
   * sbagliato digitato qui veniva ereditato da ogni pratica futura sullo stesso modello, ed è così
   * che «prova attività ATECOOO» è finita in anagrafica. Catalogo e anagrafica si aggiornano ora
   * solo dove li si modifica esplicitamente.
   *
   * Il prezzo, accettato dal committente: la domanda sui giri torna a ogni pratica sullo stesso
   * modello.
   */
```

- [ ] **Step 3: Ripulisci gli import rimasti orfani**

Dopo le cancellazioni restano probabilmente inutilizzati: `equipmentCatalogApi` (riga 37),
`customersApi` (38), `scegliVarianteSalvata` (39), `useQueryClient` (30) e la costante
`queryClient` (139). **Verificali uno per uno prima di togliere** — `customersApi` e `queryClient`
potrebbero servire altrove nel file. `eslint` li segnalerà comunque: il gate a `--max-warnings 0`
non passa finché restano.

`compressoriSenzaGiri` (121) **resta**: serve a porre la domanda nel dialogo, non a riportarla.

- [ ] **Step 4: I tre comandi**

```bash
npx vitest run && npx tsc --noEmit && npx eslint src/components/relazione --max-warnings 0
```

Nota il perimetro diverso del lint: questo file sta in `src/components/relazione`. Lancia **anche**
quello dello schema, che è il gate di riferimento del progetto.

- [ ] **Step 5: Prova in pagina**

Genera una relazione su una pratica con un compressore a vite privo di `giri` a catalogo. Il
dialogo deve ancora **chiedere** i giri; a scaricamento avvenuto, il catalogo **non** deve
contenerli. Verificalo con una query diretta su `equipment_catalog`, non a occhio.

- [ ] **Step 6: Commit**

```bash
git add src/components/relazione/RelazioneDataDialog.tsx
git commit -m "fix(relazione): generare il documento non riscrive piu catalogo e anagrafica"
```

---

### Task 8: la prova del TEE su un tubo fuori griglia

**Files:** nessuno.

Questa voce **potrebbe essersi risolta da sé** col Blocco 3, ora che tutte le ancore di fabbrica
cadono sui multipli di 10. **Provala prima di scrivere una riga.**

- [ ] **Step 1: Avvia il dev server e verifica da dove gira**

```bash
npx vite --port 5180
```

```powershell
Get-NetTCPConnection -LocalPort 5180 -State Listen | ForEach-Object { Get-CimInstance Win32_Process -Filter "ProcessId = $($_.OwningProcess)" | Select-Object CommandLine }
```

La `CommandLine` deve puntare a `.claude/worktrees/code-aperte-schema`. Se punta altrove, la porta
è servita da un altro worktree e la prova mostrerebbe il codice sbagliato.

- [ ] **Step 2: Costruisci un tubo fuori griglia**

Sposta a mano un'apparecchiatura in modo che un capo della tubazione non cada su un multiplo di 10
(se l'aggancio alla griglia lo impedisce, usa un gomito trascinato in una posizione intermedia).

- [ ] **Step 3: Inserisci il TEE e spingi**

Trascina un'apparecchiatura sopra quel tubo fino a far comparire il TEE, rilascia, poi dai una
prima spinta col mouse. **`browser_drag` non è affidabile su react-flow:** usa mosse a più passi
(`page.mouse.down()`, `move` ripetuti, `up`).

- [ ] **Step 4: Riferisci**

Se il TEE resta agganciato, la voce si chiude con la prova come esito e **non serve altro
lavoro**. Se si stacca, **fermati e riferisci**: è un lavoro suo, con una sua stima, non da
infilare in coda a questo piano.

---

### Task 9: la pulizia di «prova attività ATECOOO»

**Files:** nessuno. Due UPDATE su produzione.

**L'ordine conta: questo task va DOPO il Task 7.** Pulendo prima, la prima rigenerazione della
relazione rimetterebbe la stringa in anagrafica.

- [ ] **Step 1: Riverifica che siano ancora entrambe lì**

```bash
set -a && . ./.env.local && set +a
curl -s "$VITE_SUPABASE_URL/rest/v1/customers?select=id,ragione_sociale,descrizione_attivita&id=eq.dfee0ea9-8157-4a4d-b668-127d633f5073" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

e, via Management API, `additional_info->>'descrizioneAttivita'` su
`dm329_technical_data` id `68afbc07-d630-4e68-9d64-0a2aaef78b7a`.

- [ ] **Step 2: Svuota entrambe**

Anagrafica cliente: `descrizione_attivita` a stringa vuota.
Pratica: la chiave `descrizioneAttivita` dentro `additional_info` a stringa vuota — **non**
cancellare l'oggetto `additional_info`, che porta anche altro.

Usa `curl` con la Management API per la seconda, che tocca un JSONB.

- [ ] **Step 3: Riverifica l'assenza con una query diretta**

Non fidarti dell'esito della scrittura: rileggi entrambi i valori, e verifica che le pratiche con
layout salvato siano ancora **due**.

- [ ] **Step 4: Riferisci al committente**

Segnala che restano fuori perimetro gli altri quattro valori dubbi nella stessa colonna (la PEC di
EUROGRAFITE, i «???» di TESSITURA PUNTO MAGLIA, i due clienti di prova), da toccare solo con un suo
cenno.

---

## Self-review

**Copertura della specifica.** B1 → Task 1. B2 → Task 2. B3 → Task 3. B4 → Task 4. B5 → Task 5.
C1 → Task 6 (compreso il commento che cade e il caso di frontiera). C2 → Task 7. Prova del TEE
fuori griglia → Task 8. Pulizia dati → Task 9. Le tre voci chiuse per decisione (TEE salvati,
tronconi, policy) non hanno task: sono scritte in specifica ed è lì che restano.

**Coerenza dei nomi.** `sopraIlBordoSinistro` cambia firma nel Task 1 e i due chiamanti sono
elencati. `primaRimozioneDelGesto` nasce e si usa nel Task 2. `estensioneOrizzontale` viene dal
piano precedente con la firma dichiarata lì.

**Due punti che l'esecutore deve verificare in corso d'opera, non dati per scontati:**
il nome esatto dello stato del layout in `SchemaImpiantoSection.tsx` (Task 5, Step 1) e quali
import restano davvero orfani in `RelazioneDataDialog.tsx` (Task 7, Step 3). Entrambi sono
segnalati nei rispettivi step.

**Ordine vincolato:** Task 7 prima del Task 9. Tutto il resto è indipendente.
