/**
 * Sezione "Altri apparecchi" della SCHEDA DATI DM329.
 *
 * Le sezioni per tipo (compressori, essiccatori, filtri, separatori, serbatoi) sono
 * state assorbite dalla tabella unica in ./table/UnifiedEquipmentTable: qui resta il
 * solo campo libero, che non ha una riga di tabella propria.
 */

import { Control, Controller } from 'react-hook-form'
import { TextField } from '@mui/material'

interface SectionProps {
  control: Control<any>
  errors?: any
}

export const AltriApparecchiSection = ({ control }: SectionProps) => (
  <Controller
    name="altri_apparecchi.descrizione"
    control={control}
    render={({ field }) => (
      <TextField
        {...field}
        label="Descrizione"
        fullWidth
        multiline
        rows={4}
        placeholder="Descrizione di eventuali altre apparecchiature presenti…"
      />
    )}
  />
)
