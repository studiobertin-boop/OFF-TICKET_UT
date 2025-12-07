# Guida Test Supporto PDF OCR

## Prerequisiti

1. Server di sviluppo avviato: `npm run dev`
2. File PDF di test disponibili (schede tecniche apparecchiature)
3. Browser moderno (Chrome, Firefox, Edge)

## Test 1: Upload Singolo PDF (PhotoUploadSection)

### Passi:

1. **Accedi alla pagina Scheda Dati**
   - Menu → Schede Dati DM329
   - Clicca "Nuova Scheda" o apri una esistente

2. **Scorri alla sezione apparecchiature**
   - Es: "Serbatoi", "Compressori", etc.

3. **Carica PDF**
   - Clicca "Carica Foto" nella sezione apparecchiature
   - Seleziona un PDF di scheda tecnica (es: `compressore_atlas_copco.pdf`)

4. **Verifica conversione**
   - ✅ Ogni pagina appare come card separata
   - ✅ Badge "PDF - Pagina X/Y" visibile
   - ✅ Nome file originale mostrato sotto il badge
   - ✅ Preview immagine renderizzata correttamente

5. **Seleziona tipo apparecchiatura**
   - Dropdown per ogni pagina
   - Seleziona tipo appropriato (es: "Compressore")

6. **Analizza con OCR**
   - Clicca "Analizza" su una pagina
   - Attendi elaborazione GPT-4o Vision
   - ✅ Status cambia: "Da analizzare" → "Analisi in corso..." → "Completato"

7. **Verifica dati estratti**
   - Controlla console browser per log OCR
   - Verifica che i campi del form siano popolati
   - ✅ Marca, modello, numero fabbrica estratti

### Risultato atteso:

```
📄 Rilevato PDF: compressore_atlas_copco.pdf
📄 PDF caricato: 3 pagine
🔄 Conversione pagina 1/3...
✅ Pagina 1 convertita (247532 bytes)
🔄 Conversione pagina 2/3...
✅ Pagina 2 convertita (195847 bytes)
🔄 Conversione pagina 3/3...
✅ Pagina 3 convertita (183921 bytes)
✅ Conversione completata: 3 pagine
```

## Test 2: Batch Upload con Mix PDF e Immagini

### Prepara file test:

```
S1.jpg                      → Foto targhetta serbatoio 1
C1.jpg                      → Foto targhetta compressore 1
scheda_essiccatore.pdf      → PDF 2 pagine
```

### Passi:

1. **Apri BatchOCRDialog**
   - Nella scheda dati, clicca "Riconosci Automaticamente"

2. **Carica file multipli**
   - Seleziona tutti i file insieme (2 foto + 1 PDF)
   - ✅ Sistema elabora automaticamente

3. **Verifica tabella risultati**
   - ✅ Totale righe: 4 (2 foto + 2 pagine PDF)
   - ✅ Badge PDF visibile per pagine convertite
   - ✅ Colonna "Tipo" mostra convenzione naming per foto
   - ✅ Status "Da analizzare" per tutti

4. **Avvia batch analysis**
   - Clicca "Avvia Analisi (4)"
   - Attendi completamento
   - ✅ Progress bar avanza
   - ✅ Status aggiornato per ogni item

5. **Verifica risultati**
   - ✅ Colonna "Marca" popolata
   - ✅ Colonna "Modello" popolata
   - ✅ Chip verde "✓" per valori normalizzati

6. **Chiudi dialog**
   - Clicca "Chiudi"
   - ✅ Dati applicati al form principale
   - ✅ Sezioni apparecchiature popolate

### Risultato atteso nella tabella:

| Preview | Filename | Tipo | Marca | Modello | Status |
|---------|----------|------|-------|---------|--------|
| 🖼️ | S1.jpg | Serbatoio 1 | Atlas Copco | 270L | Completato |
| 🖼️ | C1.jpg | Compressore 1 | Atlas Copco | GA7 | Completato |
| 🖼️ | scheda_essiccatore.pdf - Pag. 1/2 [PDF Pag. 1/2] | - | Beko | DHS-22 | Completato |
| 🖼️ | scheda_essiccatore.pdf - Pag. 2/2 [PDF Pag. 2/2] | - | - | - | Completato |

## Test 3: Edge Cases

### Test 3.1: PDF Grande (10+ pagine)

**File**: `manuale_completo.pdf` (15 pagine)

**Comportamento atteso**:
- ✅ Solo prime 10 pagine convertite
- ⚠️ Warning in console: "PDF ha 15 pagine, verranno elaborate solo le prime 10"

### Test 3.2: PDF Protetto da Password

**File**: `scheda_protetta.pdf`

**Comportamento atteso**:
- ❌ Errore: "Errore conversione PDF: Password required"
- 🔔 Alert mostrato all'utente

### Test 3.3: File Corrotto

**File**: `documento_corrotto.pdf`

**Comportamento atteso**:
- ❌ Errore: "Errore conversione PDF: Invalid PDF structure"
- 🔔 Alert mostrato all'utente

### Test 3.4: PDF Troppo Grande

**File**: `scheda_hq.pdf` (15 MB)

**Comportamento atteso**:
- ❌ Errore validazione: "File troppo grande (max 10MB)"
- 🔔 Alert mostrato all'utente

### Test 3.5: Mix Valido/Non Valido

**File**:
- `S1.jpg` ✅
- `corrupted.pdf` ❌
- `C1.jpg` ✅

**Comportamento atteso**:
- ✅ File validi processati correttamente
- ❌ Alert per file corrotto
- ✅ Processo continua con file validi

## Test 4: Performance

### Metriche da verificare:

**Console Browser → Performance**

1. **Tempo conversione**:
   ```javascript
   // Cerca in console:
   "✅ Conversione completata: X pagine"
   // Verifica tempo < 10s per 5 pagine
   ```

2. **Memoria utilizzata**:
   - DevTools → Memory → Take snapshot
   - Verifica incremento < 50MB per PDF 5 pagine

3. **Cleanup Blob URLs**:
   ```javascript
   // Dopo chiusura dialog, verifica in console:
   // "Blob URLs revocate: X"
   ```

## Test 5: Integrazione End-to-End

### Scenario completo:

1. **Setup**
   - Cliente: "Test SRL"
   - Data sopralluogo: oggi

2. **Upload dati**
   - 1 foto serbatoio: `S1.jpg`
   - 1 PDF compressore: `datasheet_compressor.pdf` (2 pagine)
   - 1 foto essiccatore: `E1.jpg`

3. **Batch OCR**
   - Tutte le 4 immagini (1+2+1) elaborate
   - Dati normalizzati contro catalogo

4. **Review manuale**
   - Verifica campi popolati correttamente
   - Correggi eventuali errori OCR

5. **Salvataggio**
   - Salva scheda dati
   - ✅ PDF originale NON salvato (solo dati estratti)

6. **Verifica database**
   ```sql
   SELECT
     id,
     cliente,
     serbatoi::jsonb->'0'->'marca' as serbatoio_marca,
     compressori::jsonb->'0'->'marca' as compressore_marca
   FROM dm329_technical_data
   WHERE cliente = 'Test SRL'
   ORDER BY created_at DESC
   LIMIT 1;
   ```

## Checklist Test Completa

### Funzionalità Base
- [ ] PDF single-page caricato e convertito
- [ ] PDF multi-page (2-5 pagine) convertito
- [ ] Badge "PDF - Pagina X/Y" visibile
- [ ] Preview immagine renderizzata correttamente
- [ ] OCR estrae dati da pagina PDF

### Batch Processing
- [ ] Mix foto + PDF processato insieme
- [ ] Tutte le pagine appaiono in tabella
- [ ] Badge PDF visibile in tabella
- [ ] Batch analysis completa senza errori
- [ ] Dati applicati al form principale

### Validazione
- [ ] File > 10MB rifiutato
- [ ] PDF > 10 pagine limitato a 10
- [ ] PDF corrotto gestito con errore
- [ ] Alert messaggi chiari all'utente

### Performance
- [ ] Conversione < 2s per pagina singola
- [ ] Conversione < 10s per PDF 5 pagine
- [ ] Memoria incremento < 50MB
- [ ] Blob URLs ripulite correttamente

### UX
- [ ] Loading indicator durante conversione
- [ ] Progress bar batch analysis
- [ ] Messaggi errore comprensibili
- [ ] Istruzioni aggiornate visibili

### Database
- [ ] Solo dati estratti salvati (no PDF)
- [ ] Campi marca/modello normalizzati
- [ ] History tracking funziona

## Troubleshooting

### Problema: "Worker not found"

**Soluzione**:
```typescript
// In src/utils/pdfToImage.ts, cambia:
pdfjsLib.GlobalWorkerOptions.workerSrc =
  '/node_modules/pdfjs-dist/build/pdf.worker.min.js'
```

### Problema: Conversione lenta

**Soluzione**:
```typescript
// Riduci scale in convertPDFToImages:
const result = await convertPDFToImages(file, 1.5, 10) // era 2.0
```

### Problema: Out of memory

**Soluzione**:
```typescript
// Riduci maxPages:
const result = await convertPDFToImages(file, 2.0, 5) // era 10
```

## Report Bug

Se trovi bug, includi:

1. File PDF di test (se possibile)
2. Screenshot errore console
3. Versione browser
4. Log completo console
5. Passi per riprodurre

Apri issue su GitHub o riporta al team.
