import { Box, Paper, Typography, Skeleton } from '@mui/material';
import { LineChart } from '@mui/x-charts/LineChart';
import type { DM329TransitionTime } from '@/services/api/analytics';

interface DM329TransitionChartProps {
  data?: DM329TransitionTime[];
  isLoading: boolean;
  title: string;
}

export const DM329TransitionChart = ({ data, isLoading, title }: DM329TransitionChartProps) => {
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
            Nessun dato disponibile
          </Typography>
        </Box>
      </Paper>
    );
  }

  // Format hours for display
  const formatHours = (hours: number) => {
    if (hours < 24) {
      return `${hours.toFixed(1)} ore`;
    }
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}g ${remainingHours.toFixed(0)}h`;
  };

  const xLabels = data.map(d => d.transition_name);
  const yData = data.map(d => d.avg_hours);

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
              label: 'Tempo medio transizione',
              color: '#2196f3',
              valueFormatter: (value) => value != null ? formatHours(value) : '',
            },
          ]}
          height={300}
          margin={{ left: 60, right: 20, top: 20, bottom: 80 }}
          slotProps={{
            legend: {
              hidden: true,
            },
          }}
        />
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
        Tempo medio per ciascuna transizione di stato (ore/giorni)
      </Typography>
    </Paper>
  );
};
