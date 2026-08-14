# Schema d'impianto DM329 — Blocco D: le otto osservazioni del committente

**Data:** 14-08-2026
**Ramo:** `worktree-schema-impianto-dm329`, testa `6578b26` (fine Blocco C2)
**Origine:** otto osservazioni del committente dopo la prova in pagina del Blocco C2

---

## Perché questo blocco esiste

Il Blocco C2 si è chiuso il 13-08-2026 con il committente che aveva provato l'editor
in pagina e detto «nel complesso è ok, ci sono alcune cose da sistemare», senza
elencarle. Il 14-08-2026 le ha elencate: otto osservazioni. Questa specifica le
traduce in lavoro.

Vale la pena registrare il rendimento di quei cinque minuti di prova, perché decide
come si lavora qui: **le otto osservazioni contengono due difetti che nove task,
quattro revisioni e novecentotrentacinque test non avevano visto** — il muro che
esiste solo nell'anteprima e quindi non è né spostabile né cancellabile, e le
polilinee che non si allineano alla griglia perché `snapToGrid` di react-flow vale
solo per il trascinamento delle apparecchiature. È la terza volta di fila che la
prova del committente trova più della revisione.

## Fatti di contesto dichiarati dal committente

- **Non usa ancora l'editor per i propri schemi** (dichiarato il 13-08-2026 e ancora
  vero): non esiste alcun layout salvato da preservare, e **nessuna scelta va
  motivata con la retrocompatibilità**. Un commento che lo facesse affermerebbe il
  falso.
- **Rifarà la libreria dei simboli** importando i propri blocchi CAD
  (`DOCUMENTAZIONE/relazione/Blocchi.pdf`, vettoriale, 304 tracciati). In
  quell'occasione porterà i punti di ancoraggio sulle posizioni giuste. Questa
  specifica ne tiene conto senza dipenderne.

## Perimetro

**Dentro:** le otto osservazioni; tre code lasciate aperte dai blocchi B, C1 e C2 che
diventano rilevanti a causa di queste modifiche; un debito tecnico noto che vive
esattamente nel codice che il Blocco D2 tocca.

**Fuori:** l'import dei blocchi CAD (è il Blocco 3, il pezzo grosso che resta); la
rifinitura dei simboli attuali, che verranno sostituiti; qualunque merge o push su
`main`, che restano vietati finché il committente non li chiede esplicitamente.

---

## Le otto osservazioni e le loro cause vere

| # | Osservazione del committente | Causa trovata nel codice |
|---|---|---|
| 1 | «L'editor è su sfondo nero con blocchi bianchi, vorrei sfondo bianco e linee nere» | La tela di react-flow è **trasparente** (`--xy-background-color-default: transparent`): il nero è il `Paper` del tema scuro sotto. Simboli e tubi sono già neri su bianco. |
| 2 | «La finestra dovrebbe essere ridimensionabile fino a tutto schermo» | `Dialog` con `maxWidth="xl"` e `DialogContent` ad altezza fissa `75vh`, nessuna `PaperProps`. L'anteprima ha `width: '38%'` fisso. |
| 3 | «Le linee flessibili hanno una scritta "flessibile" inutile e ingombrante» | `ETICHETTA` cablata in `SchemaEdgeTubazione.tsx:84-88`, disegnata in `EdgeLabelRenderer` alle righe 362-378. Esiste **solo nell'editor**. |
| 4 | «Il pallino del TEE è troppo grande» | `simboloGiunzione` disegna `r = larghezza/2 = 12` **apposta**, per far toccare al disco le quattro ancore sui bordi del riquadro 24×24 e non lasciare buco fra tubo e giunzione. |
| 5 | «Il TEE non resta agganciato alle linee quando le trascino» | **Non è un difetto di aggancio: è una funzione che manca.** Il committente appoggia il TEE sopra un tubo senza collegarlo davvero; il tubo continua a passargli sotto. Chiarito con lui il 14-08-2026. |
| 6 | «La linea attraversa la valvola invece di interrompersi» | `renderSvg.ts:168` disegna la polilinea **intera**, poi `:172` ci appoggia sopra il simbolo, che è `fill="none"`. Identico nell'editor. |
| 7 | «Le linee faticano a restare rettilinee se le spezzo» | `snapToGrid` di react-flow agisce **solo sul trascinamento dei nodi**. Gomiti, trascinamento del tratto e annotazioni usano le coordinate grezze del puntatore; le frecce da tastiera spostano di 1 unità. |
| 8 | «Il muro è visibile in anteprima e non nell'editor, non posso spostarlo né eliminarlo» | Il muro **non è un oggetto**: `calcolaMuro` lo ricalcola da zero a ogni modifica dalle posizioni correnti, non viene mai salvato, e lo disegna solo `renderSvg`. |

## Decisioni prese col committente il 14-08-2026

Tutte esplicite, nessuna dedotta.

1. **Punto 5** — il TEE si inserisce **trascinandolo sopra un tubo esistente**; al
   rilascio il tubo si spezza in due tratti collegati alla giunzione.
2. **Punto 4** — pallino piccolo con **presa invariata**: si separa dove arriva il
   tubo da dove si afferra il simbolo.
3. **Punto 7** — alla griglia va **tutto ciò che si piazza a mano**. L'instradamento
   automatico e le ancore dei simboli restano come sono, e si sistemano quando il
   committente rifarà la libreria.
4. **Punto 8** — il muro si aggiunge dalla barra, si trascina in orizzontale, si
   cancella; **l'altezza continua ad adattarsi da sola** al disegno.
5. **Punto 6** — interrompe la linea **sia la valvola sia il riduttore**: hanno la
   stessa farfalla, e trattarli diversamente li farebbe sembrare disegnati da due
   mani diverse.
6. **Punto 2** — servono **tutte e tre** le regolazioni: pulsante a tutto schermo,
   ridimensionamento libero, divisorio trascinabile fra tela e anteprima.
7. **Il doppio clic sul tubo continua a creare un gomito.** Il committente ha
   valutato di spostarlo sul TEE e ha preferito non cambiare abitudine.

### Due proposte del committente, valutate insieme

Il committente le ha presentate con la clausola giusta — «da valutare solo se
semplificano il lavoro mantenendo o aumentando la qualità del risultato finale» — ed
è stata applicata alla lettera, con esiti opposti.

**Proposta accolta: sfondo bianco dentro l'oggetto valvola, invece di interrompere la
linea.** È migliore del piano originale per tre ragioni, in ordine di peso:

1. La valvola dell'editor e quella del documento **sono già disegnate dalla stessa
   funzione** — l'editor inietta letteralmente la stessa stringa SVG del documento
   (`SchemaEdgeTubazione.tsx:262-268`). Col rettangolo bianco *dentro* il simbolo, le
   due parti non possono divergere per costruzione, e non serve il banco di prova
   dell'accordo che il piano originale avrebbe richiesto.
2. **Toglie di mezzo il caso brutto.** Il tubo flessibile non è una polilinea: è
   un'onda fatta di curve quadratiche (`ondula`). Interromperla a una lunghezza d'arco
   data è matematica fragile, e i flessibili sono proprio gli archi su cui
   `buildSchemaModel.ts:276` semina la valvola di default. Col rettangolo il problema
   non esiste: l'onda passa sotto e viene coperta.
3. Il costo scende da «una funzione geometrica nuova in `tratti.ts`, i suoi test e un
   banco di accordo tela/documento» a **due righe in due funzioni**, con risultato a
   schermo identico.

Limite reale, da tenere sotto controllo e non da nascondere: il rettangolo bianco
cancella *tutto* ciò che ha sotto, non solo il tubo. Una valvola che capitasse
esattamente sul muro divisorio gli farebbe un buco nel tratteggio. Mitigazione: il
rettangolo si dimensiona **esattamente sull'ingombro del simbolo**, non un'unità di
più. Nota di conforto verificata nel codice: dove un tubo attraversa il muro esiste
già un varco aperto di 44 unità (`renderSvg.ts:174`), quindi nella pratica il caso si
risolve quasi sempre da sé.

**Proposta non accolta: usare i gomiti già esistenti come punti terminali delle linee,
invece dell'oggetto TEE.** Il fatto decisivo è della libreria su cui l'editor è
costruito: **react-flow collega nodi a nodi, e nient'altro.** Non esiste modo di far
partire un arco da un punto che sta su un altro arco. Attaccare una linea a un gomito
richiederebbe un nodo invisibile in quel gomito — cioè l'oggetto TEE che già esiste,
privato del pallino nero che il disegno tecnico vuole e che il committente ha chiesto
di rimpicciolire, non di togliere.

E il costo salirebbe invece di scendere. Oggi un arco dipende **solo dai due nodi che
collega**. Un arco che parte dal gomito di un altro arco dipende da un altro arco: per
sapere dove comincia bisogna prima sapere che forma ha quello sotto, che a sua volta
può dipenderne da un terzo. Servirebbero un ordine di risoluzione e la difesa dai
cicli, in quattro punti — geometria, salvataggio, riconciliazione, editor — e sarebbe
la prima dipendenza arco→arco del modulo.

Della proposta si accoglie però la metà che conta per il committente, il **gesto**:
quello che gli piaceva era «un solo gesto sulla linea e da lì parte la diramazione»,
senza trascinare. Gli è stata offerta la scelta di spostare il doppio clic dal gomito
al TEE, e ha preferito non cambiare abitudine (decisione 7). Resta quindi il
trascinamento, che gli dà lo stesso risultato.

---

## Architettura: i quattro blocchi

L'ordine è per **rischio crescente**, e non è un dettaglio: il documento consegnato al
cliente **non cambia fino al blocco D3**, e cambia su ogni pratica solo nel D4. Chi
esegue può fermarsi alla fine di qualunque blocco con il ramo in uno stato coerente.

**Ogni blocco riceve il proprio piano di lavoro**, come è stato per il C1 e il C2:
questa specifica non si traduce in un piano solo.

| Blocco | Osservazioni | Tocca il documento? |
|---|---|---|
| **D1** — quello che si vede subito | 1, 2, 3 | No |
| **D2** — la griglia | 7 (+ debito tecnico noto) | No |
| **D3** — il TEE | 4, 5 | Sì, solo dove c'è un TEE |
| **D4** — valvole e muro | 6, 8 | **Sì, su ogni pratica** |

---

## Blocco D1 — quello che si vede subito

### D1.1 Tela bianca (osservazione 1)

Non si tocca il tema dell'applicazione. La tela di react-flow diventa **un foglio
bianco dentro la finestra scura**, esattamente com'è già l'anteprima a fianco: un
disegno su un tavolo scuro.

- Fondo bianco esplicito sul contenitore della tela (`SchemaEditor.tsx:733`), che oggi
  lascia trasparire il `Paper` del tema.
- Puntini della griglia (`<Background gap={10} />`) in grigio chiaro: devono guidare
  l'occhio, non competere col disegno.
- Comandi di zoom (`<Controls />`, oggi `#fefefe` su bordo `#eee`) resi visibili su
  fondo bianco.
- **Non si toccano**: il riempimento bianco dei nodi, il tratto nero degli archi, il
  blu `#1976d2` che resta il colore della *selezione*, il magenta delle guide di
  allineamento.

### D1.2 Finestra regolabile (osservazione 2)

Tutte e tre le regolazioni chieste, sul `Dialog` in `SchemaImpiantoSection.tsx:367-382`:

- **A tutto schermo**: pulsante nella barra dell'editor che porta la finestra a
  occupare lo schermo intero e la riporta indietro.
- **Ridimensionamento libero**: angolo in basso a destra trascinabile, con la
  dimensione tenuta nello stato invece che cablata in `maxWidth="xl"` + `75vh`. Il
  gesto si implementa con gli eventi puntatore, come gli altri quattro gesti del
  modulo, e **senza aggiungere dipendenze**.
- **Divisorio tela/anteprima**: al posto del `38%` fisso, un divisorio trascinabile.

Le tre preferenze si ricordano nel browser fra un'apertura e l'altra: riaggiustarle a
ogni apertura è esattamente il tipo di attrito che genera l'osservazione successiva.
Sono preferenze di visualizzazione di una persona sola, non dati della pratica: non
vanno in banca dati.

**Vincolo da rispettare:** `minZoom={0.1}` è basso apposta perché metà finestra è
occupata dall'anteprima (commento in `SchemaEditor.tsx:751-765`). Il divisorio rende
quella proporzione variabile: il commento va riscritto sullo stato vero, e `minZoom`
non va alzato.

### D1.3 Via l'etichetta «flessibile» (osservazione 3)

Si rimuovono la mappa `ETICHETTA` e il blocco `EdgeLabelRenderer` che la disegna.
Nessuna perdita di informazione: nel documento il flessibile si riconosce **dall'onda
e dalla legenda**, e restano entrambe. Se `labelX`/`labelY` non hanno altri
consumatori dopo la rimozione, spariscono con essa.

### Come si verifica il D1

Sono componenti React, e `CLAUDE.md` esclude i test di interfaccia: **la verifica è in
pagina**, dal controller. Nessun test automatico nuovo.

---

## Blocco D2 — la griglia

È il blocco che incide di più sulla qualità finale del disegno, ed è l'unico che
contiene **un'aggiunta non richiesta dal committente**, presentata come tale e da lui
approvata.

### D2.1 Tutto ciò che si piazza a mano va sulla griglia (osservazione 7)

**Misurato in pagina il 14-08-2026, prima di scrivere il piano.** La formulazione
originale di questa sezione — «gomiti, trascinamento del tratto e annotazioni usano le
coordinate grezze del puntatore» — era **sbagliata**, e la misura l'ha smentita. Ecco
i fatti, ognuno provato con un gesto vero sulla pratica di prova:

| Gesto | Comportamento misurato | Da correggere? |
|---|---|---|
| Trascinamento delle apparecchiature | posizione assoluta sulla griglia, via `snapGrid` di react-flow | No |
| Creazione del gomito (doppio clic) | atterra in (730, 250): **sulla griglia** | No |
| Trascinamento del gomito | atterra in (780, 170): **sulla griglia** | No |
| Trascinamento del tratto | **726,5 → 776,5**: si sposta di 50 esatti e resta sul mezzo | **Sì** |
| Trascinamento dell'annotazione | **573,75 → 513,75**: si sposta di 60 esatti e resta sui tre quarti | **Sì** |
| Frecce da tastiera | passo **1**, con Shift **10** | **Sì** |
| Nodo nuovo dalla palette | atterra a y = **585** | **Sì** |
| Annotazione nuova | nasce a y = **573,75** | **Sì** |
| Auto-layout | E1 e F1 a y = **185** | Fuori perimetro: si sistema con la libreria nuova |

**La causa vera non è quella che questa specifica aveva scritto.** Gomiti e nodi
finiscono sulla griglia perché la loro posizione nasce da `screenToFlowPosition`, che
eredita `snapToGrid` dallo store e restituisce quindi una **posizione assoluta**
agganciata. Il trascinamento del tratto e quello dell'annotazione invece calcolano uno
**spostamento** fra due posizioni agganciate, e lo sommano a una posizione di partenza
che agganciata non è: lo spostamento è un multiplo di 10, ma lo scarto iniziale
sopravvive **per sempre**.

Ne segue la formulazione corretta del lavoro: **non si tratta di aggiungere
l'aggancio ai gesti che non ce l'hanno, ma di far agganciare la posizione risultante a
chi oggi aggancia solo il movimento.** È una differenza che cambia il codice da
scrivere, e sarebbe costata un giro di correzione scoprirla dopo.

Le frecce da tastiera passano a **10 unità**, con Shift a 50, e la posizione risultante
va agganciata anch'essa: sotto la griglia non si scende, perché il committente ha
chiesto che il piazzamento sia consentito *solo* sui punti della griglia.

### D2.2 Il secondo magnete: le quote dei capi (aggiunta, approvata)

La sola griglia non basta a dare le linee dritte, e lo screenshot del committente lo
mostra. Le ancore dei simboli stanno fuori griglia già di loro — `y=49`, `x=104`,
`x=33`, `x=117` nel registro — quindi **con il nodo perfettamente agganciato un tubo
parte comunque da una quota che non è multipla di 10**. Un gomito portato sulla
griglia introduce allora uno scalino di 9 unità: esattamente il difetto che
l'osservazione 7 denuncia, e che l'aggancio alla griglia da solo **peggiorerebbe**
invece di risolvere.

**Misurato in pagina, non previsto.** Sulla tubazione `std-3` della pratica di prova
il tracciato è `M 677 260 L 726,5 260 L 726,5 234 L 776 234`: parte da una quota di
260 e arriva a una di **234**, perché le due ancore stanno ad altezze diverse. Creando
un gomito col doppio clic, quello atterra correttamente sulla griglia in (730, 250) —
e il risultato è una linea con **tre scalini invece di uno**. Non è un difetto del
gesto: è che nessun punto della griglia può raccordare 260 con 234.

Rimedio: mentre si trascina un gomito o un tratto, le posizioni buone sono quelle
della griglia **più le quote esatte dei due capi del tubo**, e vince la più vicina
entro il raggio di aggancio.

- Una linea che deve restare dritta resta dritta **adesso**, senza aspettare la
  libreria nuova.
- Tutto il resto sta sulla griglia, come chiesto.
- Quando il committente porterà le ancore sui punti della griglia, i due magneti
  coincideranno e questa aggiunta diventerà invisibile: **non è un debito da
  disfare**.

Il modulo ha già il precedente concettuale nelle guide di allineamento dei nodi
(`useGuideAllineamento`), che risolvono lo stesso problema per le apparecchiature.

### D2.3 Debito tecnico noto, chiuso qui perché è lo stesso codice

La revisione finale del Blocco C2 ha lasciato scritto un debito e ha raccomandato di
chiuderlo **tutto insieme, estraendo prima il pattern comune**, perché correggerlo in
tre punti sparsi senza test di interfaccia rischierebbe più di quanto renda. Il
Blocco D2 mette le mani esattamente su quei tre gesti, quindi è il momento giusto:

- Manca `onPointerCancel` in **tre gesti su quattro** — gomiti, segni sul tubo,
  trascinamento del tratto. Un trascinamento interrotto dal sistema lascia alzato il
  riferimento del gesto e rende **il trascinamento successivo invisibile a Ctrl+Z**.
  Sulle annotazioni è già chiuso, e la sua soluzione è il modello da seguire:
  consegna l'**ultima posizione vista durante il gesto**, non quella dell'evento di
  annullamento, che non è un movimento e porterebbe coordinate qualsiasi.
- La guardia «si è mosso davvero» è in **quattro copie** e il riferimento «primo
  evento del gesto» in **quattro hook**.

L'estrazione del pattern comune va fatta **prima** di aggiungere l'aggancio alla
griglia, non dopo: altrimenti la logica di aggancio nasce anch'essa in quattro copie.

### D2.4 Coda del Blocco C1 che diventa rilevante qui

**Il primo micro-movimento di un trascinamento congela l'intera rotta.** Il primo
evento del gesto ha delta zero, quindi `trascinaTratto` materializza tutta la rotta
automatica in gomiti a mano prima ancora che il tubo si muova; da quell'istante l'arco
non segue più il riassestamento delle quote quando si spostano i nodi.

È plausibile che sia parte di ciò che il committente chiama «le linee faticano a
restare rettilinee se le spezzo». Decisione: **un trascinamento che finisce dov'è
cominciato restituisce il tubo all'instradamento automatico.**

### Come si verifica il D2

L'aggancio e i magneti sono **geometria pura**: funzioni collaudabili con Vitest,
fuori dai componenti. Ogni test nuovo va visto fallire **per mutazione** su
un'implementazione plausibilmente sbagliata — non basta il rosso da «funzione non
definita». La regola non è cerimonia: cinque test che sembravano buoni sono caduti
così nel solo Blocco C2, e nove in due blocchi.

I gesti si verificano in pagina.

---

## Blocco D3 — il TEE

### D3.1 Pallino piccolo, presa invariata (osservazione 4)

Il pallino è grande `r=12` per una ragione precisa: così tocca le quattro ancore poste
sui bordi del riquadro 24×24 e **non lascia buco fra il tubo e la giunzione**.
Rimpicciolirlo e basta riaprirebbe quel buco. E rimpicciolire tutto il riquadro è già
stato provato e scartato nel Blocco C2: a 16×16 gli handle di react-flow coprivano il
72% del nodo e i quattro attacchi finivano a 3 px l'uno dall'altro a zoom tipico,
rendendo un caso la scelta del lato — cioè proprio la capacità richiesta.

**Soluzione: separare dove arriva il tubo da dove si afferra il simbolo.**

- Le quattro ancore della giunzione si spostano **al centro** (12, 12). I tubi
  convergono nel centro del pallino, e il buco non esiste per costruzione, a qualunque
  raggio.
- I quattro **punti di presa** restano dove sono ora, sulle mezzerie dei lati del
  riquadro 24×24: il TEE resta afferrabile e collegabile esattamente come oggi.
- Il pallino scende a **diametro 10**, la stessa dimensione dei punti di ancoraggio
  delle apparecchiature, come chiesto.

Il registro dei simboli acquista quindi la nozione di *punto di presa*, distinta
dall'ancora e con l'ancora come valore predefinito: per ogni altro simbolo non cambia
nulla.

**Perché in questa direzione e non nell'altra.** `posizioneAncora` resta l'unica fonte
di verità su dove sta un capo di tubo, e non viene toccata. Questo modulo ha già pagato
due volte per aver avuto due fonti su «dove sta un capo»: il difetto dei 5 unità di
scarto su ogni capo di ogni tubo, trovato solo misurando in pagina, e la terza
definizione privata di `posizioneAncora` dentro `useGomiti`. La nozione nuova vive
**solo nell'interfaccia**, dove un errore si vede subito, e non nella geometria, dove
finisce nel documento.

Nota per chi implementa: con quattro ancore coincidenti, la funzione che deduce il
lato di react-flow dalla posizione dell'ancora diventa degenere. Il lato va reso
**esplicito** nella definizione dell'ancora, non dedotto.

### D3.2 Inserire il TEE su un tubo esistente (osservazione 5)

Il gesto deciso: si aggiunge il TEE dalla barra come oggi, poi lo si **trascina sopra
un tubo**. Mentre ci passa sopra, il tubo si evidenzia; al rilascio si spezza in due
tratti collegati alla giunzione.

Regole di conservazione, perché lo spezzamento non deve perdere lavoro fatto a mano:

- Lo **stile** del tubo (rigida / flessibile / condense) si conserva su entrambe le
  metà.
- **Valvole, riduttori e gomiti a mano** vanno alla metà su cui cadono
  geometricamente.
- L'intera operazione è **un solo passo di Ctrl+Z**.

Sotto ci sono due funzioni pure e collaudabili — *qual è l'arco più vicino a questo
punto, entro una tolleranza* e *spezza questo arco in questo punto* — più il gesto,
che si verifica in pagina. La scelta di quale delle quattro ancore usare per ciascuna
metà è **cosmetica**, perché ora sono tutte al centro: non va complicata.

Trappole già pagate, da non ripagare: `addEdge` di react-flow **scarta i duplicati**;
`onlyRenderVisibleElements` toglie dal DOM i nodi fuori vista; il layer del portale
vince sempre il clic sul tubo sottostante.

### Effetto sul documento

Il pallino del TEE rimpicciolisce e i tubi arrivano al suo centro. **Sulle pratiche
senza TEE non cambia nulla**, e va dimostrato, non asserito: è precisamente ciò che il
confronto SVG sugli impianti di riferimento deve mostrare, con la sola differenza
attesa sull'impianto che il TEE ce l'ha.

Il riferimento committato va quindi ri-basato **già in questo blocco**, limitatamente
al TEE, con la stessa disciplina descritta per il D4: prima si legge la differenza, poi
la si accetta.

---

## Blocco D4 — valvole e muro

I due cambiamenti che toccano ogni pratica. Vanno insieme perché condividono la stessa
verifica: un unico ri-basamento del riferimento SVG, letto differenza per differenza.

### D4.1 La linea si interrompe sulla valvola (osservazione 6)

Nella forma proposta dal committente e adottata: **un rettangolo bianco dentro il
simbolo**, disegnato prima dei tratti, dimensionato esattamente sull'ingombro del
simbolo e orientato con esso. Vale per la valvola di intercettazione e per il
riduttore di pressione.

Ricade automaticamente sull'editor senza una riga di codice in più, perché l'editor
inietta la stessa stringa SVG del documento. È il pregio principale della soluzione, e
va **verificato**, non dato per scontato.

### D4.2 Il muro diventa un oggetto (osservazione 8)

Oggi il muro è **derivato**: `calcolaMuro` lo ricostruisce da zero a ogni modifica
dalle posizioni correnti dei nodi, non viene mai salvato, e compare solo nell'SVG.
Diventa una cosa del committente:

- **Non c'è di default.** `calcolaMuro` smette di essere invocata dall'auto-layout e
  dalla conversione dell'editor.
- Si aggiunge dalla barra, si trascina **in orizzontale** sulla griglia, si cancella
  col tasto Canc, si salva con lo schema.
- **Si vede nell'editor**: è metà dell'osservazione. Si disegna nel portale della
  tela, con lo stesso precedente delle annotazioni libere.
- **L'altezza continua ad adattarsi al disegno**, come deciso col committente. Ne
  segue che del muro si salva la sola ascissa, e l'estensione verticale si ricava al
  disegno: se si salvasse anche l'altezza, sarebbe una seconda fonte di verità
  destinata a divergere.
- I **varchi** continuano ad aprirsi da soli dove i tubi attraversano il muro, con la
  stessa funzione usata dal documento — non con una copia.

**Conseguenza da dichiarare in consegna, la più visibile di tutto il blocco: ogni
pratica smette di avere il muro finché il committente non lo aggiunge.** È ciò che ha
chiesto («di default non va disegnato, lo aggiungo solo se serve»), e va detto e non
scoperto.

Questo chiude anche la **domanda aperta #1 del Blocco C2**: `calcolaMuro` escludeva il
terminale utenze perché «è un raccordo» ma non la giunzione, che è un raccordo allo
stesso titolo, e un solo TEE in linea faceva comparire un muro che il disegno di
riferimento non ha. Con il muro manuale la domanda si dissolve.

### D4.3 Coda del Blocco C1 che si chiude qui

Il tratteggio delle linee condense è **diverso fra tela e documento** (`'8 6'` in
`SchemaEdgeTubazione.tsx`, `'10 7'` in `renderSvg.ts`). Finché la tela era nera la
differenza non si notava; su fondo bianco il confronto diventa immediato. Decisione:
**vince il documento** (`'10 7'`), perché è quello che si consegna al cliente.

### D4.4 Coda del Blocco C2 che si chiude qui

Il tasto Canc non cancella le annotazioni libere — si eliminano solo dal loro dialogo,
perché non sono nodi di react-flow. Dato che in questo blocco il muro si cancella col
Canc, l'incoerenza diventerebbe stridente: **si allineano**.

### Come si verifica il D4

Qui il documento **cambia di proposito**, quindi la protezione abituale — rendere
l'SVG prima e dopo e confrontare le stringhe — va usata al contrario.

Prima però va distinto ciò che il repo ha davvero da ciò che si costruisce a mano,
perché la differenza qui è decisiva:

- **Il riferimento committato** nel test di invarianza copre **un solo impianto**, ed è
  spezzato in un array di quaranta righe, una per figlio diretto dell'SVG, *proprio
  perché un giorno come questo arrivasse con un diff leggibile*: fu ricostruito così nel
  Blocco C2 dopo che un revisore fece notare che un template da 8300 caratteri su una
  riga sola avrebbe fatto aggiornare il pin a occhi chiusi.
- **Quel riferimento non intercetta il muro né le condense**, ed è annotato nella
  fixture stessa. Il cambiamento più pervasivo di questo blocco — la scomparsa del muro
  da ogni pratica — **passerebbe inosservato affidandosi al solo pin.**
- Il confronto su **otto impianti** è invece un banco che si monta per l'occasione,
  come fatto due volte nel C2: modulo estratto al commit precedente, i due render
  affiancati, stringhe confrontate.

Procedura:

1. Montare il banco sugli otto impianti e **provare prima che discrimini** — una
   modifica finta che deve far arrossare tutti e otto. Un banco che non si è visto
   fallire non prova nulla, esattamente come un test.
2. Rendere prima e dopo, e **leggere le differenze una per una**, non accettarle in
   blocco. Le attese sono due: il rettangolo bianco per ogni valvola e riduttore, e la
   scomparsa del muro.
3. Ogni differenza non spiegata da quelle due è un difetto, e va inseguita fino alla
   causa.
4. Solo allora si ri-basa il riferimento committato.
5. **Estendere la copertura del pin al muro**, o annotare esplicitamente che resta
   scoperto: se il muro esce dal disegno senza che nulla se ne accorga, il prossimo
   blocco lavora senza rete su un elemento appena diventato modificabile a mano.

---

## Rischi e come sono affrontati

| Rischio | Perché è concreto | Come si affronta |
|---|---|---|
| Un test verde che non prova nulla | **Nove casi in due blocchi**: è il difetto ricorrente del modulo | Ogni test nuovo va visto cadere per **mutazione** su un'implementazione plausibilmente sbagliata. Preteso dagli implementatori e dai revisori. |
| Il documento cambia più del voluto | Il D4 tocca ogni pratica | Confronto SVG sugli otto impianti, differenze lette **una per una** prima di ri-basare il riferimento |
| Un commento che afferma il falso | **Sedici rilievi in due blocchi** | Ogni commento toccato descrive il repo **a fine task**, mai come sarà |
| Assumere invece di misurare | Nel C2 un report ha dichiarato che le annotazioni non si agganciavano alla griglia, mentre lo facevano già | Il D2 comincia **misurando in pagina** quali gesti già si agganciano |
| Il D2 nasce in quattro copie | La guardia del gesto è già in quattro copie | Il pattern comune si estrae **prima** di aggiungere l'aggancio |
| Scrivere sulla pratica di produzione | È già successo: un selettore troppo largo ha scritto nel campo ATECO di una pratica vera | Dialoghi impilati: mai `.first()` su un selettore largo. Chiusura con «Annulla modifiche» + «Annulla», mai «Genera comunque .docx», verifica in banca dati prima e dopo |

## Criteri di accettazione

Il blocco è finito quando, **verificato in pagina dal committente**:

1. La tela è un foglio bianco con tubi e simboli neri.
2. La finestra si porta a tutto schermo, si ridimensiona a piacere, e il divisorio fra
   tela e anteprima si sposta; le tre scelte sopravvivono alla chiusura.
3. La scritta «flessibile» non c'è più.
4. Il pallino del TEE ha la dimensione di un punto di ancoraggio e **non lascia buco**
   dove arrivano i tubi.
5. Trascinando un TEE sopra un tubo, il tubo si spezza e si collega; un Ctrl+Z annulla
   tutto in un passo.
6. La linea si interrompe su valvole e riduttori, **identicamente** in editor e
   documento.
7. Gomiti, tratti, annotazioni e frecce da tastiera stanno **solo sui punti della
   griglia**, e una linea che deve restare dritta resta dritta.
8. Il muro non c'è finché non lo si aggiunge; una volta aggiunto si vede nell'editor,
   si sposta, si cancella e si salva.

E, indipendentemente da quanto sopra: suite intera verde, `tsc --noEmit` pulito, e le
differenze nel documento generato tutte spiegate.

## Cosa questo blocco non fa

- **Non rifinisce i simboli attuali**: verranno sostituiti dall'import dei blocchi CAD.
- **Non porta le ancore sulla griglia**: lo farà il committente rifacendo la libreria.
  Il secondo magnete del D2 è ciò che rende il disegno corretto nel frattempo.
- **Non integra su `main`**: nessun merge e nessun push finché il committente non lo
  dice esplicitamente.

## Domande che restano al committente, non decise qui

Sollevate dalle revisioni dei blocchi precedenti, ancora aperte perché nessuna c'entra
con queste otto osservazioni:

- **Spazi multipli in un'annotazione**: sulla tela si vedono rientrati, nel documento
  l'SVG li collassa e la riga si allinea a sinistra. Va bene, o il documento deve
  conservarli?
- **«Rigenera da capo»** butta via anche le annotazioni, insieme a tutto il resto del
  lavoro manuale. Coerente col comportamento esistente, ma vale la pena saperlo.
