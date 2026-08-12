import { describe, it, expect, vi } from 'vitest'

const fromMock = vi.fn()

vi.mock('../../supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
  },
}))

import { fascicoloDocumentiApi } from '../fascicoloDocumenti'

describe('fascicoloDocumentiApi.codiciConFascicolo', () => {
  it('restituisce i soli codici con un fascicolo composto (tipo=fascicolo)', async () => {
    fromMock.mockReturnValue({
      select: () => ({
        eq: () => ({
          eq: async () => ({
            data: [{ codice: 'S1' }, { codice: 'C2.1' }],
            error: null,
          }),
        }),
      }),
    })

    const codici = await fascicoloDocumentiApi.codiciConFascicolo('r1')
    expect(codici).toEqual(new Set(['S1', 'C2.1']))
  })
})
