import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  ListItemText,
  Box,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material'
import FileDownloadIcon from '@mui/icons-material/FileDownload'
import { ExportFilters, RequestStatus, DM329Status } from '@/types'
import { requestsApi } from '@/services/api/requests'
import { exportRequestsToExcel } from '@/services/excelService'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'

interface ExportRequestsDialogProps {
  open: boolean
  onClose: () => void
  requestType: 'DM329' | 'GENERALE'
  requestTypeId?: string
}

// Stati disponibili per le richieste generali
const GENERAL_STATUSES: RequestStatus[] = [
  'APERTA',
  'ASSEGNATA',
  'IN_LAVORAZIONE',
  'COMPLETATA',
  'BLOCCATA',
  'ABORTITA',
]

// Stati disponibili per DM329
const DM329_STATUSES: DM329Status[] = [
  '1-INCARICO_RICEVUTO',
  '2-SCHEDA_DATI_PRONTA',
  '3-MAIL_CLIENTE_INVIATA',
  '4-DOCUMENTI_PRONTI',
  '5-ATTESA_FIRMA',
  '6-PRONTA_PER_CIVA',
  '7-CHIUSA',
  'ARCHIVIATA NON FINITA',
]

// Labels per stati generali
const GENERAL_STATUS_LABELS: Record<RequestStatus, string> = {
  APERTA: 'Aperta',
  ASSEGNATA: 'Assegnata',
  IN_LAVORAZIONE: 'In lavorazione',
  COMPLETATA: 'Completata',
  BLOCCATA: 'Bloccata',
  ABORTITA: 'Abortita',
}

// Labels per stati DM329
const DM329_STATUS_LABELS: Record<DM329Status, string> = {
  '1-INCARICO_RICEVUTO': '1 - Incarico ricevuto',
  '2-SCHEDA_DATI_PRONTA': '2 - Scheda dati pronta',
  '3-MAIL_CLIENTE_INVIATA': '3 - Mail cliente inviata',
  '4-DOCUMENTI_PRONTI': '4 - Documenti pronti',
  '5-ATTESA_FIRMA': '5 - Attesa firma',
  '6-PRONTA_PER_CIVA': '6 - Pronta per CIVA',
  '7-CHIUSA': '7 - Chiusa',
  'ARCHIVIATA NON FINITA': 'Archiviata non finita',
}

export default function ExportRequestsDialog({
  open,
  onClose,
  requestType,
  requestTypeId,
}: ExportRequestsDialogProps) {
  const today = format(new Date(), 'yyyy-MM-dd', { locale: it })
  const firstDayOfMonth = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd', { locale: it })

  const [dateFrom, setDateFrom] = useState(firstDayOfMonth)
  const [dateTo, setDateTo] = useState(today)
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
  const [previewCount, setPreviewCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const availableStatuses = requestType === 'DM329' ? DM329_STATUSES : GENERAL_STATUSES
  const statusLabels = requestType === 'DM329' ? DM329_STATUS_LABELS : GENERAL_STATUS_LABELS

  // Fetch preview count when filters change
  useEffect(() => {
    if (!open || selectedStatuses.length === 0 || !dateFrom || !dateTo) {
      setPreviewCount(null)
      return
    }

    const fetchPreview = async () => {
      setLoading(true)
      setError(null)
      try {
        const filters: ExportFilters = {
          dateFrom,
          dateTo,
          statuses: selectedStatuses,
        }
        const count = await requestsApi.getExportPreviewCount(filters, requestTypeId)
        setPreviewCount(count)
      } catch (err: any) {
        console.error('Error fetching preview:', err)
        setError(err.message || 'Errore nel caricamento anteprima')
      } finally {
        setLoading(false)
      }
    }

    // Debounce per evitare troppe chiamate
    const timeout = setTimeout(fetchPreview, 300)
    return () => clearTimeout(timeout)
  }, [open, dateFrom, dateTo, selectedStatuses, requestTypeId])

  const handleExport = async () => {
    if (selectedStatuses.length === 0) {
      setError('Seleziona almeno uno stato')
      return
    }

    if (!dateFrom || !dateTo) {
      setError('Seleziona il periodo temporale')
      return
    }

    setExporting(true)
    setError(null)

    try {
      const filters: ExportFilters = {
        dateFrom,
        dateTo,
        statuses: selectedStatuses,
      }

      const data = await requestsApi.getForExport(filters, requestTypeId)

      if (data.length === 0) {
        setError('Nessuna richiesta trovata con i filtri selezionati')
        return
      }

      exportRequestsToExcel(data, requestType, filters)
      onClose()
    } catch (err: any) {
      console.error('Error exporting:', err)
      setError(err.message || 'Errore durante l\'esportazione')
    } finally {
      setExporting(false)
    }
  }

  const handleClose = () => {
    if (!exporting) {
      setDateFrom(firstDayOfMonth)
      setDateTo(today)
      setSelectedStatuses([])
      setPreviewCount(null)
      setError(null)
      onClose()
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Esporta Richieste {requestType === 'DM329' ? 'DM329' : 'Generali'}</DialogTitle>
      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Date Range */}
          <Typography variant="subtitle2" sx={{ mt: 1 }}>
            Periodo temporale
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              fullWidth
              label="Data inizio"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              InputLabelProps={{ shrink: true }}
              size="small"
            />
            <TextField
              fullWidth
              label="Data fine"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              InputLabelProps={{ shrink: true }}
              size="small"
            />
          </Box>

          {/* Status Selection */}
          <FormControl fullWidth size="small">
            <InputLabel>Stati</InputLabel>
            <Select
              multiple
              value={selectedStatuses}
              onChange={(e) => setSelectedStatuses(e.target.value as string[])}
              renderValue={(selected) =>
                (selected as string[])
                  .map((s) => statusLabels[s as keyof typeof statusLabels])
                  .join(', ')
              }
              label="Stati"
            >
              {availableStatuses.map((status) => (
                <MenuItem key={status} value={status}>
                  <Checkbox checked={selectedStatuses.indexOf(status) > -1} />
                  <ListItemText primary={statusLabels[status as keyof typeof statusLabels]} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Preview Count */}
          {loading && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={20} />
              <Typography variant="body2" color="text.secondary">
                Caricamento anteprima...
              </Typography>
            </Box>
          )}

          {!loading && previewCount !== null && (
            <Alert severity={previewCount > 0 ? 'info' : 'warning'}>
              {previewCount > 0
                ? `${previewCount} richiesta/e verrà/anno esportata/e`
                : 'Nessuna richiesta trovata con questi filtri'}
            </Alert>
          )}

          {/* Export Info */}
          <Typography variant="caption" color="text.secondary">
            Verranno esportate le richieste che hanno raggiunto gli stati selezionati
            nel periodo specificato, mostrando la data dell'ultimo cambio a quello stato.
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={exporting}>
          Annulla
        </Button>
        <Button
          onClick={handleExport}
          variant="contained"
          startIcon={exporting ? <CircularProgress size={20} /> : <FileDownloadIcon />}
          disabled={exporting || selectedStatuses.length === 0 || !dateFrom || !dateTo}
        >
          {exporting ? 'Esportazione...' : 'Esporta'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
