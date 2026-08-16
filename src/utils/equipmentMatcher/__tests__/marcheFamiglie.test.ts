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

  // 'FIAC AIR' non è la ragione sociale esatta di nessun membro della famiglia FIAC
  // ('FIAC' e 'FIAC AIR COMPRESSORS S.p.A.'): risolve solo se il ramo per contenimento
  // funziona. Verificato commentando quel ramo: il test diventa rosso (vedi report).
  test('una marca che non è ragione sociale esatta di nessun membro risolve solo per contenimento', () => {
    const famiglia = risolviFamiglia('FIAC AIR')
    expect(famiglia).not.toBeNull()
    expect(famiglia).toContain('FIAC')
    expect(famiglia).toContain('FIAC AIR COMPRESSORS S.p.A.')
  })

  // Guardia sul confine di parola: 'SICCOMPRESSORI' e 'FIACOMPRESSORI' condividono i
  // primi caratteri con 'SICC'/'FIAC' ma non sono la stessa parola. Se lo `startsWith`
  // del ramo per contenimento perdesse lo spazio di confine (`${n} `), questi due
  // agganciassero silenziosamente la famiglia sbagliata — verificato empiricamente.
  test('un prefisso letterale senza confine di parola non aggancia la famiglia', () => {
    expect(risolviFamiglia('SICCOMPRESSORI')).toBeNull()
    expect(risolviFamiglia('FIACOMPRESSORI')).toBeNull()
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
