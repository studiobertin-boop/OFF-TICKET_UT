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
import { useRequestTypes } from '../../hooks/useRequestTypes';
import type { GeneralAnalyticsFilters } from '../../services/api/analytics';
import type { RequestStatus } from '../../types';

interface GeneralDashboardFiltersProps {
  onFilterChange: (filters: GeneralAnalyticsFilters) => void;
  showAssignedToFilter?: boolean; // Futuro: filtro per assegnazione admin
}

const REQUEST_STATUSES: RequestStatus[] = [
  'APERTA',
  'ASSEGNATA',
  'IN_LAVORAZIONE',
  'COMPLETATA',
  'SOSPESA',
  'ABORTITA',
];

export function GeneralDashboardFilters({
  onFilterChange,
}: GeneralDashboardFiltersProps) {
  const { data: requestTypes } = useRequestTypes();

  // Filtra solo tipi NON DM329
  const generalTypes = requestTypes?.filter(type => type.name !== 'DM329') || [];

  const [filters, setFilters] = useState<GeneralAnalyticsFilters>({});

  const handleChange = (field: keyof GeneralAnalyticsFilters, value: string) => {
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
            Filtri Dashboard Generale
          </Box>
        </Box>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
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
          <Grid item xs={12} sm={6} md={3}>
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
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              select
              label="Stato"
              value={filters.status || ''}
              onChange={e => handleChange('status', e.target.value)}
              size="small"
            >
              <MenuItem value="">Tutti</MenuItem>
              {REQUEST_STATUSES.map(status => (
                <MenuItem key={status} value={status}>
                  {getStatusLabel(status)}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              select
              label="Tipo Richiesta"
              value={filters.requestTypeId || ''}
              onChange={e => handleChange('requestTypeId', e.target.value)}
              size="small"
            >
              <MenuItem value="">Tutti</MenuItem>
              {generalTypes.map(type => (
                <MenuItem key={type.id} value={type.id}>
                  {type.name}
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

function getStatusLabel(status: RequestStatus): string {
  const labels: Record<RequestStatus, string> = {
    APERTA: 'Aperta',
    ASSEGNATA: 'Assegnata',
    IN_LAVORAZIONE: 'In Lavorazione',
    COMPLETATA: 'Completata',
    SOSPESA: 'Sospesa',
    ABORTITA: 'Abortita',
  };
  return labels[status] || status;
}
