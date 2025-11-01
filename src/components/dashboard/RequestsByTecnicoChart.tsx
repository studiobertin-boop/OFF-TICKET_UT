import { Card, CardContent, Typography, Box, Skeleton } from '@mui/material';
import { BarChart } from '@mui/x-charts/BarChart';
import type { TecnicoMetric } from '../../services/api/analytics';

interface RequestsByTecnicoChartProps {
  data?: TecnicoMetric[];
  isLoading: boolean;
  title?: string;
}

export function RequestsByTecnicoChart({
  data,
  isLoading,
  title = 'Richieste per Tecnico',
}: RequestsByTecnicoChartProps) {
  const chartData = {
    xAxis: data?.map(item => item.tecnico_name) || [],
    series: [
      {
        data: data?.map(item => item.count) || [],
        label: 'Richieste Assegnate',
        color: '#2196f3',
      },
    ],
  };

  const isEmpty = !data || data.length === 0;

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {title}
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
                label: 'Tecnico',
              },
            ]}
            series={chartData.series}
            height={300}
          />
        )}
      </CardContent>
    </Card>
  );
}
