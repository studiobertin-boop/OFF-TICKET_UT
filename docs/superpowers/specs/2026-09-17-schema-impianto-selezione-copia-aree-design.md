# Selezione multipla, copia-incolla e aree nell'editor dello schema d'impianto

**Data:** 17-09-2026
**Stato:** progettato, da implementare

## Il problema

L'editor dello schema d'impianto DM329 (`components/schemaImpianto/SchemaEditor.tsx`) ha tre
limiti che rallentano il lavoro manuale sul disegno:

1. **La selezione a riquadro è a metà.** React Flow offre già Shift + trascinamento sullo sfondo,
   ma prende solo i suoi oggetti (apparecchiature, TEE, utenze, tubi). Testi liberi e muro vivono
   in una selezione propria (`selezioneLibera`) che tiene **un solo** oggetto; le frecce di
   direzione sui tubi non si selezionano affatto — si trascinano e basta. Non c'è modo di
   spostare o cancellare insieme un gruppo misto.
2. **Non esiste copia-incolla.** Ogni TEE, terminale «alle utenze», freccia o testo va ricreato da
   capo dalla barra.
3. **Non c'è modo di delimitare aree impiantistiche diverse** (sala compressori, reparto, …) se
   non col muro, che è un'altra cosa: una sola linea verticale ricavata dal disegno.

## Cosa si vuole ottenere

- Un riquadro (Shift + trascinamento) che seleziona **anche** testi liberi, frecce sui tubi e aree,
  e un gruppo che si sposta, si cancella e si annulla come un'unità.
- Ctrl+C / Ctrl+V per **«alle utenze», TEE, frecce su tubo, testi liberi e aree**.
- Un **rettangolo tratteggiato ridimensionabile con scritta propria** («area»), presente sulla
  tela e nel .docx, con la scritta che segue il rettangolo ma si può spostare anche da sola.

## Approccio scelto

**Una selezione propria multipla, accanto a quella di React Flow** — non testi e aree trasformati
in nodi di React Flow (romperebbe il principio «un'annotazione non è un nodo», su cui poggiano
persistenza, riconciliazione e `isValidConnection`, e lascerebbe comunque fuori le frecce), né un
riquadro riscritto da zero al posto di quello di React Flow (rifarebbe ciò che la libreria fa già).

## 1. Selezione multipla

### Composizione

La selezione dell'editor è l'unione di due insiemi:

- **React Flow**, invariata: nodi (apparecchiature, TEE, utenze) e archi.
- **Selezione propria**, che da oggetto singolo diventa un elenco di elementi:
  - `{ tipo: 'testo'; id }`
  - `{ tipo: 'freccia'; arco; segno }` — solo segni di tipo `freccia_direzione`
  - `{ tipo: 'area'; id }`
  - `{ tipo: 'muro' }`

### Gesti

| Gesto | Effetto |
|---|---|
| Clic su un oggetto | seleziona solo quello, svuota entrambe le selezioni (come oggi) |
| Ctrl + clic (Cmd su Mac) | aggiunge/toglie l'oggetto; vale anche per testi, frecce, aree e muro |
| Shift + trascinamento sullo sfondo | riquadro: React Flow sceglie i suoi oggetti; il rettangolo del gesto, convertito in coordinate del disegno (`screenToFlowPosition`), raccoglie anche testi, frecce e aree |
| Escape | svuota entrambe le selezioni (come oggi) |
| Clic sullo sfondo | nulla (come oggi) |

**Criterio del riquadro: contenimento pieno**, lo stesso di React Flow per i nodi.
- Testo: il suo ingombro (`ingombroTesto`, layout.ts) sta tutto dentro.
- Freccia: il suo punto sulla polilinea del tubo sta dentro — polilinea ricostruita con le stesse
  `quote`/`capi` che la tela usa per disegnare.
- Area: il rettangolo sta tutto dentro (la scritta non conta).
- Il **muro non entra mai nel riquadro**: ha una logica sua e cancellarlo in blocco sarebbe una
  sorpresa. Resta selezionabile col clic come oggi.

Le frecce diventano cliccabili sul simbolo; il trascinamento lungo il tubo resta com'è.

**Ctrl + clic, non Shift + clic (rettifica del 17-09-2026, in fase di piano).** In React Flow 12
con Shift premuto il `pointerdown` viene catturato dalla tela per avviare il riquadro *anche sopra
un nodo* (`Pane.onPointerDownCapture`, che ferma la propagazione): un Shift + clic su un'apparecchiatura
non arriverebbe mai al nodo. Ctrl + clic è il tasto di selezione multipla predefinito della
libreria su Windows (Cmd su Mac) e non entra in conflitto col riquadro.

### Azioni sulla selezione

- **Trascinamento** di un oggetto selezionato: sposta nodi, testi e aree selezionati dello stesso
  scarto, agganciato alla griglia (passo 10). Le **frecce non si spostano col gruppo**: vivono sul
  tubo (`t`) e lo seguono da sole quando i capi si muovono.
- **Frecce della tastiera**: stesso spostamento di gruppo, passo 10 (×5 con Shift), come oggi.
- **Canc / Backspace**: elimina tutto il selezionato — nodi e archi tramite il flusso React Flow
  esistente, testi/frecce/aree dallo stato dell'editor, il muro solo se selezionato col clic.
- **Una voce di cronologia per gesto**: un Ctrl+Z annulla spostamento o cancellazione dell'intero
  gruppo. Nodi trascinati da React Flow ed elementi propri devono finire nello stesso `applica`.
- **Modo taratura**: tutto spento, come il resto dell'impianto.

### Dove vive il codice

- `services/schemaImpianto/selezione.ts` — funzioni pure: contenimento nel riquadro per testi,
  frecce e aree; spostamento di gruppo; cancellazione di gruppo sullo stato dell'editor.
- `components/schemaImpianto/useSelezioneMultipla.ts` — l'hook React: stato della selezione
  propria, Shift + clic, fine riquadro, tastiera. Sullo schema di `useMuro`/`useTestiLiberi`, per
  non far crescere ancora `SchemaEditor.tsx` (1868 righe).

## 2. Copia-incolla

### Ctrl+C

Dalla selezione combinata si copiano **solo**:

- nodi di tipo `utenze` e `giunzione`;
- testi liberi;
- aree (con scritta e scarto della scritta);
- frecce (`freccia_direzione`).

Tutto il resto è **ignorato in silenzio**: apparecchiature (sono dati di scheda — una copia
darebbe doppioni senza marca né valvole in tabella), tubi, muro. Se non resta nulla da copiare,
l'appunto precedente resta intatto.

**L'appunto** vive in memoria nell'editor (non negli appunti di sistema): sopravvive fra un incolla
e l'altro finché la finestra SC resta aperta; nessuna copia fra pratiche diverse.

### Ctrl+V

- **TEE e utenze**: nodi nuovi, **scollegati**, spostati di 20 unità (2 passi) in basso a destra
  rispetto agli originali; ogni incolla successivo dello stesso appunto aggiunge altri 20, così le
  copie non si impilano. Codici manuali nuovi con `codiceLibero`: prefisso `G` per il TEE (già in
  palette) e prefisso nuovo `U` per le utenze (`M-U1`, …), origine `'manuale'`. Le utenze
  conservano la scritta.
- **Testi e aree**: stesso scarto, id nuovi.
- **Frecce**: sul **tubo selezionato** (React Flow, un solo arco selezionato), a `t = 0.5`; più
  frecce nell'appunto si distribuiscono uniformemente sul tubo (`t = i / (n + 1)`). Senza un tubo
  selezionato le frecce si saltano, il resto si incolla comunque.
- Gli oggetti incollati **diventano la selezione**.
- **Una voce di cronologia** per l'intero incolla.
- In **modo taratura**, o col fuoco in un campo di testo (dialoghi di testo/scritta), Ctrl+C e
  Ctrl+V restano quelli del browser.
- I tubi fra oggetti copiati **non** si copiano (deciso col committente: solo oggetti, scollegati).

### Rischio da chiudere in fase di piano

Un secondo nodo di tipo `utenze` non è mai esistito: il terminale è l'id riservato `ID_UTENZE`
(buildSchemaModel.ts). Prima di scrivere codice va censito ogni punto che distingue il terminale
**per id** invece che per tipo — riconciliazione in `persistenza.ts`, doppio clic in
`SchemaEditor.tsx` (oggi i nodi manuali aprono il dialogo di codice/descrizione, non quello della
scritta), `righeLista`/`righeLegenda`, `bypass.ts`, instradamento — perché una copia non perda la
scritta, non entri in tabella e non sparisca al salvataggio. Se qualcosa non regge, si torna dal
committente prima di procedere.

**Censimento fatto il 17-09-2026, in fase di piano.** Doppio clic (`SchemaEditor.tsx`), righe di
lista e legenda (`renderSvg.ts`), `daAnnunciare` e `posizioneTerminale` (`persistenza.ts`),
`inviluppoVerticale`/`calcolaMuro` (`layout.ts`), il nome del capo sul menu del segno e la
taratura guardano tutti il **tipo**, non l'id: una copia apre il dialogo della scritta, resta fuori
da lista e legenda, e sopravvive alla riconciliazione perché è di origine `'manuale'`. `bypass.ts`
non distingue il terminale. **Un solo punto fragile:** `riconcilia` prende come terminale la
*prima* utenza che trova (`idTerminale`), e con una copia davanti nell'elenco ripara la tubazione
sul nodo sbagliato. Il piano lo restringe ai nodi non manuali, con un test.

### Dove vive il codice

- `services/schemaImpianto/appunti.ts` — funzioni pure `copia(stato, selezione)` e
  `incolla(stato, appunto, arcoBersaglio, ripetizione)` che restituiscono il nuovo stato e la
  nuova selezione.
- Tastiera nell'hook della selezione.

## 3. Aree (rettangolo tratteggiato)

### Dato

```ts
export interface SchemaArea {
  id: string
  /** Angolo in alto a sinistra, in unità del disegno. Mai negativo (vedi «Coordinate negative»). */
  x: number
  y: number
  larghezza: number
  altezza: number
  /** Può essere vuota: allora non si disegna nulla. Può contenere a-capo, come i testi liberi. */
  scritta: string
  /** Posizione del primo capo della scritta rispetto a (x, y). */
  scartoScritta: { dx: number; dy: number }
}
```

- `SchemaLayout.aree?: SchemaArea[]` **opzionale anche in memoria**, letto sempre con `?? []`
  (rettifica in fase di piano: `tsc` controlla anche i test, e otto file costruiscono
  `SchemaLayout` letterali che un campo obbligatorio romperebbe senza alcun guadagno — `renderSvg`
  legge già `testi` con `?? []`). Lo stato dell'editor invece lo porta sempre.
- `LayoutSalvato.aree?` **opzionale su disco**: i layout salvati non ce l'hanno e si leggono senza
  conversione. Nessuna migrazione.
- La riconciliazione (`riconcilia`, persistenza.ts) lo riporta intatto, come i testi.

### Tela

- Pulsante **«Area»** in barra: crea un'area 300×200 con scritta «AREA» accanto al disegno
  (`posaNuoviOggetti.ts`) e la seleziona. Una voce di cronologia.
- **Ordine**: nel documento sotto a tutto il resto. Sulla tela il tratteggio sta nel portale della
  viewport, che React Flow disegna *sopra* i nodi: è una linea sottile senza riempimento e non
  intercetta il puntatore (solo le fasce del bordo lo fanno), quindi l'effetto pratico è lo stesso
  (rettifica in fase di piano).
- **Presa solo sul bordo**, con fascia più larga della linea (stesso principio di `MARGINE_PRESA`
  del muro): i clic all'interno arrivano agli oggetti contenuti e allo sfondo, quindi il riquadro
  Shift + trascinamento può partire da dentro un'area.
- Da selezionata: **quattro maniglie agli angoli** per ridimensionare, agganciate alla griglia,
  minimo 40×40; l'angolo opposto resta fermo.
- **Scritta**: trascinabile da sola (cambia solo `scartoScritta`); segue il rettangolo quando lo si
  sposta; **doppio clic** la modifica nello stesso dialogo dei testi liberi.
- **Coordinate negative**: area e scritta non possono uscire sopra o a sinistra dell'origine — al
  trascinamento e al ridimensionamento si bloccano a 0 (vedi sotto).
- Il tratteggio è disegnato da una funzione di simbolo condivisa (`simboloArea`, symbols), la
  stessa usata da `renderSvg`: tela e documento mostrano la stessa cosa, come per il muro.
  Tratto sottile grigio scuro, tratteggio `8 4`.
- Componente `AreeImpianto.tsx` nel `ViewportPortal`, hook `useAree.ts` per la logica di stato.

### Documento (`renderSvg`)

- Le aree si disegnano **per prime**, subito dopo il fondo bianco e prima del muro.
- Le aree (rettangolo e scritta) entrano nell'**ingombro del foglio** — `estensioneOrizzontale` e
  l'altezza del foglio — così non vengono tagliate.
- **Trappola 1 — instradamento:** `dimensioniLayout` alimenta anche `quoteInstradamento`. Se
  un'area ne allargasse l'altezza, disegnare un rettangolo sposterebbe le rotte dei tubi. Va
  separato l'ingombro del **foglio** (aree incluse) dall'altezza per l'**instradamento** (aree
  escluse).
- **Trappola 2 — coordinate negative:** la viewBox parte da 0 e `renderSvg` taglia in silenzio
  ogni y negativo. Per questo la tela impedisce coordinate negative alle aree; `deserializzaLayout`
  non corregge nulla (un layout non può contenerne, se scritto dall'editor).
- Uno schema **senza aree** deve produrre un SVG **identico byte per byte** a oggi: le fixture SVG
  esistenti non cambiano.

## Test (Vitest, niente test di interfaccia)

- `selezione.ts`: contenimento di testo, freccia (su polilinea con gomiti) e area; muro mai
  raccolto; spostamento di gruppo con griglia; frecce ferme nello spostamento; cancellazione di
  gruppo.
- `appunti.ts`: filtro di ciò che si copia; codici nuovi senza collisioni (anche su incolla
  ripetuti); scarto crescente; frecce distribuite sul tubo bersaglio; frecce saltate senza tubo;
  selezione restituita = oggetti incollati; appunto vuoto non sovrascrive.
- Aree: geometria di ridimensionamento (quattro angoli, minimo, griglia, blocco a 0); andata e
  ritorno in persistenza con e senza `aree`; riconciliazione le conserva.
- `renderSvg`: area presente e disegnata prima del muro; foglio allargato dall'area; quote di
  instradamento identiche con e senza aree; fixture intatte.
- Utenze copiate: non entrano in lista apparecchiature né in legenda; sopravvivono a
  serializza → riconcilia.

## Verifica

Prova in pagina **con mouse vero** (non eventi sintetici: vedi il menu dentro l'elemento che cattura
il puntatore, 17-08-2026): riquadro misto, Shift + clic, trascinamento di gruppo, frecce da
tastiera, Canc, Ctrl+Z, copia-incolla di ciascun tipo (frecce con e senza tubo selezionato), area
creata/ridimensionata/spostata con scritta spostata a parte e rinominata, salvataggio e
riapertura, .docx generato con l'area visibile e i tubi nelle stesse posizioni. Modo taratura:
tutte le nuove scorciatoie spente.

## Fuori perimetro

- Copia di apparecchiature e tubi; Ctrl+X; copia fra pratiche o negli appunti di sistema.
- Aree annidate con semantica (un'area è solo un disegno, non raggruppa logicamente nulla).
- Stili alternativi del tratteggio o del colore.
