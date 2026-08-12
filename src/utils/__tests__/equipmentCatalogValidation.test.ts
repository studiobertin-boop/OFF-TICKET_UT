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
        // Il messaggio vale per tutti i tipi — ognuno chiama la propria pressione in modo
        // diverso (PS, Ptar, Pressione massima) — quindi non deve citare l'etichetta di
        // nessun campo specifico, solo indirizzare verso i dati tecnici.
        const messaggio = esito.error.errors[0].message
        expect(messaggio).toContain('dati tecnici')
        expect(messaggio).not.toMatch(/«.*»/)
      }
    }
  })

  it('non inciampa nei dati tecnici mai compilati', () => {
    // Il form registra una chiave per ogni campo mostrato, anche se resta vuoto,
    // e i campi che spariscono al cambio di tipo costruttivo lasciano la loro:
    // un dato non osservato non è un dato sbagliato e non deve bloccare il salvataggio.
    expect(
      validateEquipmentInput({
        ...valida,
        specs: {
          fad: 255,
          pressione_esercizio: 10,
          pressione_max: 11,
          tipo_compressore: 'PISTONI',
          giri: undefined,
          ts: null,
          diametro: '',
        },
      })
    ).toEqual([])
  })

  it('scarta le chiavi vuote invece di scriverle a catalogo', () => {
    const esito = createEquipmentSchema.safeParse({
      ...valida,
      specs: { fad: 255, pressione_max: 11, giri: undefined, ts: null, diametro: '' },
    })
    expect(esito.success).toBe(true)
    if (esito.success) {
      expect(esito.data.specs).toEqual({ fad: 255, pressione_max: 11 })
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
    expect(specsSchemaFor('Separatori').safeParse({}).success).toBe(true)
  })

  it('per i filtri PS e TS sono opzionali', () => {
    expect(specsSchemaFor('Filtri').safeParse({}).success).toBe(true)
    expect(specsSchemaFor('Filtri').safeParse({ ps: 11, ts: '-10 ÷ +50' }).success).toBe(true)
  })

  it('un TS memorizzato a catalogo come numero non blocca il salvataggio', () => {
    // In produzione molte righe «Filtri» hanno il TS salvato come numero JSON invece che
    // come stringa: se il campo non viene toccato in fase di modifica, il form lo
    // ripropone così com'è e lo schema deve accettarlo, coercendolo a stringa.
    const esito = specsSchemaFor('Filtri').safeParse({ ts: 66 })
    expect(esito.success).toBe(true)
    const r = specsSchemaFor('Filtri').parse({ ts: 66 })
    expect(r.ts).toBe('66')
  })

  it('lo schema valida ciò che è memorizzato, definizioni interne comprese', () => {
    // Protegge da un `.filter(d => !d.isInternal)` aggiunto qui per uniformare questa funzione a
    // `specsFieldsFor`: se sparisse, `pressione_esercizio` — la chiave dell'indice unico dei
    // compressori — verrebbe scartata a ogni salvataggio dal form del catalogo, e le varianti
    // dello stesso modello collasserebbero l'una nell'altra.
    const r = specsSchemaFor('Compressori').parse({ pressione_esercizio: 7.5, pressione_max: 8, fad: 2000 })
    expect(r.pressione_esercizio).toBe(7.5)
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

describe('specsFieldsFor — definizioni interne', () => {
  it('non propone la pressione di esercizio fra i campi dei compressori', () => {
    const chiavi = specsFieldsFor('Compressori', {}).map(d => d.key)
    expect(chiavi).not.toContain('pressione_esercizio')
    expect(chiavi).toContain('pressione_max')
    expect(chiavi).toContain('fad')
  })

  it('non toglie nulla ai tipi che non hanno definizioni interne', () => {
    expect(specsFieldsFor('Serbatoi', {}).map(d => d.key)).toEqual([
      'volume', 'ps', 'ts', 'categoria_ped',
    ])
  })

  it('continua a nascondere i giri sui compressori che non sono a vite', () => {
    const chiavi = specsFieldsFor('Compressori', { tipo_compressore: 'SCROLL' }).map(d => d.key)
    expect(chiavi).not.toContain('giri')
  })
})
