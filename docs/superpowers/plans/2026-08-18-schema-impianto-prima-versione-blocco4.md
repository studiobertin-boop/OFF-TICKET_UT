# Schema d'impianto DM329 — Blocco 4: la taratura visiva

> **Per chi esegue:** SOTTO-SKILL RICHIESTA: `superpowers:executing-plans`, task per task, col gate
> a ogni passo. I passi usano caselle (`- [ ]`).

**Obiettivo:** la prima versione generata combacia con i due disegni di riferimento anche nelle
DISTANZE, non solo nella struttura. Si correggono le costanti del layout finché il disegno
generato e il riferimento, messi a fianco, dicono la stessa cosa.

**Architettura:** invariata. Questo blocco muove numeri, non forme — con due sole eccezioni
dichiarate e circoscritte: il tratteggio delle condense prende una fase (Task 5, locale alla resa)
e `xFinale` di `disponiInRiga` smette di portarsi dentro uno stacco implicito (Task 3, perché i
tre stacchi del disegno siano regolabili separatamente). Le due domande di FORMA rimaste aperte
(dove cade il gradino dal serbatoio, a che quota sta il TEE di un by-pass) non si decidono qui:
si rendono affiancate e si chiede al committente (Task 6).

**Stack:** TypeScript (strict=false), Vitest, nessuna libreria nuova. `sharp` è già fra le
dipendenze e serve solo all'attrezzo di misura, che non entra nel prodotto.

**Specifica:** `docs/superpowers/specs/2026-08-17-schema-impianto-prima-versione-design.md`
**Consegna:** `docs/superpowers/2026-08-18-prossima-sessione-blocco4-taratura.md`
**Piano precedente:** `docs/superpowers/plans/2026-08-18-schema-impianto-prima-versione-blocco3.md`,
col paragrafo «cosa è andato diversamente» e l'esito della prova in pagina in coda.

**Riferimenti visivi, in git:** `DOCUMENTAZIONE/relazione/si bypass.png` (643×253) e
`DOCUMENTAZIONE/relazione/no bypass.png` (643×302). **Sono il metro di questo blocco.**

**Ramo:** `worktree-schema-prima-versione-blocco1`, worktree
`.claude/worktrees/schema-prima-versione-blocco1`. Il Blocco 4 continua su questo ramo.

---

## Vincoli globali

- **`.env.local` va copiato dal checkout principale nel worktree** (è git-ignored) o un file di
  test fallisce per variabili mancanti. **Già fatto in apertura di sessione: i due file sono
  identici.** Contiene anche `APP_LOGIN_EMAIL` / `APP_LOGIN_PASSWORD` (ruolo admin) per la prova in
  pagina: **non chiederle al committente, e non stamparle mai.**
- **Baseline misurata all'apertura del Blocco 4**, commit `df3739f`: **1451 test verdi, 101 file**.
- **Niente `prettier --write`.**
- **Nessun test di interfaccia** (`CLAUDE.md`): la logica provabile va in servizi e funzioni pure.
- **Le decisioni già prese dal committente il 18-08-2026, che questo piano NON riapre:**
  - `GIOCO_FRA_STADI = 20`;
  - il tratteggio delle condense si fasa con `stroke-dashoffset`, **locale al render**; il
    collettore condense unico è **scartato**;
  - il merge si fa alla **FINE** del Blocco 4, non prima.
- **La convenzione 1 della specifica dice «un passo di griglia (10)»: sono DUE (20) dal
  18-08-2026**, e la stessa misura vale per le valvole dei montanti del ponte (convenzione 5).
  Il codice è già a posto (`SCARTO_VALVOLA = 20`, `buildSchemaModel.ts`): è la specifica a essere
  vecchia su quella riga. **Non «correggere» il codice verso la specifica.**

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
passa da 2 minuti a non finire più.

### Le fixture SVG

`svgRiferimentoSenzaTesti` e `svgRiferimentoConMuro` descrivono **compressore + serbatoio
orizzontale**: i Task 3 e 4 li toccano di sicuro. `svgRiferimentoConTee` **costruisce il layout a
mano**: se cambia, **ci si ferma**, perché vorrebbe dire aver toccato i simboli o l'instradamento.

Si rigenerano **seguendo la procedura scritta nel loro header**: rendere lo stesso layout col
codice NUOVO, spezzare l'SVG **un elemento per riga** (un `<rect>`/`<line>`/`<text>`/`<path>`/`<g>`
top-level per voce), **leggere il diff**, e annotare in testa il perché col commit che lo
introduce. **Mai per far tornare verde un test.** Il taglio giusto è **a profondità 1, con
emissione anche quando un figlio si chiude**: a profondità 0 esce una riga sola, che è proprio ciò
che l'header vieta.

### La prova «rompi apposta», a ogni task

I test verdi per la ragione sbagliata sono la classe di difetto numero uno di questo modulo. A ogni
task, prima di chiuderlo: rompi apposta la logica appena scritta e **guarda quali test cadono**.

**I file del repo hanno fine riga CRLF**: le mutazioni scritte con pattern multi-riga non
agganciano e sembrano innocue. **Verificare sempre con `git diff --stat` che la mutazione sia
entrata** prima di concludere che manca un test.

---

## Come si misura (già fatto in apertura, qui perché resti ripetibile)

I due riferimenti sono **esportazioni dell'editor di questo progetto**: portano il reticolo di
puntini della tela, che vale `PASSO_GRIGLIA = 10` unità. È da lì che si ricava la scala di
ciascuna immagine, e da lì che le misure qui sotto sono numeri e non impressioni.

| immagine | passo del reticolo | scala |
|---|---|---|
| `si bypass.png` | 5,575 px | **0,5575 px/unità** |
| `no bypass.png` | 5,81 px | **0,581 px/unità** |

**Controprova della scala:** su `no bypass.png` i centri dei quattro rombi cadono a
331 / 401 / 470 / 540 px, cioè un passo di **69,7 px = 120,0 unità** — esattamente il passo che
`GIOCO_FRA_STADI = 20` produce (ancore a 100 più 20 di gioco). La scala e la decisione del
committente si confermano a vicenda.

Gli attrezzi stanno alla radice del worktree, **fuori da git**
(`.git/info/exclude`), e **si cancellano a fine sessione**:

- `taratura.mts` — legge la scheda vera di `002 test` dal DB, genera lo schema con e senza
  by-pass, scrive SVG e PNG in `.taratura/<etichetta>/` e stampa le quote di ogni nodo;
- `misura.mts` — righe e colonne «forti» di un PNG (le linee lunghe del disegno);
- `riga.mts` — i tratti scuri lungo una riga o una colonna, per leggere estremi e distanze;
- `griglia.mts` — il passo del reticolo di puntini, cioè la scala dell'immagine;
- `crop.mts` — ritaglio ingrandito di una zona, per guardarla.

Si lanciano con `npx tsx <script>.mts` **dalla radice del worktree** (fuori non risolve
`node_modules`; e `tsx` non digerisce il `top-level await` in un `.ts`, per questo `.mts`).

### Il quadro delle misure, preso in apertura

| grandezza | ora | misurato sul riferimento | task |
|---|---|---|---|
| passo fra stadi adiacenti | 100 | **120** (69,7 px) | 1 |
| corsia del by-pass (uscita serbatoio → linea di processo) | 80 | **~90** (50,5 px) | 2 |
| quota del ponte | 20 sotto l'uscita del serbatoio | **alla STESSA quota** (y=74,5 in entrambi) | 2 |
| spazio fra due compressori | 60 | **~20** (11,4 px) | 3 |
| ultimo compressore → serbatoio | 140 | **~90** (53 px) | 3 |
| serbatoio → primo stadio | 60 | **~73** (42,5 px) | 3 |
| dorsale sopra la cima dei compressori | 150 | **~79** (46 px) | 4 |

---

## I file toccati

| file | task | cosa |
|---|---|---|
| `services/schemaImpianto/layout.ts` | 1, 2, 3, 4 | le costanti, `disponiInRiga` col passo, `xFinale` |
| `services/schemaImpianto/__tests__/layout.test.ts` | 1, 2, 3, 4 | i test geometrici delle nuove distanze |
| `services/schemaImpianto/symbols/index.ts` | 5 | `sfasamentoCondense`, accanto a `TRATTEGGIO_CONDENSE` |
| `services/schemaImpianto/__tests__/simboli.test.ts` | 5 | i test della fase |
| `services/schemaImpianto/renderSvg.ts` | 5 | `trattoSvg` emette `stroke-dashoffset` |
| `components/schemaImpianto/SchemaEdgeTubazione.tsx` | 5 | la tela usa la stessa formula |
| `__tests__/fixtures/svgRiferimentoSenzaTesti.ts` | 3, 4 | rigenerata, diff letto e annotato |
| `__tests__/fixtures/svgRiferimentoConMuro.ts` | 3, 4 | rigenerata, diff letto e annotato |

`svgRiferimentoConTee.ts` **non compare**: se cambia, ci si ferma.

---

## Task 1: `GIOCO_FRA_STADI` — i codoli si toccano

**Obiettivo:** portare la costante da 0 a 20, il valore deciso dal committente e confermato dalla
misura (passo 120 sul riferimento). A gioco 0 il codolo sinistro di ogni stadio **entra di 10
unità nel corpo del rombo vicino** e i due simboli sembrano fusi; a 20 i due codoli si toccano
punta a punta e formano il collegamento, che è ciò che si vede nei due riferimenti.

La geometria, da `simboloRombo` (`symbols/index.ts`): il rombo occupa `x ∈ [0, 100]` dentro un
riquadro largo 110, le ancore `sx`/`dx` stanno **sulle due punte** (`x = 0` e `x = 100`), e i due
codoli sporgono di 10 **fuori dalle punte** (`x ∈ [-10, 0]` e `x ∈ [100, 110]`).

**Files:**
- Modify: `src/services/schemaImpianto/layout.ts:117` (`GIOCO_FRA_STADI`)
- Test: `src/services/schemaImpianto/__tests__/layout.test.ts`

**Interfaces:**
- Consumes: niente dai task precedenti.
- Produces: `GIOCO_FRA_STADI: number = 20` — il Task 3 lo cita nel commento di `xFinale`.

> **Attenzione:** i test esistenti della convenzione 3 asseriscono **sulla costante**, non sul suo
> valore, e le tre fixture descrivono impianti **senza stadi**. Questo task quindi **non muove
> nessuna fixture e non fa cadere nessun test** — già provato il 18-08-2026. Un test che asserisse
> `GIOCO_FRA_STADI === 20` sarebbe tautologico e non va scritto: il test qui sotto asserisce la
> **proprietà geometrica** che quel valore incarna, e fallisce a 0.

- [ ] **Passo 1: scrivere il test che fallisce**

In `layout.test.ts`, nel `describe` del by-pass — quello che possiede gli aiutanti `disegno()`,
`stadiDi()` e `nodo()` — accanto al test «l'ancora dx di uno stadio coincide con l'ancora sx del
successivo» (riga ~926), aggiungere:

```ts
it('i codoli di due stadi adiacenti si toccano punta a punta, senza entrare l’uno nell’altro', () => {
  // `simboloRombo` (symbols/index.ts) disegna il rombo fra x=0 e x=100 dentro un riquadro largo
  // 110, con le ancore sx/dx sulle DUE PUNTE e un codolo di 10 unita' che sporge fuori da
  // ciascuna. Il collegamento fra due stadi e' fatto dai due codoli che si incontrano: a gioco 0
  // il codolo sinistro del secondo rombo entrava di 10 unita' nel corpo del primo, e i due
  // simboli sembravano fusi — cio' che il disegno mostrava prima del Blocco 4.
  //
  // Non e' un doppione del test qui sopra: quello fissa che il passo venga dalle ANCORE, questo
  // fissa PERCHE' il gioco non puo' essere zero. Il primo passa anche a gioco 0.
  const CODOLO = 10
  const stadi = stadiDi(disegno([]))
  expect(stadi.length).toBeGreaterThan(1)
  for (let i = 0; i + 1 < stadi.length; i++) {
    const puntaDx = posizioneAncora(stadi[i], 'dx').x
    const puntaSx = posizioneAncora(stadi[i + 1], 'sx').x
    expect(puntaDx + CODOLO).toBe(puntaSx - CODOLO)
  }
})
```

`disegno([])` è l'aiutante già nel file: nessun gruppo by-pass, catena `F1 → E1 → F2`.
`stadiDi`, `posizioneAncora` e `GIOCO_FRA_STADI` sono già importati o definiti lì.

- [ ] **Passo 2: lanciare il test e vederlo fallire per la ragione giusta**

Esegui: `npx vitest run src/services/schemaImpianto/__tests__/layout.test.ts -t 'codoli'`
Atteso: **FAIL** su uno scarto di 20 fra i due codoli — cioè per la distanza, non per un
riferimento non definito.

- [ ] **Passo 3: portare la costante a 20**

In `layout.ts`, sostituire la dichiarazione **e il commento**, che oggi dice «Zero» e «da guardare
nel Blocco 4»:

```ts
/**
 * Spazio fra l'ancora `dx` di uno stadio e l'ancora `sx` del successivo: **venti unita'**, due
 * passi di griglia. Il passo fra stadi vale quindi 120 (ancore a 100 piu' il gioco), contro i 170
 * di prima del Blocco 2 (riquadro 110 piu' `PASSO_ORIZZONTALE`), che e' la convenzione 3.
 *
 * Deciso dal committente il 18-08-2026, e confermato dalla misura sul riferimento: su
 * `no bypass.png` i centri dei quattro rombi cadono a 331/401/470/540 px, un passo di 69,7 px che
 * alla scala di quell'immagine (0,581 px/unita', dal reticolo da 10 unita' della tela) fa
 * **120,0 unita'**.
 *
 * Non e' un valore estetico ma la condizione perche' il collegamento fra due stadi si veda:
 * `simboloRombo` (symbols/index.ts) disegna un codolo di 10 unita' che sporge FUORI da ciascuna
 * delle due punte. A gioco 20 i due codoli si toccano e formano il tratto di tubo; a gioco 0 il
 * codolo sinistro del secondo rombo entrava di 10 unita' nel corpo del primo, e i due simboli
 * sembravano fusi.
 */
export const GIOCO_FRA_STADI = 20
```

- [ ] **Passo 4: lanciare il test e vederlo passare**

Esegui: `npx vitest run src/services/schemaImpianto/__tests__/layout.test.ts -t 'codoli'`
Atteso: **PASS**

- [ ] **Passo 5: la prova «rompi apposta»**

Rimettere `GIOCO_FRA_STADI = 0`, verificare con `git diff --stat` che la modifica sia **entrata**
(fine riga CRLF), rilanciare `npx vitest run src/services/schemaImpianto` e **annotare quanti e
quali test cadono**. Deve cadere almeno il test nuovo. Poi rimettere 20.

- [ ] **Passo 5b: aggiornare il titolo di un test che diventa bugiardo**

Il test alla riga ~935 si chiama **«il passo fra due stadi è 100, non i 170 del riquadro più
`PASSO_ORIZZONTALE`»**, ma asserisce `100 + GIOCO_FRA_STADI` — quindi **passa** a gioco 20, col
titolo che dice il numero sbagliato. Rinominarlo in **«il passo fra due stadi viene dalle ancore,
non dal riquadro più `PASSO_ORIZZONTALE`»** e togliere dal commento la frase «quello si chiude nel
Blocco 4», che non è più vera.

- [ ] **Passo 6: il gate, e le fixture**

```
npx vitest run
npx tsc --noEmit
npx eslint src/services/schemaImpianto
git diff --stat src/services/schemaImpianto/__tests__/fixtures/
```
Atteso: 1451+1 test verdi, `tsc` pulito, eslint 0 warning su quel percorso, **fixture intatte**
(l'ultimo comando non stampa nulla). Se una fixture si muove, **fermarsi e guardare il diff**:
vorrebbe dire che un impianto senza stadi ha sentito una costante della catena, e non deve.

- [ ] **Passo 7: guardare il disegno**

```
npx tsx taratura.mts t1
```
Aprire `.taratura/t1/no-bypass.png` e metterlo a fianco di `DOCUMENTAZIONE/relazione/no bypass.png`.
Atteso: i cinque rombi non sono più fusi, fra una punta e l'altra si vede un tratto di tubo.

- [ ] **Passo 8: commit**

```bash
git add src/services/schemaImpianto/layout.ts src/services/schemaImpianto/__tests__/layout.test.ts
git commit -m "fix(schema): i codoli di due stadi adiacenti si toccano invece di sovrapporsi"
```

---

## Task 2: il ponte alla quota dell'uscita del serbatoio

**Obiettivo:** il ponte di un by-pass corre alla **stessa quota** dell'uscita del serbatoio, non 20
unità sotto, e la corsia vale **90** invece di 80.

**Cosa dice il riferimento.** Su `si bypass.png` la scansione delle righe forti trova un'unica
orizzontale lunga a **y=74/75** (322 px, cioè quasi tutta la larghezza): è insieme il tratto che
esce dal serbatoio **e** la corsa del ponte — la stessa quota. La linea di processo, quella che
passa per le punte dei rombi, sta a **y=124/125**. Lo scarto è **50,5 px**, che alla scala di
quell'immagine (0,5575 px/unità) fa **90,6 unità**.

**Controprova indipendente.** I montanti del ponte portano la valvola due passi (20) sotto
l'orizzontale, e sotto la valvola il tratto è flessibile: con una corsia di 90 restano 70 unità di
molla, cioè le **tre o quattro ondulazioni** che si contano sul riferimento. Con gli attuali 60 di
`ALTEZZA_BYPASS` ne resta una sola.

**Files:**
- Modify: `src/services/schemaImpianto/layout.ts:139` (`PASSO_CORSIA_BYPASS`), `layout.ts:148`
  (`ALTEZZA_BYPASS`)
- Test: `src/services/schemaImpianto/__tests__/layout.test.ts`

**Interfaces:**
- Consumes: `GIOCO_FRA_STADI = 20` dal Task 1 (nessuna dipendenza di codice, solo il disegno).
- Produces: `PASSO_CORSIA_BYPASS: number = 90`, `ALTEZZA_BYPASS: number = PASSO_CORSIA_BYPASS`.

> **Un test esistente cadrà, ed è giusto così.** Alla riga ~1107 di `layout.test.ts` c'è
> **«e scende perché il ponte le passi SOTTO l'uscita del serbatoio, non addosso»**, che asserisce
> `yPonte > posizioneAncora(nodo(l,'S1'),'dx').y`. Con `ALTEZZA_BYPASS === PASSO_CORSIA_BYPASS` la
> corsa del ponte cade **esattamente** su quella quota, e il `toBeGreaterThan` fallisce. Non è una
> regressione: quel test fissava un'approssimazione della regola vera. **Va riscritto**, non
> allentato — è il Passo 1 qui sotto. La ragione per cui il ponte non si accavalla all'uscita del
> serbatoio non è che stia più in basso, ma che la sua corsa **comincia a destra** del punto in cui
> la linea di processo è già scesa: le due orizzontali sono complanari e disgiunte, che è
> esattamente ciò che su `si bypass.png` produce **una sola riga forte** a y=74/75.

- [ ] **Passo 1: riscrivere il test esistente, e vederlo fallire**

Nel `describe` del by-pass, **sostituire** il test «e scende perché il ponte le passi SOTTO
l'uscita del serbatoio, non addosso» con:

```ts
it('la corsa del ponte cade sulla quota dell’uscita del serbatoio, e comincia oltre di essa', () => {
  // E' l'invariante che il committente ha disegnato a mano su `si bypass.png`: il tratto che esce
  // dal serbatoio e la corsa del ponte sono la STESSA orizzontale — una sola riga forte, y=74/75,
  // lunga 322 px su 643. La linea di processo scende di una corsia proprio perche' il ponte possa
  // correre li': e' quindi `ALTEZZA_BYPASS === PASSO_CORSIA_BYPASS`, non un numero libero, e il
  // legame fra le due costanti va fissato qui o si sfalderebbe alla prima taratura.
  //
  // Fino al 18-08-2026 questo test chiedeva che il ponte stesse piu' in BASSO dell'uscita: era
  // un'approssimazione della regola. Cio' che tiene i due tratti separati non e' la quota — sono
  // complanari — ma l'ascissa: la corsa del ponte comincia dove la linea di processo e' gia'
  // scesa, cioe' a destra del bocchello.
  const l = disegno()
  const uscita = posizioneAncora(nodo(l, 'S1'), 'dx')
  const punti = polilineaPonte(l)
  expect(punti[1].y).toBe(uscita.y)
  expect(punti[2].y).toBe(uscita.y)
  expect(punti[1].x).toBeGreaterThan(uscita.x)
})
```

`disegno()`, `polilineaPonte()` e `nodo()` sono gli aiutanti già nel file; `polilineaPonte`
restituisce i quattro vertici `[capo, gomito, gomito, capo]`, come fissa il test «il ponte esce dal
layout con quattro vertici».

- [ ] **Passo 2: lanciare il test e vederlo fallire per la ragione giusta**

Esegui: `npx vitest run src/services/schemaImpianto/__tests__/layout.test.ts -t 'corsa del ponte'`
Atteso: **FAIL** con uno scarto di **20** fra atteso e ottenuto sulla prima asserzione (la corsa
del ponte sta 20 sotto l'uscita), non un errore su un aiutante non definito. La terza asserzione
deve **già** passare: è la parte della vecchia regola che resta vera.

- [ ] **Passo 3: portare le due costanti al valore misurato**

In `layout.ts`:

```ts
/**
 * Di quanto la linea di processo SCENDE quando c'e' almeno un by-pass, e di quanto si separano due
 * corsie di ponte che si sovrappongono. Serve perche' il ponte corra SOTTO l'uscita del serbatoio
 * invece di accavallarcisi.
 *
 * **Novanta unita', misurate su `si bypass.png`**: la corsa del ponte sta a y=74,5 px e la linea
 * di processo a y=125, uno scarto di 50,5 px che alla scala di quell'immagine (0,5575 px/unita')
 * fa 90,6. Controprova: con una corsia di 90 e la valvola due passi sotto l'orizzontale, sotto la
 * valvola restano 70 unita' di flessibile, cioe' le tre o quattro ondulazioni che si contano sul
 * riferimento.
 */
export const PASSO_CORSIA_BYPASS = 90

/**
 * Quanto il ponte di un by-pass corre sopra la linea di processo. **Esattamente
 * `PASSO_CORSIA_BYPASS`**, e non un numero suo: la linea di processo scende di una corsia proprio
 * perche' il ponte possa correre alla quota dell'uscita del serbatoio, e su `si bypass.png` quei
 * due tratti sono la STESSA orizzontale (una sola riga forte, y=74/75). Fino al 18-08-2026 valeva
 * 60, e il ponte passava 20 unita' sotto il bocchello: il tratto di flessibile sotto le valvole dei
 * montanti si riduceva a una sola ondulazione contro le tre o quattro del disegno vero.
 *
 * Un test lega le due misure (`layout.test.ts`): scriverle uguali per caso non basta, la relazione
 * e' il disegno.
 */
export const ALTEZZA_BYPASS = PASSO_CORSIA_BYPASS
```

- [ ] **Passo 4: lanciare i test e vederli passare**

Esegui: `npx vitest run src/services/schemaImpianto/__tests__/layout.test.ts`
Atteso: **PASS**, tutto il file. Attenzione ai due test che citano `PASSO_CORSIA_BYPASS` — «con un
by-pass la linea di processo scende di una corsia» e «le tre valvole del ponte finiscono dove le
convenzioni le vogliono»: il primo asserisce sulla costante e regge; il secondo misura posizioni
sul ponte e **potrebbe** portarsi dietro numeri assoluti. Se cade, **guardarlo**: se asseriva su
`ALTEZZA_BYPASS` va bene com'è, se aveva un 60 scritto a mano va corretto **e va scritto nel
commento perché**.

- [ ] **Passo 5: la prova «rompi apposta»**

Mettere `ALTEZZA_BYPASS = PASSO_CORSIA_BYPASS - 20`, verificare con `git diff --stat` che sia
entrata, rilanciare `npx vitest run src/services/schemaImpianto` e annotare cosa cade. Deve cadere
il test nuovo. Poi rimettere l'uguaglianza.

- [ ] **Passo 6: il gate**

```
npx vitest run
npx tsc --noEmit
npx eslint src/services/schemaImpianto
git diff --stat src/services/schemaImpianto/__tests__/fixtures/
```
Atteso: verde, **fixture intatte** (nessuna delle tre porta un by-pass).

- [ ] **Passo 7: guardare il disegno**

```
npx tsx taratura.mts t2
```
Aprire `.taratura/t2/si-bypass.png` a fianco di `DOCUMENTAZIONE/relazione/si bypass.png`.
Atteso: il ponte corre alla quota del bocchello del serbatoio; sotto le valvole dei due montanti si
contano tre o quattro ondulazioni. **Annotare cosa resta diverso** — in particolare la posizione
del TEE, che nel riferimento sta in cima al montante e qui sta in basso sulla linea di processo:
è la domanda di forma del Task 6, **non si corregge qui**.

- [ ] **Passo 8: commit**

```bash
git add src/services/schemaImpianto/layout.ts src/services/schemaImpianto/__tests__/layout.test.ts
git commit -m "fix(schema): il ponte del by-pass corre alla quota dell'uscita del serbatoio"
```

---

## Task 3: compattezza in larghezza — i tre stacchi diventano tre costanti

**Obiettivo:** stringere il disegno in larghezza fino alle distanze del riferimento, **senza
toccare `PASSO_ORIZZONTALE`** — condiviso con `calcolaMuro` e con la corsia di raccolta, muoverlo
sposterebbe cose che il riferimento non smentisce.

**Cosa dice il riferimento** (`no bypass.png`, scala 0,581 px/unità):

| stacco | px | unità | ora |
|---|---|---|---|
| fra i due compressori (bordo destro di C1 → bordo sinistro di C2) | 11,4 | **~20** | 60 |
| ultimo compressore → serbatoio (151 → 204) | 53 | **~90** | 140 |
| serbatoio → punta sinistra del primo stadio (261 → 303,5) | 42,5 | **~73** | 60 |

Il terzo va **allargato**, non stretto: su quel tratto ci sta la valvola di riserva all'uscita del
serbatoio (convenzione 6), e a 60 unità le sta stretta.

**Il cambiamento di forma, dichiarato.** Oggi `xFinale` di `disponiInRiga` è «bordo destro
dell'ultimo elemento **più un `PASSO_ORIZZONTALE` implicito**», e i tre stacchi non sono
regolabili separatamente: quello fra compressori e serbatoi vale `PASSO_ORIZZONTALE +
PASSO_VERTICALE`, e `PASSO_VERTICALE` — che il commento dichiara «distanza VERTICALE fra le due
righe» — è in realtà usato come scarto orizzontale. `xFinale` diventa il **solo bordo destro**, e
ogni stacco lo mette il chiamante con la costante che ne porta il nome. `PASSO_VERTICALE` sparisce,
perché non descriveva ciò che faceva.

**Files:**
- Modify: `src/services/schemaImpianto/layout.ts` — `PASSO_VERTICALE` (riga 104) via, tre costanti
  nuove, `disponiInRiga` (righe ~229-265) prende `passo`, `layoutSchema` (righe ~416-425) ai tre
  punti di attacco
- Test: `src/services/schemaImpianto/__tests__/layout.test.ts`
- Modify: `src/services/schemaImpianto/__tests__/fixtures/svgRiferimentoSenzaTesti.ts`,
  `__tests__/fixtures/svgRiferimentoConMuro.ts` — **rigenerate**

**Interfaces:**
- Consumes: niente.
- Produces: `PASSO_COMPRESSORI: number = 20`, `PASSO_SERBATOI: number = 20`,
  `STACCO_COMPRESSORI_SERBATOI: number = 90`, `STACCO_SERBATOI_LINEA: number = 70`;
  `disponiInRiga(nodi, xIniziale, quota, allineamento?, libreria?, passo?)` con
  `xFinale = bordo destro dell'ultimo elemento`.

- [ ] **Passo 1: scrivere i test che falliscono**

In `layout.test.ts`, in un `describe` nuovo **«gli stacchi fra le famiglie»** posto accanto a quelli
del layout. I primi due usano `schedaTrePiuUno()` (tre compressori, e il serbatoio `S1` che
`makeScheda` mette di default); il terzo usa l'aiutante `disegno([])` del `describe` del by-pass —
se sta in un altro `describe`, richiamare `schedaConTreStadi()` come fa lui:

```ts
describe('gli stacchi fra le famiglie', () => {
  const impianto = () =>
    layoutSchema(
      buildSchemaModel({
        scheda: schedaTrePiuUno(),
        collegamentiCompressoriSerbatoi: { C1: ['S1'], C2: ['S1'], C3: ['S1'] },
      })
    )

  it('due compressori affiancati stanno a due passi di griglia l’uno dall’altro', () => {
    // Convenzione 8, misurata su `no bypass.png`: fra il bordo destro di C1 e quello sinistro di
    // C2 corrono 11,4 px, cioe' ~20 unita' alla scala di quell'immagine (0,581 px/unita', letta
    // dal reticolo da 10 unita' della tela). Prima erano 60, cioe' `PASSO_ORIZZONTALE`.
    const compressori = impianto().nodi.filter((n) => n.tipo === 'compressore').sort((a, b) => a.x - b.x)
    expect(compressori.length).toBeGreaterThan(1)
    for (let i = 0; i + 1 < compressori.length; i++) {
      const bordoDestro = compressori[i].x + dimensioniDi(compressori[i]).larghezza
      expect(compressori[i + 1].x - bordoDestro).toBe(PASSO_COMPRESSORI)
    }
  })

  it('il serbatoio segue i compressori a un solo stacco, non a due sommati', () => {
    // Prima valeva `PASSO_ORIZZONTALE + PASSO_VERTICALE` = 140, e nessuno dei due nomi diceva
    // «stacco fra la sala compressori e i serbatoi» — il secondo si dichiarava perfino VERTICALE.
    // Misurato ~90 sul riferimento (53 px fra il bordo destro di C2 e quello sinistro di S1).
    const l = impianto()
    const compressori = l.nodi.filter((n) => n.tipo === 'compressore').sort((a, b) => a.x - b.x)
    const ultimo = compressori[compressori.length - 1]
    const serbatoio = nodo(l, 'S1')
    expect(serbatoio.x - (ultimo.x + dimensioniDi(ultimo).larghezza)).toBe(STACCO_COMPRESSORI_SERBATOI)
  })

  it('il primo stadio segue il serbatoio a `STACCO_SERBATOI_LINEA` dal suo bordo', () => {
    // Su questo tratto sta la valvola di riserva all'uscita del serbatoio (convenzione 6):
    // misurato ~73 sul riferimento (42,5 px), contro i 60 di prima. Qui si ALLARGA — e' l'unico
    // dei tre stacchi che cresce.
    const l = layoutSchema(
      buildSchemaModel({
        scheda: schedaConTreStadi(),
        collegamentiCompressoriSerbatoi: { C1: ['S1'] },
      })
    )
    const serbatoio = nodo(l, 'S1')
    const primo = l.nodi
      .filter((n) => n.tipo === 'filtro' || n.tipo === 'essiccatore')
      .sort((a, b) => a.x - b.x)[0]
    const bordoSerbatoio = serbatoio.x + dimensioniDi(serbatoio).larghezza
    expect(posizioneAncora(primo, 'sx').x - bordoSerbatoio).toBe(STACCO_SERBATOI_LINEA)
  })
})
```

`schedaTrePiuUno`, `schedaConTreStadi`, `nodo`, `dimensioniDi`, `posizioneAncora` e `buildSchemaModel`
sono già nel file. Le tre costanti nuove vanno aggiunte all'import da `../layout`.

- [ ] **Passo 2: lanciare i test e vederli fallire per la ragione giusta**

Esegui: `npx vitest run src/services/schemaImpianto/__tests__/layout.test.ts -t 'compressori'`
Atteso: **FAIL** con gli scarti veri — 60 invece di 20, 140 invece di 90, 60 invece di 70 — non
errori su riferimenti non definiti.

- [ ] **Passo 3: le costanti nuove**

In `layout.ts`, **al posto** di `PASSO_VERTICALE` (che sparisce):

```ts
/**
 * Spazio fra due compressori affiancati. Due passi di griglia: misurato su `no bypass.png`, fra il
 * bordo destro di C1 e quello sinistro di C2 corrono 11,4 px, cioe' ~20 unita' alla scala di
 * quell'immagine (0,581 px/unita', dal reticolo da 10 unita' della tela). E' la convenzione 8,
 * «spazi ridotti allo stretto indispensabile»: prima valeva `PASSO_ORIZZONTALE`, 60.
 *
 * Suo e non `PASSO_ORIZZONTALE` perche' quello e' condiviso con `calcolaMuro` e con la corsia di
 * raccolta, che il riferimento non smentisce.
 */
export const PASSO_COMPRESSORI = 20

/**
 * Spazio fra due serbatoi affiancati. Lo stesso dei compressori: i due riferimenti portano un
 * serbatoio solo, quindi questa misura NON e' stata letta su un disegno — e' la scelta simmetrica,
 * l'unica difendibile senza un dato. Se il committente un giorno ne fornisce uno con due serbatoi,
 * si taglia qui senza toccare altro.
 */
export const PASSO_SERBATOI = 20

/**
 * Stacco fra la riga dei compressori e quella dei serbatoi. Misurato ~90 su `no bypass.png`
 * (53 px fra il bordo destro di C2 e quello sinistro di S1).
 *
 * Prima questo stacco non esisteva come nome: valeva `PASSO_ORIZZONTALE + PASSO_VERTICALE` = 140,
 * dove il secondo era dichiarato «distanza VERTICALE fra la riga dei compressori e quella dei
 * serbatoi» e veniva invece sommato all'ascissa. `PASSO_VERTICALE` e' stato tolto per questo: non
 * descriveva cio' che faceva.
 */
export const STACCO_COMPRESSORI_SERBATOI = 90

/**
 * Stacco fra il bordo destro dell'ultimo serbatoio e l'ancora `sx` del primo stadio. Misurato ~73
 * su `no bypass.png` (42,5 px). **Qui si allarga**, dai 60 di `PASSO_ORIZZONTALE`: su questo
 * tratto sta la valvola di riserva all'uscita del serbatoio (convenzione 6), e a 60 le stava
 * stretta. 70 e' la misura arrotondata al passo di griglia.
 */
export const STACCO_SERBATOI_LINEA = 70
```

- [ ] **Passo 4: `disponiInRiga` prende il passo, e `xFinale` cambia significato**

In `disponiInRiga`, aggiungere il parametro in coda (dopo `libreria`, così i chiamanti che non lo
passano non cambiano forma) e cambiare le due righe che contano:

```ts
function disponiInRiga(
  nodi: SchemaNodo[],
  xIniziale: number,
  quota: number,
  allineamento: 'centro' | 'basso' = 'centro',
  libreria: Tarature = {},
  passo: number = PASSO_ORIZZONTALE
): { posizionati: SchemaNodoPosizionato[]; xFinale: number } {
  let x = xIniziale
  let bordoDestro = xIniziale
  const posizionati = nodi.map((nodo) => {
    const dim = dimensioniDi(nodo, libreria)
    const y = allineamento === 'basso' ? quota - dim.altezza : quota - dim.altezza / 2
    const collocato = posiziona(nodo, x, y)
    bordoDestro = x + dim.larghezza
    x = bordoDestro + passo
    return collocato
  })
  return { posizionati, xFinale: bordoDestro }
}
```

Al commento della funzione aggiungere in coda:

```
 * **`xFinale` e' il BORDO DESTRO dell'ultimo elemento**, non il bordo piu' un passo. Lo stacco
 * verso cio' che segue lo mette il chiamante, con la costante che ne porta il nome: prima ci
 * finiva dentro un `PASSO_ORIZZONTALE` implicito, e i due stacchi del disegno — compressori →
 * serbatoi e serbatoi → linea — non erano regolabili separatamente. Con la riga vuota `xFinale`
 * resta `xIniziale`, come prima.
```

- [ ] **Passo 5: i tre punti di attacco in `layoutSchema`**

```ts
  const rigaCompressori = disponiInRiga(
    compressori, MARGINE, yCentroCompressori, 'centro', libreria, PASSO_COMPRESSORI
  )
  const rigaSerbatoi = disponiInRiga(
    serbatoi,
    rigaCompressori.xFinale + STACCO_COMPRESSORI_SERBATOI,
    yBase,
    'basso',
    libreria,
    PASSO_SERBATOI
  )
  const quotaLinea = quotaLineaProcesso(rigaSerbatoi.posizionati, yCentroSerbatoi, libreria, catena)
  const rigaCatena = disponiCatenaPerAncore(
    catena, rigaSerbatoi.xFinale + STACCO_SERBATOI_LINEA, quotaLinea, libreria
  )
```

La riga della raccolta condense **non si tocca**: resta col passo di default, e il suo `xIniziale`
resta `Math.max(rigaCatena.xFinale, MARGINE)` — `rigaCatena.xFinale` viene da
`disponiCatenaPerAncore`, che ha un `xFinale` suo (bordo destro più `PASSO_ORIZZONTALE`) e che
questo task **non cambia**. Stessa cosa per il terminale utenze.

- [ ] **Passo 6: lanciare i test e vederli passare**

Esegui: `npx vitest run src/services/schemaImpianto/__tests__/layout.test.ts`
Atteso: i tre test nuovi **PASS**. Altri test del file possono cadere perché fissavano le vecchie
distanze: **guardarli uno per uno**. Se un test fissava `PASSO_ORIZZONTALE + PASSO_VERTICALE`
fra compressori e serbatoi, va aggiornato alla costante nuova e **il commento va cambiato**; se
un test cade per una ragione che non è una distanza fra righe, **fermarsi**.

- [ ] **Passo 7: rigenerare le due fixture, leggendo il diff**

Le due fixture descrivono compressore + serbatoio orizzontale: gli stacchi le muovono di sicuro.
**Seguire la procedura scritta nel loro header** (Vincoli globali → «Le fixture SVG»): rendere lo
stesso layout col codice nuovo, spezzare un elemento per riga a profondità 1 con emissione anche
quando un figlio si chiude, **leggere il diff**, e aggiungere in testa il paragrafo che dice
**perché** cambia. Il testo da aggiungere, sullo stampo di quelli che ci sono:

```
 * Generato di nuovo al commit <hash> ("fix(schema): il disegno si stringe in larghezza"), Task 3
 * del Blocco 4: gli stacchi fra le famiglie diventano costanti proprie e scendono ai valori
 * misurati sui riferimenti (compressori fra loro 60 -> 20, compressori -> serbatoi 140 -> 90,
 * serbatoi -> linea 60 -> 70). Cambiano `viewBox` e tutte le ascisse di nodi e tubazioni; non
 * cambia nessuna ordinata, nessun markup di simbolo, nessun testo della tabella.
```

**Prima di scrivere quel paragrafo, verificare che sia vero**: nel diff non devono comparire
ordinate diverse né markup di simboli. Se compaiono, **fermarsi**: questo task non tocca né le
quote né i simboli.

- [ ] **Passo 8: `svgRiferimentoConTee` deve essere intatta**

```
git diff --stat src/services/schemaImpianto/__tests__/fixtures/svgRiferimentoConTee.ts
```
Atteso: **nessuna riga**. Costruisce il layout a mano: se cambia, ci si ferma.

- [ ] **Passo 9: la prova «rompi apposta»**

Portare `STACCO_COMPRESSORI_SERBATOI` a 140, verificare con `git diff --stat` che sia entrata,
rilanciare `npx vitest run src/services/schemaImpianto` e annotare cosa cade. Devono cadere il test
nuovo **e** le due fixture. Se cade solo il test, le fixture non stanno guardando la larghezza e
va detto. Poi rimettere 90.

- [ ] **Passo 10: il gate**

```
npx vitest run
npx tsc --noEmit
npx eslint src/services/schemaImpianto
```
Atteso: verde, `tsc` pulito (attenzione a `PASSO_VERTICALE` rimasto importato da qualche parte:
`tsc` lo segnala), eslint 0 warning.

- [ ] **Passo 11: guardare il disegno**

```
npx tsx taratura.mts t3
```
`.taratura/t3/no-bypass.png` a fianco di `no bypass.png`. Atteso: i due compressori si sfiorano, il
serbatoio è vicino, e il tratto fra serbatoio e primo stadio è appena più lungo di prima.

- [ ] **Passo 12: commit**

```bash
git add src/services/schemaImpianto/layout.ts \
        src/services/schemaImpianto/__tests__/layout.test.ts \
        src/services/schemaImpianto/__tests__/fixtures/svgRiferimentoSenzaTesti.ts \
        src/services/schemaImpianto/__tests__/fixtures/svgRiferimentoConMuro.ts
git commit -m "fix(schema): il disegno si stringe in larghezza, e ogni stacco ha il suo nome"
```

---

## Task 4: la dorsale scende sulla cima dei compressori

**Obiettivo:** accorciare i montanti dei compressori fino alla misura del riferimento, e **capire
fin dove si può arrivare senza cambiare la regola**.

**Cosa dice il riferimento** (`no bypass.png`): la dorsale corre a **y=135**, la cima dei
compressori sta a **y=181**. Sono **46 px = ~79 unità**, contro le **150** di adesso (dorsale a
y=140, compressori a y=290). I montanti del disegno vero sono lunghi la metà dei nostri.

**Il fatto che va guardato in faccia.** `quotaCollettore` prende il **minimo** fra due vincoli:
`corpoSerbatoio.y − MARGINE_COLLETTORE` e `compressore.y − MARGINE_COLLETTORE_COMPRESSORI`. Sulla
pratica di prova valgono 140 e 230: **vince il serbatoio**, e abbassare
`MARGINE_COLLETTORE_COMPRESSORI` non sposta nulla. Nel riferimento invece la dorsale sta a y=135
mentre la cima della capsula sta molto più in alto: **il committente non fa passare la dorsale
sopra il serbatoio**, e infatti non serve — la dorsale gira in giù **prima** di arrivarci (nel
riferimento a x=175, con la capsula che comincia a x=204) e si aggancia a `sx-basso` scendendo di
fianco.

Questo task quindi fa **due cose distinte**, e la seconda è una domanda:

1. **portare `MARGINE_COLLETTORE_COMPRESSORI` a 80**, il valore misurato (79, arrotondato al passo
   di griglia). È una costante, e vale comunque: è il vincolo che governa il serbatoio ORIZZONTALE,
   dove la capsula sta più in basso della cima dei compressori;
2. **rendere le due varianti e chiedere al committente** se il vincolo del serbatoio debba
   continuare a valere quando la dorsale non gli passa mai sopra. Non si decide da soli: è la
   regola, non una distanza.

**Files:**
- Modify: `src/services/schemaImpianto/layout.ts:102` (`MARGINE_COLLETTORE_COMPRESSORI`)
- Test: `src/services/schemaImpianto/__tests__/layout.test.ts`
- Modify (probabile): le due fixture, **solo se il serbatoio orizzontale sente il cambio**

**Interfaces:**
- Consumes: niente.
- Produces: `MARGINE_COLLETTORE_COMPRESSORI: number = 80`.

- [ ] **Passo 1: scrivere il test che fallisce**

```ts
it('col serbatoio orizzontale la dorsale sta a `MARGINE_COLLETTORE_COMPRESSORI` sopra i compressori', () => {
  // E' il caso in cui il vincolo dei compressori vince: la capsula di un serbatoio ORIZZONTALE sta
  // piu' in basso della loro cima. Il montante deve ospitare la valvola (due passi sotto la
  // dorsale) e sotto di essa un tratto di flessibile che si veda: misurato ~79 unita' su
  // `no bypass.png` (46 px fra la dorsale a y=135 e la cima dei compressori a y=181).
  const SCARTO_VALVOLA = 20 // `buildSchemaModel.ts`, convenzione 1: non si esporta solo per un test
  const l = layoutSchema(
    buildSchemaModel({
      scheda: makeScheda({
        compressori: [makeCompressore({ codice: 'C1' })],
        disoleatori: [makeDisoleatore({ codice: 'C1.1', compressore_associato: 'C1' })],
        serbatoi: [makeSerbatoio({ orientamento: 'ORIZZONTALE' })],
      }),
      collegamentiCompressoriSerbatoi: { C1: ['S1'] },
    })
  )
  const compressore = l.nodi.find((n) => n.tipo === 'compressore')!
  expect(quotaCollettore(l)).toBe(compressore.y - MARGINE_COLLETTORE_COMPRESSORI)
  // E sotto la valvola resta un tratto di flessibile che si vede: sono le quattro ondulazioni
  // che si contano sul riferimento.
  expect(compressore.y - quotaCollettore(l) - SCARTO_VALVOLA).toBeGreaterThanOrEqual(50)
})
```

`makeScheda({ serbatoi: [makeSerbatoio({ orientamento: 'ORIZZONTALE' })] })` è la stessa forma già
usata alla riga ~173 del file: **usarla, non aggiungere un aiutante nuovo.**

- [ ] **Passo 2: lanciare il test e vederlo fallire per la ragione giusta**

Esegui: `npx vitest run src/services/schemaImpianto/__tests__/layout.test.ts -t 'orizzontale la dorsale'`
Atteso: **FAIL** con uno scarto di 20 sulla prima asserzione (60 invece di 80).

- [ ] **Passo 3: portare la costante a 80**

```ts
/**
 * Quanto la dorsale passa sopra la cima dei COMPRESSORI. Piu' del margine sul serbatoio: qui il
 * montante deve ospitare la valvola (due passi di griglia sotto la dorsale) e sotto di essa un
 * tratto di flessibile che si veda.
 *
 * **Ottanta unita', misurate su `no bypass.png`**: la dorsale sta a y=135 e la cima dei
 * compressori a y=181, 46 px che alla scala di quell'immagine (0,581 px/unita') fanno 79.
 * Restano cosi' 60 unita' di flessibile sotto la valvola, cioe' le quattro ondulazioni che si
 * contano sul riferimento.
 *
 * Conta solo quando i compressori sono piu' alti del corpo del serbatoio — cioe' col serbatoio
 * ORIZZONTALE; col verticale detta sempre il serbatoio, ed e' il motivo per cui sul disegno della
 * pratica di prova questo numero da solo non accorcia i montanti (vedi il Task 4 del Blocco 4).
 */
export const MARGINE_COLLETTORE_COMPRESSORI = 80
```

- [ ] **Passo 4: lanciare il test e vederlo passare**

Esegui: `npx vitest run src/services/schemaImpianto/__tests__/layout.test.ts -t 'orizzontale la dorsale'`
Atteso: **PASS**

- [ ] **Passo 5: le fixture**

```
git diff --stat src/services/schemaImpianto/__tests__/fixtures/
```
Le due fixture portano un serbatoio **orizzontale**: è esattamente il caso in cui questo vincolo
vince, quindi **è atteso che si muovano**. Rigenerarle con la procedura del loro header, leggere il
diff (devono muoversi le ordinate della dorsale e dei montanti, e nient'altro) e annotare:

```
 * Generato di nuovo al commit <hash> ("fix(schema): la dorsale scende sulla cima dei
 * compressori"), Task 4 del Blocco 4: `MARGINE_COLLETTORE_COMPRESSORI` passa da 60 a 80, il
 * valore misurato sul riferimento. Cambiano l'ordinata della dorsale e la lunghezza dei montanti;
 * non cambia nessuna ascissa.
```

Se **non** si muovono, fermarsi e capire perché: vorrebbe dire che il serbatoio orizzontale di
quelle fixture non fa vincere il vincolo dei compressori, e allora il test del Passo 1 sta guardando
un caso che le fixture non hanno.

- [ ] **Passo 6: la prova «rompi apposta»**

Rimettere 60, verificare con `git diff --stat` che sia entrata, rilanciare
`npx vitest run src/services/schemaImpianto` e annotare cosa cade: devono cadere il test nuovo e le
due fixture. Poi rimettere 80.

- [ ] **Passo 7: il gate**

```
npx vitest run
npx tsc --noEmit
npx eslint src/services/schemaImpianto
```

- [ ] **Passo 8: rendere le due varianti per la domanda al committente**

Con `MARGINE_COLLETTORE = 10` (come ora) e poi, **solo per generare l'immagine e senza
committare**, con il vincolo del serbatoio tolto da `quotaCollettore`:

```
npx tsx taratura.mts t4-come-ora
# togliere temporaneamente la riga dei serbatoi da `cime` in `quotaCollettore`
npx tsx taratura.mts t4-solo-compressori
git checkout src/services/schemaImpianto/layout.ts   # rimettere subito com'era
```

**Attenzione:** l'ultimo comando butta via anche la costante a 80. Fare la prova **dopo** il
commit del Passo 10, oppure ripristinare a mano la sola riga di `quotaCollettore`.

- [ ] **Passo 9: chiedere al committente**

Mostrargli `.taratura/t4-come-ora/no-bypass.png`, `.taratura/t4-solo-compressori/no-bypass.png` e
`DOCUMENTAZIONE/relazione/no bypass.png`, e la domanda in una riga:

> Nel tuo disegno la dorsale corre appena sopra i compressori e passa **sotto** la cima del
> serbatoio, girando in giù prima di arrivarci. Il codice invece la tiene sempre sopra il corpo del
> serbatoio, e i montanti nascono lunghi il doppio. Tolgo quel vincolo — la dorsale si regola sui
> soli compressori — o lo tengo?

**Non implementare la risposta in questo task.** Se dice di toglierlo, diventa un task suo (4b) con
il suo test e il suo commit, perché è un cambio di regola e non di distanza.

- [ ] **Passo 10: commit**

```bash
git add src/services/schemaImpianto/layout.ts \
        src/services/schemaImpianto/__tests__/layout.test.ts \
        src/services/schemaImpianto/__tests__/fixtures/
git commit -m "fix(schema): la dorsale scende sulla cima dei compressori"
```

---

## Task 5: il tratteggio delle condense si fasa

**Obiettivo:** le linee condense che corrono sulla stessa corsia orizzontale disegnano i trattini
**sulla stessa griglia**, invece di riempirsi i vuoti a vicenda e sembrare una linea continua.

**Il difetto, verificato in apertura.** Sei linee condense percorrono la stessa corsia con le fasi
disallineate: `stroke-dasharray` riparte da capo su ogni `<path>`, e ogni tratto cade nei vuoti del
vicino. Nel PNG della pratica di prova si vede a occhio nudo: sulla sinistra, dove corre una linea
sola, i trattini sono radi e chiari; da dove la seconda si sovrappone in poi il tratteggio diventa
fitto e quasi pieno.

**La strada, decisa dal committente il 18-08-2026 e non da ridiscutere:** si fasano i tratteggi con
`stroke-dashoffset`. Il collettore condense unico è **scartato**.

**La formula.** `rottaCondensa` (`tratti.ts:490`) produce sempre quattro punti:
`[partenza, giù alla corsia, orizzontale fino all'ascissa d'arrivo, su/giù all'arrivo]`. Il tratto
che si sovrappone ai vicini è il **secondo** (indice 1). Perché due tratti orizzontali che si
sovrappongono cadano sulla stessa griglia, la fase in un punto deve dipendere dalla sua **ascissa
assoluta**, non da quanto si è già percorso: in SVG la fase alla distanza `s` lungo il tracciato
vale `(s + dashoffset) mod P`, quindi con `L` = lunghezza percorsa fino all'inizio dell'orizzontale
e `x0` = ascissa di quel punto serve `dashoffset ≡ x0 − L (mod P)`.

Per un'orizzontale percorsa **verso sinistra** la fase cresce mentre `x` cala, e per far cadere i
trattini sugli stessi intervalli assoluti serve `dashoffset ≡ DASH − x0 − L (mod P)`, dove `DASH` è
la lunghezza del trattino. Il caso esiste — nulla obbliga il pozzo di raccolta a stare a destra di
tutto — e costa tre righe.

**Dove vive.** In `symbols/index.ts`, accanto a `TRATTEGGIO_CONDENSE`: è una proprietà del
tratteggio, non della geometria, e quel modulo è già importato **sia** da `renderSvg.ts` **sia** da
`SchemaEdgeTubazione.tsx`. La consegna avverte che la stessa formula serve alla tela dell'editor, o
documento e tela torneranno a disegnare tratteggi diversi — è la divergenza che `instrada`
condivisa è nata per chiudere.

**Files:**
- Modify: `src/services/schemaImpianto/symbols/index.ts` (accanto a `TRATTEGGIO_CONDENSE`, riga 40)
- Test: `src/services/schemaImpianto/__tests__/simboli.test.ts`
- Modify: `src/services/schemaImpianto/renderSvg.ts:134-141` (`trattoSvg`)
- Modify: `src/components/schemaImpianto/SchemaEdgeTubazione.tsx:517`

**Interfaces:**
- Consumes: `TRATTEGGIO_CONDENSE = '7 10'` (già esportata).
- Produces: `sfasamentoCondense(punti: Punto[]): number` — l'offset da dare a
  `stroke-dashoffset`; **0** se il tracciato non ha un tratto orizzontale.

- [ ] **Passo 1: scrivere i test che falliscono**

In `simboli.test.ts`:

```ts
describe('sfasamentoCondense — i tratteggi delle condense cadono sulla stessa griglia', () => {
  const PERIODO = 17   // '7 10': trattino 7 piu' vuoto 10

  // La fase in un punto del tratto orizzontale, come la calcola SVG: (percorso + offset) mod P.
  const fase = (punti: Punto[], x: number) => {
    const percorso = Math.abs(punti[1].y - punti[0].y) + Math.abs(x - punti[1].x)
    return (((percorso + sfasamentoCondense(punti)) % PERIODO) + PERIODO) % PERIODO
  }

  it('due linee che partono da quote diverse cadono sulla stessa fase alla stessa ascissa', () => {
    // E' il difetto vero: sei condense sulla stessa corsia, ognuna scesa da un'altezza diversa.
    // Senza fase, ogni <path> riparte da capo e i trattini dell'una riempiono i vuoti dell'altra.
    const a = [{ x: 100, y: 200 }, { x: 100, y: 500 }, { x: 900, y: 500 }, { x: 900, y: 540 }]
    const b = [{ x: 300, y: 173 }, { x: 300, y: 500 }, { x: 900, y: 500 }, { x: 900, y: 540 }]
    for (const x of [400, 555, 700, 899]) expect(fase(a, x)).toBeCloseTo(fase(b, x), 6)
  })

  it('la fase alla stessa ascissa non dipende da dove la linea comincia', () => {
    const a = [{ x: 100, y: 200 }, { x: 100, y: 500 }, { x: 900, y: 500 }, { x: 900, y: 540 }]
    const b = [{ x: 137, y: 200 }, { x: 137, y: 500 }, { x: 900, y: 500 }, { x: 900, y: 540 }]
    expect(fase(a, 800)).toBeCloseTo(fase(b, 800), 6)
  })

  it('un tracciato senza tratto orizzontale non chiede nessuna fase', () => {
    // Difesa: `dedup` puo' aver tolto i punti di mezzo, e un offset calcolato su un tratto che non
    // c'e' sarebbe un numero preso dal nulla.
    expect(sfasamentoCondense([{ x: 100, y: 200 }, { x: 100, y: 500 }])).toBe(0)
    expect(sfasamentoCondense([])).toBe(0)
  })

  it('anche un’orizzontale percorsa verso sinistra cade sulla stessa griglia di una verso destra', () => {
    // Il pozzo di raccolta non e' obbligato a stare a destra di tutto.
    const destra = [{ x: 100, y: 200 }, { x: 100, y: 500 }, { x: 900, y: 500 }, { x: 900, y: 540 }]
    const sinistra = [{ x: 900, y: 260 }, { x: 900, y: 500 }, { x: 100, y: 500 }, { x: 100, y: 540 }]
    const faseSinistra = (x: number) => {
      const percorso = 240 + (900 - x)
      return (((percorso + sfasamentoCondense(sinistra)) % PERIODO) + PERIODO) % PERIODO
    }
    // Il trattino copre [0,7) della fase. Verso sinistra la fase cresce mentre x cala: perche' i
    // trattini cadano sugli stessi intervalli assoluti, la fase deve valere DASH meno quella di
    // chi lo percorre verso destra.
    for (const x of [300, 500, 777]) {
      expect((faseSinistra(x) + fase(destra, x)) % PERIODO).toBeCloseTo(7 % PERIODO, 6)
    }
  })
})
```

- [ ] **Passo 2: lanciare i test e vederli fallire per la ragione giusta**

Esegui: `npx vitest run src/services/schemaImpianto/__tests__/simboli.test.ts -t 'sfasamentoCondense'`
Atteso: **FAIL** su `sfasamentoCondense is not a function` — poi, subito dopo il Passo 3, i test
devono passare **tutti**, e non solo quello dei tracciati degeneri.

- [ ] **Passo 3: scrivere `sfasamentoCondense`**

In `symbols/index.ts`, subito sotto `TRATTEGGIO_CONDENSE`:

```ts
/**
 * Fase da dare al tratteggio di una linea condense (`stroke-dashoffset`), perche' due linee che
 * percorrono la stessa corsia orizzontale disegnino i trattini sulla STESSA griglia.
 *
 * Il difetto che chiude: `stroke-dasharray` riparte da capo su ogni `<path>`, e le condense
 * scendono da quote diverse. Sulla corsia comune ogni linea arriva con una fase sua, i trattini
 * dell'una cadono nei vuoti dell'altra, e sei linee sovrapposte disegnano una riga continua —
 * osservato dal committente il 18-08-2026 e verificato sul PNG della pratica di prova, dove il
 * tratteggio e' rado finche' corre una linea sola e diventa pieno da dove la seconda si sovrappone.
 *
 * La formula. In SVG la fase alla distanza `s` lungo il tracciato vale `(s + dashoffset) mod P`.
 * Perche' la fase in un punto dipenda dalla sua ASCISSA e non da quanto si e' gia' percorso, con
 * `L` = lunghezza fino all'inizio dell'orizzontale e `x0` = ascissa di quel punto, serve
 * `dashoffset ≡ x0 − L (mod P)`. Percorrendo l'orizzontale verso sinistra la fase cresce mentre
 * `x` cala: per far cadere i trattini sugli stessi intervalli assoluti serve allora
 * `dashoffset ≡ DASH − x0 − L (mod P)`. Il caso esiste — nulla obbliga il pozzo di raccolta a
 * stare a destra di tutto.
 *
 * Sta qui e non in `renderSvg` perche' non la usa solo il documento: `SchemaEdgeTubazione` disegna
 * le stesse linee sulla tela dell'editor, e con due formule tela e documento tornerebbero a
 * mostrare tratteggi diversi — la divergenza che `instrada` condivisa e' nata per chiudere.
 *
 * Torna 0 per un tracciato che non ha un tratto orizzontale: `dedup` puo' averne tolto i punti di
 * mezzo, e un offset calcolato su un tratto che non c'e' sarebbe un numero preso dal nulla.
 */
export function sfasamentoCondense(punti: Punto[]): number {
  const [trattino, vuoto] = TRATTEGGIO_CONDENSE.split(' ').map(Number)
  const periodo = trattino + vuoto
  let percorso = 0
  for (let i = 0; i + 1 < punti.length; i++) {
    const a = punti[i]
    const b = punti[i + 1]
    if (a.y === b.y && a.x !== b.x) {
      const grezzo = b.x > a.x ? a.x - percorso : trattino - a.x - percorso
      return ((grezzo % periodo) + periodo) % periodo
    }
    percorso += Math.abs(b.x - a.x) + Math.abs(b.y - a.y)
  }
  return 0
}
```

Il `Punto` è già il tipo usato nel modulo; se `symbols/index.ts` non lo importa ancora, aggiungerlo
agli import da `../types` accanto agli altri.

- [ ] **Passo 4: lanciare i test e vederli passare**

Esegui: `npx vitest run src/services/schemaImpianto/__tests__/simboli.test.ts -t 'sfasamentoCondense'`
Atteso: **PASS**, tutti e quattro.

- [ ] **Passo 5: il documento usa la fase**

In `renderSvg.ts`, `trattoSvg`:

```ts
/** Il tracciato di un troncone, col tratto del suo tipo. */
function trattoSvg(punti: Punto[], stile: SchemaArcoStile): string {
  if (stile === 'flessibile') {
    return `<path d="${ondula(punti)}" fill="none" stroke="#000" stroke-width="${TRATTO}" />`
  }
  // La condensa porta anche una FASE: senza, le sei linee che corrono sulla corsia comune
  // riempirebbero i vuoti l'una dell'altra e sembrerebbero una riga continua (`sfasamentoCondense`).
  const tratteggio =
    stile === 'condensa'
      ? ` stroke-dasharray="${TRATTEGGIO_CONDENSE}" stroke-dashoffset="${sfasamentoCondense(punti)}"`
      : ''
  return `<path d="${percorso(punti)}" fill="none" stroke="#000" stroke-width="${TRATTO}"${tratteggio} />`
}
```

Aggiungere `sfasamentoCondense` all'import da `./symbols` in testa al file.

- [ ] **Passo 6: la tela usa la stessa fase**

In `SchemaEdgeTubazione.tsx`, riga ~517, accanto a `strokeDasharray`:

```tsx
          strokeDasharray: pezzo.stile === 'condensa' ? TRATTEGGIO_CONDENSE : undefined,
          // La stessa fase del documento (`sfasamentoCondense`): con due formule, tela e documento
          // tornerebbero a disegnare tratteggi diversi sulla stessa corsia.
          strokeDashoffset: pezzo.stile === 'condensa' ? sfasamentoCondense(pezzo.punti) : undefined,
```

**Verificare come si chiama il campo dei punti su `pezzo`** prima di scrivere `pezzo.punti`: se nel
file è un altro nome, usare quello. Aggiungere `sfasamentoCondense` all'import da
`@/services/schemaImpianto/symbols`.

- [ ] **Passo 7: la prova «rompi apposta»**

Far tornare `sfasamentoCondense` sempre `0`, verificare con `git diff --stat` che la mutazione sia
**entrata**, rilanciare `npx vitest run src/services/schemaImpianto` e annotare cosa cade: devono
cadere i tre test della fase (non quello dei tracciati degeneri, che con 0 resta verde — ed è
giusto). Poi ripristinare.

- [ ] **Passo 8: il gate**

```
npx vitest run
npx tsc --noEmit
npx eslint src/services/schemaImpianto src/components/schemaImpianto
git diff --stat src/services/schemaImpianto/__tests__/fixtures/
```
Atteso: verde; eslint **0** su `services/schemaImpianto` e **3** (preesistenti) su
`components/schemaImpianto`; **fixture intatte** — nessuna delle tre porta linee condense
(verificato: zero occorrenze di `condensa` nei tre file). Se una si muove, **fermarsi**.

- [ ] **Passo 9: guardare il disegno**

```
npx tsx taratura.mts t5
npx tsx crop.mts .taratura/t5/no-bypass.png 1000 790 1000 30 .taratura/t5-condense.png 3
```
Atteso: sul ritaglio i trattini restano **radi e regolari** anche da dove le linee si sovrappongono,
invece di infittirsi. Confrontare con lo stesso ritaglio di `.taratura/baseline/no-bypass.png`.

- [ ] **Passo 10: commit**

```bash
git add src/services/schemaImpianto/symbols/index.ts \
        src/services/schemaImpianto/renderSvg.ts \
        src/services/schemaImpianto/__tests__/simboli.test.ts \
        src/components/schemaImpianto/SchemaEdgeTubazione.tsx
git commit -m "fix(schema): i tratteggi delle condense cadono sulla stessa griglia"
```

---

## Task 6: le due domande di forma

**Obiettivo:** mettere davanti al committente le due scelte che **non sono distanze**, con le
immagini a fianco, e non deciderle da soli. Nessuna riga di prodotto cambia in questo task.

**La prima: dove cade il gradino dal serbatoio al primo TEE.** Oggi sta a mezza strada
(`gradinoVersoIlTee`, `segniAncorati.ts`, nato nel Blocco 3 per non far scendere il tubo rasente il
fianco del serbatoio); nel riferimento il committente fa correre l'orizzontale fin quasi al primo
stadio e scende lì. La seconda forma accorcia la linea di processo di un passo.

**La seconda, che la misura ha portato a galla ed è la più visibile.** Su `si bypass.png` il TEE di
monte **non sta sulla linea di processo**: sta in cima, sulla stessa orizzontale che esce dal
serbatoio (x=291, y=74), e dal TEE scende un montante **flessibile** fino alla punta sinistra del
primo stadio (x=293, y=125). Nel nostro disegno il TEE sta in basso sulla linea di processo, e il
montante sale dal TEE al ponte. Le due forme disegnano la stessa topologia con un tratto verticale
in meno o in più: nella nostra compare **sia** il gradino dal serbatoio **sia** il montante; nella
sua il montante **è** la discesa.

Da questa scelta dipende anche `PASSO_GIUNZIONE` (oggi 20): col TEE in alto la sua distanza
orizzontale dalla punta del primo stadio misura **~3 unità** sul riferimento, cioè praticamente
zero, perché il TEE sta sopra e non di fianco. Tararlo prima di sapere quale forma vince sarebbe
inseguire un numero che poi non serve.

**Files:** nessuno del prodotto. Solo `.taratura/`, che è fuori da git.

- [ ] **Passo 1: rendere le due varianti del gradino**

```
npx tsx taratura.mts t6-gradino-a-meta
```
è quella corrente. Per la seconda, **solo per generare l'immagine e senza committare**, portare in
`gradinoVersoIlTee` (`segniAncorati.ts`) la frazione da metà a quasi tutto (0,9), rendere, e
rimettere subito il file com'era:

```
npx tsx taratura.mts t6-gradino-tardivo
git checkout src/services/schemaImpianto/segniAncorati.ts
```

- [ ] **Passo 2: preparare i ritagli da guardare**

```
npx tsx crop.mts .taratura/t6-gradino-a-meta/no-bypass.png 600 300 700 400 .taratura/t6-a.png 2
npx tsx crop.mts .taratura/t6-gradino-tardivo/no-bypass.png 600 300 700 400 .taratura/t6-b.png 2
npx tsx crop.mts "DOCUMENTAZIONE/relazione/no bypass.png" 180 80 200 120 .taratura/t6-rif.png 6
npx tsx crop.mts .taratura/t2/si-bypass.png 750 200 700 350 .taratura/t6-tee-nostro.png 2
npx tsx crop.mts "DOCUMENTAZIONE/relazione/si bypass.png" 250 20 220 180 .taratura/t6-tee-rif.png 4
```

- [ ] **Passo 3: chiedere, con le immagini**

Le due domande, una riga ciascuna:

> **1.** Il tubo che esce dal serbatoio scende a metà strada verso il primo stadio; nel tuo disegno
> corre in orizzontale fin quasi allo stadio e scende lì. Quale tengo?
>
> **2.** Nel tuo `si bypass.png` la giunzione del by-pass sta **in alto**, sulla stessa orizzontale
> che esce dal serbatoio, e il montante flessibile **scende** dalla giunzione al primo stadio. Nel
> nostro sta in basso sulla linea di processo e il montante **sale** verso il ponte: viene un
> tratto verticale in più, perché il gradino dal serbatoio e il montante sono due cose diverse.
> Porto la giunzione in alto come nel tuo, o tengo la nostra?

- [ ] **Passo 4: se il committente sceglie di cambiare**

Diventano task loro — **6a** (il gradino) e **6b** (la quota del TEE) — ciascuno col suo test, la
sua prova «rompi apposta», il suo gate e il suo commit. Il 6b tocca `disponiCatenaPerAncore` e
`risolviPonti` e **rimette in gioco `PASSO_GIUNZIONE`**, che a quel punto va misurato di nuovo sul
riferimento (col TEE in alto, ~3 unità dalla punta del primo stadio). Non improvvisarli dentro
questo task.

- [ ] **Passo 5: se il committente tiene le nostre forme**

Allora `PASSO_GIUNZIONE` resta **20** e va **annotato nel suo commento** che la misura sul
riferimento non è confrontabile, perché lì il TEE sta sopra e non di fianco:

```
 * Misurato sul riferimento: su `si bypass.png` il TEE di monte sta a ~3 unita' dalla punta del
 * primo stadio, ma NON e' confrontabile — li' sta sopra, in cima al montante, non di fianco. Con
 * la giunzione sulla linea di processo il valore che conta e' quello che tiene il pallino fuori
 * dal corpo del rombo, e restano due passi di griglia (decisione del committente, 18-08-2026).
```
seguito dal gate e da un commit `docs(schema): perche' PASSO_GIUNZIONE resta a due passi`.

---

## Task 7: la verifica finale

**Obiettivo:** il gate su tutto il repo, la prova in pagina sulla pratica vera, e il merge simulato.
**Non si fonde e non si pubblica**: la decisione è del committente.

- [ ] **Passo 1: il gate su tutto**

```
npx vitest run
npx tsc --noEmit
npx eslint src/services/schemaImpianto src/components/schemaImpianto src/services/relazione src/components/relazione src/pages/TechnicalDetails.tsx src/utils/equipmentCodes.ts
```
Atteso: **tutti i test verdi** (1451 più quelli aggiunti), `tsc` pulito, e i warning eslint **non
uno più** del commit base (0 / 3 / 18).

- [ ] **Passo 2: le tre fixture**

```
git diff --stat df3739f -- src/services/schemaImpianto/__tests__/fixtures/
```
Atteso: `svgRiferimentoSenzaTesti.ts` e `svgRiferimentoConMuro.ts` cambiate, **ciascuna con il
paragrafo del perché in testa**; `svgRiferimentoConTee.ts` **invariata**.

- [ ] **Passo 3: il confronto finale senza browser**

```
npx tsx taratura.mts finale
```
Mettere `.taratura/finale/no-bypass.png` a fianco di `DOCUMENTAZIONE/relazione/no bypass.png`, e
`.taratura/finale/si-bypass.png` a fianco di `si bypass.png`. Guardare, nell'ordine:

1. i rombi si toccano coi codoli, non sono fusi;
2. i due compressori si sfiorano e il serbatoio è vicino;
3. i montanti dei compressori sono corti come nel riferimento (o resta la differenza spiegata nel
   Task 4, se il committente ha tenuto il vincolo del serbatoio);
4. il ponte corre alla quota dell'uscita del serbatoio, coi montanti che mostrano tre o quattro
   ondulazioni sotto le valvole;
5. il tratteggio delle condense resta rado dove le linee si sovrappongono.

**Annotare ciò che resta diverso**, senza correggerlo di nascosto.

- [ ] **Passo 4: la prova in pagina**

Dev server su una porta libera — **la 5173 è di un altro progetto**; nel Blocco 3 si è usata la
**5199**. Pratica **`002 test`** (`fed244ee-26e6-4d32-8c01-45abd393879d`), rotta
`/requests/<id>/technical-details`, poi il chip **SC**.

Trappole da tenere presenti:
- **allargare il browser a 1920×1080** prima di interagire, o i controlli del pannello restano fuori
  schermo e i click vanno in timeout;
- **`SchemaImpiantoDialog` monta col `keepMounted`**: i suoi pulsanti sono nel DOM anche a finestra
  chiusa. Filtrare per `getBoundingClientRect().height > 0`, o usare i `ref` dello snapshot di
  Playwright;
- **`browser_drag` non è affidabile** su react-flow; su dnd-kit funziona il trascinamento da
  tastiera (focus sulla maniglia, `Space`, frecce, `Space`);
- se il server MCP di Playwright va in timeout, il confronto del Passo 3 basta per il visivo, ma
  l'interattiva **no** e va rifatta.

Cosa verificare:
1. **Rigenera da capo** applica le distanze nuove, e il disegno in pagina è quello del Passo 3.
2. **Un cambio di preferenze non ridisegna da sé.** Il blob dell'anteprima resta **identico**. La
   guardia `generazioneTentata` è un `useRef` mai riazzerato; **questo blocco non tocca quel
   percorso**, ma la consegna chiede di riprovarlo se lo si sfiora — e il Task 5 tocca la resa.
3. **Chiudere e riaprire**: il disegno riconciliato è ancora quello, e le preferenze sono a posto
   in `additional_info` (Zod non le ha cancellate).
4. **La tela e il documento mostrano lo stesso tratteggio** sulle condense — è la ragione per cui
   `sfasamentoCondense` sta nei simboli e non in `renderSvg`.

- [ ] **Passo 5: ripristinare lo stato della pratica**

Preferenze come le si è trovate (nessun gruppo by-pass, spunta di F2, ordine stadi invariato),
catena dritta senza TEE, nessun residuo. Rigenerare a fine giro.

- [ ] **Passo 6: spegnere il dev server**

**Fermare il task non basta**: il processo `vite` resta e va chiuso per PID. Verificare che la
porta sia davvero libera.

- [ ] **Passo 7: cancellare gli attrezzi di misura**

```bash
rm -f taratura.mts misura.mts riga.mts griglia.mts crop.mts
rm -rf .taratura
```
e togliere le due righe aggiunte a `.git/info/exclude`
(`git rev-parse --git-path info/exclude` per trovarlo: in un worktree `.git` è un file, non una
cartella).

- [ ] **Passo 8: il merge simulato — `git fetch` PRIMA**

```bash
git fetch origin
git merge-tree --write-tree origin/main HEAD
git log --oneline origin/main -1
```
**Mai simulare contro il `main` locale**: è la trappola già pagata una volta su questo repo, che
aveva fatto negare un conflitto reale. Leggere l'esito e riferirlo.

- [ ] **Passo 9: scrivere «cosa è andato diversamente»**

In coda a questo piano: cosa è andato come previsto, cosa no, cosa ha trovato la prova «rompi
apposta», e l'esito della prova in pagina.

- [ ] **Passo 10: commit finale**

```bash
git add docs/superpowers/plans/2026-08-18-schema-impianto-prima-versione-blocco4.md
git commit -m "docs(schema): l'esito del Blocco 4 e la taratura misurata sui riferimenti"
```

- [ ] **Passo 11: fermarsi e chiedere**

**Non fondere e non pubblicare.** Riferire al committente: l'esito del gate, l'esito del merge
simulato, cosa resta diverso dai riferimenti, e le risposte che servono alle domande dei Task 4 e 6.
Il merge e il push si fanno **solo** dopo il suo via libera.

---

## Cosa NON si fa in questo blocco

- **Toccare `PASSO_ORIZZONTALE`.** È condiviso con `calcolaMuro` e con la corsia di raccolta:
  muoverlo sposta cose che i riferimenti non smentiscono. Gli stacchi delle famiglie hanno costanti
  proprie (Task 3).
- **Il collettore condense unico.** Scartato dal committente il 18-08-2026: oggi ogni
  apparecchiatura ha il suo arco fino al pozzo, e cambiarlo cambierebbe il modello.
- **Riaprire `GIOCO_FRA_STADI`.** Deciso a 20, e la misura sul riferimento lo conferma (passo 120).
- **Decidere da soli le due forme del Task 6**, né tarare `PASSO_GIUNZIONE` prima di sapere quale
  vince.
- **Alzare `VERSIONE` in `persistenza.ts`.** Nessuna costante di layout cambia il formato salvato:
  le distanze finiscono nelle coordinate, che sono già lì.
- **Rigenerare una fixture per far tornare verde un test.** Si rigenerano solo quando il
  cambiamento del disegno è voluto, leggendo il diff e annotando il perché.
- **Fondere o pubblicare.** Il merge simulato dice cosa succederebbe; la decisione è del committente.

---

## Cosa è andato diversamente

*(da scrivere durante l'esecuzione — Task 7, Passo 9)*
