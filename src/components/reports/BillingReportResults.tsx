import {
  Card,
  CardContent,
  Box,
  Typography,
  Button,
  Divider,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
} from '@mui/material'
import { TableChart as ExcelIcon, Description as WordIcon } from '@mui/icons-material'
import { BillingReportData } from '@/types/billingReport'
import { exportBillingReportToExcel, exportBillingReportToWord } from '@/services/billingReportExport'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { toast } from 'react-hot-toast'

interface BillingReportResultsProps {
  data: BillingReportData
  dateFrom: string
  dateTo: string
}

const formatDate = (dateString: string): string => {
  try {
    return format(new Date(dateString), 'dd/MM/yyyy', { locale: it })
  } catch {
    return dateString
  }
}

const cellSx = { border: 1, borderColor: 'divider', userSelect: 'text' as const }

export const BillingReportResults = ({
  data,
  dateFrom,
  dateTo,
}: BillingReportResultsProps) => {
  const totalCount = data.length

  const handleExportExcel = () => {
    try {
      exportBillingReportToExcel(data, dateFrom, dateTo)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore durante l\'esportazione Excel')
    }
  }

  const handleExportWord = () => {
    try {
      exportBillingReportToWord(data, dateFrom, dateTo)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore durante l\'esportazione Word')
    }
  }

  if (totalCount === 0) {
    return (
      <Card>
        <CardContent>
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="h6" color="text.secondary">
              Nessuna richiesta non fatturata trovata nel periodo selezionato
            </Typography>
          </Box>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h6" gutterBottom>
              Report Fatturazione
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Periodo: {formatDate(dateFrom)} - {formatDate(dateTo)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Totale richieste non fatturate: <strong>{totalCount}</strong>
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<ExcelIcon />}
              onClick={handleExportExcel}
            >
              Esporta Excel
            </Button>
            <Button
              variant="outlined"
              startIcon={<WordIcon />}
              onClick={handleExportWord}
            >
              Esporta Word
            </Button>
          </Box>
        </Box>

        <Divider sx={{ mb: 2 }} />

        <TableContainer sx={{ overflowX: 'auto' }}>
          <Table size="small" sx={{ border: 1, borderColor: 'divider' }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ ...cellSx, fontWeight: 700 }}>OFF/CAC</TableCell>
                <TableCell sx={{ ...cellSx, fontWeight: 700 }}>TIPO PRATICA</TableCell>
                <TableCell sx={{ ...cellSx, fontWeight: 700 }}>CODICE PRATICA</TableCell>
                <TableCell sx={{ ...cellSx, fontWeight: 700 }}>CLIENTE</TableCell>
                <TableCell sx={{ ...cellSx, fontWeight: 700 }}>DATA CHIUSURA</TableCell>
                <TableCell sx={{ ...cellSx, fontWeight: 700 }}>X FATTURA</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.map(row => (
                <TableRow key={row.id}>
                  <TableCell sx={cellSx}>{row.offCacDisplay}</TableCell>
                  <TableCell sx={cellSx}>{row.requestTypeName}</TableCell>
                  <TableCell sx={{ ...cellSx, fontFamily: 'monospace' }}>{row.codicePratica}</TableCell>
                  <TableCell sx={cellSx}>{row.customerName}</TableCell>
                  <TableCell sx={cellSx}>{formatDate(row.closedDate)}</TableCell>
                  <TableCell sx={cellSx}>{row.xFattura}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  )
}
