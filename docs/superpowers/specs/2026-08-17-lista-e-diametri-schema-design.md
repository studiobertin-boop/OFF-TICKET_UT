# La lista apparecchiature e il testo dei diametri — specifica

**Data:** 17-08-2026
**Origine:** due richieste estetiche del committente, arrivate insieme alla domanda di chiudere le
code aperte dell'editor dello schema d'impianto.

Le altre voci di quella domanda — i difetti dell'editor e le decisioni sui dati — stanno in
`2026-08-17-code-aperte-editor-schema-design.md`. Sono lavori separati **perché hanno vincoli
opposti sui riferimenti SVG**: qui il disegno cambia e i riferimenti devono muoversi; là il
disegno non deve cambiare, e i riferimenti fermi sono la prova che non si è rotto nulla.

## Perché sono un lavoro solo

Toccano tutte e due la fascia sotto il disegno — il riquadro della nota e la tabella — e la
seconda ha bisogno di una misura che oggi non esiste: **dove comincia e dove finisce davvero il
disegno**. Farle separatamente vorrebbe dire introdurre quella misura due volte, o farla entrare
in un lavoro e usarla nell'altro attraverso un merge.

## A1 — Il testo dei diametri distingue la sala dalla distribuzione

**Oggi** (`notaTubazioni`, `buildSchemaModel.ts`): i quattro DN dichiarati in scheda —
`dn_sala_min`, `dn_sala_max`, `dn_distribuzione_min`, `dn_distribuzione_max` — finiscono in un
unico elenco, se ne prende il minimo e il massimo assoluti e si stampa **una riga sola**:

> Collegamenti effettuati con tubazioni da Ø15 a Ø25mm

Le linee di distribuzione non vengono mai nominate, e i loro diametri si mescolano a quelli dei
collegamenti in sala.

**Voluto:** le due coppie si leggono separatamente e producono righe distinte.

| collegamenti in sala | linee di distribuzione | testo stampato |
|---|---|---|
| nessun valore | nessun valore | **nessun riquadro** |
| nessun valore | almeno un valore | **nessun riquadro** |
| almeno un valore | nessun valore | `Collegamenti effettuati con tubazioni da Ø15 a Ø25mm` |
| almeno un valore | almeno un valore | le due righe: `Collegamenti…` e `Linee effettuate con tubazioni da Ø32 a Ø50mm` |

**Forma singola.** Quando gli estremi di una coppia coincidono — o quando la scheda ne dichiara
uno solo, cosa che capita perché i quattro campi sono indipendenti — la riga diventa
`…con tubazioni da Ø15mm`. Deciso col committente: un estremo solo è un dato che c'è, e tacerlo
sarebbe peggio che stamparlo.

**Estremi invertiti.** Resta il comportamento di oggi: dentro ciascuna coppia si prende comunque
il minimo e il massimo dei valori presenti, perché in scheda capita di trovarli scambiati. La
differenza è che ora il confronto avviene **dentro** la coppia, non fra tutte e quattro.

**Dicitura.** Ø e iniziale maiuscola, confermate dal committente: sono quelle delle relazioni
storiche, e la seconda riga le imita («Linee effettuate…»).

**Il caso senza collegamenti in sala.** Se la scheda dichiara solo i diametri delle linee di
distribuzione non si stampa nulla — nemmeno la riga sulle linee. È una scelta del committente, non
una conseguenza tecnica: il riquadro parla dei collegamenti, e senza quelli non ha di che parlare.

**Impaginazione: non cambia.** Il riquadro riserva già `ALTEZZA_NOTA = 90` e `renderNota` compone
le righe a 24 di passo partendo da 24: due righe occupano 72. Ci stanno senza toccare la fascia.

## A2 — La tabella si stringe al contenuto e si centra sul disegno

**Oggi** (`renderTabella` e `renderNota`, `renderSvg.ts`): la tabella comincia a `MARGINE` e si
estende per tutta la larghezza del foglio meno i due margini, qualunque cosa contenga. Su un
disegno largo produce righe quasi vuote, con la descrizione appoggiata a sinistra e mezzo foglio
di bianco a destra. La nota, invece, è centrata sul **foglio**.

**Voluto, in tre parti:**

1. **La tabella è larga quanto il suo contenuto.** Colonna di sinistra invariata
   (`COLONNA_CODICE = 130`: ospita i codici e i campioni di tubazione della legenda); colonna di
   destra larga quanto la descrizione più lunga fra tutte le righe, lista e legenda insieme.
2. **La larghezza minima è l'intestazione.** «LISTA APPARECCHIATURE» è in corpo 20, più grande
   delle righe: su un elenco corto sarebbe lei a sporgere. La tabella non scende mai sotto la
   larghezza che le serve, con i suoi margini. Deciso col committente in alternativa a
   rimpicciolire l'intestazione.
3. **Tabella e nota si centrano sul disegno**, non sul foglio. Il committente ha chiesto
   esplicitamente che anche la nota cambi riferimento, così le due fasce restano incolonnate fra
   loro **e** con ciò che sta sopra.

### La misura che manca

`dimensioniLayout` (`layout.ts`) restituisce `{ larghezza, altezza }` misurando **da zero in giù e
da zero a destra**: sa dove il disegno finisce, non dove comincia. Per centrare sul disegno vero
serve anche il bordo sinistro.

Va quindi esposta una misura nuova — l'**estensione orizzontale** del disegno, bordo sinistro e
bordo destro — costruita sugli stessi ingredienti che `dimensioniLayout` usa già: `riquadroDi` per
i nodi (non `dimensioniDi`: il riquadro tarato è l'ingombro vero) e `ingombroTesto` per le
annotazioni, la cui `x` è già il capo sinistro.

**Un solo punto di verità.** `dimensioniLayout` deve **derivare** la propria larghezza da questa
misura, non calcolarla per conto suo: due percorsi paralleli sullo stesso ingombro diventerebbero
incoerenti al primo ritocco a uno dei due. È lo stesso motivo per cui `larghezzaCarattere` sta in
un posto solo (vedi il commento di `TESTO_LIBERO`, `symbols/index.ts`).

**Il bordo destro serve anche altrove:** la posa dei nuovi oggetti quando sopra non c'è spazio
(voce B1 dell'altra specifica) ha bisogno esattamente della stessa misura. La funzione nasce qui e
là si riusa.

### Come si stima la larghezza del testo

Con la stessa approssimazione già in uso nel modulo: `larghezzaCarattere: 0.5` volte il corpo,
letta da `symbols/index.ts` e non riscritta a mano. Non è tipografia vera — misurare i glifi
richiederebbe un DOM che queste funzioni non hanno — e non deve esserlo: serve a decidere quanto
allargare un riquadro, come già per le annotazioni e per la scritta del terminale utenze.

**Conseguenza da accettare:** su descrizioni molto lunghe la stima può sbagliare di qualche unità.
Il rischio è che una descrizione sfiori il bordo destro della cella, non che esca dal foglio.

### Dove si posa il blocco

Detto `C` il centro del disegno e `L` la larghezza della tabella, il blocco occupa
`[C − L/2, C + L/2]`. Due casi di frontiera, entrambi da chiudere esplicitamente:

- **Sborda a sinistra** (`C − L/2 < MARGINE`): il blocco si riporta a `MARGINE`. Un disegno stretto
  e appoggiato a sinistra non deve spingere la tabella fuori dalla tela.
- **Sborda a destra:** il foglio si allarga quanto basta a contenerlo, più il margine. È
  l'evoluzione della regola di oggi, dove la larghezza totale è già il massimo fra disegno e
  tabella.

La nota segue lo stesso centro. Mantiene il suo tetto di larghezza attuale (680) e la sua
composizione centrata: cambia il centro su cui si appoggia, non la sua forma.

### Firma delle funzioni di disegno

`renderTabella` e `renderNota` oggi ricevono la larghezza del foglio e ne ricavano da sé margine e
posizione. Devono invece ricevere **il blocco in cui stare** — ascissa d'inizio e larghezza — e
smettere di conoscere il foglio. È la modifica che rende la scelta di dove posare il blocco un
fatto solo, deciso una volta in `renderSvg`, invece di una regola ripetuta in due funzioni che
potrebbero divergere.

## Cosa cambia nei documenti già consegnati

Ogni pratica rigenerata esce con la tabella stretta e centrata invece che a tutta larghezza, e con
il testo dei diametri riscritto. È lo stesso prezzo già accettato per la libreria dei simboli: un
documento consegnato, se rigenerato, esce diverso.

## Prove

**I tre riferimenti SVG si muovono, ed è voluto.** È il primo lavoro dello schema in cui non
valgono fermi. Il vincolo diventa quindi un altro, più stretto: **si legge la differenza voce per
voce e si verifica che sia quella attesa e nient'altro**. In particolare, il disegno vero — nodi,
tubazioni, muro, annotazioni — non deve cambiare di una coordinata: cambiano solo la fascia della
nota e quella della tabella, e la larghezza totale del foglio se il blocco la spinge. Il commit
dice cosa cambiava.

**Da provare esplicitamente, oltre ai casi ovvi:**

- le sei combinazioni della tabella di A1, compresa quella che non stampa nulla pur avendo dati;
- una coppia con un estremo solo, che deve dare la forma singola;
- una tabella la cui descrizione più lunga è più stretta dell'intestazione (il minimo scatta);
- un disegno spostato a destra, che porta la tabella con sé;
- un disegno stretto e appoggiato a sinistra, dove il blocco sborda e si riporta al margine;
- la nota e la tabella incolonnate fra loro sullo stesso centro.

Ogni test nuovo va visto cadere per mutazione e va messo sulla porta più esterna che la produzione
usa — `renderSvg` per il disegno, `notaTubazioni` per il testo.
