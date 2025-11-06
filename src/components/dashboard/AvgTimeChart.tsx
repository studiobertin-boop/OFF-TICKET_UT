import { Box, Paper, Typography, Skeleton } from '@mui/material';
import { LineChart } from '@mui/x-charts/LineChart';
import type { TimeSeriesPoint } from '@/services/api/analytics';

interface AvgTimeChartProps {
  data?: TimeSeriesPoint[];
  isLoading: boolean;
  title: string;
  range: 'day' | 'week' | 'month' | 'year';
}

export const AvgTimeChart = ({ data, isLoading, title, range }: AvgTimeChartProps) => {
  if (isLoading) {
    return (
      <Paper sx={{ p: 3 }}>
        <Skeleton variant="text" width={200} height={32} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={300} />
      </Paper>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
        <Box
          sx={{
            height: 300,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography color="text.secondary">
            Nessun dato disponibile per il periodo selezionato
          </Typography>
        </Box>
      </Paper>
    );
  }

  // Format period labels based on range
  const formatLabel = (period: string) => {
    if (range === 'year') return period;
    if (range === 'month') {
      const [year, month] = period.split('-');
      const monthNames = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
      return `${monthNames[parseInt(month) - 1]} ${year}`;
    }
    if (range === 'week' || range === 'day') {
      const date = new Date(period);
      return date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
    }
    return period;
  };

  const xLabels = data.map(d => formatLabel(d.period));
  const yData = data.map(d => d.avg_hours);

  // Format hours for tooltip
  const formatHours = (hours: number) => {
    if (hours < 24) {
      return `${hours.toFixed(1)} ore`;
    }
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}g ${remainingHours.toFixed(0)}h`;
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>
      <Box sx={{ width: '100%', height: 300 }}>
        <LineChart
          xAxis={[
            {
              scaleType: 'point',
              data: xLabels,
            },
          ]}
          series={[
            {
              data: yData,
              label: 'Tempo medio',
              color: '#2196f3',
              valueFormatter: (value) => value != null ? formatHours(value) : '',
            },
          ]}
          height={300}
          margin={{ left: 60, right: 20, top: 20, bottom: 60 }}
          slotProps={{
            legend: {
              hidden: true,
            },
          }}
        />
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
        Tempo medio in ore/giorni
      </Typography>
    </Paper>
  );
};
