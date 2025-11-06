import { Grid, Paper, Typography, Box, Skeleton } from '@mui/material';

interface StatusTile {
  label: string;
  count: number;
  color?: string;
}

interface StatusTilesProps {
  tiles: StatusTile[];
  isLoading: boolean;
}

export const StatusTiles = ({ tiles, isLoading }: StatusTilesProps) => {
  if (isLoading) {
    return (
      <Grid container spacing={2}>
        {[...Array(tiles.length || 5)].map((_, index) => (
          <Grid item xs={12} sm={6} md={3} lg={2.4} key={index}>
            <Paper sx={{ p: 2 }}>
              <Skeleton variant="text" width="60%" height={24} />
              <Skeleton variant="text" width="40%" height={40} sx={{ mt: 1 }} />
            </Paper>
          </Grid>
        ))}
      </Grid>
    );
  }

  return (
    <Grid container spacing={2}>
      {tiles.map((tile, index) => (
        <Grid
          item
          xs={12}
          sm={6}
          md={tiles.length > 5 ? 3 : 4}
          lg={tiles.length > 5 ? 2.4 : 3}
          key={index}
        >
          <Paper
            sx={{
              p: 2,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              borderLeft: tile.color ? `4px solid ${tile.color}` : undefined,
              transition: 'transform 0.2s, box-shadow 0.2s',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: 4,
              },
            }}
          >
            <Typography
              variant="body2"
              color="text.secondary"
              gutterBottom
              sx={{
                fontSize: '0.85rem',
                fontWeight: 500,
                minHeight: '2.5em',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {tile.label}
            </Typography>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 1,
              }}
            >
              <Typography
                variant="h4"
                component="div"
                sx={{
                  fontWeight: 'bold',
                  color: tile.color || 'primary.main',
                }}
              >
                {tile.count}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {tile.count === 1 ? 'richiesta' : 'richieste'}
              </Typography>
            </Box>
          </Paper>
        </Grid>
      ))}
    </Grid>
  );
};
