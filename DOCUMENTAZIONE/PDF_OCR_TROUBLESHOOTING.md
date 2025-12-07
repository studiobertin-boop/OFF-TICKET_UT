# Troubleshooting PDF OCR - Problemi Risolti

## Problema 1: File Picker non mostra PDF

### Sintomo
Quando si clicca "Carica Foto", il file picker mostra solo immagini. Bisogna cambiare manualmente in "Tutti i files" per vedere i PDF.

### Causa
L'attributo `accept="image/*,application/pdf"` su Windows potrebbe non includere automaticamente `.pdf` come estensione riconosciuta.

### Soluzione ✅
Aggiunta estensione esplicita `.pdf`:

**Prima:**
```html
<input accept="image/*,application/pdf" />
```

**Dopo:**
```html
<input accept="image/*,.pdf,application/pdf" />
```

**File modificati:**
- `src/components/technicalSheet/PhotoUploadSection.tsx:287`
- `src/components/technicalSheet/BatchOCRDialog.tsx:320`

## Problema 2: "Il sistema lavora per qualche secondo poi più niente"

### Sintomo
Dopo aver selezionato un PDF, il sistema sembra elaborare ma non c'è feedback visivo. L'utente non sa se sta funzionando o si è bloccato.

### Causa
La conversione PDF → Immagini richiede tempo (1-2s per pagina) ma non c'era indicatore di progresso visibile.

### Soluzione ✅

#### 1. Stato Loading sul Pulsante
**File:** `PhotoUploadSection.tsx:296-300`

```tsx
<Button
  startIcon={uploading ? <CircularProgress size={20} /> : <UploadIcon />}
  disabled={uploading}
>
  {uploading ? 'Elaborazione...' : 'Carica Foto'}
</Button>
```

#### 2. Alert con Messaggio di Stato
**File:** `PhotoUploadSection.tsx:316-323`

```tsx
{uploadStatus && (
  <Alert severity="info">
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <CircularProgress size={20} />
      <Typography>{uploadStatus}</Typography>
    </Box>
  </Alert>
)}
```

Messaggi mostrati:
- `"Elaborazione file in corso..."`
- `"Conversione PDF nomefile.pdf in corso..."`

## Problema 3: Errore "invalid_image_format" dall'Edge Function

### Sintomo
```
OCR: Edge Function error (500):
{"success":false,"error":"OpenAI API error: ...
\"invalid_request_error\",\"param\":\"invalid_image_format\""}
```

### Cause Possibili

#### Causa A: Formato Immagine Non Supportato
L'Edge Function invia sempre `data:image/jpeg;base64,...` ma l'immagine potrebbe essere PNG o altro formato.

**Verifica con logging:**
```typescript
console.log(`🔄 Conversione file: ${photo.file.type}, size: ${photo.file.size}`)
console.log(`📤 Invio a Edge Function: ${base64Data.substring(0, 50)}...`)
```

**File:** `PhotoUploadSection.tsx:200-205`

#### Causa B: Base64 Corrotto o Incompleto
La conversione canvas → blob → base64 potrebbe non completarsi correttamente.

**Verifica con logging:**
```typescript
console.log(`📸 Pagina ${page.pageNumber}: ${imageFile.size} bytes`)
console.log(`✅ Totale foto create da PDF: ${result.pages.length}`)
```

**File:** `PhotoUploadSection.tsx:101, 119`

#### Causa C: Dimensione Eccessiva
Immagini troppo grandi (> 20MB base64) potrebbero essere rifiutate da OpenAI.

**Soluzione possibile:**
Ridurre `scale` nella conversione PDF:

```typescript
// In PhotoUploadSection.tsx:91
const result = await convertPDFToImages(file, 1.5, 10) // era 2.0
```

## Debug: Come Analizzare l'Errore

### Step 1: Verifica Console Browser
Apri DevTools (F12) → Console e cerca questi log:

```
📄 Rilevato PDF: nomefile.pdf, size: 2456789 bytes
📄 PDF caricato: 3 pagine
🔄 Conversione pagina 1/3...
✅ Pagina 1 convertita (247532 bytes)
📸 Pagina 1: 247532 bytes, type: image/jpeg
✅ PDF convertito: 3 pagine
✅ Totale foto create da PDF: 3
```

### Step 2: Verifica OCR Analysis
Quando clicchi "Analizza":

```
🔄 Conversione file in base64: nomefile_page1.jpg, type: image/jpeg, size: 247532
📤 Invio a Edge Function: /9j/4AAQSkZJRgABAQAAAQABAAD... (330042 chars)
📝 Parametri: equipment_type=serbatoio, equipment_code=undefined
📥 Response status: 200 OK
```

### Step 3: Se Errore 500
```
📥 Response status: 500 Internal Server Error
❌ Edge Function error response: {"success":false,"error":"..."}
```

**Copia il messaggio di errore completo** e verifica:

1. **"invalid_image_format"**: Immagine non riconosciuta
2. **"rate_limit_exceeded"**: Troppe richieste OpenAI
3. **"insufficient_quota"**: Quota OpenAI esaurita
4. **"context_length_exceeded"**: Immagine troppo grande

## Soluzioni Alternative

### Se continua a non funzionare:

#### Opzione 1: Ridurre Qualità Immagine
**File:** `pdfToImage.ts:73-77`

```typescript
await page.render({
  canvasContext: context,
  viewport: viewport,
  canvas: canvas
}).promise
```

Cambia scala in:
```typescript
// PhotoUploadSection.tsx:91
const result = await convertPDFToImages(file, 1.0, 10) // minima qualità
```

#### Opzione 2: Limitare Numero Pagine
```typescript
// PhotoUploadSection.tsx:91
const result = await convertPDFToImages(file, 2.0, 3) // max 3 pagine
```

#### Opzione 3: Convertire in PNG
**File:** `pdfToImage.ts:80-90`

```typescript
canvas.toBlob(
  (result) => { /* ... */ },
  'image/png', // era 'image/jpeg'
  1.0          // qualità massima PNG
)
```

E in PhotoUploadSection:
```typescript
const imageFile = new File(
  [page.blob],
  `${file.name.replace('.pdf', '')}_page${page.pageNumber}.png`, // .png
  { type: 'image/png' } // era image/jpeg
)
```

## Test Completo

### 1. Prepara File Test
- PDF piccolo (1-2 pagine, < 1MB)
- PDF scheda tecnica reale (3-5 pagine)
- Immagine normale JPG per confronto

### 2. Test Upload
```
1. Click "Carica Foto"
   ✅ File picker mostra PDF
2. Seleziona PDF
   ✅ Button mostra "Elaborazione..."
   ✅ Alert mostra "Conversione PDF..."
3. Attendi completamento
   ✅ Card appaiono per ogni pagina
   ✅ Badge "PDF - Pagina X/Y" visibile
```

### 3. Test OCR
```
1. Seleziona tipo apparecchiatura
2. Click "Analizza"
   ✅ Status "Analisi in corso..."
3. Verifica console per errori
   ✅ Status "Completato"
   ✅ Dati estratti nel form
```

## Log da Inviare per Supporto

Se il problema persiste, invia:

1. **Console log completo** dalla selezione file alla fine OCR
2. **Screenshot** del file picker
3. **File PDF di test** (se possibile)
4. **Browser e versione** (es: Chrome 120)
5. **Dimensione PDF** e numero pagine

Esempio log utile:
```
📄 Rilevato PDF: scheda_compressore.pdf, size: 1523456 bytes
📄 PDF caricato: 4 pagine
🔄 Conversione pagina 1/4...
✅ Pagina 1 convertita (245678 bytes)
📸 Pagina 1: 245678 bytes, type: image/jpeg
[ripeti per altre pagine]
✅ PDF convertito: 4 pagine
🔄 Conversione file in base64: scheda_compressore_page1.jpg...
📤 Invio a Edge Function: /9j/4AAQ... (330042 chars)
📥 Response status: 500
❌ Edge Function error response: {"success":false,"error":"OpenAI API error: invalid_image_format"}
```

## Riferimenti Codice

### File Modificati
1. `src/components/technicalSheet/PhotoUploadSection.tsx`
   - Linee 50, 71, 85-123, 200-230, 287, 296-323

2. `src/components/technicalSheet/BatchOCRDialog.tsx`
   - Linea 320

3. `src/utils/pdfToImage.ts`
   - Tutto il file (nuovo)

### Commit di Riferimento
- feat: Add PDF support for OCR with improved UX feedback
- fix: File picker now shows PDF by default
- fix: Add loading indicators during PDF conversion
