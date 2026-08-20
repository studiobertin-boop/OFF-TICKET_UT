# Ordine libero della linea nello schema d'impianto

**Data:** 20-08-2026
**Stato:** progettato, da implementare

## Il problema

Nella finestra SCHEMA IMPIANTO l'ordine delle apparecchiature si può cambiare solo **dentro la
propria famiglia**: il pannello delle preferenze
(`components/relazione/PannelloPreferenzeSchema.tsx`) tiene tre sotto-sezioni separate —
Compressori, Serbatoi, Linea di trattamento — ognuna col proprio `DndContext`, e nessun gesto
può spostare una riga da una sezione all'altra.

Il limite non è solo dell'interfaccia. Tutta la catena a valle assume la stessa sequenza fissa
*compressori → serbatoi → stadi di trattamento → utenze*:

- `buildSchemaModel.buildArchi` collega i compressori ai serbatoi con la mandata flessibile, poi
  parte dal **primo serbatoio** (`serbatoiChiave[0]`) verso il primo stadio, e da lì di stadio in
  stadio fino alle utenze;
- `layout.layoutSchema` dispone i nodi in tre righe distinte, con `rigaSerbatoi` sempre a monte di
  `rigaCatena`;
- `layout.catenaDagliArchi` esclude i serbatoi dalla catena per costruzione (`inLinea` accetta solo
  `essiccatore`, `filtro`, `separatore`, `giunzione`) e parte sempre dal serbatoio di testa.

Negli impianti reali, però, filtri ed essiccatori possono stare **prima** del primo serbatoio, e
con più serbatoi la linea può alternarli agli stadi di trattamento. Oggi quello schema non è
disegnabile: resta solo la correzione a mano nell'editor o l'upload del disegno AutoCAD.

## Cosa si vuole ottenere

Serbatoi e stadi di trattamento (filtri, essiccatori, separatori) diventano **un'unica sequenza
liberamente ordinabile**, in qualsiasi combinazione. I compressori restano una famiglia a parte,
disposti in sala e non riordinabili rispetto alla linea.

Restano possibili i by-pass su una singola apparecchiatura o su un gruppo di apparecchiature
adiacenti, come oggi.

## Decisioni prese

Quattro decisioni del committente vincolano il disegno; sono qui perché il codice a valle non le
può dedurre da solo.

1. **Portata:** serbatoi e stadi in un'unica sequenza libera. I compressori restano fuori.
2. **Serbatoi multipli:** entrano *tutti* nella sequenza, e possono comparire in serie con stadi
   fra loro (`F1 → S1 → E1 → S2 → utenze`). Supera il modello attuale in cui solo il primo
   serbatoio apre la linea e gli altri restano accumulatori paralleli.
3. **By-pass:** conservati su singoli e su gruppi adiacenti. Nella sequenza unificata la
   distinzione fra "stadio" e "serbatoio" perde senso, quindi un by-pass può scavalcare
   qualunque elemento della linea, purché gli elementi scavalcati siano contigui nell'ordine.
4. **Mandata dei compressori:** arriva al **primo elemento della sequenza**, qualunque sia il suo
   tipo. Con un filtro in testa il compressore alimenta il filtro, e la linea prosegue
   `filtro → serbatoio`. È la lettura fisica naturale: un filtro si mette davanti proprio perché
   l'aria ci passi prima di entrare nel serbatoio.

### Ciò che NON cambia

`additional_info.collegamentiCompressoriSerbatoi` conserva il significato che ha oggi — *quale
compressore alimenta quale serbatoio* — perché da lì il motore della relazione ricava la portata
delle valvole di sicurezza dei serbatoi (`services/relazione/engine/valvole.ts`). La decisione 4
cambia solo **dove la mandata viene disegnata**, non il dato di calcolo. I due usi si separano:
il calcolo continua a leggere i collegamenti dichiarati, il disegno legge la sequenza.

Resta invariata anche la promessa fatta al committente: **nessun gesto nel pannello ridisegna
nulla**. Le preferenze si applicano solo premendo «Rigenera da capo», e l'avviso di
`preferenzeDaRiapplicare` continua a segnalare quando il disegno salvato è stato generato con
scelte diverse.

## Architettura

### Modello dati — `SchemaPreferenze`

`ordineSerbatoi` e `ordineStadi` si fondono in un unico `ordineLinea: string[]`, che elenca
serbatoi e stadi nell'ordine in cui vanno disegnati da sinistra a destra. `ordineCompressori`
resta com'è.

**Compatibilità con le pratiche già salvate.** `schemaPreferenze` è dichiarato `z.any()` a Zod e
`services/schemaImpianto/preferenze.ts` è difensivo di proposito: se `ordineLinea` manca si
ricostruisce concatenando `ordineSerbatoi` e `ordineStadi` salvati, nell'ordine
serbatoi-poi-stadi, che è esattamente la sequenza che quelle pratiche hanno oggi. Una pratica
riaperta dopo l'aggiornamento vede quindi lo stesso ordine di prima, e la sua impronta
(`improntaPreferenze`) resta stabile finché non la si tocca — così l'avviso «Rigenera da capo»
non compare da solo su pratiche che nessuno ha modificato.

### `services/schemaImpianto/preferenze.ts`

- `FamiglieSchema` passa da tre campi a due: `compressori` e `linea`.
- `famiglieDaScheda` costruisce l'ordine di **default** della linea: serbatoi in testa (con
  `ubicazione: SALA_COMPRESSORI` per primi, come oggi), poi gli stadi ordinati da
  `ordinaCatenaTrattamento`. Il default riproduce dunque la sequenza di sempre; la libertà è una
  possibilità offerta, non un cambiamento imposto.
- `risolviPreferenze` produce `ordineLinea` al posto di `ordineSerbatoi`/`ordineStadi`, e valuta
  la contiguità dei by-pass contro `ordineLinea`.
- `improntaPreferenze` cambia forma di conseguenza. È voluto che le pratiche il cui `ordineLinea`
  viene ricostruito dai due campi vecchi mantengano un'impronta coerente: va verificato con un
  test che una pratica migrata non produca un avviso spurio.

### `services/schemaImpianto/buildSchemaModel.ts`

`buildArchi` smette di trattare "serbatoio → stadi" come due tronconi distinti:

1. la sequenza della linea si costruisce da `preferenze.ordineLinea` (o dal default), poi passa
   per `linearizzaConBypass` come oggi;
2. la mandata flessibile di ogni compressore punta al **primo elemento della sequenza** invece che
   ai serbatoi dichiarati (decisione 4), con la stessa valvola di intercettazione sul montante
   (convenzione 1) e la stessa `ancoraMandata` — che va generalizzata: oggi cerca `sx-basso` sul
   serbatoio e ripiega su `sx`, e sul rombo di filtro/essiccatore deve trovare `sx`;
3. gli archi di linea collegano gli elementi della sequenza a due a due fino alle utenze, senza
   più distinguere il tipo del nodo di partenza.

`ordinaCatenaTrattamento` resta, ma solo per calcolare l'ordine di **default** proposto la prima
volta: non è più un vincolo del disegno.

### `services/schemaImpianto/bypass.ts` — invariato

`linearizzaConBypass` lavora già su una catena generica di `SchemaNodo` e calcola la contiguità
per **posizione**, non per tipo. Passandogli la sequenza unificata, i by-pass continuano a
funzionare su singoli e gruppi adiacenti e si estendono a qualunque elemento senza modifiche.
È il motivo per cui la decisione 3 costa zero in questo modulo.

### `services/schemaImpianto/layout.ts`

- `catenaDagliArchi`: `inLinea` accetta anche `serbatoio`. Il punto di partenza non può più essere
  «il primo serbatoio», perché la linea può cominciare con un filtro. Questa funzione deduce
  l'ordine dagli **archi** — lavora anche su un layout già ritoccato a mano nell'editor, dove le
  preferenze non arrivano — quindi il criterio va espresso in termini di soli archi: la testa
  della linea è il nodo bersaglio di una mandata di compressore (arco `flessibile` che parte da un
  nodo `compressore`); a parità, o in sua assenza, il nodo di linea che non è bersaglio di nessun
  arco d'aria non-ponte. Da lì si seguono i successori come oggi. A differenza di adesso il nodo
  di partenza **entra** nella catena, perché ora può essere un elemento di linea a tutti gli
  effetti. Il `visto` contro i cicli e gli orfani appesi in coda restano.
- `layoutSchema`: `rigaSerbatoi` e `rigaCatena` si fondono in un'unica riga disposta nell'ordine
  della sequenza, subito a valle della riga dei compressori. Ogni elemento conserva il proprio
  criterio di allineamento — i serbatoi appoggiati sulla quota di base, i rombi centrati sulla
  quota di linea — perché `disponiCatenaPerAncore` allinea per **ancore**, che è già il criterio
  corretto per entrambi.
- `quotaLineaProcesso` oggi ricava la quota della linea dall'uscita dei serbatoi, e con i serbatoi
  dentro la catena nasce una circolarità. Si risolve tenendo la quota ancorata all'uscita del
  **primo serbatoio della sequenza** (e al ripiego attuale quando serbatoi non ce ne sono),
  calcolata prima di disporre la riga.

### `components/relazione/PannelloPreferenzeSchema.tsx`

Le sotto-sezioni "Serbatoi" e "Linea di trattamento" si fondono in una sola, con un solo
`DndContext` esteso a tutte le righe della linea. La sezione "Compressori" resta separata e con
il proprio contesto: mescolare un compressore fra i filtri resta un gesto che il disegno non sa
rendere, e va continuato a impedire.

Le caselle di selezione del by-pass, oggi mostrate solo sulle righe degli stadi (`conBypass`),
compaiono su tutte le righe della linea. Il pulsante «Crea by-pass» conserva le due condizioni
attuali — selezione contigua e nessuna riga già in un gruppo — valutate su `ordineLinea`.

## Casi limite e cosa fare

- **Serbatoio in mezzo alla sequenza.** Riceve l'aria da monte e la manda a valle sulle ancore
  `sx`/`dx`, mentre la mandata del compressore (decisione 4) arriva solo al primo elemento: non
  c'è conflitto di ancore. Va comunque verificato sul banco di confronto SVG che l'ingresso non
  cada sull'ancora dello scarico condense.
- **By-pass che scavalca un serbatoio.** Il ponte corre sulla corsia sopra la linea, e un
  serbatoio è più alto di un rombo: la corsia va calcolata sull'ingombro reale degli elementi
  scavalcati, non su quello degli stadi. Se il ponte finisse sopra la valvola di sicurezza è un
  difetto da correggere in implementazione, non da accettare.
- **Sequenza senza serbatoi.** Già oggi possibile (`quotaLineaProcesso` ha il ripiego): la
  mandata del compressore arriva al primo stadio e nulla si rompe.
- **Preferenze invecchiate.** Un elemento sparito dalla scheda esce da `ordineLinea` per opera di
  `ordinaPerElenco`, che elenca comunque tutte le apparecchiature correnti; un by-pass che perde
  la contiguità cade in `bypassScartati` e viene annunciato, come oggi.

## Verifica

Il progetto non scrive test di interfaccia: la logica sta nei moduli puri e lì si prova (Vitest).

- `preferenze.test.ts`: ricostruzione di `ordineLinea` dai due campi vecchi; impronta stabile su
  una pratica migrata (nessun avviso spurio); contiguità dei by-pass valutata sulla sequenza
  unificata; default che riproduce la sequenza di sempre.
- `buildSchemaModel.test.ts`: mandata verso il primo elemento quando è un filtro; catena in serie
  con serbatoi alternati agli stadi; by-pass su un singolo elemento e su un gruppo adiacente che
  comprende un serbatoio.
- `layout.test.ts`: `catenaDagliArchi` che parte da un filtro di testa e comprende i serbatoi;
  riga unica nell'ordine scelto; quota di linea invariata rispetto a oggi su una pratica non
  riordinata.
- **Banco di confronto SVG** (`bancoSimboli.test.ts`): va inforcato al primo stadio che il blocco
  tocca, non alla fine — altrimenti misura zero e sembra un successo.
- Verifica di non-regressione su una pratica reale già consegnata: riaperta senza toccare nulla,
  deve produrre lo stesso disegno di prima.
- Verde a `tsc`, all'intera suite Vitest e a ESLint prima di considerare chiuso il lavoro.
