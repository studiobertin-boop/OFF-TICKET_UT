import { Card, CardContent, Typography, Box, Skeleton } from '@mui/material';
import { PieChart } from '@mui/x-charts/PieChart';
import type { StatusMetric } from '../../services/api/analytics';

interface RequestsByStatusChartProps {
  data?: StatusMetric[];
  isLoading: boolean;
  title?: string;
}

export function RequestsByStatusChart({
  data,
  isLoading,
  title = 'Richieste per Stato',
}: RequestsByStatusChartProps) {
  const chartData =
    data?.map((item, index) => ({
      id: index,
      value: item.count,
      label: item.label,
      color: getStatusColorHex(item.status),
    })) || [];

  const isEmpty = !data || data.length === 0;

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
        {isLoading ? (
          <Skeleton variant="circular" width={300} height={300} sx={{ mx: 'auto' }} />
        ) : isEmpty ? (
          <Box
            display="flex"
            justifyContent="center"
            alignItems="center"
            height={300}
            color="text.secondary"
          >
            Nessun dato disponibile
          </Box>
        ) : (
          <PieChart
            series={[
              {
                data: chartData,
                highlightScope: { faded: 'global', highlighted: 'item' },
                faded: { innerRadius: 30, additionalRadius: -30, color: 'gray' },
              },
            ]}
            height={300}
            slotProps={{
              legend: {
                direction: 'column',
                position: { vertical: 'middle', horizontal: 'right' },
                padding: 0,
              },
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}

// Helper per mappare status a colori esadecimali
function getStatusColorHex(status: string): string {
  const colorMap: Record<string, string> = {
    APERTA: '#2196f3',
    ASSEGNATA: '#ff9800',
    IN_LAVORAZIONE: '#9c27b0',
    INFO_NECESSARIE: '#f44336',
    INFO_TRASMESSE: '#03a9f4',
    COMPLETATA: '#4caf50',
    SOSPESA: '#9e9e9e',
    ABORTITA: '#f44336',
    // DM329
    '1-INCARICO_RICEVUTO': '#2196f3',
    '2-SCHEDA_DATI_PRONTA': '#ff9800',
    '3-MAIL_CLIENTE_INVIATA': '#9c27b0',
    '4-DOCUMENTI_PRONTI': '#03a9f4',
    '5-ATTESA_FIRMA': '#ff5722',
    '6-PRONTA_PER_CIVA': '#8bc34a',
    '7-CHIUSA': '#4caf50',
  };
  return colorMap[status] || '#757575';
}
