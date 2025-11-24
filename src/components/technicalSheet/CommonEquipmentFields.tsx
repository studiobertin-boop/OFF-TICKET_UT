import { useState } from 'react'
import { Control, Controller, useFormContext } from 'react-hook-form'
import { TextField, Grid } from '@mui/material'
import { EquipmentAutocomplete } from './EquipmentAutocomplete'
import { AddToCatalogDialog } from './AddToCatalogDialog'
import type { EquipmentCatalogType } from '@/types'

interface CommonEquipmentFieldsProps {
  control: Control<any>
  basePath: string
  errors: any
  equipmentType?: EquipmentCatalogType // Tipo per filtri cascata
  readOnly?: boolean
  fields?: {
    marca?: boolean
    modello?: boolean
    n_fabbrica?: boolean
    materiale_n?: boolean
    anno?: boolean
    pressione_max?: boolean
    volume?: boolean
    note?: boolean
  }
}

/**
 * Campi comuni per apparecchiature
 * Riutilizzabile tra serbatoi, compressori, essiccatori, etc.
 * Con integrazione autocomplete marca/modello dal catalogo
 */
export const CommonEquipmentFields = ({
  control,
  basePath,
  errors,
  equipmentType,
  readOnly = false,
  fields = {},
}: CommonEquipmentFieldsProps) => {
  const {
    marca = true,
    modello = true,
    n_fabbrica = true,
    materiale_n = false,
    anno = true,
    pressione_max = false,
    volume = false,
    note = false,
  } = fields

  // State per dialog aggiungi al catalogo
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [pendingMarca, setPendingMarca] = useState('')
  const [pendingModello, setPendingModello] = useState('')

  // ✅ Hook per popolare campi da specs
  const { setValue } = useFormContext()

  // Helper per ottenere error path annidato
  const getError = (fieldName: string) => {
    const parts = `${basePath}.${fieldName}`.split('.')
    let error = errors
    for (const part of parts) {
      if (!error) return undefined
      error = error[part]
    }
    return error
  }

  // Handlers per autocomplete
  const handleAddToCatalog = (marca: string, modello: string) => {
    setPendingMarca(marca)
    setPendingModello(modello)
    setShowAddDialog(true)
  }

  const handleCatalogConfirm = () => {
    setShowAddDialog(false)
    // I valori sono già nel form, non serve fare altro
  }

  const handleCatalogCancel = () => {
    setShowAddDialog(false)
  }

  // ✅ Handler per popolare campi quando viene selezionata apparecchiatura dal catalogo
  const handleEquipmentSelected = (specs: Record<string, any>) => {
    console.log('📦 Populating fields from specs:', specs)

    // Mappa specs → campi form
    // Specs comuni: volume, fad, ps, ts, categoria_ped, ptar

    if (specs.volume !== undefined && volume) {
      setValue(`${basePath}.volume`, specs.volume)
    }

    if (specs.fad !== undefined) {
      // FAD può essere salvato come "fad" o "volume_aria_prodotto"
      setValue(`${basePath}.volume_aria_prodotto`, specs.fad)
      setValue(`${basePath}.fad`, specs.fad) // Backward compatibility
    }

    if (specs.ps !== undefined) {
      // PS può essere nei campi: ps_pressione_max, pressione_max
      setValue(`${basePath}.ps_pressione_max`, specs.ps)
      if (pressione_max) {
        setValue(`${basePath}.pressione_max`, specs.ps)
      }
    }

    if (specs.ts !== undefined) {
      setValue(`${basePath}.ts_temperatura`, specs.ts)
    }

    if (specs.categoria_ped !== undefined) {
      setValue(`${basePath}.categoria_ped`, specs.categoria_ped)
    }

    if (specs.ptar !== undefined) {
      setValue(`${basePath}.ptar`, specs.ptar)
    }

    console.log('✅ Fields populated from catalog')
  }

  return (
    <>
      <Grid container spacing={2}>
        {/* Marca e Modello con Autocomplete (se equipmentType specificato) */}
        {marca && modello && equipmentType ? (
          <Grid item xs={12}>
            <Controller
              name={`${basePath}.marca`}
              control={control}
              render={({ field: marcaField }) => (
                <Controller
                  name={`${basePath}.modello`}
                  control={control}
                  render={({ field: modelloField }) => (
                    <EquipmentAutocomplete
                      equipmentType={equipmentType}
                      marcaValue={marcaField.value || ''}
                      modelloValue={modelloField.value || ''}
                      onMarcaChange={marcaField.onChange}
                      onModelloChange={modelloField.onChange}
                      onAddToCatalog={handleAddToCatalog}
                      onEquipmentSelected={handleEquipmentSelected}
                      readOnly={readOnly}
                      size="small"
                      fullWidth
                    />
                  )}
                />
              )}
            />
          </Grid>
        ) : (
          <>
            {/* Fallback: TextField semplici se non c'è equipmentType */}
            {marca && (
              <Grid item xs={12} md={6}>
                <Controller
                  name={`${basePath}.marca`}
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Marca"
                      fullWidth
                      size="small"
                      disabled={readOnly}
                      error={!!getError('marca')}
                      helperText={getError('marca')?.message || 'Compilabile da OCR'}
                      placeholder="Es: Atlas Copco, Kaeser..."
                    />
                  )}
                />
              </Grid>
            )}

            {modello && (
              <Grid item xs={12} md={6}>
                <Controller
                  name={`${basePath}.modello`}
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Modello"
                      fullWidth
                      size="small"
                      disabled={readOnly}
                      error={!!getError('modello')}
                      helperText={getError('modello')?.message || 'Compilabile da OCR'}
                      placeholder="Es: GA 30, BSD 72..."
                    />
                  )}
                />
              </Grid>
            )}
          </>
        )}

      {/* N° di Fabbrica */}
      {n_fabbrica && (
        <Grid item xs={12} md={6}>
          <Controller
            name={`${basePath}.n_fabbrica`}
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="N° di Fabbrica / Matricola"
                fullWidth
                error={!!getError('n_fabbrica')}
                helperText={getError('n_fabbrica')?.message || 'Compilabile da OCR'}
                placeholder="Numero seriale"
              />
            )}
          />
        </Grid>
      )}

      {/* Materiale N° (solo compressori) */}
      {materiale_n && (
        <Grid item xs={12} md={6}>
          <Controller
            name={`${basePath}.materiale_n`}
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Materiale N°"
                fullWidth
                error={!!getError('materiale_n')}
                helperText={getError('materiale_n')?.message || 'Compilabile da OCR'}
                placeholder="Numero materiale"
              />
            )}
          />
        </Grid>
      )}

      {/* Anno */}
      {anno && (
        <Grid item xs={12} md={4}>
          <Controller
            name={`${basePath}.anno`}
            control={control}
            rules={{
              min: { value: 1980, message: 'Anno minimo: 1980' },
              max: { value: 2100, message: 'Anno massimo: 2100' },
            }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Anno"
                type="number"
                fullWidth
                error={!!getError('anno')}
                helperText={getError('anno')?.message || 'Compilabile da OCR'}
                placeholder="Es: 2015"
                inputProps={{ min: 1980, max: 2100 }}
                onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : '')}
              />
            )}
          />
        </Grid>
      )}

      {/* Pressione Max */}
      {pressione_max && (
        <Grid item xs={12} md={4}>
          <Controller
            name={`${basePath}.pressione_max`}
            control={control}
            rules={{
              min: { value: 10, message: 'Pressione minima: 10 bar' },
              max: { value: 30, message: 'Pressione massima: 30 bar' },
            }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Pressione Max (bar)"
                type="number"
                fullWidth
                error={!!getError('pressione_max')}
                helperText={getError('pressione_max')?.message || 'Compilabile da OCR (1 decimale)'}
                placeholder="Es: 13,0"
                inputProps={{ min: 10, max: 30, step: 0.1 }}
                onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : '')}
              />
            )}
          />
        </Grid>
      )}

      {/* Volume */}
      {volume && (
        <Grid item xs={12} md={4}>
          <Controller
            name={`${basePath}.volume`}
            control={control}
            rules={{
              min: { value: 50, message: 'Volume minimo: 50 litri' },
              max: { value: 5000, message: 'Volume massimo: 5000 litri' },
            }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Volume (litri)"
                type="number"
                fullWidth
                error={!!getError('volume')}
                helperText={getError('volume')?.message}
                placeholder="Es: 500"
                inputProps={{ min: 50, max: 5000 }}
                onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : '')}
              />
            )}
          />
        </Grid>
      )}

      {/* Note */}
      {note && (
        <Grid item xs={12}>
          <Controller
            name={`${basePath}.note`}
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Note"
                fullWidth
                multiline
                rows={2}
                error={!!getError('note')}
                helperText={getError('note')?.message}
                placeholder="Note aggiuntive..."
              />
            )}
          />
        </Grid>
      )}
    </Grid>

      {/* Dialog per aggiungere al catalogo */}
      {equipmentType && (
        <AddToCatalogDialog
          open={showAddDialog}
          equipmentType={equipmentType}
          marca={pendingMarca}
          modello={pendingModello}
          onConfirm={handleCatalogConfirm}
          onCancel={handleCatalogCancel}
        />
      )}
    </>
  )
}
