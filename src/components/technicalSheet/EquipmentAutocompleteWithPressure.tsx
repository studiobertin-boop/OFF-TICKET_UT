import { useState, useEffect, useRef } from 'react'
import {
  Autocomplete,
  TextField,
  CircularProgress,
  Box,
  IconButton,
  Tooltip,
} from '@mui/material'
import {
  Add as AddIcon,
  TrendingUp as PopularIcon,
} from '@mui/icons-material'
import { equipmentCatalogApi } from '@/services/api/equipmentCatalog'
import { AddEquipmentDialog } from './AddEquipmentDialog'

interface EquipmentAutocompleteWithPressureProps {
  // Tipo apparecchiatura (solo 'Compressori' o 'Valvole di sicurezza')
  equipmentType: 'Compressori' | 'Valvole di sicurezza'

  // Valori controllati
  marcaValue: string
  modelloValue: string
  pressioneValue: number | undefined

  // Callbacks per cambiamenti
  onMarcaChange: (value: string) => void
  onModelloChange: (value: string) => void
  onPressioneChange: (value: number | undefined) => void

  // Callback quando utente vuole aggiungere al catalogo
  onAddToCatalog?: (marca: string, modello: string, pressione: number) => void

  // Callback quando viene selezionata un'apparecchiatura esistente (con specs)
  onEquipmentSelected?: (specs: Record<string, any>) => void

  // Label e field per pressione (diversi per compressori vs valvole)
  pressioneLabel?: string
  pressioneField?: 'pressione_max' | 'ptar'

  // Props opzionali
  disabled?: boolean
  readOnly?: boolean
  size?: 'small' | 'medium'
  fullWidth?: boolean
}

/**
 * Componente Autocomplete con 3 step per apparecchiature che richiedono pressione
 *
 * Per COMPRESSORI:
 * - Step 1: Marca
 * - Step 2: Modello
 * - Step 3: Pressione Max
 * - Autocompleta: FAD
 *
 * Per VALVOLE DI SICUREZZA:
 * - Step 1: Marca
 * - Step 2: Modello
 * - Step 3: Ptar (Pressione di Taratura)
 * - Autocompleta: TS, Qmax, Diametro
 */
export const EquipmentAutocompleteWithPressure = ({
  equipmentType,
  marcaValue,
  modelloValue,
  pressioneValue,
  onMarcaChange,
  onModelloChange,
  onPressioneChange,
  onAddToCatalog,
  onEquipmentSelected,
  pressioneLabel = equipmentType === 'Compressori' ? 'Pressione Max (bar)' : 'Ptar (bar)',
  pressioneField = equipmentType === 'Compressori' ? 'pressione_max' : 'ptar',
  disabled = false,
  readOnly = false,
  size = 'small',
  // fullWidth prop accepted but not used directly (layout is flex-based)
}: EquipmentAutocompleteWithPressureProps) => {
  // Options state
  const [marcheOptions, setMarcheOptions] = useState<string[]>([])
  const [modelliOptions, setModelliOptions] = useState<string[]>([])
  const [pressioniOptions, setPressioniOptions] = useState<number[]>([])

  // Loading state
  const [loadingMarche, setLoadingMarche] = useState(false)
  const [loadingModelli, setLoadingModelli] = useState(false)
  const [loadingPressioni, setLoadingPressioni] = useState(false)

  // Add dialog state
  const [showAddButton, setShowAddButton] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  /**
   * Carica marche quando cambia il tipo
   */
  useEffect(() => {
    if (!equipmentType) return

    const loadMarche = async () => {
      setLoadingMarche(true)
      try {
        const marche = await equipmentCatalogApi.getMarcheByTipo(equipmentType)
        setMarcheOptions(marche)
      } catch (error) {
        console.error('Error loading marche:', error)
        setMarcheOptions([])
      } finally {
        setLoadingMarche(false)
      }
    }

    loadMarche()
  }, [equipmentType])

  /**
   * Carica modelli quando cambia marca
   */
  useEffect(() => {
    if (!equipmentType || !marcaValue) {
      setModelliOptions([])
      setPressioniOptions([])
      return
    }

    const loadModelli = async () => {
      setLoadingModelli(true)
      try {
        const modelli = await equipmentCatalogApi.getModelliByTipoMarca(equipmentType, marcaValue)
        setModelliOptions(modelli)
      } catch (error) {
        console.error('Error loading modelli:', error)
        setModelliOptions([])
      } finally {
        setLoadingModelli(false)
      }
    }

    loadModelli()
  }, [equipmentType, marcaValue])

  /**
   * Carica pressioni quando cambia modello
   */
  useEffect(() => {
    if (!equipmentType || !marcaValue || !modelloValue) {
      setPressioniOptions([])
      return
    }

    const loadPressioni = async () => {
      setLoadingPressioni(true)
      try {
        let pressioni: number[]
        if (equipmentType === 'Compressori') {
          pressioni = await equipmentCatalogApi.getPressioniByTipoMarcaModello(
            equipmentType, marcaValue, modelloValue
          )
        } else {
          pressioni = await equipmentCatalogApi.getPtarByTipoMarcaModello(
            equipmentType, marcaValue, modelloValue
          )
        }
        setPressioniOptions(pressioni)
      } catch (error) {
        console.error('Error loading pressioni:', error)
        setPressioniOptions([])
      } finally {
        setLoadingPressioni(false)
      }
    }

    loadPressioni()
  }, [equipmentType, marcaValue, modelloValue])

  /**
   * Verifica se mostrare bottone "Aggiungi"
   * Nota: il componente ha AddEquipmentDialog integrato, quindi non dipende da onAddToCatalog
   */
  useEffect(() => {
    if (!marcaValue || !modelloValue || pressioneValue === undefined) {
      setShowAddButton(false)
      return
    }

    const checkExists = async () => {
      try {
        let exists: boolean
        if (equipmentType === 'Compressori') {
          exists = await equipmentCatalogApi.existsWithPressione(
            equipmentType, marcaValue, modelloValue, pressioneValue
          )
        } else {
          exists = await equipmentCatalogApi.existsWithPtar(
            equipmentType, marcaValue, modelloValue, pressioneValue
          )
        }
        setShowAddButton(!exists)
      } catch (error) {
        setShowAddButton(false)
      }
    }

    checkExists()
  }, [equipmentType, marcaValue, modelloValue, pressioneValue])

  // Ref per tracciare l'ultima combinazione di valori per cui abbiamo già caricato gli specs
  const lastLoadedSpecsRef = useRef<string>('')

  /**
   * Carica specs quando tutti e 3 i campi sono compilati
   * Usa un ref per evitare loop infiniti quando onEquipmentSelected cambia
   */
  useEffect(() => {
    if (!marcaValue || !modelloValue || pressioneValue === undefined || !onEquipmentSelected) {
      return
    }

    // Crea una chiave unica per questa combinazione
    const specsKey = `${equipmentType}-${marcaValue}-${modelloValue}-${pressioneValue}`

    // Se abbiamo già caricato gli specs per questa combinazione, non ricaricare
    if (lastLoadedSpecsRef.current === specsKey) {
      return
    }

    const loadSpecs = async () => {
      try {
        let equipment
        if (equipmentType === 'Compressori') {
          equipment = await equipmentCatalogApi.getEquipmentByTipoMarcaModelloPressione(
            equipmentType, marcaValue, modelloValue, pressioneValue
          )
        } else {
          equipment = await equipmentCatalogApi.getEquipmentByTipoMarcaModelloPtar(
            equipmentType, marcaValue, modelloValue, pressioneValue
          )
        }

        if (equipment?.specs) {
          console.log('Equipment loaded from catalog (with pressure):', equipment)
          lastLoadedSpecsRef.current = specsKey
          onEquipmentSelected(equipment.specs as Record<string, any>)
        }
      } catch (error) {
        console.error('Error loading equipment specs:', error)
      }
    }

    loadSpecs()
  }, [equipmentType, marcaValue, modelloValue, pressioneValue, onEquipmentSelected])

  /**
   * Handle marca change
   */
  const handleMarcaChange = (_event: any, newValue: string | null) => {
    onMarcaChange(newValue || '')
    // Reset modello e pressione se marca cambia
    if (newValue !== marcaValue) {
      onModelloChange('')
      onPressioneChange(undefined)
    }
  }

  /**
   * Handle modello change
   */
  const handleModelloChange = (_event: any, newValue: string | null) => {
    onModelloChange(newValue || '')
    // Reset pressione se modello cambia
    if (newValue !== modelloValue) {
      onPressioneChange(undefined)
    }
  }

  /**
   * Handle pressione change
   */
  const handlePressioneChange = (_event: any, newValue: number | string | null) => {
    if (newValue === null || newValue === '') {
      onPressioneChange(undefined)
    } else if (typeof newValue === 'string') {
      const parsed = parseFloat(newValue)
      onPressioneChange(isNaN(parsed) ? undefined : parsed)
    } else {
      onPressioneChange(newValue)
    }
  }

  /**
   * Handle add to catalog
   */
  const handleAddToCatalog = () => {
    setDialogOpen(true)
  }

  /**
   * Handle dialog success
   */
  const handleDialogSuccess = async (marca: string, modello: string) => {
    // Aggiorna valori
    onMarcaChange(marca)
    onModelloChange(modello)

    // Ricarica opzioni
    try {
      const marche = await equipmentCatalogApi.getMarcheByTipo(equipmentType)
      setMarcheOptions(marche)

      const modelli = await equipmentCatalogApi.getModelliByTipoMarca(equipmentType, marca)
      setModelliOptions(modelli)
    } catch (error) {
      console.error('Error refreshing equipment options:', error)
    }

    if (onAddToCatalog && pressioneValue !== undefined) {
      onAddToCatalog(marca, modello, pressioneValue)
    }
  }

  return (
    <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      {/* Marca Autocomplete */}
      <Autocomplete
        freeSolo
        sx={{ minWidth: 180, flex: 1 }}
        size={size}
        disabled={disabled || readOnly}
        value={marcaValue}
        onChange={handleMarcaChange}
        onInputChange={(_event, newInputValue) => {
          if (!disabled && !readOnly) {
            onMarcaChange(newInputValue)
          }
        }}
        options={marcheOptions}
        loading={loadingMarche}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Marca"
            placeholder="Seleziona o digita..."
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <>
                  {loadingMarche ? <CircularProgress color="inherit" size={20} /> : null}
                  {params.InputProps.endAdornment}
                </>
              ),
            }}
          />
        )}
        renderOption={(props, option) => (
          <Box component="li" {...props}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
              <PopularIcon fontSize="small" sx={{ color: 'text.secondary' }} />
              {option}
            </Box>
          </Box>
        )}
      />

      {/* Modello Autocomplete */}
      <Autocomplete
        freeSolo
        sx={{ minWidth: 180, flex: 1 }}
        size={size}
        disabled={disabled || readOnly || !marcaValue}
        value={modelloValue}
        onChange={handleModelloChange}
        onInputChange={(_event, newInputValue) => {
          if (!disabled && !readOnly) {
            onModelloChange(newInputValue)
          }
        }}
        options={modelliOptions}
        loading={loadingModelli}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Modello"
            placeholder={marcaValue ? 'Seleziona o digita...' : 'Prima seleziona marca'}
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <>
                  {loadingModelli ? <CircularProgress color="inherit" size={20} /> : null}
                  {params.InputProps.endAdornment}
                </>
              ),
            }}
          />
        )}
        renderOption={(props, option) => (
          <Box component="li" {...props}>
            {option}
          </Box>
        )}
      />

      {/* Pressione Autocomplete (terzo campo) */}
      <Autocomplete
        freeSolo
        sx={{ minWidth: 150, flex: 0.8 }}
        size={size}
        disabled={disabled || readOnly || !modelloValue}
        value={pressioneValue !== undefined ? pressioneValue : null}
        onChange={handlePressioneChange}
        onInputChange={(_event, newInputValue) => {
          if (!disabled && !readOnly) {
            const parsed = parseFloat(newInputValue)
            onPressioneChange(isNaN(parsed) ? undefined : parsed)
          }
        }}
        options={pressioniOptions}
        loading={loadingPressioni}
        getOptionLabel={(option) => {
          if (option === null || option === undefined) return ''
          return typeof option === 'number' ? option.toString() : option
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            label={pressioneLabel}
            type="number"
            placeholder={modelloValue ? 'Seleziona o digita...' : 'Prima seleziona modello'}
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <>
                  {loadingPressioni ? <CircularProgress color="inherit" size={20} /> : null}
                  {params.InputProps.endAdornment}
                </>
              ),
            }}
            inputProps={{
              ...params.inputProps,
              step: 0.1,
              min: 0,
            }}
          />
        )}
        renderOption={(props, option) => (
          <Box component="li" {...props}>
            {option} bar
          </Box>
        )}
      />

      {/* Bottone Aggiungi al Catalogo */}
      {showAddButton && !readOnly && (
        <Tooltip title="Aggiungi al catalogo">
          <IconButton
            color="primary"
            onClick={handleAddToCatalog}
            size={size}
            sx={{ mt: size === 'small' ? 0.5 : 1 }}
          >
            <AddIcon />
          </IconButton>
        </Tooltip>
      )}

      {/* Dialog Aggiungi Equipment */}
      <AddEquipmentDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        equipmentType={equipmentType}
        onSuccess={handleDialogSuccess}
        initialPressione={pressioneValue}
        pressioneField={pressioneField}
      />
    </Box>
  )
}
