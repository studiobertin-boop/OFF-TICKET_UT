/**
 * Sezione "Altri apparecchi" della SCHEDA DATI DM329.
 *
 * Le sezioni per tipo (compressori, essiccatori, filtri, separatori, serbatoi) sono
 * state assorbite dalla tabella unica in ./table/UnifiedEquipmentTable: qui resta il
 * solo campo libero, che non ha una riga di tabella propria.
 */

import { Control, Controller } from 'react-hook-form'
import { Grid, TextField } from '@mui/material'

interface SectionProps {
  control: Control<any>
  errors?: any
}

export const AltriApparecchiSection = ({ control }: SectionProps) => (
  <Grid container spacing={2}>
    <Grid item xs={12}>
      <Controller
        name="altri_apparecchi.descrizione"
        control={control}
        render={({ field }) => (
          <TextField
            {...field}
            label="10. Altri Apparecchi - Descrizione"
            fullWidth
            multiline
            rows={4}
            placeholder="Inserire descrizione di eventuali altre apparecchiature presenti..."
          />
        )}
      />
    </Grid>
  </Grid>
)
