import { describe, test, expect } from 'vitest'
import { buildSpessimetriche } from '../engine/spessimetriche'
import { buildEsiti } from '../engine/esiti'
import { makeScheda, makeAdditionalInfo } from './fixtures'

describe('buildSpessimetriche', () => {
  test('senza apparecchiature marcate il capoverso non esiste', () => {
    const scheda = makeScheda()
    const info = makeAdditionalInfo({ spessimetrica: [] })

    const model = buildSpessimetriche(buildEsiti(scheda, info), info)

    expect(model.presenti).toBe(false)
    expect(model.clausola).toBe('')
  })

  test('con una sola apparecchiatura la clausola resta al singolare', () => {
    const scheda = makeScheda()
    const info = makeAdditionalInfo({ spessimetrica: ['S1'] })

    const model = buildSpessimetriche(buildEsiti(scheda, info), info)

    expect(model.presenti).toBe(true)
    expect(model.clausola).toBe('l’apparecchiatura S1 è stata sottoposta')
  })

  test('con più apparecchiature la clausola passa al plurale', () => {
    const scheda = makeScheda()
    const info = makeAdditionalInfo({ spessimetrica: ['S1', 'C1.1'] })

    const model = buildSpessimetriche(buildEsiti(scheda, info), info)

    // Ordine di §5.2 e non di selezione: il disoleatore precede il serbatoio.
    expect(model.clausola).toBe('le apparecchiature C1.1 e S1 sono state sottoposte')
  })

  test('ignora le posizioni che in §5.2 non compaiono', () => {
    const scheda = makeScheda()
    // 'S9' non esiste in scheda: non ha spunta in §5.2, e nominarla qui renderebbe
    // falso il rimando alla tabella.
    const info = makeAdditionalInfo({ spessimetrica: ['S9'] })

    const model = buildSpessimetriche(buildEsiti(scheda, info), info)

    expect(model.presenti).toBe(false)
    expect(model.clausola).toBe('')
  })
})
