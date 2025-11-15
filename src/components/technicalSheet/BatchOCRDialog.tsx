import { useState, useCallback } from 'react'
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
  LinearProgress,
  Typography,
  Box,
  Chip,
  Alert,
  Paper,
} from '@mui/material'
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Pending as PendingIcon,
} from '@mui/icons-material'
import { useOCRAnalysis } from '@/hooks/useOCRAnalysis'
import { parseEquipmentFilename, formatParsedFilename } from '@/utils/filenameParser'
import type { BatchOCRItem, BatchOCRResult } from '@/types/ocr'
import type { EquipmentType } from '@/types/ocr'
import type { EquipmentCatalogType } from '@/types'

interface BatchOCRDialogProps {
  open: boolean
  onClose: () => void
  onComplete: (results: BatchOCRResult, items: BatchOCRItem[]) => void
}

/**
 * Mappa EquipmentCatalogType → EquipmentType (per OCR)
 * Solo tipi OCR-compatibili
 */
const CATALOG_TO_OCR_TYPE_MAP: Partial<Record<EquipmentCatalogType, EquipmentType>> = {
  'Serbatoi': 'serbatoio',
  'Compressori': 'compressore',
  'Disoleatori': 'disoleatore',
  'Essiccatori': 'essiccatore',
  'Scambiatori': 'scambiatore',
  'Filtri': 'filtro',
  'Separatori': 'separatore'
}

/**
 * Componente StatusChip
 */
const StatusChip = ({ status }: { status: BatchOCRItem['status'] }) => {
  const config = {
    pending: { label: 'In attesa', color: 'default' as const, icon: <PendingIcon fontSize="small" /> },
    processing: { label: 'Analisi...', color: 'info' as const, icon: <PendingIcon fontSize="small" /> },
    completed: { label: 'Completato', color: 'success' as const, icon: <CheckCircleIcon fontSize="small" /> },
    error: { label: 'Errore', color: 'error' as const, icon: <ErrorIcon fontSize="small" /> },
    conflict: { label: 'Conflitto', color: 'warning' as const, icon: <WarningIcon fontSize="small" /> },
  }

  const { label, color, icon } = config[status]
  return <Chip label={label} color={color} size="small" icon={icon} />
}

/**
 * BatchOCRDialog - Upload e analisi multipla foto targhette
 */
export const BatchOCRDialog = ({ open, onClose, onComplete }: BatchOCRDialogProps) => {
  const [items, setItems] = useState<BatchOCRItem[]>([])
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const { analyzeImage } = useOCRAnalysis()

  // Handle file selection
  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])

    const newItems: BatchOCRItem[] = files.map(file => {
      const parsed = parseEquipmentFilename(file.name)

      console.log(`🔍 PARSING ${file.name}:`, {
        equipmentType: parsed.equipmentType,
        index: parsed.index,
        componentType: parsed.componentType,
        parentIndex: parsed.parentIndex,
        isValid: parsed.isValid
      })

      const item: BatchOCRItem = {
        id: crypto.randomUUID(),
        file,
        filename: file.name,
        preview: URL.createObjectURL(file),
        parsedType: parsed.equipmentType,
        parsedIndex: parsed.index,
        parsedParentIndex: parsed.parentIndex,
        parsedComponentType: parsed.componentType,
        status: (parsed.isValid ? 'pending' : 'error') as 'pending' | 'processing' | 'completed' | 'error' | 'conflict',
        error: parsed.error
      }

      console.log(`✅ ITEM CREATO per ${file.name}:`, {
        parsedType: item.parsedType,
        parsedComponentType: item.parsedComponentType
      })

      return item
    })

    setItems(newItems)
  }, [])

  // Start batch analysis
  const handleStartAnalysis = async () => {
    setProcessing(true)

    const validItems = items.filter(i => i.status === 'pending')
    let completedCount = 0
    let errorCount = 0

    // Track updated items locally (fix per bug stato asincrono)
    let updatedItems = [...items]

    for (let i = 0; i < validItems.length; i++) {
      const item = validItems[i]

      // Update status to processing
      updatedItems = updatedItems.map(it =>
        it.id === item.id ? { ...it, status: 'processing' as const } : it
      )
      setItems(updatedItems)

      try {
        // Map catalog type to OCR type, or use 'valvola' if componentType is set
        let ocrType: EquipmentType | undefined

        if (item.parsedComponentType === 'valvola_sicurezza') {
          ocrType = 'valvola'
        } else {
          ocrType = item.parsedType ? CATALOG_TO_OCR_TYPE_MAP[item.parsedType] : undefined
        }

        if (!ocrType) {
          throw new Error('Tipo apparecchiatura non mappato')
        }

        // Generate equipment code (es: "S1", "C2.1", "S1.1")
        const equipmentCode = generateEquipmentCodeFromParsed(item)

        // Analyze image
        const result = await analyzeImage(item.file, ocrType, equipmentCode)

        if (result.success && result.data) {
          // Update item with results
          updatedItems = updatedItems.map(it =>
            it.id === item.id ? {
              ...it,
              status: 'completed' as const,
              result,
              normalizedMarca: result.data?.marca_normalized,
              normalizedModello: result.data?.modello_normalized
            } : it
          )
          setItems(updatedItems)

          completedCount++
        } else {
          throw new Error(result.error || 'Analisi OCR fallita')
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Errore sconosciuto'

        // Update item with error
        updatedItems = updatedItems.map(it =>
          it.id === item.id ? {
            ...it,
            status: 'error' as const,
            error: errorMessage
          } : it
        )
        setItems(updatedItems)

        errorCount++
      }

      // Update progress
      setProgress(((i + 1) / validItems.length) * 100)

      // Small delay between requests
      if (i < validItems.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    setProcessing(false)

    // Prepare results using updatedItems instead of state
    const result: BatchOCRResult = {
      total: updatedItems.length,
      completed: completedCount,
      errors: errorCount,
      skipped: updatedItems.filter(i => i.status === 'error' && !i.result).length,
      conflicts: 0, // TODO: Implementare rilevamento conflitti
      normalized: updatedItems.filter(i =>
        i.normalizedMarca?.wasNormalized || i.normalizedModello?.wasNormalized
      ).length
    }

    // Pass updatedItems instead of state items
    onComplete(result, updatedItems)
  }

  const handleReset = () => {
    // Cleanup blob URLs
    items.forEach(item => URL.revokeObjectURL(item.preview))
    setItems([])
    setProgress(0)
  }

  const handleClose = () => {
    handleReset()
    onClose()
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
      <DialogTitle>Riconosci Automaticamente - Batch OCR</DialogTitle>

      <DialogContent>
        {/* Instructions */}
        {items.length === 0 && (
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2" gutterBottom>
              <strong>Come funziona:</strong>
            </Typography>
            <Typography variant="body2" component="div">
              1. Seleziona più foto di targhette<br />
              2. Rinomina i file secondo la convenzione: <strong>S1.jpg, C2.jpg, E1.jpg, F1.jpg, SEP1.jpg</strong><br />
              3. Per apparecchiature nested usa: <strong>C1.1.jpg</strong> (Disoleatore), <strong>E1.1.jpg</strong> (Scambiatore)<br />
              4. Per componenti usa: <strong>S1.1.jpg</strong> (Valvola di sicurezza del serbatoio 1)<br />
              5. L'OCR riconoscerà automaticamente marca, modello e altri dati
            </Typography>
          </Alert>
        )}

        {/* File input */}
        {items.length === 0 && (
          <Paper
            variant="outlined"
            sx={{
              p: 4,
              textAlign: 'center',
              bgcolor: 'background.default',
              cursor: 'pointer',
              '&:hover': { bgcolor: 'action.hover' }
            }}
          >
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              style={{ display: 'none' }}
              id="batch-file-input"
            />
            <label htmlFor="batch-file-input" style={{ cursor: 'pointer' }}>
              <Typography variant="h6" gutterBottom>
                Clicca per selezionare le foto
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Seleziona più file immagine
              </Typography>
            </label>
          </Paper>
        )}

        {/* Items table */}
        {items.length > 0 && (
          <>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Preview</TableCell>
                  <TableCell>Filename</TableCell>
                  <TableCell>Tipo</TableCell>
                  <TableCell>Marca</TableCell>
                  <TableCell>Modello</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map(item => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <img
                        src={item.preview}
                        alt={item.filename}
                        style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 4 }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{item.filename}</Typography>
                    </TableCell>
                    <TableCell>
                      {item.parsedType && item.parsedIndex >= 0 ? (
                        <Box>
                          <Typography variant="body2">
                            {formatParsedFilename({
                              equipmentType: item.parsedType as EquipmentCatalogType,
                              index: item.parsedIndex,
                              parentIndex: item.parsedParentIndex,
                              componentType: item.parsedComponentType,
                              isValid: true,
                              rawPrefix: ''
                            })}
                          </Typography>
                          {item.parsedComponentType === 'valvola_sicurezza' && (
                            <Chip label="Valvola" color="warning" size="small" sx={{ mt: 0.5 }} />
                          )}
                        </Box>
                      ) : (
                        <Chip label="Non valido" color="error" size="small" />
                      )}
                    </TableCell>
                    <TableCell>
                      {item.normalizedMarca ? (
                        <Box>
                          {item.normalizedMarca.normalizedValue}
                          {item.normalizedMarca.wasNormalized && (
                            <Chip label="✓" color="success" size="small" sx={{ ml: 0.5 }} />
                          )}
                        </Box>
                      ) : (
                        <Typography variant="body2" color="text.secondary">-</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.normalizedModello ? (
                        <Box>
                          {item.normalizedModello.normalizedValue}
                          {item.normalizedModello.wasNormalized && (
                            <Chip label="✓" color="success" size="small" sx={{ ml: 0.5 }} />
                          )}
                        </Box>
                      ) : (
                        <Typography variant="body2" color="text.secondary">-</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusChip status={item.status} />
                      {item.error && (
                        <Typography variant="caption" color="error" display="block">
                          {item.error}
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Progress bar */}
            {processing && (
              <Box sx={{ mt: 2 }}>
                <LinearProgress variant="determinate" value={progress} />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                  Analisi in corso... {Math.round(progress)}%
                </Typography>
              </Box>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions>
        {items.length > 0 && !processing && (
          <Button onClick={handleReset}>Reset</Button>
        )}
        <Button onClick={handleClose} disabled={processing}>
          {items.some(i => i.status === 'completed') ? 'Chiudi' : 'Annulla'}
        </Button>
        {items.length > 0 && !processing && (
          <Button
            onClick={handleStartAnalysis}
            variant="contained"
            disabled={!items.some(i => i.status === 'pending')}
          >
            Avvia Analisi ({items.filter(i => i.status === 'pending').length})
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}

/**
 * Helper: genera codice apparecchiatura da parsed filename
 */
function generateEquipmentCodeFromParsed(item: BatchOCRItem): string {
  if (!item.parsedType) return ''

  const prefixMap: Partial<Record<EquipmentCatalogType, string>> = {
    'Serbatoi': 'S',
    'Compressori': 'C',
    'Disoleatori': 'D',
    'Essiccatori': 'E',
    'Scambiatori': 'SC',
    'Filtri': 'F',
    'Separatori': 'SEP'
  }

  const prefix = prefixMap[item.parsedType]

  if (!prefix) return ''

  // Componenti nested (es: "S1.1" per valvola)
  if (item.parsedComponentType === 'valvola_sicurezza') {
    return `${prefix}${item.parsedIndex + 1}.1`
  }

  if (item.parsedParentIndex !== undefined) {
    // Nested equipment (es: "C1.1" per disoleatore)
    const parentPrefix = prefixMap['Compressori']
    return `${parentPrefix}${item.parsedParentIndex + 1}.${item.parsedIndex + 1}`
  }

  return `${prefix}${item.parsedIndex + 1}`
}
