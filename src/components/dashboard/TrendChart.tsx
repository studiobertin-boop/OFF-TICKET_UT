import { Card, CardContent, Typography, Box, Skeleton } from '@mui/material';
import { LineChart } from '@mui/x-charts/LineChart';
import type { TrendDataPoint } from '../../services/api/analytics';

interface TrendChartProps {
  data?: TrendDataPoint[];
  isLoading: boolean;
  title?: string;
  range: 'week' | 'month' | 'year';
}

export function TrendChart({ data, isLoading, title = 'Trend Richieste', range }: TrendChartProps) {
  const chartData = {
    xAxis: data?.map(item => formatDate(item.date, range)) || [],
    series: [
      {
        data: data?.map(item => item.count) || [],
        label: 'Richieste',
        color: '#2196f3',
        curve: 'linear' as const,
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
          <LineChart
            xAxis={[
              {
                scaleType: 'point',
                data: chartData.xAxis,
                label: getRangeLabel(range),
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

function formatDate(dateStr: string, range: 'week' | 'month' | 'year'): string {
  switch (range) {
    case 'week':
      return new Date(dateStr).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
    case 'month':
      const [year, month] = dateStr.split('-');
      return `${month}/${year}`;
    case 'year':
      return dateStr;
    default:
      return dateStr;
  }
}

function getRangeLabel(range: 'week' | 'month' | 'year'): string {
  switch (range) {
    case 'week':
      return 'Settimana';
    case 'month':
      return 'Mese';
    case 'year':
      return 'Anno';
  }
}
