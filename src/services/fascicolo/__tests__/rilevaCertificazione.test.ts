import { describe, test, expect, vi } from 'vitest'

vi.mock('@/services/api/fascicoloDocumenti', () => ({ fascicoloDocumentiApi: {} }))

import { esitoDaDirettive } from '../rilevaCertificazione'

describe('esitoDaDirettive', () => {
  test('direttiva riconosciuta: regime e fonte nel messaggio', () => {
    const e = esitoDaDirettive(['2014/29/UE'], 'cert.pdf')
    expect(e.regime).toBe('RSP')
    expect(e.messaggio).toContain('RSP')
    expect(e.messaggio).toContain('2014/29/UE')
  })

  test('direttive dei due regimi: si chiede di scegliere a mano, dicendo cosa si è letto', () => {
    const e = esitoDaDirettive(['2014/29/UE', '2014/68/UE'], 'cert.pdf')
    expect(e.regime).toBeNull()
    expect(e.messaggio).toContain('2014/68/UE')
    expect(e.messaggio).toContain('a mano')
  })

  test('nessuna direttiva citata', () => {
    const e = esitoDaDirettive([], 'cert.pdf')
    expect(e.regime).toBeNull()
    expect(e.messaggio).toContain('non cita direttive')
  })

  test('lettura non riuscita', () => {
    const e = esitoDaDirettive(null, 'cert.pdf')
    expect(e.regime).toBeNull()
    expect(e.messaggio).toContain('Non è stato possibile')
  })
})
