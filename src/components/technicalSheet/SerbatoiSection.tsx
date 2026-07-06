import { type Control, useFormContext } from 'react-hook-form'
import { SerbatoiTable } from './table/SerbatoiTable'
import type { OCRExtractedData } from '@/types/ocr'

interface SerbatoiSectionProps {
  control: Control<any>
  errors: any
}

/**
 * Sezione Serbatoi della SCHEDA DATI DM329 — modalità "foglio di calcolo".
 * Il rendering è delegato a SerbatoiTable; qui restano gli handler OCR
 * (serbatoio e valvola) che scrivono nel form, invariati rispetto a prima.
 */
export const SerbatoiSection = ({ control, errors }: SerbatoiSectionProps) => {
  const { setValue, trigger } = useFormContext()

  const handleOCRComplete = (index: number, data: OCRExtractedData) => {
    const base = `serbatoi.${index}`
    if (data.marca) setValue(`${base}.marca`, data.marca)
    if (data.modello) setValue(`${base}.modello`, data.modello)
    if (data.n_fabbrica) setValue(`${base}.n_fabbrica`, data.n_fabbrica)
    if (data.anno) setValue(`${base}.anno`, data.anno)
    if (data.volume) setValue(`${base}.volume`, data.volume)
    if (data.pressione_max) setValue(`${base}.pressione_max`, data.pressione_max)

    if (data.valvola_sicurezza) {
      const v = data.valvola_sicurezza
      if (v.marca) setValue(`${base}.valvola_sicurezza.marca`, v.marca)
      if (v.modello) setValue(`${base}.valvola_sicurezza.modello`, v.modello)
      if (v.n_fabbrica) setValue(`${base}.valvola_sicurezza.n_fabbrica`, v.n_fabbrica)
      if (v.diametro_pressione) setValue(`${base}.valvola_sicurezza.diametro_pressione`, v.diametro_pressione)
    }

    if (data.manometro) {
      if (data.manometro.fondo_scala) setValue(`${base}.manometro.fondo_scala`, data.manometro.fondo_scala)
      if (data.manometro.segno_rosso) setValue(`${base}.manometro.segno_rosso`, data.manometro.segno_rosso)
    }

    trigger(base)
  }

  const handleValvolaOCRComplete = (index: number, data: OCRExtractedData) => {
    const base = `serbatoi.${index}.valvola_sicurezza`
    if (data.marca) setValue(`${base}.marca`, data.marca)
    if (data.modello) setValue(`${base}.modello`, data.modello)
    if (data.n_fabbrica) setValue(`${base}.n_fabbrica`, data.n_fabbrica)
    if (data.diametro_pressione) setValue(`${base}.diametro_pressione`, data.diametro_pressione)
    trigger(base)
  }

  return (
    <SerbatoiTable
      control={control}
      errors={errors}
      onSerbatoioOCR={handleOCRComplete}
      onValvolaOCR={handleValvolaOCRComplete}
    />
  )
}
