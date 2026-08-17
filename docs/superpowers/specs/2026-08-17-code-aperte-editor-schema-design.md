# Le code aperte dell'editor dello schema d'impianto — specifica

**Data:** 17-08-2026
**Origine:** il committente ha chiesto di chiudere **tutte** le code aperte del modulo, rimaste
dopo il Blocco 3 (`21c0c80`), le cinque rifiniture (`99de238`) e il cambio di tipo tubazione
dentro la valvola (`dd20155`).

Le due richieste estetiche arrivate insieme a questa — la tabella e il testo dei diametri — stanno
in `2026-08-17-lista-e-diametri-schema-design.md`, perché hanno un vincolo opposto sui riferimenti
SVG. **Qui i tre riferimenti non devono muoversi di una coordinata:** sono la prova che si sono
corretti dei difetti senza cambiare il disegno.

## Le voci che si chiudono senza codice

Tre code si chiudono per decisione del committente, presa il 17-08-2026. Restano scritte qui
perché il prossimo che le incontra sappia che sono state guardate.

**I TEE dei disegni già salvati restano senza punta del verso.** Fino al 17-08-2026 la punta sopra
il pallino era la coda del tratto entrante (`marker-end`) e se n'è andata insieme alle frecce
automatiche. Sui disegni nuovi la si posa a mano come tutte le altre; su ORVED e LOWA R&D **non si
fa la passata**. Chiusa.

**I due tronconi di un tubo spezzato restano fuori dal riassestamento automatico.** Nascono con
gomiti espliciti (`fissaLaForma`, `inserimentoTee.ts`) perché la forma su cui il committente ha
posato il TEE non cambi, e da lì in poi non seguono più le quote automatiche. **È il prezzo di
quella decisione, non un difetto accidentale.** Chiusa.

**La policy di UPDATE su `dm329_technical_data` resta com'è.** Verificata su `pg_policy` il
17-08-2026: `Users can update technical data based on role and sharing` ha come `USING` e come
`WITH CHECK` un controllo di solo ruolo, senza alcun legame fra l'utente e la pratica — qualunque
`userdm329` scrive su ogni pratica, anche di altri, anche già consegnata. Da quando esistono la
libreria dei simboli e i layout salvati, la stessa porta lascia cambiare il disegno di una pratica
altrui. **Il committente ha scelto di lasciarla aperta:** in anagrafica ci sono tre `userdm329` e
due `admin`, persone dello stesso studio che lavorano sulle stesse pratiche, e stringere
romperebbe il lavoro a quattro mani. Rischio noto e accettato, non dimenticato.

## La voce che chiede una prova, non un lavoro

**Il TEE su un tubo fuori griglia** si staccava alla prima spinta del mouse. Potrebbe essersi
risolto da sé col Blocco 3, ora che tutte le ancore di fabbrica cadono sui multipli di 10.
**Va provato in pagina prima di scrivere una riga.** Se il difetto non si riproduce, la voce si
chiude con la prova come esito.

## B1 — L'oggetto nuovo non si posa più addosso al disegno

**Oggi** (`sopraIlBordoSinistro`, `posaNuoviOggetti.ts`): ciò che si aggiunge a mano nasce
incolonnato sul bordo sinistro del disegno e `STACCO_NUOVO_OGGETTO = 160` sopra la sua cima. Ma la
quota è schiacciata da un `Math.max(0, …)`: quando sopra non c'è spazio — il caso tipico, un
disegno che comincia a quota 90 e un serbatoio alto 260 — la posa scende a zero e l'oggetto nasce
addosso a quelli che ci sono già.

**Perché non basta togliere lo schiacciamento:** `dimensioniLayout` misura il disegno solo dal
bordo in giù, e un nodo a ordinata negativa verrebbe tagliato nel documento.

**Voluto, deciso dal committente:** quando sopra **non** c'è spazio, l'oggetto si posa **a destra
di tutto il disegno, alla quota della cima**. Quando lo spazio c'è, non cambia nulla.

**Dipendenza:** serve il bordo destro del disegno, cioè la stessa misura introdotta dall'altra
specifica (voce A2). Questo lavoro la usa, non la duplica.

**Il test c'è già e va esteso:** `__tests__/sopraIlBordoSinistro.test.ts`, in particolare il caso
«non manda l'oggetto fuori dalla tela quando il disegno tocca il bordo alto», che oggi si aspetta
`y = 0` e dovrà aspettarsi la posa a destra.

## B2 — Ctrl+Z dopo un Canc riporta anche le tubazioni

**Oggi:** cancellare un'apparecchiatura collegata fa chiamare a react-flow **due** gestori —
`onNodesChange` con un `remove` e `onEdgesChange` con un altro — e ciascuno scrive una voce di
cronologia (`SchemaEditor.tsx`). Ctrl+Z ne annulla una sola: torna il nodo, non le sue tubazioni.

**Voluto:** un Canc è **un gesto solo** e produce **una voce sola**. Ctrl+Z riporta il nodo con i
suoi collegamenti.

**Come, e cosa non rompere.** La stessa cronologia serve al trascinamento, dove il **primo**
evento del gesto entra in cronologia e gli altri no — c'è un commento lungo a
`trascinamentoNodoAvviato` che spiega perché, e il trascinamento ha già avuto un giro di
riparazione suo. La soluzione segue quel meccanismo invece di riscriverlo: **il primo `remove`
del gesto registra, il secondo no**, con il segnale azzerato a fine giro. Il commento esistente
non si tocca; se ne aggiunge uno fratello per il caso nuovo.

**Il difetto da non introdurre:** un Canc che segue immediatamente un trascinamento, o due Canc
consecutivi, devono restare due voci distinte. Non è la stessa cosa di due eventi dello stesso
gesto.

## B3 — Un'apparecchiatura non si trascina più sopra il bordo

**Oggi:** nulla vincola un nodo trascinato a restare dentro la pagina, e `dimensioniLayout` misura
da zero in giù: ciò che sta sopra quota zero sparisce nel `.docx`. Difetto preesistente ai
blocchi D.

**Voluto:** il trascinamento si ferma a `y = 0`. Muro invisibile.

**Perché questo e non l'altro.** L'alternativa — far misurare a `dimensioniLayout` anche il bordo
superiore e traslare il disegno — è più gentile con chi disegna, ma cambia la geometria di **ogni**
documento generato e farebbe muovere i tre riferimenti SVG, che in questo lavoro devono restare
fermi. Il committente ha scelto il vincolo, riservandosi l'allargamento come lavoro suo se in uso
risultasse scomodo.

## B4 — Gli spazi multipli nelle annotazioni si vedono

**Oggi:** gli spazi consecutivi in un'annotazione vengono collassati, perché `xml:space` non è
impostato sul testo dell'SVG. Chi allinea qualcosa a colpi di spazio non ottiene ciò che vede
mentre scrive.

**Voluto:** gli spazi si conservano. Vale per le annotazioni libere; la scritta del terminale
utenze usa la stessa funzione di composizione e ne beneficia allo stesso modo.

## B5 — «Rigenera da capo» non butta più le annotazioni

**Oggi** (`rigenera`, `SchemaImpiantoSection.tsx`): il pulsante ricostruisce il layout dalla
scheda, scartando il disegno ritoccato — che è il suo scopo. Ma con esso spariscono anche le
annotazioni libere, che non vengono dalla scheda e nessun'altra strada permette di recuperare.

**Voluto:** le annotazioni sopravvivono alla rigenerazione. Il resto del comportamento non cambia:
posizioni, gomiti, segni e taratura si perdono, ed è ciò che il pulsante promette.

**Perché non è un'eccezione arbitraria:** un'annotazione è testo scritto a mano che il sistema non
sa ricostruire da nessuna fonte. Un gomito sì.

## C1 — Il TEE su una linea condense produce uno stato coerente

**Oggi:** inserire un TEE su una linea condense lascia due archi condensa attaccati ad ancore che
dichiarano di accettare **solo aria** — uno stato che l'editor rifiuterebbe se lo si disegnasse a
mano (`capoValido`, `agganci.ts`). Il disegno esce giusto; l'incoerenza è interna.

**Voluto, deciso dal committente:** le ancore della giunzione accettano **entrambi** i tipi.

**Un invariante cade, e va detto.** `agganci.ts` si appoggia oggi alla frase «nessuna ancora che
accetta condensa accetta anche aria», scritta in un commento a `connessioneAmmessa`. Allargare la
giunzione la rende **falsa**. Il commento va corretto insieme al codice — è esattamente la classe
di difetto che questo modulo produce di continuo, e la regola che la ferma è **accorciare invece
di precisare**.

**Il caso di frontiera accettato:** una tubazione tracciata a mano fra due giunzioni di una linea
condense nascerà d'ufficio ad aria, perché `stileIniziale` sceglie `condensa` solo quando l'aria è
esclusa da almeno un capo. Resta cambiabile a mano. Segnalato al committente prima di procedere.

## C2 — La generazione della relazione smette di riscrivere dati condivisi

**Oggi** (`handleGenera`, `RelazioneDataDialog.tsx`): a scaricamento avvenuto la generazione fa due
riporti su dati **condivisi fra tutte le pratiche**, senza dirlo e senza chiedere:

- `riportaGiriACatalogo` scrive in `equipment_catalog` la regolazione dei giri appena dichiarata,
  sulla variante marca/modello del compressore. Serve a non ripetere la domanda alla pratica
  successiva sullo stesso modello — e significa che una risposta data su una pratica **è ereditata
  da ogni pratica futura** su quel modello.
- `riportaDescrizioneInAnagrafica` riscrive la descrizione attività sul **cliente**. È questo
  riporto ad aver messo «prova attività ATECOOO» nell'anagrafica di LOWA R&D SRL.

Il pulsante non lo dice. Cambia solo etichetta — «Genera comunque .docx» invece di «Genera e
scarica .docx» — quando il controllo preliminare ha trovato una segnalazione bloccante, ma i due
riporti avvengono con l'una e con l'altra.

**Voluto:** la generazione produce il documento e basta. Catalogo e anagrafica si aggiornano solo
dove li si modifica esplicitamente.

**Il prezzo, accettato dal committente:** la domanda sui giri tornerà a ogni pratica sullo stesso
modello. Si sentirà subito.

**Da togliere per intero, non da spegnere:** con i due riporti se ne va anche l'avviso d'esito che
li riguardava (`mostraEsitoGenerazione` e le due liste `nonACatalogo`/`ambigui`), che senza di essi
non ha più nulla da dire. Codice morto lasciato in piedi è la premessa del prossimo commento
falso.

## La pulizia dei dati, e il suo ordine

**«prova attività ATECOOO»** — residuo di un incidente vecchio, verificato ancora presente il
17-08-2026 — sta in **due** posti, non uno:

- `customers.descrizione_attivita` del cliente LOWA R&D SRL (`dfee0ea9-8157-4a4d-b668-127d633f5073`);
- `dm329_technical_data.additional_info -> descrizioneAttivita` della sua pratica
  (`68afbc07-d630-4e68-9d64-0a2aaef78b7a`, richiesta `c6f56ca5-d57b-408c-a4e5-69a207812b0d`).

**Vanno svuotati entrambi**, senza metterci un testo inventato al posto di uno sbagliato: chi
riaprirà la pratica scriverà la descrizione vera.

**L'ordine conta.** Prima si toglie il riporto automatico (C2), poi si pulisce: pulendo per prima
l'anagrafica, la prima rigenerazione della relazione ci rimetterebbe la stringa.

**Fuori perimetro, segnalato al committente:** nella stessa colonna ci sono altri quattro valori
dubbi — un indirizzo PEC su EUROGRAFITE, «???» su TESSITURA PUNTO MAGLIA, due clienti di prova.
Non si toccano senza un suo cenno.

## Prove

**I tre riferimenti SVG non si muovono.** Nessuna di queste voci cambia il disegno: B3 vincola un
gesto, B4 aggiunge un attributo che non sposta nulla, C1 allarga un permesso, le altre stanno
fuori dal disegno. Un riferimento che si muove qui è un difetto, non un aggiornamento da
accettare.

**Le due pratiche con layout salvato devono restare due**, ORVED e LOWA R&D: qualunque prova sui
dati veri va ripulita, e l'assenza riverificata con una query diretta.

**La prova in pagina trova quello che i test non vedono.** Vale in particolare per B2 (la
cronologia si prova a mano, non nei test: nessun test d'interfaccia per i componenti) e per la
voce del TEE fuori griglia, che *è* una prova in pagina. Dev server: verificare sempre che giri
dal worktree giusto risalendo al processo proprietario della porta, senza fidarsi del `--port`.

Ogni test nuovo va visto cadere per mutazione, e messo sulla porta più esterna che la produzione
usa. Le mutazioni si ripristinano da una copia, mai con `git checkout`.
