import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { useCampoExit } from '../useCampoExit'

/**
 * La domanda sul valore scostato dal catalogo deve arrivare appena si è finito di scrivere
 * quel valore. Prima arrivava solo lasciando la riga: passando dalla PS alla capacità della
 * stessa apparecchiatura restava muta fino a tre celle dopo.
 */

const Riga = ({ onExit }: { onExit: () => void }) => {
  const campoExit = useCampoExit(onExit, 'td')
  return (
    <table>
      <tbody>
        <tr {...campoExit}>
          <td>
            <input aria-label="ps" />
          </td>
          <td>
            <input aria-label="marca" />
            <input aria-label="modello" />
          </td>
        </tr>
      </tbody>
    </table>
  )
}

const campo = (nome: string) => screen.getByLabelText(nome) as HTMLInputElement

/**
 * Un giro di macrotask: jsdom non valorizza `relatedTarget` sul `focusout`, quindi la
 * verifica passa sempre dal ramo differito — lo stesso che in un browser copre i click
 * su aree non focusabili e la chiusura con ESC.
 */
const cedi = () => act(async () => { await new Promise((r) => setTimeout(r, 0)) })

describe('useCampoExit', () => {
  it('segnala l’uscita passando a un’altra cella della stessa riga', async () => {
    const onExit = vi.fn()
    render(<Riga onExit={onExit} />)

    act(() => campo('ps').focus())
    act(() => campo('marca').focus())
    await cedi()

    expect(onExit).toHaveBeenCalledTimes(1)
  })

  it('non segnala nulla fra due controlli della stessa cella', async () => {
    const onExit = vi.fn()
    render(<Riga onExit={onExit} />)

    act(() => campo('marca').focus())
    act(() => campo('modello').focus())
    await cedi()

    expect(onExit).not.toHaveBeenCalled()
  })
})
