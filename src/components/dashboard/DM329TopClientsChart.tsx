import { Card, CardContent, Typography, Box, Skeleton } from '@mui/material';
import { BarChart } from '@mui/x-charts/BarChart';
import type { ClientMetric } from '../../services/api/analytics';

interface DM329TopClientsChartProps {
  data?: ClientMetric[];
  isLoading: boolean;
}

export function DM329TopClientsChart({ data, isLoading }: DM329TopClientsChartProps) {
  const chartData = {
    xAxis: data?.map(item => item.cliente) || [],
    series: [
      {
        data: data?.map(item => item.count) || [],
        label: 'Richieste',
        color: '#ff9800',
      },
    ],
  };

  const isEmpty = !data || data.length === 0;

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Top 10 Clienti DM329
        </Typography>
        {isLoading ? (
          <Skeleton variant="rectangular" width="100%" height={300} />
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
          <BarChart
            xAxis={[
              {
                scaleType: 'band',
                data: chartData.xAxis,
                label: 'Cliente',
              },
            ]}
            series={chartData.series}
            height={300}
            slotProps={{
              legend: { hidden: true },
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}
