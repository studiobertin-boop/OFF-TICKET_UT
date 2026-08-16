import { describe, test, expect } from 'vitest'
import { FAMIGLIE_MARCHE, risolviFamiglia } from '../marcheFamiglie'
import { MARCHE_A_CATALOGO } from './fixtures'

describe('risolviFamiglia', () => {
  test('una ragione sociale completa risolve la sua famiglia', () => {
    expect(risolviFamiglia('SICC TECH s.r.l.')).toContain('SICC S.p.A.')
    expect(risolviFamiglia('SICC TECH s.r.l.')).toContain('SICC TECH s.r.l.')
  })

  test('una marca parziale risolve comunque la famiglia', () => {
    const famiglia = risolviFamiglia('SICC')
    expect(famiglia).not.toBeNull()
    expect(famiglia).toHaveLength(4)
  })

  test('collega ragioni sociali senza alcuna somiglianza testuale', () => {
    expect(risolviFamiglia('CECCATO ARIA COMPRESSA S.R.L.')).toContain('A.ARIA C S.r.l. (ABAC)')
    expect(risolviFamiglia('A.ARIA C')).toContain('CECCATO ARIA COMPRESSA S.R.L.')
  })

  test('una marca fuori mappa non risolve nulla', () => {
    expect(risolviFamiglia('KAESER KOMPRESSOREN SE')).toBeNull()
    expect(risolviFamiglia('')).toBeNull()
  })
})

describe('coerenza della mappa col catalogo', () => {
  test('ogni marca elencata esiste davvero a catalogo', () => {
    const mancanti = FAMIGLIE_MARCHE
      .flatMap((f) => f.marche)
      .filter((m) => !MARCHE_A_CATALOGO.includes(m))
    expect(mancanti).toEqual([])
  })

  test('nessuna marca appartiene a due famiglie', () => {
    const tutte = FAMIGLIE_MARCHE.flatMap((f) => f.marche)
    expect(tutte).toHaveLength(new Set(tutte).size)
  })
})
