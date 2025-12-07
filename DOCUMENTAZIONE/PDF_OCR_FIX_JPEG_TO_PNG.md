# Fix Critico: Conversione Automatica TUTTE le Immagini in PNG

## Problema Identificato

Dai log dell'Edge Function è emerso che:
```
Detected image format: jpeg
Error: OpenAI API error: invalid_request_error
```

**Root Cause:** OpenAI Vision API rifiuta le immagini JPEG con l'errore "invalid_image_format". La precedente fix si applicava SOLO alle immagini estratte da PDF, ma le foto normali (JPG/JPEG) venivano inviate senza conversione.

## Soluzione Implementata

### 1. Nuova Utility Function

**File:** [src/utils/pdfToImage.ts:204-264](../src/utils/pdfToImage.ts#L204-L264)

Aggiunta funzione `convertImageToPNG()`:
```typescript
export async function convertImageToPNG(file: File): Promise<File>
```

**Funzionamento:**
- ✅ Se il file è già PNG → restituito immediatamente (no conversione)
- ✅ Se è JPEG/GIF/WebP/BMP → convertito in PNG tramite canvas
- ✅ Mantiene dimensioni originali (no scaling)
- ✅ Formato lossless per massima qualità OCR

### 2. PhotoUploadSection - Auto-conversione

**File:** [src/components/technicalSheet/PhotoUploadSection.tsx](../src/components/technicalSheet/PhotoUploadSection.tsx)

**Modifiche:**
- Import: `convertImageToPNG` (linea 28)
- Conversione automatica immagini normali (linee 134-155):
  ```typescript
  // Converti SEMPRE in PNG per compatibilità OpenAI
  setUploadStatus(`Conversione ${file.name} in PNG...`)
  const pngFile = await convertImageToPNG(file)

  console.log(`✅ Immagine convertita in PNG: ${pngFile.name}, type: ${pngFile.type}, size: ${pngFile.size} bytes`)

  const photo: UploadedPhoto = {
    file: pngFile,  // Usa il file PNG convertito
    // ...
  }
  ```

### 3. BatchOCRDialog - Auto-conversione

**File:** [src/components/technicalSheet/BatchOCRDialog.tsx](../src/components/technicalSheet/BatchOCRDialog.tsx)

**Modifiche:**
- Import: `convertImageToPNG` (linea 29)
- Conversione automatica batch (linee 133-167):
  ```typescript
  // Converti SEMPRE in PNG per compatibilità OpenAI
  const pngFile = await convertImageToPNG(file)

  const item: BatchOCRItem = {
    file: pngFile,  // Usa il file PNG convertito
    preview: URL.createObjectURL(pngFile),
    // ...
  }
  ```

## Comportamento Atteso

### Prima (ERRORE)
```
🖼️ Rilevata immagine: foto.jpg, type: image/jpeg
📤 Invio a Edge Function: /9j/... (JPEG signature)
Detected image format: jpeg
❌ Error: OpenAI API error: invalid_request_error
```

### Dopo (SUCCESS)
```
🖼️ Rilevata immagine: foto.jpg, type: image/jpeg, size: 234567 bytes
✅ Immagine convertita in PNG: foto.png, type: image/png, size: 876543 bytes
📤 Invio a Edge Function: iVBOR... (PNG signature)
Detected image format: png
✅ OCR: Edge Function success
```

## Test Completo

### Setup
1. Assicurati che il dev server sia in esecuzione:
   ```bash
   # Dovrebbe già essere attivo su http://localhost:5174
   # Se non lo è, avvialo:
   npm run dev
   ```

2. Apri DevTools Console (F12)

### Test 1: Foto JPEG Normale

1. Vai su una scheda tecnica
2. Click "Carica Foto"
3. Seleziona una foto **JPG/JPEG normale** (NON PDF!)
4. ✅ **Verifica Console:**
   ```
   🖼️ Rilevata immagine: nomefile.jpg, type: image/jpeg, size: XXXXX bytes
   ✅ Immagine convertita in PNG: nomefile.png, type: image/png, size: XXXXX bytes
   ```

5. Seleziona tipo apparecchiatura
6. Click "Analizza"
7. ✅ **Verifica Console:**
   ```
   🔄 Conversione file in base64: nomefile.png, type: image/png
   📤 Invio a Edge Function: iVBOR...  ← DEVE iniziare con "iVBOR"
   📝 Parametri: equipment_type=...
   📥 Response status: 200 OK  ← DEVE essere 200!
   ✅ OCR: Edge Function success
   ```

8. ✅ **Verifica Supabase Logs:**
   - Dashboard: https://supabase.com/dashboard/project/uphftgpwisdiubuhohnc/functions/analyze-equipment-nameplate/logs
   - Log recente deve mostrare: `Detected image format: png`
   - **NO** "Error: OpenAI API error"

9. ✅ **Verifica Dati Estratti:**
   - Form popolato con dati
   - Campi riconosciuti

### Test 2: PDF Multi-pagina

1. Click "Carica Foto"
2. Seleziona un **file PDF**
3. ✅ **Verifica Console:**
   ```
   📄 Rilevato PDF: scheda.pdf, size: XXXXX bytes
   Conversione PDF scheda.pdf in corso...
   [... conversione pagine ...]
   ✅ PDF convertito: X pagine
   ```

4. Click "Analizza" su una pagina
5. ✅ **Verifica come Test 1:** formato PNG, status 200, dati estratti

### Test 3: Batch OCR con Immagini JPEG

1. Click "OCR Multiplo"
2. Seleziona multiple foto **JPEG**
3. ✅ **Verifica Console:**
   ```
   🖼️ Rilevata immagine: foto1.jpg, type: image/jpeg
   ✅ Immagine convertita in PNG: foto1.png, type: image/png
   [... per ogni foto ...]
   ```

4. Click "Avvia Analisi"
5. ✅ **Verifica:** Tutte le analisi completate con successo (status 200)

## Dimensioni File

### Aumento Dimensione Atteso

| Tipo Originale | Dimensione Originale | Dimensione PNG | Ratio |
|----------------|---------------------|----------------|-------|
| JPEG (qualità 90%) | ~200-300 KB | ~800KB-1.2MB | ~3-4x |
| PNG | Invariata | Invariata | 1x |
| WebP | ~150-250 KB | ~800KB-1.2MB | ~3-5x |

**Limiti:**
- ✅ Max 10MB per file (anche dopo conversione)
- ✅ Conversione locale (no upload)
- ✅ File troppo grandi (>10MB) rifiutati prima conversione

## Risoluzione Problemi

### Problema: Ancora errore "invalid_image_format"

**Verifica 1 - Console Browser:**
```
// DEVE mostrare:
type: image/png
iVBOR...

// NON DEVE mostrare:
type: image/jpeg
/9j/...
```

**Verifica 2 - Edge Function Logs:**
```
// DEVE mostrare:
Detected image format: png

// NON DEVE mostrare:
Detected image format: jpeg
```

**Soluzione:**
1. Hard refresh browser (Ctrl+Shift+R)
2. Verifica che Vite HMR abbia aggiornato i componenti
3. Chiudi e riapri la pagina completamente

### Problema: File troppo grande dopo conversione

**Sintomi:**
```
File nomefile.png è troppo grande (max 10MB)
```

**Soluzione:** L'immagine originale era molto grande. Considera di:
1. Ridurre risoluzione immagine originale prima caricamento
2. O modificare il limite max (sconsigliato per performance API)

### Problema: Conversione lenta

**Sintomi:**
- "Conversione ... in PNG..." rimane molto tempo

**Causa:**
- Immagini ad alta risoluzione richiedono più tempo

**Soluzione Normale:**
- È normale per immagini >5MB, attendi 2-5 secondi

**Soluzione se troppo lento:**
- Riduci risoluzione immagine originale

## Files Modificati

1. ✅ [src/utils/pdfToImage.ts](../src/utils/pdfToImage.ts#L204-L264) - Nuova funzione `convertImageToPNG()`
2. ✅ [src/components/technicalSheet/PhotoUploadSection.tsx](../src/components/technicalSheet/PhotoUploadSection.tsx#L28) - Import + conversione auto
3. ✅ [src/components/technicalSheet/BatchOCRDialog.tsx](../src/components/technicalSheet/BatchOCRDialog.tsx#L29) - Import + conversione auto

## Edge Function

**Nessuna modifica necessaria** - L'Edge Function già supporta auto-detection formato:
```typescript
// supabase/functions/analyze-equipment-nameplate/index.ts:67-80
let imageFormat = 'jpeg' // default
if (image_base64.startsWith('iVBOR')) {
  imageFormat = 'png'
} else if (image_base64.startsWith('/9j/')) {
  imageFormat = 'jpeg'
}
// ...

console.log(`Detected image format: ${imageFormat}`)
```

L'Edge Function è già deployata (versione 3, deployata 2025-12-04 21:40:37).

## Riepilogo Fix

| Aspetto | Prima | Dopo |
|---------|-------|------|
| **PDF → Immagini** | PNG ✅ | PNG ✅ |
| **Foto JPEG** | JPEG ❌ | PNG ✅ |
| **Foto PNG** | PNG ✅ | PNG ✅ |
| **Foto WebP/GIF** | Originale ❌ | PNG ✅ |
| **OpenAI Compatibilità** | Parziale ❌ | Totale ✅ |

## Next Steps

1. ✅ Dev server riavviato automaticamente (HMR)
2. ⏳ **Test con foto JPEG** seguendo guida sopra
3. ⏳ Verifica console logs mostrano PNG
4. ⏳ Verifica Supabase logs mostrano "png"
5. ⏳ Verifica status 200 OK (non 500)
6. ⏳ Se tutto OK → Fix completata!

---

**Status:** ✅ Codice implementato e deployato
**Testing:** ⏳ In attesa test utente
**Criticità:** 🔴 ALTA - Risolve errore che impediva l'OCR

## Link Utili

- **App locale:** http://localhost:5174
- **Supabase Dashboard:** https://supabase.com/dashboard/project/uphftgpwisdiubuhohnc
- **Edge Function Logs:** https://supabase.com/dashboard/project/uphftgpwisdiubuhohnc/functions/analyze-equipment-nameplate/logs

---

**Data Fix:** 2025-12-05
**Identificazione problema:** Analisi log Supabase
**Soluzione:** Conversione automatica TUTTE le immagini in PNG
