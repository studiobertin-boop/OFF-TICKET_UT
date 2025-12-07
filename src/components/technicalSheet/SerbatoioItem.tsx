import { useEffect } from 'react'
import { Control, Controller, useFormContext, useWatch } from 'react-hook-form'
import { Grid, TextField, FormControlLabel, Checkbox, Typography, Divider, Select, MenuItem, FormControl, InputLabel } from '@mui/material'
import { CommonEquipmentFields } from './CommonEquipmentFields'
import { ValvolaSicurezzaFields } from './ValvolaSicurezzaFields'
import { SingleOCRButton } from './SingleOCRButton'
import { type FinituraInternaOption, type ScaricoOption, type CategoriaPED } from '@/types'
import type { OCRExtractedData } from '@/types/ocr'
import { useTecnicoDM329Visibility } from '@/hooks/useTecnicoDM329Visibility'
import { calculateCategoriaPED } from '@/utils/categoriaPedCalculator'

const FINITURA_INTERNA_OPTIONS: FinituraInternaOption[] = ['VERNICIATO', 'ZINCATO', 'VITROFLEX', 'ALTRO']
const SCARICO_OPTIONS: ScaricoOption[] = ['AUTOMATICO', 'MANUALE', 'ASSENTE']
const CATEGORIA_PED_OPTIONS: CategoriaPED[] = ['I', 'II', 'III', 'IV']

interface SerbatoioItemProps {
    index: number
    control: Control<any>
    errors: any
    onValvolaOCRComplete: (index: number, data: OCRExtractedData) => void
}

export const SerbatoioItem = ({
    index,
    control,
    errors,
    onValvolaOCRComplete
}: SerbatoioItemProps) => {
    const { showAdvancedFields } = useTecnicoDM329Visibility()
    const { setValue } = useFormContext()

    // Watch PS e Volume per calcolo automatico Categoria PED
    const psValue = useWatch({ control, name: `serbatoi.${index}.ps_pressione_max` })
    const volumeValue = useWatch({ control, name: `serbatoi.${index}.volume` })

    // Calcolo automatico e update
    useEffect(() => {
        // Solo se mostriamo i campi avanzati (dove c'è il campo categoria_ped)
        if (showAdvancedFields) {
            const calculatedCategoria = calculateCategoriaPED(psValue, volumeValue)
            if (calculatedCategoria) {
                setValue(`serbatoi.${index}.categoria_ped`, calculatedCategoria, { shouldValidate: true })
            }
        }
    }, [psValue, volumeValue, index, setValue, showAdvancedFields])

    return (
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

            {/* Categoria PED - NUOVO - NASCOSTO a tecnicoDM329 - Calcolo automatico da PS × Volume */}
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
                                {/* Visualizza info calcolata se disponibile */}
                                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                                    {field.value ? `Selezionata: ${field.value}` : 'Autocalcolata da PS x V'}
                                </Typography>
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
                    bgColor="rgba(173, 216, 230, 0.35)"
                    renderOCRButton={
                        <SingleOCRButton
                            equipmentType="Serbatoi"
                            equipmentIndex={index}
                            componentType="valvola_sicurezza"
                            onOCRComplete={(data) => onValvolaOCRComplete(index, data)}
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
    )
}
