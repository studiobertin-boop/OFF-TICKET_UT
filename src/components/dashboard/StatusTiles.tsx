import { Grid } from '@mui/material';
import { KpiTile } from '@/components/common';

interface StatusTile {
  label: string;
  count: number;
  color?: string;
  onClick?: () => void;
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
            <KpiTile label="" count={0} loading />
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
          <KpiTile
            label={tile.label}
            count={tile.count}
            accentColor={tile.color}
            onClick={tile.onClick}
          />
        </Grid>
      ))}
    </Grid>
  );
};
