# Schema d'impianto — Blocco 1: fondamenta dell'editor

Data: 2026-08-11
Stato: da implementare
Ramo: `worktree-schema-impianto-dm329`

## Il problema

Il motore che genera lo schema d'impianto per §2.3 funziona: legge la scheda dati,
costruisce il grafo, dispone i nodi e produce il PNG che finisce nel .docx. Ma l'editor
con cui si rifinisce la proposta è scomodo su tre fronti, tutti di resa e nessuno di
struttura — il modello dell'impianto è adeguato:

1. **Disposizione e precisione.** Mettere le apparecchiature dove servono, allineate e
   distanziate, è faticoso.
2. **Percorso delle tubazioni.** Il routing è automatico e non c'è modo di dire dove
   deve passare un tubo.
3. **Resa dei simboli.** I simboli non corrispondono ancora del tutto ai blocchi CAD di
   riferimento (`DOCUMENTAZIONE/relazione/Blocchi.pdf`).

A questi se ne aggiunge uno che li rende tutti inutili: **il layout non viene
conservato.** `RelazioneDataDialog` lo dichiara esplicitamente — «Lo schema non è
persistito: a ogni apertura si riparte da vuoto». Qualunque sistemazione fatta
nell'editor viene buttata alla chiusura del dialog.

C'è infine un difetto di fondo nel modo in cui le tubazioni si attaccano ai simboli: il
punto di attacco è calcolato dalla geometria del corpo disegnato (`corpoNodo`), non
dichiarato dal simbolo. Il risultato è che una linea arriva «al fianco sinistro» invece
che a un bocchello preciso, e nulla impedisce a una linea condense di attaccarsi dove
passa l'aria.

## Perimetro

### Dentro

- Ancore (punti di aggancio) tipizzate, dichiarate dal simbolo
- Archi legati a un'ancora di partenza e una di arrivo
- Persistenza del layout, con riconciliazione rispetto alla scheda
- Punti di passaggio trascinabili sulle tubazioni
- Strumenti di allineamento, distribuzione e spostamento fine
- Chiusura delle differenze residue fra i simboli e i blocchi CAD

### Fuori (blocchi successivi)

- **Blocco 2** — elementi in linea: giunzioni/TEE e valvole di sicurezza che spezzano la
  tubazione, con le relative segnalazioni di preflight
- **Blocco 3** — libreria simboli amministrabile: tabella dedicata, upload di SVG con
  sanificazione, editor dei punti di aggancio

### Fuori del tutto

- Caricamento di uno schizzo a mano e sua interpretazione automatica
- Editor di diagrammi esterno incorporato (draw.io e simili)
- Nuove entità nel modello dell'impianto: bypass, anelli, doppia sala, utenze multiple.
  Se serviranno, saranno un progetto a sé.

## Decisioni di progetto

### 1. Ancore tipizzate

Ogni simbolo dichiara i propri punti di aggancio, in coordinate locali al riquadro
d'ingombro, e per ciascuno cosa può attaccarcisi.

```ts
export type SchemaTipoAggancio = 'aria' | 'condensa' | 'valvola_sicurezza'

export interface SchemaAncora {
  /** Stabile e parlante: 'sx', 'dx', 'cielo', 'scarico'. Entra negli archi salvati. */
  id: string
  /** Coordinate locali al riquadro dichiarato in DIMENSIONI_NODO. */
  x: number
  y: number
  /** Cosa può agganciarsi qui. Mai vuoto: un'ancora che non accetta nulla non serve. */
  accetta: SchemaTipoAggancio[]
}
```

Il tipo `valvola_sicurezza` serve già in questo blocco, anche se le valvole piazzabili a
mano sono materia del Blocco 2: oggi la posizione delle valvole sul serbatoio è scritta
dentro la funzione che lo disegna. Dichiararla come ancora la porta dove sta il resto
della geometria, e il Blocco 2 la troverà pronta.

La libreria smette di essere un insieme di funzioni sciolte e diventa un registro di
definizioni. In questo blocco resta **in codice**; il Blocco 3 la sposterà su tabella
senza cambiare la forma, che è il motivo per cui `ancore` è dato puro e solo `disegna`
è una funzione.

```ts
export interface DefinizioneSimbolo {
  tipo: SchemaNodoTipo
  dimensioni: { larghezza: number; altezza: number }
  ancore: SchemaAncora[]
  disegna: (nodo: SchemaNodoPosizionato) => string
}
```

`DIMENSIONI_NODO` viene assorbito da `dimensioni`: oggi le due cose vivono in file
diversi (`layout.ts` e `symbols/index.ts`) e vanno tenute d'accordo a mano.

### 2. Archi legati alle ancore

```ts
export interface SchemaCapo {
  nodo: string
  ancora: string
}

export interface SchemaArco {
  id: string
  da: SchemaCapo
  a: SchemaCapo
  stile: SchemaArcoStile
  /** Gomiti imposti a mano. Assente o vuoto: percorso automatico come oggi. */
  punti?: { x: number; y: number }[]
}
```

Lo stile determina il tipo di aggancio richiesto: `standard` e `flessibile` chiedono
`aria`, `condensa` chiede `condensa`. Un arco è valido solo se entrambe le ancore
accettano quel tipo. La regola vive in una funzione pura riusata da tre punti: il
costruttore del modello, l'editor (per rifiutare una connessione illegale mentre la si
traccia) e il preflight.

`buildSchemaModel` deve quindi scegliere le ancore quando costruisce gli archi
automatici: mandata dal cielo del compressore al fianco del serbatoio, condensa dallo
scarico al cielo del pozzo. Sono le stesse scelte che oggi sono sepolte nei router di
`renderSvg`; qui diventano esplicite e verificabili.

### 3. Persistenza del layout

Il layout va in `additional_info.schemaLayout`, accanto ai collegamenti
compressori→serbatoi che già stanno lì. È JSONB: nessuna migrazione, solo un campo in
più in `additionalInfoSchema` (Zod). Non essendoci nulla di persistito oggi, non c'è
nulla da migrare.

Il PNG **non** si salva: si rigenera dal layout. Coerente con la scelta già presa di non
occupare Storage per gli schemi.

```ts
schemaLayout?: {
  versione: 1
  nodi: SchemaNodoPosizionato[]
  archi: SchemaArco[]
}
```

Il muro **non** si persiste: è derivato dalle posizioni e va ricalcolato a ogni render.
Oggi viene trasportato immutato alla conferma, quindi se si spostano le apparecchiature
resta dov'era — è un difetto da correggere qui.

#### Riconciliazione

All'apertura, il layout salvato va confrontato con la scheda, che resta autorevole su
*cosa esiste*. Perché la riconciliazione sappia cosa toccare, ogni nodo dichiara da dove
viene:

```ts
origine: 'scheda' | 'manuale'
```

- apparecchiatura in scheda ma non nel layout → si aggiunge in fondo
- nodo di origine `scheda` il cui codice non è più in scheda → si toglie
- nodo di origine `manuale` (aggiunto dalla palette) → **si tiene sempre**: è una scelta
  deliberata di chi ha disegnato

Le posizioni dei nodi sopravvissuti non si toccano mai. L'esito si riassume all'utente in
una riga sopra l'anteprima, non in un toast che scompare.

### 4. Punti di passaggio

Quando `punti` è presente, la polilinea passa di lì: ancora di partenza → punti → ancora
di arrivo, con raccordi ortogonali fra un punto e il successivo. Quando è assente, resta
il percorso automatico attuale.

Il refactoring già in essere aiuta: `renderSvg` costruisce **polilinee** e ne ricava i
varchi nel muro con `quoteAttraversamento`. I punti di passaggio si innestano senza
toccare quella logica, e i varchi continuano ad aprirsi dove serve.

Nell'editor: si afferra la linea e nasce un gomito, si trascina, doppio clic per
toglierlo. Come per i nodi, solo il gesto concluso entra in cronologia.

### 5. Precisione e allineamento

- griglia visibile allineata all'aggancio già attivo (10 unità)
- **allinea** (sinistra, destra, alto, basso, centro orizzontale, centro verticale) e
  **distribuisci** (orizzontale, verticale) su selezione multipla
- guide che compaiono durante il trascinamento quando un simbolo si mette in riga con un
  altro
- frecce della tastiera per lo spostamento fine: un'unità, dieci con Shift

Allineamento e distribuzione sono funzioni pure su un elenco di nodi posizionati, quindi
verificabili senza DOM.

### 6. Fedeltà dei simboli

Le differenze residue vanno individuate guardando, non descrivendo. Il primo passo è
produrre un **foglio di confronto**: i simboli generati affiancati ai blocchi di
`Blocchi.pdf`, stessa scala, che il committente annota. Le differenze annotate diventano
la lista di lavoro.

Ogni correzione vale sia per l'editor sia per il PNG: usano la stessa libreria.

## Impatto sui file

| File | Cosa cambia |
|---|---|
| `services/schemaImpianto/types.ts` | `SchemaAncora`, `SchemaTipoAggancio`, `SchemaCapo`; `SchemaArco.da/a/punti`; `origine` sul nodo |
| `services/schemaImpianto/symbols/index.ts` | registro di `DefinizioneSimbolo` con ancore e ingombri |
| `services/schemaImpianto/layout.ts` | `DIMENSIONI_NODO` assorbito dal registro; muro ricalcolato |
| `services/schemaImpianto/buildSchemaModel.ts` | scelta esplicita delle ancore negli archi automatici |
| `services/schemaImpianto/renderSvg.ts` | attacco alle ancore; polilinee con punti di passaggio |
| `services/schemaImpianto/allineamento.ts` | **nuovo**: allinea e distribuisci, funzioni pure |
| `services/schemaImpianto/persistenza.ts` | **nuovo**: serializza, deserializza, riconcilia |
| `services/relazione/schema.ts` | `schemaLayout` in `additionalInfoSchema` |
| `components/relazione/RelazioneDataDialog.tsx` | carica e salva il layout invece di azzerarlo |
| `components/schemaImpianto/SchemaEditor.tsx` | barra allineamento, gomiti, vincoli sulle connessioni |
| `components/schemaImpianto/SchemaNodeSymbol.tsx` | un handle per ancora, con il tipo dichiarato |
| `components/schemaImpianto/conversioneFlow.ts` | ancore ↔ handle, punti di passaggio ↔ waypoint |

## Test

Vitest sulle funzioni pure, com'è convenzione nel progetto (niente test di UI):

- **ancore**: un arco condensa non può agganciarsi a un'ancora di sola aria; ogni simbolo
  dichiara almeno un'ancora per ciascun tipo che il costruttore del modello gli chiede
- **persistenza**: andata e ritorno senza perdite; riconciliazione nei quattro casi
  (aggiunta, rimozione, nodo manuale conservato, posizioni intatte)
- **punti di passaggio**: la polilinea li attraversa nell'ordine dato; i varchi nel muro
  si aprono alle quote giuste anche con i gomiti imposti
- **allineamento**: allinea e distribuisci su casi noti, compresi i degeneri (un nodo
  solo, nodi già allineati)

L'interazione — trascinare un gomito, usare le frecce — si verifica in app, come già si
fa per il resto dell'editor.

## Rischi e questioni aperte

- **Il numero di handle cresce.** Un handle per ancora invece di quattro fissi significa
  più DOM per nodo. A questa scala (dieci simboli) è irrilevante, ma va tenuto d'occhio
  se un giorno si disegnano impianti molto più grandi.
- **L'editor resta un'approssimazione.** react-flow instrada con `smoothstep` e non
  conosce muro, uscita utenze, nota e tabella. Il pannello di anteprima fedele già
  aggiunto resta l'unico giudice dell'aspetto finale; questo blocco non cambia quel
  compromesso.
- **La riconciliazione può sorprendere.** Chi ha disposto con cura un disegno e poi
  aggiunge un compressore in scheda se lo ritrova in fondo, non al posto giusto. È il
  comportamento voluto — meglio fuori posto che assente — ma va detto chiaramente
  nell'avviso.
