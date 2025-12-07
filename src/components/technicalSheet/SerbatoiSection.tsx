import { Control, useFieldArray, useFormContext } from 'react-hook-form'
import { EquipmentSection } from './EquipmentSection'
import { SingleOCRButton } from './SingleOCRButton'
import { EQUIPMENT_LIMITS, generateEquipmentCode } from '@/types'
import type { OCRExtractedData } from '@/types/ocr'
import { SerbatoioItem } from './SerbatoioItem'

interface SerbatoiSectionProps {
  control: Control<any>
  errors: any
}

export const SerbatoiSection = ({ control, errors }: SerbatoiSectionProps) => {
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
        <SerbatoioItem
          index={index}
          control={control}
          errors={errors}
          onValvolaOCRComplete={handleValvolaOCRComplete}
        />
      )}
    />
  )
}
