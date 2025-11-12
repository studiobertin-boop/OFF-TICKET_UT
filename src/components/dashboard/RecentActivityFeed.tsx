import {
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Skeleton,
  Box,
  Chip,
} from '@mui/material';
import {
  AddCircle,
  SwapHoriz,
  Block,
  CheckCircle,
  LockOpen,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import type { RecentActivity, ActivityType } from '@/types';

interface RecentActivityFeedProps {
  data?: RecentActivity[];
  isLoading: boolean;
  title?: string;
}

const activityIcons: Record<ActivityType, React.ReactElement> = {
  APERTA: <AddCircle />,
  CAMBIO_STATO: <SwapHoriz />,
  BLOCCATA: <Block />,
  SBLOCCATA: <LockOpen />,
  COMPLETATA: <CheckCircle />,
};

const activityColors: Record<ActivityType, string> = {
  APERTA: '#2196f3',
  CAMBIO_STATO: '#9c27b0',
  BLOCCATA: '#f44336',
  SBLOCCATA: '#ff9800',
  COMPLETATA: '#4caf50',
};

export const RecentActivityFeed = ({
  data,
  isLoading,
  title = 'Ultime Attività',
}: RecentActivityFeedProps) => {
  if (isLoading) {
    return (
      <Card sx={{ height: '100%' }}>
        <CardContent>
          <Skeleton variant="text" width={200} height={32} sx={{ mb: 2 }} />
          <Box sx={{ maxHeight: 440, overflow: 'auto' }}>
            {[...Array(5)].map((_, i) => (
              <Box key={i} sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <Skeleton variant="circular" width={40} height={40} />
                <Box sx={{ flex: 1 }}>
                  <Skeleton variant="text" width="80%" />
                  <Skeleton variant="text" width="60%" />
                </Box>
              </Box>
            ))}
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card sx={{ height: '100%' }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {title}
          </Typography>
          <Box
            sx={{
              height: 440,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography color="text.secondary">
              Nessuna attività recente
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
        <List sx={{ maxHeight: 440, overflow: 'auto', py: 0 }}>
        {data.map((activity) => (
          <ListItem
            key={activity.activity_id}
            alignItems="flex-start"
            sx={{
              borderLeft: 4,
              borderColor: activityColors[activity.activity_type],
              mb: 1,
              bgcolor: 'background.default',
              borderRadius: 1,
            }}
          >
            <ListItemAvatar>
              <Avatar
                sx={{
                  bgcolor: activityColors[activity.activity_type],
                  width: 40,
                  height: 40,
                }}
              >
                {activityIcons[activity.activity_type]}
              </Avatar>
            </ListItemAvatar>
            <ListItemText
              primary={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Typography variant="body2" component="span">
                    {activity.activity_description}
                  </Typography>
                  <Chip
                    label={activity.activity_type}
                    size="small"
                    sx={{
                      bgcolor: activityColors[activity.activity_type],
                      color: 'white',
                      fontWeight: 'bold',
                      fontSize: '0.7rem',
                    }}
                  />
                </Box>
              }
              secondary={
                <Box sx={{ mt: 0.5 }}>
                  <Typography variant="body2" color="text.secondary" component="span">
                    <strong>{activity.request_title}</strong>
                  </Typography>
                  <br />
                  <Typography variant="caption" color="text.secondary" component="span">
                    {activity.user_name} • {format(new Date(activity.created_at), "d MMM yyyy 'alle' HH:mm", { locale: it })}
                  </Typography>
                </Box>
              }
            />
          </ListItem>
        ))}
        </List>
      </CardContent>
    </Card>
  );
};
