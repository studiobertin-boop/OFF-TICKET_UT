# Schema d'impianto DM329 — Blocco 3: il by-pass

> **Per chi esegue:** SOTTO-SKILL RICHIESTA: `superpowers:executing-plans`, task per task, col gate
> a ogni passo. I passi usano caselle (`- [ ]`).

**Obiettivo:** la prima versione generata riproduce `DOCUMENTAZIONE/relazione/si bypass.png` —
due giunzioni sulla linea di processo, un ponte che sale, corre e ridiscende con tre valvole
ancorate, la linea di processo abbassata di una corsia perché il ponte le passi sotto l'uscita del
serbatoio, e una riconciliazione che non spezza la catena quando l'operatore scioglie il gruppo.

**Architettura:** invariata rispetto al Blocco 2. Il modello dichiara l'*intento* (quali giunzioni,
quale arco è un ponte, dove stanno le valvole rispetto ai vertici), il layout lo traduce in
geometria. Le istruzioni `ancoraggio` (sul segno) e `forma: 'ponte'` (sull'arco) viaggiano da
`buildSchemaModel` a `layoutSchema` e **non tornano indietro**: il layout le consuma, scrive `t` e
`punti`, e le toglie. Il formato salvato non cambia, tranne il campo nuovo e **opzionale**
`preferenzeApplicate` su `LayoutSalvato` (nessun bump di `VERSIONE`).

**Stack:** TypeScript (strict=false), Vitest, nessuna libreria nuova.

**Specifica:** `docs/superpowers/specs/2026-08-17-schema-impianto-prima-versione-design.md`
**Consegna:** `docs/superpowers/2026-08-18-prossima-sessione-blocco3-bypass.md`
**Piano precedente:** `docs/superpowers/plans/2026-08-18-schema-impianto-prima-versione-blocco2.md`,
col paragrafo «cosa è andato diversamente» in coda.

**Riferimenti visivi, in git:** `DOCUMENTAZIONE/relazione/si bypass.png` (il metro di QUESTO blocco)
e il compagno senza by-pass. **Attenzione al nome del secondo:** i documenti precedenti lo citano
come `no byass.png` — refuso del committente, che nel checkout principale è ancora il nome vero del
file — ma **su questo ramo è committato come `no bypass.png`**, col nome corretto. I due file hanno
lo stesso contenuto (md5 `13d7c9b4…`). Qui si scrive il nome che esiste nel worktree; **non
rinominare nulla** senza chiedere al committente, o si rompono i link nell'una o nell'altra copia.

**Ramo:** `worktree-schema-prima-versione-blocco1`, worktree
`.claude/worktrees/schema-prima-versione-blocco1`. Il Blocco 3 continua su questo ramo. **Il merge
simulato con `git merge-tree` contro un `origin/main` appena `fetch`ato si fa alla FINE di questo
blocco**, nel Task 6, non prima.

## Vincoli globali

- **`.env.local` va copiato a mano nel worktree** (è git-ignored) o un file di test fallisce per
  variabili mancanti. Già fatto in apertura di sessione. Contiene anche `APP_LOGIN_EMAIL` /
  `APP_LOGIN_PASSWORD` (ruolo admin) per la prova in pagina: **non chiederle al committente**.
- **Baseline misurata all'apertura del Blocco 3**, commit `70dce00`: **1394 test verdi, 100 file**,
  `npx tsc --noEmit` pulito.
- **Nessun test di interfaccia** (`CLAUDE.md`): la logica provabile va in servizi e funzioni pure.
  Ogni volta che un task tocca un componente, la decisione vera sta in una funzione pura provata,
  e nel componente resta il solo cablaggio.
- **Nessuna fixture SVG deve cambiare in questo blocco.** Le tre descrivono impianti senza stadi e
  senza by-pass. Se una cambia, **ci si ferma e si guarda il diff** prima di qualsiasi altra cosa:
  vuol dire aver mosso qualcosa che questo blocco non deve muovere. *(La regola non è cerimoniale:
  nel Blocco 2 ha imposto di guardare, e guardando si è scoperto che una premessa della consegna
  era falsa.)*
- **Niente `prettier --write`.**

### Il gate, a ogni task

```
npx vitest run
npx tsc --noEmit
npx eslint <percorsi toccati>
```

**Il conto dei warning eslint non è zero ovunque: è «non uno più di prima».** Misurato sul commit
base: `src/services/schemaImpianto` 0, `src/components/schemaImpianto` 3 (preesistenti),
`services/relazione` + `components/relazione` + `pages/TechnicalDetails.tsx` +
`utils/equipmentCodes.ts` 18. Un `--max-warnings 0` su quei percorsi fallisce anche senza toccarli.

### La prova «rompi apposta», a ogni task

**I test verdi per la ragione sbagliata sono la classe di difetto numero uno di questo modulo.** Un
test che fallisce solo perché il modulo non esiste ancora **non** l'hai visto fallire per la ragione
giusta. A ogni task, prima di chiuderlo: rompi apposta la logica appena scritta (inverti una
condizione, azzera una costante, togli una guardia) e **guarda quali test cadono**. Se ne cade uno
solo dove te ne aspettavi tre, i test hanno un buco. Nel Blocco 2 questo ha trovato tre buchi veri.

## I file toccati

| file | task | cosa |
|---|---|---|
| `services/schemaImpianto/bypass.ts` | T1 | **nuovo** — linearizzazione, id dei TEE, corsie |
| `services/schemaImpianto/types.ts` | T2 | `forma?: 'ponte'` su `SchemaArco` |
| `services/schemaImpianto/buildSchemaModel.ts` | T2 | TEE nella catena, arco ponte, tre valvole |
| `services/schemaImpianto/layout.ts` | T2, T3 | `catenaDagliArchi` salta il ponte; `PASSO_GIUNZIONE`, corsia, gomiti |
| `services/schemaImpianto/persistenza.ts` | T4, T5 | `archiNuovi` dal layout automatico, invariante, `preferenzeApplicate` |
| `services/schemaImpianto/preferenze.ts` | T5 | `preferenzeDaRiapplicare` |
| `components/relazione/SchemaImpiantoSection.tsx` | T5 | l'impronta al momento della generazione, l'avviso |
| `pages/TechnicalDetails.tsx` | T5 | l'impronta fino a `layoutDaPersistere` |

Più i file di test accanto a ciascuno.

---

## Task 1: `bypass.ts` — la sequenza con le giunzioni

**Obiettivo:** una funzione pura che, data la catena degli stadi e i gruppi risolti, dice **dove
vanno le giunzioni** e **quali archi ponte servono**. Nessuna geometria: solo sequenza e identità.

Sta in un modulo suo e non dentro `buildArchi` perché è una trasformazione di sequenza con
invarianti proprie — contiguità, id stabili, un TEE per confine — che merita test suoi (decisione
della specifica, non da ridiscutere).

### I test, prima (`__tests__/bypass.test.ts`)

- [ ] **`gli id dei TEE nascono dall'id del gruppo, non dagli stadi scavalcati`** — `bp1` →
      `BP1-IN` / `BP1-OUT`. Ricavarli dagli stadi sarebbe instabile: riordinare le righe cambierebbe
      l'id e il layout salvato perderebbe il TEE.
- [ ] **`il prefisso BP non collide con niente di ciò che esiste`** — nessun codice di scheda
      (`S`, `C`, `E`, `F`, `SEP`), nessun id riservato (`UTENZE`, `T`, `RC`), nessun prefisso
      manuale (`M-`) può produrre un id che comincia per `BP` seguito da cifre. **Il test è la
      sentinella**: il giorno che nasce un prefisso `B` in scheda, cade qui.
- [ ] **`un gruppo mette due giunzioni, una prima del primo scavalcato e una dopo l'ultimo`** —
      catena `[F1, E1, F2, F3]`, gruppo su `[E1, F2]` → sequenza `[F1, BP1-IN, E1, F2, BP1-OUT, F3]`.
- [ ] **`un gruppo che scavalca l'intera catena mette i TEE ai due capi`** — è il caso di
      `si bypass.png`: gruppo su `[F1, E1, F2, F3]` → `[BP1-IN, F1, E1, F2, F3, BP1-OUT]`.
- [ ] **`due gruppi disgiunti mettono quattro giunzioni, nell'ordine della catena`**.
- [ ] **`un gruppo con membri non contigui non produce nulla`** — difesa ridondante rispetto a
      `risolviPreferenze`, che già lo scarta: qui si fissa che il modulo non si fida del chiamante.
      Un gruppo spezzato non è disegnabile con due soli TEE, e indovinare è peggio che dirlo.
- [ ] **`un gruppo vuoto, o su stadi che la catena non contiene, non produce nulla`**.
- [ ] **`le corsie: due gruppi che non si sovrappongono stanno sulla stessa corsia`** — nel caso
      normale i gruppi sono disgiunti, e impilare i ponti a quote diverse sarebbe uno scalino nel
      disegno che nulla giustifica.
- [ ] **`le corsie: due gruppi che si sovrappongono stanno su corsie diverse`** — caso patologico
      (uno stadio in due gruppi), che `risolviPreferenze` oggi non vieta. Non si scarta e non si
      indovina: si impila, e il disegno resta leggibile.

### L'implementazione

- [ ] Nuovo `src/services/schemaImpianto/bypass.ts`. Interfaccia proposta:

```ts
/** Il ponte di un gruppo: i due capi e la corsia su cui corre. */
export interface PonteBypass {
  gruppo: string          // 'bp1'
  inizio: string          // 'BP1-IN'
  fine: string            // 'BP1-OUT'
  corsia: number          // 0 = la più bassa; sale solo se due ponti si sovrappongono
}

export function idTeeBypass(gruppo: string): { inizio: string; fine: string }

/**
 * La catena con le giunzioni al posto giusto, più i ponti da tracciare.
 * `catena` sono gli stadi nell'ordine deciso (senza giunzioni); `gruppi` i by-pass risolti.
 */
export function linearizzaConBypass(
  catena: SchemaNodo[],
  gruppi: { id: string; stadi: string[] }[]
): { sequenza: (SchemaNodo | { giunzione: string })[]; ponti: PonteBypass[] }

/** Il nodo giunzione di un TEE di by-pass. Origine 'scheda': vedi sotto. */
export function nodoGiunzioneBypass(id: string): SchemaNodo
```

- [ ] **Origine dei TEE: `'scheda'`**, come il terminale `UTENZE`. Vengono da una decisione
      registrata e ricostruibile. `'manuale'` li renderebbe indistruttibili, e sciogliere un gruppo
      lascerebbe due TEE orfani su ogni disegno riaperto.
- [ ] La corsia si assegna per **sovrapposizione degli intervalli**, non per indice del gruppo:
      due ponti disgiunti condividono la corsia 0.

### Gate e prova

- [ ] `npx vitest run` — verde, conto ≥ 1403.
- [ ] `npx tsc --noEmit`, `npx eslint src/services/schemaImpianto`.
- [ ] **Rompi apposta:** togli il controllo di contiguità; inverti il confronto delle corsie; usa
      `bp${n}` invece di `BP${n}-IN`. Guarda quali test cadono e se sono quelli giusti.
- [ ] Commit: `feat(schema): dove vanno le giunzioni di un by-pass, e su che corsia corre il ponte`

---

## Task 2: il modello — i TEE nella catena e l'arco ponte

**Obiettivo:** `buildSchemaModel` emette le giunzioni, gli archi della linea che ci passano
attraverso, e l'arco ponte con le tre valvole ancorate.

### La trappola da conoscere prima di scrivere

`catenaDagliArchi` (`layout.ts`) legge la sequenza seguendo il **primo** arco uscente da ogni nodo.
Da `BP1-IN` escono **due** archi: quello della linea (`BP1-IN → F1`) e il ponte
(`BP1-IN → BP1-OUT`). Se vince il ponte, la catena salta tutti gli stadi scavalcati, che finiscono
fra gli «orfani» appesi in coda nell'ordine di default — un disegno con le linee incrociate,
esattamente il difetto che `catenaDagliArchi` è nata per chiudere.

**Due difese, non una:** l'ordine di emissione (la linea prima del ponte) *e* `catenaDagliArchi`
che **salta gli archi con `forma: 'ponte'`**. La prima da sola è fragile — dipende dall'ordine in
cui qualcuno un giorno riordinerà `buildArchi`.

**E il test va scritto in modo che morda:** costruisce il modello e **mette il ponte per primo**
nell'elenco degli archi, poi chiede la catena. Con la sola difesa dell'ordine di emissione il test
sarebbe verde per la ragione sbagliata.

### I test, prima

In `__tests__/buildSchemaModel.test.ts`:

- [ ] **`un by-pass mette due giunzioni nel modello, di origine scheda`**.
- [ ] **`la linea di processo passa DENTRO le giunzioni`** — con gruppo su tutta la catena, gli
      archi sono `S1→BP1-IN`, `BP1-IN→F1`, …, `F3→BP1-OUT`, `BP1-OUT→UTENZE`. Nessun arco salta
      da `S1` a `F1`.
- [ ] **`il ponte è un arco solo, flessibile, coi due TEE per capi`** — `stile: 'flessibile'`,
      `forma: 'ponte'`, `da` su `BP1-IN` ancora `alto`, `a` su `BP1-OUT` ancora `alto`.
- [ ] **`il ponte porta tre valvole ancorate, e i loro stili a valle`** — vertice 1 scarto −20 con
      `stileAValle: 'standard'`; metà del tratto 1 senza `stileAValle`; vertice 2 scarto +20 con
      `stileAValle: 'flessibile'`. **I ±20 e non ±10:** la specifica diceva un passo di griglia, il
      committente ha portato a due le valvole della mandata il 18-08-2026 e **le due misure devono
      restare uguali**, o due valvole affiancate nel disegno starebbero a quote diverse.
- [ ] **`senza by-pass il modello è identico a quello del Blocco 2`** — nessuna giunzione, nessun
      arco `forma: 'ponte'`. È la non-regressione dell'intero blocco precedente.
- [ ] **`la valvola di riserva all'uscita del serbatoio sparisce se il primo stadio è scavalcato`**
      e **`… prima delle utenze se l'ultimo lo è`** — esistono già, ma vanno rifatte mordere: oggi
      guardano `catenaLinea[0]`, che col by-pass è una **giunzione**, non uno stadio.
- [ ] **`le due valvole restano quando il by-pass sta in mezzo alla catena`**.

In `__tests__/layout.test.ts`:

- [ ] **`la catena segue la linea e non il ponte, anche se il ponte viene prima negli archi`** — il
      test che morde davvero, vedi sopra.

### L'implementazione

- [ ] `types.ts`: campo `forma?: 'ponte'` su `SchemaArco`, documentato come **istruzione di sola
      andata** sullo stampo di `SchemaAncoraggioSegno` — entra nel layout e non ne esce.
- [ ] `buildArchi`: la catena diventa `linearizzaConBypass(catenaLinea, preferenze.bypass)`, e gli
      archi della linea si emettono sulla **sequenza** (stadi e giunzioni insieme). L'ancora dei
      capi su una giunzione è `dx` in uscita e `sx` in entrata.
- [ ] Le valvole di riserva: la condizione non è più «il primo/ultimo stadio è scavalcato» letta su
      `catenaLinea`, ma **«il primo/ultimo elemento della sequenza è una giunzione»**. È la stessa
      regola detta dove ora è vera.
- [ ] Il ponte si emette **dopo** tutti gli archi della linea, con un commento che dice perché.
- [ ] `buildSchemaModel`: i nodi giunzione entrano come fa già `nodoUtenze` — **dopo** `buildArchi`,
      guardando gli archi appena costruiti, unica fonte. Un nodo senza tubazione e un arco verso un
      nodo assente sarebbero entrambi incoerenti.
- [ ] `catenaDagliArchi`: salta gli archi con `forma: 'ponte'` insieme a quelli `condensa`, con un
      commento che spiega il perché (due uscite dalla stessa giunzione).

### Gate e prova

- [ ] `npx vitest run`, `npx tsc --noEmit`, `npx eslint src/services/schemaImpianto`.
- [ ] **Le tre fixture SVG devono essere intatte.** Se una cambia, fermarsi e guardare il diff.
- [ ] **Rompi apposta:** togli il salto del ponte in `catenaDagliArchi`; emetti il ponte prima
      degli archi di linea; porta gli scarti da 20 a 10; lascia le valvole di riserva sempre.
- [ ] Commit: `feat(schema): il modello mette le giunzioni sulla linea e traccia il ponte`

---

## Task 3: il layout — la corsia, il passo delle giunzioni, i gomiti del ponte

**Obiettivo:** i TEE trovano posto sulla linea di processo, la linea scende di una corsia quando
c'è almeno un by-pass, e il ponte prende i suoi gomiti.

### Perché i gomiti sono obbligatori, non un'ottimizzazione

Entrambi i capi del ponte stanno su una giunzione, che **impone il lato** (`latoImposto`,
`symbols/index.ts`). Senza gomiti `instrada` cade su `rottaImboccata`, che con due capi sullo stesso
asse piega a `yMedia` (`tratti.ts`) — che coi due TEE alla stessa quota **è la loro stessa quota** —
e `dedup` collassa tutto in una retta orizzontale **sovrapposta alla linea di processo**. Il
by-pass sparirebbe alla vista pur esistendo nel modello.

Coi gomiti, `polilineaConGomiti` produce esattamente quattro vertici — capo, gomito sinistro, gomito
destro, capo — cioè tre tratti. **È su questo che contano i tre ancoraggi del Task 2**: vertice 1 =
gomito sinistro, tratto 1 = la corsa orizzontale, vertice 2 = gomito destro. Cambiare il numero di
gomiti sposta le tre valvole senza che nessun test di `bypass.ts` se ne accorga: il test che lega le
due cose sta qui.

### I test, prima (`__tests__/layout.test.ts`)

- [ ] **`una giunzione della catena si dispone sulla linea di processo`** — la sua ancora cade
      esattamente sulla quota della linea, come quella degli stadi.
- [ ] **`fra una giunzione e lo stadio vicino c'è PASSO_GIUNZIONE, di qua e di là`** — asserzione
      sulla **costante**, non sul valore: il numero si chiude nel Blocco 4. Simmetrica di
      proposito: il TEE non deve stare appiccicato a uno dei due.
- [ ] **`senza giunzioni le distanze della catena non cambiano`** — non-regressione della
      convenzione 3: l'ancora `dx` di uno stadio coincide con la `sx` del successivo.
- [ ] **`con almeno un by-pass la linea di processo scende di una corsia`** — e **`il ponte corre
      SOTTO l'uscita del serbatoio`**, che è la ragione per cui scende: due asserzioni, perché la
      prima da sola passerebbe anche con un ponte che si accavalla al serbatoio.
- [ ] **`senza by-pass la linea resta alla quota dell'uscita del serbatoio`** — non-regressione
      della convenzione 4.
- [ ] **`il ponte esce dal layout con quattro vertici: capo, gomito, gomito, capo`** — il test che
      lega la forma agli ancoraggi.
- [ ] **`le tre valvole del ponte finiscono dove le convenzioni le vogliono`** — due passi sotto
      l'orizzontale sui due montanti, a metà della corsa in mezzo. Si misura sui **punti**
      ricalcolati, non sulle `t`: una `t` giusta su una polilinea sbagliata non è una valvola al
      posto giusto.
- [ ] **`nessun arco in uscita da layoutSchema porta ancora forma`** — il contratto di sola andata,
      sullo stampo di quello già scritto per `ancoraggio`.
- [ ] **`due by-pass disgiunti corrono sulla stessa corsia`**, **`due sovrapposti no`**.

### L'implementazione

- [ ] `layout.ts`: costanti nuove, esposte per la taratura del Blocco 4 e documentate come tali:
      - **`PASSO_GIUNZIONE`** — distanza fra l'ancora di una giunzione e l'ancora dello stadio
        vicino. Default proposto **20** (due passi di griglia): nel riferimento il TEE sinistro sta
        ~12 unità dalla punta di F1 e il destro ~25 da quella di F3.
      - **`PASSO_CORSIA_BYPASS`** — di quanto scende la linea di processo, e di quanto si separano
        due corsie di ponte. Default proposto **80**: nel riferimento lo scarto misurato fra uscita
        del serbatoio e linea di processo è ~75 unità.
      - **`ALTEZZA_BYPASS`** — quanto il ponte sta sopra la linea di processo. Default proposto
        **60**, cioè 20 unità **sotto** l'uscita del serbatoio, che è ciò che la specifica chiede.
        *Nel disegno corretto a mano il committente li ha messi alla stessa quota
        (`ALTEZZA_BYPASS == PASSO_CORSIA_BYPASS`): è una delle prime cose da guardare nel Blocco 4.*
- [ ] `disponiCatenaPerAncore`: l'accumulatore diventa **l'ascissa della prossima ancora `sx`**,
      non il bordo sinistro del prossimo riquadro. Con `sx.x = 0` su tutti i simboli della catena
      (rombi e separatore, verificato) le due formule coincidono **finché non c'è una giunzione**,
      che ha `sx.x = dx.x = 10` — è lei a rendere necessaria la riscrittura. Il gioco fra due
      elementi è `PASSO_GIUNZIONE` se uno dei due è una giunzione, `GIOCO_FRA_STADI` altrimenti.
- [ ] `quotaLineaProcesso`: scende di `PASSO_CORSIA_BYPASS` quando la catena contiene almeno una
      giunzione. Si guarda la **catena**, non le preferenze: il layout non le riceve, e la
      giunzione nella catena è il fatto che conta.
- [ ] Nuova funzione in `bypass.ts`, `risolviPonti(layout, libreria)`: per ogni arco con
      `forma: 'ponte'` scrive `punti` (i due gomiti, alla quota
      `quotaLinea − ALTEZZA_BYPASS − corsia × PASSO_CORSIA_BYPASS`) e **toglie la chiave `forma`**,
      con copia più `delete` come fa già `risolviSegniAncorati` — non destrutturazione con scarto,
      che lascia un warning eslint su un percorso che deve stare a zero e perde i campi che qualcuno
      aggiungerà all'arco.
- [ ] `layoutSchema`: `risolviPonti` **prima** di `risolviSegniAncorati`, che legge `arco.punti`.
      Ordine non negoziabile, con un commento che lo dice.

### Gate e prova

- [ ] `npx vitest run`, `npx tsc --noEmit`, `npx eslint src/services/schemaImpianto`.
- [ ] **Le tre fixture SVG intatte.** `disponiCatenaPerAncore` è riscritta: è il punto del blocco
      dove è più probabile che si muovano. Se si muovono, il diff dice se è la riscrittura o altro.
- [ ] **Rompi apposta:** azzera `PASSO_GIUNZIONE`; azzera `PASSO_CORSIA_BYPASS`; emetti un gomito
      solo invece di due; lascia `forma` sull'arco in uscita; inverti l'ordine fra `risolviPonti` e
      `risolviSegniAncorati` (questo deve far cadere i test delle tre valvole, e se non li fa
      cadere quei test non stanno misurando la polilinea vera).
- [ ] Commit: `feat(schema): il ponte prende i suoi gomiti, e la linea scende per passargli sotto`

---

## Task 4: `riconcilia` — gli archi giusti, e la catena che non si spezza

**Obiettivo:** riaprire una pratica con un by-pass, e scioglierne uno, non producono un disegno
rotto.

### I tre difetti da chiudere

1. **`archiNuovi` prende gli archi dal MODELLO** (`persistenza.ts`, righe ~356-364 e ~401). Dal
   modello arrivano con la `t` di ripiego (0,5: la valvola a metà tubo) e **senza i gomiti del
   ponte** — cioè un by-pass collassato sulla linea di processo. Devono venire dal **layout
   automatico**, che `riconcilia` calcola già (`const automatico = layoutSchema(modello, libreria)`)
   e ha gli stessi id e la stessa identità.
2. **Sciogliere un by-pass spezza la catena.** I due TEE cadono e con loro i cinque archi che li
   toccavano, ma l'arco sostitutivo `S1 → F1` non viene ripescato: `archiNuovi` lo prende solo se un
   capo è fra i nodi **aggiunti**, e nessuno dei due lo è. Serve un'invariante sullo stampo di
   quella già scritta per il terminale: **ogni nodo che il modello raggiunge con un arco d'aria
   entrante deve averne ancora uno dopo la riconciliazione; se non ce l'ha, si riprende quello del
   layout automatico.** Non «riprendi sempre quelli del modello»: il tracciato a mano resta
   autorevole. *Conseguenza accettata e da scrivere nel commento: un operatore che stacca
   deliberatamente uno stadio nell'editor se lo ritrova ricollegato alla riapertura. Fra un disegno
   con uno stadio scollegato e uno ricollegato d'ufficio, la specifica sceglie il secondo.*
3. **I TEE finiscono negli avvisi all'operatore.** `aggiuntiDaScheda` e `rimossi` alimentano l'Alert
   «Aggiunte dalla scheda: …» / «Rimosse perché non più in scheda: …». Sciogliendo un gruppo
   l'operatore leggerebbe *«Rimosse perché non più in scheda: BP1-IN, BP1-OUT»* — falso su entrambi
   i fronti, come lo sarebbe stato «Aggiunte dalla scheda: UTENZE», che infatti è già escluso. **Una
   giunzione non è un'apparecchiatura**, e va fuori da entrambi gli elenchi annunciati (non da
   `aggiunti`, che è l'elenco vero a uso interno).

### I test, prima (`__tests__/persistenza.test.ts`)

- [ ] **`gli archi nuovi arrivano risolti, non col ripiego`** — riconciliando un salvato a cui manca
      uno stadio, l'arco che lo raggiunge porta le `t` calcolate e non 0,5. **Il test che morde:
      confronta con l'arco del layout automatico**, non con «≠ 0,5» — una `t` diversa per caso
      passerebbe lo stesso.
- [ ] **`il ponte entra nel salvataggio coi suoi gomiti`** — l'arco `forma: 'ponte'` riconciliato ha
      `punti` non vuoto. È il caso che il difetto 1 rompe in modo invisibile: il disegno esiste, ma
      il by-pass è una retta sovrapposta alla linea.
- [ ] **`sciogliere un by-pass ricollega la catena`** — salvato con `S1→BP1-IN→F1…`, modello senza
      gruppo: dopo la riconciliazione `F1` ha un arco d'aria entrante, ed è quello del layout
      automatico (`S1→F1`).
- [ ] **`l'invariante non calpesta un tracciato fatto a mano`** — se `F1` ha già un arco entrante,
      anche con capi diversi da quelli del modello, non se ne aggiunge un secondo.
- [ ] **`l'invariante non riguarda chi non ha ingressi per natura`** — il primo serbatoio e i
      compressori non ricevono aria: nessun arco inventato per loro.
- [ ] **`le giunzioni restano fuori dagli avvisi`** — sciogliendo un gruppo, `rimossi` non nomina i
      TEE; creandone uno, `aggiuntiDaScheda` nemmeno. E `aggiunti` invece **li contiene**: è
      l'elenco vero.
- [ ] **`riaprire senza cambiare nulla non muove nulla`** — non-regressione, il caso più comune.

### L'implementazione

- [ ] `archiNuovi` da `automatico.archi`. Idem il ripescaggio del terminale alle righe ~400-403,
      per la stessa ragione.
- [ ] L'invariante nuova, subito dopo quella del terminale, con lo stesso commento esplicativo:
      calcola dal **modello** l'insieme dei nodi con almeno un arco d'aria entrante, e dopo la
      riconciliazione ripesca da `automatico.archi` per quelli che l'hanno perso.
- [ ] `aggiuntiDaScheda` e `rimossi`: escludere `tipo === 'giunzione'` accanto a `'utenze'`. Il
      commento di `EsitoRiconciliazione` va aggiornato: dice «è `aggiunti` senza il terminale
      utenze», e non è più vero.

### Gate e prova

- [ ] `npx vitest run`, `npx tsc --noEmit`, `npx eslint src/services/schemaImpianto`.
- [ ] Le tre fixture intatte.
- [ ] **Rompi apposta:** rimetti `modello.archi` in `archiNuovi`; togli l'invariante; togli il
      filtro sulle giunzioni negli avvisi; fai scattare l'invariante anche quando un arco entrante
      c'è già.
- [ ] Commit: `fix(schema): la riconciliazione non spezza la catena e non chiama apparecchiature i TEE`

---

## Task 5: `preferenzeApplicate` — l'impronta di quando è stato disegnato

**Obiettivo:** l'operatore che cambia le preferenze e non rigenera **lo sa**. Oggi il disegno resta
quello di prima in silenzio — che è la promessa fatta al committente (nessun lavoro manuale perso),
ma senza avviso diventa una trappola.

`improntaPreferenze` esiste già dal Blocco 1 e qui trova il suo uso.

### La regola da tenere ferma

L'impronta salvata è quella delle preferenze **con cui il disegno è stato generato**, non quelle di
adesso. Se si scrivesse quella corrente al salvataggio, chiudere la finestra cancellerebbe l'avviso
senza aver rigenerato nulla. Quindi:

- si **stampa** l'impronta corrente quando si genera da zero (prima generazione senza layout
  salvato, e «Rigenera da capo»);
- si **riporta** quella salvata quando si riparte da un layout riconciliato;
- non si tocca in nessun altro caso (conferma dall'editor, trascinamenti, taratura).

`layoutIniziale` sa già quale delle due strade ha preso; lo deve **dire**, invece di farlo indovinare
al componente.

### I test, prima

In `__tests__/preferenze.test.ts`:

- [ ] **`preferenzeDaRiapplicare è falso quando l'impronta combacia`**.
- [ ] **`… è vero quando cambia l'ordine, una spunta, o un gruppo by-pass`** — tre casi, uno per
      famiglia di preferenza.
- [ ] **`… è falso quando il layout salvato non porta nessuna impronta`** — il caso di ogni pratica
      salvata prima di oggi: non si annuncia un cambiamento che non si sa se c'è stato.
- [ ] **`… è falso senza layout salvato`**.

In `__tests__/persistenza.test.ts`:

- [ ] **`serializzaLayout scrive l'impronta quando gliela si dà, e non la inventa`**.
- [ ] **`un salvataggio senza impronta si rilegge come prima`** — nessun bump di `VERSIONE`, il
      formato vecchio resta leggibile. È il campo opzionale sullo stampo di `muroX` e `simboli`.
- [ ] **`layoutIniziale dice se ha ripiegato sul layout automatico`** — il campo nuovo su
      `EsitoRiconciliazione`.

### L'implementazione

- [ ] `preferenze.ts`: `preferenzeDaRiapplicare(improntaSalvata: string | undefined, risolte:
      PreferenzeRisolte): boolean` — pura, provata, e **l'unico posto dove il confronto vive**.
- [ ] `persistenza.ts`: `preferenzeApplicate?: string` su `LayoutSalvato`, con il commento che
      spiega perché non alza `VERSIONE`; terzo parametro opzionale di `serializzaLayout`, inoltrato
      da `layoutDaPersistere` senza altra logica; campo `daZero: boolean` su
      `EsitoRiconciliazione`.
- [ ] `SchemaImpiantoSection.tsx`: uno stato `improntaApplicata`, scritto secondo la regola qui
      sopra e riportato al genitore con una porta nuova; l'Alert accanto a quello della
      riconciliazione, con un testo che dice cosa fare («le scelte in finestra sono cambiate dopo
      l'ultima generazione: premi *Rigenera da capo* per applicarle»).
- [ ] `TechnicalDetails.tsx`: tiene l'impronta e la passa a `layoutDaPersistere`.
- [ ] **Trappola Zod, da verificare anche se qui non morde.** `preferenzeApplicate` sta **dentro**
      `schemaLayout`, che `additionalInfoSchema` dichiara già: non è una chiave nuova di
      `additional_info` e non passa dalla potatura di `z.object`. **Verificarlo, non darlo per
      scontato** — è la trappola più grave della specifica, e costa una riga di test.

### Gate e prova

- [ ] `npx vitest run`, `npx tsc --noEmit`.
- [ ] `npx eslint` sui percorsi toccati, **compresi** `src/components/relazione` e
      `src/pages/TechnicalDetails.tsx`: conto dei warning **non uno più di prima** (18 sul gruppo).
- [ ] **Rompi apposta:** scrivi l'impronta corrente invece di quella generata; confronta con `!==`
      su `undefined`; togli il riporto dell'impronta salvata alla riconciliazione.
- [ ] Commit: `feat(schema): il disegno dice quando le scelte in finestra sono cambiate dopo di lui`

---

## Task 6: la prova in pagina, e la chiusura del blocco

**La prova in pagina trova ciò che i test non vedono.** Nei tre blocchi prima del Blocco 2 ha
trovato difetti ogni volta, con oltre 1300 test verdi. Nel Blocco 2 non ne ha trovati — prima volta.
**Non saltarla.**

Pratica designata dal committente: **`002 test`** (`fed244ee-26e6-4d32-8c01-45abd393879d`), creata
apposta — 2 compressori, 1 serbatoio, 2 essiccatori, 3 filtri, 1 separatore. Rotta
`/requests/<id>/technical-details`, poi il chip **SC**.

### Prima: il confronto col riferimento, senza browser

- [ ] Generare lo schema **dalla scheda vera letta dal DB** (Data API con la service-role key) con
      un gruppo by-pass su tutta la sezione di trattamento, rasterizzare con `sharp`
      (`sharp(svg, {density: 130}).png().toFile(...)` — è già fra le dipendenze) e mettere il
      risultato a fianco di `DOCUMENTAZIONE/relazione/si bypass.png`. Guardare, nell'ordine:
      1. il ponte c'è e **non** è una retta sovrapposta alla linea di processo;
      2. le tre valvole: due sui montanti a due passi sotto l'orizzontale, una a metà corsa;
      3. i montanti flessibili sotto le valvole, rigidi sopra, e la corsa orizzontale rigida;
      4. la linea di processo sotto l'uscita del serbatoio, col ponte che le passa in mezzo;
      5. nessuna valvola di riserva doppia ai capi del ponte.
- [ ] Annotare gli scarti dal riferimento **senza correggerli**: sono la lista di lavoro del
      Blocco 4, insieme a quelli già noti (compattezza in larghezza, `GIOCO_FRA_STADI`,
      il tratteggio delle condense che si perde nelle sovrapposizioni).

### Poi: la prova interattiva

- [ ] Dev server su una porta libera — **la 5173 è di un altro progetto**; nel Blocco 2 si è usata
      la 5199. **Spegnerlo a fine sessione:** i server dei worktree sopravvivono alla sessione che
      li ha accesi.
- [ ] Se il server MCP di Playwright va in timeout, la strada senza browser sopra basta per il
      confronto visivo; l'interattiva no, e va rifatta.
- [ ] `browser_drag` **non è affidabile** su react-flow. Su dnd-kit funziona il trascinamento **da
      tastiera**: focus sulla maniglia, `Space`, frecce, `Space`.
- [ ] Cosa verificare, in quest'ordine:
      1. **Creare un gruppo by-pass** selezionando le righe contigue e premendo «Crea by-pass»:
         compare la banda col nome e «Sciogli».
      2. **Un cambio di preferenze non ridisegna da sé.** Il blob dell'anteprima resta **identico**.
         La guardia `generazioneTentata` è un `useRef` mai riazzerato; il Task 5 tocca quell'effetto
         (l'impronta), quindi **va riprovato**, non dato per buono dal Blocco 2.
      3. **Compare l'avviso** «le scelte sono cambiate dopo l'ultima generazione».
      4. **«Rigenera da capo» applica**, l'avviso sparisce, e il disegno mostra il by-pass.
      5. **Sciogliere il gruppo e rigenerare**: la catena è intera, nessun TEE orfano, nessun avviso
         che chiami «apparecchiature rimosse dalla scheda» i due TEE.
      6. **Chiudere e riaprire**: il layout riconciliato porta ancora il ponte coi suoi gomiti, e le
         preferenze sono a posto in `additional_info` (Zod non le ha cancellate).
      7. **Rileggere il dato salvato da Supabase**: `preferenzeApplicate` scritta, **zero segni con
         `ancoraggio` residuo** e **zero archi con `forma` residua** nel layout — i due contratti di
         sola andata reggono fino al disco.
- [ ] **Ripristinare lo stato della pratica** a fine giro (gruppo sciolto, spunte e ordine come
      erano, rigenerato).

### La chiusura del blocco

- [ ] Gate verde su tutto il repo: `npx vitest run`, `npx tsc --noEmit`, eslint non un warning più
      del commit base.
- [ ] **Le tre fixture SVG intatte** — verifica finale esplicita, `git diff` sui tre file.
- [ ] Scrivere in coda a questo piano il paragrafo **«cosa è andato diversamente»**, e l'esito della
      prova in pagina.
- [ ] Aggiornare la consegna per il Blocco 4 con quanto raccolto: gli scarti dal riferimento, i
      valori da tarare (`GIOCO_FRA_STADI`, `PASSO_GIUNZIONE`, `ALTEZZA_BYPASS`,
      `PASSO_CORSIA_BYPASS`, `PASSO_COMPRESSORI`/`PASSO_SERBATOI`), e le due domande ancora aperte
      col committente (il gioco fra stadi 0 o 20; il tratteggio delle condense).
- [ ] **Solo ora il merge simulato:** `git fetch` **prima**, poi `git merge-tree` contro
      `origin/main` **appena aggiornato** — mai contro il `main` locale, che è la trappola già
      pagata una volta su questo repo. Leggere l'esito; **non fondere e non pubblicare** senza dirlo
      al committente.
- [ ] Commit finale: `docs(schema): l'esito del Blocco 3 e cosa resta al Blocco 4`

---

## Cosa NON si fa in questo blocco

- **La taratura visiva.** Le proporzioni non si provano coi test: `GIOCO_FRA_STADI`,
  `PASSO_GIUNZIONE`, `ALTEZZA_BYPASS`, `PASSO_CORSIA_BYPASS`, la compattezza in larghezza e il
  tratteggio delle condense sono il Blocco 4. Qui si espongono le costanti e si annota cosa si è
  visto, non si insegue il pixel.
- **Toccare `PASSO_ORIZZONTALE`.** È condiviso con `calcolaMuro` e con la spaziatura di compressori
  e serbatoi: muoverlo tocca tutte e tre le fixture. Se serve, il Blocco 4 introduce
  `PASSO_COMPRESSORI` e `PASSO_SERBATOI` separati.
- **Cambiare il pannello.** «Crea by-pass» e «Sciogli» esistono dal Blocco 1 e funzionano.
- **Fare del ponte un nodo, o delle valvole dei nodi.** Deciso e scartato in due blocchi.
- **Alzare `VERSIONE` in `persistenza.ts`.** `preferenzeApplicate` è un campo opzionale, non un
  cambio di formato — stessa ragione già decisa per `muroX` e `simboli`.
- **Fondere o pubblicare.** Il merge simulato dice cosa succederebbe; la decisione è del committente.
