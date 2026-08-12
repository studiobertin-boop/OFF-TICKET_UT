# Fascicolo apparecchiatura: separazione delle pagine doppie

Data: 2026-08-12
Stato: approvato, da implementare

## Obiettivo

Alcuni certificati sorgente (tipicamente prodotti da certi fabbricanti/enti,
es. SICC) arrivano con pagine in formato A4 orizzontale che in realtà
contengono due pagine verticali affiancate, con il contenuto ruotato di 90°
per stare nella metà larghezza. Il motore di assemblaggio del fascicolo
oggi tratta ogni pagina sorgente come un'unica pagina di output: una pagina
doppia finisce quindi rimpicciolita su un unico foglio A4 verticale invece
di diventare due pagine leggibili.

Va aggiunto al motore un passaggio che riconosce queste pagine doppie, le
separa in due pagine verticali distinte, ciascuna ruotata e ridimensionata
correttamente, prima che il fascicolo venga composto.

## Non cambia

Il motore generico di composizione (`src/services/pdfCompose/componiPdf.ts`)
resta del tutto invariato: non acquisisce alcuna conoscenza delle pagine
doppie, riceve sempre PDF "normali" e continua a trattare ogni pagina 1:1
come fa oggi (incorporazione vettoriale, rotazione se l'orientamento non
combacia col foglio, scala di compressione `GRADI`). Resta quindi riusabile
da altri motori (es. `dichiarazioni/estraiPagine.ts`) senza portarsi dietro
questa logica specifica del fascicolo.

Non cambia nemmeno la scala di compressione: le pagine separate, una volta
incorporate nel nuovo PDF restituito dal modulo di split, sono pagine PDF
contenenti un'immagine a piena pagina — il motore generico le tratta come
qualunque altra pagina "documento" (vettoriale ai primi gradi di
compressione, ri-rasterizzata se serve scendere oltre un certo grado).
Nessun caso speciale da gestire lì.

## Design

### 1. Riconoscimento — funzione pura

Nuovo `src/services/fascicolo/dividiPagineDoppie.ts`. La parte di
rilevamento è calcolo puro su numeri, testabile in Node senza browser (sullo
stile di `utils/valvoleImpianto.ts` o della parte pura di `schemaCrop.ts`):

```ts
/** Vero se una pagina larghezza×altezza è probabilmente due pagine verticali
 * affiancate in orizzontale, secondo il rapporto ISO 216 (√2) con cui ogni
 * formato si ottiene raddoppiando quello immediatamente più piccolo. */
function ePaginaDoppia(larghezza: number, altezza: number, tolleranza = 0.08): boolean
```

Condizione: `larghezza > altezza` (orizzontale) e
`altezza / (larghezza / 2)` entro `±8%` di `√2 ≈ 1.41421`. La tolleranza è
relativa (percentuale), non un valore assoluto in punti: funziona quindi a
qualunque scala il documento sia stato scansionato/esportato, senza dover
assumere dimensioni A4/A3 specifiche — è la stessa relazione geometrica con
cui la serie ISO 216 costruisce ogni formato doppiando quello più piccolo.

Una pagina orizzontale con proporzioni diverse (uno schema, una tabella
larga) non supera la soglia e non viene toccata: segue il comportamento
attuale del motore generico (rotazione intera se serve, nessun taglio).

### 2. Separazione — riuso di infrastruttura esistente

Il resto del modulo (tocca DOM/canvas, non testabile in Node — stesso
limite già accettato per `raster.ts` e la parte file di `schemaCrop.ts`)
riusa pezzi già esistenti invece di reinventarli:

1. Si carica il PDF sorgente con `pdf-lib` (`PDFDocument.load`) e si
   ispezionano tutte le pagine con `pagina.getSize()` — se nessuna risulta
   doppia, si restituisce **lo stesso file originale, invariato** (nessuna
   ricodifica inutile per il caso comune).
2. Per ogni pagina doppia trovata: si estrae quella pagina in un PDF
   autonomo di una pagina sola (stesso pattern già presente in
   `estraiPagina`, `src/services/dichiarazioni/estraiPagine.ts:11-21`), poi
   si rasterizza con `rasterizzaPdf` (`src/services/pdfCompose/raster.ts`,
   già esistente e già usato dal motore generico per la scala di
   compressione) a una qualità fissa e alta (indicativamente 200 dpi,
   qualità 0.9 — più della soglia più alta usata oggi nella scala di
   compressione, per restare leggibile anche dopo eventuali riduzioni
   successive in fase di composizione).
3. Il bitmap risultante si ritaglia in due metà (sinistra/destra) via
   canvas, ruotando ciascuna metà di 90° nello stesso verso per riportare il
   contenuto in verticale leggibile. Nuova funzione, unica parte
   genuinamente nuova di logica canvas nel modulo.
4. Le pagine non doppie si ricopiano nel nuovo documento inalterate
   (embed 1:1 alla loro dimensione originale — l'adattamento al foglio A4 è
   compito del motore generico a valle, qui non serve replicarlo). Le due
   metà di ogni pagina doppia diventano due pagine, nell'ordine
   sinistra-poi-destra, al posto della pagina originale.
5. Si restituisce il nuovo PDF come `File`, con l'elenco delle pagine
   (indici 1-based del documento originale) che sono state separate.

```ts
export interface RisultatoDivisione {
  file: File
  /** Indici 1-based, nel documento ORIGINALE, delle pagine separate. Vuoto se il file torna invariato. */
  pagineSeparate: number[]
}

export async function dividiPagineDoppie(file: File): Promise<RisultatoDivisione>
```

**Nota per l'implementazione**: il verso esatto della rotazione
(orario/antiorario) e l'ordine delle due metà vanno confermati sui file di
esempio reali (già allegati in chat: il certificato SICC con pagina 3
doppia) prima di considerare il lavoro concluso — un errore di verso
produce testo capovolto, non è qualcosa che si possa dedurre in astratto in
fase di design. Serve avere quei file su disco (non solo incollati in
chat) per poterli caricare nei test/nella verifica manuale.

### 3. Integrazione nel motore fascicolo

`src/services/fascicolo/componiPdf.ts` oggi è un re-export storico di 6
righe verso il motore generico. Diventa un wrapper sottile:

```ts
export interface EsitoComposizioneFascicolo extends EsitoComposizione {
  /** Etichette dei documenti/pagine che avevano pagine doppie, separate prima della composizione. */
  pagineSeparate: string[]
}

export async function componiFascicolo(
  sorgenti: SorgenteFascicolo[],
  opzioni?: OpzioniComposizione
): Promise<EsitoComposizioneFascicolo> {
  const pagineSeparate: string[] = []
  const sorgentiDivise = await Promise.all(sorgenti.map(async (s) => {
    if (!eUnPdf(s.file)) return s
    const { file, pagineSeparate: pagine } = await dividiPagineDoppie(s.file)
    if (pagine.length > 0) {
      pagineSeparate.push(`${s.etichetta} (pag. ${pagine.join(', ')})`)
    }
    return { ...s, file }
  }))

  const esito = await componiFascicoloBase(sorgentiDivise, opzioni) // dal motore generico
  return { ...esito, pagineSeparate }
}
```

`FascicoloSection.tsx` non cambia punto di chiamata (importa già
`componiFascicolo` da `@/services/fascicolo/componiPdf`), ma:

- l'interfaccia locale `Esito` (riga 40-47) guadagna `pagineSeparate: string[]`;
- l'`Alert` di riepilogo (riga 480-485) guadagna una riga sullo stile di
  `ridotti`/`scartati`:
  `{esito.pagineSeparate.length > 0 && \` Pagine doppie separate: ${esito.pagineSeparate.join(', ')}.\`}`

### 4. Gestione errori

- Se lo split di una singola pagina fallisce (pagina corrotta, embed che
  pdf-lib rifiuta, rasterizzazione che solleva un'eccezione), quella pagina
  resta **intatta e non separata** nel documento risultante — non si perde
  né si fa fallire l'intero file. Filosofia più conservativa di quella già
  in uso in `aggiungiPaginePdf` ("meglio perdere quella pagina che il
  certificato"): qui si preferisce una pagina doppia non ideale piuttosto
  che nessuna pagina.
- Se l'intero modulo fallisce nell'aprire/processare il PDF, si restituisce
  il file originale invariato (`pagineSeparate: []`) — il resto della
  pipeline di composizione prosegue come se la pagina non fosse mai stata
  candidata allo split.

## Testing

- `ePaginaDoppia`: test Vitest puri su coppie (larghezza, altezza) —
  proporzioni esatte √2, dentro/fuori la tolleranza ±8% (bordi inclusi),
  pagina verticale (mai candidata), pagina orizzontale con proporzioni
  lontane da √2 (es. uno schema panoramico, non deve scattare).
- `dividiPagineDoppie`: test con un PDF sintetico costruito al volo nel test
  con `pdf-lib` (una pagina normale + una pagina doppia con contenuto
  riconoscibile sulle due metà) — verifica che il file risultante abbia una
  pagina in più, che `pagineSeparate` riporti l'indice corretto, e che un
  file senza pagine doppie torni invariato (stesso numero di pagine, nessun
  elemento in `pagineSeparate`).
- La correttezza *visiva* della rotazione (verso giusto, leggibile e non
  capovolto) non è verificabile in modo affidabile da un test automatico:
  si conferma generando un fascicolo reale dal certificato SICC allegato e
  controllandolo a vista, come passaggio manuale prima di considerare la
  funzionalità completa.
- `pdfCompose/componiPdf.ts` e i suoi test restano invariati: nessuna
  modifica attesa lì, la verifica è che continuino a passare così come
  sono.

## Fuori scope

- Pagine doppie affiancate in **verticale** (una sopra l'altra, non fianco a
  fianco): non risulta dagli esempi forniti, non gestito.
- Estensione della stessa logica ad altri motori (`dichiarazioni`): non
  richiesta ora; l'architettura a modulo separato la rende possibile in
  futuro senza toccare `pdfCompose`.
- Split di pagine con più di due sotto-pagine affiancate (es. tre A5 su un
  A4 orizzontale): non risulta dagli esempi forniti, non gestito.
