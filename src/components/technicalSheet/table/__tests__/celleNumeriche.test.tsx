import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useForm, FormProvider } from 'react-hook-form'
import { NumberCell } from '../EquipmentCells'

/**
 * Svuotare un campo numerico deve lasciarlo vuoto.
 *
 * React Hook Form ripesca il valore di partenza quando il campo vale `undefined`: il suo
 * `get(valori, percorso, default)` tratta `undefined` come «manca», e il default è la
 * fotografia scattata alla registrazione del campo. Cancellando le cifre una a una le
 * ultime tornavano quindi da sole, e per cambiare un valore bisognava digitare quello
 * nuovo *prima* di togliere il vecchio.
 */
const Scheda = ({ anno }: { anno: number | null }) => {
  const form = useForm({ defaultValues: { compressori: [{ anno }] } })
  return (
    <FormProvider {...form}>
      <NumberCell control={form.control} name="compressori.0.anno" />
    </FormProvider>
  )
}

describe('NumberCell', () => {
  it('resta vuota quando si cancellano tutte le cifre', () => {
    render(<Scheda anno={2015} />)
    const campo = screen.getByRole('spinbutton') as HTMLInputElement
    expect(campo.value).toBe('2015')

    fireEvent.change(campo, { target: { value: '' } })

    expect(campo.value).toBe('')
  })

  it('accetta un valore nuovo dopo essere stata svuotata', () => {
    render(<Scheda anno={2015} />)
    const campo = screen.getByRole('spinbutton') as HTMLInputElement

    fireEvent.change(campo, { target: { value: '' } })
    fireEvent.change(campo, { target: { value: '2018' } })

    expect(campo.value).toBe('2018')
  })
})
