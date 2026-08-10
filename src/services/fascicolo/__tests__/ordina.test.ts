import { describe, test, expect } from 'vitest'
import { ordinaFascicolo } from '../ordina'
import type { ContestoFascicolo, RuoloDocumento } from '../types'

/** Documento ridotto all'osso: l'ordinamento guarda solo ruoli e valvola. */
const doc = (id: string, ruoli: RuoloDocumento[], valvola?: string) => ({ id, ruoli, valvola })

const codici = (r: { sequenza: { id: string }[] }) => r.sequenza.map((d) => d.id)

/** Disoleatore con una valvola, dentro un compressore: il caso dell'esempio. */
const CONTESTO_DISOLEATORE: ContestoFascicolo = {
  apparecchiatura: { codice: 'C1.1', tipo: 'disoleatore', marca: 'ALUP', modello: 'D50' },
  valvole: [{ codice: 'C1.2', tipo: 'valvola', marca: 'BESA', pressione: 11 }],
  principale: { codice: 'C1', tipo: 'compressore', marca: 'ALUP', modello: 'SCK 25' },
}

/** Serbatoio: una valvola, nessuna apparecchiatura che lo contiene. */
const CONTESTO_SERBATOIO: ContestoFascicolo = {
  apparecchiatura: { codice: 'S1', tipo: 'serbatoio', marca: 'FIAC', modello: '500' },
  valvole: [{ codice: 'S1.1', tipo: 'valvola', marca: 'BESA', pressione: 11 }],
  principale: null,
}

describe('ordinaFascicolo', () => {
  test('dispone i documenti nell’ordine prescritto, qualunque sia quello di caricamento', () => {
    const risultato = ordinaFascicolo(
      [
        doc('fotoPrinc', ['FOTO_TARGHETTA_PRINCIPALE']),
        doc('istrValv', ['ISTR_VALVOLA']),
        doc('certApp', ['CERT_APPARECCHIATURA']),
        doc('certPrinc', ['CERT_PRINCIPALE']),
        doc('foto', ['FOTO_TARGHETTA']),
        doc('istrApp', ['ISTR_APPARECCHIATURA']),
        doc('certValv', ['CERT_VALVOLA']),
      ],
      CONTESTO_DISOLEATORE
    )

    expect(codici(risultato)).toEqual([
      'certApp', 'istrApp', 'certValv', 'istrValv', 'foto', 'certPrinc', 'fotoPrinc',
    ])
  })

  test('salta i ruoli mancanti senza lasciare posti vuoti, e li elenca', () => {
    const risultato = ordinaFascicolo(
      [doc('foto', ['FOTO_TARGHETTA']), doc('certApp', ['CERT_APPARECCHIATURA'])],
      CONTESTO_SERBATOIO
    )

    expect(codici(risultato)).toEqual(['certApp', 'foto'])
    expect(risultato.mancanti).toEqual(['ISTR_APPARECCHIATURA', 'CERT_VALVOLA', 'ISTR_VALVOLA'])
  })

  test('non chiede i documenti dell’apparecchiatura principale quando non ce n’è una', () => {
    const risultato = ordinaFascicolo([doc('certApp', ['CERT_APPARECCHIATURA'])], CONTESTO_SERBATOIO)

    expect(risultato.mancanti).not.toContain('CERT_PRINCIPALE')
    expect(risultato.mancanti).not.toContain('FOTO_TARGHETTA_PRINCIPALE')
  })

  test('un file che contiene certificato e istruzioni entra una volta sola, al primo dei suoi posti', () => {
    const risultato = ordinaFascicolo(
      [doc('foto', ['FOTO_TARGHETTA']), doc('misto', ['CERT_APPARECCHIATURA', 'ISTR_APPARECCHIATURA'])],
      CONTESTO_SERBATOIO
    )

    expect(codici(risultato)).toEqual(['misto', 'foto'])
    // Copre due ruoli: nessuno dei due va segnalato come mancante.
    expect(risultato.mancanti).toEqual(['CERT_VALVOLA', 'ISTR_VALVOLA'])
  })

  test('con più valvole tiene insieme certificato e istruzioni di ciascuna, in ordine di codice', () => {
    const contesto: ContestoFascicolo = {
      ...CONTESTO_SERBATOIO,
      valvole: [
        { codice: 'S1.1', tipo: 'valvola', marca: 'BESA', pressione: 11 },
        { codice: 'S1.2', tipo: 'valvola', marca: 'BESA', pressione: 12 },
      ],
    }

    const risultato = ordinaFascicolo(
      [
        doc('istr2', ['ISTR_VALVOLA'], 'S1.2'),
        doc('cert2', ['CERT_VALVOLA'], 'S1.2'),
        doc('istr1', ['ISTR_VALVOLA'], 'S1.1'),
        doc('cert1', ['CERT_VALVOLA'], 'S1.1'),
        doc('certApp', ['CERT_APPARECCHIATURA']),
      ],
      contesto
    )

    expect(codici(risultato)).toEqual(['certApp', 'cert1', 'istr1', 'cert2', 'istr2'])
  })

  test('senza indicazione della valvola i documenti si distribuiscono nell’ordine di caricamento', () => {
    const contesto: ContestoFascicolo = {
      ...CONTESTO_SERBATOIO,
      valvole: [
        { codice: 'S1.1', tipo: 'valvola' },
        { codice: 'S1.2', tipo: 'valvola' },
      ],
    }

    const risultato = ordinaFascicolo(
      [doc('certA', ['CERT_VALVOLA']), doc('certB', ['CERT_VALVOLA']), doc('istrA', ['ISTR_VALVOLA'])],
      contesto
    )

    expect(codici(risultato)).toEqual(['certA', 'istrA', 'certB'])
  })

  test('tiene fuori i file non riconosciuti e li restituisce a parte', () => {
    const risultato = ordinaFascicolo(
      [doc('ignoto', []), doc('certApp', ['CERT_APPARECCHIATURA'])],
      CONTESTO_SERBATOIO
    )

    expect(codici(risultato)).toEqual(['certApp'])
    expect(risultato.esclusi.map((d) => d.id)).toEqual(['ignoto'])
  })

  test('conserva i documenti di ruoli che la scheda non prevede, in coda al loro posto', () => {
    // La scheda dice che il serbatoio non sta dentro nulla, ma il tecnico ha caricato lo stesso
    // il certificato di un'apparecchiatura principale: si mette dove gli compete, non si perde.
    const risultato = ordinaFascicolo(
      [doc('certPrinc', ['CERT_PRINCIPALE']), doc('certApp', ['CERT_APPARECCHIATURA'])],
      CONTESTO_SERBATOIO
    )

    expect(codici(risultato)).toEqual(['certApp', 'certPrinc'])
  })

  test('più documenti per lo stesso ruolo restano entrambi, nell’ordine di caricamento', () => {
    const risultato = ordinaFascicolo(
      [doc('foto2', ['FOTO_TARGHETTA']), doc('foto1', ['FOTO_TARGHETTA'])],
      CONTESTO_SERBATOIO
    )

    expect(codici(risultato)).toEqual(['foto2', 'foto1'])
  })

  test('senza documenti non produce sequenza e dichiara mancante tutto il previsto', () => {
    const risultato = ordinaFascicolo([], CONTESTO_DISOLEATORE)

    expect(risultato.sequenza).toEqual([])
    expect(risultato.mancanti).toEqual([
      'CERT_APPARECCHIATURA', 'ISTR_APPARECCHIATURA', 'CERT_VALVOLA', 'ISTR_VALVOLA',
      'FOTO_TARGHETTA', 'CERT_PRINCIPALE', 'FOTO_TARGHETTA_PRINCIPALE',
    ])
  })
})
