/**
 * Componente che racchiude tutte le sezioni apparecchiature
 * Per ottimizzare il numero di file e semplificare l'import
 *
 * MODIFICHE:
 * - Compressori: rinominato fad → volume_aria_prodotto (nascosto a tecnicoDM329)
 * - Disoleatori: aggiunti PS, TS, Categoria PED (nascosti a tecnicoDM329)
 * - Essiccatori: aggiunto PS (nascosto a tecnicoDM329), volume_aria_trattata nascosto
 * - Scambiatori: aggiunti PS, TS, Volume (nascosti a tecnicoDM329)
 */

import { Control, Controller, useFieldArray, useFormContext, useWatch } from 'react-hook-form'
import { Grid, FormControlLabel, Checkbox, TextField, Select, MenuItem, FormControl, InputLabel, Box, Typography } from '@mui/material'
import { EquipmentSection } from './EquipmentSection'
import { CommonEquipmentFields } from './CommonEquipmentFields'
import { ValvolaSicurezzaFields } from './ValvolaSicurezzaFields'
import { RecipienteFiltroFields } from './RecipienteFiltroFields'
import { SingleOCRButton } from './SingleOCRButton'
import { EQUIPMENT_LIMITS, generateEquipmentCode, type CategoriaPED } from '@/types'
import type { OCRExtractedData } from '@/types/ocr'
import { useTecnicoDM329Visibility } from '@/hooks/useTecnicoDM329Visibility'

const CATEGORIA_PED_OPTIONS: CategoriaPED[] = ['I', 'II', 'III', 'IV']

// ============================================================================
// COMPRESSORI (C1-C5)
// ============================================================================

interface CompressoriSectionProps {
  control: Control<any>
  errors: any
}

export const CompressoriSection = ({ control, errors }: CompressoriSectionProps) => {
  const { showAdvancedFields } = useTecnicoDM329Visibility()

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'compressori',
  })

  const { fields: disoleatoriFields, append: appendDisoleatore, remove: removeDisoleatore } = useFieldArray({
    control,
    name: 'disoleatori',
  })

  const { setValue, trigger } = useFormContext()

  const handleAdd = () => {
    append({
      codice: generateEquipmentCode(EQUIPMENT_LIMITS.compressori.prefix, fields.length + 1),
      ha_disoleatore: false,
    })
  }

  const handleOCRComplete = (index: number, data: OCRExtractedData) => {
    const basePath = `compressori.${index}`

    console.log('📝 Applicazione dati OCR a Compressore #' + (index + 1), data)

    // Popola campi comuni
    if (data.marca) setValue(`${basePath}.marca`, data.marca)
    if (data.modello) setValue(`${basePath}.modello`, data.modello)
    if (data.n_fabbrica) setValue(`${basePath}.n_fabbrica`, data.n_fabbrica)
    if (data.anno) setValue(`${basePath}.anno`, data.anno)
    if (data.pressione_max) setValue(`${basePath}.pressione_max`, data.pressione_max)
    if (data.materiale_n) setValue(`${basePath}.materiale_n`, data.materiale_n)

    // Valida
    trigger(basePath)
  }

  return (
    <EquipmentSection
      title="4. Compressori"
      subtitle="Da 1 a 5 compressori (C1-C5)"
      items={fields}
      maxItems={EQUIPMENT_LIMITS.compressori.max}
      minItems={EQUIPMENT_LIMITS.compressori.min}
      onAdd={handleAdd}
      onRemove={remove}
      generateCode={(index) => generateEquipmentCode(EQUIPMENT_LIMITS.compressori.prefix, index + 1)}
      itemTypeName="compressore"
      renderHeaderActions={(_item, index) => (
        <SingleOCRButton
          equipmentType="Compressori"
          equipmentIndex={index}
          onOCRComplete={(data) => handleOCRComplete(index, data)}
        />
      )}
      renderItem={(item, index) => {
        const compressoreCodice = (item as any).codice
        const haDisoleatore = useWatch({
          control,
          name: `compressori.${index}.ha_disoleatore`,
          defaultValue: false
        })

        // Handler per checkbox ha_disoleatore
        const handleHaDisoleatoreChange = (checked: boolean) => {
          setValue(`compressori.${index}.ha_disoleatore`, checked)

          if (checked) {
            // Verifica se esiste già un disoleatore per questo compressore
            const disoleatoreEsistente = disoleatoriFields.findIndex(
              (d: any) => d.compressore_associato === compressoreCodice
            )

            if (disoleatoreEsistente === -1) {
              // Crea disoleatore con codice compressoreCodice + '.1'
              appendDisoleatore({
                codice: `${compressoreCodice}.1`,
                compressore_associato: compressoreCodice,
                valvola_sicurezza: {},
              })
            }
          } else {
            // Rimuovi disoleatore associato
            const disoleatoreIndex = disoleatoriFields.findIndex(
              (d: any) => d.compressore_associato === compressoreCodice
            )
            if (disoleatoreIndex !== -1) {
              removeDisoleatore(disoleatoreIndex)
            }
          }
        }

        const disoleatoreIndex = disoleatoriFields.findIndex(
          (d: any) => d.compressore_associato === compressoreCodice
        )

        return (
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <CommonEquipmentFields
                control={control}
                basePath={`compressori.${index}`}
                errors={errors}
                equipmentType="Compressori"
                fields={{
                  marca: true,
                  modello: true,
                  n_fabbrica: true,
                  materiale_n: true, // Solo compressori
                  anno: true,
                  pressione_max: true,
                  note: true,
                }}
              />
            </Grid>
            {/* Volume aria prodotto - RINOMINATO - NASCOSTO a tecnicoDM329 */}
            {showAdvancedFields && (
              <Grid item xs={12} md={6}>
                <Controller
                  name={`compressori.${index}.volume_aria_prodotto`}
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="FAD - Volume d'aria prodotto (l/min)"
                      fullWidth
                      size="small"
                      type="number"
                      placeholder="Es: 500"
                      inputProps={{ min: 0, max: 100000, step: 1 }}
                      onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                      helperText="Intero da 0 a 100.000 l/min"
                    />
                  )}
                />
              </Grid>
            )}

            {/* FAD - DEPRECATED nascosto */}
            <Grid item xs={12} md={6} sx={{ display: 'none' }}>
              <Controller
                name={`compressori.${index}.fad`}
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="FAD (deprecated)"
                    fullWidth
                    size="small"
                    type="number"
                    inputProps={{ min: 0, max: 100000, step: 1 }}
                    onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                    helperText="Intero da 0 a 100.000 l/min"
                  />
                )}
              />
            </Grid>
            <Grid item xs={12}>
              <Controller
                name={`compressori.${index}.ha_disoleatore`}
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={field.value || false}
                        onChange={(e) => {
                          field.onChange(e.target.checked)
                          handleHaDisoleatoreChange(e.target.checked)
                        }}
                      />
                    }
                    label="Ha disoleatore da denunciare"
                  />
                )}
              />
            </Grid>

            {/* Disoleatore inline - Rendering condizionale */}
            {haDisoleatore && disoleatoreIndex !== -1 && (
              <Grid item xs={12}>
                <Box sx={{ mt: 2, p: 2, bgcolor: 'rgba(255, 235, 132, 0.35)', borderRadius: 1 }}>
                  <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 2 }}>
                    Disoleatore {compressoreCodice}.1 - Associato a {compressoreCodice}
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <CommonEquipmentFields
                        control={control}
                        basePath={`disoleatori.${disoleatoreIndex}`}
                        errors={errors}
                        equipmentType="Disoleatori"
                        fields={{
                          marca: true,
                          modello: true,
                          n_fabbrica: true,
                          anno: true,
                          volume: true,
                          note: true,
                        }}
                      />
                    </Grid>

                    {/* PS - Pressione Massima - NASCOSTO a tecnicoDM329 */}
                    {showAdvancedFields && (
                      <Grid item xs={12} md={4}>
                        <Controller
                          name={`disoleatori.${disoleatoreIndex}.ps_pressione_max`}
                          control={control}
                          render={({ field }) => (
                            <TextField
                              {...field}
                              label="PS - Pressione Massima (bar)"
                              type="number"
                              fullWidth
                              size="small"
                              placeholder="Es: 12.5"
                              inputProps={{ min: 3.0, max: 50.0, step: 0.1 }}
                              onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                              helperText="Da 3.0 a 50.0 bar (1 decimale)"
                            />
                          )}
                        />
                      </Grid>
                    )}

                    {/* TS - Temperatura Massima - NASCOSTO a tecnicoDM329 */}
                    {showAdvancedFields && (
                      <Grid item xs={12} md={4}>
                        <Controller
                          name={`disoleatori.${disoleatoreIndex}.ts_temperatura`}
                          control={control}
                          render={({ field }) => (
                            <TextField
                              {...field}
                              label="TS - Temperatura Massima (°C)"
                              type="number"
                              fullWidth
                              size="small"
                              placeholder="Es: 120"
                              inputProps={{ min: 50, max: 250, step: 1 }}
                              onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                              helperText="Intero da 50 a 250 °C"
                            />
                          )}
                        />
                      </Grid>
                    )}

                    {/* Categoria PED - NASCOSTO a tecnicoDM329 */}
                    {showAdvancedFields && (
                      <Grid item xs={12} md={4}>
                        <Controller
                          name={`disoleatori.${disoleatoreIndex}.categoria_ped`}
                          control={control}
                          render={({ field }) => (
                            <FormControl fullWidth size="small">
                              <InputLabel>Categoria PED</InputLabel>
                              <Select
                                {...field}
                                label="Categoria PED"
                                value={field.value || ''}
                              >
                                <MenuItem value=""><em>Nessuna</em></MenuItem>
                                {CATEGORIA_PED_OPTIONS.map((option) => (
                                  <MenuItem key={option} value={option}>{option}</MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          )}
                        />
                      </Grid>
                    )}

                    <Grid item xs={12}>
                      <ValvolaSicurezzaFields
                        control={control}
                        basePath={`disoleatori.${disoleatoreIndex}`}
                        errors={errors}
                        codiceValvola={`${compressoreCodice}.2`}
                        bgColor="rgba(255, 235, 132, 0.50)"
                      />
                    </Grid>
                  </Grid>
                </Box>
              </Grid>
            )}
          </Grid>
        )
      }}
    />
  )
}

// ============================================================================
// ESSICCATORI (E1-E4)
// ============================================================================

interface EssiccatoriSectionProps {
  control: Control<any>
  errors: any
}

export const EssiccatoriSection = ({ control, errors }: EssiccatoriSectionProps) => {
  const { showAdvancedFields } = useTecnicoDM329Visibility()

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'essiccatori',
  })

  const { fields: scambiatoriFields, append: appendScambiatore, remove: removeScambiatore } = useFieldArray({
    control,
    name: 'scambiatori',
  })

  const { setValue, trigger } = useFormContext()

  const handleAdd = () => {
    append({
      codice: generateEquipmentCode(EQUIPMENT_LIMITS.essiccatori.prefix, fields.length + 1),
      ha_scambiatore: false,
    })
  }

  const handleOCRComplete = (index: number, data: OCRExtractedData) => {
    const basePath = `essiccatori.${index}`

    console.log('📝 Applicazione dati OCR a Essiccatore #' + (index + 1), data)

    // Popola campi
    if (data.marca) setValue(`${basePath}.marca`, data.marca)
    if (data.modello) setValue(`${basePath}.modello`, data.modello)
    if (data.n_fabbrica) setValue(`${basePath}.n_fabbrica`, data.n_fabbrica)
    if (data.anno) setValue(`${basePath}.anno`, data.anno)
    if (data.pressione_max) setValue(`${basePath}.pressione_max`, data.pressione_max)

    // Valida
    trigger(basePath)
  }

  return (
    <EquipmentSection
      title="6. Essiccatori"
      subtitle="Da 1 a 4 essiccatori (E1-E4)"
      items={fields}
      maxItems={EQUIPMENT_LIMITS.essiccatori.max}
      minItems={EQUIPMENT_LIMITS.essiccatori.min}
      onAdd={handleAdd}
      onRemove={remove}
      generateCode={(index) => generateEquipmentCode(EQUIPMENT_LIMITS.essiccatori.prefix, index + 1)}
      itemTypeName="essiccatore"
      renderHeaderActions={(_item, index) => (
        <SingleOCRButton
          equipmentType="Essiccatori"
          equipmentIndex={index}
          onOCRComplete={(data) => handleOCRComplete(index, data)}
        />
      )}
      renderItem={(item, index) => {
        const essiccatoreCodice = (item as any).codice
        const haScambiatore = useWatch({
          control,
          name: `essiccatori.${index}.ha_scambiatore`,
          defaultValue: false
        })

        // Handler per checkbox ha_scambiatore
        const handleHaScambiatoreChange = (checked: boolean) => {
          setValue(`essiccatori.${index}.ha_scambiatore`, checked)

          if (checked) {
            // Verifica se esiste già uno scambiatore per questo essiccatore
            const scambiatoreEsistente = scambiatoriFields.findIndex(
              (s: any) => s.essiccatore_associato === essiccatoreCodice
            )

            if (scambiatoreEsistente === -1) {
              // Crea scambiatore con codice essiccatoreCodice + '.1'
              appendScambiatore({
                codice: `${essiccatoreCodice}.1`,
                essiccatore_associato: essiccatoreCodice,
              })
            }
          } else {
            // Rimuovi scambiatore associato
            const scambiatoreIndex = scambiatoriFields.findIndex(
              (s: any) => s.essiccatore_associato === essiccatoreCodice
            )
            if (scambiatoreIndex !== -1) {
              removeScambiatore(scambiatoreIndex)
            }
          }
        }

        const scambiatoreIndex = scambiatoriFields.findIndex(
          (s: any) => s.essiccatore_associato === essiccatoreCodice
        )

        return (
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <CommonEquipmentFields
                control={control}
                basePath={`essiccatori.${index}`}
                errors={errors}
                equipmentType="Essiccatori"
                fields={{
                  marca: true,
                  modello: true,
                  n_fabbrica: true,
                  anno: true,
                }}
              />
            </Grid>

            {/* PS - Pressione Massima - NUOVO - NASCOSTO a tecnicoDM329 */}
            {showAdvancedFields && (
              <Grid item xs={12} md={6}>
                <Controller
                  name={`essiccatori.${index}.ps_pressione_max`}
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="PS - Pressione Massima (bar)"
                      type="number"
                      fullWidth
                      size="small"
                      placeholder="Es: 12.5"
                      inputProps={{ min: 3.0, max: 50.0, step: 0.1 }}
                      onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                      helperText="Da 3.0 a 50.0 bar (1 decimale)"
                    />
                  )}
                />
              </Grid>
            )}

            {/* Pressione max - DEPRECATED nascosto */}
            <Grid item xs={12} md={6} sx={{ display: 'none' }}>
              <Controller
                name={`essiccatori.${index}.pressione_max`}
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Pressione max (deprecated)"
                    fullWidth
                    size="small"
                    disabled
                  />
                )}
              />
            </Grid>

            {/* Volume aria trattata - NASCOSTO a tecnicoDM329 */}
            {showAdvancedFields && (
              <Grid item xs={12} md={6}>
                <Controller
                  name={`essiccatori.${index}.volume_aria_trattata`}
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Q - Volume d'aria trattata (l/min)"
                      fullWidth
                      size="small"
                      type="number"
                      inputProps={{ min: 0, max: 100000, step: 1 }}
                      onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                      helperText="Intero da 0 a 100.000 l/min"
                    />
                  )}
                />
              </Grid>
            )}
            <Grid item xs={12}>
              <Controller
                name={`essiccatori.${index}.ha_scambiatore`}
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={field.value || false}
                        onChange={(e) => {
                          field.onChange(e.target.checked)
                          handleHaScambiatoreChange(e.target.checked)
                        }}
                    />
                  }
                  label="Ha scambiatore da denunciare"
                />
              )}
            />
          </Grid>

            {/* Scambiatore inline - Rendering condizionale */}
            {haScambiatore && scambiatoreIndex !== -1 && (
              <Grid item xs={12}>
                <Box sx={{ mt: 2, p: 2, bgcolor: 'rgba(200, 230, 201, 0.35)', borderRadius: 1 }}>
                  <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 2 }}>
                    Scambiatore {essiccatoreCodice}.1 - Associato a {essiccatoreCodice}
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <CommonEquipmentFields
                        control={control}
                        basePath={`scambiatori.${scambiatoreIndex}`}
                        errors={errors}
                        equipmentType="Scambiatori"
                        fields={{
                          marca: true,
                          modello: true,
                          n_fabbrica: true,
                          anno: true,
                        }}
                      />
                    </Grid>

                    {/* PS - Pressione Massima - NASCOSTO a tecnicoDM329 */}
                    {showAdvancedFields && (
                      <Grid item xs={12} md={4}>
                        <Controller
                          name={`scambiatori.${scambiatoreIndex}.ps_pressione_max`}
                          control={control}
                          render={({ field }) => (
                            <TextField
                              {...field}
                              label="PS - Pressione Massima (bar)"
                              type="number"
                              fullWidth
                              size="small"
                              placeholder="Es: 12.5"
                              inputProps={{ min: 3.0, max: 50.0, step: 0.1 }}
                              onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                              helperText="Da 3.0 a 50.0 bar (1 decimale)"
                            />
                          )}
                        />
                      </Grid>
                    )}

                    {/* TS - Temperatura Massima - NASCOSTO a tecnicoDM329 */}
                    {showAdvancedFields && (
                      <Grid item xs={12} md={4}>
                        <Controller
                          name={`scambiatori.${scambiatoreIndex}.ts_temperatura`}
                          control={control}
                          render={({ field }) => (
                            <TextField
                              {...field}
                              label="TS - Temperatura Massima (°C)"
                              type="number"
                              fullWidth
                              size="small"
                              placeholder="Es: 120"
                              inputProps={{ min: 50, max: 250, step: 1 }}
                              onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                              helperText="Intero da 50 a 250 °C"
                            />
                          )}
                        />
                      </Grid>
                    )}

                    {/* Volume - NASCOSTO a tecnicoDM329 */}
                    {showAdvancedFields && (
                      <Grid item xs={12} md={4}>
                        <Controller
                          name={`scambiatori.${scambiatoreIndex}.volume`}
                          control={control}
                          render={({ field }) => (
                            <TextField
                              {...field}
                              label="V - Volume (litri)"
                              type="number"
                              fullWidth
                              size="small"
                              placeholder="Es: 500"
                              inputProps={{ min: 50, max: 5000, step: 1 }}
                              onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                              helperText="Intero da 50 a 5.000 litri"
                            />
                          )}
                        />
                      </Grid>
                    )}
                  </Grid>
                </Box>
              </Grid>
            )}
          </Grid>
        )
      }}
    />
  )
}

// ============================================================================
// FILTRI (F1-F8)
// ============================================================================

interface FiltriSectionProps {
  control: Control<any>
  errors: any
}

export const FiltriSection = ({ control, errors }: FiltriSectionProps) => {
  const { showRecipienteFiltro } = useTecnicoDM329Visibility()

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'filtri',
  })

  const { fields: recipientiFields, append: appendRecipiente, remove: removeRecipiente } = useFieldArray({
    control,
    name: 'recipienti_filtro',
  })

  const { setValue, trigger } = useFormContext()

  const handleAdd = () => {
    append({
      codice: generateEquipmentCode(EQUIPMENT_LIMITS.filtri.prefix, fields.length + 1),
      ha_recipiente: false,
    })
  }

  const handleOCRComplete = (index: number, data: OCRExtractedData) => {
    const basePath = `filtri.${index}`

    console.log('📝 Applicazione dati OCR a Filtro #' + (index + 1), data)

    // Popola campi
    if (data.marca) setValue(`${basePath}.marca`, data.marca)
    if (data.modello) setValue(`${basePath}.modello`, data.modello)
    if (data.n_fabbrica) setValue(`${basePath}.n_fabbrica`, data.n_fabbrica)
    if (data.anno) setValue(`${basePath}.anno`, data.anno)

    // Valida
    trigger(basePath)
  }

  return (
    <EquipmentSection
      title="8. Filtri"
      subtitle="Da 1 a 8 filtri (F1-F8)"
      items={fields}
      maxItems={EQUIPMENT_LIMITS.filtri.max}
      minItems={EQUIPMENT_LIMITS.filtri.min}
      onAdd={handleAdd}
      onRemove={remove}
      generateCode={(index) => generateEquipmentCode(EQUIPMENT_LIMITS.filtri.prefix, index + 1)}
      itemTypeName="filtro"
      renderHeaderActions={(_item, index) => (
        <SingleOCRButton
          equipmentType="Filtri"
          equipmentIndex={index}
          onOCRComplete={(data) => handleOCRComplete(index, data)}
        />
      )}
      renderItem={(item, index) => {
        const filtroCodice = (item as any).codice
        const haRecipiente = useWatch({
          control,
          name: `filtri.${index}.ha_recipiente`,
          defaultValue: false
        })

        // Handler per checkbox ha_recipiente
        const handleHaRecipienteChange = (checked: boolean) => {
          setValue(`filtri.${index}.ha_recipiente`, checked)

          if (checked) {
            // Verifica se esiste già un recipiente per questo filtro
            const recipienteEsistente = recipientiFields.findIndex(
              (r: any) => r.filtro_associato === filtroCodice
            )

            if (recipienteEsistente === -1) {
              // Crea recipiente con codice filtroCodice + '.1'
              appendRecipiente({
                codice: `${filtroCodice}.1`,
                filtro_associato: filtroCodice,
              })
            }
          } else {
            // Rimuovi recipiente associato
            const recipienteIndex = recipientiFields.findIndex(
              (r: any) => r.filtro_associato === filtroCodice
            )
            if (recipienteIndex !== -1) {
              removeRecipiente(recipienteIndex)
            }
          }
        }

        const recipienteIndex = recipientiFields.findIndex(
          (r: any) => r.filtro_associato === filtroCodice
        )

        return (
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <CommonEquipmentFields
                control={control}
                basePath={`filtri.${index}`}
                errors={errors}
                equipmentType="Filtri"
                fields={{
                  marca: true,
                  modello: true,
                  n_fabbrica: true,
                  anno: true,
                }}
              />
            </Grid>

            {/* Checkbox ha_recipiente - Solo se non è tecnicoDM329 */}
            {showRecipienteFiltro && (
              <Grid item xs={12}>
                <Controller
                  name={`filtri.${index}.ha_recipiente`}
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={field.value || false}
                          onChange={(e) => {
                            field.onChange(e.target.checked)
                            handleHaRecipienteChange(e.target.checked)
                          }}
                        />
                      }
                      label="Ha recipiente filtro da denunciare"
                    />
                  )}
                />
              </Grid>
            )}

            {/* RecipienteFiltro - Rendering condizionale */}
            {haRecipiente && recipienteIndex !== -1 && showRecipienteFiltro && (
              <Grid item xs={12}>
                <RecipienteFiltroFields
                  control={control}
                  basePath={`recipienti_filtro.${recipienteIndex}`}
                  errors={errors}
                  codiceRecipiente={`${filtroCodice}.1`}
                  filtroAssociato={filtroCodice}
                  bgColor="rgba(255, 204, 188, 0.35)"
                />
              </Grid>
            )}
          </Grid>
        )
      }}
    />
  )
}

// ============================================================================
// SEPARATORI (SEP1-SEP3)
// ============================================================================

interface SeparatoriSectionProps {
  control: Control<any>
  errors: any
}

export const SeparatoriSection = ({ control, errors }: SeparatoriSectionProps) => {
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'separatori',
  })

  const { setValue, trigger } = useFormContext()

  const handleAdd = () => {
    append({
      codice: generateEquipmentCode(EQUIPMENT_LIMITS.separatori.prefix, fields.length + 1),
    })
  }

  const handleOCRComplete = (index: number, data: OCRExtractedData) => {
    const basePath = `separatori.${index}`

    console.log('📝 Applicazione dati OCR a Separatore #' + (index + 1), data)

    // Popola campi
    if (data.marca) setValue(`${basePath}.marca`, data.marca)
    if (data.modello) setValue(`${basePath}.modello`, data.modello)

    // Valida
    trigger(basePath)
  }

  return (
    <EquipmentSection
      title="9. Separatori"
      subtitle="Da 1 a 3 separatori (SEP1-SEP3)"
      items={fields}
      maxItems={EQUIPMENT_LIMITS.separatori.max}
      minItems={EQUIPMENT_LIMITS.separatori.min}
      onAdd={handleAdd}
      onRemove={remove}
      generateCode={(index) => generateEquipmentCode(EQUIPMENT_LIMITS.separatori.prefix, index + 1)}
      itemTypeName="separatore"
      renderHeaderActions={(_item, index) => (
        <SingleOCRButton
          equipmentType="Separatori"
          equipmentIndex={index}
          onOCRComplete={(data) => handleOCRComplete(index, data)}
        />
      )}
      renderItem={(_item, index) => (
        <CommonEquipmentFields
          control={control}
          basePath={`separatori.${index}`}
          errors={errors}
          equipmentType="Separatori"
          fields={{
            marca: true,
            modello: true,
          }}
        />
      )}
    />
  )
}

// ============================================================================
// ALTRI APPARECCHI (Sezione 10)
// ============================================================================

interface AltriApparecchiSectionProps {
  control: Control<any>
  errors: any
}

export const AltriApparecchiSection = ({ control }: AltriApparecchiSectionProps) => {
  return (
    <Grid container spacing={2}>
      <Grid item xs={12}>
        <Controller
          name="altri_apparecchi.descrizione"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="10. Altri Apparecchi - Descrizione"
              fullWidth
              multiline
              rows={4}
              placeholder="Inserire descrizione di eventuali altre apparecchiature presenti..."
            />
          )}
        />
      </Grid>
    </Grid>
  )
}
