# Schema d'impianto DM329 — la prima versione già conforme alle convenzioni

Specifica del 17-08-2026. Committente: Studio Bertin.

## Contesto

Lo schema d'impianto si genera da solo dalle apparecchiature censite in scheda dati, poi
l'operatore lo rifinisce nell'editor. Oggi la versione generata è topologicamente corretta ma
graficamente lontana da quella che lo studio consegna: ogni pratica richiede lo stesso identico
lavoro manuale — spostare valvole, raddrizzare linee, avvicinare i filtri, disegnare i by-pass da
zero.

L'obiettivo è che la **prima** versione rispetti già le convenzioni grafiche dello studio, così
che l'operatore ritocchi le eccezioni invece di ricostruire la regola.

Riferimento: due schemi reali forniti dal committente, uno con by-pass sulla sezione di
trattamento e linea condense parziale, uno senza by-pass. **Vanno salvati in
`DOCUMENTAZIONE/relazione/` prima di cominciare il blocco 4** (nomi proposti:
`riferimento-con-bypass.png`, `riferimento-senza-bypass.png`): sono il metro con cui si giudica
il risultato, e senza di loro il blocco di taratura visiva non ha un termine di paragone.

## Le convenzioni da riprodurre

1. **Mandata compressore.** Dall'ancora alta del compressore sale un tratto **flessibile** fino a
   una valvola di intercettazione posta **un passo di griglia (10) sotto** la dorsale orizzontale;
   dalla valvola in su il tratto è **rigido**.
2. **Dorsale compressori.** Orizzontale rigida, gradino a destra in giù, aggancio all'ancora
   **`sx-basso`** del serbatoio (oggi si usa `sx`, che sta 160 unità più in alto).
3. **Sezione di trattamento adiacente.** L'ancora `dx` di uno stadio coincide con l'ancora `sx`
   del successivo: passo 100, non 170.
4. **Linea di processo dritta.** L'ancora `sx` del primo stadio sta alla stessa quota dell'ancora
   `dx` del serbatoio. *Oggi differiscono di 55 unità: la linea nasce con un gomito che nei due
   riferimenti non c'è, e l'operatore lo raddrizza a mano ogni volta.*
5. **By-pass.** Scavalca un intervallo **contiguo** di stadi. Due giunzioni (TEE) sulla linea di
   processo, una prima del primo stadio scavalcato e una dopo l'ultimo, unite da un arco che sale,
   corre orizzontale e ridiscende. Tre valvole: una sul montante di sinistra un passo sotto
   l'orizzontale, una a metà del tratto orizzontale, una sul montante di destra un passo sotto
   l'orizzontale. Dai montanti verso il basso il tratto è **flessibile**, sopra le valvole è
   **rigido**.
6. **Valvole di riserva.** Una all'uscita del serbatoio **se il primo stadio non è scavalcato**;
   una prima del tratto verso le utenze **se l'ultimo stadio non è scavalcato**. Spariscono le
   valvole d'ufficio a metà di ogni tratto fra stadi.
7. **Linea condense.** Tratteggiata dall'ancora `basso-out` di ciascuna apparecchiatura
   **selezionata dall'operatore**, non più scelta per tipo.
8. **Compattezza in larghezza.** Spazi ridotti allo stretto indispensabile.

## Decisioni del committente

- **Pannello nella finestra SC**: elenco apparecchiature riordinabile per trascinamento, con per
  riga un flag «condense» e l'appartenenza a un gruppo by-pass. I gruppi si creano selezionando
  righe contigue e premendo «Crea by-pass»; si vedono come banda a lato con nome e «Sciogli».
- **Ordine di default dei serbatoi**: per il campo `ubicazione` di scheda — `SALA_COMPRESSORI` in
  testa, `LINEA_DISTRIBUZIONE` dopo la catena di trattamento.
- **Valvole di riserva**: secondo la copertura (convenzione 6).
- **Cambiare ordine o flag non tocca il disegno esistente**: scrive le preferenze e basta.
  L'effetto si vede premendo «Rigenera da capo». Nessun lavoro manuale si perde per sbaglio.

## Architettura

### Le preferenze vivono in `additional_info.schemaPreferenze`

Campo **fratello** di `schemaLayout`, non annidato dentro. Tre ragioni: `schemaLayout` diventa
legittimamente `undefined` quando si carica un disegno AutoCAD o si preme «Rimuovi»
(`layoutDaPersistere`, persistenza.ts:114-123), e le preferenze non c'entrano; `deserializzaLayout`
respinge in blocco un layout di versione ignota (persistenza.ts:86) e si porterebbe via anche
loro; e le preferenze sono un **ingresso** della generazione, nella stessa categoria di
`collegamentiCompressoriSerbatoi`, che è già un fratello.

```ts
interface SchemaPreferenzeBypass { id: string; stadi: string[] }
interface SchemaPreferenze {
  ordineStadi?: string[]
  ordineSerbatoi?: string[]
  condense?: Record<string, boolean>
  bypass?: SchemaPreferenzeBypass[]
}
```

Tutto opzionale: una pratica che non ha mai aperto il pannello genera con i default di sempre.
Una chiave assente in `condense` vale la regola per tipo di oggi (`scaricaCondensa`,
buildSchemaModel.ts:215-218) — è ciò che rende indolore il passaggio da «selezione per tipo» a
«flag per apparecchiatura».

**Trappola confermata, la più grave della specifica.** `additionalInfoSchema` (schema.ts:9-26) è
un `z.object` senza `passthrough`: Zod **scarta le chiavi che non conosce**. E `additionalInfo` in
`RelazioneDataDialog.tsx:161-171` è costruito da un letterale che non fa spread di
`initialAdditionalInfo`. `updateAdditionalInfo` riscrive l'intera colonna. Un campo nuovo che non
sia dichiarato in **entrambi** quei punti verrebbe cancellato alla prima relazione generata:
l'operatore compone i by-pass, genera il documento, riapre e non trova più nulla. Silenzioso e
distruttivo. Il test che lo fissa si scrive nel primo blocco, prima che il pannello esista.

Riconciliazione con le apparecchiature che compaiono o spariscono — funzione pura in
`services/schemaImpianto/preferenze.ts`:

- id sconosciuti: scartati in silenzio (`pruneAdditionalInfo` li racconta già all'utente);
- apparecchiature nuove: in coda a quelle nominate, ma **fra loro nell'ordine di default**, così
  due filtri aggiunti insieme non arrivano invertiti;
- un gruppo by-pass sopravvive solo se i membri superstiti sono **ancora contigui**; altrimenti
  cade tutto e finisce fra i `bypassScartati` da mostrare. Non si aggiusta un gruppo spezzato: un
  by-pass su stadi non contigui non è disegnabile con due soli TEE, e indovinare è peggio che dirlo.

### Le valvole si ancorano alla geometria, non a una frazione

`SchemaSegnoTubo.t` è la frazione della lunghezza della polilinea, e la polilinea non esiste
finché il layout non ha assegnato le posizioni. Ma nessuna delle cinque valvole nuove ha bisogno
di una posizione assoluta: **tutte sono definibili rispetto ai vertici della polilinea**.

| valvola | regola | ancoraggio |
|---|---|---|
| mandata compressore | 10 sotto la dorsale | vertice 1, scarto −10 |
| by-pass, montante sx | 10 sotto l'orizzontale | vertice 1, scarto −10 |
| by-pass, centro | metà del tratto orizzontale | metà del tratto 1 |
| by-pass, montante dx | 10 sotto l'orizzontale | vertice 2, scarto +10 |
| riserva (serbatoio, utenze) | metà del primo tratto | metà del tratto 0 |

```ts
type SchemaAncoraggioSegno =
  | { tipo: 'vertice'; vertice: number; scarto: number }
  | { tipo: 'meta'; tratto: number }
```

**Contratto di sola andata.** `ancoraggio` (sul segno) e `forma: 'ponte'` (sull'arco) sono
istruzioni che viaggiano da `buildSchemaModel` a `layoutSchema` e **non tornano indietro**: il
layout le consuma, scrive `t` numeriche e `punti` assoluti, e le toglie. Conseguenza voluta: **il
formato salvato non cambia di un byte**, e `renderSvg`, `conversioneFlow`, `SchemaEdgeTubazione`,
`useSegniTubo` e la serializzazione non si toccano. È la stessa divisione già in vigore fra
`stileAValle` (dato) e `tronconi` (resa).

*Alternativa scartata: ancoraggio vivo, ririsolto a ogni disegno. Rimetterebbe la valvola al suo
posto ogni volta che l'operatore la trascina.*

Il risolutore geometrico (`tDaAncoraggio`) sta in `tratti.ts`, accanto a `quoteDeiVertici`;
l'applicatore in un modulo nuovo `segniAncorati.ts`, chiamato da `layoutSchema` come ultimo passo.
Nessuna circolarità: `quoteInstradamento` legge nodi, testi e muro, mai gli archi.

### Il by-pass

Modulo nuovo `services/schemaImpianto/bypass.ts`, non dentro `buildArchi` — è una trasformazione
di sequenza con invarianti proprie (contiguità, id stabili, un TEE per confine) che merita test
suoi.

Id dei TEE: **`BP1-IN` / `BP1-OUT`**, dove `1` è l'id del gruppo salvato nelle preferenze,
assegnato alla creazione come primo intero libero e mai riusato finché il gruppo vive. Ricavarlo
dagli stadi scavalcati sarebbe instabile: riordinare le righe cambierebbe l'id e il layout salvato
perderebbe il TEE. `BP` non collide con i prefissi di scheda (`S`, `C`, `E`, `F`, `SEP`), con gli
id riservati (`UTENZE`, `T`, `RC`) né col `M-` dei nodi manuali — con un test che lo fissa, così
il giorno che nasce un prefisso `B` qualcuno se ne accorge.

Origine dei TEE: **`'scheda'`**, come il terminale `UTENZE`. Vengono da una decisione registrata e
ricostruibile. `'manuale'` li renderebbe indistruttibili: sciogliere un by-pass lascerebbe due TEE
orfani su ogni disegno riaperto.

**I gomiti del ponte sono obbligatori, non un'ottimizzazione.** Entrambi i capi stanno su una
giunzione, che impone il lato: senza gomiti, `rottaImboccata` piega a `yMedia` (tratti.ts:482-485)
— che coi due TEE alla stessa quota è la loro stessa quota — e `dedup` collassa tutto in una retta
orizzontale sovrapposta alla linea di processo. Il by-pass sparirebbe alla vista pur esistendo nel
modello.

### Il layout

- La linea di processo si dispone **per ancore, non per riquadri**: l'ancora `sx` di ogni elemento
  cade sulla quota della linea, e l'avanzamento è la distanza fra l'ancora `dx` di uno e la `sx`
  del successivo.
- Quota della linea = quota dell'ancora `dx` del serbatoio di testa (convenzione 4). Con almeno un
  by-pass la linea **scende** di una corsia, così il ponte corre sotto l'uscita del serbatoio
  invece di accavallarsi con essa.
- L'ordine della catena si legge **dagli archi del modello**, non ri-derivandolo con
  `ordinaCatenaTrattamento` (layout.ts:205): quella funzione non conosce né le preferenze né i
  TEE, e produrrebbe un ordine diverso da quello che gli archi collegano — cioè un disegno con le
  linee incrociate. Resta come ordine di **default** dentro `buildSchemaModel`.
- **Riparazione collaterale obbligata**: `pozzoCondense` (layout.ts:35-53) riconosce un separatore
  come pozzo solo se *riceve* condensa. Col flag per apparecchiatura l'operatore può spegnerle
  tutte: il separatore non riceverebbe più nulla e il layout lo trascinerebbe dentro la catena di
  trattamento, in disaccordo con gli archi. Diventa: è pozzo se nessun arco d'aria lo tocca.

### Persistenza

`riconcilia` (persistenza.ts:297-419) va corretto in due punti:

- **`archiNuovi` deve prendere gli archi dal layout automatico, non dal modello** (righe 356-364 e
  401). Stessi id, stessa identità, ma con le `t` risolte e i gomiti del ponte: presi dal modello
  entrerebbero nel salvataggio con la valvola a metà tubo e senza ponte.
- **Sciogliere un by-pass spezza la catena.** I due TEE cadono e con loro i tre archi che li
  toccavano, ma l'arco sostitutivo `S1 → E1` non viene ripescato: `archiNuovi` lo prende solo se
  un capo è fra i nodi aggiunti, e nessuno dei due lo è. Serve un'invariante sullo stampo di
  quella già scritta per il terminale (righe 400-403): ogni stadio che il modello collega ha
  almeno un arco d'aria entrante; se dopo la riconciliazione non ne ha, si riprende quello del
  modello. Non «riprendi sempre quelli del modello»: il tracciato a mano resta autorevole.

Poiché cambiare le preferenze non ridisegna nulla, il layout salvato porta un campo opzionale
`preferenzeApplicate` (impronta delle preferenze con cui è stato generato, nessun bump di
`VERSIONE`) che serve solo a dire all'operatore «le preferenze sono cambiate: premi Rigenera da
capo». Non entra in nessun calcolo geometrico.

### Resa nel documento

`righeLista` (renderSvg.ts:215-233) non si tocca: itera `layout.nodi`, che ora arrivano nell'ordine
scelto, e salta già le giunzioni. Il suo commento («l'ordine è quello del flusso dell'aria»)
diventa più vero di prima — con un test che lo fissa. La legenda non cambia: un by-pass introduce
solo altri segni dei tipi già previsti, e la giunzione resta fuori per scelta già documentata.

## I quattro blocchi

Ogni task chiude col gate del modulo: `npx vitest run`, `npx tsc --noEmit`,
`npx eslint src/components/schemaImpianto src/services/schemaImpianto --max-warnings 0` (allargato
ai percorsi toccati quando si esce dal modulo). Nessun test di interfaccia: solo servizi e hook.

### Blocco 1 — Preferenze e pannello

Nessun effetto sul disegno. Si vede solo che le scelte si salvano e si rileggono.

- **T1** Ancoraggi: `SchemaAncoraggioSegno`, campo `ancoraggio?` sul segno, `forma?` sull'arco,
  risolutore `tDaAncoraggio` in `tratti.ts`. Comportamento invariato.
- **T2** Preferenze: tipo, risolutore `preferenze.ts`, potatura in `equipmentCodes.ts`, e i due
  innesti contro Zod (`schema.ts` + `RelazioneDataDialog.tsx`) col **test che protegge dalla
  cancellazione silenziosa**.
- **T8** Pannello `PannelloPreferenzeSchema.tsx` nella finestra SC, con `@dnd-kit` sul modello di
  `admin/FieldSchemaBuilder.tsx`. Tre liste per famiglia (compressori: solo condense; serbatoi:
  ordine + condense; trattamento: ordine + condense + by-pass): la contiguità è definibile solo
  dentro una famiglia, e una lista unica permetterebbe gesti senza significato.

### Blocco 2 — Convenzioni senza by-pass

La geometria del secondo riferimento. È il blocco che dà il grosso del risultato.

- **T3** `catenaDagliArchi` e `pozzoCondense` robusto. Refactor a comportamento invariato.
- **T4a** Layout: linea di processo per ancore, adiacenza degli stadi, allineamento alla quota
  d'uscita del serbatoio, risoluzione dei segni ancorati.
- **T5** `buildSchemaModel`: aggancio `sx-basso`, valvola della mandata con `stileAValle:
  'standard'`, via le valvole d'ufficio fra stadi, valvole di riserva secondo la copertura,
  condense dal flag.

**Qui cambiano due delle tre fixture SVG** (`svgRiferimentoSenzaTesti`, `svgRiferimentoConMuro`).
Vanno rigenerate seguendo la procedura scritta nel loro header — rendere col codice nuovo,
spezzare per riga, **leggere il diff**, annotare in testa perché — e mai per far tornare verde un
test. `svgRiferimentoConTee` costruisce il layout a mano: se cambia, **ci si ferma**, perché vorrebbe
dire aver toccato i simboli o l'instradamento, che questo blocco non deve toccare.

### Blocco 3 — By-pass

- **T4b** Layout: giunzioni, gomiti del ponte, abbassamento della linea di processo, corsie per
  gruppi multipli.
- **T6** `bypass.ts` + `buildSchemaModel`: linearizzazione con TEE, arco ponte con le tre valvole
  ancorate e i loro `stileAValle`.
- **T7** `riconcilia`: archi dal layout automatico, invariante di ricollegamento allo scioglimento,
  `preferenzeApplicate`.

Nessuna fixture deve cambiare in questo blocco: descrivono impianti senza stadi e senza by-pass.
Se cambiano, è un difetto.

### Blocco 4 — Taratura visiva

Le proporzioni non si provano con i test. Si generano gli schemi sulle pratiche vere, si mettono a
fianco dei due riferimenti e si correggono le costanti finché combaciano:

- `GIOCO_FRA_STADI` — **default 0**, come dichiarato dal committente (ancore coincidenti). Da
  guardare: i rombi portano codoli da 10 unità che sporgono fuori dal riquadro
  (symbols/index.ts:630-632), quindi a gioco 0 ciascun codolo sconfina nella punta del vicino.
  Se il disegno lo mostra, il valore giusto è 20 (i codoli si toccano e formano il collegamento).
- `ALTEZZA_BYPASS`, `PASSO_GIUNZIONE`, `PASSO_CORSIA_BYPASS`.
- Compattezza in larghezza: **non** ritoccando `PASSO_ORIZZONTALE`, che è condiviso con
  `calcolaMuro` e muoverebbe tutte e tre le fixture, ma introducendo `PASSO_COMPRESSORI` e
  `PASSO_SERBATOI` separati se serve. L'adiacenza degli stadi da sola porta il passo da 170 a 100.

Questo blocco è separato e ultimo di proposito. Questo modulo ha una storia documentata di test
verdi per la ragione sbagliata, e la prova in pagina ha già trovato due volte difetti che oltre
1300 test non vedevano.

## Rischi

1. **Zod che cancella il campo nuovo.** Silenzioso e distruttivo. Mitigato dal test in T2, scritto
   prima del pannello.
2. **Archi di lunghezza nulla fra stadi adiacenti** (a gioco 0). Nulla schianta — `ondula` salta i
   segmenti nulli, `tSuTratto` e `quoteDeiVertici` hanno la guardia — ma l'arco diventa non
   afferrabile sulla tela. Regola: **l'arco si emette sempre**, anche degenere (è il tessuto che
   ripara il disegno appena l'operatore separa i due nodi), e **non gli si mette mai un segno**.
3. **`sx-basso` non esiste sul serbatoio orizzontale** (symbols/index.ts:1012-1017), e una taratura
   permanente potrebbe toglierlo anche al verticale. La convenzione 2 va scritta come «l'ancora
   bassa se il simbolo ce l'ha, altrimenti `sx`» — perciò `buildSchemaModel` riceve la libreria dei
   simboli, e ne legge l'**esistenza** delle ancore, mai la geometria. Senza, si finisce nel
   ripiego di `posizioneAncora` che attacca il tubo al centro del corpo: sbagliato ma plausibile,
   il peggior tipo di errore.
4. **I due layout in produzione** (ORVED, LOWA R&D) non si devono muovere di un pixel: versione
   invariata, nessun campo nuovo obbligatorio, nessun TEE aggiunto senza preferenze, ancore
   salvate rispettate. Il nuovo aspetto lo vedono solo premendo «Rigenera da capo». Con un test su
   `riconcilia` che parte da un salvataggio in stile pre-modifica.
5. **L'effetto di prima generazione** (SchemaImpiantoSection.tsx:300-335) avrà `preferenze` fra le
   dipendenze, obbligatorio con `exhaustive-deps` a zero warning. Va verificato che la guardia
   `generazioneTentata` regga: un cambio di preferenze non deve **mai** ridisegnare da sé.
6. **`t` di ripiego.** Ogni segno ancorato nasce con `t: 0.5`. Se il risolutore restituisse `null`
   per un difetto di geometria, la valvola comparirebbe a metà tubo: sbagliata ma visibile e
   correggibile a mano. Degradazione voluta, mai un'eccezione.

## Verifica finale

1. Gate verde su tutto il repo.
2. Le tre fixture SVG: due rigenerate con diff letto e annotato, una invariata.
3. In pagina, su una pratica di prova: generare senza preferenze e confrontare col secondo
   riferimento; comporre un by-pass sulla sezione di trattamento, rigenerare e confrontare col
   primo.
4. Sui due layout in produzione: aprire, chiudere senza toccare nulla, verificare che il salvato
   sia **identico byte per byte**.
5. Solo dopo: merge simulato con `git merge-tree` contro `origin/main` aggiornato, poi push.
