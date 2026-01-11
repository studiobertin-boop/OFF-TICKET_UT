import {
  Card,
  CardContent,
  Box,
  Typography,
  Button,
  Divider,
  List,
  ListItem,
  ListItemText,
  Chip,
} from '@mui/material'
import { ContentCopy as ContentCopyIcon } from '@mui/icons-material'
import { BillingReportData } from '@/types/billingReport'
import { STATO_FATTURA_LABELS } from '@/types'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { toast } from 'react-hot-toast'

interface BillingReportResultsProps {
  data: BillingReportData
  dateFrom: string
  dateTo: string
}

// Helper per formattare data
const formatDate = (dateString: string): string => {
  try {
    return format(new Date(dateString), 'dd/MM/yyyy', { locale: it })
  } catch {
    return dateString
  }
}

// Helper per ottenere nome cliente
const getCustomerName = (customer: any): string => {
  if (!customer) return 'N/A'
  if (customer.company_name) return customer.company_name
  if (customer.first_name || customer.last_name) {
    return [customer.first_name, customer.last_name].filter(Boolean).join(' ')
  }
  return 'N/A'
}

// Genera testo formattato per copy/paste - SOLO ELENCO CLIENTI
const generateTextReport = (data: BillingReportData, dateFrom: string, dateTo: string): string => {
  let output = ''

  // Ordina tipi alfabeticamente
  const sortedTypes = Object.keys(data).sort((a, b) => a.localeCompare(b, 'it'))

  sortedTypes.forEach(type => {
    const items = data[type]
    output += `--- ${type.toUpperCase()} (${items.length}) ---\n`
    items.forEach(req => {
      const customer = getCustomerName(req.customer)
      output += `${customer}\n`
    })
    output += '\n'
  })

  return output.trim()
}

export const BillingReportResults = ({
  data,
  dateFrom,
  dateTo,
}: BillingReportResultsProps) => {
  const totalCount = Object.values(data).reduce((sum, items) => sum + items.length, 0)
  const sortedTypes = Object.keys(data).sort((a, b) => a.localeCompare(b, 'it'))

  const handleCopyAll = () => {
    const textOutput = generateTextReport(data, dateFrom, dateTo)
    navigator.clipboard.writeText(textOutput)
    toast.success('Report copiato negli appunti')
  }

  const handleCopyType = (type: string) => {
    const items = data[type]
    let output = `--- ${type.toUpperCase()} (${items.length}) ---\n`
    items.forEach(req => {
      const customer = getCustomerName(req.customer)
      output += `${customer}\n`
    })
    navigator.clipboard.writeText(output)
    toast.success(`Gruppo "${type}" copiato negli appunti`)
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
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
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
          <Button
            variant="contained"
            color="primary"
            startIcon={<ContentCopyIcon />}
            onClick={handleCopyAll}
          >
            Copia Tutto
          </Button>
        </Box>

        <Divider sx={{ mb: 2 }} />

        {/* Gruppi per tipo */}
        {sortedTypes.map((type, index) => {
          const items = data[type]
          return (
            <Box key={type} sx={{ mb: index < sortedTypes.length - 1 ? 3 : 0 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="h6" component="div">
                  {type}
                  <Chip
                    label={items.length}
                    size="small"
                    color="primary"
                    sx={{ ml: 1 }}
                  />
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<ContentCopyIcon />}
                  onClick={() => handleCopyType(type)}
                >
                  Copia Gruppo
                </Button>
              </Box>

              <List dense disablePadding>
                {items.map((item, idx) => {
                  const customer = getCustomerName(item.customer)
                  const date = formatDate(item.closed_date)
                  const stato = STATO_FATTURA_LABELS[item.stato_fattura]

                  return (
                    <ListItem
                      key={item.id}
                      sx={{
                        py: 0.5,
                        px: 1,
                        bgcolor: idx % 2 === 0 ? 'action.hover' : 'transparent',
                        fontFamily: 'monospace',
                      }}
                    >
                      <ListItemText
                        primary={
                          <Typography
                            variant="body2"
                            component="span"
                            sx={{ fontFamily: 'monospace' }}
                          >
                            {customer} - {date} -{' '}
                            <Chip
                              label={stato}
                              size="small"
                              color={item.stato_fattura === 'AVVISO' ? 'warning' : 'default'}
                              sx={{ ml: 0.5 }}
                            />
                          </Typography>
                        }
                      />
                    </ListItem>
                  )
                })}
              </List>

              {index < sortedTypes.length - 1 && <Divider sx={{ mt: 2 }} />}
            </Box>
          )
        })}
      </CardContent>
    </Card>
  )
}
