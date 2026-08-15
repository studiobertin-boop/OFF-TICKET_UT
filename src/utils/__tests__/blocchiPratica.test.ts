import { describe, expect, it } from 'vitest'
import type { RequestBlock } from '@/types'
import { durataInParole, riassumiBlocchi } from '@/utils/blocchiPratica'

/**
 * I casi sono quelli di una pratica vera: creata a metà luglio, ferma una settimana per un
 * certificato mancante, ripartita, e poi ferma di nuovo in attesa di un verbale.
 */
const CREATA = '2026-07-14T09:00:00.000Z'
const ADESSO = new Date('2026-08-13T09:00:00.000Z')

let seq = 0
const blocco = (parziale: Partial<RequestBlock>): RequestBlock =>
  ({
    id: `b${++seq}`,
    request_id: 'r1',
    blocked_by: 'u1',
    blocked_by_user: { id: 'u1', full_name: 'Francesco Bertin', email: 'f@x.it' },
    blocked_at: '2026-07-28T08:00:00.000Z',
    reason: 'Manca la dichiarazione CE del serbatoio S2',
    is_active: false,
    created_at: '2026-07-28T08:00:00.000Z',
    updated_at: '2026-07-28T08:00:00.000Z',
    ...parziale,
  }) as RequestBlock

const RISOLTO = blocco({
  blocked_at: '2026-07-28T08:00:00.000Z',
  unblocked_at: '2026-08-04T08:00:00.000Z',
  unblocked_by: 'u1',
  unblocked_by_user: { id: 'u1', full_name: 'Francesco Bertin', email: 'f@x.it' } as any,
  resolution_notes: 'Certificato ricevuto e allegato',
})

const APERTO = blocco({
  blocked_at: '2026-08-10T08:00:00.000Z',
  reason: 'In attesa del verbale di taratura delle valvole',
  is_active: true,
})

describe('riassumiBlocchi', () => {
  it('su una pratica mai ferma non dice niente', () => {
    const r = riassumiBlocchi([], { creataIl: CREATA, adesso: ADESSO })
    expect(r.totale).toBe(0)
    expect(r.attivo).toBeNull()
    expect(r.segmenti).toEqual([])
    expect(r.ultimoMovimento).toBeNull()
    expect(r.giorniVita).toBe(30)
  })

  it('conta i fermi e i giorni persi, il fermo in corso compreso', () => {
    // La query li restituisce dal più recente: il riassunto non deve dipendere dall'ordine.
    const r = riassumiBlocchi([APERTO, RISOLTO], { creataIl: CREATA, adesso: ADESSO })
    expect(r.totale).toBe(2)
    expect(r.attivo?.id).toBe(APERTO.id)
    expect(r.giorniFermaOra).toBe(3)
    expect(r.giorniPersi).toBe(10) // 7 del primo + 3 del secondo, ancora aperto
  })

  it('a fermo chiuso la pratica non risulta più ferma', () => {
    const chiuso = blocco({
      blocked_at: '2026-08-10T08:00:00.000Z',
      unblocked_at: '2026-08-12T08:00:00.000Z',
      reason: 'In attesa del verbale di taratura delle valvole',
    })
    const r = riassumiBlocchi([chiuso, RISOLTO], { creataIl: CREATA, adesso: ADESSO })
    expect(r.attivo).toBeNull()
    expect(r.giorniFermaOra).toBeNull()
    expect(r.giorniPersi).toBe(9)
    expect(r.ultimoMovimento).toBe('2026-08-12T08:00:00.000Z')
  })

  it('riconosce come attivo anche il blocco che non porta la data di sblocco', () => {
    // `is_active` a false e `unblocked_at` assente: la pratica è ferma comunque.
    const r = riassumiBlocchi([blocco({ blocked_at: '2026-08-10T08:00:00.000Z', is_active: false })], {
      creataIl: CREATA, adesso: ADESSO,
    })
    expect(r.attivo).not.toBeNull()
    expect(r.giorniFermaOra).toBe(3)
  })

  it('dispone i segmenti sulla vita della pratica, in ordine cronologico', () => {
    const r = riassumiBlocchi([APERTO, RISOLTO], { creataIl: CREATA, adesso: ADESSO })
    // Fermo risolto, il segno del suo sblocco, fermo ancora aperto.
    expect(r.segmenti.map((s) => s.tipo)).toEqual(['fermo', 'sblocco', 'fermo'])

    // Il primo fermo comincia al giorno 14 di 30 e dura 7 giorni.
    expect(r.segmenti[0].inizio).toBeCloseTo(46.7, 0)
    expect(r.segmenti[0].larghezza).toBeCloseTo(23.3, 0)
    expect(r.segmenti[0].aperto).toBe(false)
    expect(r.segmenti[0].descrizione).toBe(
      '28 lug – 4 ago · 7 giorni · Manca la dichiarazione CE del serbatoio S2'
    )

    expect(r.segmenti[2].aperto).toBe(true)
    expect(r.segmenti[2].descrizione).toBe(
      'Dal 10 ago · 3 giorni · In attesa del verbale di taratura delle valvole'
    )
  })

  it('segna anche il momento dello sblocco, con la sua nota', () => {
    const r = riassumiBlocchi([RISOLTO], { creataIl: CREATA, adesso: ADESSO })
    const sblocco = r.segmenti.find((s) => s.tipo === 'sblocco')!

    // Non ha durata: larghezza fissa, e comincia dove il fermo finisce.
    expect(sblocco.larghezza).toBeCloseTo(1.8, 5)
    expect(sblocco.inizio).toBeCloseTo(r.segmenti[0].inizio + r.segmenti[0].larghezza, 0)
    expect(sblocco.descrizione).toBe(
      'Sbloccata il 4 ago da Francesco Bertin · Certificato ricevuto e allegato'
    )
  })

  it('lo sblocco senza note lo dice, invece di lasciare il vuoto', () => {
    const senzaNote = blocco({
      blocked_at: '2026-08-01T08:00:00.000Z',
      unblocked_at: '2026-08-03T08:00:00.000Z',
      resolution_notes: null,
      unblocked_by_user: undefined,
    })
    const sblocco = riassumiBlocchi([senzaNote], { creataIl: CREATA, adesso: ADESSO })
      .segmenti.find((s) => s.tipo === 'sblocco')!
    expect(sblocco.descrizione).toBe('Sbloccata il 3 ago · nessuna nota di risoluzione')
  })

  it('un fermo ancora aperto non produce alcun segno di sblocco', () => {
    const r = riassumiBlocchi([APERTO], { creataIl: CREATA, adesso: ADESSO })
    expect(r.segmenti.every((s) => s.tipo === 'fermo')).toBe(true)
  })

  it('un fermo di poche ore resta visibile invece di sparire in scala', () => {
    const lampo = blocco({
      blocked_at: '2026-08-12T08:00:00.000Z',
      unblocked_at: '2026-08-12T11:00:00.000Z',
    })
    const [s] = riassumiBlocchi([lampo], { creataIl: CREATA, adesso: ADESSO }).segmenti
    expect(s.larghezza).toBeGreaterThanOrEqual(1.5)
    expect(s.inizio + s.larghezza).toBeLessThanOrEqual(100)
    expect(s.descrizione).toContain('meno di un giorno')
  })

  it('elenca i movimenti dal più recente, con chi li ha fatti', () => {
    const r = riassumiBlocchi([APERTO, RISOLTO], { creataIl: CREATA, adesso: ADESSO })
    expect(r.eventi.map((e) => [e.tipo, e.quando])).toEqual([
      ['blocco', '2026-08-10T08:00:00.000Z'],
      ['sblocco', '2026-08-04T08:00:00.000Z'],
      ['blocco', '2026-07-28T08:00:00.000Z'],
    ])
    expect(r.eventi[1].nota).toBe('Certificato ricevuto e allegato')
    expect(r.eventi[2].chi).toBe('Francesco Bertin')
  })

  it('regge una pratica creata oggi e ferma dal primo momento', () => {
    const r = riassumiBlocchi([blocco({ blocked_at: ADESSO.toISOString(), is_active: true })], {
      creataIl: ADESSO.toISOString(), adesso: ADESSO,
    })
    expect(r.giorniFermaOra).toBe(0)
    expect(r.segmenti[0].inizio).toBeGreaterThanOrEqual(0)
    expect(Number.isFinite(r.segmenti[0].larghezza)).toBe(true)
  })
})

describe('durataInParole', () => {
  it('dice le durate come si dicono a voce', () => {
    expect(durataInParole(0)).toBe('meno di un giorno')
    expect(durataInParole(1)).toBe('1 giorno')
    expect(durataInParole(7)).toBe('7 giorni')
  })
})
