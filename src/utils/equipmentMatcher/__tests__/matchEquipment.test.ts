import { describe, test, expect } from 'vitest'
import { matchEquipment } from '../index'
import { SERBATOI_SICC, COMPRESSORI_CECCATO, FILTRI } from './fixtures'
import type { EquipmentCatalogItem } from '@/types'

/**
 * Riga di catalogo minima per gli scenari della revisione (R5/R6/R7): non sono presi dalle
 * fixture di produzione perché riproducono difetti isolati dal revisore su combinazioni che
 * non esistono a catalogo reale (es. due varianti dello stesso modello a somiglianza alta ma
 * non identica, o una marca del tutto assente dai Serbatoi). Stessa forma del `riga()` locale
 * di `fixtures.ts`.
 */
const riga = (
  id: string, marca: string, modello: string,
  specs: Record<string, any>, usage_count = 0
): EquipmentCatalogItem => ({
  id, tipo: '', marca, modello, specs, usage_count,
  is_active: true, is_user_defined: false,
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
})

describe('esito certo', () => {
  test('ragione sociale completa, modello esatto, volume e PS confermati', () => {
    const r = matchEquipment('serbatoio',
      { marca: 'SICC TECH s.r.l.', modello: '500-12783', volume: 500, pressione_max: 11 },
      SERBATOI_SICC)

    expect(r.esito).toBe('certo')
    if (r.esito !== 'certo') return
    expect(r.candidato.riga.marca).toBe('SICC TECH s.r.l.')
    // Le due righe TECH `500-12783` e `500 - 12783` sono la stessa cosa: si collassano,
    // e sopravvive quella più usata.
    expect(r.candidato.riga.id).toBe('sicc-tech-500')
  })
})

describe('esito ambiguo', () => {
  test('marca parziale: una ragione sociale per candidato', () => {
    const r = matchEquipment('serbatoio',
      { marca: 'SICC', modello: '500-12783', volume: 500, pressione_max: 11 },
      SERBATOI_SICC)

    expect(r.esito).toBe('ambiguo')
    if (r.esito !== 'ambiguo') return
    expect(r.motivo).toBe('piu_candidati')
    expect(r.candidati.map((c) => c.riga.marca).sort())
      .toEqual(['SICC S.p.A.', 'SICC S.r.L.', 'SICC TECH s.r.l.'])
  })

  test('PS divergente su candidato unico', () => {
    const r = matchEquipment('serbatoio',
      { marca: 'SICC TECH s.r.l.', modello: '500-12783', volume: 500, pressione_max: 11.5 },
      SERBATOI_SICC)

    expect(r.esito).toBe('ambiguo')
    if (r.esito !== 'ambiguo') return
    expect(r.motivo).toBe('divergenza_specs')
    expect(r.candidati[0].confronti.find((c) => c.campo === 'ps')?.esito).toBe('diverge')
  })

  test('modello somigliante ma non identico non basta per la certezza', () => {
    const r = matchEquipment('serbatoio',
      { marca: 'SICC TECH', modello: '725/1278', volume: 725, pressione_max: 10.8 },
      SERBATOI_SICC)

    expect(r.esito).toBe('ambiguo')
    if (r.esito !== 'ambiguo') return
    expect(r.motivo).toBe('somiglianza_incerta')
  })

  // Correzione 2 (ruling del controller): il caso originale del brief («SICC TECH s.r.l.»
  // con modello `725/12783`) non esercita il ripiego, perché sotto quella stessa ragione
  // sociale esiste già `725 - 12783`, che normalizza identico e dà somiglianza 1 — il motivo
  // che ne esce è `divergenza_specs` (PS 10,8 letta contro 11 a catalogo), non
  // `ragione_sociale_altra`. Qui invece la marca letta è `SICC TECH` (senza «s.r.l.»), che a
  // fixture è una ragione sociale distinta e porta solo `725/12783`: la somiglianza fra
  // `500 12783` (letto) e `725 12783` (quell'unica riga) è 0,5, sotto la soglia d'ingresso di
  // 0,60, quindi la restrizione stretta resta vuota e scatta il ripiego alla famiglia.
  test('la targhetta dà una ragione sociale, il modello sta solo sotto un\'altra', () => {
    const r = matchEquipment('serbatoio',
      { marca: 'SICC TECH', modello: '500-12783', volume: 500, pressione_max: 11 },
      SERBATOI_SICC)

    expect(r.esito).toBe('ambiguo')
    if (r.esito !== 'ambiguo') return
    expect(r.motivo).toBe('ragione_sociale_altra')
  })

  test('famiglia senza somiglianza testuale: entrambe le ragioni sociali CECCATO', () => {
    const r = matchEquipment('compressore',
      { marca: 'A.ARIA C', modello: 'FONOCOMPACT PRO 270 F6S', pressione_max: 11 },
      COMPRESSORI_CECCATO)

    expect(r.esito).toBe('ambiguo')
    if (r.esito !== 'ambiguo') return
    expect(r.candidati.map((c) => c.riga.marca).sort())
      .toEqual(['A.ARIA C S.r.l. (ABAC)', 'CECCATO ARIA COMPRESSA S.R.L.'])
  })

  test('tipo senza discriminanti tecnici non raggiunge mai la certezza', () => {
    const r = matchEquipment('filtro',
      { marca: 'AIR COM S.r.l.', modello: 'AC 0035' },
      FILTRI)

    expect(r.esito).toBe('ambiguo')
    if (r.esito !== 'ambiguo') return
    expect(r.candidati).toHaveLength(1)
  })

  test('solo il modello leggibile: si cerca su tutto il tipo', () => {
    const r = matchEquipment('serbatoio',
      { modello: '500 - 12783', volume: 500, pressione_max: 11 },
      SERBATOI_SICC)

    expect(r.esito).toBe('ambiguo')
    if (r.esito !== 'ambiguo') return
    expect(r.candidati.length).toBeGreaterThanOrEqual(3)
  })
})

describe('esito nessuno', () => {
  test('marca e modello fuori catalogo', () => {
    const r = matchEquipment('serbatoio',
      { marca: 'KAESER KOMPRESSOREN SE', modello: 'XYZ-999', volume: 500 },
      SERBATOI_SICC)
    expect(r.esito).toBe('nessuno')
  })

  test('modello vuoto', () => {
    const r = matchEquipment('serbatoio', { marca: 'SICC S.p.A.' }, SERBATOI_SICC)
    expect(r.esito).toBe('nessuno')
  })

  test('catalogo vuoto', () => {
    const r = matchEquipment('serbatoio', { marca: 'SICC', modello: '500-12783' }, [])
    expect(r.esito).toBe('nessuno')
  })
})

describe('ordinamento e limite dei candidati', () => {
  // Important 6 (revisione): la versione precedente di questo test non aveva un `expect`
  // sull'esito prima del guard `if (r.esito !== 'ambiguo') return` — sarebbe rimasto verde
  // anche restituendo `nessuno` (verificato dal revisore alzando la soglia a 0,999). In più
  // l'asserzione sull'ordinamento era tautologica: con `modello: '12783'`, tutte le undici
  // righe SICC normalizzano a «<capacità> 12783» e danno la stessa somiglianza (0,625,
  // verificato numericamente sotto), quindi qualunque ordine la soddisfa. Lo spareggio vero
  // è sull'`usage_count` (3, 1, 0, 0, 0 per le prime cinque posizioni), ed è quello che va
  // asserito.
  test('al massimo cinque candidati, il pareggio di somiglianza si spezza su usage_count', () => {
    const r = matchEquipment('serbatoio', { modello: '12783' }, SERBATOI_SICC)

    expect(r.esito).toBe('ambiguo')
    if (r.esito !== 'ambiguo') return
    expect(r.candidati.length).toBeLessThanOrEqual(5)
    const sim = r.candidati.map((c) => c.simModello)
    expect([...sim].sort((a, b) => b - a)).toEqual(sim)
    expect(r.candidati.map((c) => c.riga.usage_count)).toEqual([3, 1, 0, 0, 0])
  })

  // Important 6, seconda metà (revisione): il test sopra non è sensibile alla mutazione dello
  // spareggio — il re-revisore ha rimosso `|| (b.riga.usage_count ?? 0) - (a.riga.usage_count
  // ?? 0)` da `ordina` e la suite è rimasta verde, perché dopo il collasso la `Map` conserva
  // l'ordine di primo inserimento e a fixture `sicc-tech-500` (usage 3) capita già di comparire
  // prima di `sicc-tech-725` (usage 1): `[3, 1, 0, 0, 0]` usciva dal solo ordine del catalogo,
  // non dallo spareggio. Qui l'ordine del catalogo è deliberatamente l'opposto di quello atteso.
  test('il pareggio di somiglianza si spezza su usage_count anche quando l\'ordine del catalogo dice il contrario', () => {
    const catalogo = [
      riga('bassa-usanza', 'ALFA SPA', 'X9', { volume: 500, ps: 11 }, 0),
      riga('alta-usanza', 'BETA SPA', 'X9', { volume: 500, ps: 11 }, 5),
      riga('media-usanza', 'GAMMA SPA', 'X9', { volume: 500, ps: 11 }, 2),
    ]
    const r = matchEquipment('serbatoio',
      { modello: 'X9', volume: 500, pressione_max: 11 },
      catalogo)

    expect(r.esito).toBe('ambiguo')
    if (r.esito !== 'ambiguo') return
    expect(r.candidati.map((c) => c.riga.usage_count)).toEqual([5, 2, 0])
  })
})

describe('revisione del Task 4: Critical 1 e Important 2/3/4/5/7 (ruling R5/R6/R7)', () => {
  test('Critical 1 — due varianti compatibili della stessa marca non certificano una sola riga', () => {
    // Ripro del revisore: `SK 19` e `SK 19 B` a catalogo, stessa marca, stesse specs.
    // Prima di R5 il filtro dei soli-esatti girava sui candidati prima di calcolare
    // `compatibili`: riduceva l'insieme al solo `SK 19` (l'unico a somiglianza 1) prima
    // ancora di sapere se ce ne fosse più di uno tecnicamente compatibile, e la clausola «un
    // solo candidato compatibile» del `certo` si trovava a valutare un insieme già potato.
    // Lo scenario reale è un OCR che tronca un suffisso (`SK 19-08` letto `SK 19`): con le
    // due varianti indistinguibili sulle specs, la scelta spetta all'operatore.
    const catalogo = [
      riga('sk19', 'ACME SPA', 'SK 19', { ps: 11, volume: 500 }),
      riga('sk19b', 'ACME SPA', 'SK 19 B', { ps: 11, volume: 500 }),
    ]
    const r = matchEquipment('serbatoio',
      { marca: 'ACME SPA', modello: 'SK 19', volume: 500, pressione_max: 11 },
      catalogo)

    expect(r.esito).toBe('ambiguo')
    if (r.esito !== 'ambiguo') return
    expect(r.motivo).toBe('piu_candidati')
    // R8 (ruling del controller, seconda revisione): il motivo `piu_candidati` deve trovare
    // davvero più candidati in elenco. Prima di R8 il filtro dei soli-esatti restava applicato
    // anche qui (`compatibili.length > 1` ma un solo esatto), riducendo `candidati` a `[SK 19]`
    // da solo: l'operatore avrebbe letto "più voci corrispondono" sopra un elenco da una riga,
    // senza mai vedere l'alternativa (`SK 19 B`) che ha reso il caso ambiguo.
    expect(r.candidati.map((c) => c.riga.id).sort()).toEqual(['sk19', 'sk19b'])
  })

  test('Important 3 — un exact match che diverge sulle specs non deve far sparire il quasi-match compatibile', () => {
    // Ripro del revisore: `500 12783` (esatto) diverge sul volume letto, `500 12783 A`
    // (quasi-match, somiglianza 0,909) è invece compatibile con tutto ciò che l'OCR ha letto.
    // Prima di R5 il filtro dei soli-esatti toglieva `500 12783 A` di mezzo perché non era
    // sim=1, lasciando in scena solo la riga che i dati letti avevano già contraddetto:
    // l'operatore avrebbe visto un solo candidato, sbagliato, e avrebbe perso l'aggancio.
    const catalogo = [
      riga('esatto-diverge', 'ACME SPA', '500 12783', { ps: 11, volume: 500 }),
      riga('quasi-compatibile', 'ACME SPA', '500 12783 A', { ps: 11, volume: 900 }),
    ]
    const r = matchEquipment('serbatoio',
      { marca: 'ACME SPA', modello: '500-12783', volume: 900, pressione_max: 11 },
      catalogo)

    expect(r.esito).toBe('ambiguo')
    if (r.esito !== 'ambiguo') return
    expect(r.candidati.map((c) => c.riga.id)).toEqual(['quasi-compatibile'])
  })

  test('Important 4 — il ripiego di famiglia con un solo esito esatto e confermato resta ambiguo', () => {
    // Copertura del ramo `!daAltraRagioneSociale`: la targhetta dichiara `SICC TECH s.r.l.`,
    // che a catalogo esiste ma con un modello del tutto diverso (`ZK 900`, somiglianza 0,43
    // col letto `ZK 250` — sotto soglia, quindi la restrizione stretta resta vuota). Il
    // ripiego di famiglia trova `ZK 250` sotto `SICC S.r.L.`: modello esatto, specs
    // confermate, marca comunque riconducibile alla famiglia (quindi non bloccato da R6) — è
    // `daAltraRagioneSociale` l'unica condizione che deve impedire il `certo`.
    const catalogo = [
      riga('sicc-tech-zk900', 'SICC TECH s.r.l.', 'ZK 900', { volume: 400, ps: 9 }),
      riga('sicc-srl-zk250', 'SICC S.r.L.', 'ZK 250', { volume: 250, ps: 9 }),
    ]
    const r = matchEquipment('serbatoio',
      { marca: 'SICC TECH s.r.l.', modello: 'ZK 250', volume: 250, pressione_max: 9 },
      catalogo)

    expect(r.esito).toBe('ambiguo')
    if (r.esito !== 'ambiguo') return
    expect(r.motivo).toBe('ragione_sociale_altra')
  })

  test('Important 5 — su un tipo a specsMap vuoto, modelli diversi della stessa marca non collassano', () => {
    // Copertura della Correzione 1: `separatore` ha `specsMap: {}`, quindi senza il modello
    // normalizzato nell'impronta del collasso questa si ridurrebbe alla sola marca — `SEP 100`
    // e `SEP 101`, entrambi sopra soglia contro il letto `SEP 10X` (somiglianza 0,750,
    // verificata numericamente), si fonderebbero in una riga sola.
    const catalogo = [
      riga('sep-100', 'BETA SEP S.r.l.', 'SEP 100', {}, 2),
      riga('sep-101', 'BETA SEP S.r.l.', 'SEP 101', {}, 1),
    ]
    const r = matchEquipment('separatore',
      { marca: 'BETA SEP S.r.l.', modello: 'SEP 10X' },
      catalogo)

    expect(r.esito).toBe('ambiguo')
    if (r.esito !== 'ambiguo') return
    expect(r.candidati.map((c) => c.riga.id).sort()).toEqual(['sep-100', 'sep-101'])
  })

  test('R6/R9 — nessuna marca letta non basta a certificare da sola il modello identico', () => {
    // Isola la parte del cancello che il caso PARISE (sotto) non copre: lì `daAltraRagioneSociale`
    // si estende già perché una marca È stata letta e non trova riscontro; verificato per
    // mutazione che togliendo quell'estensione il test PARISE resta comunque verde (la marca
    // letta non corrisponde a nessuna riga tecnicamente compatibile) — è la condizione esplicita
    // `corrispondeAllaMarca(compatibili[0])` nel `certo`, non l'estensione, a bloccare *questo*
    // caso, dove la marca è del tutto assente e l'estensione resta spenta apposta (guardia
    // `marcaLetta !== ''`, per non chiamare "un'altra ragione sociale" un dato che non c'è).
    const r = matchEquipment('serbatoio',
      { modello: '900-12783', volume: 900, pressione_max: 11 },
      SERBATOI_SICC)

    expect(r.esito).toBe('ambiguo')
    if (r.esito !== 'ambiguo') return
    // R9 (ruling del controller, seconda revisione): prima usciva `somiglianza_incerta`, che
    // mentiva quanto `somiglianza_incerta` mentiva sui filtri prima di R7 — il modello combacia
    // alla lettera ed è confermato tecnicamente, manca solo la marca. `marca_assente` lo dice
    // per quello che è.
    expect(r.motivo).toBe('marca_assente')
  })

  test('R9 — una marca di soli spazi conta come assente, non come "un\'altra ragione sociale"', () => {
    // Il re-revisore ha notato che la guardia `marcaLetta !== ''` lasciava passare `' '`:
    // `normalizzaMarcaStretta(' ')` è `''`, quindi nessun candidato la conferma mai, e senza il
    // `.trim()` sulla sorgente il risultato sarebbe stato `ragione_sociale_altra` per un dato
    // che di fatto non c'è. Stesso scenario del test sopra, marca `' '` invece che assente.
    const r = matchEquipment('serbatoio',
      { marca: ' ', modello: '900-12783', volume: 900, pressione_max: 11 },
      SERBATOI_SICC)

    expect(r.esito).toBe('ambiguo')
    if (r.esito !== 'ambiguo') return
    expect(r.motivo).toBe('marca_assente')
  })

  test('R6 — una marca dichiarata ma estranea al catalogo non certifica il modello identico', () => {
    // Ripro del revisore sulle fixture del task: `PARISE COMPRESSORI SRL` non esiste fra i
    // Serbatoi SICC e non risolve nessuna famiglia. Prima di R6 `strette` restava vuoto, la
    // ricerca scivolava sull'intero tipo senza che nessuna contraddizione emergesse, e
    // l'unico modello esatto (`900-12783`, sotto `SICC TECH s.r.l.`) usciva `certo` — la
    // scheda si sarebbe compilata con un costruttore diverso da quello sulla targhetta.
    const r = matchEquipment('serbatoio',
      { marca: 'PARISE COMPRESSORI SRL', modello: '900-12783', volume: 900, pressione_max: 11 },
      SERBATOI_SICC)

    expect(r.esito).toBe('ambiguo')
    if (r.esito !== 'ambiguo') return
    expect(r.motivo).toBe('ragione_sociale_altra')
  })

  test('R7 — modello identico ma senza dati tecnici da confermare non è "solo somigliante"', () => {
    // Stesso scenario del test «tipo senza discriminanti tecnici» sui filtri, con
    // l'asserzione sul motivo che prima mancava: `AC 0035` combacia alla lettera
    // (somiglianza 1) ma il filtro non ha campi confrontabili nello schema OCR, quindi
    // `haConferme` è sempre falso. Etichettarlo `somiglianza_incerta` direbbe il falso
    // all'operatore — il modello non è affatto incerto, manca solo la conferma tecnica.
    const r = matchEquipment('filtro',
      { marca: 'AIR COM S.r.l.', modello: 'AC 0035' },
      FILTRI)

    expect(r.esito).toBe('ambiguo')
    if (r.esito !== 'ambiguo') return
    expect(r.motivo).toBe('senza_conferma_tecnica')
  })
})
