import { describe, expect, it } from 'vitest'
import { flattenSheetEquipment } from '../flattenSheets'
import { applyDismissals, runAudit } from '../runAudit'
import type { DismissalRecord } from '../types'
import {
  CSDX_165,
  EQUIPMENT_DATA_ESEMPIO,
  KAESER_ASK,
  OPTIONS_BASE,
  OPTIONS_TUTTO,
  RIGA_SENZA_TIPO,
  SERBATOIO_LEGACY,
  row,
} from './fixtures'

const catalogoMisto = () => [RIGA_SENZA_TIPO(), SERBATOIO_LEGACY(), ...CSDX_165(), ...KAESER_ASK()]

const esegui = (options = OPTIONS_BASE, dismissals: DismissalRecord[] = []) =>
  runAudit({ catalog: catalogoMisto(), sheets: [], dismissals, options })

describe('runAudit', () => {
  it('ordina per gravità decrescente', () => {
    const ordine = esegui().findings.map(f => f.severity)
    const rango = { critica: 0, alta: 1, media: 2, bassa: 3 }
    for (let i = 1; i < ordine.length; i++) {
      expect(rango[ordine[i]]).toBeGreaterThanOrEqual(rango[ordine[i - 1]])
    }
  })

  it('conta le segnalazioni per gravità', () => {
    const r = esegui()
    const somma = Object.values(r.counts).reduce((a, b) => a + b, 0)
    expect(somma).toBe(r.findings.length)
    expect(r.counts.critica).toBe(1) // la riga senza tipo
  })

  it('riporta le dimensioni di ciò che ha esaminato', () => {
    const r = esegui()
    expect(r.stats.catalogRows).toBe(catalogoMisto().length)
    expect(r.stats.sheetRows).toBe(0)
  })

  it('esclude le euristiche quando non richieste', () => {
    expect(esegui(OPTIONS_BASE).findings.some(f => f.heuristic)).toBe(false)
    expect(esegui(OPTIONS_TUTTO).findings.some(f => f.heuristic)).toBe(true)
  })

  it('esamina le schede dati solo se richiesto', () => {
    const sheets = flattenSheetEquipment([
      { id: 's1', requestId: 'r1', codicePratica: 'PR-1', equipmentData: EQUIPMENT_DATA_ESEMPIO },
    ])
    const senza = runAudit({ catalog: [], sheets, dismissals: [], options: OPTIONS_BASE })
    const con = runAudit({ catalog: [], sheets, dismissals: [], options: OPTIONS_TUTTO })

    expect(senza.findings.filter(f => f.scope === 'scheda')).toEqual([])
    expect(con.findings.filter(f => f.scope === 'scheda').length).toBeGreaterThan(0)
    expect(con.stats.sheetsScanned).toBe(1)
  })
})

describe('archiviazione delle segnalazioni', () => {
  const primaSegnalazione = () => esegui().findings[0]

  it('nasconde ciò che è stato valutato e archiviato', () => {
    const f = primaSegnalazione()
    const r = esegui(OPTIONS_BASE, [
      {
        findingKey: f.key,
        payloadHash: f.payloadHash,
        motivazione: 'Verificato sul catalogo del costruttore',
        dismissedAt: '2026-08-01T10:00:00Z',
        dismissedByName: 'Studio Bertin',
      },
    ])

    expect(r.findings.find(x => x.key === f.key)).toBeUndefined()
    expect(r.dismissed.find(x => x.key === f.key)?.dismissal.motivazione).toBe(
      'Verificato sul catalogo del costruttore'
    )
  })

  it('non conteggia fra le attive ciò che è archiviato', () => {
    const f = primaSegnalazione()
    const r = esegui(OPTIONS_BASE, [
      { findingKey: f.key, payloadHash: f.payloadHash, motivazione: 'ok', dismissedAt: '', dismissedByName: null },
    ])
    expect(Object.values(r.counts).reduce((a, b) => a + b, 0)).toBe(r.findings.length)
  })

  it('la fa riemergere se i valori coinvolti sono cambiati', () => {
    const f = primaSegnalazione()
    const r = esegui(OPTIONS_BASE, [
      {
        findingKey: f.key,
        payloadHash: 'valori-di-ieri',
        motivazione: 'valutata quando i dati erano altri',
        dismissedAt: '',
        dismissedByName: null,
      },
    ])

    expect(r.findings.find(x => x.key === f.key)).toBeDefined()
    expect(r.resurfacedKeys).toContain(f.key)
  })

  it('un’archiviazione che non corrisponde a nulla non ha effetti', () => {
    const r = esegui(OPTIONS_BASE, [
      { findingKey: 'chiave-inesistente', payloadHash: 'x', motivazione: 'y', dismissedAt: '', dismissedByName: null },
    ])
    expect(r.findings.length).toBe(esegui().findings.length)
  })
})

describe('applyDismissals', () => {
  it('separa attive, archiviate e riemerse', () => {
    const findings = esegui().findings.slice(0, 3)
    const split = applyDismissals(findings, [
      { findingKey: findings[0].key, payloadHash: findings[0].payloadHash, motivazione: 'ok', dismissedAt: '', dismissedByName: null },
      { findingKey: findings[1].key, payloadHash: 'diverso', motivazione: 'ok', dismissedAt: '', dismissedByName: null },
    ])

    expect(split.dismissed.map(f => f.key)).toEqual([findings[0].key])
    expect(split.resurfacedKeys).toEqual([findings[1].key])
    expect(split.active.map(f => f.key).sort()).toEqual([findings[1].key, findings[2].key].sort())
  })
})

describe('deduplicazione', () => {
  it('una stessa riga può violare più regole senza collisioni di chiave', () => {
    // Questa riga ha insieme dati in formato vecchio e pressione nel nome.
    const r = runAudit({
      catalog: [row('Compressori', 'KAESER', 'ASD 40 (@13bar)', { volume: '2580', pressione: '15' })],
      sheets: [],
      dismissals: [],
      options: OPTIONS_BASE,
    })
    const regole = r.findings.map(f => f.rule).sort()
    expect(regole).toContain('SPECS_LEGACY')
    expect(regole).toContain('PRESSIONE_NEL_NOME')
    expect(new Set(r.findings.map(f => f.key)).size).toBe(r.findings.length)
  })
})
