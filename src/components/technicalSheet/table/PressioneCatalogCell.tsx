import { useEffect, useState } from 'react'
import { Controller, useWatch, type Control } from 'react-hook-form'
import { Autocomplete, TextField, Box } from '@mui/material'
import { equipmentCatalogApi, type VarianteCatalogo } from '@/services/api/equipmentCatalog'
import { useNoAutofillToken } from '@/utils/noAutofill'
import type { EquipmentCatalogItem, EquipmentCatalogType } from '@/types'

/**
 * Cella della colonna PS/Ptar per i tipi le cui righe di catalogo sono distinte dalla pressione.
 *
 * Scelta marca+modello nella cella accanto, questa cella:
 * - propone le pressioni che il catalogo ha per quel modello;
 * - selezionandone una autocompila i dati che ne dipendono (volume, FAD, Qmax, TS, categoria);
 * - accetta comunque un valore fuori elenco, che è il modo per censire una variante nuova:
 *   il pulsante «+» della cella marca/modello compare proprio in quel caso.
 *
 * La pressione viene prima della capacità, in tabella e nella compilazione: è la pressione a
 * dire di quale variante del modello si tratta, e quindi quale capacità il catalogo propone.
 */
interface PressioneCatalogCellProps {
  control: Control<any>
  /** Base della riga, es. `compressori.0` oppure `serbatoi.0.valvola_sicurezza`. */
  base: string
  catalogType: EquipmentCatalogType
  /** Path relativo del campo pressione nel form (es. 'ps_pressione_max', 'pressione_taratura'). */
  pressioneField: string
  /** Applica gli specs del catalogo ai campi dipendenti (riusa la logica specsMap della riga). */
  onSelected: (specs: Record<string, any>, item: EquipmentCatalogItem) => void
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
  const [varianti, setVarianti] = useState<VarianteCatalogo[]>([])
  const [loading, setLoading] = useState(false)
  const ac = useNoAutofillToken()

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!marca || !modello) { setVarianti([]); return }
      setLoading(true)
      try {
        const vals = await equipmentCatalogApi.getVarianti(catalogType, marca, modello)
        if (!cancelled) setVarianti(vals)
      } catch (e) {
        console.error('Errore caricamento pressioni catalogo:', e)
        if (!cancelled) setVarianti([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [catalogType, marca, modello])

  const options = varianti.map((v) => v.value)

  /**
   * La voce di catalogo è già in mano dal caricamento delle opzioni: nessuna seconda chiamata
   * di rete, e quindi nessuna finestra in cui gli indici delle righe possano scalare sotto.
   */
  const applicaVariante = (pressione: number) => {
    const scelta = varianti.find((v) => v.value === pressione)
    if (scelta?.item?.specs) onSelected(scelta.item.specs as Record<string, any>, scelta.item)
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
                applicaVariante(num)
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
                  placeholder={marca && modello ? '—' : 'Prima il modello'}
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
