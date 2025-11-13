# Prossimi Step - Implementazione OCR (Sessione 2)

## 🎯 Obiettivo
Completare l'implementazione dei componenti UI e integrazione OCR nel form DM329.

## 📋 Checklist Prioritaria

### STEP 1: Dialog Normalizzazione (30 min)
**File:** `src/components/technicalSheet/NormalizationSuggestionDialog.tsx`

**Template di partenza:** Copiare struttura da `AddToCatalogDialog.tsx`

**Componenti MUI necessari:**
```typescript
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  LinearProgress,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Chip
} from '@mui/material'
import {
  CheckCircle as CheckIcon,
  Warning as WarningIcon
} from '@mui/icons-material'
```

**Struttura:**
```jsx
<Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
  <DialogTitle>
    Suggerimento Normalizzazione - {fieldName}
  </DialogTitle>

  <DialogContent>
    {/* Comparazione valori */}
    <Box sx={{ mb: 3 }}>
      <Typography variant="body2" color="text.secondary">
        OCR ha estratto:
      </Typography>
      <Typography variant="h6">{ocrValue}</Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
        Suggerimento dal catalogo:
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="h6" color="primary">{suggestedValue}</Typography>
        <Chip
          label={`${confidence}% match`}
          color={confidence >= 75 ? 'success' : 'warning'}
          size="small"
        />
      </Box>
    </Box>

    {/* Barra confidence */}
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="caption">Confidence Score</Typography>
        <Typography variant="caption">{confidence}%</Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={confidence}
        color={confidence >= 75 ? 'success' : confidence >= 50 ? 'warning' : 'error'}
      />
    </Box>

    {/* Alternative (se disponibili) */}
    {alternatives && alternatives.length > 0 && (
      <Box>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Alternative trovate:
        </Typography>
        <List dense>
          {alternatives.map((alt, idx) => (
            <ListItemButton
              key={idx}
              onClick={() => onConfirm(true, `${alt.marca} ${alt.modello}`)}
            >
              <ListItemText
                primary={`${alt.marca} ${alt.modello}`}
                secondary={`${Math.round(alt.similarity_score * 100)}% match`}
              />
            </ListItemButton>
          ))}
        </List>
      </Box>
    )}
  </DialogContent>

  <DialogActions>
    <Button onClick={() => onConfirm(false)}>
      Mantieni OCR
    </Button>
    <Button onClick={() => onConfirm(true)} variant="contained">
      Usa Normalizzato
    </Button>
  </DialogActions>
</Dialog>
```

---

### STEP 2: Dialog Conflitti (30 min)
**File:** `src/components/technicalSheet/ConflictConfirmDialog.tsx`

**Componenti MUI:**
```typescript
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Typography
} from '@mui/material'
```

**Struttura:**
```jsx
<Dialog open={open} onClose={onCancel} maxWidth="md" fullWidth>
  <DialogTitle>
    ⚠️ Conflitto: {equipmentName} già compilato
  </DialogTitle>

  <DialogContent>
    <Typography variant="body2" color="text.secondary" gutterBottom>
      I seguenti campi sono già compilati. Vuoi sovrascriverli?
    </Typography>

    <Table size="small" sx={{ mt: 2 }}>
      <TableHead>
        <TableRow>
          <TableCell>Campo</TableCell>
          <TableCell>Valore Attuale</TableCell>
          <TableCell>OCR Raw</TableCell>
          <TableCell>Normalizzato</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {conflictFields.map(field => (
          <TableRow key={field}>
            <TableCell>{formatFieldName(field)}</TableCell>
            <TableCell>{existingData[field]}</TableCell>
            <TableCell>
              {newData[field]}
              {newData[field] !== existingData[field] && (
                <Chip label="Diverso" color="warning" size="small" sx={{ ml: 1 }} />
              )}
            </TableCell>
            <TableCell>
              {newData[`${field}_normalized`]?.normalizedValue || newData[field]}
              {newData[`${field}_normalized`]?.wasNormalized && (
                <Chip label="✓" color="success" size="small" sx={{ ml: 1 }} />
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </DialogContent>

  <DialogActions>
    <Button onClick={onCancel}>Annulla</Button>
    <Button onClick={() => onConfirm('skip')}>Mantieni Esistenti</Button>
    <Button onClick={() => onConfirm('overwrite')} variant="contained" color="warning">
      Sovrascrivi con Normalizzato
    </Button>
  </DialogActions>
</Dialog>
```

---

### STEP 3: SingleOCRButton (45 min)
**File:** `src/components/technicalSheet/SingleOCRButton.tsx`

**Import necessari:**
```typescript
import { useState, useRef } from 'react'
import { IconButton, Tooltip, CircularProgress } from '@mui/material'
import { PhotoCamera as PhotoCameraIcon } from '@mui/icons-material'
import { useOCRAnalysis } from '@/hooks/useOCRAnalysis'
import type { EquipmentCatalogType } from '@/types'
```

**Logica completa:**
```tsx
export const SingleOCRButton = ({
  equipmentType,
  equipmentIndex,
  onOCRComplete,
  disabled = false
}: SingleOCRButtonProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { analyzeImage, loading } = useOCRAnalysis()
  const [showNormalizationDialog, setShowNormalizationDialog] = useState(false)
  const [normalizationData, setNormalizationData] = useState(null)

  const handleClick = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Map EquipmentCatalogType → EquipmentType
    const equipmentTypeMap = {
      'Serbatoi': 'serbatoio',
      'Compressori': 'compressore',
      // ... altri mapping
    }

    const ocrType = equipmentTypeMap[equipmentType]
    const code = generateEquipmentCode(equipmentType, equipmentIndex)

    const result = await analyzeImage(file, ocrType, code)

    if (result.success && result.data) {
      // Check se richiede conferma normalizzazione
      const marcaNorm = result.data.marca_normalized
      const modelloNorm = result.data.modello_normalized

      if (requiresConfirmation(marcaNorm, modelloNorm)) {
        setNormalizationData({ result, file })
        setShowNormalizationDialog(true)
      } else {
        // Auto-apply
        onOCRComplete(result.data)
      }
    }

    // Reset input
    event.target.value = ''
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      <Tooltip title="Compila da foto">
        <span>
          <IconButton
            onClick={handleClick}
            disabled={disabled || loading}
            size="small"
            color="primary"
          >
            {loading ? <CircularProgress size={20} /> : <PhotoCameraIcon />}
          </IconButton>
        </span>
      </Tooltip>

      {/* Dialog normalizzazione */}
      {showNormalizationDialog && normalizationData && (
        <NormalizationSuggestionDialog
          open={showNormalizationDialog}
          ocrValue={...}
          suggestedValue={...}
          onConfirm={...}
          onCancel={...}
        />
      )}
    </>
  )
}
```

**Helper:**
```typescript
function generateEquipmentCode(type: EquipmentCatalogType, index: number): string {
  const prefixMap = {
    'Serbatoi': 'S',
    'Compressori': 'C',
    'Filtri': 'F',
    'Separatori': 'SEP',
    // ...
  }
  return `${prefixMap[type]}${index + 1}`
}
```

---

### STEP 4: Completare handleOCRConfirm() (45 min)
**File:** `src/pages/TechnicalDetails.tsx` (linea ~198)

**Implementazione completa:**
```typescript
const handleOCRConfirm = async (reviewData: OCRReviewData) => {
  const { extracted_data, equipment_type, equipment_code } = reviewData

  // 1. Parse equipment code
  const parsed = parseEquipmentFilename(equipment_code || '')

  if (!parsed.isValid || !parsed.equipmentType) {
    enqueueSnackbar('Codice apparecchiatura non valido', { variant: 'error' })
    return
  }

  // 2. Get form values
  const formValues = getValues()

  // 3. Check conflitti
  const conflict = checkFieldsConflict(
    formValues,
    parsed.equipmentType,
    parsed.index,
    parsed.parentIndex
  )

  if (conflict.hasData) {
    // Mostra dialog conflitto
    setConflictDialog({
      open: true,
      equipmentName: formatParsedFilename(parsed),
      existingData: conflict.fieldValues,
      newData: extracted_data,
      conflictFields: conflict.filledFields,
      onConfirm: async (action) => {
        if (action === 'overwrite') {
          await populateFormFields(parsed, extracted_data)
        }
        setConflictDialog({ open: false })
      },
      onCancel: () => setConflictDialog({ open: false })
    })
    return
  }

  // 4. Popola form direttamente (no conflitti)
  await populateFormFields(parsed, extracted_data)

  // 5. Chiudi OCR review dialog
  setOCRReviewDialog({ open: false })

  enqueueSnackbar('Dati OCR applicati con successo', { variant: 'success' })
}

const populateFormFields = async (
  parsed: ParsedFilename,
  data: OCRExtractedData
) => {
  const formPath = getFormPath(
    parsed.equipmentType,
    parsed.index,
    parsed.parentIndex
  )

  // Popola campi
  if (data.marca) setValue(`${formPath}.marca`, data.marca)
  if (data.modello) setValue(`${formPath}.modello`, data.modello)
  if (data.n_fabbrica) setValue(`${formPath}.n_fabbrica`, data.n_fabbrica)
  if (data.anno) setValue(`${formPath}.anno`, data.anno)
  if (data.pressione_max) setValue(`${formPath}.pressione_max`, data.pressione_max)
  if (data.volume) setValue(`${formPath}.volume`, data.volume)

  // Valida immediatamente
  const isValid = await trigger(formPath)

  if (!isValid) {
    enqueueSnackbar('Alcuni campi contengono errori di validazione', { variant: 'warning' })
  }
}
```

---

### STEP 5: Refactoring TechnicalSheetForm (30 min)
**File:** `src/components/technicalSheet/TechnicalSheetForm.tsx`

**Modifiche:**
```tsx
// Aggiungi state per batch dialog
const [batchOCRDialogOpen, setBatchOCRDialogOpen] = useState(false)

return (
  <FormProvider {...methods}>
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* SEZIONE 1: Dati Generali */}
      <Accordion defaultExpanded>
        <AccordionSummary>
          <Typography variant="h6">1. Dati Generali</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <DatiGeneraliSection {...} />
        </AccordionDetails>
      </Accordion>

      {/* SEZIONE 2: Dati Impianto */}
      <Accordion defaultExpanded>
        <AccordionSummary>
          <Typography variant="h6">2. Dati Impianto</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <DatiImpiantoSection {...} />
        </AccordionDetails>
      </Accordion>

      {/* SEZIONE 3: Apparecchiature */}
      <Box sx={{ mt: 3 }}>
        <Box sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
          p: 2,
          bgcolor: 'background.paper',
          borderRadius: 1
        }}>
          <Typography variant="h6">3. Apparecchiature</Typography>
          <Button
            variant="contained"
            startIcon={<AutoFixHighIcon />}
            onClick={() => setBatchOCRDialogOpen(true)}
          >
            Riconosci Automaticamente
          </Button>
        </Box>

        {/* Accordion apparecchiature */}
        <SerbatoiSection {...} />
        <CompressoriSection {...} />
        {/* ... altre sezioni */}
      </Box>

      {/* Batch OCR Dialog */}
      <BatchOCRDialog
        open={batchOCRDialogOpen}
        onClose={() => setBatchOCRDialogOpen(false)}
        onComplete={handleBatchOCRComplete}
      />
    </form>
  </FormProvider>
)
```

---

### STEP 6: Integrazione SingleOCRButton (60 min)
**File:** `src/components/technicalSheet/SerbatoiSection.tsx` (esempio)

**Modifica AccordionSummary:**
```tsx
import { SingleOCRButton } from './SingleOCRButton'

<Accordion>
  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
    <Box sx={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      pr: 2
    }}>
      <Typography>Serbatoio #{index + 1}</Typography>

      {/* Bottone OCR */}
      <SingleOCRButton
        equipmentType="Serbatoi"
        equipmentIndex={index}
        onOCRComplete={(data) => handleOCRComplete(index, data)}
        disabled={readOnly}
      />
    </Box>
  </AccordionSummary>

  <AccordionDetails>
    <CommonEquipmentFields {...} />
  </AccordionDetails>
</Accordion>

// Handler
const handleOCRComplete = (index: number, data: OCRExtractedData) => {
  const basePath = `serbatoi[${index}]`

  if (data.marca) setValue(`${basePath}.marca`, data.marca)
  if (data.modello) setValue(`${basePath}.modello`, data.modello)
  // ... altri campi

  trigger(basePath) // Valida
}
```

**Ripetere per tutte le sezioni:**
- CompressoriSection.tsx
- DisoleatoriSection.tsx (nested in compressori)
- EssiccatoriSection.tsx
- ScambiatoriSection.tsx (nested in essiccatori)
- FiltriSection.tsx
- SeparatoriSection.tsx

---

### STEP 7: BatchOCRDialog (90 min - COMPLESSO)
**File:** `src/components/technicalSheet/BatchOCRDialog.tsx`

**Questo è il componente più complesso. Template base:**

```tsx
export const BatchOCRDialog = ({ open, onClose, onComplete }: Props) => {
  const [items, setItems] = useState<BatchOCRItem[]>([])
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const { analyzeBatch } = useOCRAnalysis()

  // Drag-drop handler
  const handleDrop = (files: File[]) => {
    const newItems = files.map(file => {
      const parsed = parseEquipmentFilename(file.name)

      return {
        id: crypto.randomUUID(),
        file,
        filename: file.name,
        preview: URL.createObjectURL(file),
        parsedType: parsed.equipmentType,
        parsedIndex: parsed.index,
        parsedParentIndex: parsed.parentIndex,
        status: parsed.isValid ? 'pending' : 'error',
        error: parsed.error
      }
    })

    setItems(newItems)
  }

  // Start batch processing
  const handleStartAnalysis = async () => {
    setProcessing(true)

    const validItems = items.filter(i => i.status === 'pending')

    for (let i = 0; i < validItems.length; i++) {
      const item = validItems[i]

      // Analizza
      const result = await analyzeImage(item.file, ...)

      // Normalizza
      // Check conflitti
      // Update item status

      setProgress((i + 1) / validItems.length * 100)
    }

    setProcessing(false)
    onComplete(results)
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>Riconosci Automaticamente</DialogTitle>

      <DialogContent>
        {/* Dropzone */}
        {items.length === 0 && <DropzoneArea onDrop={handleDrop} />}

        {/* Tabella preview */}
        {items.length > 0 && (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Preview</TableCell>
                <TableCell>Filename</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell>Marca</TableCell>
                <TableCell>Modello</TableCell>
                <TableCell>Confidence</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map(item => (
                <TableRow key={item.id}>
                  <TableCell>
                    <img src={item.preview} width={60} height={60} />
                  </TableCell>
                  <TableCell>{item.filename}</TableCell>
                  <TableCell>
                    {formatParsedFilename({ ... })}
                  </TableCell>
                  <TableCell>
                    {item.normalizedMarca?.normalizedValue}
                    {item.normalizedMarca?.wasNormalized && (
                      <Chip label="✓" size="small" color="success" />
                    )}
                  </TableCell>
                  <TableCell>...</TableCell>
                  <TableCell>...</TableCell>
                  <TableCell>
                    <StatusChip status={item.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Progress bar */}
        {processing && (
          <LinearProgress variant="determinate" value={progress} />
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={processing}>Annulla</Button>
        <Button
          onClick={handleStartAnalysis}
          variant="contained"
          disabled={processing || items.length === 0}
        >
          Avvia Analisi
        </Button>
      </DialogActions>
    </Dialog>
  )
}
```

---

## 🧪 Testing Checklist

Una volta completati tutti gli step, testare:

### Test Upload Singolo
- [ ] Click camera button su Serbatoio 1
- [ ] Upload foto S1.jpg
- [ ] Verifica normalizzazione marca/modello
- [ ] Verifica popolamento campi
- [ ] Verifica validazione immediata
- [ ] Verifica gestione errori

### Test Batch
- [ ] Click "Riconosci Automaticamente"
- [ ] Upload 5 foto (S1, C1, C1.1, E1, F1)
- [ ] Verifica parsing filename
- [ ] Verifica normalizzazione batch
- [ ] Verifica gestione conflitti
- [ ] Verifica progress bar
- [ ] Verifica summary finale

### Test Conflitti
- [ ] Compila manualmente Serbatoio 1
- [ ] Upload foto S1.jpg
- [ ] Verifica dialog conflitto
- [ ] Verifica "Sovrascrivi" funziona
- [ ] Verifica "Mantieni" funziona

### Test Normalizzazione
- [ ] Upload foto con marca "atlas copco" (lowercase)
- [ ] Verifica normalizzato a "Atlas Copco"
- [ ] Upload foto con marca typo "AtlasCpco"
- [ ] Verifica dialog conferma se confidence 50-80%
- [ ] Verifica lista alternative fuzzy match

---

## 📦 Dipendenze da Installare

Nessuna nuova dipendenza richiesta. Tutto usa già:
- Material-UI (già installato)
- React Hook Form (già installato)
- Supabase (già installato)

---

## 🔗 Link Utili

- [Material-UI Dialog Docs](https://mui.com/material-ui/react-dialog/)
- [Material-UI Table Docs](https://mui.com/material-ui/react-table/)
- [React Hook Form setValue](https://react-hook-form.com/docs/useform/setvalue)
- [React Hook Form trigger](https://react-hook-form.com/docs/useform/trigger)

---

## 💡 Tips

1. **Debugging:** Usa `console.log` abbondantemente per tracciare flusso normalizzazione
2. **Performance:** Aggiungi `React.memo` a SingleOCRButton per evitare re-render
3. **UX:** Mostra toast notifications per ogni azione (success, error, warning)
4. **Accessibilità:** Usa `aria-label` su IconButton
5. **Mobile:** Testa su schermi piccoli, BatchOCRDialog deve essere responsive

---

**Sessione 2 - Buon lavoro! 🚀**
