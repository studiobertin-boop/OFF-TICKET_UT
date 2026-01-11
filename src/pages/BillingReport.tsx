import { useState } from 'react'
import { Container, Typography, Box, Alert } from '@mui/material'
import { Layout } from '@/components/common/Layout'
import { BillingReportFilters } from '@/components/reports/BillingReportFilters'
import { BillingReportResults } from '@/components/reports/BillingReportResults'
import { billingReportsApi } from '@/services/api/billingReports'
import { BillingReportData } from '@/types/billingReport'
import { toast } from 'react-hot-toast'

export default function BillingReport() {
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  const [reportData, setReportData] = useState<BillingReportData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGenerateReport = async () => {
    if (!dateFrom || !dateTo) {
      toast.error('Seleziona un periodo valido')
      return
    }

    // Validate date range
    if (new Date(dateFrom) > new Date(dateTo)) {
      toast.error('La data di inizio deve essere precedente alla data di fine')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const data = await billingReportsApi.getUnbilledClosedRequests(dateFrom, dateTo)
      setReportData(data)

      // Calculate total
      const totalCount = Object.values(data).reduce((sum, items) => sum + items.length, 0)

      if (totalCount === 0) {
        toast.info('Nessuna richiesta non fatturata trovata nel periodo selezionato')
      } else {
        toast.success(`Report generato: ${totalCount} richieste trovate`)
      }
    } catch (err: any) {
      console.error('Error generating billing report:', err)
      setError(err.message || 'Errore durante la generazione del report')
      toast.error('Errore durante la generazione del report')
      setReportData(null)
    } finally {
      setIsLoading(false)
    }
  }

  const handleReset = () => {
    setDateFrom('')
    setDateTo('')
    setReportData(null)
    setError(null)
  }

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Report Fatturazione
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Visualizza le richieste chiuse non ancora fatturate (stato fattura: NO o AVVISO) per un periodo selezionato.
          </Typography>
        </Box>

        <BillingReportFilters
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
          onGenerate={handleGenerateReport}
          onReset={handleReset}
          isLoading={isLoading}
        />

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {reportData && !error && (
          <BillingReportResults
            data={reportData}
            dateFrom={dateFrom}
            dateTo={dateTo}
          />
        )}
      </Container>
    </Layout>
  )
}
