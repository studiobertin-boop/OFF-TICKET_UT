/**
 * Generatore di azoto (N1…N3) e serbatoi interni (NS1…) nella relazione tecnica.
 *
 * I test stanno in un file loro e non nei file per sezione: quelli restano intatti, ed è la
 * prova che una scheda senza generatori produce il modello di prima.
 */
import { describe, test, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import PizZip from 'pizzip'
import { buildEsiti } from '../engine/esiti'
import { buildValvole } from '../engine/valvole'
import { buildCaratteristiche } from '../engine/caratteristiche'
import { buildProtezioni } from '../engine/protezioni'
import { buildFluidi } from '../engine/fluidi'
import { buildDescrizioneGenerale, fraseGeneratoriAzoto } from '../engine/descrizioneGenerale'
import { validateRelazione } from '../preflight'
import { buildRelazioneModel } from '../buildRelazioneModel'
import { renderRelazioneDocx } from '../renderRelazione'
import { descrizioneSerbatoioGeneratore } from '../helpers'
import {
  makeAdditionalInfo,
  makeCustomer,
  makeGeneratore,
  makePratica,
  makeSerbatoio,
  makeSerbatoioGeneratore,
  schedaConGeneratore,
} from './fixtures'

const info = makeAdditionalInfo()

describe('descrizioneSerbatoioGeneratore (riesportata da helpers)', () => {
  test('porta il codice del generatore', () => {
    expect(descrizioneSerbatoioGeneratore(makeSerbatoioGeneratore())).toBe(
      'Serbatoio interno generatore di azoto N1'
    )
  })
})

describe('buildEsiti — generatore di azoto', () => {
  test('dopo il blocco esistente: N1 non recipiente, poi NS1 e NS2 con le loro valvole', () => {
    const rows = buildEsiti(schedaConGeneratore(), info)
    const pos = rows.map((r) => r.pos)
    const iN1 = pos.indexOf('N1')
    // Il blocco del generatore chiude la tabella.
    expect(pos.slice(iN1)).toEqual(['N1', 'NS1', 'NS1.1', 'NS2', 'NS2.1', 'NS2.2'])

    const n1 = rows[iN1]
    expect(n1.apparecchiatura).toBe('Generatore di azoto')
    expect(n1.recipiente).toBe(false)
    expect(n1.esito).toBeNull()
    // Eredita l'adempimento più oneroso: NS1 dichiarazione, NS2 verifica.
    expect(n1.adempimento).toBe('Verifica e dichiarazione di messa in servizio')

    const ns1 = rows.find((r) => r.pos === 'NS1')!
    expect(ns1.apparecchiatura).toBe('Serbatoio interno generatore di azoto N1')
    expect(ns1.recipiente).toBe(true)
    expect(ns1.esito).toBe('DICHIARAZIONE')
    expect(rows.find((r) => r.pos === 'NS2')!.esito).toBe('VERIFICA')

    const ns21 = rows.find((r) => r.pos === 'NS2.1')!
    expect(ns21.apparecchiatura).toBe('Valvola di sicurezza')
    expect(ns21.adempimento).toBe('Verifica e dichiarazione di messa in servizio')
  })

  test('un generatore senza serbatoi interni ha una riga sola, con esito vuoto', () => {
    const rows = buildEsiti(schedaConGeneratore({ serbatoi_generatore: [] }), info)
    const n1 = rows.filter((r) => r.pos.startsWith('N'))
    expect(n1.map((r) => r.pos)).toEqual(['N1'])
    expect(n1[0].esito).toBeNull()
    expect(n1[0].recipiente).toBe(false)
  })

  test('senza serbatoi interni il generatore è escluso: non contiene recipienti', () => {
    const rows = buildEsiti(schedaConGeneratore({ serbatoi_generatore: [] }), info)
    const n1 = rows.find((r) => r.pos === 'N1')!
    expect(n1.adempimento).toBe('Escluso')
    expect(n1.riferimento).toBe('art. 2 comma i D.M. 329/2004')
  })
})

describe('buildValvole — serbatoi interni', () => {
  test('portata: la somma delle FAD di tutti i compressori, applicabile', () => {
    const { portata } = buildValvole(schedaConGeneratore(), info)
    const ns11 = portata.find((r) => r.posValvola === 'NS1.1')!
    expect(ns11.applicabile).toBe(true)
    expect(ns11.portataMax).toBe('3500')
    expect(ns11.portataMaxTesto).toBe('2000 + 1500 = 3500')
    expect(ns11.connesse.map((c) => c.pos)).toEqual(['C1', 'C2'])
    expect(ns11.adeguato).toBe(true) // 3500 <= 4000
    // Come per i serbatoi, in §6 si verifica la sola valvola principale.
    expect(portata.find((r) => r.posValvola === 'NS2.2')).toBeUndefined()
  })

  test('pressione: la taratura si confronta con la PS del serbatoio interno', () => {
    const { pressione } = buildValvole(schedaConGeneratore(), info)
    const ns11 = pressione.find((r) => r.posValvola === 'NS1.1')!
    expect(ns11.psRecipiente).toBe('11')
    expect(ns11.pressioneTaratura).toBe('10,5')
    expect(ns11.adeguato).toBe(true)
    expect(ns11.connesse[0].pos).toBe('NS1')
    expect(ns11.connesse[0].descrizione).toBe('Serbatoio interno generatore di azoto N1')
  })

  test('senza compressori la verifica di portata non è applicabile', () => {
    const { portata } = buildValvole(schedaConGeneratore({ compressori: [] }), info)
    const ns11 = portata.find((r) => r.posValvola === 'NS1.1')!
    expect(ns11.applicabile).toBe(false)
    expect(ns11.portataMax).toBe('')
    expect(ns11.adeguato).toBe(false)
  })
})

describe('preflight — valvole dei serbatoi interni', () => {
  const segnalazioni = (scheda: ReturnType<typeof schedaConGeneratore>) =>
    validateRelazione(
      buildRelazioneModel({
        scheda,
        additionalInfo: info,
        customer: makeCustomer(),
        pratica: makePratica(),
      })
    )

  test('con i compressori nessun avviso «senza compressori» sulle valvole NS', () => {
    const avviso = segnalazioni(schedaConGeneratore()).find(
      (s) => s.codice === 'valvola-senza-compressori'
    )
    expect(avviso?.posizioni ?? []).not.toContain('NS1.1')
    expect(avviso?.posizioni ?? []).not.toContain('NS2.1')
  })

  test('senza compressori le valvole NS hanno un avviso loro, senza invito a dichiarare', () => {
    const tutte = segnalazioni(
      schedaConGeneratore({ compressori: [], serbatoi: [makeSerbatoio()] })
    )
    const ns = tutte.find((s) => s.codice === 'valvola-generatore-senza-compressori')!
    expect(ns.livello).toBe('avviso')
    expect(ns.posizioni).toEqual(['NS1.1', 'NS2.1'])
    expect(ns.messaggio).not.toContain('va dichiarato qui sopra')
    expect(ns.messaggio).toContain('compressori')
    // Il serbatoio S1 conserva l'avviso di prima, testo compreso.
    const s = tutte.find((x) => x.codice === 'valvola-senza-compressori')!
    expect(s.posizioni).toEqual(['S1.1'])
    expect(s.messaggio).toContain('va dichiarato qui sopra')
  })
})

describe('buildCaratteristiche — generatore di azoto', () => {
  test('N1 riporta la portata d’aria di alimentazione, con l’etichetta che lo dice', () => {
    const rows = buildCaratteristiche(schedaConGeneratore())
    const n1 = rows.find((r) => r.pos === 'N1')!
    expect(n1.descrizione).toBe('Generatore di azoto')
    expect(n1.capacita).toBe('')
    expect(n1.portata).toContain('1200')
    expect(n1.portata).toContain('aria di alimentazione')
    expect(n1.pressione).toBe('13')
    expect(n1.categoria).toBe('')
  })

  test('i serbatoi interni si comportano come il disoleatore, e chiudono la tabella', () => {
    const rows = buildCaratteristiche(schedaConGeneratore())
    const pos = rows.map((r) => r.pos)
    expect(pos.slice(pos.indexOf('N1'))).toEqual(['N1', 'NS1', 'NS1.1', 'NS2', 'NS2.1', 'NS2.2'])
    const ns1 = rows.find((r) => r.pos === 'NS1')!
    expect(ns1.descrizione).toBe('Serbatoio interno generatore di azoto N1')
    expect(ns1.capacita).toBe('60')
    expect(ns1.portata).toBe('')
    expect(ns1.pressione).toBe('11')
    expect(ns1.temperatura).toBe('-10÷+50')
    expect(ns1.categoria).toBe('II')
    const ns11 = rows.find((r) => r.pos === 'NS1.1')!
    expect(ns11.descrizione).toBe('Valvola di sicurezza')
    expect(ns11.pressione).toBe('10,5')
  })
})

describe('buildProtezioni — serbatoi interni', () => {
  test('NS1 compare fra le altre apparecchiature con la sua valvola NS1.1', () => {
    const scheda = schedaConGeneratore()
    const { altre } = buildProtezioni(scheda, buildEsiti(scheda, info))
    const ns1 = altre.find((r) => r.pos === 'NS1')!
    expect(ns1.apparecchiatura).toBe('Serbatoio interno generatore di azoto N1')
    expect(ns1.valvole.map((v) => v.pos)).toEqual(['NS1.1'])
    expect(altre.find((r) => r.pos === 'NS2')!.valvole.map((v) => v.pos)).toEqual([
      'NS2.1',
      'NS2.2',
    ])
  })
})

describe('buildFluidi — generatore di azoto', () => {
  test('un generatore aggiunge la riga Azoto, prodotto in sito', () => {
    const { righe } = buildFluidi(schedaConGeneratore())
    const azoto = righe.filter((r) => r.fluido === 'Azoto')
    expect(azoto).toHaveLength(1)
    expect(azoto[0].gruppo).toBe('2')
    expect(azoto[0].provenienza).toBe('Produzione in sito')
  })

  test('con generatori_azoto vuoto nessuna riga Azoto', () => {
    const { righe } = buildFluidi(
      schedaConGeneratore({ generatori_azoto: [], serbatoi_generatore: [] })
    )
    expect(righe.filter((r) => r.fluido === 'Azoto')).toHaveLength(0)
  })

  test('con anche un serbatoio di azoto la riga resta una sola', () => {
    const { righe } = buildFluidi(
      schedaConGeneratore({ serbatoi: [makeSerbatoio({ fluido: 'AZOTO' })] })
    )
    expect(righe.filter((r) => r.fluido === 'Azoto')).toHaveLength(1)
  })
})

describe('fraseGeneratoriAzoto', () => {
  test('nessun generatore, nessuna frase', () => {
    expect(fraseGeneratoriAzoto([])).toBe('')
  })

  test('un generatore', () => {
    expect(fraseGeneratoriAzoto([makeGeneratore()])).toBe(
      "A valle della linea di trattamento è installato un generatore di azoto (N1) che produce azoto in sito a partire dall'aria compressa"
    )
  })

  test('due generatori', () => {
    expect(
      fraseGeneratoriAzoto([makeGeneratore(), makeGeneratore({ codice: 'N2' })])
    ).toBe(
      "A valle della linea di trattamento sono installati due generatori di azoto (N1, N2) che producono azoto in sito a partire dall'aria compressa"
    )
  })

  test('tre generatori', () => {
    expect(
      fraseGeneratoriAzoto([
        makeGeneratore(),
        makeGeneratore({ codice: 'N2' }),
        makeGeneratore({ codice: 'N3' }),
      ])
    ).toBe(
      "A valle della linea di trattamento sono installati tre generatori di azoto (N1, N2, N3) che producono azoto in sito a partire dall'aria compressa"
    )
  })

  test('senza sezione di trattamento: a valle dei compressori, al singolare e al plurale', () => {
    expect(fraseGeneratoriAzoto([makeGeneratore()], false)).toBe(
      "A valle dei compressori è installato un generatore di azoto (N1) che produce azoto in sito a partire dall'aria compressa"
    )
    expect(
      fraseGeneratoriAzoto([makeGeneratore(), makeGeneratore({ codice: 'N2' })], false)
    ).toBe(
      "A valle dei compressori sono installati due generatori di azoto (N1, N2) che producono azoto in sito a partire dall'aria compressa"
    )
    expect(
      fraseGeneratoriAzoto(
        [makeGeneratore(), makeGeneratore({ codice: 'N2' }), makeGeneratore({ codice: 'N3' })],
        false
      )
    ).toBe(
      "A valle dei compressori sono installati tre generatori di azoto (N1, N2, N3) che producono azoto in sito a partire dall'aria compressa"
    )
  })
})

describe('buildDescrizioneGenerale — generatore di azoto', () => {
  test('la frase segue la sezione di trattamento', () => {
    const { sezioni } = buildDescrizioneGenerale(schedaConGeneratore(), info)
    const iTrattamento = sezioni.findIndex((s) => s.startsWith('Sezione trattamento aria'))
    expect(iTrattamento).toBeGreaterThanOrEqual(0)
    expect(sezioni[iTrattamento + 1]).toBe(
      "A valle della linea di trattamento è installato un generatore di azoto (N1) che produce azoto in sito a partire dall'aria compressa"
    )
  })

  test('senza essiccatori né filtri la frase dice «a valle dei compressori»', () => {
    const { sezioni } = buildDescrizioneGenerale(
      schedaConGeneratore({ essiccatori: [], scambiatori: [], filtri: [] }),
      info
    )
    expect(sezioni.some((s) => s.startsWith('Sezione trattamento aria'))).toBe(false)
    expect(sezioni).toContain(
      "A valle dei compressori è installato un generatore di azoto (N1) che produce azoto in sito a partire dall'aria compressa"
    )
  })

  test('con generatori_azoto vuoto nessuna frase', () => {
    const { sezioni } = buildDescrizioneGenerale(
      schedaConGeneratore({ generatori_azoto: [], serbatoi_generatore: [] }),
      info
    )
    expect(sezioni.some((s) => s.includes('generator'))).toBe(false)
  })
})

describe('integrazione template — generatore di azoto', () => {
  test('il documento riporta la frase e le righe del generatore', () => {
    const model = buildRelazioneModel({
      scheda: schedaConGeneratore(),
      additionalInfo: info,
      customer: makeCustomer(),
      pratica: makePratica(),
    })
    const xml = new PizZip(
      renderRelazioneDocx(
        readFileSync(resolve(process.cwd(), 'public/templates/relazione-dm329.docx')),
        model
      )
    )
      .file('word/document.xml')!
      .asText()
    const testo = xml.replace(/<[^>]+>/g, '')
    expect(testo).toContain('è installato un generatore di azoto (N1)')
    expect(testo).toContain('Serbatoio interno generatore di azoto N1')
    expect(testo).toContain('Generatore di azoto')
    expect(testo).toContain('aria di alimentazione')
    expect(testo).toContain('NS1.1')
  })
})

describe('ordine di codice con array fuori ordine', () => {
  // Cancellato NS2 e riaggiunto: l'array è [NS1, NS3, NS2]; i generatori sono [N2, N1].
  const fuoriOrdine = () =>
    schedaConGeneratore({
      generatori_azoto: [makeGeneratore({ codice: 'N2' }), makeGeneratore({ codice: 'N1' })],
      serbatoi_generatore: [
        makeSerbatoioGeneratore({ codice: 'NS4', generatore_associato: 'N2', n_fabbrica: 'CMS-4' }),
        makeSerbatoioGeneratore({ codice: 'NS1', n_fabbrica: 'CMS-1' }),
        makeSerbatoioGeneratore({ codice: 'NS3', n_fabbrica: 'CMS-3' }),
        makeSerbatoioGeneratore({ codice: 'NS2', n_fabbrica: 'CMS-2' }),
      ],
    })
  const attesoPos = ['N1', 'NS1', 'NS1.1', 'NS2', 'NS2.1', 'NS3', 'NS3.1', 'N2', 'NS4', 'NS4.1']

  test('esiti', () => {
    const pos = buildEsiti(fuoriOrdine(), info).map((r) => r.pos)
    expect(pos.slice(pos.indexOf('N1'))).toEqual(attesoPos)
  })

  test('caratteristiche', () => {
    const pos = buildCaratteristiche(fuoriOrdine()).map((r) => r.pos)
    expect(pos.slice(pos.indexOf('N1'))).toEqual(attesoPos)
  })

  test('protezioni', () => {
    const scheda = fuoriOrdine()
    const { altre } = buildProtezioni(scheda, buildEsiti(scheda, info))
    expect(altre.map((r) => r.pos).filter((p) => p.startsWith('NS'))).toEqual([
      'NS1', 'NS2', 'NS3', 'NS4',
    ])
  })

  test('descrizione generale: la frase dei generatori elenca N1, N2', () => {
    const { sezioni } = buildDescrizioneGenerale(fuoriOrdine(), info)
    expect(sezioni.some((s) => s.includes('(N1, N2)'))).toBe(true)
  })

  test('valvole', () => {
    const { portata } = buildValvole(fuoriOrdine(), info)
    expect(portata.map((r) => r.posValvola).filter((p) => p.startsWith('NS'))).toEqual([
      'NS1.1', 'NS2.1', 'NS3.1', 'NS4.1',
    ])
  })
})
