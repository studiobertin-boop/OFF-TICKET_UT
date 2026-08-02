import { Controller, useWatch, type Control, type FieldErrors, type FieldValues } from 'react-hook-form'
import { Grid, MenuItem, TextField, Typography } from '@mui/material'
import type { EquipmentCatalogType } from '@/types'
import { specsFieldsFor } from '@/utils/equipmentCatalogValidation'

interface EquipmentSpecsFieldsProps {
  control: Control<FieldValues>
  errors: FieldErrors
  tipo: EquipmentCatalogType | null
}

/**
 * Campi dei dati tecnici, generati dal contratto canonico del tipo scelto.
 *
 * Non c'è un form per tipo: l'elenco dei campi, le unità di misura e gli
 * intervalli ammessi vivono in un solo posto, condiviso con il motore di
 * verifica e con la normalizzazione. Aggiungere un dato a un tipo significa
 * dichiararlo lì, non ritoccare l'interfaccia.
 */
export const EquipmentSpecsFields = ({ control, errors, tipo }: EquipmentSpecsFieldsProps) => {
  // Alcuni campi dipendono da un altro dato della stessa riga (i giri solo sui rotativi a vite):
  // l'elenco va quindi ricalcolato a ogni modifica, non solo al cambio di tipo.
  const specs = useWatch({ control, name: 'specs' }) as Record<string, unknown> | undefined
  const campi = specsFieldsFor(tipo, specs ?? {})

  if (!tipo) {
    return (
      <Typography variant="body2" color="text.secondary">
        Scegli prima il tipo di apparecchiatura.
      </Typography>
    )
  }

  if (campi.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        Per «{tipo}» non sono previsti dati tecnici a catalogo.
      </Typography>
    )
  }

  return (
    <Grid container spacing={2}>
      {campi.map(def => {
        const errore = (errors.specs as FieldErrors | undefined)?.[def.key]
        const etichetta = def.unit ? `${def.label} [${def.unit}]` : def.label

        return (
          <Grid item xs={12} sm={6} key={def.key}>
            <Controller
              name={`specs.${def.key}`}
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  size="small"
                  select={def.kind === 'enum'}
                  type={def.kind === 'number' ? 'number' : 'text'}
                  label={etichetta}
                  value={field.value ?? ''}
                  onChange={e => {
                    const v = e.target.value
                    if (v === '') {
                      field.onChange(null)
                      return
                    }
                    field.onChange(def.kind === 'number' ? Number(v) : v)
                  }}
                  error={Boolean(errore)}
                  helperText={
                    (errore?.message as string | undefined) ??
                    (def.required ? 'Necessario alla compilazione della scheda dati' : ' ')
                  }
                  inputProps={
                    def.kind === 'number' ? { min: def.min, max: def.max, step: 'any' } : undefined
                  }
                >
                  {def.kind === 'enum' &&
                    (def.options ?? []).map(o => (
                      <MenuItem key={o} value={o}>
                        {def.optionLabels?.[o] ?? o}
                      </MenuItem>
                    ))}
                </TextField>
              )}
            />
          </Grid>
        )
      })}
    </Grid>
  )
}
