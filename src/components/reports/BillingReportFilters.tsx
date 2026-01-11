import { Card, CardContent, Grid, TextField, Button, Box } from '@mui/material'

interface BillingReportFiltersProps {
  dateFrom: string
  dateTo: string
  onDateFromChange: (value: string) => void
  onDateToChange: (value: string) => void
  onGenerate: () => void
  onReset: () => void
  isLoading?: boolean
}

export const BillingReportFilters = ({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  onGenerate,
  onReset,
  isLoading = false,
}: BillingReportFiltersProps) => {
  const canGenerate = dateFrom && dateTo

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={4}>
            <TextField
              fullWidth
              label="Data Inizio"
              type="date"
              value={dateFrom}
              onChange={(e) => onDateFromChange(e.target.value)}
              InputLabelProps={{ shrink: true }}
              size="small"
              disabled={isLoading}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <TextField
              fullWidth
              label="Data Fine"
              type="date"
              value={dateTo}
              onChange={(e) => onDateToChange(e.target.value)}
              InputLabelProps={{ shrink: true }}
              size="small"
              disabled={isLoading}
            />
          </Grid>
          <Grid item xs={12} sm={12} md={4}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="contained"
                color="primary"
                onClick={onGenerate}
                disabled={!canGenerate || isLoading}
                fullWidth
              >
                {isLoading ? 'Generazione...' : 'Genera Report'}
              </Button>
              <Button
                variant="outlined"
                color="secondary"
                onClick={onReset}
                disabled={isLoading}
              >
                Reset
              </Button>
            </Box>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  )
}
