# Supporto PDF per OCR Apparecchiature

## Panoramica

Il sistema OCR ora supporta l'analisi di **schede tecniche in formato PDF** oltre alle foto di targhette. I PDF vengono automaticamente convertiti in immagini e processati tramite GPT-4o Vision.

## Funzionalità

### 1. Conversione Automatica PDF → Immagini

- **Libreria utilizzata**: `pdfjs-dist` (Mozilla PDF.js)
- **Processo**:
  1. Caricamento PDF nel browser
  2. Rendering di ogni pagina su canvas HTML5
  3. Conversione canvas in immagine JPEG (qualità 92%)
  4. Creazione di un `File` object per ogni pagina

### 2. Componenti Aggiornati

#### PhotoUploadSection
- **File path**: `src/components/technicalSheet/PhotoUploadSection.tsx`
- **Modifiche**:
  - Accetta `accept="image/*,application/pdf"`
  - Rileva file PDF con `isPDFFile()`
  - Converte PDF in array di immagini
  - Mostra badge "PDF - Pagina X/Y" per pagine convertite

#### BatchOCRDialog
- **File path**: `src/components/technicalSheet/BatchOCRDialog.tsx`
- **Modifiche**:
  - Supporto PDF multi-pagina nel batch processing
  - Badge PDF nella tabella risultati
  - Istruzioni aggiornate per utente

### 3. Utility PDF

**File**: `src/utils/pdfToImage.ts`

#### Funzioni principali:

```typescript
convertPDFToImages(
  file: File,
  scale: number = 2.0,
  maxPages: number = 10
): Promise<PDFConversionResult>
```

Converte tutte le pagine del PDF in immagini.

**Parametri**:
- `file`: File PDF da convertire
- `scale`: Fattore di scala per qualità (default: 2.0 = alta qualità)
- `maxPages`: Limite massimo pagine (default: 10)

**Ritorna**:
```typescript
{
  pages: PDFPageImage[]  // Array di immagini
  totalPages: number     // Totale pagine nel PDF
  fileName: string       // Nome file originale
}
```

#### Altre funzioni:

- `convertPDFPageToImage()`: Converte singola pagina
- `isPDFFile()`: Verifica se un file è PDF
- `estimatePDFImageSize()`: Stima dimensione memoria risultante

### 4. Types Aggiornati

**File**: `src/types/ocr.ts`

Nuovi campi in `UploadedPhoto` e `BatchOCRItem`:

```typescript
interface UploadedPhoto {
  // ... campi esistenti

  // PDF support
  is_pdf_page?: boolean
  pdf_page_number?: number
  pdf_total_pages?: number
  pdf_original_name?: string
}
```

## Limitazioni e Configurazione

### Limiti attuali:

1. **Dimensione file**: Max 10MB per PDF (come per le immagini)
2. **Numero pagine**: Max 10 pagine per PDF
3. **Formato output**: JPEG (qualità 92%)
4. **Worker PDF.js**: Caricato da CDN CloudFlare

### Configurazione Worker

Il worker PDF.js è configurato in `src/utils/pdfToImage.ts`:

```typescript
pdfjsLib.GlobalWorkerOptions.workerSrc =
  `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`
```

**Nota**: Per ambienti offline, il worker può essere servito localmente.

## Workflow Utente

### Scenario 1: Upload Singolo PDF (PhotoUploadSection)

1. Utente clicca "Carica Foto"
2. Seleziona PDF scheda tecnica
3. Sistema mostra progress conversion
4. Ogni pagina appare come card separata con badge "PDF - Pagina X/Y"
5. Utente seleziona tipo apparecchiatura per ogni pagina
6. Utente clicca "Analizza" per avviare OCR

### Scenario 2: Batch Upload con PDF (BatchOCRDialog)

1. Utente clicca "Riconosci Automaticamente"
2. Seleziona mix di immagini e PDF
3. PDF vengono convertiti automaticamente
4. Tabella mostra tutte le pagine con badge PDF
5. Sistema processa tutte le pagine in sequenza
6. Risultati applicati al form scheda dati

## Vantaggi

✅ **Compatibilità**: Supporta schede tecniche da fornitori in PDF
✅ **Multi-pagina**: Estrae dati da documenti complessi
✅ **Qualità**: Alta risoluzione (scale 2.0 = 2x rendering)
✅ **UX trasparente**: Utente non vede differenza tra foto e PDF
✅ **Riuso codice**: Utilizza la stessa pipeline OCR esistente

## Considerazioni Performance

### Memoria Browser

- Ogni pagina PDF renderizzata occupa ~2-3MB RAM
- PDF da 10 pagine ≈ 25-30MB in memoria
- Le Blob URLs vengono ripulite con `URL.revokeObjectURL()`

### Tempo Conversione

- Pagina singola: ~500ms - 1s
- PDF 5 pagine: ~2-5s
- PDF 10 pagine: ~5-10s

### Ottimizzazioni Future

1. **Web Worker**: Spostare conversione in background thread
2. **Lazy Loading**: Convertire pagine on-demand
3. **Caching**: Salvare preview convertite in IndexedDB
4. **Compressione**: Ridurre qualità JPEG per preview (analisi usa originale)

## Troubleshooting

### Errore "Impossibile caricare PDF"

**Causa**: PDF corrotto o protetto da password
**Soluzione**: Verificare integrità file, rimuovere protezione

### Errore "Worker not found"

**Causa**: CDN CloudFlare non raggiungibile
**Soluzione**: Servire worker localmente da `node_modules/pdfjs-dist`

### Performance lente

**Causa**: PDF ad alta risoluzione o troppe pagine
**Soluzione**: Ridurre `scale` a 1.5 o `maxPages` a 5

## Dipendenze

```json
{
  "pdfjs-dist": "^4.x.x"
}
```

Installata con: `npm install pdfjs-dist`

## Testing

### Test Manuale

1. Preparare PDF scheda tecnica (es. compressore Atlas Copco)
2. Accedere a pagina Scheda Dati DM329
3. Caricare PDF in PhotoUploadSection
4. Verificare conversione e badge
5. Analizzare con OCR
6. Verificare dati estratti

### Test Batch

1. Preparare mix: 2 foto + 1 PDF (3 pagine)
2. Aprire BatchOCRDialog
3. Caricare tutti i file insieme
4. Verificare tabella mostra 5 righe totali
5. Avviare batch analysis
6. Verificare completamento

## Riferimenti

- [Mozilla PDF.js](https://mozilla.github.io/pdf.js/)
- [pdfjs-dist NPM](https://www.npmjs.com/package/pdfjs-dist)
- [Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
- [Blob API](https://developer.mozilla.org/en-US/docs/Web/API/Blob)
