# Schema d'impianto DM329 — Blocco 3: la libreria dei simboli diventa tarabile

**Data:** 16-08-2026
**Ramo:** `worktree-blocco3-import-cad`, testa `3cd18cf` (da `origin/main` `c4cd052`, fine Blocco D4)
**Origine:** brainstorming col committente del 16-08-2026, dopo il rilascio del D4

---

## Perché questo blocco esiste

È l'ultimo pezzo dell'editor dello schema, dichiarato fuori perimetro fin dal Blocco D.
I simboli di oggi non sono mai stati rifiniti apposta, perché si sapeva che sarebbero
stati rifatti sui blocchi CAD del committente. E le loro ancore — i punti da cui parte e
a cui arriva una tubazione — stanno in posizioni che nessuno ha mai scelto davvero:
`griglia.ts` porta un'intera funzione, `agganciaQuota`, che esiste solo perché le ancore
non cadono sui multipli di 10 e agganciare i tubi alla sola griglia produce tre scalini
invece di uno. Il suo commento dice già che il giorno in cui le ancore saranno sui punti
giusti diventerà indistinguibile da `allineaAllaGriglia`.

Il blocco chiude quel debito e ne cambia la natura: le ancore smettono di essere numeri
scritti nel codice e diventano **qualcosa che il committente tara da sé**, dall'editor,
guardando un impianto vero.

## Fatti misurati il 16-08-2026, non dedotti

Quattro cose sono state verificate prima di progettare, e due contraddicono ciò che si
credeva.

**`Blocchi.pdf` non è un mucchio di 304 tracciati da classificare.** È una tavola di
legenda su una pagina sola, con **19 voci già etichettate**: compressore (semplice e con
disoleatore + valvola di sicurezza), serbatoio verticale e orizzontale, essiccatore
(anche con scambiatore), filtro (anche con recipiente), separatore di condense, tanica
raccolta condense, pacco bombole, riduttore di pressione, valvola di intercettazione,
valvola di scarico, tubazione rigida e flessibile, muro di separazione col varco, freccia
di direzione del flusso, linea condense. I 301 tracciati sono i segmenti che compongono
quelle 19 voci, non 301 simboli. Il file è git-ignored (`DOCUMENTAZIONE/**/*.pdf`): vive
solo nel worktree principale.

**I simboli attuali sono già fedeli a quei blocchi.** Il confronto è stato fatto
generando `scripts/tavola-simboli.ts` e affiancandola alla tavola CAD: sagome dei
serbatoi, rombi di essiccatore/filtro/separatore, pacco bombole e compressore
corrispondono. Le differenze sono di dettaglio, non di forma. **Ciò che è davvero
sbagliato sono le ancore**, non i disegni.

**In banca dati ci sono due soli layout salvati**, su 359 schede: ORVED (15-08 13:24) e
LOWA R&D (15-08 23:19), entrambe prove del committente, **nessuna col muro**. La
preoccupazione «ci sono layout veri da preservare» va ridimensionata: il meccanismo di
riattacco va costruito per il futuro, non per salvare un patrimonio che oggi non esiste.

**Le ancore fuori griglia, coi numeri veri.** Il serbatoio verticale ha i fianchi a
`x=33` e `x=117`, l'attacco alto a `y=40` su `x=75`. Il passo della griglia è 10
(`PASSO_GRIGLIA`). Nessuno di quei tre numeri ci cade sopra.

## Cosa vuole il committente

Dallo screenshot che ha allegato e dalle sue parole:

1. **Le ancore devono essere configurabili da lui** in posizione, tipologia e numero.
2. **Le ancore devono stare sempre sulla griglia.**
3. Siccome devono stare sulla griglia *e* su un punto preciso del disegno, deve poter
   **traslare il blocco e deformarlo** finché i due coincidono. Le sue parole: prima
   avvicinare il blocco agli ancoraggi col trascinamento, poi deformarlo «per lo stretto
   indispensabile».
4. Le modifiche si chiudono con un dialogo a tre vie: **torna a default / rendi
   permanenti / usa solo questa volta**.
5. L'aspetto resta fedele ai blocchi originari.

Sul serbatoio verticale ha indicato **cinque ancore**: quattro sui fianchi, alle due
quote dove le calotte incontrano il cilindro (sinistra e destra, alto e basso), più una
in basso al centro sulla valvola di scarico. Oggi ce ne sono quattro, in posti diversi.

## Perimetro

**Dentro:** i tre strati della libreria e la loro risoluzione; la trasformazione
(traslazione + scala) applicata al disegno e all'ingombro; le ancore di fabbrica portate
sulla griglia su tutti i simboli; la tabella di persistenza e il riattacco dei tubi
quando un'ancora sparisce; il modo taratura nell'editor col dialogo a tre vie; il
ridisegno fedele dei segni che non hanno ancore.

**Fuori:** l'import automatico dei tracciati dal PDF (valutato e scartato, vedi sotto);
qualunque modifica al motore `.docx`, che riceve lo stesso `SchemaImpianto` di oggi; le
sei code aperte elencate in fondo, che restano tali; qualunque push su `main` senza il
via del committente.

## Le decisioni prese col committente, e perché

### Ridisegno a mano misurando sul PDF, non import dei tracciati

Valutato l'import automatico con PyMuPDF, che è tecnicamente disponibile e funziona.
Scartato per una ragione che non è il costo: **questi simboli non sono disegni fissi.**
Sono composizioni che cambiano col dato — la valvola di sicurezza c'è o non c'è, il
disoleatore si aggiunge al compressore, il recipiente al filtro, l'etichetta e il codice
arrivano dalla scheda, il serbatoio ha due orientamenti, il terminale utenze porta una
scritta che va a capo. Un path importato reggerebbe la sagoma e perderebbe tutte le parti
che si accendono e si spengono.

Il PDF resta il riferimento su cui misurare, e `scripts/tavola-simboli.ts` — che esiste
già — è lo strumento con cui si verifica simbolo per simbolo.

### Le ancore non si scalano

È il meccanismo che fa funzionare il gesto chiesto al punto 3. La sagoma vive in
coordinate sue e viene traslata e scalata; **le ancore si dichiarano già nel sistema
finale**, sui multipli di 10, e non subiscono la trasformazione. Il committente sposta il
blocco finché il punto che gli interessa arriva sotto il pallino, che sta fermo.

Se le ancore seguissero la trasformazione, il trascinamento non servirebbe a nulla: si
sposterebbe tutto insieme e i pallini resterebbero disallineati dalla griglia esattamente
come prima.

Coi numeri del serbatoio: i fianchi stanno a 33 e 117, le ancore vicine sulla griglia
sono 30 e 120. Trascinando di 3 a sinistra il fianco sinistro cade su 30, il destro
finisce a 114 — ancora fuori. L'interasse fra i fianchi è 84 e deve diventare 90: si
allarga di quel 7% e basta. **Prima si avvicina traslando, poi si deforma dello stretto
necessario.**

### L'ingombro diventa derivato, non dichiarato

Oggi `DIMENSIONI` dichiara un rettangolo per tipo e `dimensioniDi` lo restituisce. Con
una sagoma che si trasla dentro il proprio sistema e ancore che possono stare fuori dal
disegno (quella della valvola di sicurezza sta sopra il serbatoio), il rettangolo va
**calcolato**: è l'inviluppo della sagoma trasformata e delle sue ancore.

Non è un dettaglio grafico. Da quell'ingombro dipendono l'area cliccabile sulla tela,
l'inviluppo del disegno e la cornice del documento: è la ragione per cui questo blocco
non tocca solo l'aspetto, e per cui il banco di confronto va montato dove va montato
(sotto).

### Con scala non uniforme le scritte si contro-scalano

Slegando scala orizzontale e verticale i cerchi diventano ellissi — il compressore ne ha
uno — e le scritte si deformano. Le scritte vengono **contro-scalate** e restano tonde:
un'etichetta stirata è illeggibile e non è mai ciò che si vuole. Le sagome no: la
deformazione lì è visibile ed è una scelta consapevole di chi tara.

### Portata: per tipo di simbolo

Una taratura vale per **tutti i simboli di quel tipo**: taro un serbatoio verticale e
nella pratica cambiano tutti. È la lettura coerente col concetto di libreria, e rende
«rendi permanenti» semplicemente lo stesso cambiamento esteso a tutte le pratiche.
Scartata la deroga sul singolo pezzo: sarebbe una seconda strada da costruire, spiegare e
tenere allineata al salvataggio, per un bisogno che non è emerso.

### Le pratiche salvate si ridisegnano con la libreria nuova

Deciso dal committente fra tre opzioni. Riaprendo una pratica vecchia i simboli sono
quelli nuovi, le apparecchiature restano dove sono, i tubi si riattaccano alle ancore per
nome.

Il prezzo, accettato: un documento già consegnato, se rigenerato, esce diverso da quello
consegnato. Scartato il congelamento per pratica, che avrebbe garantito la ristampa
identica al prezzo di far convivere più versioni della libreria in banca dati e di non
far mai arrivare i miglioramenti alle pratiche vecchie.

### Chi può rendere permanente

**Solo l'amministratore**, perché tocca ogni pratica dell'applicazione, comprese quelle
già consegnate. «Usa solo questa volta» resta a chiunque disegni. Confermato dal
committente.

## Architettura

### I tre strati, e la loro risoluzione

```
default di fabbrica (codice, REGISTRO_SIMBOLI)
      ↓  sovrascritto da
taratura permanente (tabella, per chiave simbolo)
      ↓  sovrascritta da
taratura di questa pratica (dentro il layout salvato)
```

Ogni strato porta gli stessi tre dati: **traslazione e scala della sagoma**, ed **elenco
delle ancore** (id, x, y, cosa accetta). Uno strato **sostituisce** il precedente per
intero invece di sommarvisi per campi: le tre grandezze sono interdipendenti — spostare
la sagoma senza spostare le ancore cambia il significato di entrambe — e una fusione per
campi produrrebbe stati che nessuno ha mai visto sullo schermo. «Torna a default»
cancella lo strato, non ne scrive uno uguale al codice.

### Dove si inserisce la risoluzione

Il registro ha già sei porte — `definizioneDi`, `ancoreDi`, `ancoraDi`, `latoImposto`,
`presaDi`, `dimensioniDi` — lette da **dodici file di produzione** (più i test): la tela
dell'editor e i suoi gesti, il layout, l'instradamento, la riconciliazione del salvataggio,
il render SVG e la rasterizzazione per il `.docx`. Sono funzioni pure che ricevono un nodo.

La libreria risolta viene passata **come parametro esplicito** a quelle porte, non tenuta
in un modulo con stato. Un registro globale mutabile costerebbe meno diff e tradirebbe la
disciplina che questo modulo si è dato: con una taratura di pratica, lo stato globale
renderebbe il disegno dipendente da quale pratica è stata aperta per ultima, ed è
esattamente la classe di difetto che il modulo ha già pagato due volte (`posizioneAncora`
come fonte unica, il muro letto con due nomi diversi).

### La persistenza

Tabella nuova, una riga per chiave simbolo (`compressore`, `serbatoio:VERTICALE`, …), col
corpo della taratura in JSONB, più chi l'ha scritta e quando. Lettura a chiunque, scrittura
al solo amministratore, via RLS.

La taratura di pratica vive dentro `additional_info.schemaLayout`, accanto a `nodi`,
`archi`, `testi` e `muroX`. **Non alza `VERSIONE`**: alzarla butterebbe via il layout
salvato di ogni pratica, per la stessa ragione già decisa per `muroX`.

### Il riattacco quando un'ancora sparisce

Togliendo un'ancora, un layout salvato può citarne una che non esiste più: gli id delle
ancore entrano negli archi salvati. Il tubo si riattacca **all'ancora compatibile più
vicina** — compatibile nel senso di `accetta` — invece di sparire. Se non ce n'è nessuna
compatibile, l'arco resta senza capo e la riconciliazione lo tratta come già fa oggi coi
riferimenti che non risolvono.

## L'ordine dei lavori

1. **Il modello a tre strati e la sua risoluzione.** Dati puri, nessuna interfaccia:
   tipi, sovrascrittura, «torna a default». Provabile per intero senza montare niente.
2. **La trasformazione applicata al disegno e all'ingombro.** Sagoma traslata e scalata,
   ancore in coordinate finali, scritte contro-scalate, `dimensioniDi` che calcola
   l'inviluppo invece di leggere una tabella.
3. **Le ancore di fabbrica sui simboli veri.** Portate sulla griglia, misurando sul PDF;
   sul serbatoio verticale le cinque dello screenshot. Sono il punto di partenza, non la
   parola definitiva: le posizioni finali le farà il committente col modo taratura.
4. **La tabella, la persistenza e il riattacco.** Migrazione, RLS, lettura all'apertura,
   scrittura riservata all'amministratore.
5. **Il modo taratura nell'editor.** Interruttore in barra, pallini trascinabili solo
   sulla griglia, aggiunta e rimozione di ancore, scelta di cosa accettano, maniglie per
   traslare e deformare, dialogo a tre vie all'uscita.
6. **Il ridisegno fedele dei segni senza ancore:** valvola di intercettazione, valvola di
   scarico, riduttore, freccia di flusso, muro col varco, tratteggi. Entrano nella
   fedeltà al CAD ma non nel modo taratura.

## Come si verifica

**Il banco di confronto va inforcato al primo stadio che il blocco tocca**, che qui sono
i simboli: ogni lato ricostruisce la catena intera, da scheda a documento
(`buildSchemaModel` → `layoutSchema` → `renderSvg`), non due `renderSvg` sullo stesso
oggetto layout. La taratura cambia gli ingombri, quindi cambia il layout: un banco montato
a valle misurerebbe zero differenze proprio sul cambiamento più pervasivo, che è
esattamente ciò che è successo nel D4. **Il banco va provato discriminante prima di
fidarsene, e zero differenze dove ne erano attese è la prima cosa da sospettare.**

**I riferimenti SVG cambieranno tutti.** Ognuno va **letto** prima di essere riscritto:
un riferimento non si aggiorna per far tornare verde un test, è ciò che la sua stessa
intestazione vieta. La differenza attesa qui è nota — ancore spostate, sagome traslate —
e ogni scostamento che non rientri in quella descrizione è un difetto, non un
aggiornamento.

**Ogni test nuovo va visto cadere per mutazione**, e va messo sulla porta più esterna che
la produzione usa: è nel passaggio fra la funzione interna e la porta vera che i nomi dei
campi divergono, ed è così che il difetto peggiore del D4 è passato inosservato per dieci
revisioni. Le mutazioni si ripristinano da una copia del file, mai con `git checkout`.

**La prova in pagina** si fa sulle due pratiche che hanno un layout salvato (ORVED e
LOWA): sono l'unico caso reale di riapertura con simboli cambiati.

## Rischi

**Il più grosso: la firma delle sei porte cambia in dodici file.** È un diff ampio e
meccanico, dove è facile che un chiamante resti indietro passando la libreria sbagliata —
e TypeScript non lo direbbe, perché il tipo è lo stesso. Mitigazione: la libreria risolta
si costruisce in un punto solo per ciascuna delle due catene (editor e documento), e il
test sta sulla porta esterna.

**Il secondo: il modo taratura è un secondo modo dentro un editor che ne ha già uno.**
Selezione, cronologia, Canc e Ctrl+Z si comportano diversamente nei due modi. Mitigazione:
la taratura ha una propria cronologia, e l'uscita passa sempre dal dialogo a tre vie —
non esiste uscita implicita che lasci lo stato a metà.

## Code aperte, non chiuse qui

Restano tali, e vanno portate al committente come questione a sé:

- Un'apparecchiatura trascinata sopra quota zero resta tagliata nel `.docx`.
- Ctrl+Z dopo un Canc su un nodo con tubazioni riporta il nodo ma non le tubazioni.
- Un TEE innestato su un tubo fuori griglia si stacca alla prima spinta del mouse.
- Un TEE su una linea condense produce archi condensa su ancore che accettano solo aria.
- Le due metà di un tubo spezzato nascono con gomiti espliciti e non seguono più il
  riassestamento automatico delle quote.
- Spazi multipli in un'annotazione vengono collassati dall'SVG; «Rigenera da capo» butta
  via anche le annotazioni.

Le prime due sono difetti veri; le altre scelte da confermare. Nessuna è introdotta da
questo blocco, e la terza — il TEE fuori griglia — potrebbe risolversi da sé quando le
ancore saranno tutte sulla griglia.
