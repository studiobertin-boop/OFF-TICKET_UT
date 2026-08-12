# Schema d'impianto — Blocco A: elemento «Alle utenze», legenda dei simboli, flessibile ondulato

Data: 2026-08-12
Stato: da implementare
Ramo: `worktree-schema-impianto-dm329` (nessun merge su `main` finché il modulo non è finito)

Segue il blocco «fondamenta dell'editor»
(`docs/superpowers/specs/2026-08-11-schema-impianto-fondamenta-design.md`), chiuso e verde.

## Il problema

Il modulo che genera e rifinisce lo schema d'impianto per la §2.3 funziona, ma il committente
ha segnalato tre buchi. Questo blocco ne chiude uno e mezzo; il resto è il Blocco B.

**Il tratto finale verso le utenze non è un elemento.** `renderUscitaUtenze`
(`renderSvg.ts:226-240`) lo disegna d'ufficio: sceglie da sé il nodo più a destra escluso il
pozzo condense e scrive `"Utenze aria"` cablato nel codice. Nell'editor quindi non esiste — non
ci si può attaccare una tubazione, non si sposta, la scritta non si cambia. E siccome una
tubazione non può andare da un'ancora al nulla, il tratto finale non è nemmeno disegnabile a
mano. Le utenze però possono essere aria, azoto o altro: la scritta deve essere modificabile.

**La tabella sotto lo schema è incompleta.** Negli schemi del committente, in coda alla «Lista
Apparecchiature» c'è la legenda dei simboli presenti nel disegno: il simbolo disegnato al posto
del codice, e accanto il suo nome. Il nostro generatore la tabella la fa, la legenda no.

**Il flessibile è ondulato solo per un tratto.** `ondeVerticali` disegna un ricciolo di 40 unità
vicino al compressore, mentre negli schemi reali l'ondulazione percorre tutta la tubazione da un
capo all'altro. Sulla tela dell'editor non è ondulato affatto, e il commento in testa a
`SchemaEdgeTubazione.tsx` promette un'ondulazione che il componente non disegna. La legenda,
che di quel simbolo mostra un campione, rende l'incoerenza visibile.

Infine c'è un **debito** che conviene saldare prima di toccare il resto: `conversioneFlow.ts` è
logica pura al 100%, è il punto da cui sono nati tre difetti del ramo, e non ha un solo test; e
`data.nodo` porta ancora `x`/`y` che nessuno legge — `flowALayout` le sovrascrive sempre con
`n.position` — ma che hanno già causato tre difetti.

## Perimetro

### Dentro

- Test di `conversioneFlow.ts`
- Rimozione di `x`/`y` da `data.nodo`
- Elemento «Alle utenze» come nodo vero, con ancora propria e scritta modificabile
- Legenda dei simboli in coda alla «Lista Apparecchiature»
- Tubazione flessibile ondulata per tutta la lunghezza, nel render statico e nell'editor

### Fuori — Blocco B, subito dopo il punto di controllo

- Giunzione/TEE come nodo con tre attacchi
- Valvole di intercettazione e riduttori di pressione come segni che vivono *sulla* tubazione,
  vi scorrono e la seguono quando si sposta un'apparecchiatura
- Riga di legenda del riduttore di pressione, che prima del Blocco B non ha nulla da spiegare
- Trascinamento del tratto di tubazione: si afferra un tratto dritto e lo si fa scorrere in
  blocco, con i gomiti ai capi che si aggiustano da soli

### Fuori del tutto, per ora

- Import dei blocchi CAD del committente e interfaccia per attrezzarli (era il Blocco 3). Finché
  non arriva, **i simboli attuali non si rifiniscono**: sarebbe lavoro buttato.
- Utenze multiple: l'elemento è uno solo per schema.
- Il bypass che negli schemi storici scavalca il serbatoio e ridiscende sulla distribuzione. Il
  modello non sa rappresentarlo; se servirà, è un progetto a sé.

## Decisioni di progetto

### 1. Il debito, per primo e in due commit

**Test di `conversioneFlow.ts`.** Un andata e ritorno `layoutAFlow` → `flowALayout` che verifica
ancore, `punti` e stile, più un caso in cui `position` diverge da `data.nodo` per accertare che
vinca `position`.

**Poi, in un commit suo, via `x`/`y` da `data.nodo`.** Non è una cancellazione cosmetica:
`definizioneDi`, `ancoraDi` e `simboloDi` oggi chiedono un `SchemaNodoPosizionato` pur leggendo
solo tipo, orientamento, id ed etichette. Prendono `SchemaNodo`; `SchemaNodeData.nodo` diventa
`SchemaNodo`; nell'editor la posizione resta soltanto in `Node.position`. Spariscono con esse le
pezze `{...data.nodo, ...position}` in `useGomiti.ts` e in `useAllineamentoSelezione.ts`, messe
lì proprio perché le due fonti divergevano. `flowALayout` continua a costruire i
`SchemaNodoPosizionato` da `n.position`, come già fa. Nessuna migrazione dati: niente di
serializzato dipende da `data.nodo`.

L'ordine conta: il test prima, così la rimozione ha una rete sotto.

### 2. L'elemento «Alle utenze»

Lo schema di riferimento del committente (`DOCUMENTAZIONE/relazione/schema.png`) mostra come è
fatto davvero: il codolo tratteggiato con la punta di freccia e la scritta sono **una cosa
sola**, e la tubazione vera — nel suo caso il flessibile — ci arriva sopra. Il tratteggio è
corto; il tratto prima è tubazione normale.

Nuovo tipo di nodo `utenze`, con una voce propria nel registro dei simboli:

- **Disegno**: codolo verticale tratteggiato che sale dall'ancora fino alla punta di freccia, e
  la scritta a destra della punta. È la stessa forma che `renderUscitaUtenze` produce oggi, così
  i layout riaperti non si spostano.
- **Ancora**: una sola, in basso, `accetta: ['aria']`. La tubazione arriva da sotto.
- **Etichetta**: `"Utenze aria"` alla nascita, modificabile.
- **Ingombro**: largo abbastanza da contenere la scritta, così `dimensioniLayout` allarga da sé
  la tela — è il compito che oggi svolge `SPAZIO_UTENZE`, che sparisce.
- **Id riservato `UTENZE`**, che nessun codice di scheda può produrre. L'elemento è uno solo.
- **Gruppo** `LINEA_DISTRIBUZIONE`, come gli altri nodi a valle del muro.

`buildSchemaModel` lo crea sempre, insieme alla tubazione che vi arriva. «Ultimo stadio» diventa
una regola **topologica** — l'ultimo della catena di trattamento, altrimenti l'ultimo serbatoio,
e se non c'è né l'una né gli altri l'elemento non nasce — perché il modello si costruisce prima
che le posizioni esistano. Oggi la regola è «il nodo più a destra», che dopo il layout dice
quasi sempre la stessa cosa ma non può essere valutata a monte.

`ordinaCatenaTrattamento` e `pozzoCondense` devono ignorare il tipo `utenze`: non è uno stadio
di trattamento né un pozzo. `righeLista` lo salta: non è un'apparecchiatura e non ha codice.

`renderUscitaUtenze` e `SPAZIO_UTENZE` **spariscono**. Un solo percorso di disegno, quindi due
frecce impossibili per costruzione.

**Cosa cambia nell'aspetto.** La posizione dell'elemento resta quella che la freccia automatica
aveva. Cambia però il tratto che lo raggiunge: oggi è tratteggiato per tutta la sua lunghezza,
d'ora in poi è una tubazione rigida come le altre e il tratteggio resta il solo codolo con la
freccia. È come sono fatti gli schemi del committente, quindi un avvicinamento al riferimento,
ma va detto perché è visibile.

**Layout già salvati.** Non contengono quel nodo. La riconciliazione generica mette i nodi nuovi
*sotto* il disegno esistente (`piede + 320`), che per questo elemento sarebbe sbagliato: lo
manderebbe in fondo alla tela. Caso dedicato in `riconcilia`: quando manca l'elemento `utenze`,
lo colloca applicando **alle posizioni salvate** la stessa regola geometrica che la freccia
automatica usava — a destra del nodo più a destra escluso il pozzo condense, in alto. L'arco
verso di lui entra già dalla strada normale, perché `archiNuovi` prende gli archi che toccano un
nodo appena aggiunto.

Se l'utente lo cancella, alla riapertura torna: è un nodo di origine `scheda` e la scheda resta
autorevole su cosa esiste. È la conseguenza accettata della scelta fatta col committente.

Non entra nella palette: le utenze multiple sono fuori perimetro.

### 3. La scritta modificabile

Doppio clic sul nodo apre un campo di testo. Il gesto è libero: sui nodi il doppio clic oggi non
fa nulla, mentre sugli archi crea i gomiti.

La modifica passa da `applica`, non da `aggiornaSenzaCronologia`: è un gesto come lo
spostamento, e un solo Ctrl+Z deve annullarla. Va scritta nel modello, cioè in
`data.nodo.etichetta`, perché è da lì che `simboloDi` la legge e che `flowALayout` la porta alla
conferma.

Il meccanismo resta generale — rinominare è rinominare — ma **in questo blocco è concesso solo
sul tipo `utenze`**: le etichette degli altri nodi vengono dalla scheda dati, e la
riconciliazione le riscriverebbe alla riapertura, per la regola che ha chiuso il rilievo
Critical della revisione finale. Consentirlo altrove sarebbe una modifica che si perde in
silenzio.

### 4. La legenda in coda alla tabella

Non righe con un codice: **righe della stessa tabella**, col simbolo disegnato al posto del
codice e il nome nella colonna della descrizione, come nello schema di riferimento.

La cella di sinistra smette di essere una stringa e diventa esplicita su cosa contiene:

```ts
type CellaSinistra = { codice: string } | { simbolo: string }

interface RigaTabella {
  sinistra: CellaSinistra
  descrizione: string
}
```

`righeLista` continua a produrre le righe con codice; una nuova funzione pura
`righeLegenda(layout)` produce quelle col simbolo, e `renderTabella` disegna l'una o l'altra
cella secondo il caso. Le due funzioni restano separate: la prima legge le apparecchiature, la
seconda cosa il disegno contiene.

Righe, in quest'ordine, e **solo se il disegno le contiene davvero**:

| Riga | Compare quando |
|---|---|
| Valvola di intercettazione | esiste almeno un arco rigido o flessibile: sono loro a disegnarla |
| Valvola di scarico | esiste un serbatoio, un essiccatore o un filtro |
| Tubazione rigida | esiste almeno un arco di stile `standard` |
| Tubazione flessibile | esiste almeno un arco di stile `flessibile` |
| Linea condense | esiste almeno un arco di stile `condensa` |

La valvola di sicurezza **non** compare mai in legenda: ha già la sua riga con codice, marca e
modello, e la legenda spiega solo i simboli che nessuna riga codificata identifica. È la regola
scelta dal committente, ed è quella che il suo schema segue.

Chi disegna cosa va letto nel codice, non nei commenti: il commento in testa a `types.ts` dice
che la valvola di scarico è «sempre presente su serbatoio/essiccatore/filtro/separatore/
disoleatore», ma `simboloSeparatore` la esclude di proposito (`conScarico: false`, «scarica da
un codolo nudo, senza valvola: così nel blocco di riferimento») e il compressore non la disegna
affatto. La disegnano **serbatoio, essiccatore e filtro**, e basta. Il commento va corretto
insieme al resto, o la prossima persona che scrive una regola sui simboli sbaglierà come ho
sbagliato io scrivendo questa spec.

I campioni disegnati nella cella riusano le funzioni del registro dei simboli
(`valvolaIntercettazione`, `valvolaScarico`) e, per le tre tubazioni, le stesse funzioni con cui
`renderSvg` traccia gli archi. Il campione è coerente col disegno per costruzione, non per
diligenza di chi lo scrive.

L'altezza della tabella cresce di conseguenza: `renderSvg` calcola l'altezza totale dal numero
di righe, quindi va sommato quello della legenda.

### 5. Il flessibile ondulato per tutta la lunghezza

Una funzione pura che, data la polilinea di un arco, restituisce il tracciato ondulato che la
segue: onde perpendicolari alla direzione di ogni tratto, che ripartono a ogni vertice — gli
spigoli restano netti, come nel CAD. Vale sia per i tratti orizzontali sia per i verticali,
mentre `ondeVerticali` fa solo i secondi e sparisce.

Due vincoli, entrambi da rispettare senza eccezioni:

- **La polilinea resta la verità geometrica.** L'ondulazione è resa del tratto, non una nuova
  rotta. `quoteAttraversamento` continua a ricevere la polilinea liscia, o i varchi nel muro si
  aprirebbero alle quote sbagliate.
- **Editor e render statico usano la stessa funzione.** `SchemaEdgeTubazione.tsx` la adotta, e
  il commento in testa al file che oggi promette un'ondulazione mai disegnata smette di dire il
  falso.

Il campione «tubazione flessibile» della legenda esce dalla stessa funzione.

## Impatto sui file

| File | Cosa cambia |
|---|---|
| `services/schemaImpianto/types.ts` | tipo `utenze` in `SchemaNodoTipo`; commento sulla valvola di scarico corretto (oggi elenca separatore e disoleatore, che non la disegnano) |
| `services/schemaImpianto/symbols/index.ts` | definizione del simbolo `utenze` con ingombro e ancora; campioni per la legenda; `definizioneDi`/`ancoraDi`/`simboloDi` accettano `SchemaNodo` |
| `services/schemaImpianto/buildSchemaModel.ts` | crea il nodo `utenze` e il suo arco; `ordinaCatenaTrattamento` lo ignora |
| `services/schemaImpianto/layout.ts` | colloca il nodo `utenze`; `pozzoCondense` lo ignora |
| `services/schemaImpianto/renderSvg.ts` | via `renderUscitaUtenze` e `SPAZIO_UTENZE`; `righeLegenda`; `renderTabella` con la cella a due forme; ondulazione lungo tutta la polilinea; via `ondeVerticali` |
| `services/schemaImpianto/persistenza.ts` | `riconcilia`: collocazione dedicata dell'elemento `utenze` mancante |
| `components/schemaImpianto/conversioneFlow.ts` | `data.nodo` senza `x`/`y` |
| `components/schemaImpianto/__tests__/conversioneFlow.test.ts` | **nuovo**: andata e ritorno, e `position` che vince su `data.nodo` |
| `components/schemaImpianto/SchemaNodeSymbol.tsx` | `SchemaNodeData.nodo: SchemaNodo` |
| `components/schemaImpianto/SchemaEditor.tsx` | doppio clic sul nodo `utenze` per la scritta |
| `components/schemaImpianto/SchemaEdgeTubazione.tsx` | flessibile ondulato; commento corretto |
| `components/schemaImpianto/useGomiti.ts`, `useAllineamentoSelezione.ts` | via le pezze `{...data.nodo, ...position}` |

L'elenco è quello previsto adesso: se l'implementazione ne scopre altri, **il piano si corregge
nello stesso commit del codice**, come parte del piano e non come nota a margine. Nel blocco
precedente è successo cinque volte.

## Test

Vitest sulle funzioni pure, com'è convenzione nel progetto — nessun test di UI.

- **conversioneFlow**: andata e ritorno senza perdite su ancore, `punti` e stile; `position`
  diversa da `data.nodo` e `position` che vince
- **buildSchemaModel**: il nodo `utenze` nasce con l'arco che vi arriva; parte dall'ultimo della
  catena di trattamento, dall'ultimo serbatoio se la catena è vuota, e non nasce affatto se non
  c'è né l'uno né gli altri
- **righeLista**: l'elemento `utenze` non compare fra le apparecchiature
- **righeLegenda**: ciascuna riga compare quando e solo quando il suo simbolo è nel disegno;
  nessuna riga per la valvola di sicurezza anche quando c'è; ordine delle righe
- **riconcilia**: un layout salvato senza l'elemento `utenze` lo riceve, nel posto dove cadeva
  la freccia automatica e non in fondo alla tela; le posizioni degli altri nodi non si toccano
- **ondulazione**: il tracciato parte e finisce sui capi del tratto; il numero di onde segue la
  lunghezza; funziona su tratti orizzontali e verticali; a ogni vertice riparte

**Ogni test nuovo va visto fallire prima**, se serve rompendo apposta l'implementazione. Nel
blocco precedente cinque giri di riparazione sono nati da test che non discriminavano: casi
geometricamente equivalenti al comportamento sbagliato, verdi su entrambe le implementazioni.

La modifica della scritta, l'aspetto della legenda e l'ondulazione nel `.docx` si verificano in
pagina, e **le verifiche in pagina le fa il controller**. La revisione che legge la diff non
basta per l'interazione: i difetti veri del blocco precedente sono emersi solo provando.

## Rischi e questioni aperte

- **La riga «tubazione rigida».** Nello schema di riferimento non c'è, benché il tratto rigido ci
  sia; il committente però l'ha nominata fra i simboli di legenda. La regola scelta è «c'è nel
  disegno, quindi si spiega». Se all'atto pratico appesantisce la tabella, si toglie una riga di
  codice.
- **L'ondulazione su tratti corti.** Un tratto più corto di un'onda va reso in modo che si
  riconosca comunque come flessibile e non come un tratto storto. Da guardare, non da descrivere.
- **La palette nasce senza orientamento.** I nodi aggiunti a mano nascono sempre
  `gruppo: 'LINEA_DISTRIBUZIONE'` e senza `orientamento`: un serbatoio aggiunto a mano è per
  forza verticale. Debito noto, non toccato qui, che il Blocco B incontrerà di nuovo.
- **`ChiaveSimbolo = string`** fa mentire `definizioneDi` sul tipo di ritorno. Aggiungere un tipo
  di nodo non peggiora la cosa, ma la conferma: quando arriverà l'import dei blocchi CAD,
  `undefined` sarà un esito normale e la firma dovrà essere onesta.
