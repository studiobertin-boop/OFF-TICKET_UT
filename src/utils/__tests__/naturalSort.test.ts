import { describe, it, expect } from 'vitest'
import { naturalSortComparator } from '../naturalSort'

describe('naturalSortComparator', () => {
  it('ordina i numeri principali numericamente, non lessicograficamente', () => {
    const codici = ['S10', 'S2', 'S1']
    expect([...codici].sort(naturalSortComparator)).toEqual(['S1', 'S2', 'S10'])
  })

  it('ordina i sotto-numeri dopo il numero principale', () => {
    const codici = ['E1.2', 'E1', 'E1.1']
    expect([...codici].sort(naturalSortComparator)).toEqual(['E1', 'E1.1', 'E1.2'])
  })

  it('ordina prima per lettera, poi per numero', () => {
    const codici = ['S1', 'E1', 'C1']
    expect([...codici].sort(naturalSortComparator)).toEqual(['C1', 'E1', 'S1'])
  })

  it('ripiega su localeCompare per codici che non seguono il pattern', () => {
    expect(naturalSortComparator('foo', 'bar')).toBeGreaterThan(0)
  })
})
