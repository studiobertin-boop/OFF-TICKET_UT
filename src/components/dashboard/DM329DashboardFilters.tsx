import { useState } from 'react';
import {
  Card,
  CardContent,
  Grid,
  TextField,
  MenuItem,
  Button,
  Box,
} from '@mui/material';
import { FilterList as FilterIcon } from '@mui/icons-material';
import type { DM329AnalyticsFilters } from '../../services/api/analytics';
import type { DM329Status } from '../../types';

interface DM329DashboardFiltersProps {
  onFilterChange: (filters: DM329AnalyticsFilters) => void;
}

const DM329_STATUSES: DM329Status[] = [
  '1-INCARICO_RICEVUTO',
  '2-SCHEDA_DATI_PRONTA',
  '3-MAIL_CLIENTE_INVIATA',
  '4-DOCUMENTI_PRONTI',
  '5-ATTESA_FIRMA',
  '6-PRONTA_PER_CIVA',
  '7-CHIUSA',
];

export function DM329DashboardFilters({ onFilterChange }: DM329DashboardFiltersProps) {
  const [filters, setFilters] = useState<DM329AnalyticsFilters>({});

  const handleChange = (field: keyof DM329AnalyticsFilters, value: string) => {
    const newFilters = {
      ...filters,
      [field]: value || undefined,
    };
    setFilters(newFilters);
  };

  const handleApply = () => {
    onFilterChange(filters);
  };

  const handleReset = () => {
    setFilters({});
    onFilterChange({});
  };

  return (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <FilterIcon />
          <Box component="span" fontWeight="bold">
            Filtri Dashboard DM329
          </Box>
        </Box>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={4}>
            <TextField
              fullWidth
              label="Data Inizio"
              type="date"
              value={filters.dateFrom || ''}
              onChange={e => handleChange('dateFrom', e.target.value)}
              InputLabelProps={{ shrink: true }}
              size="small"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <TextField
              fullWidth
              label="Data Fine"
              type="date"
              value={filters.dateTo || ''}
              onChange={e => handleChange('dateTo', e.target.value)}
              InputLabelProps={{ shrink: true }}
              size="small"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <TextField
              fullWidth
              select
              label="Stato DM329"
              value={filters.status || ''}
              onChange={e => handleChange('status', e.target.value)}
              size="small"
            >
              <MenuItem value="">Tutti</MenuItem>
              {DM329_STATUSES.map(status => (
                <MenuItem key={status} value={status}>
                  {getDM329StatusLabel(status)}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12}>
            <Box display="flex" gap={1} justifyContent="flex-end">
              <Button variant="outlined" onClick={handleReset}>
                Reset
              </Button>
              <Button variant="contained" onClick={handleApply}>
                Applica Filtri
              </Button>
            </Box>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
}

function getDM329StatusLabel(status: DM329Status): string {
  const labels: Record<DM329Status, string> = {
    '1-INCARICO_RICEVUTO': '1 - Incarico Ricevuto',
    '2-SCHEDA_DATI_PRONTA': '2 - Scheda Dati Pronta',
    '3-MAIL_CLIENTE_INVIATA': '3 - Mail Cliente Inviata',
    '4-DOCUMENTI_PRONTI': '4 - Documenti Pronti',
    '5-ATTESA_FIRMA': '5 - Attesa Firma',
    '6-PRONTA_PER_CIVA': '6 - Pronta per CIVA',
    '7-CHIUSA': '7 - Chiusa',
  };
  return labels[status] || status;
}
