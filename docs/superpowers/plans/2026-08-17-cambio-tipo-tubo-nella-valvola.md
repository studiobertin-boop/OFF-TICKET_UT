# Il tipo di tubazione cambia dove sta la valvola — piano di attuazione

> **Per chi esegue:** SOTTO-SKILL RICHIESTA: `superpowers:subagent-driven-development` (consigliata)
> oppure `superpowers:executing-plans`, un task alla volta. I passi usano caselle (`- [ ]`).

**Obiettivo:** permettere che il tubo cambi tipo — rigida, flessibile, condense — nel punto dove sta
una valvola di intercettazione o un riduttore di pressione, con un solo gesto e senza spezzare
l'arco.

**Impostazione:** il segno dichiara il tipo che comincia da lui (`stileAValle`, campo opzionale).
Una funzione sola divide la polilinea nei punti dei segni che lo dichiarano, e i due disegni —
documento e tela — ci passano entrambi. Nessun nodo nuovo, nessuna migrazione, la rotta non cambia.

**Tecnologie:** TypeScript, React 18, `@xyflow/react`, Material UI 6, Vitest. SVG scritto a mano.

**Specifica:** `docs/superpowers/specs/2026-08-17-cambio-tipo-tubo-nella-valvola-design.md`

## Vincoli globali

- **Tre comandi prima di chiudere qualunque task**, dal worktree:
  `npx vitest run`, `npx tsc --noEmit`,
  `npx eslint src/components/schemaImpianto src/services/schemaImpianto --max-warnings 0`.
  Il lint deve fermarsi ai **tre warning preesistenti** (react-refresh su `SchemaEditor.tsx` e
  `SchemaNodeSymbol.tsx`, exhaustive-deps su `TestiLiberi.tsx`). Zero errori.
- **I tre riferimenti SVG committati non devono cambiare di un carattere**, in nessun task: senza il
  campo nuovo il disegno è identico a oggi. Se cadono, è un difetto — non si aggiornano.
- **Ogni test nuovo va visto cadere per mutazione**, sulla porta più esterna che la produzione usa.
  Le mutazioni si ripristinano **da una copia** (`cp` prima, `cp` indietro), **mai con
  `git checkout`**.
- **Niente `prettier --write`**: il `.prettierrc` non corrisponde allo stile del codice.
- **Nessun test di interfaccia** per i componenti (`CLAUDE.md`): la logica provabile sta negli hook
  e nei servizi.
- **I commenti si accorciano invece di precisarli.** Attenzione ai rimandi incrociati.
- **Non esportare funzioni non-componente da `SchemaEditor.tsx` o da altri file di componenti**:
  fa scattare `react-refresh/only-export-components`, e il gate del lint cade. Le funzioni provabili
  vanno in un modulo loro, come `posaNuoviOggetti.ts`.

## Struttura dei file

| File | Responsabilità | Task |
|---|---|---|
| `src/services/schemaImpianto/types.ts` | `SchemaSegnoTubo.stileAValle` | 1 |
| `src/services/schemaImpianto/tratti.ts` | `quoteDeiVertici`, `sottoPolilinea`, `tronconi` | 1 |
| `src/services/schemaImpianto/inserimentoTee.ts` | perde `quoteDeiVertici`, la importa | 1 |
| `src/services/schemaImpianto/renderSvg.ts` | disegno del documento e legenda | 2 |
| `src/components/schemaImpianto/SchemaEdgeTubazione.tsx` | disegno sulla tela, menu del segno | 3, 4 |
| `src/components/schemaImpianto/tipoTratto.ts` (nuovo) | a quale campo scrive il menu | 4 |
| `src/components/schemaImpianto/useSegniTubo.ts` | il comando che scrive, in cronologia | 4 |

---

### Task 1: I tronconi

**File:**
- Modifica: `src/services/schemaImpianto/types.ts:143-160` (`SchemaSegnoTubo`)
- Modifica: `src/services/schemaImpianto/tratti.ts` (aggiunge `sottoPolilinea` e `tronconi`,
  accoglie `quoteDeiVertici`)
- Modifica: `src/services/schemaImpianto/inserimentoTee.ts` (perde `quoteDeiVertici`, la importa)
- Test: `src/services/schemaImpianto/__tests__/tratti.test.ts`

**Interfacce:**
- Consuma: `puntoSuTratto` (già in `tratti.ts`).
- Produce:
  - `SchemaSegnoTubo.stileAValle?: SchemaArcoStile`
  - `export function quoteDeiVertici(punti: Punto[]): number[]` — spostata da `inserimentoTee.ts`,
    stessa implementazione e stesso commento
  - `export function sottoPolilinea(punti: Punto[], da: number, a: number): Punto[]`
  - `export function tronconi(punti: Punto[], stileArco: SchemaArcoStile, segni: SchemaSegnoTubo[]):
    { punti: Punto[]; stile: SchemaArcoStile }[]`

- [ ] **Passo 1: il campo nel modello**

In `types.ts`, dentro `SchemaSegnoTubo`, dopo `t`:

```ts
  /**
   * Tipo di tubazione che comincia da questo segno e vale fino al segno successivo che ne dichiara
   * uno, o fino al capo dell'arco. Assente: qui il tubo non cambia tipo — è il caso di ogni segno
   * posato prima del 17-08-2026 e di ogni layout salvato, che si leggono senza conversione.
   *
   * Lo dichiarano solo valvola di intercettazione e riduttore di pressione: la freccia di direzione
   * indica il verso del flusso, non un componente della linea (deciso col committente).
   */
  stileAValle?: SchemaArcoStile
```

- [ ] **Passo 2: i test della funzione, prima della funzione**

In `tratti.test.ts`, un `describe` nuovo. `SchemaSegnoTubo` va importato come tipo.

```ts
describe('tronconi', () => {
  const dritta = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
  ]
  const segno = (t: number, stileAValle?: SchemaArcoStile): SchemaSegnoTubo => ({
    id: `s-${t}`,
    tipo: 'valvola_intercettazione',
    t,
    ...(stileAValle ? { stileAValle } : {}),
  })

  it('senza cambi restituisce un troncone solo, con la polilinea intera', () => {
    expect(tronconi(dritta, 'flessibile', [])).toEqual([{ punti: dritta, stile: 'flessibile' }])
  })

  it('ignora i segni che non dichiarano un tipo', () => {
    // Una valvola posata e basta non spezza niente: è il caso di ogni disegno esistente.
    expect(tronconi(dritta, 'standard', [segno(0.5)])).toEqual([{ punti: dritta, stile: 'standard' }])
  })

  it('un cambio a metà dà due tronconi che si toccano nel punto del segno', () => {
    const esito = tronconi(dritta, 'flessibile', [segno(0.5, 'standard')])
    expect(esito.map((t) => t.stile)).toEqual(['flessibile', 'standard'])
    // Si toccano: la fine del primo è l'inizio del secondo, e insieme coprono tutto il tubo.
    expect(esito[0].punti[esito[0].punti.length - 1]).toEqual({ x: 50, y: 0 })
    expect(esito[1].punti[0]).toEqual({ x: 50, y: 0 })
    expect(esito[0].punti[0]).toEqual(dritta[0])
    expect(esito[1].punti[esito[1].punti.length - 1]).toEqual(dritta[1])
  })

  it('due cambi danno tre tronconi, nell’ordine del tubo e non in quello di creazione', () => {
    // Il secondo segno dell'array sta PRIMA lungo il tubo: chi ordina per creazione sbaglia.
    const esito = tronconi(dritta, 'standard', [segno(0.75, 'condensa'), segno(0.25, 'flessibile')])
    expect(esito.map((t) => t.stile)).toEqual(['standard', 'flessibile', 'condensa'])
    expect(esito[1].punti[0]).toEqual({ x: 25, y: 0 })
    expect(esito[2].punti[0]).toEqual({ x: 75, y: 0 })
  })

  it('fonde due tronconi consecutivi dello stesso tipo', () => {
    // Scegliere per il tratto a valle il tipo che aveva già non deve lasciare due tracciati
    // identici attaccati: invisibili a occhio, ma non nel markup né nei riferimenti SVG.
    const esito = tronconi(dritta, 'standard', [segno(0.5, 'standard')])
    expect(esito).toEqual([{ punti: dritta, stile: 'standard' }])
  })

  it('tiene i vertici della polilinea nel troncone che li contiene', () => {
    const conAngolo = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ]
    // Il vertice (100,0) sta a t=0.5: il taglio a 0.75 lo lascia al primo troncone.
    const esito = tronconi(conAngolo, 'standard', [segno(0.75, 'flessibile')])
    expect(esito[0].punti).toEqual([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }])
    expect(esito[1].punti).toEqual([{ x: 100, y: 50 }, { x: 100, y: 100 }])
  })

  it('un cambio sui capi non produce tronconi vuoti', () => {
    // t=0 e t=1 sono posizioni legittime (il segno si trascina fino al capo): il risultato deve
    // restare una lista di tronconi veri, ognuno con almeno due punti.
    for (const t of [0, 1]) {
      const esito = tronconi(dritta, 'standard', [segno(t, 'flessibile')])
      for (const tratto of esito) expect(tratto.punti.length).toBeGreaterThanOrEqual(2)
    }
  })
})
```

- [ ] **Passo 3: vederli cadere**

Comando: `npx vitest run src/services/schemaImpianto/__tests__/tratti.test.ts -t "tronconi"`
Atteso: FALLISCE alla compilazione — `tronconi` non esiste.

- [ ] **Passo 4: spostare `quoteDeiVertici` in `tratti.ts`**

Tagliare la funzione da `inserimentoTee.ts` (con tutto il suo commento, che spiega la metrica: la
frazione della lunghezza totale, non del numero di segmenti) e incollarla in `tratti.ts`, esportata.
In `inserimentoTee.ts` importarla da `./tratti`, accanto agli import che già ci sono.

Sta in `tratti.ts` perché da qui in poi la usano due moduli, e `tratti.ts` è già «la geometria dei
tratti condivisa da chi disegna» — `inserimentoTee.ts` è invece un pezzo di editor.

- [ ] **Passo 5: `sottoPolilinea` e `tronconi`**

In `tratti.ts`, dopo `puntoSuTratto`:

```ts
/**
 * Il pezzo di polilinea fra due quote (`t`), estremi compresi: comincia esattamente sul punto `da`
 * e finisce esattamente su quello `a`, con in mezzo i soli vertici che ci cadono. Serve a disegnare
 * un troncone di tubo che cambia tipo a metà.
 */
export function sottoPolilinea(punti: Punto[], da: number, a: number): Punto[] {
  const inizio = puntoSuTratto(punti, da).punto
  const fine = puntoSuTratto(punti, a).punto
  const quote = quoteDeiVertici(punti)
  const interni = punti.filter((_, i) => quote[i] > da && quote[i] < a)
  // Un capo che coincide col primo vertice interno lo renderebbe doppio: il tracciato non
  // cambierebbe forma, ma il markup porterebbe un comando in più a ogni disegno.
  const senzaDoppioni = [inizio, ...interni, fine].filter(
    (p, i, arr) => i === 0 || p.x !== arr[i - 1].x || p.y !== arr[i - 1].y
  )
  // Un troncone di lunghezza nulla (cambio posato esattamente su un capo) resta comunque un
  // segmento: `ondula` e `percorso` vogliono almeno due punti.
  return senzaDoppioni.length >= 2 ? senzaDoppioni : [inizio, fine]
}

/**
 * I tronconi in cui i segni con `stileAValle` dividono la polilinea, ciascuno col proprio tipo di
 * tubazione. Senza cambi è un troncone solo con la polilinea intera — il disegno di sempre.
 *
 * I confini si prendono ORDINATI per `t`, non per ordine di creazione: trascinare una valvola oltre
 * un'altra riordina i tronconi da sé, e non lascia stati impossibili. Due tronconi consecutivi
 * dello stesso tipo si fondono, o resterebbero due tracciati identici attaccati.
 */
export function tronconi(
  punti: Punto[],
  stileArco: SchemaArcoStile,
  segni: SchemaSegnoTubo[]
): { punti: Punto[]; stile: SchemaArcoStile }[] {
  const cambi = segni
    .filter((s): s is SchemaSegnoTubo & { stileAValle: SchemaArcoStile } => !!s.stileAValle)
    .sort((primo, secondo) => primo.t - secondo.t)
  if (cambi.length === 0) return [{ punti, stile: stileArco }]

  const quote = [0, ...cambi.map((c) => Math.max(0, Math.min(1, c.t))), 1]
  const stili = [stileArco, ...cambi.map((c) => c.stileAValle)]

  const esito: { punti: Punto[]; stile: SchemaArcoStile }[] = []
  for (let i = 0; i < stili.length; i++) {
    const precedente = esito[esito.length - 1]
    if (precedente && precedente.stile === stili[i]) {
      // Stesso tipo del troncone che precede: si allunga quello invece di aprirne un altro.
      esito[esito.length - 1] = { punti: sottoPolilinea(punti, quote[i - 1], quote[i + 1]), stile: stili[i] }
      quote[i] = quote[i - 1]
      continue
    }
    esito.push({ punti: sottoPolilinea(punti, quote[i], quote[i + 1]), stile: stili[i] })
  }
  return esito
}
```

`SchemaSegnoTubo` e `SchemaArcoStile` sono già importati come tipi in `tratti.ts`: verificare la riga
di import in testa e aggiungere solo ciò che manca.

**Attenzione alla fusione con tre tronconi:** l'accorpamento riscrive la quota di partenza del
troncone assorbito, così un terzo tratto dello stesso tipo si attacca al risultato già fuso e non a
quello di mezzo. Il test «due cambi» copre l'ordine; se durante l'esecuzione emergesse un caso a tre
tronconi con il primo e il terzo uguali e il secondo diverso, **aggiungere un test** invece di
correggere a occhio.

- [ ] **Passo 6: verificare e mutare**

```bash
npx vitest run src/services/schemaImpianto
```
Atteso: i test nuovi PASSANO e **nient'altro cade** — nessun chiamante esiste ancora, e i tre
riferimenti SVG non possono muoversi.

Poi la mutazione, da copia:

```bash
cp src/services/schemaImpianto/tratti.ts /tmp/tratti.bak
# togliere il .sort() dai cambi
npx vitest run src/services/schemaImpianto/__tests__/tratti.test.ts -t "ordine del tubo"   # deve FALLIRE
cp /tmp/tratti.bak src/services/schemaImpianto/tratti.ts
```

- [ ] **Passo 7: i tre comandi, poi commit**

```bash
git add src/services/schemaImpianto
git commit -m "feat(schema): i segni possono dichiarare il tipo di tubo che comincia da loro"
```

---

### Task 2: Il documento disegna i tronconi

**File:**
- Modifica: `src/services/schemaImpianto/renderSvg.ts:74-140` (le tre `render*`), `:150-190` (il
  ciclo degli archi), `righeLegenda`
- Test: `src/services/schemaImpianto/__tests__/renderSvg.test.ts`

**Interfacce:**
- Consuma: `tronconi` (Task 1).
- Produce: nessuna firma pubblica nuova. Le tre funzioni `renderMandataCompressore`,
  `renderMandataLinea`, `renderLineaCondense` si riducono a una sola, `renderArco`, con la stessa
  forma di ritorno `{ svg: string; punti: Punto[] }` che il ciclo già consuma.

Le tre funzioni di oggi calcolano la **stessa** polilinea con `instrada` e differiscono solo
nell'ultima riga (ondulata / continua / tratteggiata). Con i tronconi quella differenza si sposta
dentro il ciclo, e le tre collassano in una.

- [ ] **Passo 1: i test**

In `renderSvg.test.ts`:

```ts
  it('disegna due tratti di tipo diverso quando una valvola lo dichiara', () => {
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
    const flessibile = layout.archi.find((a) => a.stile === 'flessibile')!
    flessibile.segni = [{ id: 'V1', tipo: 'valvola_intercettazione', t: 0.5, stileAValle: 'standard' }]

    const svg = renderSvg(layout)
    const disegno = svg.slice(0, svg.indexOf('LISTA APPARECCHIATURE'))
    // Il flessibile ondula (comandi Q), il rigido no: dopo il cambio devono comparire entrambi
    // sullo STESSO tubo, che prima portava solo onde.
    const ondulati = (disegno.match(/<path d="M [^"]*Q [^"]*"/g) ?? []).length
    expect(ondulati).toBeGreaterThan(0)
    const dritti = (disegno.match(/<path d="M [^"]*" fill="none" stroke="#000" stroke-width="2" \/>/g) ?? []).length
    expect(dritti).toBeGreaterThan(0)
  })

  it('la legenda nomina anche i tipi che entrano da un cambio, non solo quelli degli archi', () => {
    const layout = layoutCon({ condense: false, essiccatore: true })
    expect(descrizioni(layout)).not.toContain('Tubazione flessibile')

    const rigido = layout.archi.find((a) => a.stile === 'standard')!
    rigido.segni = [{ id: 'V1', tipo: 'valvola_intercettazione', t: 0.5, stileAValle: 'flessibile' }]
    expect(descrizioni(layout)).toContain('Tubazione flessibile')
  })
```

Il secondo test va nel `describe('legenda dei simboli')`, che ha già `descrizioni` e `layoutCon`.
Verificare che l'impianto scelto **non** abbia già un arco flessibile, o la prima asserzione non
discrimina: `layoutCon` costruisce un compressore con disoleatore, quindi controllare gli stili veri
degli archi che produce e, se serve, scegliere un altro tipo per il cambio.

- [ ] **Passo 2: vederli cadere**

Comando: `npx vitest run src/services/schemaImpianto/__tests__/renderSvg.test.ts -t "tipo diverso"`
Atteso: FALLISCE — un tubo solo, tutto ondulato.

- [ ] **Passo 3: una funzione sola per l'arco**

Sostituire le tre `render*` con:

```ts
/**
 * Un arco disegnato: la FORMA la decide `instrada` (tratti.ts), condivisa con la tela dell'editor
 * — che la chiama tramite `polilineaDellArco` (`conversioneFlow.ts`). Qui resta la resa, che dal
 * 17-08-2026 può cambiare lungo il tubo: i segni che dichiarano un `stileAValle` lo dividono in
 * tronconi, ognuno col proprio tratto. Senza cambi è un `<path>` solo, identico a prima.
 *
 * La rotta resta quella dello stile dell'ARCO: `instrada` la sceglie una volta (il flessibile
 * scende al collettore, la condensa corre sulla propria corsia), e i tronconi non la ridiscutono —
 * cambia il tratto disegnato, non il tragitto.
 */
function renderArco(
  da: SchemaNodoPosizionato,
  ancoraDa: string,
  a: SchemaNodoPosizionato,
  ancoraA: string,
  stile: SchemaArcoStile,
  quote: QuoteInstradamento,
  gomiti: Punto[] | undefined,
  segni: SchemaSegnoTubo[],
  libreria: Tarature = {}
): { svg: string; punti: Punto[] } {
  const pDa = posizioneAncora(da, ancoraDa, libreria)
  const pA = posizioneAncora(a, ancoraA, libreria)
  const punti = instrada(stile, pDa, pA, gomiti, quote, {
    da: latoImposto(da, ancoraDa, libreria),
    a: latoImposto(a, ancoraA, libreria),
  })
  const svg = tronconi(punti, stile, segni).map((t) => trattoSvg(t.punti, t.stile)).join('')
  return { svg, punti }
}

/** Il tracciato di un troncone, col tratto del suo tipo. */
function trattoSvg(punti: Punto[], stile: SchemaArcoStile): string {
  if (stile === 'flessibile') {
    return `<path d="${ondula(punti)}" fill="none" stroke="#000" stroke-width="${TRATTO}" />`
  }
  const tratteggio = stile === 'condensa' ? ` stroke-dasharray="${TRATTEGGIO_CONDENSE}"` : ''
  return `<path d="${percorso(punti)}" fill="none" stroke="#000" stroke-width="${TRATTO}"${tratteggio} />`
}
```

Nel ciclo degli archi, le tre chiamate condizionali diventano una:

```ts
    const reso = renderArco(
      da,
      arco.da.ancora,
      a,
      arco.a.ancora,
      arco.stile,
      quote,
      arco.punti,
      arco.segni ?? [],
      libreria
    )
```

Importare `tronconi` da `./tratti`.

- [ ] **Passo 4: la legenda**

In `righeLegenda`, gli stili presenti non sono più solo quelli degli archi:

```ts
  // Anche i tipi che entrano da un cambio a metà tubo (`stileAValle`): senza, un disegno con un
  // troncone flessibile su un tubo rigido mostrerebbe una legenda che il disegno smentisce.
  const stili = new Set([
    ...layout.archi.map((a) => a.stile),
    ...layout.archi.flatMap((a) => (a.segni ?? []).map((s) => s.stileAValle).filter(Boolean)),
  ])
```

- [ ] **Passo 5: verificare**

```bash
npx vitest run src/services/schemaImpianto
```

Atteso: i test nuovi passano, **i tre riferimenti SVG NON cadono**. Se cadono, la resa di un arco
senza cambi è diversa da prima: confrontare `trattoSvg` con le tre stringhe che ha sostituito,
attributo per attributo (ordine compreso).

- [ ] **Passo 6: i tre comandi, poi commit**

```bash
git add src/services/schemaImpianto
git commit -m "feat(schema): il documento disegna il tubo a tronconi, uno per tipo"
```

---

### Task 3: La tela disegna i tronconi

**File:**
- Modifica: `src/components/schemaImpianto/SchemaEdgeTubazione.tsx:365-400`
- Test: nessuno nuovo (è disegno di componente, e `tronconi` è già provata). La verifica è in
  pagina, al Task 4.

**Interfacce:**
- Consuma: `tronconi` (Task 1). Nessuna firma nuova.

- [ ] **Passo 1: da un tracciato a uno per troncone**

Oggi:

```ts
  const path = stile === 'flessibile' ? ondula(polilinea) : percorso(polilinea)
```

e un `<BaseEdge>` solo. Diventa:

```ts
  // Un tracciato per troncone: dal 17-08-2026 una valvola può dichiarare che da lei in poi il tubo
  // cambia tipo (`tronconi`, tratti.ts). Senza cambi la lista ha un elemento solo, ed è il disegno
  // di prima.
  const pezzi = tronconi(polilinea, stile, edgeData?.segni ?? [])
```

`BaseEdge` resta per il **primo** pezzo — porta l'`id` che react-flow usa per la selezione e i
marker — e i pezzi successivi sono `<path>` con lo stesso stile grafico:

```tsx
      {pezzi.map((pezzo, i) => {
        const d = pezzo.stile === 'flessibile' ? ondula(pezzo.punti) : percorso(pezzo.punti)
        const tratto = {
          stroke: edgeData?.evidenziato ? '#ed6c02' : selected ? '#1976d2' : '#000',
          strokeWidth: edgeData?.evidenziato ? 4 : selected ? 3 : 2,
          strokeDasharray: pezzo.stile === 'condensa' ? TRATTEGGIO_CONDENSE : undefined,
        }
        return i === 0 ? (
          <BaseEdge key={i} id={id} path={d} markerEnd={markerEnd} style={tratto} />
        ) : (
          <path key={i} d={d} fill="none" style={tratto} />
        )
      })}
```

**Due cose da verificare eseguendo, non da assumere:**
- il `<path>` semplice deve ricevere anche `fill="none"`, o un troncone chiuso verrebbe riempito;
- l'evidenziazione e la selezione devono valere su **tutti** i pezzi, non solo sul primo: un tubo
  selezionato a metà blu e a metà nero è peggio del difetto che si sta correggendo.

L'area di presa invisibile (`<path stroke="transparent" strokeWidth={16}>`) resta **una sola**, sulla
polilinea intera: il trascinamento del tratto non c'entra col tipo di tubo.

- [ ] **Passo 2: i tre comandi**

Nessun test nuovo, ma la suite intera deve restare verde e i riferimenti fermi.

- [ ] **Passo 3: commit**

```bash
git add src/components/schemaImpianto
git commit -m "feat(schema): anche la tela disegna il tubo a tronconi"
```

---

### Task 4: Il menu sulla valvola

**File:**
- Crea: `src/components/schemaImpianto/tipoTratto.ts`
- Test: `src/components/schemaImpianto/__tests__/tipoTratto.test.ts`
- Modifica: `src/components/schemaImpianto/useSegniTubo.ts` (il comando che scrive)
- Modifica: `src/components/schemaImpianto/SchemaEdgeTubazione.tsx` (il menu, e via il doppio clic)

**Interfacce:**
- Consuma: `SchemaSegnoTubo.stileAValle` (Task 1).
- Produce:
  - `export function cambioTipoTratto(stileArco, segni, indice, lato: 'da' | 'a', stile):
    { stileArco: SchemaArcoStile; segni: SchemaSegnoTubo[] }` in `tipoTratto.ts` — funzione pura:
    dice **dove** va scritto il tipo scelto.
  - `cambiaTipoTratto(arcoId, indice, lato, stile)` da `useSegniTubo`, che lo applica in cronologia.

**Il punto delicato è a quale campo scrivere.** «Verso il capo di arrivo» è sempre lo `stileAValle`
di questo segno. «Verso il capo di partenza» è lo `stileAValle` del segno che lo precede **lungo il
tubo** (non nell'array), e se non ce n'è nessuno prima è lo `stile` dell'arco.

- [ ] **Passo 1: i test della funzione pura**

```ts
import { describe, it, expect } from 'vitest'
import { cambioTipoTratto } from '../tipoTratto'
import type { SchemaSegnoTubo } from '@/services/schemaImpianto/types'

const segno = (id: string, t: number, stileAValle?: SchemaArcoStile): SchemaSegnoTubo => ({
  id,
  tipo: 'valvola_intercettazione',
  t,
  ...(stileAValle ? { stileAValle } : {}),
})

describe('cambioTipoTratto', () => {
  it('verso il capo di arrivo scrive sul segno stesso', () => {
    const esito = cambioTipoTratto('flessibile', [segno('V1', 0.5)], 0, 'a', 'standard')
    expect(esito.stileArco).toBe('flessibile')
    expect(esito.segni[0].stileAValle).toBe('standard')
  })

  it('verso il capo di partenza, senza nessun segno prima, scrive sullo stile dell’arco', () => {
    const esito = cambioTipoTratto('flessibile', [segno('V1', 0.5)], 0, 'da', 'standard')
    expect(esito.stileArco).toBe('standard')
    expect(esito.segni[0].stileAValle).toBeUndefined()
  })

  it('verso il capo di partenza scrive sul segno che precede LUNGO IL TUBO', () => {
    // L'ordine dell'array è l'inverso dell'ordine sul tubo: chi guarda l'indice invece della
    // posizione scrive sul segno sbagliato, e il cambio compare dall'altra parte del disegno.
    const segni = [segno('V2', 0.8, 'condensa'), segno('V1', 0.2, 'flessibile')]
    const esito = cambioTipoTratto('standard', segni, 0, 'da', 'standard')
    expect(esito.segni.find((s) => s.id === 'V1')!.stileAValle).toBe('standard')
    expect(esito.segni.find((s) => s.id === 'V2')!.stileAValle).toBe('condensa')
    expect(esito.stileArco).toBe('standard')
  })

  it('salta i segni che non dichiarano un tipo quando cerca il precedente', () => {
    // Una freccia o una valvola senza cambio non è un confine: il tratto «prima» comincia più
    // indietro, o dal capo dell'arco.
    const segni = [segno('V0', 0.1), segno('V1', 0.5)]
    const esito = cambioTipoTratto('flessibile', segni, 1, 'da', 'standard')
    expect(esito.stileArco).toBe('standard')
    expect(esito.segni.every((s) => s.stileAValle === undefined)).toBe(true)
  })

  it('non tocca gli altri campi del segno', () => {
    const esito = cambioTipoTratto('standard', [segno('V1', 0.42)], 0, 'a', 'flessibile')
    expect(esito.segni[0]).toMatchObject({ id: 'V1', tipo: 'valvola_intercettazione', t: 0.42 })
  })
})
```

- [ ] **Passo 2: vederli cadere, poi la funzione**

```ts
/**
 * Dove va scritto il tipo di tubazione scelto dal menu di un segno. «Verso il capo di arrivo» è
 * sempre lo `stileAValle` del segno stesso; «verso il capo di partenza» è quello del segno che lo
 * precede LUNGO IL TUBO — non nell'array, che è in ordine di creazione — e se prima non ce n'è
 * nessuno che dichiari un tipo, è lo stile dell'arco.
 *
 * Funzione pura in un file suo, non dentro il componente: `react-refresh` non lascia esportare
 * altro che componenti da un file di componenti, e questa logica va provata.
 */
export function cambioTipoTratto(
  stileArco: SchemaArcoStile,
  segni: SchemaSegnoTubo[],
  indice: number,
  lato: 'da' | 'a',
  stile: SchemaArcoStile
): { stileArco: SchemaArcoStile; segni: SchemaSegnoTubo[] } {
  const scelto = segni[indice]
  if (!scelto) return { stileArco, segni }

  if (lato === 'a') {
    return { stileArco, segni: segni.map((s, i) => (i === indice ? { ...s, stileAValle: stile } : s)) }
  }

  const precedente = segni
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.stileAValle && s.t < scelto.t)
    .sort((primo, secondo) => secondo.s.t - primo.s.t)[0]

  if (!precedente) return { stileArco: stile, segni }
  return {
    stileArco,
    segni: segni.map((s, i) => (i === precedente.i ? { ...s, stileAValle: stile } : s)),
  }
}
```

- [ ] **Passo 3: il comando in cronologia**

In `useSegniTubo.ts`, accanto ad `aggiungiSegno` (stesso schema: un gesto solo, sempre in
cronologia):

```ts
  const cambiaTipoTratto = useCallback(
    (arcoId: string, indice: number, lato: 'da' | 'a', stile: SchemaArcoStile) => {
      applica((s) => ({
        ...s,
        edges: s.edges.map((e) => {
          if (e.id !== arcoId) return e
          const dati = e.data as SchemaEdgeData
          const esito = cambioTipoTratto(dati.stile, dati.segni ?? [], indice, lato, stile)
          return { ...e, data: { ...dati, stile: esito.stileArco, segni: esito.segni } satisfies SchemaEdgeData }
        }),
      }))
    },
    [applica]
  )
```

Va restituito dall'hook e propagato agli archi come già fanno `onSpostaSegno` e `onRimuoviSegno`, in
`edgesConSegni`. Verificare che `SchemaEdgeData` porti `stile`: se non lo porta, il comando non può
scrivere sull'arco e va aggiunto lì.

- [ ] **Passo 4: il menu**

In `SchemaEdgeTubazione.tsx`, dentro `SchemaSegno`. Il taglio è quello di
`src/components/requests/SchedaStatoToggle.tsx` (`<Menu anchorEl … open={!!anchor} onClose={…}>`,
`Typography variant="overline"` per intestare i gruppi, `Divider` fra loro).

- Il clic apre il menu: `onClick={(e) => { e.stopPropagation(); setAnchor(e.currentTarget) }}`.
- **Il doppio clic sparisce**: togliere `onDoubleClick` e `suDoppioClic`, e mettere «Togli» in fondo
  al menu — chiamando la stessa `onRimuovi` di prima.
- In modo taratura il menu non si apre: `bloccato` già spegne `pointerEvents`, quindi non serve
  altro, ma **verificarlo in pagina**.
- Il menu compare solo su valvola e riduttore: sulla freccia il clic non apre niente
  (`tipo === 'freccia_direzione'` → nessun menu, e resta il doppio clic per toglierla, che per lei
  non confligge con nulla).
- I due nomi dei capi arrivano dall'arco: `SchemaSegnoProps` prende una prop nuova
  `capi: { da: string; a: string }`, valorizzata dal chiamante con le etichette dei nodi agli
  estremi. **L'etichetta del terminale utenze contiene un a capo** (`Utenze\naria`): nel menu va
  ridotta a una riga (`.replace(/\n/g, ' ')`), o la voce si spezza.

Le voci, per ciascuno dei due lati, sono i tre tipi di `STILI` (`SchemaEditor.tsx:110`) con la spunta
su quello attivo. **Non duplicare quell'elenco**: spostarlo in un modulo condiviso o importarlo, o
fra sei mesi i due elenchi diranno cose diverse.

- [ ] **Passo 5: i tre comandi**

- [ ] **Passo 6: commit**

```bash
git add src/components/schemaImpianto
git commit -m "feat(schema): dalla valvola si sceglie il tipo di tubo dei due tratti"
```

- [ ] **Passo 7: la prova in pagina**

Dev server sulla **5178** (la 5176 è servita dal worktree del Blocco 3: **verificare il processo
proprietario della porta**, non fidarsi del `--port`). Credenziali del committente.

Da provare, nell'ordine:
1. posare una valvola su una mandata flessibile, aprirla, scegliere **rigida verso il serbatoio**:
   il tubo deve ondulare fino alla valvola e proseguire dritto;
2. **trascinare** la valvola: il confine la segue;
3. scegliere **flessibile anche verso il compressore**: i due tronconi si fondono, il tubo torna
   tutto ondulato;
4. **toglierla dal menu**: il tubo torna intero;
5. **Ctrl+Z** dopo ognuna delle quattro;
6. l'**anteprima del documento** dentro l'editor deve mostrare la stessa cosa della tela;
7. **modo taratura acceso**: il clic sulla valvola non apre niente.

Tutto ciò che si scrive provando va scartato con «Annulla modifiche», e l'assenza va **riverificata
con una query diretta**: le pratiche con un layout salvato devono restare due (ORVED
`a8bbdbe1-f7ad-40d9-86a0-9483b5dcc7f4`, LOWA R&D `c6f56ca5-d57b-408c-a4e5-69a207812b0d`).

---

## Quando i quattro task sono chiusi

1. **I tre comandi** un'ultima volta.
2. **I tre riferimenti SVG devono essere ancora quelli**: `git diff` su
   `__tests__/fixtures/svgRiferimento*.ts` dev'essere vuoto per l'intero lavoro. È la prova che i
   disegni esistenti non sono cambiati.
3. **Mostrare al committente** il tubo che cambia tipo a metà, sulla sua pratica.
4. `git fetch`, **simulare il merge con `git merge-tree`**, poi chiedere il **via esplicito** prima
   del push: su `main` il deploy parte da solo.
5. A deploy verificato, `DOCUMENTAZIONE/fixes.md`: due righe, cosa cambia per chi usa
   l'applicazione. Una voce sola basta — «il tipo di tubazione può cambiare dove sta una valvola».
