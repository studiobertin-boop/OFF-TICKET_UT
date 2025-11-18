import { Control, Controller, useFieldArray, useFormContext } from 'react-hook-form'
import { Grid, TextField, FormControlLabel, Checkbox, Typography, Divider, Select, MenuItem, FormControl, InputLabel } from '@mui/material'
import { EquipmentSection } from './EquipmentSection'
import { CommonEquipmentFields } from './CommonEquipmentFields'
import { ValvolaSicurezzaFields } from './ValvolaSicurezzaFields'
import { SingleOCRButton } from './SingleOCRButton'
import { EQUIPMENT_LIMITS, generateEquipmentCode, type FinituraInternaOption, type ScaricoOption, type CategoriaPED } from '@/types'
import type { OCRExtractedData } from '@/types/ocr'
import { useTecnicoDM329Visibility } from '@/hooks/useTecnicoDM329Visibility'

const FINITURA_INTERNA_OPTIONS: FinituraInternaOption[] = ['VERNICIATO', 'ZINCATO', 'VITROFLEX', 'ALTRO']
const SCARICO_OPTIONS: ScaricoOption[] = ['AUTOMATICO', 'MANUALE', 'ASSENTE']
const CATEGORIA_PED_OPTIONS: CategoriaPED[] = ['I', 'II', 'III', 'IV']

interface SerbatoiSectionProps {
  control: Control<any>
  errors: any
}

export const SerbatoiSection = ({ control, errors }: SerbatoiSectionProps) => {
  const { showAdvancedFields } = useTecnicoDM329Visibility()

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'serbatoi',
  })

  const { setValue, trigger } = useFormContext()

  const handleAdd = () => {
    const newIndex = fields.length + 1
    append({
      codice: generateEquipmentCode(EQUIPMENT_LIMITS.serbatoi.prefix, newIndex),
      valvola_sicurezza: {}, // Obbligatoria
      manometro: {},
    })
  }

  const handleOCRComplete = (index: number, data: OCRExtractedData) => {
    const basePath = `serbatoi.${index}`

    console.log('📝 Applicazione dati OCR a Serbatoio #' + (index + 1), data)

    // Popola campi comuni
    if (data.marca) setValue(`${basePath}.marca`, data.marca)
    if (data.modello) setValue(`${basePath}.modello`, data.modello)
    if (data.n_fabbrica) setValue(`${basePath}.n_fabbrica`, data.n_fabbrica)
    if (data.anno) setValue(`${basePath}.anno`, data.anno)
    if (data.volume) setValue(`${basePath}.volume`, data.volume)
    if (data.pressione_max) setValue(`${basePath}.pressione_max`, data.pressione_max)

    // Popola valvola di sicurezza (se presente nei dati OCR)
    if (data.valvola_sicurezza) {
      if (data.valvola_sicurezza.marca) {
        setValue(`${basePath}.valvola_sicurezza.marca`, data.valvola_sicurezza.marca)
      }
      if (data.valvola_sicurezza.modello) {
        setValue(`${basePath}.valvola_sicurezza.modello`, data.valvola_sicurezza.modello)
      }
      if (data.valvola_sicurezza.n_fabbrica) {
        setValue(`${basePath}.valvola_sicurezza.n_fabbrica`, data.valvola_sicurezza.n_fabbrica)
      }
      if (data.valvola_sicurezza.diametro_pressione) {
        setValue(`${basePath}.valvola_sicurezza.diametro_pressione`, data.valvola_sicurezza.diametro_pressione)
      }
    }

    // Popola manometro (se presente)
    if (data.manometro) {
      if (data.manometro.fondo_scala) {
        setValue(`${basePath}.manometro.fondo_scala`, data.manometro.fondo_scala)
      }
      if (data.manometro.segno_rosso) {
        setValue(`${basePath}.manometro.segno_rosso`, data.manometro.segno_rosso)
      }
    }

    // Valida immediatamente i campi
    trigger(basePath)
  }

  // Handler OCR specifico per valvola di sicurezza (S1.1, S2.1, etc.)
  const handleValvolaOCRComplete = (index: number, data: OCRExtractedData) => {
    const basePath = `serbatoi.${index}.valvola_sicurezza`

    console.log('📝 Applicazione dati OCR a Valvola di Sicurezza S' + (index + 1) + '.1', data)

    // Popola campi valvola da OCR
    if (data.marca) setValue(`${basePath}.marca`, data.marca)
    if (data.modello) setValue(`${basePath}.modello`, data.modello)
    if (data.n_fabbrica) setValue(`${basePath}.n_fabbrica`, data.n_fabbrica)
    if (data.diametro_pressione) setValue(`${basePath}.diametro_pressione`, data.diametro_pressione)

    // Valida immediatamente
    trigger(basePath)
  }

  return (
    <EquipmentSection
      title="3. Serbatoi"
      subtitle="Massimo 7 serbatoi (S1-S7). Ogni serbatoio DEVE avere una valvola di sicurezza."
      items={fields}
      maxItems={EQUIPMENT_LIMITS.serbatoi.max}
      minItems={EQUIPMENT_LIMITS.serbatoi.min}
      onAdd={handleAdd}
      onRemove={remove}
      generateCode={(index) => generateEquipmentCode(EQUIPMENT_LIMITS.serbatoi.prefix, index + 1)}
      itemTypeName="serbatoio"
      renderHeaderActions={(_item, index) => (
        <SingleOCRButton
          equipmentType="Serbatoi"
          equipmentIndex={index}
          onOCRComplete={(data) => handleOCRComplete(index, data)}
        />
      )}
      renderItem={(_item, index) => (
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <CommonEquipmentFields
              control={control}
              basePath={`serbatoi.${index}`}
              errors={errors}
              equipmentType="Serbatoi"
              fields={{
                marca: true,
                modello: showAdvancedFields, // Nascosto a tecnicoDM329
                n_fabbrica: true,
                anno: true,
                volume: true,
                note: true,
              }}
            />
          </Grid>

          {/* PS - Pressione Massima - NUOVO - NASCOSTO a tecnicoDM329 */}
          {showAdvancedFields && (
            <Grid item xs={12} md={4}>
              <Controller
                name={`serbatoi.${index}.ps_pressione_max`}
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

          {/* TS - Temperatura Massima - NUOVO - NASCOSTO a tecnicoDM329 */}
          {showAdvancedFields && (
            <Grid item xs={12} md={4}>
              <Controller
                name={`serbatoi.${index}.ts_temperatura`}
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

          {/* Categoria PED - NUOVO - NASCOSTO a tecnicoDM329 */}
          {showAdvancedFields && (
            <Grid item xs={12} md={4}>
              <Controller
                name={`serbatoi.${index}.categoria_ped`}
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth size="small">
                    <InputLabel>Categoria PED</InputLabel>
                    <Select
                      {...field}
                      label="Categoria PED"
                      value={field.value || ''}
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
                )}
              />
            </Grid>
          )}

          {/* Finitura Interna */}
          <Grid item xs={12} md={4}>
            <Controller
              name={`serbatoi.${index}.finitura_interna`}
              control={control}
              render={({ field }) => (
                <FormControl fullWidth size="small">
                  <InputLabel>Finitura Interna</InputLabel>
                  <Select
                    {...field}
                    label="Finitura Interna"
                    value={field.value || ''}
                  >
                    <MenuItem value="">
                      <em>Nessuna</em>
                    </MenuItem>
                    {FINITURA_INTERNA_OPTIONS.map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            />
          </Grid>

          {/* Ancorato a Terra */}
          <Grid item xs={12} md={4}>
            <Controller
              name={`serbatoi.${index}.ancorato_terra`}
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={field.value || false}
                      onChange={(e) => field.onChange(e.target.checked)}
                    />
                  }
                  label="Ancorato a Terra"
                />
              )}
            />
          </Grid>

          {/* Scarico */}
          <Grid item xs={12} md={4}>
            <Controller
              name={`serbatoi.${index}.scarico`}
              control={control}
              render={({ field }) => (
                <FormControl fullWidth size="small">
                  <InputLabel>Scarico</InputLabel>
                  <Select
                    {...field}
                    label="Scarico"
                    value={field.value || ''}
                  >
                    <MenuItem value="">
                      <em>Nessuna</em>
                    </MenuItem>
                    {SCARICO_OPTIONS.map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            />
          </Grid>

          {/* Valvola di Sicurezza - OBBLIGATORIA */}
          <Grid item xs={12}>
            <ValvolaSicurezzaFields
              control={control}
              basePath={`serbatoi.${index}`}
              errors={errors}
              codiceValvola={`S${index + 1}.1`}
              renderOCRButton={
                <SingleOCRButton
                  equipmentType="Serbatoi"
                  equipmentIndex={index}
                  componentType="valvola_sicurezza"
                  onOCRComplete={(data) => handleValvolaOCRComplete(index, data)}
                />
              }
            />
          </Grid>

          {/* Manometro */}
          <Grid item xs={12}>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" gutterBottom>
              Manometro
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Controller
                  name={`serbatoi.${index}.manometro.fondo_scala`}
                  control={control}
                  rules={{
                    min: { value: 10, message: 'Min 10 bar' },
                    max: { value: 30, message: 'Max 30 bar' },
                  }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Fondo Scala (BAR)"
                      type="number"
                      fullWidth
                      size="small"
                      placeholder="Es: 16"
                      inputProps={{ min: 10, max: 30, step: 0.1 }}
                      onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : '')}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Controller
                  name={`serbatoi.${index}.manometro.segno_rosso`}
                  control={control}
                  rules={{
                    min: { value: 10, message: 'Min 10 bar' },
                    max: { value: 30, message: 'Max 30 bar' },
                  }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Segno Rosso (BAR)"
                      type="number"
                      fullWidth
                      size="small"
                      placeholder="Es: 13"
                      inputProps={{ min: 10, max: 30, step: 0.1 }}
                      onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : '')}
                    />
                  )}
                />
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      )}
    />
  )
}
