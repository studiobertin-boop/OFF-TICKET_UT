# Schema d'impianto DM329 — Blocco 5: la giunzione di monte in alto

> **Per chi esegue:** SOTTO-SKILL RICHIESTA: `superpowers:executing-plans`, task per task, col gate
> a ogni passo. I passi usano caselle (`- [ ]`).

**Obiettivo:** la giunzione di monte di un by-pass si posa alla quota dell'uscita del serbatoio, e
il ponte parte da lì: corre orizzontale e **scende** sulla giunzione di valle, che resta sulla
linea di processo. È la forma che `si bypass.png` mostra, ed è **asimmetrica di proposito**.

**Architettura:** invariata nei confini. Cambiano tre cose, in tre file che si toccano:
`layout.ts` decide una quota in più (dove si posa una `-IN`), `segniAncorati.ts` toglie un gomito
al ponte e una condizione al gradino, `buildSchemaModel.ts` ridistribuisce le tre valvole fra due
archi invece che uno. Nessun modulo nuovo, nessun campo nuovo nei tipi, formato salvato invariato.

**Stack:** TypeScript (strict=false), Vitest, nessuna libreria nuova. `sharp` è già fra le
dipendenze e serve solo agli attrezzi di misura, che non entrano nel prodotto.

**Specifica:** `docs/superpowers/specs/2026-08-17-schema-impianto-prima-versione-design.md`
— **va letta con le tre correzioni** elencate sotto, in «Cosa la specifica dice male».
**Consegna:** `docs/superpowers/2026-08-18-prossima-sessione-blocco5-giunzione-in-alto.md`
**Piano precedente:** `docs/superpowers/plans/2026-08-18-schema-impianto-prima-versione-blocco4.md`
(«Come si misura» è lo strumento di lavoro di questo blocco; «Cosa è andato diversamente» in coda).

**Riferimento visivo, in git:** `DOCUMENTAZIONE/relazione/si bypass.png` (643×253). **È il metro di
questo blocco.**

**Ramo:** `worktree-schema-prima-versione-blocco1`, worktree
`.claude/worktrees/schema-prima-versione-blocco1`. **Questo è l'ULTIMO blocco della specifica**:
dopo restano la prova in pagina, la pulizia e la pubblicazione, che non sono blocchi ma non sono
nemmeno formalità (vedi «Le attività finali» in coda).

---

## Vincoli globali

- **Baseline misurata all'apertura, commit `f068758`: 1462 test verdi, 101 file**, `tsc` pulito.
- **`.env.local` va copiato dal checkout principale nel worktree** (è git-ignored) o un file di
  test fallisce per variabili mancanti. **Già fatto in apertura di sessione.** Contiene anche
  `APP_LOGIN_EMAIL` / `APP_LOGIN_PASSWORD` (ruolo admin) per la prova in pagina: **non chiederle al
  committente, e non stamparle mai.**
- **Niente `prettier --write`.**
- **Nessun test di interfaccia** (`CLAUDE.md`): la logica provabile va in servizi e funzioni pure.
- **Decisioni del committente che questo piano NON riapre:**
  - la giunzione di **monte** va in alto, quella di **valle** resta sulla linea — asimmetrico;
  - `GIOCO_FRA_STADI = 20`; il tratteggio delle condense si fasa con `stroke-dashoffset`;
  - la dorsale la quotano i **compressori e loro soli**;
  - il gradino dal serbatoio resta a metà strada (nel caso col by-pass sparisce da sé: i due capi
    dell'arco `S1 → BP1-IN` finiscono alla stessa quota, e `gradinoVersoIlTee` non emette nulla);
  - **`PASSO_SERBATOI = 20` non è misurato** e resta così finché non arriva un disegno con due
    serbatoi affiancati. **Chiederlo, non indovinare.**
  - il merge si fa alla **FINE**, dopo la prova in pagina, e **solo col via libera**.

### Cosa la specifica dice male

Tre righe della specifica sono superate. **Non correggere il codice verso di loro.**

1. La convenzione 1 dice «un passo di griglia (10) sotto la dorsale»: sono **DUE (20)** dal
   18-08-2026, e la stessa misura vale per le valvole dei montanti del ponte (convenzione 5).
   Il codice è già a posto: `SCARTO_VALVOLA = 20` in `buildSchemaModel.ts`.
2. Il Blocco 4 della specifica dice «`GIOCO_FRA_STADI` — default 0»: è **20** dal 18-08-2026.
3. «La regola della dorsale ha due vincoli»: non più, la quotano i **compressori e loro soli**.

### Il gate, a ogni task

```
npx vitest run
npx tsc --noEmit
npx eslint <percorsi toccati>
```

**Il conto dei warning eslint non è zero ovunque: è «non uno più di prima».** Misurato sul commit
base: `src/services/schemaImpianto` **0**, `src/components/schemaImpianto` **3** (preesistenti),
`services/relazione` + `components/relazione` + `pages/TechnicalDetails.tsx` +
`utils/equipmentCodes.ts` **18**. Un `--max-warnings 0` su quei percorsi fallisce anche senza
toccarli.

**Non lanciare più esecuzioni di `vitest run` in parallelo**: si accavallano sui core e la suite
passa da due minuti a non finire più.

### La prova «rompi apposta», a ogni task

I test verdi per la ragione sbagliata sono la classe di difetto numero uno di questo modulo. A ogni
task, prima di chiuderlo: rompi apposta la logica appena scritta e **guarda quali test cadono**.

- **I file del repo hanno fine riga CRLF**: le mutazioni scritte con pattern multi-riga e `\n` non
  agganciano e sembrano innocue. **Verificare sempre con `git diff --stat` che la mutazione sia
  entrata** prima di concludere che manca un test.
- **Attenzione a una copertura che sembra un buco e non lo è:** in questo modulo molti test
  asseriscono **sulla costante** e non sul valore, per scelta; a fissare il numero sono le
  **fixture**. La copertura va provata nei due versi: sbagliare il **valore** deve far cadere le
  fixture, sbagliare il **cablaggio** deve far cadere il test.

### Le fixture SVG

**Non si muovono in questo blocco**: le tre descrivono impianti **senza stadi e senza by-pass**, e
qui si tocca solo la geometria del by-pass. **Se una cambia, fermarsi e guardare il diff prima di
qualsiasi altra cosa** — e leggerlo con l'attrezzo (`confronta.mts`, alla radice del worktree), non
a occhio: sono decine di righe da migliaia di caratteri, «cambiano solo le ascisse» non è una cosa
che si firmi guardando. **Mai rigenerarle per far tornare verde un test.**

*(La vecchia regola «`svgRiferimentoConTee` costruisce il layout a mano» è falsa: `layoutConTee`
parte da `layoutSchema` sulla stessa scheda minima delle altre due e ci innesta **solo il TEE**.
La regola resta buona nella sostanza — se cambia, si **guarda** — ma la sua ragione è che lì, e
solo lì, si vede la geometria del TEE.)*

---

## Le misure prese in apertura, su `si bypass.png`

Scala dell'immagine **0,5575 px/unità**, letta dal reticolo di puntini della tela
(`PASSO_GRIGLIA = 10`) col metodo del Blocco 4. Controprova: i quattro rombi hanno passo 66,9 px =
**120,0 unità**, cioè ancore a 100 più `GIOCO_FRA_STADI = 20`.

| grandezza | px | unità | costante |
|---|---|---|---|
| quota della linea di processo | y = 125 | — | — |
| quota dell'uscita del serbatoio, del ponte e del TEE di monte | y = 74,5 | — | — |
| **scarto fra le due** | 50,5 | **90,6** | `PASSO_CORSIA_BYPASS = 90` ✓ |
| centro del TEE di monte (prese a 285 e 297, ±10 unità) | x = 291,0 | — | — |
| ancora `sx` di F1 (**vertice** del rombo, non la punta del codolo) | x = 302,5 | — | — |
| **TEE di monte → ancora `sx` del primo stadio scavalcato** | 11,5 | **20,6** | `PASSO_GIUNZIONE = 20` ✓ |
| ancora `dx` di F3 → centro del TEE di valle | 15,6 | **28** | `PASSO_GIUNZIONE = 20` (largo di 8) |
| dorsale → valvola della mandata | 11,2 | **20,1** | `SCARTO_VALVOLA = 20` ✓ |
| TEE (o gomito) → valvola del montante del by-pass | ~15,4 | **~27** | `SCARTO_VALVOLA = 20` |
| la riga forte a y=74 | da 270 (bocchello S1) a 575 | — | **un tratto solo** |

**Correzione alla consegna, e va detta.** La consegna dà il TEE di monte a ~3 unità dalla punta del
primo stadio, e ne conclude che `PASSO_GIUNZIONE` va tarato ora. **La misura dice 20,6.** Lo scarto
nasce dal punto di riferimento: a x≈293 non c'è la punta del rombo, c'è il **pallino azzurro della
maniglia** che l'editor disegna sull'ancora; la punta vera — il vertice sinistro del rombo, che è
dove sta l'ancora `sx` (`ANCORE_ROMBO`, `symbols/index.ts`) — è a **302,5**. `PASSO_GIUNZIONE = 20`
è quindi **già il valore misurato**, e il Task 4 lo scrive nel commento invece di cambiarlo.

**Cosa il riferimento mostra al capo di valle, e perché non lo copiamo.** Sul disegno del
committente ci sono **due** nodi al capo di valle: uno in cima (x=574,5, y=74,5) e uno sulla linea
(x=574,5, y=125), tutti e due con le quattro maniglie della giunzione. È il modo in cui si disegna
un gomito **a mano** nell'editor (si inserisce un TEE). Il nostro ponte il gomito lo fa con un
vertice di polilinea, che non disegna simboli: un pallino in meno, la stessa geometria. La scelta
del committente — «di valle resta sulla linea di processo, la linea prosegue verso le utenze a
quella quota» — è rispettata alla lettera.

---

## I file toccati

| file | task | cosa |
|---|---|---|
| `services/schemaImpianto/bypass.ts` | 2 | `eCapoDiMonte`, `capoDiValleDi`: riconoscere una `-IN` e trovarne la coppia |
| `services/schemaImpianto/layout.ts` | 2, 3, 4 | le `-IN` si posano in alto, le corsie si assegnano qui; via `ALTEZZA_BYPASS`; il commento di `PASSO_GIUNZIONE` |
| `services/schemaImpianto/segniAncorati.ts` | 1, 2 | il gradino non nasce sotto un lato verticale; il ponte a tre vertici |
| `services/schemaImpianto/buildSchemaModel.ts` | 2 | ponte `standard` con due valvole, la terza sul montante di monte |
| `services/schemaImpianto/__tests__/segniAncorati.test.ts` | 1 | il gradino e il lato imposto |
| `services/schemaImpianto/__tests__/bypass.test.ts` | 2 | i due riconoscitori |
| `services/schemaImpianto/__tests__/layout.test.ts` | 2, 3, 4 | i sette test della forma vecchia, riscritti |
| `services/schemaImpianto/__tests__/buildSchemaModel.test.ts` | 2 | i cinque test del ponte nel modello |

**Le tre fixture SVG non compaiono.** Se cambiano, ci si ferma.

---

## Task 1: il gradino non nasce dove il TEE impone un lato verticale

**Perché prima di tutto:** è la condizione che rende disegnabile il montante del Task 2. Oggi
`gradinoVersoIlTee` mette due gomiti a mezza strada su **ogni** arco che tocca un TEE venendo da
un'altra quota; il montante che scende dal capo di monte deve invece scendere **sull'ascissa del
TEE**, come mostra il riferimento. La regola nuova non è un'eccezione cucita addosso al by-pass: il
gradino serve solo quando il TEE impone un lato **orizzontale**, perché è allora che
`rottaImboccata` piega sul capo libero — sul fianco del serbatoio, che è il difetto per cui la
funzione è nata. Con un lato **verticale** la piega cade già sull'ascissa del TEE.

**Files:**
- Modify: `src/services/schemaImpianto/segniAncorati.ts` (`risolviPonti`, `gradinoVersoIlTee`)
- Test: `src/services/schemaImpianto/__tests__/segniAncorati.test.ts`

**Interfaces:**
- Consumes: `latoImposto(nodo, ancoraId, libreria)` (`symbols/index.ts`), `SchemaLatoAncora`.
- Produces: `gradinoVersoIlTee` riceve un terzo argomento coi lati imposti ai due capi.

- [ ] **Step 1: scrivi i due test che falliscono**

In coda a `src/services/schemaImpianto/__tests__/segniAncorati.test.ts`, un `describe` nuovo. Il
layout si costruisce a mano: un TEE in alto, uno stadio in basso, un arco fra i due con `forma`
assente — e un ponte fittizio, perché `risolviPonti` esce subito quando di ponti non ce n'è.

```ts
describe('il gradino verso un TEE', () => {
  const giunzione = (id: string, x: number, y: number): SchemaNodoPosizionato => ({
    id, tipo: 'giunzione', etichetta: id, gruppo: 'LINEA_DISTRIBUZIONE',
    valvoleSicurezza: [], origine: 'scheda', x, y,
  })
  const filtro = (id: string, x: number, y: number): SchemaNodoPosizionato => ({
    id, tipo: 'filtro', etichetta: id, gruppo: 'LINEA_DISTRIBUZIONE',
    valvoleSicurezza: [], origine: 'scheda', x, y,
  })

  /** Il layout minimo che serve: due TEE (uno in alto), uno stadio, il ponte fra i due TEE. */
  const layout = (ancoraDalTee: string): SchemaLayout => ({
    nodi: [giunzione('BP1-IN', 290, 0), giunzione('BP1-OUT', 700, 90), filtro('F1', 340, 40)],
    archi: [
      { id: 'bp-1', da: { nodo: 'BP1-IN', ancora: 'dx' }, a: { nodo: 'BP1-OUT', ancora: 'alto' },
        stile: 'standard', forma: 'ponte' },
      { id: 'std-1', da: { nodo: 'BP1-IN', ancora: ancoraDalTee }, a: { nodo: 'F1', ancora: 'sx' },
        stile: 'standard' },
    ],
    muro: null,
    testi: [],
  })

  const arco = (l: SchemaLayout) => l.archi.find((a) => a.id === 'std-1')!

  it('col lato verticale scende sull’ascissa del TEE, senza gomiti a mezza strada', () => {
    // E' il montante del by-pass: il TEE sta in alto, il tubo deve scendere di li' e poi entrare
    // orizzontale nello stadio. La piega la posa gia' `rottaImboccata` sull'ascissa del TEE:
    // aggiungerci un gradino significherebbe due scalini su un tubo che deve solo scendere.
    expect(arco(risolviPonti(layout('basso'))).punti ?? []).toHaveLength(0)
  })

  it('col lato orizzontale il gradino resta, ed e’ a mezza strada', () => {
    // Non-regressione del difetto trovato guardando il disegno nel Blocco 3: con un lato
    // orizzontale imposto e l'altro capo libero, `rottaImboccata` piega SUBITO sul capo libero e
    // il tratto verticale corre rasente il fianco dell'apparecchiatura, invisibile.
    const punti = arco(risolviPonti(layout('sx'))).punti ?? []
    expect(punti).toHaveLength(2)
    expect(punti[0].x).toBe(punti[1].x)
  })
})
```

Aggiungi in testa al file gli import che mancano: `risolviPonti` da `../segniAncorati`.

- [ ] **Step 2: guarda che il primo fallisca e il secondo passi**

Run: `npx vitest run src/services/schemaImpianto/__tests__/segniAncorati.test.ts`
Atteso: **il primo FALLISCE** (`toHaveLength(0)` contro 2 — il gradino c'è), il secondo passa.
Se fallisce anche il secondo, fermati: la fixture del layout non riproduce il caso di partenza.

- [ ] **Step 3: la condizione nuova in `gradinoVersoIlTee`**

In `segniAncorati.ts`, `risolviPonti` calcola già i capi; calcola anche i lati e passali:

```ts
  const lati = (arco: SchemaArco) => {
    const da = perId.get(arco.da.nodo)
    const a = perId.get(arco.a.nodo)
    return {
      da: da ? latoImposto(da, arco.da.ancora, libreria) : undefined,
      a: a ? latoImposto(a, arco.a.ancora, libreria) : undefined,
    }
  }
```

`latoImposto` è già importato da `./symbols`. La chiamata diventa
`gradinoVersoIlTee(arco, capi(arco), lati(arco))`, e la funzione prende la guardia nuova **subito
dopo quella dei gomiti a mano**:

```ts
/** Vero per i lati lungo cui il tubo imbocca in verticale. Duplicato di una riga di `tratti.ts`
 *  (`verticale`), che li' e' privata: esportarla per due parole leverebbe a quel modulo il
 *  diritto di cambiarla. */
const imboccaInVerticale = (lato: SchemaLatoAncora | undefined) => lato === 'alto' || lato === 'basso'
```

```ts
  // Il gradino serve solo dove il TEE impone un lato ORIZZONTALE: e' li' che `rottaImboccata`
  // piega sul capo LIBERO — sul fianco del serbatoio — e il tratto verticale sparisce dentro il
  // contorno. Con un lato verticale la piega cade gia' sull'ascissa del TEE, che e' dove il
  // riferimento la mostra: e' il montante che scende dal capo di monte di un by-pass (Blocco 5),
  // e un gradino li' sarebbe uno scalino in piu' su un tubo che deve solo scendere.
  if (imboccaInVerticale(lati.da) || imboccaInVerticale(lati.a)) return arco
```

- [ ] **Step 4: verde**

Run: `npx vitest run src/services/schemaImpianto/__tests__/segniAncorati.test.ts`
Atteso: **PASS** entrambi.

- [ ] **Step 5: rompi apposta**

Togli la guardia nuova (una riga) e verifica con `git diff --stat` che la modifica sia entrata,
poi rilancia il file di test: **deve cadere il primo**. Rimetti la guardia.

- [ ] **Step 6: gate e commit**

```
npx vitest run
npx tsc --noEmit
npx eslint src/services/schemaImpianto
```
Atteso: 1464 test verdi (1462 + 2), `tsc` pulito, **0 warning** su `services/schemaImpianto`.

```bash
git add src/services/schemaImpianto/segniAncorati.ts src/services/schemaImpianto/__tests__/segniAncorati.test.ts
git commit -m "fix(schema): il gradino non nasce dove il TEE impone un lato verticale"
```

---

## Task 2: la giunzione di monte in alto, il ponte a tre vertici, le valvole ridistribuite

**Perché un task solo:** è **una** trasformazione geometrica, e le tre parti non stanno in piedi
separate. La quota del ponte è quella del suo capo di monte (layout), il numero dei suoi vertici
dipende da quella quota (`risolviPonti`), e gli ancoraggi delle valvole contano i vertici
(`buildSchemaModel`). Spezzarla darebbe due gate su uno stato che nessuno vuole: il ponte a
quattro vertici sopra un capo già alto vola fuori dal foglio, e le valvole ancorate a vertici che
non esistono cadono tutte sul ripiego a metà tubo — sbagliate ma visibili, il peggior tipo di
errore per questo modulo.

**Files:**
- Modify: `src/services/schemaImpianto/bypass.ts` (due riconoscitori nuovi)
- Modify: `src/services/schemaImpianto/layout.ts` (`disponiCatenaPerAncore`, chiamata a `risolviPonti`)
- Modify: `src/services/schemaImpianto/segniAncorati.ts` (`risolviPonti`)
- Modify: `src/services/schemaImpianto/buildSchemaModel.ts` (`buildArchi`)
- Test: `__tests__/bypass.test.ts`, `__tests__/layout.test.ts`, `__tests__/buildSchemaModel.test.ts`

**Interfaces:**
- Produces (`bypass.ts`):
  - `eCapoDiMonte(id: string): boolean` — vero per `BP1-IN`, falso per `BP1-OUT` e per tutto il resto;
  - `capoDiValleDi(idMonte: string): string` — `BP1-IN` → `BP1-OUT`.
- Consumes: `assegnaCorsie(intervalli: {inizio,fine}[]): number[]` (già esportata da `bypass.ts`,
  la stessa che usa `linearizzaConBypass`: **usare quella**, o le due risposte divergono).
- `risolviPonti(layout, libreria?)` **perde il parametro `misure`**: la quota del ponte è quella
  del suo capo, non più un'altezza da sommare.

### La forma, in numeri

Con la catena `[BP1-IN, F1, E1, F2, BP1-OUT]`, `quotaLinea` = q e il primo TEE in corsia 0:

- `BP1-IN` si posa a **q − `PASSO_CORSIA_BYPASS`** (90 sopra la linea), `BP1-OUT` a **q**;
- il ponte è la polilinea **`[BP1-IN, (BP1-OUT.x, BP1-IN.y), BP1-OUT]`** — tre vertici, due
  tratti: la corsa orizzontale (tratto 0) e la gamba discendente (tratto 1);
- il montante di monte è l'arco `BP1-IN → F1`, che **scende** dal TEE e piega orizzontale sulla
  punta di F1: tre vertici, tratto 0 = la discesa.

### Le valvole, dove vanno

| valvola | arco | ancoraggio | `stileAValle` |
|---|---|---|---|
| montante di monte | `BP1-IN → F1` (`standard`) | vertice **0**, scarto **+20** | `flessibile` |
| centro del ponte | ponte (`standard`) | metà del tratto **0** | — |
| montante di valle | ponte | vertice **1**, scarto **+20** | `flessibile` |

Il montante di monte è il **mirror della convenzione 1**: sopra la valvola rigido, sotto
flessibile, come la mandata del compressore ma col tubo che scende invece di salire.

- [ ] **Step 1: i due riconoscitori, col loro test**

In `src/services/schemaImpianto/__tests__/bypass.test.ts`, in coda:

```ts
describe('riconoscere il capo di monte', () => {
  it('distingue il capo di monte da quello di valle, e da tutto il resto', () => {
    // La quota di un capo di by-pass dipende da quale dei due e' (Blocco 5): il layout deve
    // saperlo dall'id, che e' l'unica cosa che ha in mano quando dispone la sequenza.
    expect(eCapoDiMonte('BP1-IN')).toBe(true)
    expect(eCapoDiMonte('BP12-IN')).toBe(true)
    expect(eCapoDiMonte('BP1-OUT')).toBe(false)
    expect(eCapoDiMonte('M-1')).toBe(false)
    expect(eCapoDiMonte('F1')).toBe(false)
  })

  it('trova il capo di valle che fa coppia', () => {
    expect(capoDiValleDi('BP1-IN')).toBe('BP1-OUT')
    expect(capoDiValleDi('BP12-IN')).toBe('BP12-OUT')
  })

  it('i due riconoscitori e gli id sono la stessa cosa detta due volte', () => {
    // Se `idTeeBypass` cambiasse forma agli id, questi due lo seguirebbero senza che nessuno se
    // ne accorga: il legame va fissato qui.
    const { inizio, fine } = idTeeBypass('bp3')
    expect(eCapoDiMonte(inizio)).toBe(true)
    expect(capoDiValleDi(inizio)).toBe(fine)
  })
})
```

Poi in `bypass.ts`, accanto a `eTeeBypass`:

```ts
/** Vero per il capo di MONTE di un by-pass (`BP1-IN`). Dal Blocco 5 i due capi non stanno piu'
 *  alla stessa quota — quello di monte sale a quella dell'uscita del serbatoio — e chi dispone la
 *  sequenza deve distinguerli avendo in mano il solo id. */
export function eCapoDiMonte(id: string): boolean {
  return /^BP\d+-IN$/.test(id)
}

/** Il capo di valle che fa coppia con un capo di monte: `BP1-IN` → `BP1-OUT`. Serve ad accoppiarli
 *  nella sequenza per sapere quale intervallo occupa il ponte, cioe' su che corsia corre. */
export function capoDiValleDi(idMonte: string): string {
  return idMonte.replace(/-IN$/, '-OUT')
}
```

- [ ] **Step 2: verde su `bypass.test.ts`**

Run: `npx vitest run src/services/schemaImpianto/__tests__/bypass.test.ts`
Atteso: PASS (aggiungi gli import di `eCapoDiMonte`, `capoDiValleDi`, `idTeeBypass` in testa).

- [ ] **Step 3: riscrivi i test di `layout.test.ts` sulla forma vecchia**

Nel `describe('il by-pass nel layout')`, **sette** test cambiano. Non allentarli: dicono un'altra
cosa, e vanno riscritti per dire quella.

```ts
  it('la giunzione di valle cade sulla linea di processo, come gli stadi', () => {
    const l = disegno()
    expect(posizioneAncora(nodo(l, 'BP1-OUT'), 'sx').y).toBe(posizioneAncora(nodo(l, 'F1'), 'sx').y)
  })

  it('la giunzione di monte sta invece alla quota dell’uscita del serbatoio', () => {
    // La scelta del committente sul suo disegno (18-08-2026), ed e' ASIMMETRICA di proposito: a
    // monte il flusso si divide PRIMA di scendere negli stadi, a valle si ricongiunge SULLA linea
    // e prosegue verso le utenze a quella quota. Renderla simmetrica aggiungerebbe un tratto
    // verticale verso le utenze che nel riferimento non c'e'.
    const l = disegno()
    expect(posizioneAncora(nodo(l, 'BP1-IN'), 'sx').y).toBe(posizioneAncora(nodo(l, 'S1'), 'dx').y)
    // E la stessa cosa detta in unita' di corsia: e' `PASSO_CORSIA_BYPASS` sopra la linea, che e'
    // esattamente di quanto la linea era scesa per fargli posto.
    expect(posizioneAncora(nodo(l, 'BP1-IN'), 'sx').y).toBe(
      posizioneAncora(nodo(l, 'F1'), 'sx').y - PASSO_CORSIA_BYPASS
    )
  })

  it('il TEE di monte sta un PASSO_GIUNZIONE prima della punta del primo stadio scavalcato', () => {
    // Asserzione sulla COSTANTE, non sul valore. Non e' piu' simmetrica come nel Blocco 3, e non
    // deve esserlo: di qua il TEE sta SOPRA la linea, di la' e' di fianco. La misura sul
    // riferimento (Blocco 5) da' 20,6 unita' di qua e 28 di la': un solo passo le copre entrambe.
    const l = disegno()
    expect(posizioneAncora(nodo(l, 'BP1-IN'), 'sx').x).toBe(
      posizioneAncora(nodo(l, 'F1'), 'sx').x - PASSO_GIUNZIONE
    )
  })

  it('e il TEE di valle un PASSO_GIUNZIONE dopo la punta dell’ultimo, sulla linea', () => {
    const l = disegno()
    expect(posizioneAncora(nodo(l, 'BP1-OUT'), 'sx').x).toBe(
      posizioneAncora(nodo(l, 'F2'), 'dx').x + PASSO_GIUNZIONE
    )
  })

  it('la corsa del ponte cade sulla quota dell’uscita del serbatoio, e le e’ ADIACENTE', () => {
    // La prima meta' resta vera per un'altra ragione: non perche' il ponte salga di
    // `ALTEZZA_BYPASS` sopra due capi complanari, ma perche' il capo di monte e' gia' li'.
    // La seconda cambia: il tratto che arriva da S1 e la corsa del ponte non sono piu' disgiunti,
    // si TOCCANO sul TEE — ed e' cio' che il riferimento mostra come una riga sola, da x=270
    // (bocchello di S1) a x=575, senza interruzioni.
    const l = disegno()
    const uscita = posizioneAncora(nodo(l, 'S1'), 'dx')
    const punti = polilineaPonte(l)
    expect(punti[0].y).toBe(uscita.y)
    expect(punti[1].y).toBe(uscita.y)
    expect(punti[0].x).toBeGreaterThan(uscita.x)
    // L'arco che arriva da S1 finisce dove il ponte comincia: nessun gomito fra i due.
    const daSerbatoio = l.archi.find((a) => a.da.nodo === 'S1' && a.a.nodo === 'BP1-IN')!
    expect(daSerbatoio.punti ?? []).toHaveLength(0)
  })

  it('il ponte esce dal layout con tre vertici: capo, gomito, capo', () => {
    // E' su questo che contano i due ancoraggi seminati da `buildArchi` — meta' del tratto 0,
    // vertice 1. Cambiare il numero di gomiti sposta le valvole senza che nessun test del modello
    // se ne accorga: il legame fra le due cose sta qui.
    const punti = polilineaPonte(disegno())
    expect(punti).toHaveLength(3)
    expect(punti[0].y).toBe(punti[1].y) // la corsa orizzontale, tratto 0
    expect(punti[1].x).toBe(punti[2].x) // la gamba discendente, tratto 1
  })

  it('col capo di monte agganciato in alto il ponte piegherebbe a mezza quota: per questo il gomito', () => {
    // La ragione del gomito CAMBIA col Blocco 5. Prima: coi due TEE alla stessa quota
    // `rottaImboccata` piegava a `yMedia`, cioe' la loro stessa quota, e `dedup` collassava il
    // ponte sulla linea di processo. Ora i due capi stanno a quote diverse, e la piega dipende
    // dai LATI: col capo di monte agganciato all'ancora `alto` (verticale su entrambi i capi)
    // la corsa cadrebbe a meta' strada fra le due quote — un ponte che non corre ne' sulla quota
    // del suo capo ne' su quella della linea.
    const l = disegno()
    const quotaMonte = posizioneAncora(nodo(l, 'BP1-IN'), 'alto').y
    const quotaValle = posizioneAncora(nodo(l, 'BP1-OUT'), 'alto').y
    const daAlto = instrada(
      'standard',
      posizioneAncora(nodo(l, 'BP1-IN'), 'alto'),
      posizioneAncora(nodo(l, 'BP1-OUT'), 'alto'),
      undefined,
      quoteInstradamento(l),
      { da: latoImposto(nodo(l, 'BP1-IN'), 'alto'), a: latoImposto(nodo(l, 'BP1-OUT'), 'alto') }
    )
    expect(daAlto.some((p) => p.y !== quotaMonte && p.y !== quotaValle)).toBe(true)
    // Col capo di monte agganciato di FIANCO, invece, la piega che `rottaImboccata` produce da se'
    // coincide col gomito scritto dal layout: il ponte non dipende da un'euristica per stare al
    // suo posto, e questo test e' la sentinella che se ne accorge se un giorno divergessero.
    const senzaGomiti = instrada(
      'standard',
      posizioneAncora(nodo(l, 'BP1-IN'), 'dx'),
      posizioneAncora(nodo(l, 'BP1-OUT'), 'alto'),
      undefined,
      quoteInstradamento(l),
      { da: latoImposto(nodo(l, 'BP1-IN'), 'dx'), a: latoImposto(nodo(l, 'BP1-OUT'), 'alto') }
    )
    expect(senzaGomiti).toEqual(polilineaPonte(l))
  })

  it('le tre valvole finiscono dove le convenzioni le vogliono, su DUE archi', () => {
    // Si misura sui PUNTI ricalcolati, non sulle `t`: una `t` giusta su una polilinea sbagliata
    // non e' una valvola al posto giusto. Dal Blocco 5 le tre valvole non stanno piu' tutte sul
    // ponte: quella di monte e' scesa sul montante, che e' un arco normale della catena.
    const l = disegno()
    const punti = polilineaPonte(l)
    const segniPonte = ponteDi(l).segni!.map((s) => puntoSuTratto(punti, s.t).punto)
    // Centro: a meta' della corsa orizzontale, che ora e' il tratto 0.
    expect(segniPonte[0]).toEqual({ x: (punti[0].x + punti[1].x) / 2, y: punti[0].y })
    // Valle: due passi di griglia sotto il gomito, sulla gamba che scende.
    expect(segniPonte[1]).toEqual({ x: punti[1].x, y: punti[1].y + 20 })

    // Monte: due passi sotto il TEE, sul montante che scende verso il primo stadio scavalcato.
    const montante = l.archi.find((a) => a.da.nodo === 'BP1-IN' && a.a.nodo === 'F1')!
    const puntiMontante = instrada(
      montante.stile,
      posizioneAncora(nodo(l, 'BP1-IN'), montante.da.ancora),
      posizioneAncora(nodo(l, 'F1'), 'sx'),
      montante.punti,
      quoteInstradamento(l),
      { da: latoImposto(nodo(l, 'BP1-IN'), montante.da.ancora), a: undefined }
    )
    expect(puntiMontante).toHaveLength(3)
    expect(puntiMontante[0].x).toBe(puntiMontante[1].x) // scende sull'ascissa del TEE
    expect(puntoSuTratto(puntiMontante, montante.segni![0].t).punto).toEqual({
      x: puntiMontante[0].x,
      y: puntiMontante[0].y + 20,
    })
  })
```

Il test `due by-pass disgiunti corrono sulla stessa corsia, e non si vedono scalini` **resta com'è**
(misura il minimo delle y dei due ponti) ma ora prova un'altra cosa: le corsie non le assegna più
`risolviPonti`, le assegna il layout posando i capi di monte. Aggiungi due righe al suo commento e
un'asserzione che lo dice:

```ts
    // Dal Blocco 5 la corsia non e' piu' una proprieta' del ponte ma della quota a cui il layout
    // posa il suo capo di MONTE: e' quello che questo test sorveglia adesso.
    expect(posizioneAncora(nodo(l, 'BP1-IN'), 'sx').y).toBe(posizioneAncora(nodo(l, 'BP2-IN'), 'sx').y)
```

E aggiungi un test nuovo per i gruppi annidati, che è il solo caso in cui le corsie contano:

```ts
  it('due by-pass annidati mettono i capi di monte su due quote diverse', () => {
    // Le corsie servono a questo e solo a questo. Il gruppo interno corre in basso, quello che lo
    // contiene lo scavalca: `assegnaCorsie` assegna dal ponte piu' CORTO al piu' lungo, ed e' la
    // stessa funzione che usa `linearizzaConBypass` — le due risposte non possono divergere.
    const l = disegno([['F1', 'E1', 'F2'], ['E1']])
    const monte = (g: string) => posizioneAncora(nodo(l, `${g}-IN`), 'sx').y
    expect(monte('BP2')).toBeGreaterThan(monte('BP1'))
    expect(monte('BP1')).toBe(monte('BP2') - PASSO_CORSIA_BYPASS)
  })
```

- [ ] **Step 4: riscrivi i test di `buildSchemaModel.test.ts`**

```ts
  it('il ponte è un arco solo, rigido, che parte di fianco al TEE di monte e scende su quello di valle', () => {
    // `standard` e non piu' `flessibile` (Blocco 5): il ponte e' rigido dalla partenza, e la
    // valvola del gomito lo passa a flessibile per la sola gamba discendente. E parte dal FIANCO
    // del capo di monte: e' il lato imposto a dare la forma, e con l'ancora `alto` la corsa
    // cadrebbe a mezza quota (vedi il test gemello in `layout.test.ts`).
    const ponte = conBypass(['F1', 'E1', 'F2']).archi.filter((a) => a.forma === 'ponte')
    expect(ponte).toHaveLength(1)
    expect(ponte[0]).toMatchObject({
      da: { nodo: 'BP1-IN', ancora: 'dx' },
      a: { nodo: 'BP1-OUT', ancora: 'alto' },
      stile: 'standard',
    })
  })

  it('il ponte porta DUE valvole: il centro della corsa e il gomito di valle', () => {
    const ponte = conBypass(['F1', 'E1', 'F2']).archi.find((a) => a.forma === 'ponte')!
    expect(ponte.segni).toHaveLength(2)
    const [centro, valle] = ponte.segni!
    expect(centro.ancoraggio).toEqual({ tipo: 'meta', tratto: 0 })
    expect(centro.stileAValle).toBeUndefined()
    expect(valle.ancoraggio).toEqual({ tipo: 'vertice', vertice: 1, scarto: 20 })
    expect(valle.stileAValle).toBe('flessibile')
    expect(ponte.segni!.every((s) => s.t === 0.5 && s.tipo === 'valvola_intercettazione')).toBe(true)
  })

  it('la terza valvola sta sul montante che scende dal TEE di monte, col rigido sopra', () => {
    // Il mirror della convenzione 1: sopra la valvola rigido, sotto flessibile — come la mandata
    // del compressore, ma col tubo che scende invece di salire. L'arco e' un normale arco della
    // catena, e la sua ancora di partenza e' `basso` perche' il tubo deve scendere sull'ascissa
    // del TEE (con `dx` piegherebbe sopra lo stadio e scenderebbe sulla sua punta).
    const montante = conBypass(['F1', 'E1', 'F2']).archi.find(
      (a) => a.da.nodo === 'BP1-IN' && a.a.nodo === 'F1'
    )!
    expect(montante.da.ancora).toBe('basso')
    expect(montante.stile).toBe('standard')
    expect(montante.segni).toHaveLength(1)
    expect(montante.segni![0].ancoraggio).toEqual({ tipo: 'vertice', vertice: 0, scarto: 20 })
    expect(montante.segni![0].stileAValle).toBe('flessibile')
  })

  it('lo scarto delle valvole del by-pass è lo stesso di quello della mandata', () => {
    // Il legame che il committente ha chiesto esplicitamente: se un giorno si ritocca uno dei due
    // numeri senza l'altro, questo test cade. Dal Blocco 5 il primo segno del ponte e' quello a
    // META' tratto, che uno scarto non ce l'ha: si pesca quello ancorato a un VERTICE.
    const m = conBypass(['F1', 'E1', 'F2'])
    const mandata = m.archi.find((a) => a.stile === 'flessibile' && a.forma !== 'ponte')!.segni![0]
    const ponte = m.archi.find((a) => a.forma === 'ponte')!.segni!.find((s) => s.ancoraggio?.tipo === 'vertice')!
    const montante = m.archi.find((a) => a.da.nodo === 'BP1-IN' && a.a.nodo === 'F1')!.segni![0]
    const scarto = (s: typeof mandata) => (s.ancoraggio?.tipo === 'vertice' ? Math.abs(s.ancoraggio.scarto) : null)
    expect(scarto(ponte)).toBe(scarto(mandata))
    expect(scarto(montante)).toBe(scarto(mandata))
  })

  it('il ponte è rigido come gli archi di linea: senza `forma` non lo si distinguerebbe', () => {
    // Dal Blocco 5 il ponte non e' piu' flessibile come la mandata: e' `standard` come la linea di
    // processo, e chi filtra per stile lo raccoglie INSIEME AGLI ARCHI DI LINEA. Serve `forma` per
    // distinguerlo, ed e' il motivo per cui il campo esiste — la ragione e' cambiata, il campo no.
    const m = conBypass(['F1', 'E1', 'F2'])
    expect(m.archi.filter((a) => a.stile === 'flessibile')).toHaveLength(1) // la sola mandata
    const standard = m.archi.filter((a) => a.stile === 'standard')
    expect(standard.filter((a) => a.forma === 'ponte')).toHaveLength(1)
    expect(standard.length).toBeGreaterThan(1)
  })
```

E il test `la valvola di riserva sparisce dove il ponte ne mette già una` — da **guardare**, non da
cambiare a occhio: la regola esiste perché non nascano due valvole a un passo di distanza. Ora la
valvola di monte non sta più sul ponte ma sul montante, che parte **dallo stesso TEE**: la
distanza fra lei e la riserva all'uscita del serbatoio è la stessa di prima, e la regola resta
valida. Aggiungi al suo commento la riga che lo dice, e un'asserzione che lega le due cose:

```ts
    // Dal Blocco 5 la valvola che rende superflua la riserva non sta piu' sul ponte ma sul
    // montante — stesso TEE, stessa distanza dal bocchello del serbatoio: la regola non cambia,
    // cambia l'arco su cui guardarla.
    expect(m.archi.find((a) => a.da.nodo === 'BP1-IN' && a.a.nodo === 'F1')!.segni).toHaveLength(1)
```

- [ ] **Step 5: guardali fallire, e conta**

Run: `npx vitest run src/services/schemaImpianto/__tests__/layout.test.ts src/services/schemaImpianto/__tests__/buildSchemaModel.test.ts`
Atteso: **falliscono** i test riscritti (quota della `-IN`, tre vertici, ancore, stili, valvole).
**Scrivi quali cadono e perché**: se ne cade uno che non è nell'elenco, è un effetto che questo
piano non ha previsto e va guardato prima di andare avanti.

- [ ] **Step 6: `layout.ts` — le `-IN` si posano in alto, e le corsie si assegnano qui**

`disponiCatenaPerAncore` prende una quota per nodo invece di una sola:

```ts
/**
 * Le corsie dei ponti, per id del capo di MONTE. Dal Blocco 5 il ponte corre alla quota del suo
 * capo di monte, quindi la corsia non e' piu' una proprieta' del ponte ma della QUOTA a cui qui si
 * posa quel capo: e' l'unico posto che la puo' decidere.
 *
 * Gli intervalli sono posizioni nella sequenza e non ascisse: qui la sequenza e' quella che si sta
 * disponendo, e le due danno lo stesso ordine. `assegnaCorsie` e' la stessa che usa
 * `linearizzaConBypass` (bypass.ts) — assegna dal ponte piu' corto al piu' lungo, cosi' con due
 * gruppi annidati e' l'interno a correre in basso — e usarne un'altra farebbe divergere due
 * risposte che devono coincidere.
 *
 * Un capo di monte senza il suo capo di valle nella sequenza non e' un caso da riparare qui: resta
 * senza corsia e si posa sulla linea, come qualunque altra giunzione.
 */
function corsieDeiCapiDiMonte(nodi: SchemaNodo[]): Map<string, number> {
  const posizione = new Map(nodi.map((n, i) => [n.id, i]))
  const capi = nodi
    .filter((n) => eCapoDiMonte(n.id))
    .map((n) => ({ monte: n.id, inizio: posizione.get(n.id)!, fine: posizione.get(capoDiValleDi(n.id)) }))
    .filter((c): c is { monte: string; inizio: number; fine: number } => c.fine !== undefined)
  const corsie = assegnaCorsie(capi)
  return new Map(capi.map((c, i) => [c.monte, corsie[i]]))
}
```

e dentro `disponiCatenaPerAncore`:

```ts
  // La quota del capo di MONTE di un by-pass non e' quella della linea: sta una corsia piu' in
  // alto, cioe' esattamente dove la linea sarebbe stata se non fosse scesa per fargli posto —
  // sulla quota dell'uscita del serbatoio (`quotaLineaProcesso`). E' la scelta del committente sul
  // suo disegno (18-08-2026), ed e' asimmetrica: il capo di VALLE resta sulla linea, perche' li'
  // il flusso si ricongiunge e prosegue verso le utenze a quella quota.
  const corsie = corsieDeiCapiDiMonte(nodi)
  const quotaDi = (nodo: SchemaNodo) => {
    const corsia = corsie.get(nodo.id)
    return corsia === undefined ? quotaLinea : quotaLinea - PASSO_CORSIA_BYPASS * (corsia + 1)
  }
```

e la riga che colloca:

```ts
    const collocato = posiziona(nodo, xAncora - (sx?.x ?? 0), quotaDi(nodo) - (sx?.y ?? dim.altezza / 2))
```

Import da `./bypass`: `assegnaCorsie`, `capoDiValleDi`, `eCapoDiMonte`.

La chiamata a `risolviPonti` perde le misure:

```ts
  const conPonti = risolviPonti(layout, libreria)
```

- [ ] **Step 7: `segniAncorati.ts` — il ponte a tre vertici**

`risolviPonti` perde il parametro `misure`, il calcolo delle corsie e l'import di `assegnaCorsie`.
Il gomito diventa uno solo:

```ts
    // Un gomito SOLO: il ponte parte dal capo di monte, che dal Blocco 5 e' gia' alla sua quota,
    // corre orizzontale e scende sul capo di valle. Tre vertici, due tratti — ed e' su quel conto
    // che si appoggiano i due ancoraggi delle valvole del ponte.
    return { ...risolto, punti: [{ x: punti.a.x, y: punti.da.y }] }
```

E il commento in testa alla funzione va **riscritto**, perché la ragione del gomito è cambiata:

```
 * **Il gomito non e' un'ottimizzazione.** Fino al Blocco 4 i due capi stavano alla stessa quota e
 * senza gomiti `rottaImboccata` piegava a `yMedia` — la loro stessa quota — e `dedup` collassava
 * il ponte sulla linea di processo. Dal Blocco 5 i due capi stanno a quote DIVERSE, e la ragione e'
 * un'altra: senza il gomito la piega la sceglie `rottaImboccata` dai lati imposti ai capi, e col
 * capo di monte agganciato in alto la corsa cadrebbe a meta' fra le due quote invece che sulla
 * quota del capo. Col capo di monte agganciato di FIANCO le due risposte coincidono — un test lo
 * fissa (`layout.test.ts`), ed e' la sentinella del giorno in cui divergessero.
 *
 * Le corsie non si calcolano piu' qui: dal Blocco 5 la quota del ponte e' quella del suo capo di
 * monte, che il layout ha gia' posato sulla corsia giusta (`corsieDeiCapiDiMonte`, layout.ts). Su
 * un layout riaperto vale lo stesso, e per la stessa ragione: la quota che conta e' quella che il
 * nodo ha ADESSO, spostato a mano o no.
```

- [ ] **Step 8: `buildSchemaModel.ts` — le valvole si ridistribuiscono**

Nel ciclo degli archi di linea, l'arco che esce da un capo di monte cambia ancora e prende la
valvola:

```ts
    for (let i = 0; i < sequenza.length - 1; i++) {
      const da = sequenza[i]
      // Dal capo di MONTE di un by-pass la linea esce dal BASSO: quel TEE sta alla quota
      // dell'uscita del serbatoio (Blocco 5) e il tubo scende sulla sua ascissa fino alla punta
      // dello stadio scavalcato. E' il LATO imposto a dare la forma: con `dx` la rotta correrebbe
      // orizzontale sopra lo stadio e scenderebbe sulla sua punta, che nel riferimento non c'e'.
      //
      // La valvola e' il mirror della convenzione 1: rigido dal TEE fino a due passi sotto,
      // flessibile da li' in giu' — come la mandata del compressore, col tubo che scende invece
      // di salire. Vertice 0 e scarto positivo: `tDaAncoraggio` (tratti.ts) lo gestisce, il
      // tratto disponibile e' `lunghezze[0]`, che esiste.
      const dalCapoDiMonte = eCapoDiMonte(da.id)
      archi.push({
        id: prossimoId('std'),
        da: { nodo: da.id, ancora: dalCapoDiMonte ? 'basso' : 'dx' },
        a: { nodo: sequenza[i + 1].id, ancora: 'sx' },
        stile: 'standard',
        // Nessun segno fra due stadi consecutivi: le valvole d'ufficio a meta' tratto spariscono
        // (convenzione 6). L'arco pero' si emette SEMPRE, anche quando i due stadi sono adiacenti
        // e il tratto e' degenere: e' il tessuto che ripara il disegno appena l'operatore li
        // separa.
        ...(dalCapoDiMonte ? { segni: [valvolaAlVertice(0, 'flessibile', 1)] } : {}),
      })
    }
```

e il ponte:

```ts
  for (const ponte of ponti) {
    archi.push({
      id: prossimoId('bp'),
      // Il capo di monte si stacca di FIANCO — il ponte corre alla sua stessa quota — e quello di
      // valle riceve dall'ALTO, perche' il ponte gli scende addosso. I due lati imposti sono cio'
      // che da' la forma anche senza il gomito scritto dal layout.
      da: { nodo: ponte.inizio, ancora: 'dx' },
      a: { nodo: ponte.fine, ancora: 'alto' },
      // RIGIDO dalla partenza (Blocco 5): la corsa orizzontale e' rigida, e la valvola del gomito
      // passa a flessibile la sola gamba che scende sul capo di valle (convenzione 5).
      stile: 'standard',
      forma: 'ponte',
      segni: [
        // Tratto 0 = la corsa orizzontale, vertice 1 = il gomito. Li fissa `risolviPonti`
        // (segniAncorati.ts), che emette esattamente un gomito: cambiarne il numero sposta
        // entrambe le valvole.
        valvolaAMeta(0),
        valvolaAlVertice(1, 'flessibile', 1),
      ],
    })
  }
```

Import da `./bypass`: aggiungi `eCapoDiMonte` a quelli già presenti.

Aggiorna anche il commento di `valvolaAMeta` («la riserva (tratto 0) e quella al centro della corsa
orizzontale del ponte (tratto 1)»): il tratto del ponte ora è lo 0, come quello della riserva.

- [ ] **Step 9: verde su tutto**

Run: `npx vitest run`
Atteso: **PASS**. Se cade una delle tre fixture SVG, **fermati e leggi il diff con `confronta.mts`
prima di qualsiasi altra cosa**: descrivono impianti senza by-pass e non devono muoversi.

- [ ] **Step 10: rompi apposta, cinque mutazioni**

Una per volta, ognuna verificata entrata con `git diff --stat`:

1. `quotaDi` torna sempre `quotaLinea` → devono cadere i test sulla quota della `-IN`, sulla corsa
   del ponte e sui gruppi annidati.
2. il gomito diventa `{ x: punti.da.x, y: punti.a.y }` (scende subito invece che alla fine) → deve
   cadere «il ponte esce dal layout con tre vertici» sulle asserzioni di giacitura.
3. l'ancora del montante torna `dx` → devono cadere il test del montante nel modello e quello
   delle tre valvole nel layout (il tubo non scende più sull'ascissa del TEE).
4. il ponte torna `stile: 'flessibile'` → deve cadere il test degli stili nel modello.
5. `valvolaAlVertice(1, 'flessibile', 1)` diventa `-1` → deve cadere il test della valvola di valle
   nel layout (finirebbe sulla corsa orizzontale invece che sulla gamba).

**Se una mutazione non fa cadere nulla, il buco è reale e va chiuso con un test prima di
proseguire.**

- [ ] **Step 11: gate e commit**

```
npx vitest run
npx tsc --noEmit
npx eslint src/services/schemaImpianto
```

```bash
git add src/services/schemaImpianto
git commit -m "feat(schema): la giunzione di monte del by-pass sale alla quota dell'uscita del serbatoio"
```

---

## Task 3: `ALTEZZA_BYPASS` sparisce, e la promessa si sposta dove ora vive

**Perché:** con la `-IN` posata dal layout alla quota giusta, `ALTEZZA_BYPASS`
(oggi `= PASSO_CORSIA_BYPASS`) non la legge più nessuno. Il test che oggi lega le due costanti va
sostituito da uno che lega la **quota della `-IN`** a quella dell'uscita del serbatoio: è la stessa
promessa, detta dove ora vive — ed è già scritta nel Task 2 («la giunzione di monte sta invece alla
quota dell'uscita del serbatoio»).

**Files:**
- Modify: `src/services/schemaImpianto/layout.ts` (via la costante e il suo commento)
- Test: `src/services/schemaImpianto/__tests__/layout.test.ts` (via l'import, se c'è)

- [ ] **Step 1: guarda chi la legge ancora**

```
grep -rn "ALTEZZA_BYPASS" src/
```
Atteso: solo la sua dichiarazione. **Se compare altrove, fermati e guarda**: qualcuno se ne serve
per un'altra ragione, e va capita prima di togliere la costante.

- [ ] **Step 2: togli la costante e il suo commento**, e l'import nei test se c'è.

- [ ] **Step 3: la promessa resta scritta**

Nel commento di `PASSO_CORSIA_BYPASS` aggiungi il paragrafo che `ALTEZZA_BYPASS` portava:

```
 * **E' anche la quota del ponte**, dal Blocco 5: la linea di processo scende di una corsia
 * proprio perche' il capo di monte di un by-pass possa stare sulla quota dell'uscita del
 * serbatoio, e su `si bypass.png` quei due tratti sono la STESSA orizzontale — una sola riga forte
 * a y=74/75, da x=270 (bocchello) a x=575, senza interruzioni. Fino al Blocco 4 la relazione era
 * scritta in una costante a parte (`ALTEZZA_BYPASS = PASSO_CORSIA_BYPASS`), che serviva a far
 * salire il ponte SOPRA due capi complanari; ora il capo e' gia' li' e la costante non ha piu'
 * lettori. Il legame lo fissa un test (`layout.test.ts`, «la giunzione di monte sta invece alla
 * quota dell'uscita del serbatoio»), non piu' un'uguaglianza fra due numeri.
```

- [ ] **Step 4: gate e commit**

```
npx vitest run
npx tsc --noEmit
npx eslint src/services/schemaImpianto
```
Atteso: stesso numero di test del Task 2, `tsc` pulito. **`tsc` è il controllo che conta qui**: un
lettore rimasto lo segnalerebbe.

```bash
git add src/services/schemaImpianto
git commit -m "refactor(schema): via ALTEZZA_BYPASS, la quota del ponte è quella del suo capo"
```

---

## Task 4: `PASSO_GIUNZIONE` — la misura, il pavimento, e un commento che non mente

**Perché:** `PASSO_GIUNZIONE` è l'ultima costante della specifica mai tarata, e il suo commento
rimanda a una taratura nel Blocco 4 che non è stata fatta. **La misura presa in apertura di questo
blocco dice 20,6 unità al capo di monte e 28 al capo di valle: il valore attuale (20) è già
quello giusto**, e il task consiste nello scriverlo — con la misura, il metodo e il pavimento — non
nel cambiarlo. Il pavimento è la cosa che va scritta: le quattro ancore della giunzione coincidono
nel **centro** del riquadro, quindi a gioco zero il pallino sparirebbe dentro il simbolo del rombo
vicino.

**Files:**
- Modify: `src/services/schemaImpianto/layout.ts` (solo il commento di `PASSO_GIUNZIONE`)

- [ ] **Step 1: riscrivi il commento**

```
/**
 * Spazio fra l'ancora di una giunzione di by-pass e quella dello stadio vicino, di qua e di la'.
 * Non e' `GIOCO_FRA_STADI`: le quattro ancore della giunzione COINCIDONO nel suo centro
 * (symbols/index.ts), quindi a gioco zero il TEE finirebbe esattamente sulla punta del rombo
 * accanto e il pallino sparirebbe dentro il simbolo. **E' un pavimento, non un'estetica**: sotto
 * i 10 del codolo (`simboloRombo` lo fa sporgere di 10 unita' fuori da ciascuna punta) il pallino
 * entra nel tratto di attacco, sotto lo zero nel corpo del rombo.
 *
 * **Venti unita', misurate su `si bypass.png`** (Blocco 5, scala 0,5575 px/unita' letta dal
 * reticolo della tela): il centro del TEE di monte sta a x=291,0 — le sue due prese laterali a 285
 * e 297, cioe' ±10 unita' — e l'ancora `sx` del primo stadio scavalcato a x=302,5, che fanno 11,5
 * px = **20,6 unita'**. Al capo di valle la stessa distanza misura 28.
 *
 * Attenzione a cosa si misura: a x≈293 non c'e' la punta del rombo ma il PALLINO AZZURRO della
 * maniglia che l'editor disegna sull'ancora, e prenderlo per la punta fa leggere 3 unita' invece
 * di 20. La punta vera e' il vertice sinistro del rombo (`ANCORE_ROMBO`, symbols/index.ts), 10
 * unita' piu' in la' del codolo che ci sporge davanti.
 *
 * Dal Blocco 5 la stessa misura vale in due situazioni diverse: al capo di MONTE il TEE sta
 * `PASSO_CORSIA_BYPASS` piu' in alto e quindi SOPRA la punta del rombo, non di fianco; al capo di
 * valle sta sulla linea, di fianco. Un passo solo copre tutte e due, e i due test in
 * `layout.test.ts` lo dicono separatamente perche' la simmetria non c'e' piu'.
 */
```

- [ ] **Step 2: gate e commit**

```
npx vitest run
npx eslint src/services/schemaImpianto
```

```bash
git add src/services/schemaImpianto/layout.ts
git commit -m "docs(schema): PASSO_GIUNZIONE, la misura sul riferimento e il suo pavimento"
```

---

## Task 5: la verifica finale, sul disegno vero

**Perché:** i test non provano le proporzioni. Questo modulo ha una storia documentata di test verdi
per la ragione sbagliata, e il difetto peggiore di ogni blocco l'ha trovato il confronto col
riferimento, non la suite.

**Files:** nessuno del prodotto. Si usano gli attrezzi alla radice del worktree.

- [ ] **Step 1: genera il disegno vero**

```
npx tsx taratura.mts blocco5
```
Legge la scheda vera di `002 test` dal DB e scrive `.taratura/blocco5/{no-bypass,si-bypass}.{svg,png}`
più le quote di ogni nodo.

- [ ] **Step 2: misura, non guardare**

Sul PNG generato, con `riga.mts` e `griglia.mts`, verifica **cinque** cose e scrivile:

1. il TEE di monte sta alla quota dell'uscita del serbatoio (una riga forte sola, dal bocchello
   fino al gomito del ponte, senza interruzioni);
2. il montante scende sull'ascissa del TEE, non a mezza strada;
3. la valvola del montante sta due passi sotto il TEE, e sotto di lei il tratto è ondulato;
4. la corsa del ponte è **dritta** (rigida) e porta una valvola a metà;
5. dal TEE di valle la linea prosegue verso le utenze **alla quota della linea**, senza salti.

- [ ] **Step 3: metti i due disegni a fianco**

`crop.mts` sui due capi, alla stessa scala del riferimento, e confronta con
`DOCUMENTAZIONE/relazione/si bypass.png`. **Scrivi cosa non combacia**, anche se piccolo.

- [ ] **Step 4: il caso senza by-pass non deve essersi mosso**

`no-bypass.png` di questo giro e quello del Blocco 4 (`.taratura/finale/`) devono essere
**identici**: nulla di quanto fatto qui tocca un impianto senza giunzioni.

- [ ] **Step 5: gate completo**

```
npx vitest run
npx tsc --noEmit
npx eslint src/services/schemaImpianto src/components/schemaImpianto
```

---

## Cosa NON si fa in questo blocco

- **Toccare `PASSO_SERBATOI`**: 20 non è misurato e resta così finché non arriva un disegno con
  due serbatoi affiancati. **Chiederlo, non indovinare.**
- **Rendere simmetrici i due capi.** Il capo di valle resta sulla linea: è la decisione del
  committente, e renderlo simmetrico aggiungerebbe verso le utenze un tratto verticale che nel
  riferimento non c'è.
- **Mettere un nodo giunzione al gomito del ponte**, come fa il disegno di riferimento: lì il
  gomito è un vertice di polilinea, che non disegna simboli. Stessa geometria, un pallino in meno.
- **Rigenerare una fixture per far tornare verde un test.**
- **Alzare `VERSIONE` in `persistenza.ts`.** Nessuna delle modifiche cambia il formato salvato: le
  quote finiscono nelle coordinate, che sono già lì; `forma` e `ancoraggio` restano istruzioni di
  sola andata che il layout consuma.
- **Fondere o pubblicare** senza il via libera del committente.

---

## Le attività finali (dopo il Task 5, in quest'ordine)

### 1. La prova interattiva in pagina — non è una formalità

**Nel Blocco 4 non è stata fatta.** Su questo modulo la prova in pagina ha trovato **tre volte** il
difetto peggiore del blocco, sempre con più di 1300 test verdi.

Pratica **`002 test`** (`fed244ee-26e6-4d32-8c01-45abd393879d`), rotta
`/requests/<id>/technical-details`, poi il chip **SC**.

- [ ] **«Rigenera da capo» mostra il by-pass nuovo**, uguale al disegno del confronto senza browser.
- [ ] **Tela e documento disegnano lo STESSO tratteggio sulle condense.** È il candidato preciso di
      questo giro: `sfasamentoCondense` sta in `symbols/index.ts` e non in `renderSvg` proprio
      perché la usano tutt'e due, e **nessun test può confermarlo**. Guardare la corsia comune dove
      più linee si sovrappongono, sulla tela e nell'anteprima.
- [ ] **Un cambio di preferenze non ridisegna da sé.** Il blob dell'anteprima resta **identico**.
- [ ] **Comporre un by-pass, rigenerare, confrontare con `si bypass.png`.**
- [ ] **Chiudere e riaprire**: il layout riconciliato porta ancora il ponte e il montante, e le
      preferenze sono a posto in `additional_info` (Zod non le ha cancellate).
- [ ] **Ripristinare lo stato della pratica** a fine giro.

Trappole di interazione, tutte già pagate:
- **allargare il browser a 1920×1080** prima di interagire, o i controlli del pannello restano
  fuori schermo e i click vanno in timeout;
- **`SchemaImpiantoDialog` monta col `keepMounted`**: i suoi pulsanti sono nel DOM anche a finestra
  chiusa, e cliccarli da script colpisce elementi invisibili. Filtrare per
  `getBoundingClientRect().height > 0`, o usare i `ref` dello snapshot di Playwright;
- **`browser_drag` non è affidabile** su react-flow; su dnd-kit funziona il trascinamento da
  tastiera (focus sulla maniglia, `Space`, frecce, `Space`);
- **il dev server**: la 5173 è di un altro progetto (nei Blocchi 2 e 3 si è usata la **5199**).
  **Spegnerlo a fine sessione** e verificare che la porta sia libera: fermare il task non basta,
  il processo `vite` resta e va chiuso per PID;
- se il server MCP di Playwright va in timeout, il confronto senza browser basta per il visivo,
  **l'interattiva no** e va rifatta.

### 2. La pulizia

- [ ] Cancellare gli attrezzi di misura dalla radice del worktree — `taratura.mts`, `misura.mts`,
      `riga.mts`, `griglia.mts`, `crop.mts`, `fixture.mts`, `fixture-sorgenti.mts`, `estrai.mts`,
      `confronta.mts`, `scrivi-fixture.mts`, `annota.mts` — e la cartella `.taratura/`.
      **Leggerli prima di buttarli**: `confronta.mts` e `fixture.mts` sono il modo con cui si legge
      il diff di una fixture, e se il lavoro continua conviene tenerli.
- [ ] Togliere le righe aggiunte in coda a `.git/info/exclude`
      (`git rev-parse --git-path info/exclude` per trovarlo: **in un worktree `.git` è un file**,
      non una cartella).
- [ ] **Nel checkout principale**, cancellare la copia non tracciata `DOCUMENTAZIONE/relazione/no
      byass.png`, col refuso — **solo a merge fatto**.

### 3. Il merge simulato

- [ ] **`git fetch` PRIMA**, poi `git merge-tree --write-tree origin/main HEAD` contro un
      `origin/main` **appena aggiornato**. Mai contro il `main` locale: è la trappola già pagata
      una volta su questo repo, che aveva fatto **negare un conflitto reale**.
- [ ] Leggere l'esito e riferirlo. **Fermarsi qui**: non fondere e non pubblicare senza il via
      libera del committente.

---

## Le trappole che restano vere

1. **I file del repo hanno fine riga CRLF.** Le sostituzioni e le mutazioni «rompi apposta» scritte
   con pattern multi-riga e `\n` non agganciano e sembrano innocue. **Verificare sempre con
   `git diff --stat`.**
2. **I test verdi per la ragione sbagliata** sono la classe di difetto numero uno di questo modulo.
3. **Zod cancella i campi che non conosce.** `additionalInfoSchema` (`services/relazione/schema.ts`)
   è un `z.object` senza `passthrough`, e `additionalInfo` in `RelazioneDataDialog.tsx` è costruito
   da un letterale che non fa spread. *(Non morde su `preferenzeApplicate`, che viaggia dentro
   `schemaLayout`, `z.any()`.)*
4. **L'arco si emette sempre**, anche degenere fra due stadi adiacenti, e **non gli si mette mai un
   segno** — con l'unica eccezione, da questo blocco, del montante che scende da un capo di monte,
   che degenere non è mai: fra i suoi due capi c'è sempre una corsia intera.
5. **`t` di ripiego.** Ogni segno ancorato nasce con `t: 0.5`. Se il risolutore torna `null`, la
   valvola compare a metà tubo: sbagliata ma visibile. Degradazione voluta, mai un'eccezione.
6. **Un cambio di preferenze non deve MAI ridisegnare da sé.**
7. **Non lanciare più esecuzioni di `vitest run` in parallelo.**
8. **Per guardare un disegno senza browser:** `sharp` è già fra le dipendenze,
   `sharp(Buffer.from(svg), {density: 130}).png().toFile(...)`. Uno script `.mts` **alla radice del
   worktree** eseguito con `npx tsx`. E un attrezzo che deve nominare la sequenza che chiude un
   commento **non può avere un JSDoc in testa**: lo chiuderebbe in anticipo.

---

---

## Cosa è andato diversamente

**La misura che ha smentito la consegna, prima di tutto.** La consegna dava il TEE di monte a ~3
unità dalla punta del primo stadio e ne concludeva che `PASSO_GIUNZIONE` andava tarato in questo
blocco. La misura dice **20,6**: a x≈293 su `si bypass.png` non c'è la punta del rombo ma il
pallino della maniglia che l'editor disegna sull'ancora, e la punta vera — il vertice sinistro,
dove sta l'ancora `sx` — è a 302,5. Il Task 4 è diventato quindi un task di sola documentazione:
il valore era già quello giusto, mancava la misura che lo giustificasse e il pavimento sotto cui
non si scende.

**Il capo di valle del riferimento porta DUE nodi, non uno.** Sul disegno del committente, al capo
di valle, ci sono due giunzioni con le loro quattro maniglie: una in cima (574,5 / 74,5) e una
sulla linea (574,5 / 125). È il modo in cui si disegna un gomito a mano nell'editor, inserendo un
TEE. Il nostro ponte il gomito lo fa con un vertice di polilinea, che non disegna simboli: stessa
geometria, un pallino in meno. La scelta del committente è rispettata alla lettera.

**Il Task 2 è rimasto uno solo, ed era giusto così.** Le tre parti — dove si posa la `-IN`, quanti
vertici ha il ponte, dove stanno le valvole — non stanno in piedi separate: gli ancoraggi contano i
vertici, e i vertici dipendono dalla quota del capo. Spezzarlo avrebbe dato un gate su uno stato
che nessuno vuole.

**Tre cadute che il piano non aveva previsto**, tutte conseguenze della stessa cosa e tutte
riscritte dove la regola ora vive:

1. «il tubo dal serbatoio scende a mezza strada» — col by-pass in testa alla catena il dislivello
   fra bocchello e TEE **non c'è più**, e la rotta è dritta. La regola del gradino resta viva dove
   il dislivello c'è ancora: un by-pass che comincia in MEZZO alla catena. Il test è stato spostato
   lì, e prova la stessa cosa di prima sul caso in cui è ancora vera.
2. «ma senza dislivello non inventa gomiti» — provava l'arco `F1 → BP1-IN`, che ora un dislivello
   ce l'ha. Spostato sull'arco `E1 → BP1-OUT`, dove i due capi sono davvero complanari.
3. `persistenza.test.ts`, «il ponte entra nel salvataggio coi suoi gomiti» — due gomiti diventano
   uno. La promessa non cambia: il ponte entra nel salvataggio con la forma risolta dal layout.

**Il rapporto delle prove «rompi apposta».** Cinque mutazioni sul Task 2, tutte verificate entrate
prima di trarne conclusioni, tutte con almeno un test che cade: la quota della `-IN` (6 test), il
gomito rovesciato (4), l'ancora del montante da `basso` a `dx` (2), il ponte che torna flessibile
(2), la valvola del gomito dal lato sbagliato (2). La quarta al primo colpo **non è entrata** — il
testo di ancoraggio era sbagliato — e i test sono rimasti verdi: senza il controllo che la
mutazione fosse entrata sarebbe passata per un buco di copertura. È la trappola CRLF, in un'altra
veste.

**Nessuna fixture si è mossa**, come previsto. E la prova indipendente più forte: il disegno
generato dalla scheda vera **senza** by-pass è identico **byte a byte** a quello del Blocco 4.

## L'esito

**Gate verde su tutto il repo** al commit `10fcfcb`: **1471 test** (erano 1462), 101 file, `tsc`
pulito, eslint 0 su `services/schemaImpianto`.

**Il confronto col riferimento**, sulla scheda vera di `002 test`, misurato e non guardato:

| | riferimento | generato |
|---|---|---|
| il TEE di monte e l'uscita del serbatoio | stessa quota, una riga sola | una riga sola, dal bocchello al gomito |
| il montante di monte | scende sull'ascissa del TEE | scende sull'ascissa del TEE |
| la valvola del montante | due passi sotto il TEE, flessibile sotto | due passi sotto, flessibile sotto |
| la corsa del ponte | dritta, una valvola a metà | dritta, una valvola a metà |
| il capo di valle | sulla linea, la linea prosegue a quella quota | sulla linea, prosegue senza salti |

## La prova in pagina

Fatta per intero sulla pratica `002 test`, e **lo stato della pratica è stato ripristinato
identico** (confronto del JSON, non a occhio).

- **«Rigenera da capo» mostra il by-pass nuovo** — layout generato in pagina: `BP1-IN` a 90 sopra
  la linea, `BP1-OUT` sulla linea, ponte con un gomito solo, montante con la valvola a `t=0,182`
  (20 unità su 110) e ponte con le sue a `t=0,444` e `t=0,914` (360/810 e 740/810). I numeri sono
  quelli che la geometria impone.
- **Tela e documento disegnano lo STESSO tratteggio sulle condense** — verificato sui NUMERI e non
  a occhio: stessi punti di attacco e stessi `stroke-dashoffset` (2, 8, 9, 10, 11, 12) sulle sei
  linee. *Al primo giro sembravano diversi: era l'attrezzo di confronto a rendere il documento
  **senza la libreria di tarature**, che in produzione esiste e sposta le ancore. Il difetto era
  della misura, non del prodotto — ed è la stessa svista che ha aperto il punto qui sotto.*
- **Un cambio di preferenze non ridisegna da sé** — impronta SHA-256 del blob dell'anteprima
  identica prima e dopo aver acceso e spento una condensa.
- **Chiudi e riapri** — ricaricata la pagina, il layout riconciliato porta ancora `BP1-IN` in alto,
  il ponte e il montante; le preferenze sono in `additional_info` (Zod non le ha cancellate).

## Quello che la prova in pagina ha trovato, e NON è di questo blocco

**In produzione il passo fra due stadi esce 140, non 120.** La tabella `schema_simboli` porta
quattro tarature attive che spostano le ancore dei rombi dai VERTICI alle punte dei codoli
(`sx: -10`, `dx: 110`, `basso-out: 110`). Con quelle, `GIOCO_FRA_STADI = 20` non fa combaciare i
codoli — li allontana di altre 20 unità:

```
[SENZA tarature]                stadi a 560 680 800 920 1040 → passo 120
[CON le tarature di produzione] stadi a 570 710 850 990 1130 → passo 140
```

Il riferimento del committente dice **120**. Il Blocco 4 aveva tarato `GIOCO_FRA_STADI` misurando
il disegno generato **senza** libreria, dove 20 è il numero giusto perché le ancore stanno sui
vertici e i due codoli da 10 si toccano; con le ancore già sulle punte, il numero giusto sarebbe
**0** — che è poi ciò che la specifica diceva in origine («default 0, ancore coincidenti»).

**Non è stato toccato**, per due ragioni: `GIOCO_FRA_STADI = 20` è una decisione esplicita del
committente («non riaprire»), e la correzione dipende da quale delle due cose lui considera vera —
la costante o le tarature, che sono un dato suo e che qualcuno ha scritto per una ragione. **Va
deciso da lui.** La prova è ripetibile: l'attrezzo che l'ha misurata è cancellato con gli altri,
ma sta qui per intero — `.mts` alla radice del worktree, `npx tsx libreria-check.mts`:

```ts
// Attrezzo del Blocco 5, non prodotto: si cancella a fine giro.
// Genera lo schema della scheda vera DUE volte — senza e con la libreria di tarature di
// produzione (tabella `schema_simboli`) — e stampa i passi fra le apparecchiature. Serve a
// misurare quanto le tarature di produzione spostano le distanze tarate nel Blocco 4, che le
// aveva misurate sulle ancore di DEFAULT.
import { readFileSync } from 'node:fs'
import { buildSchemaModel } from './src/services/schemaImpianto/buildSchemaModel'
import { layoutSchema } from './src/services/schemaImpianto/layout'
import { preferenzeRisolteDaScheda } from './src/services/schemaImpianto/preferenze'
import type { Tarature } from './src/services/schemaImpianto/libreria'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((r) => r.includes('=') && !r.trimStart().startsWith('#'))
    .map((r) => { const i = r.indexOf('='); return [r.slice(0, i).trim(), r.slice(i + 1).trim()] })
)
const intestazione = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` }
const PRATICA = 'fed244ee-26e6-4d32-8c01-45abd393879d'

const [riga] = await (
  await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/dm329_technical_data?select=equipment_data,additional_info&request_id=eq.${PRATICA}`, { headers: intestazione })
).json()
const simboli = await (
  await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/schema_simboli?select=chiave,taratura`, { headers: intestazione })
).json()
const libreria: Tarature = Object.fromEntries(simboli.map((r: any) => [r.chiave, r.taratura]))

const scheda = riga.equipment_data
const collegamenti = riga.additional_info?.collegamentiCompressoriSerbatoi ?? {}

for (const [etichetta, lib] of [['SENZA tarature', {}], ['CON le tarature di produzione', libreria]] as const) {
  const preferenze = preferenzeRisolteDaScheda(scheda, undefined)
  const modello = buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: collegamenti, preferenze, libreria: lib })
  const layout = layoutSchema(modello, lib)
  const stadi = layout.nodi.filter((n) => ['essiccatore', 'filtro'].includes(n.tipo)).sort((a, b) => a.x - b.x)
  const passi = stadi.slice(1).map((n, i) => n.x - stadi[i].x)
  console.log(`\n[${etichetta}]`)
  console.log('  stadi:', stadi.map((n) => `${n.id}@${n.x}`).join(' '))
  console.log('  passo fra stadi:', passi.join(', '), '  (il riferimento del committente dice 120)')
}
```

*Da notare per chi riprende: la stessa svista può aver toccato le altre distanze tarate nel Blocco
4 (`STACCO_*`, `MARGINE_COLLETTORE_COMPRESSORI`). Il by-pass no: le sue misure sono state
verificate in pagina, con le tarature attive, e tornano.*

## Cosa resta aperto

**Un by-pass che comincia a metà catena disegna una gobba**: la linea di processo sale dallo stadio
precedente fino al TEE di monte e ridiscende subito dopo. Nel riferimento non si vede perché lì il
by-pass parte dal serbatoio, che è **già** a quella quota. È la lettura letterale della decisione
del committente; la variante — «sale solo il capo di monte del by-pass che parte dal serbatoio» —
è un ritocco di una riga in `corsieDeiCapiDiMonte`. **Da mostrargli, non da decidere.**

**Col by-pass la catena scivola 20 unità a destra** rispetto al caso senza, perché il TEE di monte
occupa un `PASSO_GIUNZIONE` prima del primo stadio. Sul riferimento la distanza vera fra bocchello
e primo stadio è 58 unità col by-pass contro le ~73 senza: il committente ha stretto a mano, non
allargato. Sotto la soglia di ciò che questo blocco tara.

**`PASSO_SERBATOI = 20` non è misurato** e resta così: i due riferimenti portano un serbatoio solo.
Si chiude solo con un disegno che ne mostri due affiancati — **chiederglielo, non indovinare**.
