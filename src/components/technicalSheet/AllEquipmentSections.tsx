/**
 * Sezioni apparecchiature della SCHEDA DATI DM329 — modalità "foglio di calcolo".
 *
 * Ogni sezione è un wrapper sottile che monta la tabella densa corrispondente.
 * La logica (codifiche, precompilazione autocomplete, auto-fill catalogo,
 * relazioni padre-figlio, OCR, visibilità tecnicoDM329, calcolo Categoria PED)
 * vive dentro le singole *Table in ./table.
 */

import { Control, Controller } from 'react-hook-form'
import { Grid, TextField } from '@mui/material'
import { CompressoriTable } from './table/CompressoriTable'
import { EssiccatoriTable } from './table/EssiccatoriTable'
import { FiltriTable } from './table/FiltriTable'
import { SeparatoriTable } from './table/SeparatoriTable'

interface SectionProps {
  control: Control<any>
  errors: any
}

// ============================================================================
// COMPRESSORI (C1-C5) + Disoleatori inline (C1.1-C5.1)
// ============================================================================
export const CompressoriSection = ({ control, errors }: SectionProps) => (
  <CompressoriTable control={control} errors={errors} />
)

// ============================================================================
// ESSICCATORI (E1-E4) + Scambiatori inline (E1.1-E4.1)
// ============================================================================
export const EssiccatoriSection = ({ control, errors }: SectionProps) => (
  <EssiccatoriTable control={control} errors={errors} />
)

// ============================================================================
// FILTRI (F1-F8) + Recipienti filtro inline (F1.1-F8.1)
// ============================================================================
export const FiltriSection = ({ control, errors }: SectionProps) => (
  <FiltriTable control={control} errors={errors} />
)

// ============================================================================
// SEPARATORI (SEP1-SEP3)
// ============================================================================
export const SeparatoriSection = ({ control, errors }: SectionProps) => (
  <SeparatoriTable control={control} errors={errors} />
)

// ============================================================================
// ALTRI APPARECCHI (Sezione 10) — campo libero, invariato
// ============================================================================
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
