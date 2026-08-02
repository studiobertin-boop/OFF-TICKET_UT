import { describe, expect, it } from 'vitest'
import {
  createEquipmentSchema,
  normalizeMarca,
  normalizeModello,
  specsFieldsFor,
  specsSchemaFor,
  validateEquipmentInput,
} from '../equipmentCatalogValidation'

const valida = {
  tipo_apparecchiatura: 'Compressori' as const,
  marca: 'KAESER KOMPRESSOREN SE',
  modello: 'ASD 40',
}

describe('validazione di una voce di catalogo', () => {
  it('accetta una voce ben formata', () => {
    expect(createEquipmentSchema.safeParse(valida).success).toBe(true)
  })

  it('rifiuta il modello che porta la pressione nel nome', () => {
    // È la regola che impedisce di ricreare il disordine che il modulo sana:
    // finché la pressione sta nel nome, le varianti dello stesso modello
    // risultano apparecchiature diverse.
    for (const modello of ['ASD 40 (@13bar)', 'CSD 125 (max15bar)', 'SK 25 SFC (8,5-11bar)']) {
      const esito = createEquipmentSchema.safeParse({ ...valida, modello })
      expect(esito.success, modello).toBe(false)
      if (!esito.success) {
        expect(esito.error.errors[0].message).toContain('Pressione di esercizio')
      }
    }
  })

  it('pretende tipo, marca e modello', () => {
    expect(validateEquipmentInput({ marca: 'KAESER', modello: 'ASD 40' })).toEqual([
      'Tipo: Seleziona il tipo di apparecchiatura',
    ])
    expect(validateEquipmentInput({ ...valida, marca: 'K' })).toEqual([
      'Marca: La marca deve avere almeno 2 caratteri',
    ])
  })
})

describe('normalizzazione', () => {
  it('collassa spazi e ritagli, così due grafie non diventano due voci', () => {
    expect(normalizeMarca('  KAESER   KOMPRESSOREN SE ')).toBe('KAESER KOMPRESSOREN SE')
    expect(normalizeModello('ASD  40')).toBe('ASD 40')
  })
})

describe('schema dei dati tecnici generato dal tipo', () => {
  it('ammette i campi del tipo scelto', () => {
    const esito = specsSchemaFor('Compressori').safeParse({
      fad: 2580,
      pressione_max: 15,
      pressione_esercizio: 13,
    })
    expect(esito.success).toBe(true)
  })

  it('rifiuta valori fuori intervallo', () => {
    expect(specsSchemaFor('Serbatoi').safeParse({ ps: 500 }).success).toBe(false)
  })

  it('rifiuta un testo dove serve un numero', () => {
    expect(specsSchemaFor('Essiccatori').safeParse({ q: 'molta' }).success).toBe(false)
  })

  it('per il TS accetta gli intervalli, che a catalogo sono la norma', () => {
    expect(specsSchemaFor('Serbatoi').safeParse({ ts: '-10 ÷ +120' }).success).toBe(true)
  })

  it('vincola la categoria PED ai valori ammessi', () => {
    expect(specsSchemaFor('Serbatoi').safeParse({ categoria_ped: 'IV' }).success).toBe(true)
    expect(specsSchemaFor('Serbatoi').safeParse({ categoria_ped: 'V' }).success).toBe(false)
  })

  it('i tipi senza dati tecnici non impongono nulla', () => {
    expect(specsSchemaFor('Filtri').safeParse({}).success).toBe(true)
  })
})

describe('specsFieldsFor', () => {
  it('senza specs restituisce tutti i campi del tipo', () => {
    const chiavi = specsFieldsFor('Compressori').map(d => d.key)
    expect(chiavi).toContain('giri')
    expect(chiavi).toContain('fad')
  })

  it('la regolazione dei giri vale sui rotativi a vite', () => {
    expect(specsFieldsFor('Compressori', { tipo_compressore: 'VITE' }).map(d => d.key)).toContain('giri')
  })

  it('con tipo costruttivo non dichiarato il campo resta: a catalogo vale il default «a vite»', () => {
    expect(specsFieldsFor('Compressori', {}).map(d => d.key)).toContain('giri')
  })

  it('sugli altri tipi costruttivi il campo sparisce', () => {
    for (const t of ['PISTONI', 'SCROLL', 'CENTRIFUGO']) {
      expect(specsFieldsFor('Compressori', { tipo_compressore: t }).map(d => d.key)).not.toContain('giri')
    }
  })

  it('non tocca i campi degli altri tipi', () => {
    expect(specsFieldsFor('Serbatoi', {}).map(d => d.key)).toEqual(['volume', 'ps', 'ts', 'categoria_ped'])
  })
})
