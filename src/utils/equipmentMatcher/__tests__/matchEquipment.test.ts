import { describe, test, expect } from 'vitest'
import { matchEquipment } from '../index'
import { SERBATOI_SICC, COMPRESSORI_CECCATO, FILTRI } from './fixtures'

describe('esito certo', () => {
  test('ragione sociale completa, modello esatto, volume e PS confermati', () => {
    const r = matchEquipment('serbatoio',
      { marca: 'SICC TECH s.r.l.', modello: '500-12783', volume: 500, pressione_max: 11 },
      SERBATOI_SICC)

    expect(r.esito).toBe('certo')
    if (r.esito !== 'certo') return
    expect(r.candidato.riga.marca).toBe('SICC TECH s.r.l.')
    // Le due righe TECH `500-12783` e `500 - 12783` sono la stessa cosa: si collassano,
    // e sopravvive quella più usata.
    expect(r.candidato.riga.id).toBe('sicc-tech-500')
  })
})

describe('esito ambiguo', () => {
  test('marca parziale: una ragione sociale per candidato', () => {
    const r = matchEquipment('serbatoio',
      { marca: 'SICC', modello: '500-12783', volume: 500, pressione_max: 11 },
      SERBATOI_SICC)

    expect(r.esito).toBe('ambiguo')
    if (r.esito !== 'ambiguo') return
    expect(r.motivo).toBe('piu_candidati')
    expect(r.candidati.map((c) => c.riga.marca).sort())
      .toEqual(['SICC S.p.A.', 'SICC S.r.L.', 'SICC TECH s.r.l.'])
  })

  test('PS divergente su candidato unico', () => {
    const r = matchEquipment('serbatoio',
      { marca: 'SICC TECH s.r.l.', modello: '500-12783', volume: 500, pressione_max: 11.5 },
      SERBATOI_SICC)

    expect(r.esito).toBe('ambiguo')
    if (r.esito !== 'ambiguo') return
    expect(r.motivo).toBe('divergenza_specs')
    expect(r.candidati[0].confronti.find((c) => c.campo === 'ps')?.esito).toBe('diverge')
  })

  test('modello somigliante ma non identico non basta per la certezza', () => {
    const r = matchEquipment('serbatoio',
      { marca: 'SICC TECH', modello: '725/1278', volume: 725, pressione_max: 10.8 },
      SERBATOI_SICC)

    expect(r.esito).toBe('ambiguo')
    if (r.esito !== 'ambiguo') return
    expect(r.motivo).toBe('somiglianza_incerta')
  })

  // Correzione 2 (ruling del controller): il caso originale del brief («SICC TECH s.r.l.»
  // con modello `725/12783`) non esercita il ripiego, perché sotto quella stessa ragione
  // sociale esiste già `725 - 12783`, che normalizza identico e dà somiglianza 1 — il motivo
  // che ne esce è `divergenza_specs` (PS 10,8 letta contro 11 a catalogo), non
  // `ragione_sociale_altra`. Qui invece la marca letta è `SICC TECH` (senza «s.r.l.»), che a
  // fixture è una ragione sociale distinta e porta solo `725/12783`: la somiglianza fra
  // `500 12783` (letto) e `725 12783` (quell'unica riga) è 0,5, sotto la soglia d'ingresso di
  // 0,60, quindi la restrizione stretta resta vuota e scatta il ripiego alla famiglia.
  test('la targhetta dà una ragione sociale, il modello sta solo sotto un\'altra', () => {
    const r = matchEquipment('serbatoio',
      { marca: 'SICC TECH', modello: '500-12783', volume: 500, pressione_max: 11 },
      SERBATOI_SICC)

    expect(r.esito).toBe('ambiguo')
    if (r.esito !== 'ambiguo') return
    expect(r.motivo).toBe('ragione_sociale_altra')
  })

  test('famiglia senza somiglianza testuale: entrambe le ragioni sociali CECCATO', () => {
    const r = matchEquipment('compressore',
      { marca: 'A.ARIA C', modello: 'FONOCOMPACT PRO 270 F6S', pressione_max: 11 },
      COMPRESSORI_CECCATO)

    expect(r.esito).toBe('ambiguo')
    if (r.esito !== 'ambiguo') return
    expect(r.candidati.map((c) => c.riga.marca).sort())
      .toEqual(['A.ARIA C S.r.l. (ABAC)', 'CECCATO ARIA COMPRESSA S.R.L.'])
  })

  test('tipo senza discriminanti tecnici non raggiunge mai la certezza', () => {
    const r = matchEquipment('filtro',
      { marca: 'AIR COM S.r.l.', modello: 'AC 0035' },
      FILTRI)

    expect(r.esito).toBe('ambiguo')
    if (r.esito !== 'ambiguo') return
    expect(r.candidati).toHaveLength(1)
  })

  test('solo il modello leggibile: si cerca su tutto il tipo', () => {
    const r = matchEquipment('serbatoio',
      { modello: '500 - 12783', volume: 500, pressione_max: 11 },
      SERBATOI_SICC)

    expect(r.esito).toBe('ambiguo')
    if (r.esito !== 'ambiguo') return
    expect(r.candidati.length).toBeGreaterThanOrEqual(3)
  })
})

describe('esito nessuno', () => {
  test('marca e modello fuori catalogo', () => {
    const r = matchEquipment('serbatoio',
      { marca: 'KAESER KOMPRESSOREN SE', modello: 'XYZ-999', volume: 500 },
      SERBATOI_SICC)
    expect(r.esito).toBe('nessuno')
  })

  test('modello vuoto', () => {
    const r = matchEquipment('serbatoio', { marca: 'SICC S.p.A.' }, SERBATOI_SICC)
    expect(r.esito).toBe('nessuno')
  })

  test('catalogo vuoto', () => {
    const r = matchEquipment('serbatoio', { marca: 'SICC', modello: '500-12783' }, [])
    expect(r.esito).toBe('nessuno')
  })
})

describe('ordinamento e limite dei candidati', () => {
  test('al massimo cinque candidati, i più somiglianti per primi', () => {
    const r = matchEquipment('serbatoio', { modello: '12783' }, SERBATOI_SICC)
    if (r.esito !== 'ambiguo') return
    expect(r.candidati.length).toBeLessThanOrEqual(5)
    const sim = r.candidati.map((c) => c.simModello)
    expect([...sim].sort((a, b) => b - a)).toEqual(sim)
  })
})
