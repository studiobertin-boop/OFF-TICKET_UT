# Consegna alla sessione successiva — schema d'impianto, la prima versione conforme

Scritto il 18-08-2026, a Blocco 1 finito. Chi riprende parte da qui.

## L'obiettivo

Lo schema d'impianto DM329 si genera da solo dalle apparecchiature di scheda, poi l'operatore lo
rifinisce nell'editor. La versione generata è topologicamente corretta ma graficamente lontana da
quella che lo studio consegna: ogni pratica richiede lo stesso identico lavoro manuale. Si vuole
che la **prima** versione rispetti già le convenzioni grafiche, così che l'operatore ritocchi le
eccezioni invece di ricostruire la regola.

**Specifica:** `docs/superpowers/specs/2026-08-17-schema-impianto-prima-versione-design.md`.
Leggerla per intera prima di toccare qualsiasi cosa: contiene le otto convenzioni, le decisioni
del committente e i rischi.

**Riferimenti visivi, in git:** `DOCUMENTAZIONE/relazione/si bypass.png` e
`DOCUMENTAZIONE/relazione/no bypass.png`. Sono il metro. Il secondo **manca la valvola prima del
tratto verso le utenze**: il committente l'ha dimenticata disegnando l'esempio, ma la convenzione
la prevede — non dedurre dal disegno che non ci vada.

## Dove sta il lavoro

Ramo **`worktree-schema-prima-versione-blocco1`**, nel worktree
`.claude/worktrees/schema-prima-versione-blocco1`. Sei commit, **nulla fuso su `main`**. I Blocchi
2 e 3 continuano su questo stesso ramo; il merge simulato con `git merge-tree` contro un
`origin/main` appena `fetch`ato si fa alla fine del Blocco 3, non prima.

`.env.local` va copiato a mano nel worktree (è git-ignored): senza, un file di test fallisce per
variabili d'ambiente mancanti e il baseline sembra rotto.

## Blocco 1 — fatto, provato, non fuso

Piano: `docs/superpowers/plans/2026-08-17-schema-impianto-prima-versione-blocco1.md`, col paragrafo
«cosa è andato diversamente» in coda.

| | |
|---|---|
| Test | 1353 verdi, 99 file |
| `tsc --noEmit` | pulito |
| eslint | zero warning nuovi |
| Fixture SVG | intatte tutte e tre — il disegno non è ancora cambiato |

Cosa esiste ora, e che il Blocco 2 consuma:

- **`SchemaAncoraggioSegno`** (`services/schemaImpianto/types.ts`) e **`tDaAncoraggio(punti,
  ancoraggio)`** (`tratti.ts`). Dicono «questa valvola sta un passo di griglia sotto quel vertice»
  e traducono in `t`. **Nessuno le chiama ancora**: le userà `segniAncorati.ts` nel Blocco 2.
- **`additional_info.schemaPreferenze`** (`services/relazione/types.ts`): `ordineCompressori`,
  `ordineStadi`, `ordineSerbatoi`, `condense`, `bypass[{id, stadi}]`. Tutto opzionale.
- **`services/schemaImpianto/preferenze.ts`**: `famiglieDaScheda(scheda)` →
  `{compressori, serbatoi, stadi}` nell'ordine di default del generatore;
  `risolviPreferenze(preferenze, famiglie, scaricaDiDefault)` → `PreferenzeRisolte`;
  più `ordinaPerElenco`, `contigui`, `prossimoIdBypass`, `improntaPreferenze`.
- **`components/relazione/PannelloPreferenzeSchema.tsx`**, montato nella finestra SC.

## Il debito da saldare per primo nel Blocco 2

`PannelloPreferenzeSchema` passa `() => true` come regola di default per le condense. Il Blocco 2
deve rendere `scaricaCondensa` (oggi privata in `buildSchemaModel.ts:215-218`) una funzione
condivisa, e **pannello e generatore devono passare la stessa**: altrimenti la spunta mostrata
all'operatore mente sul disegno che uscirà. È il primo lavoro, non l'ultimo.

## Blocco 2 — le convenzioni senza by-pass

È il blocco che dà il grosso del risultato visibile. Riproduce `no bypass.png`.

1. **`catenaDagliArchi(model, pozzo)`** in `layout.ts`: la sequenza della linea si legge dagli
   ARCHI, non ri-derivandola con `ordinaCatenaTrattamento` (oggi a `layout.ts:205`). Quella
   funzione non conosce le preferenze né le giunzioni, e produrrebbe un ordine diverso da quello
   che gli archi collegano — cioè linee incrociate. Resta come ordine di **default** dentro
   `buildSchemaModel`. Con visited-set contro i cicli e ripiego se la catena non si chiude.
2. **`pozzoCondense` robusto** (`layout.ts:35-53`): oggi riconosce un separatore come pozzo solo
   se *riceve* condensa. Col flag per apparecchiatura l'operatore può spegnerle tutte, e allora il
   separatore verrebbe trascinato dentro la catena di trattamento, in disaccordo con gli archi.
   Diventa: è pozzo se **nessun arco d'aria** lo tocca. Difetto reso raggiungibile dal Blocco 1.
3. **Linea di processo disposta per ANCORE, non per riquadri.** L'ancora `sx` di ogni stadio cade
   sulla quota della linea; l'avanzamento è `ancoraDx.x − ancoraSxProssimo.x + gioco`. Con
   `GIOCO_FRA_STADI = 0` (valore dichiarato dal committente: ancore coincidenti, passo 100).
   **Attenzione:** i rombi portano codoli da 10 unità che sporgono *fuori* dal riquadro
   (`symbols/index.ts:630-632`), quindi a gioco 0 ogni codolo sconfina nella punta del vicino. Se
   il disegno lo mostra, il valore giusto è 20 (i codoli si toccano e formano il collegamento).
   Costante esposta apposta: si chiude nel Blocco 4, guardando.
4. **Quota della linea = quota dell'ancora `dx` del serbatoio di testa.** Oggi differiscono di 55
   unità e la linea nasce con un gomito che nei riferimenti non c'è. Nota: allineare per ancora
   sposta gli stadi di 5 unità rispetto a oggi (riquadro 110, ancora a 50, centro a 55).
5. **`segniAncorati.ts`**: `risolviSegniAncorati(nodi, archi, quote, libreria)`, chiamata da
   `layoutSchema` come **ultimo passo**. Ricalcola la stessa polilinea che disegnerà `renderSvg`
   — `instrada(stile, posizioneAncora(da), posizioneAncora(a), arco.punti, quote, {da: latoImposto…})`,
   identica a `renderArco` (`renderSvg.ts:121-126`) — e riscrive le `t`.
   **Contratto di sola andata:** `ancoraggio` e `forma` entrano nel layout e **non ne escono**. Il
   formato salvato non cambia di un byte, e `renderSvg`, `conversioneFlow`, `SchemaEdgeTubazione`,
   `useSegniTubo` e `persistenza` non si toccano. Da fissare con un test: nessun arco né segno in
   uscita da `layoutSchema` porta ancora quei campi.
   Nessuna circolarità: `quoteInstradamento` legge nodi, testi e muro, **mai** gli archi.
6. **`buildSchemaModel`**: riceve `preferenze` e `libreria`; mandata compressore sull'ancora
   **`sx-basso`** del serbatoio (era `sx`) con segno `stileAValle: 'standard'` e ancoraggio
   `{vertice: 1, scarto: -10}`; **via le valvole d'ufficio a `t: 0.5` fra stadi consecutivi**;
   valvole di riserva all'uscita del serbatoio e prima delle utenze **secondo la copertura**;
   condense dal flag invece che da `scaricaCondensa`.

**Qui cambiano due delle tre fixture SVG** (`svgRiferimentoSenzaTesti`, `svgRiferimentoConMuro`).
Si rigenerano seguendo la procedura scritta nel loro header — rendere col codice nuovo, spezzare
per riga, **leggere il diff**, annotare in testa perché — e mai per far tornare verde un test.
**`svgRiferimentoConTee` non deve cambiare**: costruisce il layout a mano e non passa da
`buildSchemaModel`. Se cambia, fermarsi: vuol dire aver toccato i simboli o l'instradamento.

## Blocco 3 — il by-pass

Riproduce `si bypass.png`. Nuovo modulo `services/schemaImpianto/bypass.ts`, **non** dentro
`buildArchi`.

- Un gruppo = **due nodi `giunzione`** sulla linea (`BP1-IN`, `BP1-OUT`, da `bp1` delle preferenze)
  più **un arco** che li unisce, con gomiti espliciti: sale, corre, ridiscende.
- Sull'arco **tre segni**: valvola sul montante sinistro `{vertice: 1, scarto: -10}` con
  `stileAValle: 'standard'`; valvola `{meta: tratto 1}` senza `stileAValle`; valvola sul montante
  destro `{vertice: 2, scarto: +10}` con `stileAValle: 'flessibile'`. Stile di partenza
  dell'arco: `'flessibile'`.
- **I gomiti sono obbligatori, non un'ottimizzazione.** Entrambi i capi stanno su una giunzione,
  che impone il lato: senza gomiti, `rottaImboccata` piega a `yMedia` (`tratti.ts:482-485`) — che
  coi due TEE alla stessa quota è la loro stessa quota — e `dedup` collassa tutto in una **retta
  orizzontale sovrapposta alla linea di processo**. Il by-pass sparirebbe alla vista pur esistendo
  nel modello.
- Origine dei TEE: **`'scheda'`**, come `UTENZE`. `'manuale'` li renderebbe indistruttibili, e
  sciogliere un gruppo lascerebbe due TEE orfani su ogni disegno riaperto.
- **Con almeno un by-pass la linea di processo scende di una corsia**, così il ponte corre sotto
  l'uscita del serbatoio invece di accavallarcisi.
- `riconcilia` (`persistenza.ts:297-419`), due correzioni: **`archiNuovi` deve prendere gli archi
  dal layout automatico, non dal modello** (righe 356-364 e 401) — dal modello arriverebbero con
  `t` di ripiego e senza ponte; e **sciogliere un by-pass spezza la catena**, perché l'arco
  sostitutivo non viene ripescato (nessuno dei due capi è fra i nodi aggiunti): serve
  un'invariante sullo stampo di quella già scritta per il terminale alle righe 400-403.
- `improntaPreferenze` esiste già e qui trova il suo uso, insieme a un campo opzionale
  `preferenzeApplicate` su `LayoutSalvato` (nessun bump di `VERSIONE`).

**Nessuna fixture deve cambiare nel Blocco 3**: descrivono impianti senza stadi e senza by-pass.
Se cambiano, è un difetto.

## Blocco 4 — taratura visiva

Le proporzioni non si provano coi test. Si genera lo schema sulle pratiche vere, lo si mette a
fianco dei due riferimenti e si correggono le costanti: `GIOCO_FRA_STADI`, `ALTEZZA_BYPASS`,
`PASSO_GIUNZIONE`, `PASSO_CORSIA_BYPASS`.

Per la compattezza in larghezza **non** ritoccare `PASSO_ORIZZONTALE` (`layout.ts:74`): è condiviso
con `calcolaMuro` e con la spaziatura di compressori e serbatoi, e muoverlo tocca tutte e tre le
fixture. Introdurre `PASSO_COMPRESSORI` e `PASSO_SERBATOI` separati se serve. L'adiacenza degli
stadi da sola porta il passo da 170 a 100.

## Trappole, tutte già pagate almeno una volta

1. **Zod cancella i campi che non conosce.** `additionalInfoSchema`
   (`services/relazione/schema.ts`) è un `z.object` senza `passthrough`, e `additionalInfo` in
   `RelazioneDataDialog.tsx:161-171` è costruito da un letterale che non fa spread. Un campo nuovo
   in `additional_info` va dichiarato in **entrambi** o sparisce alla prima relazione generata, in
   silenzio. Già risolto per `schemaPreferenze`, con un test che lo fissa; vale per il prossimo.
2. **`sx-basso` non esiste sul serbatoio ORIZZONTALE** (`symbols/index.ts:1012-1017`), e una
   taratura permanente può toglierlo anche al verticale. La convenzione va scritta come «l'ancora
   bassa se il simbolo ce l'ha, altrimenti `sx`»: per questo `buildSchemaModel` riceve la libreria
   e ne legge l'**esistenza** delle ancore, mai la geometria. Senza, si finisce nel ripiego di
   `posizioneAncora` (`renderSvg.ts:81-84`), che attacca il tubo al centro del corpo del serbatoio:
   sbagliato ma plausibile, il peggior tipo di errore.
3. **Archi di lunghezza nulla** fra stadi adiacenti (a gioco 0). Nulla schianta, ma l'arco diventa
   non afferrabile sulla tela. Regola: **l'arco si emette sempre**, anche degenere — è il tessuto
   che ripara il disegno appena l'operatore separa i due nodi — e **non gli si mette mai un segno**.
4. ~~I layout salvati non si devono muovere di un pixel.~~ **Non è più un vincolo** (committente,
   18-08-2026): perdere i disegni salvati di ORVED (`a8bbdbe1`) e LOWA R&D (`c6f56ca5`) va bene.
   Cadono la verifica byte-per-byte su quelle due pratiche e il divieto di alzare `VERSIONE` in
   `persistenza.ts`. **Non cadono** le due correzioni a `riconcilia` del Blocco 3: riguardano i
   disegni nuovi quando le preferenze cambiano a metà vita, non quelli vecchi.
   **`002 test` (`fed244ee`) è la pratica designata per le prove**, creata apposta dal committente:
   su di lei non serve ripristinare nulla a fine giro.
5. **`t` di ripiego.** Ogni segno ancorato nasce con `t: 0.5`. Se il risolutore torna `null` per un
   difetto di geometria, la valvola compare a metà tubo: sbagliata ma visibile e correggibile.
   Degradazione voluta, mai un'eccezione.
6. **L'effetto di prima generazione** (`SchemaImpiantoSection.tsx:300-335`) avrà `preferenze` fra
   le dipendenze, obbligatorio con `exhaustive-deps`. Verificare che la guardia `generazioneTentata`
   regga: **un cambio di preferenze non deve mai ridisegnare da sé** — è una promessa fatta al
   committente, l'effetto si vede solo con «Rigenera da capo».
7. **I test verdi per la ragione sbagliata** sono la classe di difetto numero uno di questo modulo.
   Un test che fallisce solo perché il modulo non esiste ancora **non** l'hai visto fallire per la
   ragione giusta: rompi apposta la logica e guarda quali cadono. Nel Blocco 1 questo ha confermato
   che i test della contiguità mordevano davvero.
8. **La prova in pagina trova ciò che i test non vedono.** Nel Blocco 1, con 1353 test verdi, ha
   trovato due difetti (ordine non canonico del gruppo salvato, concordanza sbagliata in un
   avviso). È la terza volta per questo modulo. **Non saltarla.**
9. `browser_drag` non è affidabile su react-flow. Su dnd-kit funziona invece benissimo il
   trascinamento **da tastiera**: focus sulla maniglia, `Space`, frecce, `Space`.
10. Il dev server: verificare quale processo tiene la porta, e spegnerlo a fine sessione — i server
    dei worktree sopravvivono alla sessione che li ha accesi.

## Decisioni prese, da non ridiscutere

- Le **valvole restano segni** sul tubo, non diventano nodi (valutato in due blocchi, scartato).
- Le **frecce di direzione si posano a mano**, TEE compreso.
- **Cambiare ordine o flag non tocca il disegno esistente**: scrive le preferenze, e l'effetto si
  vede premendo «Rigenera da capo». Serve a non buttare via il lavoro manuale.
- **Ordine di default dei serbatoi**: per `ubicazione` di scheda (`SALA_COMPRESSORI` in testa).
- **Un gruppo by-pass sopravvive solo se i membri restano contigui**; altrimenti cade tutto e lo si
  dice. Non si aggiusta un gruppo spezzato: indovinare è peggio che dirlo.
- Le pratiche salvate **si ridisegnano** con le convenzioni nuove: un documento già consegnato, se
  rigenerato, esce diverso. Prezzo accettato — e dal 18-08-2026 anche **perdere del tutto** i
  layout salvati di ORVED e LOWA R&D è accettato.
- La policy di UPDATE su `dm329_technical_data` resta aperta: qualunque `userdm329` scrive su ogni
  pratica. Rischio noto e accettato (tre persone dello stesso studio).

## Il gate, a ogni task

```
npx vitest run
npx tsc --noEmit
npx eslint <percorsi toccati>
```

Niente `prettier --write`. **Il conto dei warning eslint non è zero ovunque: è «non uno più di
prima»**, misurato sul commit base — `src/services/schemaImpianto` 0,
`src/components/schemaImpianto` 3 (preesistenti e tollerati), `services/relazione` +
`components/relazione` + `pages/TechnicalDetails.tsx` + `utils/equipmentCodes.ts` 18. Un
`--max-warnings 0` su quei percorsi fallisce anche senza toccarli.

Nessun test di interfaccia: la logica provabile va in servizi e hook (`CLAUDE.md`).
