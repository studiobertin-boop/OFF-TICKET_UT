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
  Typography,
} from '@mui/material'
import { supabase } from '@/services/supabase'
import { equipmentCatalogApi } from '@/services/api/equipmentCatalog'
import type { CategoriaPED, EquipmentCatalogType } from '@/types'
import { calculateCategoriaPED, getCategoriaPEDDescription } from '@/utils/categoriaPedCalculator'

interface AddEquipmentDialogProps {
  open: boolean
  onClose: () => void
  equipmentType: string
  onSuccess?: (marca: string, modello: string) => void
  // Props per compressori e valvole (dove la pressione fa parte della chiave)
  initialPressione?: number
  pressioneField?: 'pressione_max' | 'ptar'
}

const CATEGORIA_PED_OPTIONS: CategoriaPED[] = ['I', 'II', 'III', 'IV']

/**
 * Dialog per aggiungere nuove apparecchiature al database equipment_catalog
 *
 * Campi supportati per tipo:
 * - SERBATOI: volume, ps, ts, categoria_ped (calcolata automaticamente)
 * - COMPRESSORI: pressione_max (chiave), fad
 * - ESSICCATORI: ps, q (volume_aria_trattata)
 * - DISOLEATORI: volume, ps, ts, categoria_ped (calcolata automaticamente)
 * - SCAMBIATORI: volume, ps, ts, categoria_ped (calcolata automaticamente)
 * - VALVOLE DI SICUREZZA: ptar (chiave), ts, qmax, diametro
 * - RECIPIENTI FILTRO: volume, ps, ts, categoria_ped
 */
export const AddEquipmentDialog = ({
  open,
  onClose,
  equipmentType,
  onSuccess,
  initialPressione,
  pressioneField,
}: AddEquipmentDialogProps) => {
  const [marca, setMarca] = useState('')
  const [modello, setModello] = useState('')
  const [volume, setVolume] = useState<number | ''>('')
  const [fad, setFad] = useState<number | ''>('')
  const [ps, setPs] = useState<number | ''>('')
  const [ts, setTs] = useState<number | ''>('')
  const [ptar, setPtar] = useState<number | ''>('')
  const [categoriaPed, setCategoriaPed] = useState<CategoriaPED | ''>('')
  // Nuovi campi
  const [q, setQ] = useState<number | ''>('') // Volume aria trattata (Essiccatori)
  const [qmax, setQmax] = useState<number | ''>('') // Volume aria scaricato (Valvole)
  const [diametro, setDiametro] = useState('') // Diametro (Valvole)
  const [pressioneMax, setPressioneMax] = useState<number | ''>('') // Pressione max (Compressori)
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

  // ✅ Inizializza pressione se passata come prop
  useEffect(() => {
    if (open && initialPressione !== undefined) {
      if (pressioneField === 'pressione_max') {
        setPressioneMax(initialPressione)
      } else if (pressioneField === 'ptar') {
        setPtar(initialPressione)
      }
    }
  }, [open, initialPressione, pressioneField])

  // ✅ Calcolo automatico categoria PED quando cambiano PS o Volume
  useEffect(() => {
    const showCategoriaPedCalc =
      equipmentType === 'Serbatoi' ||
      equipmentType === 'Disoleatori' ||
      equipmentType === 'Scambiatori' ||
      equipmentType === 'Recipienti filtro'

    if (showCategoriaPedCalc && ps !== '' && volume !== '') {
      const calculatedCategoria = calculateCategoriaPED(ps, volume)
      if (calculatedCategoria) {
        setCategoriaPed(calculatedCategoria)
      }
    }
  }, [ps, volume, equipmentType])

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
    setQ('')
    setQmax('')
    setDiametro('')
    setPressioneMax('')
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

    // Validazione specifica per compressori (pressione obbligatoria)
    if (equipmentType === 'Compressori' && pressioneMax === '') {
      setError('Per i compressori la Pressione Max è obbligatoria')
      return
    }

    // Validazione specifica per valvole (ptar obbligatoria)
    if (equipmentType === 'Valvole di sicurezza' && ptar === '') {
      setError('Per le valvole di sicurezza la Pressione di Taratura (Ptar) è obbligatoria')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Costruisci oggetto specs in base al tipo di equipment
      const specs: Record<string, any> = {}

      // ========================================
      // VOLUME (Serbatoi, Disoleatori, Scambiatori, Recipienti filtro)
      // ========================================
      if (
        volume !== '' &&
        (equipmentType === 'Serbatoi' ||
          equipmentType === 'Disoleatori' ||
          equipmentType === 'Scambiatori' ||
          equipmentType === 'Recipienti filtro')
      ) {
        specs.volume = volume
      }

      // ========================================
      // FAD (Compressori)
      // ========================================
      if (fad !== '' && equipmentType === 'Compressori') {
        specs.fad = fad
      }

      // ========================================
      // PRESSIONE MAX (Compressori) - FA PARTE DELLA CHIAVE UNIVOCA
      // ========================================
      if (pressioneMax !== '' && equipmentType === 'Compressori') {
        specs.pressione_max = pressioneMax
      }

      // ========================================
      // Q - Volume aria trattata (Essiccatori)
      // ========================================
      if (q !== '' && equipmentType === 'Essiccatori') {
        specs.q = q
      }

      // ========================================
      // PS (Serbatoi, Disoleatori, Essiccatori, Scambiatori, Recipienti filtro)
      // ========================================
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

      // ========================================
      // TS (Serbatoi, Disoleatori, Scambiatori, Recipienti filtro, Valvole)
      // ========================================
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

      // ========================================
      // PTAR (Valvole) - FA PARTE DELLA CHIAVE UNIVOCA
      // ========================================
      if (ptar !== '' && equipmentType === 'Valvole di sicurezza') {
        specs.ptar = ptar
      }

      // ========================================
      // QMAX - Volume aria scaricato (Valvole)
      // ========================================
      if (qmax !== '' && equipmentType === 'Valvole di sicurezza') {
        specs.qmax = qmax
      }

      // ========================================
      // DIAMETRO (Valvole)
      // ========================================
      if (diametro !== '' && equipmentType === 'Valvole di sicurezza') {
        specs.diametro = diametro
      }

      // ========================================
      // CATEGORIA PED (Serbatoi, Disoleatori, Scambiatori, Recipienti filtro)
      // ========================================
      if (
        categoriaPed !== '' &&
        (equipmentType === 'Serbatoi' ||
          equipmentType === 'Disoleatori' ||
          equipmentType === 'Scambiatori' ||
          equipmentType === 'Recipienti filtro')
      ) {
        specs.categoria_ped = categoriaPed
      }

      // Insert nel database
      const { error: insertError } = await supabase.from('equipment_catalog').insert({
        tipo: equipmentType, // ✅ Legacy field (NOT NULL)
        tipo_apparecchiatura: equipmentType, // ✅ Nuovo field strutturato
        marca,
        modello,
        specs: Object.keys(specs).length > 0 ? specs : null,
        is_user_defined: true, // ✅ Marca come aggiunto dall'utente
        usage_count: 1, // ✅ Inizializza contatore
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
    equipmentType === 'Disoleatori' ||
    equipmentType === 'Scambiatori' ||
    equipmentType === 'Recipienti filtro'
  const showFad = equipmentType === 'Compressori'
  const showPressioneMax = equipmentType === 'Compressori' // Pressione come chiave per compressori
  const showQ = equipmentType === 'Essiccatori' // Volume aria trattata
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
  const showQmax = equipmentType === 'Valvole di sicurezza' // Volume aria scaricato
  const showDiametro = equipmentType === 'Valvole di sicurezza'
  const showCategoriaPed =
    equipmentType === 'Serbatoi' ||
    equipmentType === 'Disoleatori' ||
    equipmentType === 'Scambiatori' ||
    equipmentType === 'Recipienti filtro'

  // Calcola descrizione categoria PED automatica
  const categoriaPedDescription = ps !== '' && volume !== ''
    ? getCategoriaPEDDescription(calculateCategoriaPED(ps, volume))
    : ''

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

          {/* PRESSIONE MAX - Obbligatorio per Compressori */}
          {showPressioneMax && (
            <Grid item xs={12} md={6}>
              <TextField
                label="Pressione Max (bar) *"
                type="number"
                value={pressioneMax}
                onChange={(e) => setPressioneMax(e.target.value ? parseFloat(e.target.value) : '')}
                fullWidth
                disabled={loading}
                required
                inputProps={{ min: 3.0, max: 30.0, step: 0.1 }}
                helperText="Obbligatorio - Fa parte della chiave univoca (stessa marca/modello può avere FAD diversi a pressioni diverse)"
                placeholder="Es: 8.0"
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

          {/* Q - Volume aria trattata (Essiccatori) */}
          {showQ && (
            <Grid item xs={12} md={6}>
              <TextField
                label="Q - Volume d'aria trattata (l/min)"
                type="number"
                value={q}
                onChange={(e) => setQ(e.target.value ? parseInt(e.target.value) : '')}
                fullWidth
                disabled={loading}
                inputProps={{ min: 0, max: 100000, step: 1 }}
                helperText="Opzionale - Intero da 0 a 100.000 l/min"
                placeholder="Es: 2000"
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

          {/* Ptar - Obbligatorio per Valvole */}
          {showPtar && (
            <Grid item xs={12} md={6}>
              <TextField
                label="Ptar - Pressione di Taratura (bar) *"
                type="number"
                value={ptar}
                onChange={(e) => setPtar(e.target.value ? parseFloat(e.target.value) : '')}
                fullWidth
                disabled={loading}
                required
                inputProps={{ min: 0, max: 100, step: 0.1 }}
                helperText="Obbligatorio - Fa parte della chiave univoca (stessa marca/modello può avere specs diverse a Ptar diverse)"
                placeholder="Es: 10.5"
              />
            </Grid>
          )}

          {/* Qmax - Volume aria scaricato (Valvole) */}
          {showQmax && (
            <Grid item xs={12} md={6}>
              <TextField
                label="Qmax - Volume aria scaricato (l/min)"
                type="number"
                value={qmax}
                onChange={(e) => setQmax(e.target.value ? parseInt(e.target.value) : '')}
                fullWidth
                disabled={loading}
                inputProps={{ min: 100, max: 100000, step: 1 }}
                helperText="Opzionale - Intero da 100 a 100.000 l/min"
                placeholder="Es: 5000"
              />
            </Grid>
          )}

          {/* Diametro (Valvole) */}
          {showDiametro && (
            <Grid item xs={12} md={6}>
              <TextField
                label="Diametro"
                value={diametro}
                onChange={(e) => setDiametro(e.target.value)}
                fullWidth
                disabled={loading}
                helperText='Opzionale - Es: 1/2", 3/4"'
                placeholder='Es: 1/2"'
              />
            </Grid>
          )}

          {/* Categoria PED - Calcolata automaticamente */}
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
              {categoriaPedDescription && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  Calcolata automaticamente: {categoriaPedDescription}
                </Typography>
              )}
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
