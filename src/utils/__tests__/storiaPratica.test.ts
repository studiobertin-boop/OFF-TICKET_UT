import { describe, it, expect } from 'vitest'
import { puoLeggereStoriaPratica } from '../storiaPratica'

describe('puoLeggereStoriaPratica', () => {
  it('ammette i ruoli che hanno una policy di SELECT su request_history', () => {
    expect(puoLeggereStoriaPratica('admin')).toBe(true)
    expect(puoLeggereStoriaPratica('tecnico')).toBe(true)
    expect(puoLeggereStoriaPratica('utente')).toBe(true)
    expect(puoLeggereStoriaPratica('userdm329')).toBe(true)
  })

  it('esclude tecnicoDM329, che quella policy non ce l’ha', () => {
    expect(puoLeggereStoriaPratica('tecnicoDM329')).toBe(false)
  })

  it('esclude un ruolo sconosciuto invece di dargli fiducia', () => {
    // È il punto dell'elenco di ammessi: un ruolo introdotto domani senza la sua policy
    // deve cadere fuori da solo. In un elenco di esclusi passerebbe, e la sezione del
    // fascicolo mostrerebbe una data di cancellazione calcolata su una storia mai letta.
    expect(puoLeggereStoriaPratica('supervisoreDM329' as never)).toBe(false)
  })

  it('esclude l’utente non ancora caricato', () => {
    expect(puoLeggereStoriaPratica(null)).toBe(false)
    expect(puoLeggereStoriaPratica(undefined)).toBe(false)
  })
})
