# Prompt per la sessione successiva — chiudere le code aperte dell'editor dello schema

Scritto il 17-08-2026, dopo aver pubblicato il cambio di tipo tubazione. Da incollare in una
sessione nuova.

**In `docs/` e non nel workspace di un blocco**: il documento gemello del giro precedente stava in
una cartella git-ignored, ed era l'unica copia. Questo è tracciato in git.

---

Riprendi il lavoro sul sistema DM329, editor dello schema d'impianto. Il committente ha chiesto di
chiudere **tutte** le code aperte del modulo.

## Dove siamo

**È tutto in produzione e verificato.** In ordine, tutto il 17-08-2026:

- **Blocco 3** (merge `21c0c80`): simboli ridisegnati sui blocchi CAD e libreria tarabile a tre
  strati, con modo taratura e dialogo a tre vie all'uscita.
- **Cinque rifiniture** (merge `99de238`): frecce di direzione da posare a mano al posto di quelle
  automatiche, scritta del terminale sopra la punta, oggetti nuovi accanto al disegno, pallino del
  TEE dimezzato, onde del flessibile più larghe.
- **Il cambio di tipo tubazione dentro la valvola** (merge `dd20155`): un clic sulla valvola o sul
  riduttore apre un menu che nomina i due capi del tubo e dice che tipo di tubazione comincia da lì.

Suite a **1266 test su 97 file**, `tsc --noEmit` pulito, `eslint` sul perimetro dello schema fermo
ai **tre warning preesistenti** (react-refresh su `SchemaEditor.tsx` e `SchemaNodeSymbol.tsx`,
exhaustive-deps su `TestiLiberi.tsx`).

Spec e piani di tutto questo stanno in `docs/superpowers/specs/` e `docs/superpowers/plans/`, con
data 2026-08-16 e 2026-08-17. La **stima della sesta richiesta**
(`2026-08-17-valvole-che-spezzano-il-tubo-stima.md`) vale la lettura anche adesso: contiene il
metro di misura del modulo — quanto costò il TEE, misurato sulla storia del repo.

## Le cose da fare

Undici, in tre gruppi. L'ordine consigliato è quello dei numeri: la prima è già decisa e costa
poco, le due dopo sono difetti che si vedono lavorando, la nona è l'unica con un profilo di rischio.

### 1. L'oggetto nuovo si sovrappone al disegno — **decisione già presa**

Dal 17-08-2026 ciò che si aggiunge a mano nasce sul bordo sinistro del disegno, appena sopra la sua
cima (`sopraIlBordoSinistro`, `posaNuoviOggetti.ts`). Quando **sopra non c'è spazio** — il caso
tipico: il disegno comincia a quota 90 e un serbatoio è alto 260 — la posa scende a zero e l'oggetto
finisce addosso a quelli esistenti.

Non si può mandarlo a coordinate negative: `dimensioniLayout` (`layout.ts`) misura il disegno **solo
dal bordo in giù**, e un nodo a ordinata negativa verrebbe tagliato nel documento.

**Il committente ha scelto:** quando sopra non c'è spazio, l'oggetto si posa **a destra di tutto il
disegno**, alla quota della cima. Quando lo spazio c'è, resta come adesso.

Un test c'è già e va esteso: `__tests__/sopraIlBordoSinistro.test.ts`, in particolare il caso «non
manda l'oggetto fuori dalla tela quando il disegno tocca il bordo alto», che oggi si aspetta `y=0`.

### 2. Ctrl+Z dopo un Canc riporta il nodo ma non le tubazioni

Cancellando un'apparecchiatura collegata, react-flow chiama **due** gestori: `onNodesChange` con un
`remove` (che scrive una voce di cronologia, `SchemaEditor.tsx:404`) e `onEdgesChange` con un altro
`remove` (che ne scrive una seconda, `:421`). Ctrl+Z ne annulla una sola.

Le due voci vanno fuse in una. Attenzione: la stessa cronologia serve anche al trascinamento, dove
il **primo** evento del gesto entra in cronologia e gli altri no — c'è un commento lungo che spiega
perché, e va letto prima di toccare (`trascinamentoNodoAvviato`, `:402`). Non rompere quel caso
mentre si sistema questo: il trascinamento ha già avuto un giro di riparazione suo.

### 3. Un'apparecchiatura sopra quota zero resta tagliata nel `.docx`

Nulla vincola un nodo trascinato a restare dentro la pagina, e `dimensioniLayout` misura da zero in
giù: quello che sta sopra sparisce nel documento. Difetto preesistente ai blocchi D.

Due strade, da valutare: vincolare il trascinamento a `y >= 0`, oppure far misurare a
`dimensioniLayout` anche il bordo superiore e traslare il disegno. La prima è più semplice e non
tocca il documento; la seconda è più gentile con chi sta disegnando. **Chiedere al committente.**

### 4. Sui TEE già disegnati manca la punta del verso

Fino al 17-08-2026 la punta sopra il pallino del TEE era la coda del tratto entrante
(`marker-end`), e se n'è andata insieme alle frecce automatiche. Deciso col committente: **si posa a
mano anche lì**. Sui disegni nuovi lo si fa e basta; su quelli già salvati (ORVED e LOWA R&D) la
punta va aggiunta, o quei TEE restano senza indicazione del verso.

Non è codice: è una passata sui due disegni salvati, da fare col committente o avvisandolo.

### 5. Un TEE su una linea condense produce archi incoerenti

Due archi condensa attaccati ad ancore che dichiarano di accettare solo aria: uno stato che
l'editor rifiuterebbe se lo disegnassi a mano (`capoValido`, `agganci.ts`). **Scelta da confermare
col committente** prima di toccare: o le ancore della giunzione accettano anche la condensa, o
l'inserimento del TEE su una linea condense va impedito.

### 6. Le due metà di un tubo spezzato non seguono più le quote automatiche

Nascono con gomiti espliciti (`fissaLaForma`, `inserimentoTee.ts`, che li impone di proposito
perché la forma su cui il committente ha posato il TEE non cambi), e da lì in poi restano fuori dal
riassestamento automatico. **Scelta da confermare**: è il prezzo di quella decisione, non un difetto
accidentale.

### 7. Spazi multipli nelle annotazioni, e «Rigenera da capo»

Gli spazi consecutivi in un'annotazione vengono collassati dall'SVG (`xml:space` non è impostato), e
**«Rigenera da capo» butta via anche le annotazioni** insieme al layout. Due cose piccole e
indipendenti; la seconda può sorprendere chi ha scritto note e ricostruisce il disegno.

### 8. Il TEE su un tubo fuori griglia — **verificare prima di aprire un lavoro**

Si staccava alla prima spinta del mouse. **Potrebbe essersi risolto da sé** col Blocco 3, ora che
tutte le ancore di fabbrica cadono sui multipli di 10. Provalo in pagina prima di scrivere una riga.

### 9. Segnalazione di sicurezza — la più importante delle undici

La policy di UPDATE su `dm329_technical_data` lascia che **qualunque `userdm329`** scriva su **ogni**
pratica, senza controllo di appartenenza: anche di altri, anche già consegnate. Da quando esistono
la libreria dei simboli e i layout salvati, quella stessa porta permette di cambiare il disegno di
una pratica altrui.

Non l'ha introdotta nessuno dei blocchi recenti. Va detta al committente perché **decida se
stringerla**, e la decisione è sua: stringerla potrebbe rompere flussi di lavoro in cui più persone
toccano la stessa pratica.

Le policy vere si leggono da `pg_policy`, non dalle migrazioni nel repo: su questo progetto lo
schema di produzione e le migrazioni divergono.

### 10. «Genera comunque .docx» scrive nel catalogo condiviso

Il pulsante censisce nel catalogo (`equipment_catalog`) i dati della pratica corrente: nel caso di
LOWA avrebbe scritto `giri` per il KAESER SK 26, dato poi ereditato da **ogni pratica futura** sullo
stesso modello. Non è ovvio guardando il pulsante. Da decidere col committente se avvisare o se
smettere di scrivere.

### 11. `descrizione_attivita` di LOWA R&D

Contiene «prova attività ATECOOO», residuo di un incidente vecchio. Verificato ancora presente il
16-08-2026. È una UPDATE sola.

## Come lavorare, e le trappole già pagate

**Sul processo.** Le cose 1, 2, 3, 7 e 11 sono definite: `superpowers:writing-plans` e
`superpowers:subagent-driven-development` bastano. Le 4, 5, 6, 9 e 10 chiedono **prima** una
decisione del committente. La 8 chiede una prova, non un piano.

**Esegui tutti e tre i comandi** prima di chiudere qualunque cosa: `npx vitest run`,
`npx tsc --noEmit`, `npx eslint src/components/schemaImpianto src/services/schemaImpianto
--max-warnings 0`. Il progetto gira il lint con `--max-warnings 0`, quindi un warning nuovo fa
cadere il gate: attenzione a **esportare funzioni da file di componenti**, che fa scattare
`react-refresh` — è già successo, e la funzione è finita in un modulo suo
(`posaNuoviOggetti.ts`, `tipoTratto.ts`).

**Niente `prettier --write`**: il `.prettierrc` non corrisponde allo stile del codice.

**Ogni test nuovo va visto cadere per mutazione**, e va messo sulla porta più esterna che la
produzione usa. Le mutazioni si ripristinano **da una copia** (`cp` prima, `cp` indietro), **mai con
`git checkout`**.

**I tre riferimenti SVG committati** (`services/schemaImpianto/__tests__/fixtures/svgRiferimento*.ts`)
non si aggiornano per far tornare verde un test: prima si legge la differenza, si verifica che sia
quella attesa **e nient'altro**, e il commit dice cosa cambiava. Nell'ultimo lavoro il vincolo era
che **non dovessero muoversi affatto**, ed è stata la prova migliore che il disegno esistente non
era cambiato.

**Le due classi di difetto di questo modulo**, che continuano a presentarsi:

- **I commenti falsi.** Nel Blocco 3 ne furono corretti almeno cinque; nelle rifiniture altri sette
  citavano `marker-end` come se esistesse ancora. La regola che li ferma è **accorciare invece di
  precisare**: un commento che non nomina un file, un indice o una misura non può puntare a quello
  sbagliato. Attenzione ai rimandi incrociati: correggerne uno ne rende falso un altro.
- **I test verdi per la ragione sbagliata.** Nell'ultimo giro: un test sul disegno che passava
  perché il documento porta già altri tubi dritti (andava riscritto come confronto prima/dopo), e
  uno sul layout che usava l'altezza fissa del registro invece di quella vera — tornava solo finché
  l'etichetta stava sotto la soglia di crescita.

**La prova in pagina trova quello che i test non vedono.** Nell'ultimo lavoro ha trovato un menu che
**si apriva ma era inerte**: annidato dentro l'elemento che cattura il puntatore per il
trascinamento, il `pointerdown` sulla voce risaliva l'albero dei componenti React (non il DOM: il
portale non conta) fino al gestore del trascinamento, che si teneva anche il `pointerup`. `tsc`,
1266 test e il lint erano tutti verdi. **Anche un evento sintetico lo mascherava**
(`dispatchEvent(new MouseEvent('click'))` funzionava): solo un clic vero del mouse lo mostrava.

**Sulla pagina.** Dev server: **verifica sempre che giri dal worktree giusto** risalendo al processo
proprietario della porta (`Get-NetTCPConnection -LocalPort <porta> -State Listen`, poi il
`CommandLine` del processo) — **non fidarti del `--port`**: la 5176 è servita dal worktree di un
blocco vecchio, e le prove sarebbero passate mostrando il codice sbagliato. Un dev server avviato in
background da un comando che poi si chiude **muore con lui**. `browser_drag` non è affidabile su
react-flow: usa mosse a più passi (`page.mouse.down()`, `move` ripetuti, `up`). I dialoghi si
impilano: identificali per titolo, mai `.first()` su un selettore largo. Escape chiude l'editor
**scartando** le modifiche.

**Sui dati di produzione.** Si può provare sulle pratiche vere, ma tutto ciò che si scrive va
ripulito e **l'assenza va riverificata con una query diretta**. Credenziali in `.env.local` (usa
`curl`, mai `urllib`, e non stampare mai le chiavi). Le pratiche con un layout salvato devono
restare **due**: ORVED (`a8bbdbe1-f7ad-40d9-86a0-9483b5dcc7f4`) e LOWA R&D
(`c6f56ca5-d57b-408c-a4e5-69a207812b0d`).

**Prima di pubblicare.** `git fetch`, poi **simula il merge con `git merge-tree`**: il diff da solo
inganna, e su questo repo ha già ingannato. **Non si pubblica senza il via esplicito del
committente**: il push su `main` fa partire il deploy da solo. A deploy verificato — verificato sul
bundle in produzione, non solo sullo stato «READY» — aggiorna `DOCUMENTAZIONE/fixes.md`: massimo due
righe, cosa cambia per chi usa l'applicazione e, se è un difetto, cosa succedeva prima. Niente nomi
di funzione, niente numeri di commit.

## Le decisioni prese, da non ridiscutere

- **Le frecce di direzione si posano a mano**, tutte, TEE compreso. Niente più punte d'ufficio.
- **Il cambio di tipo tubazione sta nel segno** (`stileAValle`), e **la rotta non cambia**:
  `instrada` la sceglie una volta dallo stile dell'arco: cambia il tratto disegnato, non il tragitto.
- **Le valvole restano segni**, non diventano nodi: misurato in due blocchi pieni, scartato.
- **Il codolo del terminale utenze sta a metà larghezza**, con l'ancora che lo segue: è ciò che
  permette alla scritta di stargli sopra centrata senza uscire dal riquadro.
- **Le ancore non si scalano** in taratura: la sagoma si deforma sotto pallini fermi sulla griglia.
- **Una taratura vale per tutti i simboli di quel tipo**, e solo l'amministratore la rende
  permanente.
- **Le pratiche salvate si ridisegnano** con la libreria nuova: un documento già consegnato, se
  rigenerato, esce diverso. Prezzo accettato dal committente.
- **Nessun test di interfaccia** per i componenti (`CLAUDE.md`): la logica provabile sta negli hook
  e nei servizi.
