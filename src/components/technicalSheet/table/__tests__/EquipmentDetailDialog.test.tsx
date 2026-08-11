import { useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useForm, useFieldArray, FormProvider, Controller, type Control } from 'react-hook-form'
import { EquipmentDetailDialog, type DettaglioRiga } from '../EquipmentDetailDialog'
import { EQUIPMENT_DEFS, nuovaRiga } from '../equipmentConfig'

/**
 * La finestra dei dettagli scorre le apparecchiature senza chiudersi.
 *
 * Restando montata, i suoi campi si ri-registrano su un percorso nuovo mentre React Hook
 * Form continua a servire il valore letto al montaggio: l'apparecchiatura successiva
 * compariva compilata con i dati della precedente — e alla prima modifica quei dati ci
 * finivano davvero — e i contatori restavano quelli della riga da cui si era partiti.
 *
 * La tabella dietro la finestra è parte del caso: tiene registrati i campi di *tutte* le
 * righe, e senza di lei la registrazione della riga di arrivo emette da sé l'evento che
 * riallinea l'osservazione, nascondendo il difetto.
 */

vi.mock('@/services/supabase', () => ({
  supabase: {},
  SUPABASE_URL: '',
  ensureValidSession: async () => true,
}))

vi.mock('@/services/api/equipmentCatalog', () => ({
  equipmentCatalogApi: {
    getMarcheByTipo: async () => [],
    getModelliByTipoMarca: async () => [],
    getEquipmentByTipoMarcaModello: async () => null,
    findVariants: async () => [],
    getVarianti: async () => [],
  },
}))

vi.mock('@/hooks/useVariantiModello', () => ({
  useVariantiModello: () => ({ righe: [], loading: false }),
  valoriACatalogo: () => [],
}))

vi.mock('@/hooks/useTecnicoDM329Visibility', () => ({
  useTecnicoDM329Visibility: () => ({ isTecnicoDM329: false, adv: true }),
}))

const serbatoio = (codice: string, marca: string, extra: Record<string, any> = {}) =>
  ({ ...nuovaRiga(EQUIPMENT_DEFS.serbatoio, codice), marca, ...extra })

const VOCI: DettaglioRiga[] = [0, 1].map((i) => ({
  def: EQUIPMENT_DEFS.serbatoio,
  base: `serbatoi.${i}`,
  code: `S${i + 1}`,
  color: '#000',
  onSelected: () => {},
  onExit: () => {},
  onDelete: null,
  append: null,
}))

/** Una cella della tabella dietro: serve solo a tenere il campo registrato nel form. */
const CampoTabella = ({ control, name }: { control: Control<any>; name: string }) => (
  <Controller
    name={name}
    control={control}
    render={({ field }) => <input {...field} value={field.value ?? ''} />}
  />
)

const Scheda = () => {
  const form = useForm({
    defaultValues: {
      serbatoi: [
        // Tre campi condizionali in più: posizione e fluido «altro», matricola INAIL.
        serbatoio('S1', 'ABAC', { ubicazione: 'ALTRO', fluido: 'ALTRO', gia_denunciato: true }),
        serbatoio('S2', 'DONALDSON'),
      ],
    },
  })
  const serbatoi = useFieldArray({ control: form.control, name: 'serbatoi' })
  const [aperta, setAperta] = useState(0)

  return (
    <FormProvider {...form}>
      {serbatoi.fields.map((f, i) => (
        <CampoTabella key={f.id} control={form.control} name={`serbatoi.${i}.marca`} />
      ))}
      <EquipmentDetailDialog
        control={form.control}
        dettaglio={VOCI[aperta]}
        adv
        posizione={{ indice: aperta + 1, totale: VOCI.length }}
        onNaviga={(delta) => setAperta((n) => (n + delta + VOCI.length) % VOCI.length)}
        onClose={() => {}}
      />
    </FormProvider>
  )
}

const marcaInFinestra = () => screen.getByLabelText('Marca') as HTMLInputElement
const successiva = () => screen.getByLabelText('Apparecchiatura successiva')

describe('EquipmentDetailDialog — navigazione fra apparecchiature', () => {
  it('mostra i valori dell’apparecchiatura su cui si è arrivati, non di quella lasciata', () => {
    render(<Scheda />)
    expect(marcaInFinestra().value).toBe('ABAC')

    fireEvent.click(successiva())

    expect(marcaInFinestra().value).toBe('DONALDSON')
  })

  it('conta i campi previsti dall’apparecchiatura su cui si è arrivati', () => {
    render(<Scheda />)
    // 17 campi comuni + posizione «altro», fluido «altro» e matricola INAIL.
    expect(screen.getByText(/20 campi previsti/)).toBeTruthy()

    fireEvent.click(successiva())

    expect(screen.getByText(/17 campi previsti/)).toBeTruthy()
  })
})
