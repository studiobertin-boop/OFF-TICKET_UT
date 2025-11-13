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

interface NormalizedFieldData {
  normalizedValue?: string
  wasNormalized?: boolean
  confidence?: number
}

interface OCRExtractedData {
  marca?: string
  modello?: string
  n_fabbrica?: string
  anno?: string | number
  pressione_max?: string | number
  volume?: string | number
  marca_normalized?: NormalizedFieldData
  modello_normalized?: NormalizedFieldData
  [key: string]: string | number | NormalizedFieldData | undefined
}

interface ConflictConfirmDialogProps {
  open: boolean
  equipmentName: string
  existingData: Record<string, any>
  newData: OCRExtractedData
  conflictFields: string[]
  onConfirm: (action: 'skip' | 'overwrite') => void
  onCancel: () => void
}

const formatFieldName = (field: string): string => {
  const fieldNames: Record<string, string> = {
    marca: 'Marca',
    modello: 'Modello',
    n_fabbrica: 'N. Fabbrica',
    anno: 'Anno',
    pressione_max: 'Pressione Max',
    volume: 'Volume',
    potenza: 'Potenza',
    portata: 'Portata'
  }
  return fieldNames[field] || field
}

export const ConflictConfirmDialog = ({
  open,
  equipmentName,
  existingData,
  newData,
  conflictFields,
  onConfirm,
  onCancel
}: ConflictConfirmDialogProps) => {
  return (
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
            {conflictFields.map(field => {
              const normalizedField = newData[`${field}_normalized`] as NormalizedFieldData | undefined
              const rawValue = newData[field] as string | number | undefined
              const currentValue = existingData[field]

              return (
                <TableRow key={field}>
                  <TableCell>{formatFieldName(field)}</TableCell>
                  <TableCell>{currentValue}</TableCell>
                  <TableCell>
                    {rawValue}
                    {rawValue !== currentValue && (
                      <Chip label="Diverso" color="warning" size="small" sx={{ ml: 1 }} />
                    )}
                  </TableCell>
                  <TableCell>
                    {normalizedField?.normalizedValue || rawValue}
                    {normalizedField?.wasNormalized && (
                      <Chip label="✓" color="success" size="small" sx={{ ml: 1 }} />
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
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
  )
}
