import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Alert,
  Autocomplete,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  TextField,
  Typography,
} from '@mui/material'
import { equipmentCatalogApi } from '@/services/api/equipmentCatalog'
import { equipmentCatalogAdminApi } from '@/services/api/equipmentCatalogAdmin'
import { EquipmentSpecsFields } from '@/components/equipmentCatalog/EquipmentSpecsFields'
import {
  createEquipmentSchema,
  specsSchemaFor,
  type CreateEquipmentInput,
} from '@/utils/equipmentCatalogValidation'
import { canonicalFromForm, formatSpecLabel, variantSpecKey } from '@/services/equipmentAudit'
import { calculateCategoriaPED, getCategoriaPEDDescription } from '@/utils/categoriaPedCalculator'
import type { EquipmentCatalogType } from '@/types'

interface AddEquipmentDialogProps {
  open: boolean
  onClose: () => void
  equipmentType: string
  onSuccess?: (marca: string, modello: string) => void
  /** Precompilazione marca/modello (es. quando si aggiunge una variante dalla riga). */
  initialMarca?: string
  initialModello?: string
  /**
   * Valori della riga di scheda da cui si sta creando la voce: precompilano i dati tecnici
   * senza doverli ridigitare. Sono campi della scheda, tradotti qui nelle chiavi canoniche.
   */
  initialRow?: Record<string, unknown>
}

/**
 * Dialog per aggiungere una voce al catalogo apparecchiature.
 *
 * I campi dei dati tecnici non sono scritti a mano: li genera `EquipmentSpecsFields` dal
 * contratto canonico del tipo, lo stesso che alimenta la pagina di gestione, la validazione Zod
 * e il motore di verifica. Aggiungere un dato a un tipo significa dichiararlo lì.
 *
 * L'inserimento passa da `equipmentCatalogAdminApi.create`, che normalizza marca e modello,
 * valorizza `created_by` e traduce il vincolo di unicità in un messaggio comprensibile.
 */
export const AddEquipmentDialog = ({
  open,
  onClose,
  equipmentType,
  onSuccess,
  initialMarca,
  initialModello,
  initialRow,
}: AddEquipmentDialogProps) => {
  const tipo = equipmentType as EquipmentCatalogType

  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [marcheOptions, setMarcheOptions] = useState<string[]>([])
  const [modelliOptions, setModelliOptions] = useState<string[]>([])
  const [loadingMarche, setLoadingMarche] = useState(false)
  const [loadingModelli, setLoadingModelli] = useState(false)

  const {
    control, handleSubmit, watch, setValue, reset, formState: { errors },
  } = useForm<CreateEquipmentInput>({
    resolver: zodResolver(createEquipmentSchema.extend({ specs: specsSchemaFor(tipo).optional() })),
    defaultValues: { tipo_apparecchiatura: tipo, marca: '', modello: '', specs: {} },
  })

  const marca = watch('marca')
  const modello = watch('modello')
  const specs = watch('specs') as Record<string, unknown> | undefined

  // Precompilazione all'apertura: marca/modello dalla riga e dati tecnici già compilati.
  useEffect(() => {
    if (!open) return
    reset({
      tipo_apparecchiatura: tipo,
      marca: initialMarca ?? '',
      modello: initialModello ?? '',
      specs: canonicalFromForm(tipo, initialRow ?? {}),
    })
    setError(null)
  }, [open, tipo, initialMarca, initialModello, initialRow, reset])

  useEffect(() => {
    if (!open || !tipo) return
    setLoadingMarche(true)
    equipmentCatalogApi.getMarcheByTipo(tipo)
      .then(setMarcheOptions)
      .catch((e) => { console.error('Errore caricamento marche:', e); setMarcheOptions([]) })
      .finally(() => setLoadingMarche(false))
  }, [open, tipo])

  useEffect(() => {
    if (!tipo || !marca) { setModelliOptions([]); return }
    setLoadingModelli(true)
    equipmentCatalogApi.getModelliByTipoMarca(tipo, marca)
      .then(setModelliOptions)
      .catch((e) => { console.error('Errore caricamento modelli:', e); setModelliOptions([]) })
      .finally(() => setLoadingModelli(false))
  }, [tipo, marca])

  /**
   * Categoria PED calcolata da PS × volume: è una derivata, non un dato da ricordare.
   * Vale solo per i recipienti, gli unici il cui contratto la prevede insieme a volume e PS.
   */
  const ps = specs?.ps
  const volume = specs?.volume
  useEffect(() => {
    if (typeof ps !== 'number' || typeof volume !== 'number') return
    const cat = calculateCategoriaPED(ps, volume)
    if (cat) setValue('specs.categoria_ped' as any, cat)
  }, [ps, volume, setValue])

  const descrizionePed = typeof ps === 'number' && typeof volume === 'number'
    ? getCategoriaPEDDescription(calculateCategoriaPED(ps, volume))
    : ''

  const chiaveVariante = variantSpecKey(tipo)

  const handleClose = () => {
    setError(null)
    onClose()
  }

  const onSubmit = async (values: CreateEquipmentInput) => {
    setLoading(true)
    setError(null)
    try {
      const creato = await equipmentCatalogAdminApi.create(values)
      onSuccess?.(creato.marca, creato.modello)
      handleClose()
    } catch (err: any) {
      setError(err?.message || 'Errore durante l\'inserimento')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Aggiungi {equipmentType} al catalogo</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {chiaveVariante && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Per questo tipo lo stesso modello può esistere a più pressioni: «
            {formatSpecLabel(tipo, chiaveVariante)}» distingue una variante dall'altra.
          </Alert>
        )}

        <Grid container spacing={2} sx={{ mt: 0 }}>
          <Grid item xs={12} md={6}>
            <Autocomplete
              freeSolo
              fullWidth
              value={marca || ''}
              onChange={(_e, v) => {
                setValue('marca', v || '', { shouldValidate: true })
                setValue('modello', '')
              }}
              onInputChange={(_e, v, reason) => {
                if (reason !== 'input') return
                setValue('marca', v, { shouldValidate: true })
              }}
              options={marcheOptions}
              loading={loadingMarche}
              disabled={loading}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Marca *"
                  placeholder="Seleziona o digita..."
                  error={Boolean(errors.marca)}
                  helperText={errors.marca?.message as string | undefined}
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

          <Grid item xs={12} md={6}>
            <Autocomplete
              freeSolo
              fullWidth
              value={modello || ''}
              onChange={(_e, v) => setValue('modello', v || '', { shouldValidate: true })}
              onInputChange={(_e, v, reason) => {
                if (reason !== 'input') return
                setValue('modello', v, { shouldValidate: true })
              }}
              options={modelliOptions}
              loading={loadingModelli}
              disabled={loading || !marca}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Modello *"
                  placeholder={marca ? 'Seleziona o digita...' : 'Prima seleziona marca'}
                  error={Boolean(errors.modello)}
                  helperText={errors.modello?.message as string | undefined}
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

          <Grid item xs={12}>
            <EquipmentSpecsFields control={control as any} errors={errors} tipo={tipo} />
            {descrizionePed && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                Categoria PED calcolata automaticamente: {descrizionePed}
              </Typography>
            )}
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>Annulla</Button>
        <Button
          onClick={handleSubmit(onSubmit)}
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
