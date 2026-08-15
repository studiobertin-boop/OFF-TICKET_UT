import { describe, expect, it } from 'vitest'
import { duplicati } from '../rules/duplicati'
import { pressioneNelNome } from '../rules/pressioneNelNome'
import { specsIntegrity } from '../rules/specsIntegrity'
import {
  CECCATO_COINCIDENTE,
  KAESER_ASD_40,
  PS_INCOERENTE,
  RIGA_SENZA_TIPO,
  SERBATOIO_CANONICO,
  SERBATOIO_LEGACY,
  VALVOLA_NON_NUMERICA,
  input,
  row,
} from './fixtures'

const rules = (catalog: Parameters<typeof input>[0]) => specsIntegrity(input(catalog))
const byRule = (catalog: Parameters<typeof input>[0], rule: string) =>
  rules(catalog).filter(f => f.rule === rule)

describe('tipo apparecchiatura mancante', () => {
  it('è critica: la riga esiste ma non compare nei menu della scheda', () => {
    const f = byRule([RIGA_SENZA_TIPO()], 'TIPO_MANCANTE')
    expect(f).toHaveLength(1)
    expect(f[0].severity).toBe('critica')
  })

  it('deduce il tipo dalla vecchia colonna al singolare', () => {
    const fix = byRule([RIGA_SENZA_TIPO()], 'TIPO_MANCANTE')[0].fix
    expect(fix).toEqual(expect.objectContaining({ kind: 'set_tipo', tipoApparecchiatura: 'Compressori' }))
  })

  it('propone di eliminare solo ciò che non è deducibile né usato', () => {
    const orfana = row(null, 'Ignota', 'XY-1', {}, { usageCount: 0 })
    expect(byRule([orfana], 'TIPO_MANCANTE')[0].fix.kind).toBe('delete_row')

    const orfanaUsata = row(null, 'Ignota', 'XY-2', {}, { usageCount: 3 })
    expect(byRule([orfanaUsata], 'TIPO_MANCANTE')[0].fix.kind).toBe('manual')
  })

  it('senza tipo non si pronuncia sui dati tecnici', () => {
    expect(rules([RIGA_SENZA_TIPO()]).map(f => f.rule)).toEqual(['TIPO_MANCANTE'])
  })
})

describe('formato dei dati tecnici', () => {
  it('segnala le chiavi generiche e propone la conversione completa', () => {
    const f = byRule([SERBATOIO_LEGACY()], 'SPECS_LEGACY')
    expect(f).toHaveLength(1)
    const fix = f[0].fix
    expect(fix.kind).toBe('set_specs')
    if (fix.kind === 'set_specs') {
      expect(fix.patch).toEqual({ volume: 500, ps: 11, ts: '-10 ÷ +120', categoria_ped: 'IV' })
      expect(fix.removeKeys?.sort()).toEqual(['pressione', 'temperatura'])
      // Il campo riscritto non deve comparire fra quelli da cancellare.
      expect(fix.removeKeys).not.toContain('volume')
    }
  })

  it('tace su una riga già canonica', () => {
    expect(byRule([SERBATOIO_CANONICO()], 'SPECS_LEGACY')).toEqual([])
  })

  it('segnala i valori non numerici senza proporre una correzione', () => {
    const f = byRule([VALVOLA_NON_NUMERICA()], 'SPECS_VALORE_NON_NUMERICO')
    expect(f).toHaveLength(1)
    expect(f[0].detail).toContain('>4854')
    expect(f[0].fix.kind).toBe('manual')
  })

  it('elenca i dati obbligatori mancanti', () => {
    const incompleto = row('Compressori', 'KAESER', 'SK 99', { pressione: '10' })
    const f = byRule([incompleto], 'SPECS_INCOMPLETI')
    expect(f).toHaveLength(1)
    expect(f[0].detail).toContain('FAD')
  })
})

describe('coerenza fra le due pressioni', () => {
  it('accetta la convenzione KAESER: esercizio nel nome, massima nei dati', () => {
    expect(byRule([KAESER_ASD_40()], 'PS_MINORE_ESERCIZIO')).toEqual([])
  })

  it('accetta anche il caso in cui coincidono', () => {
    expect(byRule([CECCATO_COINCIDENTE()], 'PS_MINORE_ESERCIZIO')).toEqual([])
  })

  it('segnala la pressione massima inferiore a quella di esercizio', () => {
    const f = byRule([PS_INCOERENTE()], 'PS_MINORE_ESERCIZIO')
    expect(f).toHaveLength(1)
    expect(f[0].severity).toBe('alta')
    // Mai convertita: nei dati questo scarto nasce sia da errori sia da
    // intervalli in cui è stato registrato l'estremo sbagliato.
    expect(f[0].fix.kind).toBe('manual')
  })
})

describe('pressione dentro il nome del modello', () => {
  it('propone di spostarla nei dati tecnici ripulendo il nome', () => {
    const f = pressioneNelNome(input([KAESER_ASD_40()]))
    expect(f).toHaveLength(1)
    const fix = f[0].fix
    expect(fix).toEqual(
      expect.objectContaining({
        kind: 'set_modello',
        modello: 'ASD 40',
        patch: { pressione_esercizio: 13 },
      })
    )
  })

  it('per un intervallo prende l’estremo superiore e lo dichiara', () => {
    const r = row('Compressori', 'KAESER', 'SK 25 SFC (8,5-11bar)', { volume: '2430', pressione: '11' })
    const f = pressioneNelNome(input([r]))
    expect(f[0].detail).toContain('intervallo 8.5–11 bar')
    const fix = f[0].fix
    if (fix.kind === 'set_modello') expect(fix.patch).toEqual({ pressione_esercizio: 11 })
  })

  it('non consolida un dato che si contraddice', () => {
    expect(pressioneNelNome(input([PS_INCOERENTE()]))[0].fix.kind).toBe('manual')
  })

  it('tace su un nome pulito', () => {
    expect(pressioneNelNome(input([SERBATOIO_CANONICO()]))).toEqual([])
  })

  it('tratta ogni variante separatamente', () => {
    const varianti = [
      row('Compressori', 'ATLAS', 'GA 18 (@8,5bar)', { volume: '3420', pressione: '8.5' }),
      row('Compressori', 'ATLAS', 'GA 18 (@10bar)', { volume: '2900', pressione: '10' }),
    ]
    const f = pressioneNelNome(input(varianti))
    expect(f).toHaveLength(2)
    // Chiavi distinte: altrimenti una delle due sparirebbe dal report.
    expect(new Set(f.map(x => x.key)).size).toBe(2)
  })
})

describe('duplicati', () => {
  it('riconosce come duplicata la riga con la pressione nel nome', () => {
    const coppia = [
      row('Compressori', 'CECCATO ARIA COMPRESSA S.R.L.', 'CSA 10', { volume: '1000', pressione: '10' }),
      row('Compressori', 'CECCATO ARIA COMPRESSA S.R.L.', 'CSA 10 (@10bar)', { volume: '1000', pressione: '10' }),
    ]
    const f = duplicati(input(coppia))
    expect(f).toHaveLength(1)
    // Nomi diversi: fondere scollegherebbe le schede che citano quello eliminato.
    expect(f[0].fix.kind).toBe('manual')
  })

  it('non considera duplicate due varianti di pressione legittime', () => {
    const varianti = [
      row('Compressori', 'KAESER KOMPRESSOREN SE', 'SK 26', { fad: 2200, pressione_max: 11 }),
      row('Compressori', 'KAESER KOMPRESSOREN SE', 'SK 26', { fad: 2550, pressione_max: 8 }),
    ]
    expect(duplicati(input(varianti))).toEqual([])
  })

  it('non considera duplicate due valvole che differiscono per diametro', () => {
    const varianti = [
      row('Valvole di sicurezza', 'PADOVAN VALERIO snc', 'TW3', { ptar: 11, diametro: '3/8"', qmax: 8415 }),
      row('Valvole di sicurezza', 'PADOVAN VALERIO snc', 'TW3', { ptar: 11, diametro: '3/4"', qmax: 16982 }),
    ]
    expect(duplicati(input(varianti))).toEqual([])
  })

  it('propone la fusione quando i nomi coincidono', () => {
    const coppia = [
      row('Serbatoi', 'SICC TECH s.r.l.', 'SC 500', { volume: '500' }, { usageCount: 2 }),
      row('Serbatoi', 'SICC TECH s.r.l.', 'SC 500', { pressione: '11' }, { usageCount: 0 }),
    ]
    const fix = duplicati(input(coppia))[0].fix
    expect(fix.kind).toBe('merge_rows')
    if (fix.kind === 'merge_rows') {
      // Si conserva la riga più usata, e i dati si sommano.
      expect(fix.keepId).toBe(coppia[0].id)
      expect(fix.mergedSpecs).toEqual({ volume: '500', pressione: '11' })
    }
  })

  it('ignora maiuscole e punteggiatura della marca', () => {
    const coppia = [
      row('Filtri', 'CECCATO ARIA COMPRESSA S.R.L.', 'FG 29'),
      row('Filtri', 'Ceccato Aria Compressa srl', 'FG 29'),
    ]
    expect(duplicati(input(coppia))).toHaveLength(1)
  })
})
