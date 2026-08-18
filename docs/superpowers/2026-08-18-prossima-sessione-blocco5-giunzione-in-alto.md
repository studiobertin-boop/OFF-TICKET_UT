# Consegna alla sessione successiva — il Blocco 5 e la chiusura del lavoro

Scritto il 18-08-2026, a Blocco 4 finito. Chi riprende parte da qui.

**Questo è l'ultimo blocco della specifica «la prima versione già conforme alle convenzioni».**
Dopo di lui restano solo la prova in pagina, la pulizia e la pubblicazione — che non sono blocchi
ma non sono nemmeno formalità: la prova in pagina ha trovato il difetto peggiore di questo modulo
**tre volte**, sempre con più di 1300 test verdi.

## Dove sta il lavoro

Ramo **`worktree-schema-prima-versione-blocco1`**, worktree
`.claude/worktrees/schema-prima-versione-blocco1`. **Trentotto commit, nulla fuso su `main`.**

**Baseline al commit `9b442b8`: 1462 test verdi, 101 file, `tsc` pulito, eslint 0 / 3 / 18.**

**Merge simulato fatto a fine Blocco 4, con `git fetch` prima:** `git merge-tree --write-tree`
contro `origin/main` appena aggiornato dà **zero conflitti**, e `origin/main` è ancora fermo a
`8381f53`, cioè alla base del ramo — sarebbe un **fast-forward**. Se passa altro tempo, **rifare il
`fetch`** prima di rifidarsi di questo esito: è la trappola già pagata su questo repo, mai simulare
contro il `main` locale.

`.env.local` è git-ignored: va copiato dal checkout principale nel worktree, o un file di test
fallisce per variabili mancanti. **Contiene anche le credenziali dell'applicazione**
(`APP_LOGIN_EMAIL` / `APP_LOGIN_PASSWORD`, ruolo admin): non chiederle al committente.

## Da leggere, in quest'ordine

1. **Questa consegna**, per intera.
2. **Il piano del Blocco 4**:
   `docs/superpowers/plans/2026-08-18-schema-impianto-prima-versione-blocco4.md`, col paragrafo
   «cosa è andato diversamente», l'esito e la sezione «cosa resta aperto» in coda. **Il paragrafo
   «Come si misura» è lo strumento di lavoro di questo blocco**, non un resoconto.
3. **La specifica**:
   `docs/superpowers/specs/2026-08-17-schema-impianto-prima-versione-design.md`. **Va letta con due
   correzioni**, che stanno nel paragrafo «Cosa la specifica dice male» qui sotto.
4. **I riferimenti visivi, in git:** `DOCUMENTAZIONE/relazione/si bypass.png` (**il metro di questo
   blocco**) e `no bypass.png`.

## Cosa la specifica dice male

Due righe della specifica sono superate. Non correggere il codice verso di loro.

1. **La convenzione 1 dice «un passo di griglia (10) sotto la dorsale». Sono DUE (20)** dal
   18-08-2026, e la stessa misura vale per le valvole dei montanti del ponte (convenzione 5). Il
   codice è già a posto: `SCARTO_VALVOLA = 20` in `buildSchemaModel.ts`.
2. **Il Blocco 4 della specifica dice «`GIOCO_FRA_STADI` — default 0»**. È 20 dal 18-08-2026, per
   decisione del committente, e la misura sul riferimento lo conferma esattamente.

E una terza correzione, che riguarda una regola citata in più punti:

3. **«La regola della dorsale ha due vincoli»** — non più. Dal 18-08-2026 la quotano i
   **compressori e loro soli**. Vedi `quotaCollettore` (`layout.ts`) e i test che lo fissano.

## Il Blocco 5 — la giunzione di monte alla quota dell'uscita del serbatoio

**Deciso dal committente il 18-08-2026.** Nel suo `si bypass.png` la giunzione di monte non sta
sulla linea di processo: sta **in cima**, sulla stessa orizzontale che esce dal serbatoio, e dal
TEE **scende** un montante flessibile fino alla punta sinistra del primo stadio. Nel nostro disegno
il TEE sta in basso e il montante **sale** verso il ponte: viene un tratto verticale in più, perché
il gradino dal serbatoio e il montante sono due cose diverse.

### La forma esatta, misurata sul riferimento

**Sale solo la giunzione di MONTE.** L'anteprima mostrata al committente quando ha scelto metteva
in alto entrambe: è un'imprecisione dell'anteprima, non della sua scelta. Il disegno dice:

- **capo di monte**: TEE a `x≈291, y≈74`, cioè alla quota dell'uscita del serbatoio. Da lì tre
  rami — il tratto che arriva da S1 (orizzontale, a sinistra), il ponte (orizzontale, a destra) e
  il montante flessibile che **scende** a `y≈125`, la quota della linea di processo, dove atterra
  sulla punta sinistra del primo stadio (`x≈293`). La valvola sta due passi sotto il TEE.
- **capo di valle**: il ponte corre a `y≈74` fino a `x≈574`, poi **scende** flessibile fino a
  `y≈125`, con la valvola due passi sotto il gomito. Lì c'è la giunzione di valle, **sulla linea di
  processo**, da cui la linea prosegue verso le utenze **a quella quota** (scansione della riga
  y=125: un tratto continuo da 556 a 610, con l'ancora di UTENZE a 610).

È asimmetrico ed è giusto che lo sia: a monte il flusso si divide **prima** di scendere negli
stadi, a valle si ricongiunge **sulla** linea e prosegue. Chi lo rende simmetrico ottiene un tratto
verticale in più verso le utenze, che nel riferimento non c'è.

### Cosa comporta, file per file

**`layout.ts` — `disponiCatenaPerAncore`.** Le giunzioni il cui id finisce in `-IN` si posano a
`quotaLinea − PASSO_CORSIA_BYPASS`; le `-OUT` restano su `quotaLinea`. Attenzione alle **corsie**:
oggi le assegna `risolviPonti` dalle ascisse vere, perché la quota del ponte è sua; con la quota
del ponte che diventa quella della `-IN`, le corsie vanno assegnate **qui**, accoppiando `-IN` e
`-OUT` nella sequenza e passando gli intervalli ad `assegnaCorsie` (`bypass.ts`, già esportata e
già usata da `linearizzaConBypass`: usare quella, o le due risposte divergono).

**`segniAncorati.ts` — `risolviPonti`.** Il ponte passa da **quattro vertici a tre**: parte dalla
`-IN` (già in alto), corre orizzontale alla sua quota e **scende** sulla `-OUT`. Un gomito solo,
a `{ x: capo.a.x, y: capo.da.y }`. La funzione si semplifica — non calcola più né `yPonte` né le
corsie, e non le servono più `altezza`/`passoCorsia` dal chiamante — ma **il commento che spiega
perché i gomiti sono obbligatori va riscritto**: la ragione cambia. Oggi dice che senza gomiti
`rottaImboccata` piega a `yMedia`, che coi due TEE alla stessa quota è la loro stessa quota; ora i
due TEE **non** sono più alla stessa quota, e la ragione del gomito è che senza di lui la discesa
cadrebbe dove decide `rottaImboccata` invece che sopra la `-OUT`.

**`buildSchemaModel.ts` — le tre valvole si ridistribuiscono.** Oggi stanno tutte e tre sul ponte
(`valvolaAlVertice(1,'standard',-1)`, `valvolaAMeta(1)`, `valvolaAlVertice(2,'flessibile',+1)`) e
l'arco è `stile: 'flessibile'`. Diventano:

- **sul ponte, due**: `valvolaAMeta(0)` (metà della corsa orizzontale, che ora è il tratto 0) e
  `valvolaAlVertice(1, 'flessibile', +1)` (due passi sotto il gomito, sulla gamba discendente).
  L'arco diventa **`stile: 'standard'`**: rigido dalla partenza, e la valvola del gomito lo passa
  a flessibile fino alla `-OUT`.
- **la terza esce dal ponte** e va sull'arco `BP1-IN → primo stadio scavalcato`, che è un normale
  arco della catena: `stile: 'standard'`, `valvolaAlVertice(0, 'flessibile', +1)`. Sopra la valvola
  rigido, sotto flessibile — il **mirror** della convenzione 1, dove il tubo sale invece di
  scendere. *(Verificato: `tDaAncoraggio` (`tratti.ts`) gestisce il vertice 0 con scarto positivo —
  usa `lunghezze[0]`, che esiste. Non serve toccarlo.)*

**`SCARTO_VALVOLA` resta 20 e resta uno solo** per mandata del compressore e valvole del ponte: un
test lega esplicitamente le due misure, e le due valvole finiscono affiancate nel disegno.

**`PASSO_GIUNZIONE` torna in gioco.** È l'ultima costante della specifica ancora non tarata, ed è
rimasta a 20 apposta: col TEE in alto la sua distanza orizzontale dalla punta del primo stadio
misura **~3 unità** sul riferimento (TEE a x≈291, punta a x≈293), perché lì sta **sopra** e non di
fianco. Tararla ora è il momento giusto; farlo prima sarebbe stato inseguire un numero inutile.
Attenzione: la giunzione ha le quattro ancore **coincidenti nel centro** del riquadro, quindi a
gioco zero il pallino sparisce dentro il simbolo del rombo vicino — c'è un pavimento sotto il quale
non si scende, e va scritto nel commento invece che scoperto due volte.

### I test che fissano la forma vecchia, e vanno RISCRITTI (non allentati)

In `layout.test.ts`, `describe('il by-pass nel layout')`:

- **`le giunzioni cadono sulla linea di processo, come gli stadi`** — diventa vera solo per le
  `-OUT`. La `-IN` vuole un'asserzione sua: sta alla quota dell'uscita del serbatoio.
- **`fra una giunzione e lo stadio vicino c'e' PASSO_GIUNZIONE, di qua e di la'`** — la simmetria
  va ripensata: di qua il TEE è sopra, di là è di fianco.
- **`il ponte esce dal layout con quattro vertici: capo, gomito, gomito, capo`** — tre vertici.
  **È il test che lega il numero di gomiti agli ancoraggi delle valvole**: aggiornarlo insieme agli
  ancoraggi, o le valvole si spostano senza che nessun test se ne accorga.
- **`senza gomiti il ponte collasserebbe sulla linea: per questo ci sono`** — la dimostrazione
  cambia, perché cambia la ragione.
- **`la corsa del ponte cade sulla quota dell'uscita del serbatoio, e comincia oltre di essa`**
  (scritto nel Blocco 4) — la prima metà resta vera **per un'altra ragione**: non perché il ponte
  salga di `ALTEZZA_BYPASS`, ma perché la `-IN` è già lì. La seconda metà («comincia oltre») va
  ripensata: con la `-IN` in alto, il tratto da S1 e il ponte sono complanari **e adiacenti**, non
  disgiunti — si toccano sul TEE, che è esattamente ciò che il riferimento mostra come una riga
  sola lunga 322 px.

In `buildSchemaModel.test.ts`:

- **`il ponte è un arco solo, flessibile, che unisce i due TEE dall'alto`** — diventa `standard`.
- **`il ponte porta tre valvole ancorate ai vertici dei gomiti, coi loro stili a valle`** — due.
- **`lo scarto delle valvole del ponte è lo stesso di quello della mandata`** — resta valido, ma
  pesca il primo segno del ponte: controllare che peschi ancora quello giusto.
- **`la valvola di riserva sparisce dove il ponte ne mette già una`** (`capoDiTee`) — **da
  guardare con attenzione**: la regola esiste perché non nascano due valvole a un passo di
  distanza. Con la valvola di monte spostata sull'arco `BP1-IN → primo stadio`, il conto di cosa
  sta vicino a cosa cambia, e la regola va riverificata sul disegno, non solo sui test.
- **`gli archi del ponte non entrano fra quelli delle condense né fra quelli di linea`** — il
  commento dice «il ponte è flessibile come la mandata del compressore»: non più.

### `ALTEZZA_BYPASS` sopravvive?

Con la `-IN` posata dal layout alla quota giusta, `ALTEZZA_BYPASS` (oggi `= PASSO_CORSIA_BYPASS`)
**non serve più a nessuno**: la quota del ponte è quella del suo capo. Toglierla è la conclusione
naturale, ma **va guardato prima** se qualcosa la legge ancora — e il test che oggi lega le due
costanti va sostituito da uno che lega la quota della `-IN` a quella dell'uscita del serbatoio, che
è la stessa promessa detta dove ora vive.

## Le altre attività finali

### 1. La prova in pagina — non è una formalità

**Non è stata fatta nel Blocco 4**: c'è stato solo il confronto visivo sul disegno generato dalla
scheda vera letta dal DB. Su questo modulo la prova in pagina ha trovato **tre volte** il difetto
peggiore del blocco, sempre cose che nessun test poteva vedere (l'ultima: il tubo che sembrava
uscire dalla pancia del serbatoio).

Pratica **`002 test`** (`fed244ee-26e6-4d32-8c01-45abd393879d`), rotta
`/requests/<id>/technical-details`, poi il chip **SC**.

- [ ] **«Rigenera da capo» mostra le distanze nuove**, e il disegno in pagina è quello del
      confronto senza browser.
- [ ] **Un cambio di preferenze non ridisegna da sé.** Il blob dell'anteprima resta **identico**.
      La guardia `generazioneTentata` è un `useRef` mai riazzerato; il Blocco 4 non ha toccato quel
      percorso, ma il Task 5 ha toccato la resa.
- [ ] **Tela e documento disegnano lo STESSO tratteggio sulle condense.** È il candidato preciso di
      questo giro: `sfasamentoCondense` sta in `symbols/index.ts` e non in `renderSvg` proprio
      perché la usano tutt'e due, e **nessun test può confermarlo**. Guardare la corsia comune dove
      più linee si sovrappongono, sulla tela e nell'anteprima.
- [ ] **Comporre un by-pass, rigenerare, confrontare con `si bypass.png`** (dopo il Blocco 5).
- [ ] **Chiudere e riaprire**: il layout riconciliato porta ancora il ponte, e le preferenze sono a
      posto in `additional_info` (Zod non le ha cancellate).
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
  **Spegnerlo a fine sessione**, e verificare che la porta sia libera: fermare il task non basta,
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
      byass.png`, col refuso — **solo a merge fatto**: nel checkout principale i due png sono
      ancora untracked, ed è quella copia a tenerli lì.

### 3. Il merge e la pubblicazione

- [ ] **`git fetch` PRIMA**, poi `git merge-tree --write-tree origin/main HEAD` contro un
      `origin/main` **appena aggiornato**. Mai contro il `main` locale: è la trappola già pagata
      una volta su questo repo, che aveva fatto **negare un conflitto reale**.
- [ ] Leggere l'esito e riferirlo. **Non fondere e non pubblicare senza il via libera del
      committente.**
- [ ] A push fatto, il deploy di produzione parte da sé (Vercel, Production Branch `main`):
      verificarlo sul bundle servito, non solo sullo stato del deploy.
- [ ] Registrare il giro in `DOCUMENTAZIONE/fixes.md` **solo a deploy verificato**.

## Il gate, a ogni task

```
npx vitest run
npx tsc --noEmit
npx eslint <percorsi toccati>
```

Niente `prettier --write`. **Il conto dei warning eslint non è zero ovunque: è «non uno più di
prima»** — `src/services/schemaImpianto` **0**, `src/components/schemaImpianto` **3**
(preesistenti), `services/relazione` + `components/relazione` + `pages/TechnicalDetails.tsx` +
`utils/equipmentCodes.ts` **18**. Un `--max-warnings 0` su quei percorsi fallisce anche senza
toccarli. *(Nel Blocco 4 un warning nuovo è comparso su `services/schemaImpianto` per un import
rimasto inutile dopo la riscrittura di un test: è il modo tipico in cui quel conto si sporca.)*

Nessun test di interfaccia: la logica provabile va in servizi e hook (`CLAUDE.md`).

## Le fixture SVG

**Tutte e tre si muoveranno in questo blocco?** Probabilmente **no**: descrivono impianti **senza
stadi e senza by-pass**, e il Blocco 5 tocca solo la geometria del by-pass. **Se una cambia,
fermarsi e guardare il diff** prima di qualsiasi altra cosa.

**Non fidarsi della vecchia regola «`svgRiferimentoConTee` costruisce il layout a mano, se cambia
fermati».** È falsa, ed era già stata smentita nel Blocco 2 senza che la smentita arrivasse nelle
consegne: `layoutConTee` parte da `layoutSchema` sulla stessa scheda minima delle altre due e ci
innesta **solo il TEE** a mano. La regola resta buona nella sostanza — se cambia, si **guarda** —
ma la sua ragione è un'altra: lì, e solo lì, si vede la geometria del TEE.

Si rigenerano **seguendo la procedura scritta nel loro header**: rendere lo stesso layout col
codice nuovo, spezzare **un elemento per riga** a profondità 1 con emissione anche quando un figlio
si chiude, **leggere il diff**, e annotare in testa il perché. **Mai per far tornare verde un
test.**

**Come si legge davvero quel diff.** Sono decine di righe da migliaia di caratteri: «cambiano solo
le ascisse» non è una cosa che si firmi guardando. Nel Blocco 4 si è scritto `confronta.mts`, che
pone due domande separate — *il markup è identico a meno dei numeri?* e *quali attributi cambiano,
e di quanto?* — e risponde **per nome di attributo**. Trappola trovata scrivendolo: una regex del
nome attributo che non ammette cifre **non aggancia `x1`/`x2`**, e lascia fuori dal confronto
intere righe della tabella **in silenzio**.

## Le trappole che restano vere

1. **I file del repo hanno fine riga CRLF.** Le sostituzioni e le mutazioni «rompi apposta» scritte
   con pattern multi-riga e `\n` non agganciano e sembrano innocue. **Verificare sempre con
   `git diff --stat` che la modifica sia entrata** prima di concludere qualsiasi cosa. Pagata tre
   volte fra Blocco 3 e Blocco 4.
2. **I test verdi per la ragione sbagliata** sono la classe di difetto numero uno di questo modulo.
   A ogni task: rompi apposta la logica appena scritta e **guarda quali test cadono**.
   **Attenzione a una copertura che sembra un buco e non lo è:** in questo modulo molti test
   asseriscono **sulla costante** e non sul valore, per scelta — cambiare il valore non li fa
   cadere, e a fissare il numero sono le **fixture**. La copertura è complementare, e va provata
   nei due versi: sbagliare il **valore** deve far cadere le fixture, sbagliare il **cablaggio**
   deve far cadere il test.
3. **Zod cancella i campi che non conosce.** `additionalInfoSchema`
   (`services/relazione/schema.ts`) è un `z.object` senza `passthrough`, e `additionalInfo` in
   `RelazioneDataDialog.tsx` è costruito da un letterale che non fa spread. Un campo nuovo in
   `additional_info` va dichiarato in **entrambi** o sparisce alla prima relazione generata, in
   silenzio. *(Non morde su `preferenzeApplicate`, che viaggia dentro `schemaLayout`, `z.any()`.)*
4. **L'arco si emette sempre**, anche degenere fra due stadi adiacenti, e **non gli si mette mai un
   segno**.
5. **`t` di ripiego.** Ogni segno ancorato nasce con `t: 0.5`. Se il risolutore torna `null`, la
   valvola compare a metà tubo: sbagliata ma visibile. Degradazione voluta, mai un'eccezione.
6. **Un cambio di preferenze non deve MAI ridisegnare da sé.**
7. **Non lanciare più esecuzioni di `vitest run` in parallelo.** Si accavallano sui core e la suite
   passa da due minuti a non finire più.
8. **Per guardare un disegno senza browser:** `sharp` è già fra le dipendenze,
   `sharp(Buffer.from(svg), {density: 130}).png().toFile(...)`. Uno script `.mts` **alla radice del
   worktree** (fuori non risolve `node_modules`) eseguito con `npx tsx`. E un attrezzo che deve
   nominare la sequenza che chiude un commento **non può avere un JSDoc in testa**: lo chiuderebbe
   in anticipo. Pagata nel Blocco 4.

## Deciso dal committente, non ridiscutere

- **`GIOCO_FRA_STADI` = 20** — e la misura sul riferimento lo conferma esattamente (passo 120).
- **Il tratteggio delle condense si fasa** con `stroke-dashoffset`. Il collettore condense unico è
  **scartato**.
- **La dorsale la quotano i compressori, non il serbatoio** (18-08-2026).
- **Il gradino dal serbatoio resta a metà strada** (18-08-2026). *Da sapere: fatto il Blocco 5, nel
  caso col by-pass il gradino **sparisce da sé** — l'arco `S1 → BP1-IN` avrebbe i due capi alla
  stessa quota, e `gradinoVersoIlTee` non emette nulla. La scelta continua a valere per gli altri
  casi.*
- **La giunzione di monte del by-pass va portata in alto** (18-08-2026): è questo blocco.
- **`PASSO_SERBATOI = 20` non è misurato** e resta così: i due riferimenti portano un serbatoio
  solo, ed è la scelta simmetrica coi compressori, dichiarata tale nel commento. **Si chiude solo
  se il committente fornisce un disegno con due serbatoi affiancati** — chiederglielo, non
  indovinare.
- **Il merge si fa alla FINE**, dopo la prova in pagina: il committente vuole chiudere e pubblicare
  in un colpo solo.
