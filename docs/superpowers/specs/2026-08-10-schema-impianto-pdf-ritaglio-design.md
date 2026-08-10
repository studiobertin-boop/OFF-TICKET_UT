# Schema d'impianto: caricamento PDF e ritaglio automatico

Data: 2026-08-10
Stato: approvato, da implementare

## Obiettivo

Nello step "Dati relazione" della relazione tecnica DM329, il campo di scelta
dello schema d'impianto (§2.3) oggi accetta solo PNG/JPEG e incorpora
l'immagine così com'è, a piena larghezza di pagina con altezza proporzionale
(o viceversa per i formati ritratto). Va esteso per:

1. accettare anche il formato PDF;
2. ritagliare automaticamente l'immagine (o la prima pagina del PDF) al
   contenuto effettivo dello schema, con un margine di circa 1 mm oltre il
   disegno, prima di incorporarla nel documento.

## Perché serve

Gli schemi arrivano da software di disegno diversi (CAD, Visio, export PDF) e
quasi sempre con un margine bianco intorno al disegno vero e proprio, di
larghezza variabile. Quel margine, sommato alla logica attuale che riempie la
larghezza di pagina, riduce lo spazio effettivo occupato dal disegno: a parità
di pagina disponibile, uno schema con margini ampi finisce più piccolo di uno
già ritagliato stretto. Ritagliare al contenuto rende la dimensione finale
indipendente da quanto margine il software sorgente ha lasciato attorno al
disegno.

Il PDF è il formato con cui questi schemi vengono più spesso esportati dai
software di disegno tecnico: oggi va convertito a mano in immagine prima di
poterlo caricare.

## Non cambia

L'algoritmo di impaginazione in `dimensioniSchema()`
(`src/services/relazione/renderRelazione.ts`) già implementa esattamente il
comportamento richiesto: larghezza massima 640 px (= larghezza utile di
pagina) con altezza proporzionale, e cede alla larghezza solo quando
l'altezza supererebbe i 900 px disponibili (formati ritratto) — confermato dai
test in `__tests__/schemaImpianto.test.ts`. Il ritaglio agisce **a monte**, su
cosa entra in `SchemaImpianto.dati/larghezzaPx/altezzaPx`: quella funzione non
si tocca.

Resta invariata anche la decisione di non persistere lo schema (Fase 4 del
piano relazione DM329): il file si legge in memoria e va riselezionato a ogni
generazione.

## Design

### 1. Riconoscimento del contenuto — modulo puro

Nuovo `src/services/relazione/schemaCrop.ts`, senza dipendenze dal DOM (sullo
stile di `utils/valvoleImpianto.ts`), testabile in Node con array di pixel
costruiti a mano:

```ts
interface Riquadro { minX: number; minY: number; maxX: number; maxY: number } // max esclusivi

function riquadroContenuto(
  pixels: Uint8ClampedArray, larghezza: number, altezza: number, soglia?: number
): Riquadro | null

function riquadroConMargine(
  r: Riquadro, marginePx: number, larghezza: number, altezza: number
): Riquadro
```

`riquadroContenuto` campiona il colore di sfondo dai 4 angoli dell'immagine
(media dei canali) e scandisce tutti i pixel: un pixel è "contenuto" se il suo
alpha si scosta significativamente da quello di riferimento (copre gli sfondi
trasparenti, tipici di un PDF vettoriale senza riempimento di pagina), oppure
— a parità di alpha — se un canale RGB si scosta oltre una soglia di
tolleranza (copre gli sfondi bianchi/chiari delle immagini raster,
tollerando l'antialiasing). Soglia di default 24/255: tunable, da rivedere se
il ritaglio in produzione risultasse troppo o troppo poco aggressivo. Ritorna
`null` se nessun pixel supera la soglia (immagine vuota): in quel caso non si
ritaglia nulla, l'immagine intera resta il fallback non bloccante.

`riquadroConMargine` espande il riquadro del margine in pixel richiesto,
con clamp ai bordi dell'immagine (un contenuto che tocca già il bordo non
genera un riquadro fuori dai limiti).

### 2. Lettura del file — modulo DOM (`schemaImpiantoFile.ts`)

Resta l'unico punto che tocca `Image`/`canvas`/`URL.createObjectURL`, non
coperto da test unitari (come oggi, dichiarato nel commento di testa del
file).

`FORMATI_SCHEMA` si estende a `application/pdf`; il riconoscimento del PDF
riusa `isPDFFile` da `@/utils/pdfToImage` (già dipendenza del progetto, già
usata per l'OCR) per coprire anche i browser che non valorizzano il MIME
type. Il limite di 10 MB (`SCHEMA_MAX_BYTE`) si applica al file originale
caricato, prima di qualunque conversione.

Pipeline di `leggiSchemaImpianto(file)`:

1. Se PDF: prima pagina sempre (nessun selettore — gli schemi sono quasi
   sempre PDF a pagina singola), renderizzata via `convertPDFPageToImage`
   (già esistente, riuso diretto) a scala 2.0 → 144 dpi noti con certezza,
   perché fissati da noi in fase di rendering. Altrimenti: il file stesso,
   96 dpi assunti (stessa convenzione già documentata nel commento di
   `SCHEMA_LARGHEZZA_PX` in `renderRelazione.ts`).
2. L'immagine di lavoro (file originale o pagina PDF renderizzata) si
   disegna su un canvas della sua dimensione nativa.
3. `riquadroContenuto` + `riquadroConMargine` (margine = 1 mm convertiti in
   px con il dpi del passo 1) sui pixel del canvas.
4. Ritaglio: nuovo canvas delle dimensioni del riquadro risultante,
   `drawImage` con sorgente ritagliata. Esportato sempre in PNG (il ritaglio
   richiede comunque una ri-codifica; PNG è lossless, adatto a un disegno
   tecnico — anche quando l'originale era JPEG).
5. Ritorna `{ dati, larghezzaPx, altezzaPx, nomeFile }` con le dimensioni
   del riquadro ritagliato: da qui in poi la pipeline esistente
   (`dimensioniSchema`, incorporamento) non cambia.

### 3. UI (`RelazioneDataDialog.tsx`)

- `accept` dell'input file: `image/png,image/jpeg,application/pdf`.
- Testo di aiuto sotto il titolo "Schema d'impianto (§2.3)" aggiornato per
  menzionare il PDF e il ritaglio automatico.
- **Miniatura di anteprima**: dopo la lettura riuscita, un `<img>` piccolo
  costruito da un object URL sui byte già ritagliati restituiti da
  `leggiSchemaImpianto` — è esattamente ciò che finirà nel `.docx`, quindi
  l'anteprima è accurata 1:1, non un'approssimazione. L'URL si revoca alla
  sostituzione, alla rimozione e alla chiusura del dialog.
- Il testo con nome file e dimensioni resta, ora riferito alle dimensioni
  post-ritaglio.

## Testing

- `schemaCrop.ts`: test Vitest con array di pixel costruiti a mano —
  immagine bianca con un rettangolo di contenuto in posizione nota, sfondo
  trasparente (caso PDF), immagine completamente vuota (→ `null`), contenuto
  che tocca già un bordo (il margine non deve sconfinare), soglia che
  tollera un piccolo scarto cromatico senza marcare tutto come contenuto.
- La parte DOM (`schemaImpiantoFile.ts`, lettura file/PDF/canvas) resta priva
  di test unitari, come oggi: verifica manuale in app (upload PNG, upload
  JPEG, upload PDF pagina singola, immagine già ritagliata a filo, immagine
  con margine ampio) prima di considerare il lavoro concluso.
- `renderRelazione.ts` e i suoi test restano invariati: nessuna modifica
  attesa lì, la verifica è che continuino a passare così come sono.
