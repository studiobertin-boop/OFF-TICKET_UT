import { Card, CardContent, Typography, Box, Skeleton } from '@mui/material';
import { PieChart } from '@mui/x-charts/PieChart';
import type { StatusMetric } from '../../services/api/analytics';
import { getStatusHex } from '@/theme/statusColors';
import { chartHeights } from '@/theme/tokens';
import { useThemeMode } from '@/theme';

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
  const { mode } = useThemeMode();

  // Filtra le pratiche chiuse e archiviate per DM329
  const filteredData = data?.filter(item =>
    item.status !== '7-CHIUSA' && item.status !== 'ARCHIVIATA NON FINITA'
  ) || [];

  const chartData =
    filteredData?.map((item, index) => ({
      id: index,
      value: item.count,
      label: item.label,
      color: getStatusHex(item.status, mode),
    })) || [];

  const isEmpty = !filteredData || filteredData.length === 0;

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
            height={chartHeights.pie}
            margin={{ top: 20, right: 20, bottom: 100, left: 20 }}
            slotProps={{
              legend: {
                direction: 'row',
                position: { vertical: 'bottom', horizontal: 'middle' },
                padding: 0,
                itemMarkWidth: 12,
                itemMarkHeight: 12,
                markGap: 5,
                itemGap: 10,
              },
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}
