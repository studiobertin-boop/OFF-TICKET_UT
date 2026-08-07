import { describe, it, expect } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { useForm, useFieldArray, FormProvider, useFormContext, Controller } from 'react-hook-form'
import { EQUIPMENT_DEFS, nuovaRiga } from '../equipmentConfig'

describe('nuovaRiga', () => {
  it('dichiara ogni campo della riga, compresi gli extra e le valvole del recipiente', () => {
    const compressore = nuovaRiga(EQUIPMENT_DEFS.compressore, 'C1')
    expect(compressore).toMatchObject({
      codice: 'C1', marca: null, modello: null, anno: null, n_fabbrica: null,
      volume_aria_prodotto: null, pressione_max: null,
      tipo: null, giri: null, silenziato: false, note: null,
    })

    const serbatoio = nuovaRiga(EQUIPMENT_DEFS.serbatoio, 'S1')
    expect(serbatoio.manometro).toEqual({ fondo_scala: null, segno_rosso: null })
    expect(serbatoio.valvola_sicurezza).toMatchObject({ marca: null, pressione_taratura: null })
    expect(serbatoio.valvole_aggiuntive).toEqual([])
  })

  it('non lascia campi a undefined: sarebbero ripescati dai default del form', () => {
    const riga = nuovaRiga(EQUIPMENT_DEFS.serbatoio, 'S1')
    const indefiniti = Object.entries(riga).filter(([, v]) => v === undefined)
    expect(indefiniti).toEqual([])
  })
})

const CampoTipo = ({ i }: { i: number }) => {
  const { control } = useFormContext()
  return (
    <Controller
      name={`compressori.${i}.tipo`}
      control={control}
      render={({ field }) => <input data-testid={`tipo-${i}`} {...field} value={field.value ?? ''} />}
    />
  )
}

let api: any

const Harness = () => {
  const form = useForm({ defaultValues: { compressori: [{ codice: 'C1', tipo: 'PISTONI' }] } })
  const fa = useFieldArray({ control: form.control, name: 'compressori' })
  api = { fa, form }
  return (
    <FormProvider {...form}>
      {fa.fields.map((f, i) => <CampoTipo key={f.id} i={i} />)}
    </FormProvider>
  )
}

describe('creazione dopo eliminazione', () => {
  it('la riga nuova non eredita i dati di quella eliminata', async () => {
    render(<Harness />)
    expect((screen.getByTestId('tipo-0') as HTMLInputElement).value).toBe('PISTONI')

    await act(async () => { api.fa.remove(0) })
    await act(async () => { api.fa.append(nuovaRiga(EQUIPMENT_DEFS.compressore, 'C1')) })

    expect(api.form.getValues('compressori.0.tipo')).toBeNull()
    expect((screen.getByTestId('tipo-0') as HTMLInputElement).value).toBe('')
  })
})
