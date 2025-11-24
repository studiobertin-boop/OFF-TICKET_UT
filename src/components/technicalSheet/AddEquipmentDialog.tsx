import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
} from '@mui/material'
import { supabase } from '@/services/supabase'
import { equipmentCatalogApi } from '@/services/api/equipmentCatalog'
import type { CategoriaPED, EquipmentCatalogType } from '@/types'

interface AddEquipmentDialogProps {
  open: boolean
  onClose: () => void
  equipmentType: string
  onSuccess?: (marca: string, modello: string) => void
}

const CATEGORIA_PED_OPTIONS: CategoriaPED[] = ['I', 'II', 'III', 'IV']

/**
 * Dialog per aggiungere nuove apparecchiature al database equipment_catalog
 *
 * Campi richiesti:
 * - Marca (obbligatorio)
 * - Modello (obbligatorio)
 * - specs.volume (per Serbatoi, Scambiatori, Recipienti filtro) - opzionale
 * - specs.fad (per Compressori) - opzionale
 * - specs.ps (per Serbatoi, Disoleatori, Essiccatori, Scambiatori, Recipienti filtro) - opzionale
 * - specs.ts (per Serbatoi, Disoleatori, Scambiatori, Recipienti filtro, Valvole) - opzionale
 * - specs.categoria_ped (per Serbatoi, Disoleatori, Recipienti filtro) - opzionale
 * - specs.ptar (per Valvole di sicurezza) - opzionale
 */
export const AddEquipmentDialog = ({
  open,
  onClose,
  equipmentType,
  onSuccess,
}: AddEquipmentDialogProps) => {
  const [marca, setMarca] = useState('')
  const [modello, setModello] = useState('')
  const [volume, setVolume] = useState<number | ''>('')
  const [fad, setFad] = useState<number | ''>('')
  const [ps, setPs] = useState<number | ''>('')
  const [ts, setTs] = useState<number | ''>('')
  const [ptar, setPtar] = useState<number | ''>('')
  const [categoriaPed, setCategoriaPed] = useState<CategoriaPED | ''>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ✅ Autocomplete options
  const [marcheOptions, setMarcheOptions] = useState<string[]>([])
  const [modelliOptions, setModelliOptions] = useState<string[]>([])
  const [loadingMarche, setLoadingMarche] = useState(false)
  const [loadingModelli, setLoadingModelli] = useState(false)

  // ✅ Load marche when dialog opens
  useEffect(() => {
    if (!open || !equipmentType) return

    const loadMarche = async () => {
      setLoadingMarche(true)
      try {
        const marche = await equipmentCatalogApi.getMarcheByTipo(equipmentType as EquipmentCatalogType)
        setMarcheOptions(marche)
      } catch (error) {
        console.error('Error loading marche:', error)
        setMarcheOptions([])
      } finally {
        setLoadingMarche(false)
      }
    }

    loadMarche()
  }, [open, equipmentType])

  // ✅ Load modelli when marca changes
  useEffect(() => {
    if (!equipmentType || !marca) {
      setModelliOptions([])
      return
    }

    const loadModelli = async () => {
      setLoadingModelli(true)
      try {
        const modelli = await equipmentCatalogApi.getModelliByTipoMarca(equipmentType as EquipmentCatalogType, marca)
        setModelliOptions(modelli)
      } catch (error) {
        console.error('Error loading modelli:', error)
        setModelliOptions([])
      } finally {
        setLoadingModelli(false)
      }
    }

    loadModelli()
  }, [equipmentType, marca])

  const handleClose = () => {
    // Reset form
    setMarca('')
    setModello('')
    setVolume('')
    setFad('')
    setPs('')
    setTs('')
    setPtar('')
    setCategoriaPed('')
    setError(null)
    setMarcheOptions([])
    setModelliOptions([])
    onClose()
  }

  const handleSubmit = async () => {
    if (!marca || !modello) {
      setError('Marca e Modello sono obbligatori')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Costruisci oggetto specs in base al tipo di equipment
      const specs: Record<string, any> = {}

      // Volume: Serbatoi, Scambiatori, Recipienti filtro
      if (
        volume !== '' &&
        (equipmentType === 'Serbatoi' ||
          equipmentType === 'Scambiatori' ||
          equipmentType === 'Recipienti filtro')
      ) {
        specs.volume = volume
      }

      // FAD: Compressori
      if (fad !== '' && equipmentType === 'Compressori') {
        specs.fad = fad
      }

      // PS: Serbatoi, Disoleatori, Essiccatori, Scambiatori, Recipienti filtro
      if (
        ps !== '' &&
        (equipmentType === 'Serbatoi' ||
          equipmentType === 'Disoleatori' ||
          equipmentType === 'Essiccatori' ||
          equipmentType === 'Scambiatori' ||
          equipmentType === 'Recipienti filtro')
      ) {
        specs.ps = ps
      }

      // TS: Serbatoi, Disoleatori, Scambiatori, Recipienti filtro, Valvole di sicurezza
      if (
        ts !== '' &&
        (equipmentType === 'Serbatoi' ||
          equipmentType === 'Disoleatori' ||
          equipmentType === 'Scambiatori' ||
          equipmentType === 'Recipienti filtro' ||
          equipmentType === 'Valvole di sicurezza')
      ) {
        specs.ts = ts
      }

      // Ptar: Valvole di sicurezza
      if (ptar !== '' && equipmentType === 'Valvole di sicurezza') {
        specs.ptar = ptar
      }

      // Categoria PED: Serbatoi, Disoleatori, Recipienti filtro
      if (
        categoriaPed !== '' &&
        (equipmentType === 'Serbatoi' ||
          equipmentType === 'Disoleatori' ||
          equipmentType === 'Recipienti filtro')
      ) {
        specs.categoria_ped = categoriaPed
      }

      // Insert nel database
      const { error: insertError } = await supabase.from('equipment_catalog').insert({
        tipo_apparecchiatura: equipmentType, // ✅ Fix: era equipment_type
        marca,
        modello,
        specs: Object.keys(specs).length > 0 ? specs : null,
      })

      if (insertError) throw insertError

      // Callback di successo
      if (onSuccess) {
        onSuccess(marca, modello)
      }

      handleClose()
    } catch (err: any) {
      console.error('Errore inserimento equipment:', err)
      setError(err.message || 'Errore durante l\'inserimento')
    } finally {
      setLoading(false)
    }
  }

  // Determina quali campi mostrare in base al tipo
  const showVolume =
    equipmentType === 'Serbatoi' ||
    equipmentType === 'Scambiatori' ||
    equipmentType === 'Recipienti filtro'
  const showFad = equipmentType === 'Compressori'
  const showPs =
    equipmentType === 'Serbatoi' ||
    equipmentType === 'Disoleatori' ||
    equipmentType === 'Essiccatori' ||
    equipmentType === 'Scambiatori' ||
    equipmentType === 'Recipienti filtro'
  const showTs =
    equipmentType === 'Serbatoi' ||
    equipmentType === 'Disoleatori' ||
    equipmentType === 'Scambiatori' ||
    equipmentType === 'Recipienti filtro' ||
    equipmentType === 'Valvole di sicurezza'
  const showPtar = equipmentType === 'Valvole di sicurezza'
  const showCategoriaPed =
    equipmentType === 'Serbatoi' ||
    equipmentType === 'Disoleatori' ||
    equipmentType === 'Recipienti filtro'

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Aggiungi {equipmentType} al Database</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Grid container spacing={2} sx={{ mt: 1 }}>
          {/* Marca - OBBLIGATORIO - CON AUTOCOMPLETE */}
          <Grid item xs={12} md={6}>
            <Autocomplete
              freeSolo
              fullWidth
              value={marca}
              onChange={(_event, newValue) => {
                setMarca(newValue || '')
                // Reset modello quando marca cambia
                if (newValue !== marca) {
                  setModello('')
                }
              }}
              onInputChange={(_event, newInputValue) => {
                setMarca(newInputValue)
                // Reset modello quando marca cambia
                if (newInputValue !== marca) {
                  setModello('')
                }
              }}
              options={marcheOptions}
              loading={loadingMarche}
              disabled={loading}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Marca *"
                  placeholder="Seleziona o digita..."
                  required
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
            />
          </Grid>

          {/* Modello - OBBLIGATORIO - CON AUTOCOMPLETE */}
          <Grid item xs={12} md={6}>
            <Autocomplete
              freeSolo
              fullWidth
              value={modello}
              onChange={(_event, newValue) => setModello(newValue || '')}
              onInputChange={(_event, newInputValue) => setModello(newInputValue)}
              options={modelliOptions}
              loading={loadingModelli}
              disabled={loading || !marca}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Modello *"
                  placeholder={marca ? 'Seleziona o digita...' : 'Prima seleziona marca'}
                  required
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
            />
          </Grid>

          {/* Volume - Opzionale */}
          {showVolume && (
            <Grid item xs={12} md={6}>
              <TextField
                label="Volume (litri)"
                type="number"
                value={volume}
                onChange={(e) => setVolume(e.target.value ? parseFloat(e.target.value) : '')}
                fullWidth
                disabled={loading}
                inputProps={{ min: 50, max: 5000, step: 1 }}
                helperText="Opzionale - Intero da 50 a 5.000 litri"
                placeholder="Es: 500"
              />
            </Grid>
          )}

          {/* FAD - Opzionale */}
          {showFad && (
            <Grid item xs={12} md={6}>
              <TextField
                label="FAD - Volume d'aria prodotto (l/min)"
                type="number"
                value={fad}
                onChange={(e) => setFad(e.target.value ? parseInt(e.target.value) : '')}
                fullWidth
                disabled={loading}
                inputProps={{ min: 0, max: 100000, step: 1 }}
                helperText="Opzionale - Intero da 0 a 100.000 l/min"
                placeholder="Es: 1200"
              />
            </Grid>
          )}

          {/* PS - Opzionale */}
          {showPs && (
            <Grid item xs={12} md={6}>
              <TextField
                label="PS - Pressione Massima (bar)"
                type="number"
                value={ps}
                onChange={(e) => setPs(e.target.value ? parseFloat(e.target.value) : '')}
                fullWidth
                disabled={loading}
                inputProps={{ min: 3.0, max: 50.0, step: 0.1 }}
                helperText="Opzionale - Da 3.0 a 50.0 bar (1 decimale)"
                placeholder="Es: 12.5"
              />
            </Grid>
          )}

          {/* TS - Opzionale */}
          {showTs && (
            <Grid item xs={12} md={6}>
              <TextField
                label="TS - Temperatura Massima (°C)"
                type="number"
                value={ts}
                onChange={(e) => setTs(e.target.value ? parseInt(e.target.value) : '')}
                fullWidth
                disabled={loading}
                inputProps={{ min: 50, max: 250, step: 1 }}
                helperText="Opzionale - Intero da 50 a 250 °C"
                placeholder="Es: 120"
              />
            </Grid>
          )}

          {/* Ptar - Opzionale */}
          {showPtar && (
            <Grid item xs={12} md={6}>
              <TextField
                label="Ptar - Pressione di Taratura (bar)"
                type="number"
                value={ptar}
                onChange={(e) => setPtar(e.target.value ? parseFloat(e.target.value) : '')}
                fullWidth
                disabled={loading}
                inputProps={{ min: 0, max: 100000, step: 0.1 }}
                helperText="Opzionale - Da 0 a 100.000 bar (1 decimale)"
                placeholder="Es: 10.5"
              />
            </Grid>
          )}

          {/* Categoria PED - Opzionale */}
          {showCategoriaPed && (
            <Grid item xs={12} md={6}>
              <FormControl fullWidth disabled={loading}>
                <InputLabel>Categoria PED</InputLabel>
                <Select
                  value={categoriaPed}
                  onChange={(e) => setCategoriaPed(e.target.value as CategoriaPED | '')}
                  label="Categoria PED"
                >
                  <MenuItem value="">
                    <em>Nessuna</em>
                  </MenuItem>
                  {CATEGORIA_PED_OPTIONS.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          )}
        </Grid>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Annulla
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || !marca || !modello}
          startIcon={loading ? <CircularProgress size={16} /> : null}
        >
          {loading ? 'Salvataggio...' : 'Aggiungi'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
