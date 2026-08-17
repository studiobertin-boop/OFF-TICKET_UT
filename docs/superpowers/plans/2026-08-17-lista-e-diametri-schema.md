# La lista apparecchiature e il testo dei diametri — piano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** il testo dei diametri distingue i collegamenti in sala dalle linee di distribuzione, e la
tabella «LISTA APPARECCHIATURE» si stringe al proprio contenuto centrandosi — con la nota — sul
centro vero del disegno.

**Architecture:** tre modifiche in fila. `notaTubazioni` (`buildSchemaModel.ts`) legge le due coppie
di DN separatamente invece di fonderle. `layout.ts` espone una misura nuova, l'estensione
orizzontale del disegno (bordo sinistro **e** destro), da cui `dimensioniLayout` deriva la propria
larghezza — un punto di verità solo. `renderSvg.ts` calcola la larghezza che la tabella richiede,
posa tabella e nota come blocco centrato su quel centro, e passa a `renderTabella`/`renderNota` il
blocco invece della larghezza del foglio.

**Tech Stack:** TypeScript, Vitest. Funzioni pure, nessun DOM.

**Spec:** `docs/superpowers/specs/2026-08-17-lista-e-diametri-schema-design.md`

## Global Constraints

- **I tre riferimenti SVG si muovono, ed è voluto** (`src/services/schemaImpianto/__tests__/fixtures/svgRiferimento{SenzaTesti,ConTee,ConMuro}.ts`). Non si rigenerano per far tornare verde: si legge la differenza, si verifica che sia solo la fascia di nota e tabella più la larghezza del foglio, e il commit dice cosa cambiava. Task 5 fa esattamente questo, e nessun task prima di lui tocca i fixture.
- **Il disegno vero non cambia di una coordinata:** nodi, tubazioni, muro, annotazioni devono restare byte per byte quelli di prima dentro l'SVG.
- **Dicitura confermata dal committente:** `Ø` e iniziale maiuscola. `Collegamenti effettuati con tubazioni da …` e `Linee effettuate con tubazioni da …`.
- **Stima della larghezza del testo:** sempre `TESTO_LIBERO.larghezzaCarattere` (0,5) letto da `symbols/index.ts`. Mai un `0.5` scritto a mano.
- **Tre comandi verdi prima di chiudere qualunque task:** `npx vitest run`, `npx tsc --noEmit`, `npx eslint src/components/schemaImpianto src/services/schemaImpianto --max-warnings 0`.
- **Niente `prettier --write`:** il `.prettierrc` non corrisponde allo stile del codice.
- **Ogni test nuovo va visto cadere per mutazione.** La mutazione si ripristina **da una copia** (`cp` prima, `cp` indietro), **mai** con `git checkout`.
- **Non esportare funzioni da file di componenti:** fa scattare `react-refresh/only-export-components` e il lint gira a `--max-warnings 0`.

---

## File Structure

- `src/services/schemaImpianto/buildSchemaModel.ts` — `notaTubazioni`: da fusione unica a due coppie distinte.
- `src/services/schemaImpianto/layout.ts` — nuova `estensioneOrizzontale`; `dimensioniLayout` ne deriva la larghezza.
- `src/services/schemaImpianto/renderSvg.ts` — larghezza richiesta dalla tabella, posa del blocco centrato, nuove firme di `renderTabella` e `renderNota`.
- `src/services/schemaImpianto/__tests__/buildSchemaModel.test.ts` — casi della tabella di A1.
- `src/services/schemaImpianto/__tests__/layout.test.ts` — estensione orizzontale, e la derivazione di `dimensioniLayout`.
- `src/services/schemaImpianto/__tests__/renderSvg.test.ts` — larghezza adattiva, minimo dell'intestazione, centratura, sbordo a sinistra.
- `src/services/schemaImpianto/__tests__/fixtures/svgRiferimento*.ts` — aggiornati **solo** nel Task 5.

---

### Task 1: `notaTubazioni` distingue la sala dalla distribuzione

**Files:**
- Modify: `src/services/schemaImpianto/buildSchemaModel.ts:374-398`
- Test: `src/services/schemaImpianto/__tests__/buildSchemaModel.test.ts` (blocco `describe('notaTubazioni')`, oggi a partire da riga 350)

**Interfaces:**
- Consumes: niente.
- Produces: `notaTubazioni(scheda: SchedaDatiCompleta): string[]` — firma invariata, contenuto diverso. `renderSvg` la riceve già come `options.noteTubazioni` e sa comporre più righe.

- [ ] **Step 1: Riscrivi il blocco di test esistente**

Il test «riporta gli estremi anche se min e max sono scambiati» oggi si aspetta **una** riga che
fonde tutti e quattro i valori: con la regola nuova quella riga non esiste più. Sostituisci
l'intero `describe('notaTubazioni', ...)` con questo:

```ts
describe('notaTubazioni', () => {
  it('non dice nulla quando la scheda non dichiara diametri', () => {
    expect(notaTubazioni(makeScheda({ dati_impianto: makeDatiImpianto() }))).toEqual([])
  })

  // Il riquadro parla dei collegamenti in sala: senza quelli non ha di che parlare, e le linee
  // di distribuzione da sole non bastano a farlo comparire. Scelta del committente, non
  // conseguenza tecnica.
  it('tace se la scheda dichiara solo i diametri delle linee di distribuzione', () => {
    const scheda = makeScheda({
      dati_impianto: makeDatiImpianto({ dn_distribuzione_min: 32, dn_distribuzione_max: 50 }),
    })
    expect(notaTubazioni(scheda)).toEqual([])
  })

  it('con i soli collegamenti in sala scrive una riga sola', () => {
    const scheda = makeScheda({
      dati_impianto: makeDatiImpianto({ dn_sala_min: 15, dn_sala_max: 25 }),
    })
    expect(notaTubazioni(scheda)).toEqual(['Collegamenti effettuati con tubazioni da Ø15 a Ø25mm'])
  })

  it('con entrambi i gruppi scrive due righe, e non mescola i loro diametri', () => {
    const scheda = makeScheda({
      dati_impianto: makeDatiImpianto({
        dn_sala_min: 15,
        dn_sala_max: 25,
        dn_distribuzione_min: 32,
        dn_distribuzione_max: 50,
      }),
    })
    expect(notaTubazioni(scheda)).toEqual([
      'Collegamenti effettuati con tubazioni da Ø15 a Ø25mm',
      'Linee effettuate con tubazioni da Ø32 a Ø50mm',
    ])
  })

  // In scheda capita che min e max siano invertiti: gli estremi si ricavano dai valori presenti.
  // Il confronto avviene DENTRO la coppia, non fra tutte e quattro: qui la sala arriva a 25 e la
  // distribuzione parte da 25, e una fusione le farebbe collassare in un intervallo solo.
  it('raddrizza gli estremi scambiati dentro ciascuna coppia', () => {
    const scheda = makeScheda({
      dati_impianto: makeDatiImpianto({
        dn_sala_min: 25,
        dn_sala_max: 20,
        dn_distribuzione_min: 40,
        dn_distribuzione_max: 25,
      }),
    })
    expect(notaTubazioni(scheda)).toEqual([
      'Collegamenti effettuati con tubazioni da Ø20 a Ø25mm',
      'Linee effettuate con tubazioni da Ø25 a Ø40mm',
    ])
  })

  it('usa la forma singola quando gli estremi coincidono', () => {
    const scheda = makeScheda({
      dati_impianto: makeDatiImpianto({ dn_sala_min: 15, dn_sala_max: 15 }),
    })
    expect(notaTubazioni(scheda)).toEqual(['Collegamenti effettuati con tubazioni da Ø15mm'])
  })

  // I quattro campi sono indipendenti e capita di trovarne compilato uno solo: un estremo che
  // c'è si stampa, non si tace.
  it('usa la forma singola anche quando la coppia è compilata a metà', () => {
    const scheda = makeScheda({
      dati_impianto: makeDatiImpianto({ dn_sala_min: 15, dn_distribuzione_max: 50 }),
    })
    expect(notaTubazioni(scheda)).toEqual([
      'Collegamenti effettuati con tubazioni da Ø15mm',
      'Linee effettuate con tubazioni da Ø50mm',
    ])
  })
})
```

- [ ] **Step 2: Vedi cadere i test nuovi**

Run: `npx vitest run src/services/schemaImpianto/__tests__/buildSchemaModel.test.ts -t "notaTubazioni"`
Expected: FAIL. In particolare «tace se la scheda dichiara solo i diametri delle linee di
distribuzione» riceve `['Collegamenti effettuati con tubazioni da Ø32 a Ø50mm']` invece di `[]`, e
«con entrambi i gruppi» riceve una riga sola invece di due.

- [ ] **Step 3: Riscrivi `notaTubazioni`**

Sostituisci il commento di testa e il corpo della funzione (`buildSchemaModel.ts:374-398`) con:

```ts
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
 * Nota sui diametri stampata sotto lo schema, come nelle relazioni storiche. Legge i DN in mm e
 * non i vecchi campi a testo libero.
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
```

- [ ] **Step 4: Verifica che passino**

Run: `npx vitest run src/services/schemaImpianto/__tests__/buildSchemaModel.test.ts -t "notaTubazioni"`
Expected: PASS, 7 test.

- [ ] **Step 5: Vedi cadere i test per mutazione**

```bash
cp src/services/schemaImpianto/buildSchemaModel.ts /tmp/bsm.bak
```

Muta `if (!sala) return []` in `if (!sala && !estremiDn([d?.dn_distribuzione_min, d?.dn_distribuzione_max])) return []`.
Run: `npx vitest run src/services/schemaImpianto/__tests__/buildSchemaModel.test.ts -t "notaTubazioni"`
Expected: FAIL su «tace se la scheda dichiara solo i diametri delle linee di distribuzione».

Poi muta `min === max` in `min <= max`.
Expected: FAIL su entrambi i test che si aspettano una forma a intervallo.

```bash
cp /tmp/bsm.bak src/services/schemaImpianto/buildSchemaModel.ts
```

- [ ] **Step 6: I tre comandi, e commit**

```bash
npx vitest run && npx tsc --noEmit && npx eslint src/components/schemaImpianto src/services/schemaImpianto --max-warnings 0
```

Nota: `npx vitest run` completo **fallirà sui tre riferimenti SVG** se e solo se questo task ha
cambiato il testo di un impianto che i fixture rappresentano. I fixture non passano note
(`renderSvg(layoutConTesti([]))` senza `options`), quindi devono restare verdi: se cadono, la
causa è un'altra e va capita prima di proseguire.

```bash
git add src/services/schemaImpianto/buildSchemaModel.ts src/services/schemaImpianto/__tests__/buildSchemaModel.test.ts
git commit -m "feat(schema): il testo dei diametri distingue la sala dalle linee di distribuzione"
```

---

### Task 2: `layout.ts` sa dove il disegno comincia, non solo dove finisce

**Files:**
- Modify: `src/services/schemaImpianto/layout.ts:349-411`
- Test: `src/services/schemaImpianto/__tests__/layout.test.ts`

**Interfaces:**
- Consumes: `riquadroDi` e `ingombroTesto`, già in uso in `dimensioniLayout`.
- Produces:
  ```ts
  export function estensioneOrizzontale(
    nodi: SchemaNodoPosizionato[],
    testi: SchemaTestoLibero[],
    muro: SchemaLayout['muro'],
    libreria?: Tarature
  ): { sinistra: number; destra: number }
  ```
  Task 3 la usa per centrare tabella e nota; il Task 1 del piano delle code aperte la usa per
  posare a destra i nuovi oggetti. `dimensioniLayout` mantiene la firma di oggi.

- [ ] **Step 1: Scrivi i test che cadono**

Aggiungi in `layout.test.ts`, accanto al `describe` che contiene già «la larghezza segue la riga
più lunga, non il numero di righe»:

```ts
describe('estensioneOrizzontale', () => {
  const vuoto: SchemaLayout = { nodi: [], archi: [], muro: null, testi: [] }

  it('su una tela vuota dichiara un disegno largo quanto i due margini', () => {
    const e = estensioneOrizzontale(vuoto.nodi, vuoto.testi, vuoto.muro)
    expect(e.destra - e.sinistra).toBe(0)
    // La larghezza che `dimensioniLayout` ne deriva resta quella di sempre: MARGINE * 2.
    expect(dimensioniLayout(vuoto).larghezza).toBe(80)
  })

  it('il bordo sinistro è quello del nodo più a sinistra, non zero', () => {
    const layout = { ...vuoto, nodi: [nodoA('S1', 300, 0), nodoA('C1', 500, 0)] }
    expect(estensioneOrizzontale(layout.nodi, layout.testi, layout.muro).sinistra).toBe(300)
  })

  it('un’annotazione più a sinistra di ogni apparecchiatura sposta il bordo sinistro', () => {
    const layout = {
      ...vuoto,
      nodi: [nodoA('C1', 300, 0)],
      testi: [{ id: 'T1', x: 120, y: 0, contenuto: 'Nota' }],
    }
    expect(estensioneOrizzontale(layout.nodi, layout.testi, layout.muro).sinistra).toBe(120)
  })

  it('un muro posato a sinistra di tutto conta come bordo sinistro', () => {
    const layout = { ...vuoto, nodi: [nodoA('C1', 300, 0)], muro: { x: 100, yMin: 0, yMax: 200 } }
    expect(estensioneOrizzontale(layout.nodi, layout.testi, layout.muro).sinistra).toBe(100)
  })

  // `dimensioniLayout` non deve più calcolarsi la larghezza per conto suo: due percorsi paralleli
  // sullo stesso ingombro divergerebbero al primo ritocco a uno dei due.
  it('la larghezza di dimensioniLayout è il bordo destro più un margine', () => {
    const layout = { ...vuoto, nodi: [nodoA('C1', 300, 0), nodoA('S1', 800, 0)] }
    const destra = estensioneOrizzontale(layout.nodi, layout.testi, layout.muro).destra
    expect(dimensioniLayout(layout).larghezza).toBe(destra + 40)
  })
})
```

Serve un costruttore di nodo posizionato: se `layout.test.ts` non ne ha già uno riusabile,
aggiungi accanto agli altri aiutanti del file

```ts
function nodoA(id: string, x: number, y: number): SchemaNodoPosizionato {
  return { id, tipo: 'serbatoio', etichetta: id, origine: 'scheda', x, y }
}
```

adattando i campi obbligatori a quelli che `SchemaNodoPosizionato` dichiara in `types.ts` — usa
come modello un nodo già costruito altrove nello stesso file di test, così i campi restano quelli
veri. Importa `estensioneOrizzontale` dal modulo sotto test.

- [ ] **Step 2: Vedi cadere i test**

Run: `npx vitest run src/services/schemaImpianto/__tests__/layout.test.ts -t "estensioneOrizzontale"`
Expected: FAIL con «estensioneOrizzontale is not a function» / errore di import.

- [ ] **Step 3: Estrai la funzione e fai derivare `dimensioniLayout`**

In `layout.ts`, sopra `dimensioniLayout`, aggiungi:

```ts
/**
 * Bordo sinistro e bordo destro del disegno, in coordinate della tela. `dimensioniLayout` ne
 * deriva la propria larghezza, `renderSvg` ne ricava il centro su cui posare nota e tabella, e la
 * posa dei nuovi oggetti ne legge il bordo destro: un punto di verità solo, perché due percorsi
 * paralleli sullo stesso ingombro divergerebbero al primo ritocco a uno dei due.
 *
 * Gli ingredienti sono quelli che `dimensioniLayout` già usava: `riquadroDi` per i nodi (non
 * `dimensioniDi` — vedi il suo commento poco sotto), `ingombroTesto` per le annotazioni, e il muro
 * col suo spessore.
 */
export function estensioneOrizzontale(
  nodi: SchemaNodoPosizionato[],
  testi: SchemaTestoLibero[],
  muro: SchemaLayout['muro'],
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
```

Poi, dentro `dimensioniLayout`, sostituisci il calcolo di `maxX` e il `return` finale con:

```ts
  const destra = estensioneOrizzontale(layout.nodi, testi, layout.muro, libreria).destra
  const maxY = Math.max(
    ...riquadri.map(({ nodo, riquadro }) => nodo.y + riquadro.y + riquadro.altezza),
    ...ingombriTesti.map((i) => i.basso)
  )
  return { larghezza: destra + MARGINE, altezza: maxY + MARGINE }
```

`riquadri` e `ingombriTesti` restano dove sono: servono ancora a `maxY`. Togli la riga che
calcolava `maxX`.

Verifica che `SchemaNodoPosizionato` e `SchemaTestoLibero` siano fra gli import di tipo del file;
`SPESSORE_MURO` c'è già.

- [ ] **Step 4: Verifica che passino**

Run: `npx vitest run src/services/schemaImpianto/__tests__/layout.test.ts`
Expected: PASS, compresi i test preesistenti su `dimensioniLayout`, che non devono cambiare valore.

- [ ] **Step 5: Vedi cadere i test per mutazione**

```bash
cp src/services/schemaImpianto/layout.ts /tmp/layout.bak
```

Muta `sinistra` in `Math.min(...) ` senza i testi (togli la riga `...testi.map((t) => t.x)`).
Expected: FAIL su «un'annotazione più a sinistra di ogni apparecchiatura sposta il bordo sinistro».

Poi muta `nodo.x + riquadro.x` in `nodo.x` nel calcolo di `sinistra`.
Expected: nessun test cade con i nodi non tarati (riquadro.x è zero). **Questo è atteso** e va
lasciato così: il ramo tarato è coperto dai test di `dimensioniLayout` sul bordo destro, e
aggiungere qui un test su una taratura duplicherebbe quella copertura. Annotalo e prosegui.

```bash
cp /tmp/layout.bak src/services/schemaImpianto/layout.ts
```

- [ ] **Step 6: I tre comandi, e commit**

```bash
npx vitest run && npx tsc --noEmit && npx eslint src/components/schemaImpianto src/services/schemaImpianto --max-warnings 0
git add src/services/schemaImpianto/layout.ts src/services/schemaImpianto/__tests__/layout.test.ts
git commit -m "feat(schema): il layout dichiara anche dove il disegno comincia"
```

I tre riferimenti SVG devono essere ancora verdi: questo task non cambia una coordinata.

---

### Task 3: la tabella si stringe al contenuto, con l'intestazione come minimo

**Files:**
- Modify: `src/services/schemaImpianto/renderSvg.ts:267-306` (`renderTabella`), `:307-320` (`renderNota`), `:330-362` (`renderSvg`)
- Test: `src/services/schemaImpianto/__tests__/renderSvg.test.ts`

**Interfaces:**
- Consumes: `estensioneOrizzontale` dal Task 2; `TESTO_LIBERO.larghezzaCarattere` da `symbols`, già importato in questo file.
- Produces: nessuna esportazione nuova. `renderTabella(righe, x, larghezza, yTop)` e
  `renderNota(note, centro, yTop)` restano interne al modulo.

- [ ] **Step 1: Scrivi i test che cadono**

Aggiungi in `renderSvg.test.ts` un `describe` nuovo. `svgMinimo` esiste già in cima al file e
accetta le note.

```ts
describe('la fascia sotto il disegno', () => {
  /** Larghezza dichiarata dal rettangolo di intestazione della tabella. */
  function larghezzaTabella(svg: string): number {
    // L'intestazione è l'unico rect disegnato con lo spessore di tratto pieno dopo il fondo
    // bianco: la si trova dal testo che porta, risalendo al rect che la precede.
    const i = svg.indexOf('LISTA APPARECCHIATURE')
    const prima = svg.lastIndexOf('<rect', i)
    return Number(/width="([\d.]+)"/.exec(svg.slice(prima, i))![1])
  }

  function xTabella(svg: string): number {
    const i = svg.indexOf('LISTA APPARECCHIATURE')
    const prima = svg.lastIndexOf('<rect', i)
    return Number(/x="([\d.]+)"/.exec(svg.slice(prima, i))![1])
  }

  it('non è più larga quanto tutto il foglio', () => {
    const svg = svgMinimo()
    const foglio = Number(/<svg[^>]*width="([\d.]+)"/.exec(svg)![1])
    expect(larghezzaTabella(svg)).toBeLessThan(foglio - 80)
  })

  // Il minimo è l'intestazione in corpo 20: su un elenco corto sarebbe lei a sporgere.
  it('non scende sotto la larghezza dell’intestazione', () => {
    const svg = svgMinimo()
    const minimo = 'LISTA APPARECCHIATURE'.length * 20 * 0.5
    expect(larghezzaTabella(svg)).toBeGreaterThanOrEqual(minimo)
  })

  it('si allarga quando una descrizione è lunga', () => {
    const corta = larghezzaTabella(svgMinimo())
    const lunga = larghezzaTabella(svgConEtichettaLunga())
    expect(lunga).toBeGreaterThan(corta)
  })

  // Confronto prima/dopo, non un valore assoluto: un test che si aspettasse una coordinata fissa
  // tornerebbe verde anche se la centratura sparisse e il numero coincidesse per caso.
  it('la tabella segue il disegno quando il disegno si sposta a destra', () => {
    const fermo = xTabella(svgMinimo())
    const spostato = xTabella(svgSpostatoADestra(400))
    expect(spostato - fermo).toBeCloseTo(400, 5)
  })

  it('nota e tabella condividono lo stesso centro', () => {
    const svg = svgMinimo(['Collegamenti effettuati con tubazioni da Ø15 a Ø25mm'])
    const centroTabella = xTabella(svg) + larghezzaTabella(svg) / 2
    // Il testo della nota è composto centrato: la sua `x` È il centro del riquadro.
    const centroNota = Number(
      /<text x="([\d.]+)"[^>]*>Collegamenti effettuati/.exec(svg)![1]
    )
    expect(centroNota).toBeCloseTo(centroTabella, 5)
  })

  it('un blocco che sborda a sinistra si riporta dentro il margine', () => {
    // Disegno stretto e appoggiato all'origine: centrato, il blocco comincerebbe a coordinate
    // negative e uscirebbe dalla tela.
    expect(xTabella(svgStrettoASinistra())).toBeGreaterThanOrEqual(40)
  })
})
```

Servono tre aiutanti accanto a `svgMinimo`, costruiti sulla sua stessa scheda:

```ts
/** Come `svgMinimo`, con la scritta del terminale utenze allungata: allarga la descrizione. */
function svgConEtichettaLunga() { /* vedi Step 1b */ }
/** Come `svgMinimo`, con ogni nodo traslato di `dx`. */
function svgSpostatoADestra(dx: number) { /* vedi Step 1b */ }
/** Un impianto stretto con il bordo sinistro all'origine. */
function svgStrettoASinistra() { /* vedi Step 1b */ }
```

- [ ] **Step 1b: Scrivi i tre aiutanti**

`svgMinimo` costruisce una scheda e ne rende il layout. Ricalca la sua forma:

```ts
function layoutMinimo() {
  const scheda = makeScheda({
    compressori: [makeCompressore({ ha_disoleatore: false })],
    disoleatori: [],
    serbatoi: [makeSerbatoio({ orientamento: 'ORIZZONTALE' })],
    essiccatori: [],
    scambiatori: [],
    filtri: [],
    dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
  })
  return layoutSchema(buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } }))
}

function svgConEtichettaLunga() {
  const layout = layoutMinimo()
  const utenze = layout.nodi.find((n) => n.tipo === 'utenze')!
  utenze.etichetta = 'Utenze aria compressa del reparto di verniciatura e assemblaggio'
  return renderSvg(layout)
}

function svgSpostatoADestra(dx: number) {
  const layout = layoutMinimo()
  return renderSvg({ ...layout, nodi: layout.nodi.map((n) => ({ ...n, x: n.x + dx })) })
}

function svgStrettoASinistra() {
  const layout = layoutMinimo()
  const sinistra = Math.min(...layout.nodi.map((n) => n.x))
  return renderSvg({ ...layout, nodi: layout.nodi.map((n) => ({ ...n, x: n.x - sinistra })) })
}
```

Allinea i nomi degli aiutanti (`makeScheda`, `layoutSchema`, …) a quelli davvero importati in cima
al file di test: `svgMinimo` li usa già, copiali da lì.

- [ ] **Step 2: Vedi cadere i test**

Run: `npx vitest run src/services/schemaImpianto/__tests__/renderSvg.test.ts -t "la fascia sotto il disegno"`
Expected: FAIL. «non è più larga quanto tutto il foglio» e «la tabella segue il disegno» falliscono
di sicuro; «nota e tabella condividono lo stesso centro» può passare per caso oggi (la nota è
centrata sul foglio e la tabella lo riempie) — **non fidarti di quel verde**, lo si conferma per
mutazione allo Step 5.

- [ ] **Step 3: Implementa**

In `renderSvg.ts`, sotto le costanti in cima (`MARGINE`, `RIGA_TABELLA`, `COLONNA_CODICE`,
`ALTEZZA_NOTA`), aggiungi:

```ts
/** Aria fra il bordo della cella e la descrizione, a sinistra e a destra. */
const RIENTRO_DESCRIZIONE = 12
/** Larghezza del riquadro della nota: invariata da sempre, cambia solo il centro su cui si posa. */
const LARGHEZZA_NOTA = 680
const INTESTAZIONE_TABELLA = 'LISTA APPARECCHIATURE'

/**
 * Larghezza che la tabella richiede: la colonna dei codici, fissa, più la descrizione più lunga.
 * Fino al 17-08-2026 la tabella occupava tutto il foglio, e su un disegno largo le righe restavano
 * quasi vuote.
 *
 * Il minimo è l'intestazione, in corpo 20 e quindi più larga delle righe: senza, su un elenco
 * corto sarebbe lei a sporgere. La stima del testo è quella già in uso nel modulo
 * (`TESTO_LIBERO.larghezzaCarattere`), non tipografia vera: serve a dimensionare un riquadro, e
 * misurare i glifi richiederebbe un DOM che questa funzione non ha.
 */
function larghezzaRichiestaTabella(righe: RigaTabella[]): number {
  const piuLunga = Math.max(0, ...righe.map((r) => r.descrizione.length))
  const descrizione = RIENTRO_DESCRIZIONE * 2 + piuLunga * 16 * TESTO_LIBERO.larghezzaCarattere
  const intestazione =
    INTESTAZIONE_TABELLA.length * 20 * TESTO_LIBERO.larghezzaCarattere + RIENTRO_DESCRIZIONE * 2
  return Math.max(COLONNA_CODICE + descrizione, intestazione)
}

/** Blocco largo `larghezza` centrato su `centro`, riportato dentro il margine se sborda a sinistra. */
function bloccoCentrato(centro: number, larghezza: number): { x: number; larghezza: number } {
  return { x: Math.max(MARGINE, centro - larghezza / 2), larghezza }
}
```

`renderTabella` riceve il blocco invece del foglio — cambiano solo le prime due righe del corpo e
la firma; il resto del corpo, che già lavora su `x` e `w`, non si tocca:

```ts
function renderTabella(righe: RigaTabella[], x: number, w: number, yTop: number): string {
  const parti: string[] = []
  …
```

Sostituisci anche `INTESTAZIONE_TABELLA` al testo letterale dentro il `<text>` dell'intestazione,
così la stima e il disegno leggono la stessa stringa.

`renderNota` riceve il centro e si dimensiona da sé:

```ts
function renderNota(note: string[], centro: number, yTop: number): string {
  if (note.length === 0) return ''
  const { x, larghezza: w } = bloccoCentrato(centro, LARGHEZZA_NOTA)
  const h = 24 * note.length + 24
  const righe = note
    .map(
      (nota, i) =>
        `<text x="${x + w / 2}" y="${yTop + 24 + i * 24}" font-family="${FONT}" font-size="18" text-anchor="middle" dominant-baseline="central" fill="#000">${escapeXml(nota)}</text>`
    )
    .join('')
  return `<rect x="${x}" y="${yTop}" width="${w}" height="${h}" fill="none" stroke="#000" stroke-width="${TRATTO}" />${righe}`
}
```

In `renderSvg`, sostituisci le due righe di `larghezzaTabella`/`larghezzaTotale` con:

```ts
  // Tabella e nota si centrano sul disegno vero, non sul foglio: è ciò che il committente ha
  // chiesto il 17-08-2026, e vale per entrambe — così le due fasce restano incolonnate fra loro e
  // con ciò che sta sopra. Il foglio si allarga a destra quanto serve a contenerle.
  const estensione = estensioneOrizzontale(layout.nodi, layout.testi ?? [], layout.muro, libreria)
  const centro = (estensione.sinistra + estensione.destra) / 2
  const tabella = bloccoCentrato(centro, larghezzaRichiestaTabella(righe))
  const nota = bloccoCentrato(centro, LARGHEZZA_NOTA)
  const larghezzaTotale = Math.max(
    dimensioniDisegno.larghezza,
    tabella.x + tabella.larghezza + MARGINE,
    ...(note.length > 0 ? [nota.x + nota.larghezza + MARGINE] : [])
  )
```

e le due chiamate in coda:

```ts
    renderNota(note, centro, yNota),
    renderTabella(righe, tabella.x, tabella.larghezza, yTabella),
```

Aggiungi `estensioneOrizzontale` all'import da `./layout` in cima al file.

- [ ] **Step 4: Verifica i test nuovi**

Run: `npx vitest run src/services/schemaImpianto/__tests__/renderSvg.test.ts -t "la fascia sotto il disegno"`
Expected: PASS, 6 test.

- [ ] **Step 5: Vedi cadere i test per mutazione**

```bash
cp src/services/schemaImpianto/renderSvg.ts /tmp/render.bak
```

Muta `renderNota(note, centro, yNota)` in `renderNota(note, larghezzaTotale / 2, yNota)` — la
centratura di prima.
Expected: FAIL su «nota e tabella condividono lo stesso centro». **Se non cade, il test è verde per
la ragione sbagliata e va riscritto prima di proseguire.**

Poi togli il `Math.max` con l'intestazione da `larghezzaRichiestaTabella`.
Expected: FAIL su «non scende sotto la larghezza dell'intestazione».

Poi muta `bloccoCentrato` in `{ x: centro - larghezza / 2, larghezza }` (senza il riporto al margine).
Expected: FAIL su «un blocco che sborda a sinistra si riporta dentro il margine».

```bash
cp /tmp/render.bak src/services/schemaImpianto/renderSvg.ts
```

- [ ] **Step 6: `tsc` e `eslint`, poi fermati**

```bash
npx tsc --noEmit && npx eslint src/components/schemaImpianto src/services/schemaImpianto --max-warnings 0
```

**Non committare ancora e non lanciare `npx vitest run` completo aspettandoti il verde:** i tre
riferimenti SVG ora cadono, ed è il Task 4 a leggerne la differenza. Se `tsc` o `eslint` non sono
puliti, si risolvono qui.

---

### Task 4: leggi la differenza dei tre riferimenti, poi aggiornali

**Files:**
- Modify: `src/services/schemaImpianto/__tests__/fixtures/svgRiferimentoSenzaTesti.ts`, `svgRiferimentoConTee.ts`, `svgRiferimentoConMuro.ts`

**Interfaces:**
- Consumes: il codice del Task 3, non committato.
- Produces: niente.

**Questo task esiste per un solo motivo: verificare che il disegno non sia cambiato.** Aggiornare i
fixture per far tornare verde un test, senza leggere cosa cambia, è la cosa che questo progetto
vieta esplicitamente.

- [ ] **Step 1: Cattura vecchio e nuovo**

```bash
npx vitest run src/services/schemaImpianto/__tests__/renderSvg.test.ts -t "identico al riferimento" --reporter=verbose > /tmp/rif.txt 2>&1
npx vitest run src/services/schemaImpianto/__tests__/renderSvg.test.ts -t "resta identico a prima" --reporter=verbose >> /tmp/rif.txt 2>&1
```

Expected: FAIL sui tre. Vitest stampa il diff fra atteso e ricevuto.

- [ ] **Step 2: Verifica che il disegno non sia cambiato**

Per ciascuno dei tre, controlla che nel diff **compaiano soltanto**:

- l'attributo `width` e il `viewBox` del tag `<svg>` di testa, e la `width` del `<rect>` di fondo bianco;
- il `<rect>` e i `<text>` del riquadro della nota, se il fixture ne ha uno;
- i `<rect>`, le `<line>` e i `<text>` della tabella, con `x` e `width` diversi;

e che **non compaia**: nessun `<path>`, nessun `transform="translate(…)"` di nodo, nessun
`stroke-dasharray`, nessun `<g>` di simbolo, nessuna coordinata di tubazione o di muro.

Un modo rapido di confermarlo: la porzione di stringa che va dal `<defs>` fino alla prima
occorrenza di `LISTA APPARECCHIATURE` deve essere **identica**, tolti `width` e `viewBox` del tag
`<svg>` e la `width` del rettangolo bianco. Se qualcosa lì dentro è cambiato, **fermati**: è un
difetto del Task 3, non un aggiornamento da accettare.

- [ ] **Step 3: Aggiorna i tre fixture**

Sostituisci in ciascun file la stringa con quella nuova, presa dal «received» del diff. **Non
toccare i commenti di testa dei fixture**, che spiegano da quale commit vengono e perché
esistono — ma aggiungi in coda a ciascuno una riga che dica che il 17-08-2026 sono stati aggiornati
per la tabella stretta e centrata, e che il disegno non era cambiato.

- [ ] **Step 4: Verifica il verde pieno**

```bash
npx vitest run && npx tsc --noEmit && npx eslint src/components/schemaImpianto src/services/schemaImpianto --max-warnings 0
```

Expected: 97 file, tutti verdi.

- [ ] **Step 5: Commit**

```bash
git add src/services/schemaImpianto/renderSvg.ts src/services/schemaImpianto/__tests__/renderSvg.test.ts src/services/schemaImpianto/__tests__/fixtures
git commit -m "feat(schema): la lista apparecchiature si stringe al contenuto e si centra sul disegno"
```

Il corpo del messaggio deve dire, in prosa: che i tre riferimenti si sono mossi, che cosa
esattamente si è mosso (larghezza del foglio, fascia della nota, fascia della tabella) e che il
disegno — nodi, tubazioni, muro — è rimasto identico.

---

### Task 5: prova in pagina

**Files:** nessuno.

- [ ] **Step 1: Avvia il dev server e verifica da dove gira**

```bash
npx vite --port 5180
```

Poi, in un'altra shell, risali al processo proprietario della porta e leggi la sua `CommandLine`:

```powershell
Get-NetTCPConnection -LocalPort 5180 -State Listen | ForEach-Object { Get-CimInstance Win32_Process -Filter "ProcessId = $($_.OwningProcess)" | Select-Object CommandLine }
```

**Non fidarti del `--port`:** su questo progetto una porta è già risultata servita dal worktree di
un blocco vecchio, e le prove sarebbero passate mostrando il codice sbagliato. Un dev server
avviato in background da un comando che poi si chiude muore con lui.

- [ ] **Step 2: Apri l'anteprima di una pratica con layout salvato**

ORVED (`a8bbdbe1-f7ad-40d9-86a0-9483b5dcc7f4`) o LOWA R&D (`c6f56ca5-d57b-408c-a4e5-69a207812b0d`).
Verifica a occhio:

- la tabella è stretta quanto la descrizione più lunga, non quanto il foglio;
- tabella e nota sono incolonnate fra loro e centrate sul disegno;
- l'intestazione «LISTA APPARECCHIATURE» sta dentro il suo rettangolo;
- il testo dei diametri dice quello che la scheda dichiara, con le righe giuste.

Non salvare nulla. Escape chiude l'editor scartando le modifiche.

- [ ] **Step 3: Riferisci al committente con una schermata**

---

## Self-review

**Copertura della specifica.** A1 → Task 1 (tutte e sei le combinazioni della tabella, più la
coppia a metà). A2, larghezza adattiva → Task 3; minimo dell'intestazione → Task 3; centratura di
tabella e nota → Task 3; misura nuova con punto di verità unico → Task 2; sbordo a sinistra e
allargamento a destra → Task 3. Riferimenti SVG → Task 4. Prova in pagina → Task 5.

**Coerenza dei nomi.** `estensioneOrizzontale` (Task 2) è usata con la stessa firma nel Task 3.
`bloccoCentrato` e `larghezzaRichiestaTabella` nascono e si usano nel Task 3.
`RIENTRO_DESCRIZIONE` sostituisce il `12` letterale che `renderTabella` usa già per il rientro
della descrizione: verificarlo alla riga del `<text>` della descrizione.

**Un punto che l'esecutore deve decidere in corso d'opera:** i nomi degli aiutanti di
`renderSvg.test.ts` (`makeScheda`, `layoutSchema`, `makeCompressore`, …) vanno copiati da
`svgMinimo`, che sta in cima allo stesso file — non sono inventati qui, ma nemmeno verificati uno
per uno.
