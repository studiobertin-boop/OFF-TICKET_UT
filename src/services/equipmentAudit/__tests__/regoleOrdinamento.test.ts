import { describe, expect, it } from 'vitest'
import { fadMonotono } from '../rules/fadMonotono'
import { qmaxMonotono } from '../rules/qmaxMonotono'
import { serieMonotona } from '../rules/serieMonotona'
import {
  AIRCENTER_12,
  CSD_125,
  CSDX_165,
  FRIULAIR_AMD,
  GA_18_COERENTE,
  KAESER_ASK,
  OPTIONS_TUTTO,
  input,
  row,
  VALVOLE_COERENTI,
  VALVOLE_INCOERENTI,
} from './fixtures'

/**
 * Le tre regole di ordinamento sono il cuore della verifica richiesta.
 * I casi qui sotto vengono tutti dal catalogo di produzione.
 */

describe('compressori: la portata non può crescere con la pressione', () => {
  it('rileva lo zero mancante di CSDX 165', () => {
    const f = fadMonotono(input(CSDX_165()))
    expect(f).toHaveLength(1)
    expect(f[0].rule).toBe('FAD_NON_MONOTONO')
    expect(f[0].severity).toBe('alta')
    expect(f[0].heuristic).toBe(false)
    expect(f[0].detail).toContain('1353')
    expect(f[0].detail).toContain('11490')
  })

  it('segnala lo scarto di ordine di grandezza senza correggerlo da solo', () => {
    // Riscalare di dieci ripristinerebbe l'ordine in due modi opposti: la scelta
    // richiede la documentazione del costruttore, non un'euristica.
    for (const caso of [CSDX_165(), CSD_125()]) {
      const fix = fadMonotono(input(caso))[0].fix
      expect(fix.kind).toBe('manual')
      if (fix.kind === 'manual') expect(fix.hint).toContain('manca una cifra')
    }
  })

  it('sugli scarti contenuti non ipotizza un errore di cifra', () => {
    const fix = fadMonotono(input(AIRCENTER_12()))[0].fix
    expect(fix.kind).toBe('manual')
    if (fix.kind === 'manual') expect(fix.hint).not.toContain('manca una cifra')
  })

  it('tace su una serie coerente', () => {
    expect(fadMonotono(input(GA_18_COERENTE()))).toEqual([])
  })

  it('raccoglie tutte le varianti in una segnalazione sola', () => {
    const f = fadMonotono(input(CSDX_165()))
    expect(f[0].entities).toHaveLength(2)
  })

  it('ignora i gruppi con una sola pressione o senza portata', () => {
    const unaSola = [row('Compressori', 'KAESER', 'SK 26', { volume: '2200', pressione: '11' })]
    expect(fadMonotono(input(unaSola))).toEqual([])

    const senzaPortata = [
      row('Compressori', 'KAESER', 'SM 9 (@10bar)', { pressione: '10' }),
      row('Compressori', 'KAESER', 'SM 9 (@7,5bar)', { pressione: '7.5' }),
    ]
    expect(fadMonotono(input(senzaPortata))).toEqual([])
  })
})

describe('valvole: lo scarico non può calare al crescere della taratura', () => {
  it('non trova nulla sul catalogo reale, che su questo è coerente', () => {
    expect(qmaxMonotono(input(VALVOLE_COERENTI()))).toEqual([])
  })

  it('rileva una violazione', () => {
    const f = qmaxMonotono(input(VALVOLE_INCOERENTI()))
    expect(f).toHaveLength(1)
    expect(f[0].rule).toBe('QMAX_NON_MONOTONO')
    expect(f[0].detail).toContain('9000')
    expect(f[0].detail).toContain('6000')
  })

  it('non propone mai correzioni automatiche', () => {
    expect(qmaxMonotono(input(VALVOLE_INCOERENTI()))[0].fix.kind).toBe('manual')
  })
})

describe('serie di modelli (euristica)', () => {
  const conEuristiche = (catalog: ReturnType<typeof FRIULAIR_AMD>) =>
    serieMonotona(input(catalog, { options: OPTIONS_TUTTO }))

  it('tace su una serie progressiva', () => {
    expect(conEuristiche(FRIULAIR_AMD())).toEqual([])
  })

  it('segnala il caso KAESER ASK, che è un falso positivo noto', () => {
    const f = conEuristiche(KAESER_ASK())
    expect(f).toHaveLength(1)
    expect(f[0].detail).toContain('ASK 35')
  })

  it('nasce con gravità bassa e marcata euristica, perché va verificata', () => {
    const f = conEuristiche(KAESER_ASK())
    expect(f[0].severity).toBe('bassa')
    expect(f[0].heuristic).toBe(true)
    expect(f[0].fix.kind).toBe('manual')
  })

  it('non gira quando le euristiche sono disattivate', () => {
    expect(serieMonotona(input(KAESER_ASK()))).toEqual([])
  })

  it('serve almeno una terna: con due taglie non si parla di progressione', () => {
    const due = KAESER_ASK().slice(1)
    expect(serieMonotona(input(due, { options: OPTIONS_TUTTO }))).toEqual([])
  })

  it('archiviare la serie non deve dipendere dai valori, che cambiano', () => {
    const primo = conEuristiche(KAESER_ASK())[0]
    const modificato = KAESER_ASK()
    modificato[0].specs = { volume: '2100', pressione: '13' }
    const secondo = conEuristiche(modificato)[0]

    expect(secondo.key).toBe(primo.key)
    // Correggere una taglia della serie non deve far riemergere un falso
    // positivo già valutato e archiviato.
    expect(secondo.payloadHash).toBe(primo.payloadHash)
  })
})
