import { useEffect, useRef, useState } from 'react'
import { useController, useWatch, type Control } from 'react-hook-form'
import { Autocomplete, TextField, Box } from '@mui/material'
import { equipmentCatalogApi } from '@/services/api/equipmentCatalog'
import { etichettaVariante, type VarianteCatalogo } from '@/utils/equipmentVarianti'
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
    MozAppearance: 'textfield',
  },
  // Come nelle celle numeriche: il valore si scrive o si sceglie, non si incrementa.
  '& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button': {
    WebkitAppearance: 'none', margin: 0,
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
  const { field } = useController({ name: `${base}.${pressioneField}`, control })

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

  /**
   * La voce di catalogo è già in mano dal caricamento delle opzioni: nessuna seconda chiamata
   * di rete, e quindi nessuna finestra in cui gli indici delle righe possano scalare sotto.
   */
  const applica = (v: VarianteCatalogo) => {
    if (v.item?.specs) onSelected(v.item.specs as Record<string, any>, v.item)
  }

  /**
   * Digitazione libera: si applica la prima variante che dichiara quella pressione.
   *
   * Due varianti possono dichiararne una uguale — SK 19 ha la 7,5 bar e la 10 bar
   * entrambe a 11 di massima — e in quel caso solo la scelta dal menu, dove le distingue la
   * portata, dice quale si intende.
   */
  const applicaPressione = (pressione: number) => {
    const scelta = varianti.find((v) => v.value === pressione)
    if (scelta) applica(scelta)
  }

  /**
   * Marca e modello con una sola variante a catalogo: non c'è scelta da fare, quindi la si fa
   * da soli. Una volta per combinazione — il ref ricorda l'ultima marca+modello già tentata —
   * così uno svuotamento volontario del campo dopo l'autocompilazione non viene riscritto subito.
   */
  const autoApplicataRef = useRef<string | null>(null)
  useEffect(() => {
    const chiave = `${marca ?? ''}::${modello ?? ''}`
    if (varianti.length !== 1 || autoApplicataRef.current === chiave) return
    autoApplicataRef.current = chiave
    if (field.value == null) {
      field.onChange(varianti[0].value)
      applica(varianti[0])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [varianti, marca, modello])

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
        // Il tipo delle opzioni è ora VarianteCatalogo: il valore corrente, che resta un
        // numero nel form, va in stringa per rientrare nel tipo che freeSolo accetta.
        value={current === undefined ? '' : String(current)}
        options={varianti}
        loading={loading}
        slotProps={denseSlotProps}
        getOptionLabel={(o) =>
          o === null || o === undefined || o === '' ? '' : typeof o === 'object' ? String(o.value) : String(o)
        }
        // Il valore del campo è un numero, non una variante, e due varianti possono
        // dichiarare la stessa pressione: nessuna voce del menu si marca come scelta.
        isOptionEqualToValue={() => false}
        /* Il campo svuotato vale `null` e non `undefined`: quest'ultimo, per
           react-hook-form, è un campo mai valorizzato, e alla lettura ne
           ripescherebbe il default — la pressione che c'era prima. Stessa ragione
           documentata in `NumberCell`. */
        onChange={(_e, v) => {
          if (v === null || (v as any) === '') { field.onChange(null); return }
          if (typeof v === 'object') { field.onChange(v.value); applica(v); return }
          const num = typeof v === 'number' ? v : parseFloat(v)
          if (isNaN(num)) { field.onChange(null); return }
          field.onChange(num)
          applicaPressione(num)
        }}
        onInputChange={(_e, v, reason) => {
          if (reason !== 'input') return
          const num = parseFloat(v)
          field.onChange(v === '' || isNaN(num) ? null : num)
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
        renderOption={(props, option) => {
          // La chiave che MUI mette in `props` deriva dall'etichetta, che due varianti
          // possono avere uguale: si scarta e si usa l'id della riga di catalogo.
          // Niente destrutturazione con `_key`: il progetto non copre le variabili non
          // usate con `varsIgnorePattern`, solo gli argomenti (`argsIgnorePattern`).
          const rest = { ...props }
          delete (rest as any).key
          return (
            <Box component="li" key={option.item.id} {...rest}>
              {etichettaVariante(catalogType, option)}
            </Box>
          )
        }}
      />
    </Box>
  )
}
