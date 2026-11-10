import { describe, it, expect } from 'vitest'
import { cambioTipoTratto } from '../tipoTratto'
import type { SchemaArcoStile, SchemaSegnoTubo } from '@/services/schemaImpianto/types'

const segno = (id: string, t: number, stileAValle?: SchemaArcoStile): SchemaSegnoTubo => ({
  id,
  tipo: 'valvola_intercettazione',
  t,
  ...(stileAValle ? { stileAValle } : {}),
})

describe('cambioTipoTratto', () => {
  it('verso il capo di arrivo scrive sul segno stesso', () => {
    const esito = cambioTipoTratto('flessibile', [segno('V1', 0.5)], 0, 'a', 'standard')
    expect(esito.stileArco).toBe('flessibile')
    expect(esito.segni[0].stileAValle).toBe('standard')
  })

  it('verso il capo di partenza, senza nessun segno prima, scrive sullo stile dell’arco', () => {
    const esito = cambioTipoTratto('flessibile', [segno('V1', 0.5)], 0, 'da', 'standard')
    expect(esito.stileArco).toBe('standard')
    // Il tratto «dopo» resta com'era: la valvola lo fissa (vedi il test dedicato più sotto).
    expect(esito.segni[0].stileAValle).toBe('flessibile')
  })

  // Il difetto segnalato il 10-11-2026: mandata rigida con una valvola, «flessibile» verso il
  // compressore — e diventava flessibile tutto il tubo, anche fra valvola e serbatoio.
  it('cambiare il tratto prima di una valvola non cambia quello dopo', () => {
    const esito = cambioTipoTratto('standard', [segno('V1', 0.3)], 0, 'da', 'flessibile')
    expect(esito.stileArco).toBe('flessibile')
    expect(esito.segni[0].stileAValle).toBe('standard')
  })

  it('e viceversa: cambiare il tratto dopo non cambia quello prima', () => {
    const esito = cambioTipoTratto('standard', [segno('V1', 0.3)], 0, 'a', 'flessibile')
    expect(esito.stileArco).toBe('standard')
    expect(esito.segni[0].stileAValle).toBe('flessibile')
  })

  it('con un segno dichiarato prima, il tratto dopo la valvola scelta resta quello di quel segno', () => {
    const segni = [segno('V1', 0.2, 'flessibile'), segno('V2', 0.6)]
    const esito = cambioTipoTratto('standard', segni, 1, 'da', 'condensa')
    expect(esito.segni.find((s) => s.id === 'V1')!.stileAValle).toBe('condensa')
    expect(esito.segni.find((s) => s.id === 'V2')!.stileAValle).toBe('flessibile')
    expect(esito.stileArco).toBe('standard')
  })

  it('verso il capo di partenza scrive sul segno che precede LUNGO IL TUBO', () => {
    // L'ordine dell'array è l'inverso dell'ordine sul tubo: chi guarda l'indice invece della
    // posizione scrive sul segno sbagliato, e il cambio compare dall'altra parte del disegno.
    const segni = [segno('V2', 0.8, 'condensa'), segno('V1', 0.2, 'flessibile')]
    const esito = cambioTipoTratto('standard', segni, 0, 'da', 'standard')
    expect(esito.segni.find((s) => s.id === 'V1')!.stileAValle).toBe('standard')
    expect(esito.segni.find((s) => s.id === 'V2')!.stileAValle).toBe('condensa')
    expect(esito.stileArco).toBe('standard')
  })

  it('salta i segni che non dichiarano un tipo quando cerca il precedente', () => {
    // Una freccia, o una valvola posata e basta, non è un confine: il tratto «prima» comincia più
    // indietro, o dal capo dell'arco.
    const segni = [segno('V0', 0.1), segno('V1', 0.5)]
    const esito = cambioTipoTratto('flessibile', segni, 1, 'da', 'standard')
    expect(esito.stileArco).toBe('standard')
    expect(esito.segni.find((s) => s.id === 'V0')!.stileAValle).toBeUndefined()
    // Il segno scelto invece diventa un confine: a valle resta il tipo di prima.
    expect(esito.segni.find((s) => s.id === 'V1')!.stileAValle).toBe('flessibile')
  })

  it('non tocca gli altri campi del segno', () => {
    const esito = cambioTipoTratto('standard', [segno('V1', 0.42)], 0, 'a', 'flessibile')
    expect(esito.segni[0]).toMatchObject({ id: 'V1', tipo: 'valvola_intercettazione', t: 0.42 })
  })

  it('un indice che non esiste lascia tutto com’era', () => {
    const segni = [segno('V1', 0.5)]
    const esito = cambioTipoTratto('standard', segni, 7, 'a', 'flessibile')
    expect(esito).toEqual({ stileArco: 'standard', segni })
  })
})
