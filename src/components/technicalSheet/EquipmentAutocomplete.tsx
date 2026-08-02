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
import type { EquipmentCatalogType, EquipmentCatalogItem } from '@/types'
import { AddEquipmentDialog } from './AddEquipmentDialog'
import { useNoAutofillToken } from '@/utils/noAutofill'
import { useTecnicoDM329Visibility } from '@/hooks/useTecnicoDM329Visibility'
import { readSheetPressure, variantSpecKey } from '@/services/equipmentAudit'

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

  /**
   * Valore che identifica la variante (pressione per i compressori, Ptar per le valvole).
   * Serve a capire se la combinazione modello + pressione manca a catalogo.
   */
  variantValue?: number | null

  /**
   * Valori della riga di scheda, per precompilare il dialog di inserimento a catalogo:
   * chi crea la voce ha appena digitato quei dati e non deve ridigitarli.
   */
  rowValues?: Record<string, unknown>

  // ✅ NEW: Callback quando viene selezionata un'apparecchiatura esistente (con dati completi)
  onEquipmentSelected?: (specs: Record<string, any>, fullData: EquipmentCatalogItem) => void

  // Props opzionali
  disabled?: boolean
  readOnly?: boolean
  size?: 'small' | 'medium'
  fullWidth?: boolean
  /** Modalità cella: input senza bordo/etichetta, opzioni piccole, popup più largo */
  dense?: boolean
}

// Slot props condivisi per la modalità dense (popup più largo della colonna, opzioni piccole)
const denseSlotProps = {
  popper: { sx: { minWidth: 260 } },
  paper: { sx: { '& .MuiAutocomplete-option': { fontSize: '0.78rem', minHeight: 30, py: 0.25 } } },
} as const

const denseInputSx = { '& .MuiInputBase-input': { fontSize: '0.8rem', py: 0.5 } }

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
  variantValue = null,
  rowValues,
  onEquipmentSelected,
  disabled = false,
  readOnly = false,
  size = 'small',
  fullWidth = true,
  dense = false,
}: EquipmentAutocompleteProps) => {
  const [marcheOptions, setMarcheOptions] = useState<string[]>([])
  const [modelliOptions, setModelliOptions] = useState<string[]>([])
  const [loadingMarche, setLoadingMarche] = useState(false)
  const [loadingModelli, setLoadingModelli] = useState(false)
  const [showAddButton, setShowAddButton] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  /** Bump dopo un inserimento: obbliga a rileggere il catalogo e far sparire il pulsante. */
  const [refreshCatalogo, setRefreshCatalogo] = useState(0)
  const ac = useNoAutofillToken()
  const { isTecnicoDM329 } = useTecnicoDM329Visibility()

  /** Il tipo ha più righe per lo stesso modello, distinte da una pressione. */
  const indicizzatoPerVariante = variantSpecKey(equipmentType) !== null

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
   * Il pulsante «aggiungi al catalogo» compare solo quando c'è davvero qualcosa da aggiungere:
   * una marca/modello che il catalogo non ha, oppure — per i tipi indicizzati per pressione —
   * una combinazione modello + pressione che non esiste ancora.
   *
   * Mostrarlo sempre lo rendeva rumore di fondo su ogni riga compilata, e invitava a duplicare
   * voci già presenti: l'opposto dell'obiettivo di tenere il catalogo ordinato.
   *
   * A `tecnicoDM329` resta comunque nascosto: la RLS non gli concede l'insert e il click
   * finirebbe in un errore di permessi.
   */
  useEffect(() => {
    if (readOnly || isTecnicoDM329 || !marcaValue || !modelloValue) {
      setShowAddButton(false)
      return
    }

    let annullato = false
    const timer = setTimeout(async () => {
      try {
        const righe = await equipmentCatalogApi.findVariants(equipmentType, marcaValue, modelloValue)
        if (annullato) return

        // Modello del tutto assente: è una voce nuova.
        if (righe.length === 0) { setShowAddButton(true); return }

        // Il modello c'è e il tipo non ha varianti: non c'è nulla da aggiungere.
        if (!indicizzatoPerVariante) { setShowAddButton(false); return }

        // Il modello c'è: resta da vedere se manca proprio questa pressione. Il confronto è
        // con la pressione che la riga di catalogo dichiara alla scheda — la massima sui
        // compressori — che è la stessa che l'utente ha scritto nella colonna PS.
        const valori = righe.map((r) => readSheetPressure(equipmentType, r.specs))
        setShowAddButton(variantValue != null && !valori.includes(variantValue))
      } catch (error) {
        console.error('Errore nella verifica di esistenza a catalogo:', error)
        if (!annullato) setShowAddButton(false)
      }
    }, 300)

    return () => { annullato = true; clearTimeout(timer) }
  }, [readOnly, isTecnicoDM329, equipmentType, marcaValue, modelloValue, variantValue, indicizzatoPerVariante, refreshCatalogo])

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
   * Scrive nel form solo la digitazione dell'utente.
   *
   * MUI emette `onInputChange` anche con `reason: 'reset'` — al mount e ogni volta che cambia
   * il prop `value` controllato. Senza questa guardia, quando l'eliminazione di una riga fa
   * scalare gli indici degli array il `Controller` si ri-registra su un percorso nuovo e MUI
   * ci riversa dentro l'`inputValue` che aveva ancora in pancia: il testo di una riga finisce
   * in un'altra, e una riga appena creata compare precompilata.
   * Stessa guardia di `PressioneCatalogCell`.
   */
  const soloDigitazione =
    (applica: (v: string) => void) =>
    (_event: any, newInputValue: string, reason: string) => {
      if (reason !== 'input') return
      if (disabled || readOnly) return
      applica(newInputValue)
    }

  /**
   * Handle modello change
   * ✅ NEW: Carica specs quando modello viene selezionato
   */
  const handleModelloChange = async (_event: any, newValue: string | null) => {
    onModelloChange(newValue || '')

    // ✅ Se modello selezionato, carica specs dal database
    if (newValue && marcaValue && onEquipmentSelected) {
      try {
        const equipment = await equipmentCatalogApi.getEquipmentByTipoMarcaModello(
          equipmentType,
          marcaValue,
          newValue
        )

        if (equipment) {
          console.log('✅ Equipment loaded from catalog:', equipment)
          // Passa sia specs che dati completi al callback
          onEquipmentSelected(equipment.specs as Record<string, any> || {}, equipment)
        }
      } catch (error) {
        console.error('Error loading equipment specs:', error)
      }
    }
  }

  /**
   * Handle add to catalog - Apre dialog
   */
  const handleAddToCatalog = () => {
    setDialogOpen(true)
  }

  /**
   * Handle dialog success - Aggiorna marca/modello e ricarica opzioni
   */
  const handleDialogSuccess = async (marca: string, modello: string) => {
    // Aggiorna valori
    onMarcaChange(marca)
    onModelloChange(modello)

    // Ricarica opzioni per aggiornare autocomplete
    try {
      const marche = await equipmentCatalogApi.getMarcheByTipo(equipmentType)
      setMarcheOptions(marche)

      const modelli = await equipmentCatalogApi.getModelliByTipoMarca(equipmentType, marca)
      setModelliOptions(modelli)
    } catch (error) {
      console.error('Error refreshing equipment options:', error)
    }

    // La voce ora esiste: il pulsante deve sparire
    setRefreshCatalogo((n) => n + 1)

    // Callback opzionale
    if (onAddToCatalog) {
      onAddToCatalog(marca, modello)
    }
  }

  return (
    <Box sx={{ display: 'flex', gap: dense ? 1 : 2, alignItems: 'flex-start' }}>
      {/* Marca Autocomplete */}
      <Autocomplete
        freeSolo
        fullWidth={fullWidth}
        size={size}
        disabled={disabled || readOnly}
        value={marcaValue}
        onChange={handleMarcaChange}
        onInputChange={soloDigitazione(onMarcaChange)}
        options={marcheOptions}
        loading={loadingMarche}
        slotProps={dense ? denseSlotProps : undefined}
        renderInput={(params) => (
          <TextField
            {...params}
            label={dense ? undefined : 'Marca'}
            placeholder={dense ? 'Marca' : 'Seleziona o digita...'}
            variant={dense ? 'standard' : 'outlined'}
            sx={dense ? denseInputSx : undefined}
            InputProps={{
              ...params.InputProps,
              disableUnderline: dense || undefined,
              endAdornment: (
                <>
                  {loadingMarche ? <CircularProgress color="inherit" size={20} /> : null}
                  {params.InputProps.endAdornment}
                </>
              ),
            }}
            inputProps={{ ...params.inputProps, autoComplete: ac }}
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
        onInputChange={soloDigitazione(onModelloChange)}
        options={modelliOptions}
        loading={loadingModelli}
        slotProps={dense ? denseSlotProps : undefined}
        renderInput={(params) => (
          <TextField
            {...params}
            label={dense ? undefined : 'Modello'}
            placeholder={dense ? 'Modello' : (marcaValue ? 'Seleziona o digita...' : 'Prima seleziona marca')}
            variant={dense ? 'standard' : 'outlined'}
            sx={dense ? denseInputSx : undefined}
            InputProps={{
              ...params.InputProps,
              disableUnderline: dense || undefined,
              endAdornment: (
                <>
                  {loadingModelli ? <CircularProgress color="inherit" size={20} /> : null}
                  {params.InputProps.endAdornment}
                </>
              ),
            }}
            inputProps={{ ...params.inputProps, autoComplete: ac }}
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
        <Tooltip title={
          indicizzatoPerVariante && variantValue != null
            ? `Aggiungi al catalogo la variante a ${variantValue} bar`
            : 'Aggiungi al catalogo'
        }>
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
        initialMarca={marcaValue}
        initialModello={modelloValue}
        initialRow={rowValues}
        onSuccess={handleDialogSuccess}
      />
    </Box>
  )
}
