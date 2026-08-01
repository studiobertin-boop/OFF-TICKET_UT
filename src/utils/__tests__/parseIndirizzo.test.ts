import { describe, it, expect } from 'vitest'
import { parseIndirizzo } from '../parseIndirizzo'

/**
 * I casi sono presi dagli indirizzi realmente presenti in requests.indirizzo_impianto
 * (corpus: .superpowers/sdd/2026-08-01-cliente-ubicazione-dettaglio-dm329/indirizzi-produzione.txt).
 * Regola guida: meglio un campo vuoto che un campo sbagliato — questi dati vengono
 * ritrascritti a mano nel portale CIVA.
 */
describe('parseIndirizzo', () => {
  describe('formato Google Places (termina con "Italia")', () => {
    it('civico prima della via', () => {
      expect(parseIndirizzo('17, Via Sile, Salvarosa, Castelfranco Veneto, Treviso, Veneto, 31033, Italia')).toEqual({
        via: 'Via Sile',
        numero_civico: '17',
        cap: '31033',
        comune: 'Castelfranco Veneto',
        provincia: 'Treviso',
      })
    })

    it('senza civico, con frazione fra via e comune', () => {
      expect(parseIndirizzo('Via Bellini, Foschini, Sant\'Alberto, Zero Branco, Treviso, Veneto, 31059, Italia')).toEqual({
        via: 'Via Bellini',
        numero_civico: '',
        cap: '31059',
        comune: 'Zero Branco',
        provincia: 'Treviso',
      })
    })

    it('nome del luogo prima del civico', () => {
      expect(
        parseIndirizzo('Magazzini Voltolina, 1, Via Aldo Moro, Vado, Fossalta di Portogruaro, Venezia, Veneto, 30025, Italia')
      ).toEqual({
        via: 'Via Aldo Moro',
        numero_civico: '1',
        cap: '30025',
        comune: 'Fossalta di Portogruaro',
        provincia: 'Venezia',
      })
    })

    it('due segmenti stradali: vince quello più vicino al comune', () => {
      expect(
        parseIndirizzo('Piazza Giovanni Battista Cavarzerani, Via Tommaso Salsa, Mignagola, Carbonera, Treviso, Veneto, 31030, Italia')
      ).toEqual({
        via: 'Via Tommaso Salsa',
        numero_civico: '',
        cap: '31030',
        comune: 'Carbonera',
        provincia: 'Treviso',
      })
    })

    it('civico nel segmento successivo alla via (insieme alla frazione)', () => {
      expect(
        parseIndirizzo('Via Postumia Ovest, 78 San Floriano, Olmi, San Biagio di Callalta, Treviso, Veneto, 31048, Italia')
      ).toEqual({
        via: 'Via Postumia Ovest',
        numero_civico: '78',
        cap: '31048',
        comune: 'San Biagio di Callalta',
        provincia: 'Treviso',
      })
    })

    it('civico attaccato al comune', () => {
      expect(parseIndirizzo('Via G. La Pira, 14 Camposampiero, Padova, Veneto, 35010, Italia')).toEqual({
        via: 'Via G. La Pira',
        numero_civico: '14',
        cap: '35010',
        comune: 'Camposampiero',
        provincia: 'Padova',
      })
    })

    it('civico in coda alla via', () => {
      expect(parseIndirizzo('Via Bianchi 7, Mogliano Veneto, Treviso, Veneto, 31021, Italia')).toEqual({
        via: 'Via Bianchi',
        numero_civico: '7',
        cap: '31021',
        comune: 'Mogliano Veneto',
        provincia: 'Treviso',
      })
    })

    it('senza via: solo comune, provincia e CAP', () => {
      expect(parseIndirizzo('San Stino di Livenza, Venezia, Veneto, 30029, Italia')).toEqual({
        via: '',
        numero_civico: '',
        cap: '30029',
        comune: 'San Stino di Livenza',
        provincia: 'Venezia',
      })
    })

    it('provincia scritta per esteso come "Provincia di X"', () => {
      expect(parseIndirizzo('Via Forche, Salvarosa, Castelfranco Veneto, Provincia di Treviso, Veneto, 31033, Italia')).toEqual({
        via: 'Via Forche',
        numero_civico: '',
        cap: '31033',
        comune: 'Castelfranco Veneto',
        provincia: 'Treviso',
      })
    })

    it('città metropolitana: il comune non è determinabile e resta vuoto', () => {
      expect(
        parseIndirizzo('2, Via Defendente de Ferrari, Parco Dora (Spina 3), San Donato, Circoscrizione 4, Torino, Piemonte, 10144, Italia')
      ).toEqual({
        via: 'Via Defendente de Ferrari',
        numero_civico: '2',
        cap: '10144',
        comune: '',
        provincia: 'Torino',
      })
    })
  })

  describe('formato CIVA "VIA X, N, CAP COMUNE, (PR)"', () => {
    it('civico in un segmento dedicato', () => {
      expect(parseIndirizzo('VIA DOSA, 30, 30030 MARTELLAGO, (VE)')).toEqual({
        via: 'VIA DOSA',
        numero_civico: '30',
        cap: '30030',
        comune: 'MARTELLAGO',
        provincia: 'VE',
      })
    })

    it('civico alfanumerico', () => {
      expect(parseIndirizzo('VIA CAPITELLO FERRARI, 11/A, 31049 VALDOBBIADENE, (TV)')).toEqual({
        via: 'VIA CAPITELLO FERRARI',
        numero_civico: '11/A',
        cap: '31049',
        comune: 'VALDOBBIADENE',
        provincia: 'TV',
      })
    })

    it('spazi doppi nel nome della via', () => {
      expect(parseIndirizzo('VIA  L. ZECCHETTO, 14, 30029 SAN STINO DI LIVENZA, (VE)')).toEqual({
        via: 'VIA L. ZECCHETTO',
        numero_civico: '14',
        cap: '30029',
        comune: 'SAN STINO DI LIVENZA',
        provincia: 'VE',
      })
    })

    it('civico attaccato alla via', () => {
      expect(parseIndirizzo('VIA E.FERMI 75, 36028 ROSSANO V.TO, (VI)')).toEqual({
        via: 'VIA E.FERMI',
        numero_civico: '75',
        cap: '36028',
        comune: 'ROSSANO V.TO',
        provincia: 'VI',
      })
    })

    it('via che contiene numeri: non li scambia per civico', () => {
      expect(parseIndirizzo('VIA INTERNATI 1943 - 1945, 13, 31057 SILEA, (TV)')).toEqual({
        via: 'VIA INTERNATI 1943 - 1945',
        numero_civico: '13',
        cap: '31057',
        comune: 'SILEA',
        provincia: 'TV',
      })
    })

    it('apostrofi nel nome della via e nel comune', () => {
      expect(parseIndirizzo("VIA DELLA LIBERTA' 2, 31027 SPRESIANO, (TV)")).toEqual({
        via: "VIA DELLA LIBERTA'",
        numero_civico: '2',
        cap: '31027',
        comune: 'SPRESIANO',
        provincia: 'TV',
      })
    })
  })

  describe('formati misti senza CAP o compattati', () => {
    it('provincia fra parentesi attaccata al comune, senza CAP', () => {
      expect(parseIndirizzo('Via Toscana 14, Paese (TV)')).toEqual({
        via: 'Via Toscana',
        numero_civico: '14',
        cap: '',
        comune: 'Paese',
        provincia: 'TV',
      })
    })

    it('civico, CAP, comune e provincia in un unico segmento', () => {
      expect(parseIndirizzo('Via Toscana, 14 31038 Paese (TV)')).toEqual({
        via: 'Via Toscana',
        numero_civico: '14',
        cap: '31038',
        comune: 'Paese',
        provincia: 'TV',
      })
    })
  })

  describe('casi degeneri: nessuna invenzione, indirizzo intero nel campo via', () => {
    it('stringa vuota', () => {
      expect(parseIndirizzo('')).toEqual({ via: '', numero_civico: '', cap: '', comune: '', provincia: '' })
    })

    it('solo spazi', () => {
      expect(parseIndirizzo('   ')).toEqual({ via: '', numero_civico: '', cap: '', comune: '', provincia: '' })
    })

    it('solo la via', () => {
      expect(parseIndirizzo('VIA DANTE')).toEqual({
        via: 'VIA DANTE',
        numero_civico: '',
        cap: '',
        comune: '',
        provincia: '',
      })
    })

    it('via, civico e comune senza separatori riconoscibili: nessuna scomposizione', () => {
      expect(parseIndirizzo('VIA ROMA 155 VILLORBA')).toEqual({
        via: 'VIA ROMA 155 VILLORBA',
        numero_civico: '',
        cap: '',
        comune: '',
        provincia: '',
      })
    })

    it('senza CAP né provincia il comune non è distinguibile: fallback integrale', () => {
      expect(parseIndirizzo('Via Canove, 4 Trebaseleghe')).toEqual({
        via: 'Via Canove, 4 Trebaseleghe',
        numero_civico: '',
        cap: '',
        comune: '',
        provincia: '',
      })
    })

    it('formato Google senza CAP: non riconosciuto, fallback integrale', () => {
      expect(parseIndirizzo('Via Roma, Treviso, Veneto, Italia')).toEqual({
        via: 'Via Roma, Treviso, Veneto, Italia',
        numero_civico: '',
        cap: '',
        comune: '',
        provincia: '',
      })
    })
  })
})
