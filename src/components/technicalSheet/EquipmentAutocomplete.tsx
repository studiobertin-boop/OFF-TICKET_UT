import { useState, useEffect } from 'react'
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
import type { EquipmentCatalogType } from '@/types'

interface EquipmentAutocompleteProps {
  // Tipo apparecchiatura (filtra le opzioni)
  equipmentType: EquipmentCatalogType

  // Valori controllati
  marcaValue: string
  modelloValue: string

  // Callbacks per cambiamenti
  onMarcaChange: (value: string) => void
  onModelloChange: (value: string) => void

  // Callback quando utente vuole aggiungere al catalogo
  onAddToCatalog?: (marca: string, modello: string) => void

  // Props opzionali
  disabled?: boolean
  readOnly?: boolean
  size?: 'small' | 'medium'
  fullWidth?: boolean
}

/**
 * Componente Autocomplete con filtri cascata per apparecchiature
 *
 * Funzionalità:
 * - Suggerimenti marca filtrati per tipo
 * - Suggerimenti modello filtrati per tipo + marca
 * - Input libero (freeSolo)
 * - Ordine per popolarità (usage_count)
 * - Bottone "+ Aggiungi" per nuove combinazioni
 */
export const EquipmentAutocomplete = ({
  equipmentType,
  marcaValue,
  modelloValue,
  onMarcaChange,
  onModelloChange,
  onAddToCatalog,
  disabled = false,
  readOnly = false,
  size = 'small',
  fullWidth = true,
}: EquipmentAutocompleteProps) => {
  const [marcheOptions, setMarcheOptions] = useState<string[]>([])
  const [modelliOptions, setModelliOptions] = useState<string[]>([])
  const [loadingMarche, setLoadingMarche] = useState(false)
  const [loadingModelli, setLoadingModelli] = useState(false)
  const [showAddButton, setShowAddButton] = useState(false)

  /**
   * Carica marche quando cambia il tipo
   */
  useEffect(() => {
    if (!equipmentType) return

    const loadMarche = async () => {
      console.log('🔍 Loading marche for tipo:', equipmentType)
      setLoadingMarche(true)
      try {
        const marche = await equipmentCatalogApi.getMarcheByTipo(equipmentType)
        console.log('✅ Marche loaded:', marche.length, 'items')
        setMarcheOptions(marche)
      } catch (error) {
        console.error('❌ Error loading marche:', error)
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
   * Verifica se mostrare bottone "Aggiungi"
   * Lo mostriamo se:
   * 1. Marca compilata ma non nei suggerimenti (nuova marca)
   * 2. Marca E modello compilati E non esistono nel catalogo
   */
  useEffect(() => {
    if (!marcaValue || !onAddToCatalog) {
      setShowAddButton(false)
      return
    }

    const checkExists = async () => {
      try {
        // Caso 1: Solo marca compilata, verifica se è nuova
        if (!modelloValue) {
          const marcaExists = marcheOptions.includes(marcaValue)
          setShowAddButton(!marcaExists)
          return
        }

        // Caso 2: Marca e modello compilati, verifica combinazione
        const exists = await equipmentCatalogApi.exists(equipmentType, marcaValue, modelloValue)
        setShowAddButton(!exists)
      } catch (error) {
        setShowAddButton(false)
      }
    }

    checkExists()
  }, [equipmentType, marcaValue, modelloValue, onAddToCatalog, marcheOptions])

  /**
   * Handle marca change
   */
  const handleMarcaChange = (_event: any, newValue: string | null) => {
    onMarcaChange(newValue || '')

    // Reset modello se marca cambia
    if (newValue !== marcaValue) {
      onModelloChange('')
    }
  }

  /**
   * Handle modello change
   */
  const handleModelloChange = (_event: any, newValue: string | null) => {
    onModelloChange(newValue || '')
  }

  /**
   * Handle add to catalog
   */
  const handleAddToCatalog = () => {
    if (onAddToCatalog && marcaValue && modelloValue) {
      onAddToCatalog(marcaValue, modelloValue)
    }
  }

  return (
    <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
      {/* Marca Autocomplete */}
      <Autocomplete
        freeSolo
        fullWidth={fullWidth}
        size={size}
        disabled={disabled || readOnly}
        value={marcaValue}
        onChange={handleMarcaChange}
        onInputChange={(_event, newInputValue) => {
          // Permetti editing libero
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
        fullWidth={fullWidth}
        size={size}
        disabled={disabled || readOnly || !marcaValue}
        value={modelloValue}
        onChange={handleModelloChange}
        onInputChange={(_event, newInputValue) => {
          // Permetti editing libero
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
    </Box>
  )
}
