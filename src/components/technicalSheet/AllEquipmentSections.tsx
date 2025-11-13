/**
 * Componente che racchiude tutte le sezioni apparecchiature
 * Per ottimizzare il numero di file e semplificare l'import
 */

import { Control, Controller, useFieldArray, useFormContext } from 'react-hook-form'
import { Grid, FormControlLabel, Checkbox, TextField } from '@mui/material'
import { EquipmentSection } from './EquipmentSection'
import { CommonEquipmentFields } from './CommonEquipmentFields'
import { ValvolaSicurezzaFields } from './ValvolaSicurezzaFields'
import { SingleOCRButton } from './SingleOCRButton'
import { EQUIPMENT_LIMITS, generateEquipmentCode } from '@/types'
import type { OCRExtractedData } from '@/types/ocr'

// ============================================================================
// COMPRESSORI (C1-C5)
// ============================================================================

interface CompressoriSectionProps {
  control: Control<any>
  errors: any
}

export const CompressoriSection = ({ control, errors }: CompressoriSectionProps) => {
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'compressori',
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
      renderItem={(_item, index) => (
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
          <Grid item xs={12}>
            <Controller
              name={`compressori.${index}.ha_disoleatore`}
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={field.value || false}
                      onChange={(e) => field.onChange(e.target.checked)}
                    />
                  }
                  label="Ha Disoleatore Associato"
                />
              )}
            />
          </Grid>
        </Grid>
      )}
    />
  )
}

// ============================================================================
// DISOLEATORI (C1.1-C5.1) - DIPENDENTI DA COMPRESSORI
// ============================================================================

interface DisoleatoriSectionProps {
  control: Control<any>
  errors: any
  compressori: any[]
}

export const DisoleatoriSection = ({ control, errors, compressori }: DisoleatoriSectionProps) => {
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'disoleatori',
  })

  const handleAdd = () => {
    // Trova compressori senza disoleatore
    const compressoriSenzaDisoleatore = compressori.filter((_c, idx) => {
      const compressoreCodice = generateEquipmentCode(EQUIPMENT_LIMITS.compressori.prefix, idx + 1)
      return !fields.some((d: any) => d.compressore_associato === compressoreCodice)
    })

    if (compressoriSenzaDisoleatore.length === 0) {
      alert('Tutti i compressori hanno già un disoleatore associato')
      return
    }

    const compressoreIndex = compressori.indexOf(compressoriSenzaDisoleatore[0])
    const compressoreCodice = generateEquipmentCode(EQUIPMENT_LIMITS.compressori.prefix, compressoreIndex + 1)

    append({
      codice: generateEquipmentCode(EQUIPMENT_LIMITS.compressori.prefix, compressoreIndex + 1, '.1'),
      compressore_associato: compressoreCodice,
      valvola_sicurezza: {},
    })
  }

  const canRemove = () => ({ can: true }) // Dipendenti opzionali

  return (
    <EquipmentSection
      title="5. Disoleatori"
      subtitle="Da 0 a 5 disoleatori (C1.1-C5.1). Dipendenti da compressori."
      items={fields}
      maxItems={EQUIPMENT_LIMITS.disoleatori.max}
      minItems={EQUIPMENT_LIMITS.disoleatori.min}
      onAdd={handleAdd}
      onRemove={remove}
      generateCode={(index) => (fields[index] as any)?.codice || ''}
      canRemove={canRemove}
      itemTypeName="disoleatore"
      renderItem={(item, index) => (
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              value={(item as any).compressore_associato || ''}
              label="Compressore Associato"
              fullWidth
              disabled
              size="small"
            />
          </Grid>
          <Grid item xs={12}>
            <CommonEquipmentFields
              control={control}
              basePath={`disoleatori.${index}`}
              errors={errors}
              equipmentType="Disoleatori"
              fields={{
                marca: true,
                modello: true,
                n_fabbrica: true,
                volume: true,
                pressione_max: true,
                note: true,
              }}
            />
          </Grid>
          <Grid item xs={12}>
            <ValvolaSicurezzaFields
              control={control}
              basePath={`disoleatori.${index}`}
              errors={errors}
              codiceValvola={(item as any).codice?.replace('.1', '.2') || ''}
            />
          </Grid>
        </Grid>
      )}
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
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'essiccatori',
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
      renderItem={(_item, index) => (
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
                pressione_max: true,
              }}
            />
          </Grid>
          <Grid item xs={12}>
            <Controller
              name={`essiccatori.${index}.ha_scambiatore`}
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={field.value || false}
                      onChange={(e) => field.onChange(e.target.checked)}
                    />
                  }
                  label="Ha Scambiatore Associato"
                />
              )}
            />
          </Grid>
        </Grid>
      )}
    />
  )
}

// ============================================================================
// SCAMBIATORI (E1.1-E4.1) - DIPENDENTI DA ESSICCATORI
// ============================================================================

interface ScambiatoriSectionProps {
  control: Control<any>
  errors: any
  essiccatori: any[]
}

export const ScambiatoriSection = ({ control, errors, essiccatori }: ScambiatoriSectionProps) => {
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'scambiatori',
  })

  const handleAdd = () => {
    const essiccatoriSenzaScambiatore = essiccatori.filter((_e, idx) => {
      const essiccatoreCodice = generateEquipmentCode(EQUIPMENT_LIMITS.essiccatori.prefix, idx + 1)
      return !fields.some((s: any) => s.essiccatore_associato === essiccatoreCodice)
    })

    if (essiccatoriSenzaScambiatore.length === 0) {
      alert('Tutti gli essiccatori hanno già uno scambiatore associato')
      return
    }

    const essiccatoreIndex = essiccatori.indexOf(essiccatoriSenzaScambiatore[0])
    const essiccatoreCodice = generateEquipmentCode(EQUIPMENT_LIMITS.essiccatori.prefix, essiccatoreIndex + 1)

    append({
      codice: generateEquipmentCode(EQUIPMENT_LIMITS.essiccatori.prefix, essiccatoreIndex + 1, '.1'),
      essiccatore_associato: essiccatoreCodice,
    })
  }

  return (
    <EquipmentSection
      title="7. Scambiatori"
      subtitle="Da 0 a 4 scambiatori (E1.1-E4.1). Dipendenti da essiccatori."
      items={fields}
      maxItems={EQUIPMENT_LIMITS.scambiatori.max}
      minItems={EQUIPMENT_LIMITS.scambiatori.min}
      onAdd={handleAdd}
      onRemove={remove}
      generateCode={(index) => (fields[index] as any)?.codice || ''}
      canRemove={() => ({ can: true })}
      itemTypeName="scambiatore"
      renderItem={(item, index) => (
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              value={(item as any).essiccatore_associato || ''}
              label="Essiccatore Associato"
              fullWidth
              disabled
              size="small"
            />
          </Grid>
          <Grid item xs={12}>
            <CommonEquipmentFields
              control={control}
              basePath={`scambiatori.${index}`}
              errors={errors}
              equipmentType="Scambiatori"
              fields={{
                marca: true,
                modello: true,
                n_fabbrica: true,
                anno: true,
                pressione_max: true,
                volume: true,
              }}
            />
          </Grid>
        </Grid>
      )}
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
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'filtri',
  })

  const { setValue, trigger } = useFormContext()

  const handleAdd = () => {
    append({
      codice: generateEquipmentCode(EQUIPMENT_LIMITS.filtri.prefix, fields.length + 1),
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
      renderItem={(_item, index) => (
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
      )}
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
