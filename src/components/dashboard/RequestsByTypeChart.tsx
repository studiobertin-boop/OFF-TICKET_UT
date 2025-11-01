import { Card, CardContent, Typography, Box, Skeleton } from '@mui/material';
import { PieChart } from '@mui/x-charts/PieChart';
import type { TypeMetric } from '../../services/api/analytics';

interface RequestsByTypeChartProps {
  data?: TypeMetric[];
  isLoading: boolean;
}

const TYPE_COLORS = ['#2196f3', '#ff9800', '#4caf50', '#9c27b0', '#f44336', '#00bcd4'];

export function RequestsByTypeChart({ data, isLoading }: RequestsByTypeChartProps) {
  const chartData =
    data?.map((item, index) => ({
      id: index,
      value: item.count,
      label: item.type_name,
      color: TYPE_COLORS[index % TYPE_COLORS.length],
    })) || [];

  const isEmpty = !data || data.length === 0;

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Richieste per Tipo
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
