# Stato Implementazione OCR con Normalizzazione
**Data:** 2025-01-13
**Branch:** feature/dm329-full-workflow
**Obiettivo:** Integrare OCR con bottoni "Riconosci Automaticamente" e "Compila da Foto" + normalizzazione marche/modelli

---

## ✅ COMPLETATO (Sessione 1)

### 1. Utilities Core (100%)

#### `src/utils/equipmentNormalizer.ts`
**Funzione principale:** Normalizzazione automatica marca/modello contro catalogo

**Funzioni:**
- `normalizeEquipment(tipo, marca, modello)` → Ritorna marca e modello normalizzati con confidence score
- `normalizeMarca()` → Match esatto o fuzzy per marca
- `normalizeModello()` → Match esatto o fuzzy per modello
- `requiresUserConfirmation(confidence)` → true se confidence 50-80%
- `shouldAutoNormalize(confidence)` → true se confidence >= 80%

**Logica:**
1. Match esatto (case-insensitive) → confidence 100%
2. Fuzzy match con similarity >= 50% → confidence = similarity * 100
3. No match → mantiene valore OCR raw, confidence 0%

**Esempi:**
```typescript
// OCR: "atlas copco" + "GA30"
await normalizeEquipment('Compressori', 'atlas copco', 'GA30')
// → {
//   marca: { originalValue: 'atlas copco', normalizedValue: 'Atlas Copco', confidence: 100 }
//   modello: { originalValue: 'GA30', normalizedValue: 'GA 30', confidence: 95 }
// }
```

---

#### `src/utils/filenameParser.ts`
**Funzione principale:** Parsing naming convention per batch OCR

**Naming Convention Supportata:**
- `S1, S2, S3` → Serbatoi 1, 2, 3
- `C1, C2` → Compressori 1, 2
- `C1.1, C2.1` → Disoleatori del compressore 1, 2
- `E1, E2` → Essiccatori 1, 2
- `E1.1, E2.1` → Scambiatori dell'essiccatore 1, 2
- `F1, F2` → Filtri 1, 2
- `SEP1, SEP2` → Separatori 1, 2

**Funzioni:**
- `parseEquipmentFilename(filename)` → Estrae tipo, indice, parentIndex
- `validateFilenames(filenames[])` → Batch validation
- `getFormPath(tipo, index, parentIndex)` → Genera path React Hook Form
- `formatParsedFilename(parsed)` → Stringa leggibile per UI

**Esempi:**
```typescript
parseEquipmentFilename("S1.jpg")
// → { equipmentType: 'Serbatoi', index: 0, isValid: true }

parseEquipmentFilename("C2.1.png")
// → { equipmentType: 'Disoleatori', index: 0, parentIndex: 1, isValid: true }

getFormPath('Serbatoi', 0)
// → 'serbatoi[0]'

getFormPath('Disoleatori', 1, 0)
// → 'compressori[0].disoleatori[1]'
```

---

#### `src/utils/ocrConflictDetection.ts`
**Funzione principale:** Rilevamento campi già compilati prima di sovrascrivere

**Funzioni:**
- `checkFieldsConflict(formData, tipo, index, parentIndex)` → Verifica se apparecchiatura ha già dati
- `batchCheckConflicts(formData, items[])` → Verifica batch
- `formatFilledFields(fields[])` → Formatta lista campi per UI
- `getConflictsSummary(conflicts)` → Summary statistiche

**Esempi:**
```typescript
checkFieldsConflict(formValues, 'Serbatoi', 0)
// → {
//   hasData: true,
//   filledFields: ['marca', 'modello', 'anno'],
//   fieldValues: { marca: 'Atlas Copco', modello: 'GA 30', anno: 2015 }
// }
```

---

### 2. Custom Hook

#### `src/hooks/useOCRAnalysis.ts`
**Funzione principale:** Hook React per analisi OCR con normalizzazione integrata

**API:**
```typescript
const { analyzeImage, analyzeBatch, loading, error, progress } = useOCRAnalysis()

// Analisi singola
const result = await analyzeImage(file, 'compressore', 'C1')
// → OCRAnalysisResponse con marca/modello normalizzati

// Analisi batch
const results = await analyzeBatch([
  { file: file1, equipmentType: 'serbatoio', equipmentCode: 'S1' },
  { file: file2, equipmentType: 'compressore', equipmentCode: 'C1' }
], (current, total) => console.log(`${current}/${total}`))
```

**Flusso:**
1. Converte File → base64
2. Chiama Edge Function `analyze-equipment-nameplate`
3. Normalizza marca/modello automaticamente
4. Ritorna dati OCR arricchiti con `marca_normalized` e `modello_normalized`

**Helper:**
- `requiresNormalizationConfirmation()` → Determina se mostrare dialog conferma
- `formatNormalizationMessage()` → Formatta messaggio per utente

---

### 3. Types Aggiornati

#### `src/types/ocr.ts`
**Aggiunte:**

```typescript
export interface NormalizedField {
  originalValue: string
  normalizedValue: string
  wasNormalized: boolean
  confidence: number
  source: 'exact_match' | 'fuzzy_match' | 'no_match'
  alternatives?: FuzzyMatch[]
}

export interface OCRExtractedData {
  // ... campi esistenti ...
  marca_normalized?: NormalizedField
  modello_normalized?: NormalizedField
}

export interface BatchOCRItem {
  id: string
  file: File
  filename: string
  preview: string
  parsedType: string | null
  parsedIndex: number
  parsedParentIndex?: number
  status: 'pending' | 'processing' | 'completed' | 'error' | 'conflict'
  error?: string
  result?: OCRAnalysisResponse
  normalizedMarca?: NormalizedField
  normalizedModello?: NormalizedField
  hasConflict?: boolean
  conflictFields?: string[]
}

export interface BatchOCRResult {
  total: number
  completed: number
  errors: number
  skipped: number
  conflicts: number
  normalized: number
}
```

---

## 📋 DA COMPLETARE (Sessione 2)

### 1. Componenti Dialog

#### `src/components/technicalSheet/NormalizationSuggestionDialog.tsx`
**Scopo:** Mostrare suggerimento normalizzazione quando confidence 50-80%

**Props:**
```typescript
{
  open: boolean
  ocrValue: string
  suggestedValue: string
  fieldName: 'marca' | 'modello'
  confidence: number
  alternatives?: FuzzyMatch[]
  onConfirm: (useNormalized: boolean, selectedValue?: string) => void
  onCancel: () => void
}
```

**UI:**
- Comparazione: OCR raw vs. suggerimento
- Barra confidence colorata
- Lista alternative (top 3 fuzzy matches)
- Bottoni: "Usa normalizzato" | "Mantieni OCR" | "Scegli alternativa"

---

#### `src/components/technicalSheet/ConflictConfirmDialog.tsx`
**Scopo:** Conferma sovrascrittura campi già compilati

**Props:**
```typescript
{
  open: boolean
  equipmentName: string
  existingData: Record<string, any>
  newData: OCRExtractedData
  onConfirm: (action: 'overwrite' | 'skip') => void
  onCancel: () => void
}
```

**UI:**
- Tabella comparativa 3 colonne: Attuale | OCR raw | Normalizzato
- Badge evidenziazione differenze
- Bottoni: "Sovrascrivi con normalizzato" | "Mantieni esistenti" | "Annulla"

---

### 2. Componenti OCR

#### `src/components/technicalSheet/SingleOCRButton.tsx`
**Scopo:** Bottone camera per singola apparecchiatura

**Props:**
```typescript
{
  equipmentType: EquipmentCatalogType
  equipmentIndex: number
  onOCRComplete: (data: OCRExtractedData) => void
  disabled?: boolean
}
```

**Logica:**
1. Click → file input
2. Upload → useOCRAnalysis()
3. Se confidence bassa → NormalizationSuggestionDialog
4. Conferma → onOCRComplete callback
5. Parent popola form + valida

---

#### `src/components/technicalSheet/BatchOCRDialog.tsx`
**Scopo:** Dialog per batch OCR con "Riconosci Automaticamente"

**Features:**
- Upload multiplo drag-drop
- Parsing filename automatico
- Tabella preview con thumbnail, tipo rilevato, marca/modello normalizzati
- Progress bar globale
- Gestione conflitti con dialog conferma
- Summary finale

**Tabella Colonne:**
- Thumbnail
- Filename
- Tipo rilevato (da parsing)
- Marca (OCR → normalizzata) + badge
- Modello (OCR → normalizzata) + badge
- Confidence score
- Status indicator

---

### 3. Modifiche Componenti Esistenti

#### `src/components/technicalSheet/OCRReviewDialog.tsx`
**Modifiche:**
- Aggiungere badge "✓ Normalizzato" accanto a marca/modello se `wasNormalized === true`
- Tooltip: "OCR: 'atlas copco' → 'Atlas Copco'"
- Evidenziare differenze tra OCR raw e normalizzato

---

#### `src/pages/TechnicalDetails.tsx`
**TODO a linea 198:** Completare `handleOCRConfirm()`

**Logica da implementare:**
```typescript
const handleOCRConfirm = async (reviewData: OCRReviewData) => {
  const { extracted_data, equipment_type, equipment_code } = reviewData

  // 1. Parse equipment code → tipo + index
  const parsed = parseEquipmentFilename(equipment_code || '')

  // 2. Check conflitti
  const conflict = checkFieldsConflict(getValues(), parsed.equipmentType, parsed.index)

  if (conflict.hasData) {
    // Mostra ConflictConfirmDialog
    setConflictDialog({ open: true, ... })
    return
  }

  // 3. Popola form con setValue()
  const formPath = getFormPath(parsed.equipmentType, parsed.index, parsed.parentIndex)
  setValue(`${formPath}.marca`, extracted_data.marca)
  setValue(`${formPath}.modello`, extracted_data.modello)
  // ... altri campi

  // 4. Valida immediatamente
  await trigger(formPath)

  // 5. Chiudi dialog
  setOCRReviewDialog({ open: false })
}
```

---

#### `src/components/technicalSheet/TechnicalSheetForm.tsx`
**Refactoring:** Dividere in 3 sezioni

**Struttura:**
```jsx
<Box>
  {/* SEZIONE 1: Dati Generali */}
  <Accordion>...</Accordion>

  {/* SEZIONE 2: Dati Impianto */}
  <Accordion>...</Accordion>

  {/* SEZIONE 3: Apparecchiature */}
  <Box>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
      <Typography variant="h6">Apparecchiature</Typography>
      <Button
        startIcon={<PhotoCameraIcon />}
        onClick={() => setBatchOCROpen(true)}
      >
        Riconosci Automaticamente
      </Button>
    </Box>

    {/* Accordion 3-10: Serbatoi, Compressori, etc. */}
    <Accordion>...</Accordion>
    ...
  </Box>

  {/* Dialog Batch OCR */}
  <BatchOCRDialog open={batchOCROpen} onClose={...} />
</Box>
```

---

### 4. Integrazione Sezioni Apparecchiature

**File da modificare:**
- `src/components/technicalSheet/SerbatoiSection.tsx`
- `src/components/technicalSheet/AllEquipmentSections.tsx` (tutte le sezioni)

**Modifiche AccordionSummary:**
```jsx
<AccordionSummary expandIcon={<ExpandMoreIcon />}>
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
    <Typography>Serbatoi</Typography>
    <Box sx={{ flexGrow: 1 }} />
    <SingleOCRButton
      equipmentType="Serbatoi"
      equipmentIndex={index}
      onOCRComplete={handleOCRComplete}
    />
  </Box>
</AccordionSummary>
```

---

## 🔧 Configurazione Richiesta

### API Key OpenAI
**Status:** ✅ Configurata dall'utente

```bash
# Già eseguito dall'utente
supabase secrets set OPENAI_API_KEY=sk-proj-...
```

---

## 📊 Architettura Decisioni

### 1. Normalizzazione Automatica
**Decisione:** Normalizzare sempre, confidence score determina se chiedere conferma

**Soglie:**
- `>= 80%`: Auto-apply senza conferma
- `50-79%`: Mostra NormalizationSuggestionDialog
- `< 50%`: Usa OCR raw, ma permetti override manuale

**Rationale:** Riduce errori di digitazione, mantiene consistenza catalogo

---

### 2. Gestione Conflitti
**Decisione:** Sempre chiedere conferma prima di sovrascrivere

**Flusso:**
1. Rileva campi compilati
2. Mostra ConflictConfirmDialog con comparazione
3. User sceglie: Sovrascrivi | Mantieni | Annulla

**Rationale:** Evita perdita dati accidentale

---

### 3. Validazione Post-OCR
**Decisione:** Validare immediatamente con `trigger()` dopo popolamento

**Comportamento:**
- Errori validazione → Mostrati sotto i campi (Material-UI error state)
- Fuzzy match marca/modello → Warning se confidence < 50%

**Rationale:** Feedback immediato all'utente, evita errori al submit

---

## 🎯 Flussi Utente Completi

### Flusso 1: Upload Singolo
1. Click icona camera su "Serbatoi" accordion
2. Seleziona foto S1.jpg
3. useOCRAnalysis → GPT-4o Vision → Normalizzazione
4. Se confidence bassa → NormalizationSuggestionDialog
5. Conferma → Popola campi Serbatoio[0]
6. Validazione automatica → Mostra errori se presenti
7. Success toast

### Flusso 2: Batch "Riconosci Automaticamente"
1. Click "Riconosci Automaticamente" in header Apparecchiature
2. BatchOCRDialog aperto
3. Drag-drop 10 foto (S1, C1, C1.1, E1, etc.)
4. Parsing filename → Tabella preview
5. Click "Avvia Analisi"
6. Loop foto:
   - OCR + Normalizzazione
   - Check conflitti
   - Se conflitto → ConflictConfirmDialog
7. Progress bar aggiornata
8. Summary: "8/10 completate, 6 normalizzate, 2 errori"

---

## 📝 Note Implementazione

### Import Path Aliases
```typescript
import { normalizeEquipment } from '@/utils/equipmentNormalizer'
import { parseEquipmentFilename } from '@/utils/filenameParser'
import { checkFieldsConflict } from '@/utils/ocrConflictDetection'
import { useOCRAnalysis } from '@/hooks/useOCRAnalysis'
```

### React Hook Form Integration
```typescript
// Nel componente parent (TechnicalSheetForm)
const methods = useFormContext()
const { setValue, getValues, trigger } = methods

// Popola campo
setValue('serbatoi[0].marca', 'Atlas Copco')

// Valida
await trigger('serbatoi[0]')
```

### Material-UI Icons
```typescript
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera'
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh'
```

---

## 🚀 Come Riprendere

### Prossima Sessione - Step by Step

1. **Creare NormalizationSuggestionDialog.tsx**
   - Copiare struttura da AddToCatalogDialog.tsx
   - Aggiungere barra confidence
   - Lista alternative fuzzy match

2. **Creare ConflictConfirmDialog.tsx**
   - Tabella comparativa 3 colonne
   - Badge differenze
   - Bottoni conferma/annulla

3. **Creare SingleOCRButton.tsx**
   - IconButton con PhotoCamera
   - Integrazione useOCRAnalysis
   - Gestione stati loading/error

4. **Creare BatchOCRDialog.tsx**
   - Upload multiplo
   - Tabella preview
   - Progress tracking
   - Batch processing

5. **Completare handleOCRConfirm()**
   - Implementare logica completa
   - Integrazione normalizzazione
   - Gestione conflitti

6. **Refactoring TechnicalSheetForm.tsx**
   - Dividere in 3 sezioni
   - Aggiungere bottone batch

7. **Integrare SingleOCRButton nelle sezioni**
   - Modificare tutti gli AccordionSummary
   - Handler onOCRComplete

8. **Test completo end-to-end**

---

**Fine Documento - Sessione 1 Completata**
