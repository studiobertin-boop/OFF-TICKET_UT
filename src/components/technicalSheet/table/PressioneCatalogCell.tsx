import { useEffect, useState } from 'react'
import { Controller, useWatch, type Control } from 'react-hook-form'
import { Autocomplete, TextField, Box } from '@mui/material'
import { equipmentCatalogApi } from '@/services/api/equipmentCatalog'
import { useNoAutofillToken } from '@/utils/noAutofill'

/**
 * Cella per la colonna PS/Ptar dei tipi indicizzati per pressione (compressori, valvole).
 *
 * Scelta marca+modello (nella cella accanto), questa cella:
 * - carica le pressioni disponibili a catalogo per quel modello;
 * - selezionandone una autocompila i dati dipendenti (FAD per compressori;
 *   TS/Qmax/diametro per valvole) tramite `onSelected`;
 * - permette comunque input libero.
 *
 * L'aggiunta al catalogo NON avviene qui: è uniforme per tutti i tipi tramite il
 * pulsante "+" della cella marca/modello (EquipmentAutocomplete).
 *
 * Il numero è allineato a destra come le celle numeriche normali.
 */
interface PressioneCatalogCellProps {
  control: Control<any>
  /** Base della riga, es. `compressori.0` oppure `serbatoi.0.valvola_sicurezza`. */
  base: string
  /** Tipo catalogo indicizzato per pressione. */
  catalogType: 'Compressori' | 'Valvole di sicurezza'
  /** Path relativo del campo pressione nel form (es. 'pressione_max', 'pressione_taratura'). */
  pressioneField: string
  /** Applica gli specs del catalogo ai campi dipendenti (riusa la logica specsMap della riga). */
  onSelected: (specs: Record<string, any>) => void
  min?: number
  max?: number
  step?: number
}

const denseSlotProps = {
  popper: { sx: { minWidth: 160 } },
  paper: { sx: { '& .MuiAutocomplete-option': { fontSize: '0.78rem', minHeight: 30, py: 0.25 } } },
} as const

// Allineamento identico a NumberCell: numero a destra, padding 8px, niente adornment a destra.
const autocompleteSx = {
  '& .MuiInputBase-root': { p: 0 },
  '& .MuiAutocomplete-endAdornment': { display: 'none' },
  '& .MuiAutocomplete-input': {
    textAlign: 'right',
    fontSize: '0.82rem',
    fontVariantNumeric: 'tabular-nums',
    p: '4px 8px !important',
  },
} as const

export const PressioneCatalogCell = ({
  control, base, catalogType, pressioneField, onSelected, min = 0, max = 100, step = 0.1,
}: PressioneCatalogCellProps) => {
  const marca = useWatch({ control, name: `${base}.marca` }) as string | undefined
  const modello = useWatch({ control, name: `${base}.modello` }) as string | undefined
  const [options, setOptions] = useState<number[]>([])
  const [loading, setLoading] = useState(false)
  const ac = useNoAutofillToken()

  const isCompressore = catalogType === 'Compressori'

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!marca || !modello) { setOptions([]); return }
      setLoading(true)
      try {
        const vals = isCompressore
          ? await equipmentCatalogApi.getPressioniByTipoMarcaModello(catalogType, marca, modello)
          : await equipmentCatalogApi.getPtarByTipoMarcaModello(catalogType, marca, modello)
        if (!cancelled) setOptions(vals)
      } catch (e) {
        console.error('Errore caricamento pressioni catalogo:', e)
        if (!cancelled) setOptions([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogType, marca, modello])

  const applySpecsForPressione = async (pressione: number) => {
    if (!marca || !modello) return
    try {
      const eq = isCompressore
        ? await equipmentCatalogApi.getEquipmentByTipoMarcaModelloPressione(catalogType, marca, modello, pressione)
        : await equipmentCatalogApi.getEquipmentByTipoMarcaModelloPtar(catalogType, marca, modello, pressione)
      if (eq?.specs) onSelected(eq.specs as Record<string, any>)
    } catch (e) {
      console.error('Errore caricamento specs pressione:', e)
    }
  }

  return (
    <Controller
      name={`${base}.${pressioneField}`}
      control={control}
      render={({ field }) => {
        const current = typeof field.value === 'number' ? field.value : undefined
        return (
          <Box sx={{ position: 'relative' }}>
            <Autocomplete
              freeSolo
              fullWidth
              openOnFocus
              disableClearable
              forcePopupIcon={false}
              disabled={!marca || !modello}
              value={current ?? ''}
              options={options}
              loading={loading}
              slotProps={denseSlotProps}
              getOptionLabel={(o) => (o === null || o === undefined || o === '' ? '' : typeof o === 'number' ? String(o) : o)}
              isOptionEqualToValue={(o, v) => o === v}
              onChange={(_e, v) => {
                if (v === null || (v as any) === '') { field.onChange(undefined); return }
                const num = typeof v === 'number' ? v : parseFloat(v)
                if (isNaN(num)) { field.onChange(undefined); return }
                field.onChange(num)
                if (options.includes(num)) applySpecsForPressione(num)
              }}
              onInputChange={(_e, v, reason) => {
                if (reason !== 'input') return
                const num = parseFloat(v)
                field.onChange(v === '' || isNaN(num) ? undefined : num)
              }}
              sx={autocompleteSx}
              renderInput={(params) => (
                <TextField
                  {...params}
                  type="number"
                  variant="standard"
                  placeholder="—"
                  InputProps={{ ...params.InputProps, disableUnderline: true }}
                  inputProps={{ ...params.inputProps, min, max, step, autoComplete: ac }}
                />
              )}
              renderOption={(props, option) => (
                <Box component="li" {...props}>{option} bar</Box>
              )}
            />
          </Box>
        )
      }}
    />
  )
}
