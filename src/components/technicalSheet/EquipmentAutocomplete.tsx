import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  Autocomplete,
  TextField,
  CircularProgress,
  Box,
  IconButton,
  Tooltip,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  List,
  ListItem,
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
import { variantSpecKey } from '@/services/equipmentAudit'
import { raggruppaVarianti, testoAvvisoVariante, type AvvisoVariante } from '@/utils/equipmentVarianti'

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

  /**
   * Dove disegnare il pulsante «aggiungi al catalogo».
   *
   * Nella tabella della scheda dati è una colonna a sé, subito dopo il codice: tenendolo
   * in coda alla cella marca/modello, le righe che lo mostrano avevano gli autocomplete
   * più stretti delle altre e i modelli non si allineavano più in colonna. La logica
   * (esistenza a catalogo, avviso varianti, dialog) resta qui: cambia solo dove esce.
   */
  contenitoreAggiunta?: HTMLElement | null
}

// Slot props condivisi per la modalità dense (popup più largo della colonna, opzioni piccole)
const denseSlotProps = {
  popper: { sx: { minWidth: 260 } },
  paper: { sx: { '& .MuiAutocomplete-option': { fontSize: '0.78rem', minHeight: 30, py: 0.25 } } },
} as const

/**
 * Il rientro orizzontale sta qui e non sul contenitore della cella: MUI azzera il padding
 * dell'input con `.MuiAutocomplete-root .MuiInput-root .MuiInput-input`, tre classi, e
 * qualunque regola scritta da fuori perde. Senza, marca e modello partivano 8px più a
 * sinistra delle proprie intestazioni. `!important` come già fa PressioneCatalogCell,
 * che si scontra con la stessa regola.
 */
const denseInputSx = { '& .MuiInputBase-input': { fontSize: '0.8rem', py: 0.5, padding: '4px 8px !important' } }

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
  contenitoreAggiunta,
}: EquipmentAutocompleteProps) => {
  const [marcheOptions, setMarcheOptions] = useState<string[]>([])
  const [modelliOptions, setModelliOptions] = useState<string[]>([])
  const [loadingMarche, setLoadingMarche] = useState(false)
  const [loadingModelli, setLoadingModelli] = useState(false)
  const [showAddButton, setShowAddButton] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  /** Bump dopo un inserimento: obbliga a rileggere il catalogo e far sparire il pulsante. */
  const [refreshCatalogo, setRefreshCatalogo] = useState(0)
  /**
   * Righe di catalogo del modello corrente, dall'ultima verifica di esistenza.
   *
   * Si tengono invece di scartarle: l'avviso deve elencare esattamente le varianti su cui
   * il pulsante è comparso, e rifare la query al momento del click potrebbe mostrarne altre.
   */
  const [righeCatalogo, setRigheCatalogo] = useState<EquipmentCatalogItem[]>([])
  const [avviso, setAvviso] = useState<AvvisoVariante | null>(null)
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
      setRigheCatalogo([])
      return
    }

    let annullato = false
    const timer = setTimeout(async () => {
      try {
        const righe = await equipmentCatalogApi.findVariants(equipmentType, marcaValue, modelloValue)
        if (annullato) return
        setRigheCatalogo(righe)

        // Modello del tutto assente: è una voce nuova.
        if (righe.length === 0) { setShowAddButton(true); return }

        // Il modello c'è e il tipo non ha varianti: non c'è nulla da aggiungere.
        if (!indicizzatoPerVariante) { setShowAddButton(false); return }

        // Il modello c'è: resta da vedere se manca proprio questa pressione. Il confronto è
        // con la pressione che la riga di catalogo dichiara alla scheda — la massima sui
        // compressori — che è la stessa che l'utente ha scritto nella colonna PS. Si passa da
        // `raggruppaVarianti` e non dalle righe grezze: due righe possono dichiarare la stessa
        // pressione (sono varianti distinte, indicizzate da un altro dato), e contarle entrambe
        // non cambierebbe l'esito qui ma lo farebbe nell'avviso più sotto — stessa fonte in
        // entrambi i punti, per non doverli tenere allineati a mano.
        const varianti = raggruppaVarianti(equipmentType, righe)
        setShowAddButton(variantValue != null && !varianti.some((v) => v.value === variantValue))
      } catch (error) {
        console.error('Errore nella verifica di esistenza a catalogo:', error)
        if (!annullato) { setShowAddButton(false); setRigheCatalogo([]) }
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
   * Click sul «+»: se il modello è già a catalogo ad altre pressioni si avvisa prima, così
   * chi sta per creare una quarta variante di una macchina che ne ha tre lo sa.
   */
  const handleAddToCatalog = () => {
    // Le varianti dell'avviso vengono dalle righe raggruppate, non da una riga di catalogo per
    // riga: due righe quasi-duplicate che dichiarano la stessa pressione sono una sola variante,
    // e l'elenco deve coincidere esattamente con le voci del menu della colonna PS — comprese le
    // varianti genuine alla stessa pressione, che sono macchine diverse e vanno mostrate distinte
    // (etichettaVariante ci aggiunge la portata apposta per questo).
    const varianti = raggruppaVarianti(equipmentType, righeCatalogo)

    const testo = indicizzatoPerVariante
      ? testoAvvisoVariante(equipmentType, {
          marca: marcaValue,
          modello: modelloValue,
          varianti,
          nuova: variantValue ?? null,
        })
      : null

    if (testo) setAvviso(testo)
    else setDialogOpen(true)
  }

  const confermaAvviso = () => {
    setAvviso(null)
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

      {/* Bottone Aggiungi al Catalogo: in linea, oppure nella colonna dedicata. */}
      {showAddButton && !readOnly && (() => {
        const bottone = (
          <Tooltip title={
            indicizzatoPerVariante && variantValue != null
              ? `Aggiungi al catalogo la variante a ${variantValue} bar`
              : 'Aggiungi al catalogo'
          }>
            <IconButton
              color="primary"
              onClick={handleAddToCatalog}
              size={size}
              sx={contenitoreAggiunta ? { p: 0.25 } : { mt: size === 'small' ? 0.5 : 1 }}
            >
              <AddIcon fontSize={contenitoreAggiunta ? 'small' : undefined} />
            </IconButton>
          </Tooltip>
        )
        return contenitoreAggiunta ? createPortal(bottone, contenitoreAggiunta) : bottone
      })()}

      {/* Conferma prima di creare una variante di un modello che c'è già.
          Non si usa window.confirm: basta che l'utente spunti una volta «impedisci a questa
          pagina di creare altre finestre di dialogo» perché il browser risponda false a ogni
          conferma successiva senza mostrarla. Stessa ragione già documentata in
          UnifiedEquipmentTable. */}
      <Dialog open={avviso !== null} onClose={() => setAvviso(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: '1rem' }}>{avviso?.titolo}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: '0.875rem' }}>{avviso?.intro}</DialogContentText>
          <List dense disablePadding sx={{ my: 0.5 }}>
            {avviso?.varianti.map((v, i) => (
              <ListItem
                key={i}
                disablePadding
                sx={{ display: 'list-item', listStyleType: 'disc', ml: 3, fontSize: '0.875rem', fontVariantNumeric: 'tabular-nums' }}
              >
                {v}
              </ListItem>
            ))}
          </List>
          <DialogContentText sx={{ fontSize: '0.875rem' }}>{avviso?.coda}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAvviso(null)}>Annulla</Button>
          <Button onClick={confermaAvviso} variant="contained">Aggiungi comunque</Button>
        </DialogActions>
      </Dialog>

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
