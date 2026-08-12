import { describe, test, expect } from 'vitest'
import type { SchedaDatiCompleta, ValvolaSicurezza } from '@/types/technicalSheet'
import { raggruppaApparecchiatureInstallatore } from '../raggruppa'

const valvola: ValvolaSicurezza = {}

/** Scheda minima: solo i campi che servono al test, il resto vuoto. */
const scheda = (parziale: Partial<SchedaDatiCompleta>): SchedaDatiCompleta => ({
  stato: 'completa',
  dati_generali: { data_sopralluogo: '', nome_tecnico: '', cliente: '' },
  dati_impianto: { sede_imp_uguale_legale: true, sede_impianto: '', indirizzo_impianto: '', raccolta_condense: 'Nessuna' },
  serbatoi: [],
  compressori: [],
  disoleatori: [],
  essiccatori: [],
  scambiatori: [],
  filtri: [],
  recipienti_filtro: [],
  separatori: [],
  ...parziale,
})

describe('raggruppaApparecchiatureInstallatore', () => {
  test('un disoleatore soggetto viene abbinato al suo compressore', () => {
    const righe = raggruppaApparecchiatureInstallatore(
      scheda({
        compressori: [{ codice: 'C1', marca: 'KAESER', modello: 'CSD 102 SFC', n_fabbrica: '100259.0/1397' }],
        disoleatori: [
          {
            codice: 'C1.1',
            compressore_associato: 'C1',
            marca: 'AIR COM',
            modello: '25GK1',
            n_fabbrica: '13052',
            volume: 65,
            ps_pressione_max: 11,
            valvola_sicurezza: valvola,
          },
        ],
      })
    )

    expect(righe).toHaveLength(1)
    expect(righe[0].principale).toEqual({ tipo: 'Compressore', marca: 'KAESER', modello: 'CSD 102 SFC', n_fabbrica: '100259.0/1397' })
    expect(righe[0].dipendente).toEqual({ tipo: 'Serbatoio disoleatore', marca: 'AIR COM', modello: '25GK1', n_fabbrica: '13052' })
  })

  test('un serbatoio standalone soggetto compare senza principale', () => {
    const righe = raggruppaApparecchiatureInstallatore(
      scheda({
        serbatoi: [
          {
            codice: 'S1',
            marca: 'SICC TECH',
            modello: '3000-20011R2',
            n_fabbrica: '20.03321.013',
            volume: 3000,
            ps_pressione_max: 12,
            valvola_sicurezza: valvola,
          },
        ],
      })
    )

    expect(righe).toHaveLength(1)
    expect(righe[0].principale).toBeNull()
    expect(righe[0].dipendente).toMatchObject({ marca: 'SICC TECH', modello: '3000-20011R2', n_fabbrica: '20.03321.013' })
  })

  test('scambiatore soggetto abbinato al suo essiccatore, recipiente filtro al suo filtro', () => {
    const righe = raggruppaApparecchiatureInstallatore(
      scheda({
        essiccatori: [{ codice: 'E1', marca: 'FRIULAIR', modello: 'FCT300/AC', n_fabbrica: 'FCT300CQ1P080/200029513' }],
        scambiatori: [
          {
            codice: 'E1.1',
            essiccatore_associato: 'E1',
            marca: 'RAAL',
            modello: 'RACF 21394-0',
            n_fabbrica: '0533-33-19',
            volume: 58,
            ps_pressione_max: 11,
          },
        ],
        filtri: [{ codice: 'F1', marca: 'X', modello: 'Y', n_fabbrica: 'Z' }],
        recipienti_filtro: [
          {
            codice: 'F1.1',
            filtro_associato: 'F1',
            marca: 'RF-MARCA',
            modello: 'RF-MOD',
            n_fabbrica: 'RF-NF',
            volume: 55,
            ps_pressione_max: 11,
          },
        ],
      })
    )

    expect(righe).toHaveLength(2)
    const scambiatoreRiga = righe.find((r) => r.dipendente.n_fabbrica === '0533-33-19')!
    expect(scambiatoreRiga.principale).toEqual({ tipo: 'Essiccatore frigorifero', marca: 'FRIULAIR', modello: 'FCT300/AC', n_fabbrica: 'FCT300CQ1P080/200029513' })
    expect(scambiatoreRiga.dipendente.tipo).toBe('Scambiatore di calore')

    const recipienteRiga = righe.find((r) => r.dipendente.n_fabbrica === 'RF-NF')!
    expect(recipienteRiga.principale).toEqual({ tipo: 'Filtro', marca: 'X', modello: 'Y', n_fabbrica: 'Z' })
    expect(recipienteRiga.dipendente.tipo).toBe('Recipiente filtro')
  })

  test('esclude le apparecchiature sotto soglia DM329', () => {
    const righe = raggruppaApparecchiatureInstallatore(
      scheda({
        compressori: [{ codice: 'C1', marca: 'KAESER', modello: 'X', n_fabbrica: '1' }],
        disoleatori: [
          {
            codice: 'C1.1',
            compressore_associato: 'C1',
            marca: 'X',
            volume: 10, // < 25L → ESCLUSO_VOLUME
            ps_pressione_max: 11,
            valvola_sicurezza: valvola,
          },
        ],
        serbatoi: [
          {
            codice: 'S1',
            marca: 'X',
            volume: 30, // 25≤V<50, PS<12 → SOTTO_SOGLIA
            ps_pressione_max: 10,
            valvola_sicurezza: valvola,
          },
        ],
      })
    )

    expect(righe).toHaveLength(0)
  })

  test('un dipendente soggetto senza principale trovato compare comunque, con principale null', () => {
    const righe = raggruppaApparecchiatureInstallatore(
      scheda({
        disoleatori: [
          {
            codice: 'C1.1',
            compressore_associato: 'C99', // nessun compressore con questo codice
            marca: 'X',
            volume: 65,
            ps_pressione_max: 11,
            valvola_sicurezza: valvola,
          },
        ],
      })
    )

    expect(righe).toHaveLength(1)
    expect(righe[0].principale).toBeNull()
  })

  test('ordina le righe secondo l’ordinamento naturale del codice del dipendente', () => {
    const righe = raggruppaApparecchiatureInstallatore(
      scheda({
        serbatoi: [
          { codice: 'S2', marca: 'X', volume: 60, ps_pressione_max: 11, valvola_sicurezza: valvola },
          { codice: 'S10', marca: 'X', volume: 60, ps_pressione_max: 11, valvola_sicurezza: valvola },
          { codice: 'S1', marca: 'X', volume: 60, ps_pressione_max: 11, valvola_sicurezza: valvola },
        ],
      })
    )

    expect(righe.map((r) => r.codiceOrdinamento)).toEqual(['S1', 'S2', 'S10'])
  })
})
