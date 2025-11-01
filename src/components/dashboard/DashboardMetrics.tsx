import { Box, Card, CardContent, Typography, Grid, Skeleton } from '@mui/material';
import {
  Assignment as AssignmentIcon,
  OpenInNew as OpenIcon,
  Work as WorkIcon,
  CheckCircle as CompleteIcon,
} from '@mui/icons-material';
import type { OverviewMetrics } from '../../services/api/analytics';

interface DashboardMetricsProps {
  metrics?: OverviewMetrics;
  isLoading: boolean;
}

export function DashboardMetrics({ metrics, isLoading }: DashboardMetricsProps) {
  const cards = [
    {
      title: 'Totale Richieste',
      value: metrics?.totalRequests || 0,
      icon: <AssignmentIcon fontSize="large" />,
      color: '#2196f3',
    },
    {
      title: 'Aperte',
      value: metrics?.openRequests || 0,
      icon: <OpenIcon fontSize="large" />,
      color: '#ff9800',
    },
    {
      title: 'In Lavorazione',
      value: metrics?.inProgressRequests || 0,
      icon: <WorkIcon fontSize="large" />,
      color: '#9c27b0',
    },
    {
      title: 'Completate',
      value: metrics?.completedRequests || 0,
      icon: <CompleteIcon fontSize="large" />,
      color: '#4caf50',
    },
  ];

  return (
    <Grid container spacing={3}>
      {cards.map((card, index) => (
        <Grid item xs={12} sm={6} md={3} key={index}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" variant="body2" gutterBottom>
                    {card.title}
                  </Typography>
                  {isLoading ? (
                    <Skeleton width={60} height={40} />
                  ) : (
                    <Typography variant="h4" fontWeight="bold">
                      {card.value}
                    </Typography>
                  )}
                </Box>
                <Box
                  sx={{
                    backgroundColor: card.color,
                    borderRadius: 2,
                    p: 1.5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                  }}
                >
                  {card.icon}
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}
