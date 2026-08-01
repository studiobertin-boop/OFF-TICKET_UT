import { useWatch, type Control } from 'react-hook-form'
import { MultiSelectCell } from './EquipmentCells'
import { elencaValvole } from '@/utils/valvoleImpianto'
import type { SchedaDatiCompleta } from '@/types/technicalSheet'

/**
 * Selettore «protetto dalle valvole» per le apparecchiature senza valvola propria
 * (scambiatore, recipiente filtro).
 *
 * Le opzioni non sono una lista statica: sono le valvole censite nella scheda in questo
 * momento, enumerate con la stessa convenzione che la relazione poi stampa
 * (`elencaValvole`). Le posizioni salvate che non corrispondono più ad alcuna valvola
 * (valvola rimossa dopo la selezione) restano selezionabili e marcate: `risolviValvole`
 * le scarta in generazione, ma qui devono restare visibili invece di sparire in silenzio.
 */
interface ValvoleProtezioneCellProps {
  control: Control<any>
  /** Path completo del campo, es. `scambiatori.0.valvole_protezione`. */
  name: string
}

const etichetta = (pos: string, marca?: string, modello?: string, ptar?: number): string => {
  const dettagli = [[marca, modello].filter(Boolean).join(' '), ptar != null ? `${ptar} bar` : '']
    .filter(Boolean)
    .join(' · ')
  return dettagli ? `${pos} — ${dettagli}` : pos
}

export const ValvoleProtezioneCell = ({ control, name }: ValvoleProtezioneCellProps) => {
  const [serbatoi, compressori, disoleatori, selezionate] = useWatch({
    control,
    name: ['serbatoi', 'compressori', 'disoleatori', name],
  })

  const valvole = elencaValvole({ serbatoi, compressori, disoleatori } as SchedaDatiCompleta)
  const options = valvole.map((v) => ({
    value: v.pos,
    label: etichetta(v.pos, v.valvola?.marca, v.valvola?.modello, v.valvola?.pressione_taratura),
  }))

  const orfane = (Array.isArray(selezionate) ? selezionate : []).filter(
    (pos: string) => !valvole.some((v) => v.pos === pos)
  )
  orfane.forEach((pos: string) => options.push({ value: pos, label: `${pos} — valvola non più censita` }))

  return <MultiSelectCell control={control} name={name} options={options} />
}
