import { describe, it, expect } from 'vitest'
import {
  makeCompressore,
  makeDatiImpianto,
  makeEssiccatore,
  makeFiltro,
  makeScheda,
  makeSeparatore,
  makeSerbatoio,
  makeValvola,
} from '@/services/relazione/__tests__/fixtures'
import { buildSchemaModel } from '../buildSchemaModel'
import { calcolaMuro, layoutSchema, quoteInstradamento } from '../layout'
import { renderSvg, righeLista, righeLegenda, posizioneAncora, varchiDelMuro } from '../renderSvg'
import { AVVICINAMENTO, raccordoOrtogonale } from '../tratti'
import { dimensioniDi, simboloDi } from '../symbols'
import type { Tarature } from '../libreria'
import type { SchemaLayout, SchemaNodo, SchemaNodoPosizionato, SchemaSegnoTubo } from '../types'
import { SVG_RIFERIMENTO_SENZA_TESTI } from './fixtures/svgRiferimentoSenzaTesti'
import { SVG_RIFERIMENTO_CON_TEE } from './fixtures/svgRiferimentoConTee'
import { SVG_RIFERIMENTO_CON_MURO } from './fixtures/svgRiferimentoConMuro'

/** Il layout su cui `svgMinimo` e i suoi fratelli lavorano: un compressore, un serbatoio. */
function layoutMinimo() {
  const scheda = makeScheda({
    compressori: [makeCompressore({ ha_disoleatore: false })],
    disoleatori: [],
    serbatoi: [makeSerbatoio({ orientamento: 'ORIZZONTALE' })],
    essiccatori: [],
    scambiatori: [],
    filtri: [],
    dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
  })
  return layoutSchema(buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } }))
}

function svgMinimo(noteTubazioni?: string[]) {
  return renderSvg(layoutMinimo(), {}, { noteTubazioni })
}

/**
 * Impianto con `muro` valorizzato e almeno due tubazioni che ne scavalcano l'ascissa: la mandata
 * del compressore verso il serbatoio in linea, e la linea condense del disoleatore verso la
 * tanica. Dal Blocco D4 `layoutSchema` non disegna più il muro da sé (lo aggiunge solo il
 * committente): questi test provano il render dei varchi dato un muro, non se `layoutSchema` lo
 * proponga, quindi glielo si attacca con `calcolaMuro`, la stessa regola che propone l'ascissa
 * al pulsante della barra (`ascissaProposta`, useMuro.ts).
 */
function layoutConMuro() {
  const scheda = makeScheda({
    serbatoi: [makeSerbatoio({ ubicazione: 'LINEA_DISTRIBUZIONE' })],
    essiccatori: [],
    scambiatori: [],
    filtri: [],
    dati_impianto: makeDatiImpianto({ raccolta_condense: 'tanica' }),
  })
  const layout = layoutSchema(
    buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })
  )
  return { ...layout, muro: calcolaMuro(layout.nodi) }
}

describe('la fascia sotto il disegno', () => {
  /**
   * Il rettangolo di intestazione della tabella: quello che precede la sua scritta.
   *
   * Si ferma al `/>` del rect e ammette il segno meno. Senza queste due cautele, su un'ascissa
   * negativa la ricerca scivolava sul `<text>` successivo e restituiva la SUA `x`, facendo passare
   * il test proprio nel caso che deve scoprire.
   */
  function intestazione(svg: string): { x: number; larghezza: number } {
    const i = svg.indexOf('LISTA APPARECCHIATURE')
    const inizio = svg.lastIndexOf('<rect', i)
    const rect = svg.slice(inizio, svg.indexOf('/>', inizio))
    return {
      x: Number(/ x="(-?[\d.]+)"/.exec(rect)![1]),
      larghezza: Number(/ width="(-?[\d.]+)"/.exec(rect)![1]),
    }
  }

  /**
   * Il terminale utenze NON serve allo scopo: `righeLista` lo esclude dalla tabella di proposito
   * (occuperebbe una riga che non dice nulla). Si allunga l'etichetta del compressore, che una
   * riga ce l'ha.
   */
  function svgConEtichettaLunga() {
    const layout = layoutMinimo()
    return renderSvg({
      ...layout,
      nodi: layout.nodi.map((n) =>
        n.tipo === 'compressore'
          ? { ...n, etichetta: 'Compressore ATLAS COPCO Mod. GA 90 VSD+ FF con essiccatore integrato' }
          : n
      ),
    })
  }

  function svgSpostatoADestra(dx: number) {
    const layout = layoutMinimo()
    return renderSvg({ ...layout, nodi: layout.nodi.map((n) => ({ ...n, x: n.x + dx })) })
  }

  /**
   * Un disegno DAVVERO stretto, appoggiato all'origine: un'apparecchiatura sola. Traslare il
   * disegno completo non basta — è più largo della tabella, e il blocco centrato non sborda mai:
   * verificato per mutazione, il riporto al margine si poteva togliere senza far cadere nulla.
   */
  function svgStrettoASinistra() {
    const layout = layoutMinimo()
    const solo = layout.nodi.find((n) => n.tipo === 'compressore')!
    return renderSvg({ ...layout, nodi: [{ ...solo, x: 0 }], archi: [] })
  }

  it('non è più larga quanto tutto il foglio', () => {
    const svg = svgMinimo()
    const foglio = Number(/<svg[^>]*width="([\d.]+)"/.exec(svg)![1])
    expect(intestazione(svg).larghezza).toBeLessThan(foglio - 80)
  })

  // Il minimo è l'intestazione in corpo 20, più grande delle righe. Sulle etichette vere la
  // colonna delle descrizioni è già più larga e il minimo non entra mai in gioco: serve un elenco
  // davvero corto perché il test discrimini, ed è stato verificato per mutazione che su
  // `svgMinimo` non lo faceva.
  it('non scende sotto la larghezza dell’intestazione, su un elenco corto', () => {
    const vuoto: SchemaLayout = { nodi: [], archi: [], muro: null, testi: [] }
    // 0,606 è il rapporto VERO misurato in pagina su «LISTA APPARECCHIATURE» in Arial 20 (tutta
    // maiuscola), non la stima usata per le annotazioni: con 0,5 questo test resterebbe verde
    // anche con una tabella troppo stretta perché l'intestazione ci sta davvero.
    const minimo = 'LISTA APPARECCHIATURE'.length * 20 * 0.606

    expect(intestazione(renderSvg(vuoto)).larghezza).toBeGreaterThanOrEqual(minimo)
  })

  it('si allarga quando una descrizione è lunga', () => {
    expect(intestazione(svgConEtichettaLunga()).larghezza).toBeGreaterThan(
      intestazione(svgMinimo()).larghezza
    )
  })

  // Confronto prima/dopo, non un valore assoluto: un test che si aspettasse una coordinata fissa
  // tornerebbe verde anche se la centratura sparisse e il numero coincidesse per caso.
  it('la tabella segue il disegno quando il disegno si sposta a destra', () => {
    const fermo = intestazione(svgMinimo()).x
    const spostato = intestazione(svgSpostatoADestra(400)).x
    expect(spostato - fermo).toBeCloseTo(400, 5)
  })

  // Il disegno va spostato, e non basta `svgMinimo`: il layout automatico comincia esattamente a
  // MARGINE, e lì il centro del disegno coincide per costruzione con quello del foglio — un test
  // su `svgMinimo` resterebbe verde anche rimettendo la nota al centro del FOGLIO, come è stato
  // verificato per mutazione. Con il disegno traslato i due centri divergono, e il test discrimina.
  it('nota e tabella condividono lo stesso centro, quello del disegno', () => {
    const layout = layoutMinimo()
    const svg = renderSvg(
      { ...layout, nodi: layout.nodi.map((n) => ({ ...n, x: n.x + 400 })) },
      {},
      { noteTubazioni: ['Collegamenti effettuati con tubazioni da Ø15 a Ø25mm'] }
    )
    const tabella = intestazione(svg)
    // Il testo della nota è composto centrato: la sua `x` È il centro del riquadro.
    const centroNota = Number(/<text x="([\d.]+)"[^>]*>Collegamenti effettuati/.exec(svg)![1])
    const centroFoglio = Number(/<svg[^>]*width="([\d.]+)"/.exec(svg)![1]) / 2

    expect(centroNota).toBeCloseTo(tabella.x + tabella.larghezza / 2, 5)
    expect(centroNota).not.toBeCloseTo(centroFoglio, 0)
  })

  it('un blocco che sborda a sinistra si riporta dentro il margine', () => {
    expect(intestazione(svgStrettoASinistra()).x).toBeGreaterThanOrEqual(40)
  })
})

describe('renderSvg', () => {
  it('produce un SVG autonomo e ben formato', () => {
    const svg = svgMinimo()
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true)
    expect(svg.endsWith('</svg>')).toBe(true)
    expect(svg).toMatch(/viewBox="0 0 \d+(?:\.\d+)? \d+(?:\.\d+)?"/)
  })

  it('disegna la tabella lista apparecchiature con i codici delle apparecchiature', () => {
    const svg = svgMinimo()
    expect(svg).toContain('LISTA APPARECCHIATURE')
    expect(svg).toContain('>C1</text>')
    expect(svg).toContain('>S1</text>')
    expect(svg).toContain('Compressore KAESER Mod. CSD 105 SFC')
  })

  it('stampa la nota sui diametri solo quando fornita', () => {
    const nota = 'Collegamenti effettuati con tubazioni da Ø40 a Ø63mm'
    expect(svgMinimo([nota])).toContain(nota)
    expect(svgMinimo()).not.toContain('Collegamenti effettuati')
  })

  it('tratteggia le linee condense e lascia continue le altre', () => {
    const scheda = makeScheda({ dati_impianto: makeDatiImpianto({ raccolta_condense: 'tanica' }) })
    const layout = layoutSchema(
      buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })
    )

    const svg = renderSvg(layout)
    // Solo il disegno, non la tabella: da questo task in poi la legenda porta un proprio
    // campione tratteggiato ("Linea condense"), che conterebbe come un'altra linea se non lo
    // si escludesse — questo test riguarda gli archi disegnati, non i simboli di legenda.
    const disegno = svg.slice(0, svg.indexOf('LISTA APPARECCHIATURE'))
    const tratteggiate = disegno.match(/stroke-dasharray/g) ?? []
    const condense = layout.archi.filter((a) => a.stile === 'condensa')

    expect(condense.length).toBeGreaterThan(0)
    // Una linea tratteggiata per ogni scarico condensa, più il codolo del terminale utenze, più
    // la verticale tratteggiata del filtro (Blocco 3 Task 3: `makeScheda` porta un filtro di
    // default, ed è l'unico dei tre rombi il cui segno interno è tratteggiato).
    expect(tratteggiate).toHaveLength(condense.length + 2)
  })

  it('disegna l’uscita verso le utenze come nodo, non più come freccia d’ufficio', () => {
    const scheda = makeScheda({
      compressori: [makeCompressore({ ha_disoleatore: false })],
      disoleatori: [],
      serbatoi: [makeSerbatoio({ orientamento: 'ORIZZONTALE' })],
      essiccatori: [],
      scambiatori: [],
      filtri: [],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
    })
    const layout = layoutSchema(
      buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })
    )
    const utenze = layout.nodi.find((n) => n.tipo === 'utenze')!
    utenze.etichetta = 'Utenze azoto'

    const svg = renderSvg(layout)
    // La scritta viene dal nodo: cambiarla nel layout la cambia nel disegno. Il terminale la
    // disegna con `testoMultiRiga` (Task 4), che avvolge anche una riga sola in un `<tspan>`.
    expect(svg).toContain('>Utenze azoto</tspan>')
    expect(svg).not.toContain('>Utenze aria</tspan>')
    // Una sola uscita: se la freccia automatica sopravvivesse, di terminali se ne vedrebbero due.
    expect(svg.match(/stroke-dasharray="10 7"/g) ?? []).toHaveLength(1)
  })

  it('il terminale utenze non compare fra le apparecchiature in lista', () => {
    const scheda = makeScheda({
      compressori: [makeCompressore({ ha_disoleatore: false })],
      disoleatori: [],
      serbatoi: [makeSerbatoio()],
      essiccatori: [],
      scambiatori: [],
      filtri: [],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
    })
    const layout = layoutSchema(
      buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })
    )

    expect(layout.nodi.some((n) => n.tipo === 'utenze')).toBe(true)
    expect(righeLista(layout).map((r) => (r.sinistra as { codice: string }).codice)).not.toContain('UTENZE')
  })

  it('la giunzione non compare fra le apparecchiature in lista', () => {
    const scheda = makeScheda({
      compressori: [makeCompressore({ ha_disoleatore: false })],
      disoleatori: [],
      serbatoi: [makeSerbatoio()],
      essiccatori: [],
      scambiatori: [],
      filtri: [],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
    })
    const layout = layoutSchema(buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } }))
    layout.nodi.push({
      id: 'M-G1',
      tipo: 'giunzione',
      etichetta: 'Giunzione',
      gruppo: 'LINEA_DISTRIBUZIONE',
      valvoleSicurezza: [],
      origine: 'manuale',
      x: 500,
      y: 300,
    })

    const codici = righeLista(layout).map((r) => (r.sinistra as { codice: string }).codice)
    expect(codici).not.toContain('M-G1')
  })

  it('nessuna tubazione porta più una punta di freccia d’ufficio', () => {
    // Rovesciato il 17-08-2026 (rifinitura R1): fino a quel giorno ogni tratto portava
    // `marker-end="url(#freccia)"` e questo test verificava che ne fosse esente il solo tratto
    // verso il terminale, che ha già la propria punta in cima al codolo. Ora le frecce si posano
    // a mano, quindi non ne deve comparire nessuna da sé — e con loro sparisce il `<marker>` dai
    // `<defs>`, che senza chi lo usi resterebbe dichiarato in ogni documento.
    const svg = svgMinimo()
    expect(svg).not.toContain('marker-end')
    expect(svg).not.toContain('url(#freccia)')
    expect(svg).not.toContain('<marker')
  })

  it('disegna due tratti di tipo diverso quando una valvola lo dichiara', () => {
    const scheda = makeScheda({
      compressori: [makeCompressore({ ha_disoleatore: false })],
      disoleatori: [],
      serbatoi: [makeSerbatoio({ orientamento: 'ORIZZONTALE' })],
      essiccatori: [],
      scambiatori: [],
      filtri: [],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
    })
    const layout = layoutSchema(
      buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })
    )
    const flessibile = layout.archi.find((a) => a.stile === 'flessibile')!
    const valvola = flessibile.segni![0]

    // Il confronto è con lo STESSO disegno prima del cambio: contare i tratti dritti in assoluto
    // non discrimina, perché il disegno ne porta già altri (la linea verso il terminale).
    const disegnoDi = (svg: string) => svg.slice(0, svg.indexOf('LISTA APPARECCHIATURE'))
    const primaDi = disegnoDi(renderSvg(layout))
    valvola.stileAValle = 'standard'
    const dopo = disegnoDi(renderSvg(layout))

    const tubi = (disegno: string) => (disegno.match(/<path d="M [^"]*" fill="none" stroke="#000"/g) ?? []).length
    expect(tubi(dopo)).toBe(tubi(primaDi) + 1)
    // Il pezzo nuovo è dritto e quello prima resta ondulato: sullo stesso tubo, ora, tutti e due.
    expect(dopo.match(/<path d="M [^"]*Q [^"]*"/g) ?? []).not.toHaveLength(0)
  })

  it('disegna una freccia dove il segno è posato, orientata come il tratto', () => {
    const scheda = makeScheda({
      compressori: [makeCompressore({ ha_disoleatore: false })],
      disoleatori: [],
      serbatoi: [makeSerbatoio({ orientamento: 'ORIZZONTALE' })],
      essiccatori: [],
      scambiatori: [],
      filtri: [],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
    })
    const layout = layoutSchema(
      buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })
    )
    // Il tratto verso il terminale utenze fa (610,360) → (645,360) → (645,260) → (680,260): a
    // t=0,1 lo si percorre verso destra, a t=0,5 verso l'alto. Due frecce sullo stesso arco, su
    // due giaciture diverse: se seguissero un orientamento fisso invece del tubo, una delle due
    // uscirebbe di traverso.
    const terminale = layout.nodi.find((n) => n.tipo === 'utenze')!
    const arco = layout.archi.find((a) => a.a.nodo === terminale.id)!
    const senza = renderSvg(layout)
    arco.segni = [
      { id: 'F1', tipo: 'freccia_direzione', t: 0.1 },
      { id: 'F2', tipo: 'freccia_direzione', t: 0.5 },
    ]
    const con = renderSvg(layout)

    // Un triangolo pieno in più: si conta la differenza, non un letterale, perché il disegno ne
    // porta già altri (la punta del codolo utenze, le farfalle delle valvole). Solo il disegno,
    // non la tabella: la freccia posata aggiunge anche la propria riga di legenda, che porta un
    // secondo triangolo e falserebbe il conto.
    const soloDisegno = (svg: string) => svg.slice(0, svg.indexOf('LISTA APPARECCHIATURE'))
    const pieni = (svg: string) => (soloDisegno(svg).match(/fill="#000" \/>/g) ?? []).length
    expect(pieni(con)).toBe(pieni(senza) + 2)

    const triangoli = soloDisegno(con)
      .match(/<path d="M [-\d.]+ [-\d.]+ L [-\d.]+ [-\d.]+ L [-\d.]+ [-\d.]+ Z" fill="#000" \/>/g)!
      .filter((p) => !senza.includes(p))
      .map((p) => [...p.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]))
    expect(triangoli).toHaveLength(2)

    // Sul tratto orizzontale: i due capi della base condividono l'ascissa e la punta è a destra.
    const [orizzontale, verticale] = triangoli
    expect(orizzontale[1][0]).toBe(orizzontale[2][0])
    expect(orizzontale[0][0]).toBeGreaterThan(orizzontale[1][0])

    // Sul montante che sale: la base condivide l'ordinata e la punta sta più in alto (y minore).
    expect(verticale[1][1]).toBe(verticale[2][1])
    expect(verticale[0][1]).toBeLessThan(verticale[1][1])
  })

  // La scritta sporgeva oltre il bordo destro: nel PNG finiva tagliata a metà.
  //
  // Non si può leggere la `x` dal `<text>`: da quando la scritta la disegna `simboloUtenze`
  // dentro un `<g transform="translate(…)">`, quella coordinata è LOCALE e vale sempre 30 —
  // l'asserzione diventerebbe «larghezza > 130», vera per costruzione perché la larghezza minima
  // è quella della tabella (830). Si confronta invece il bordo destro del riquadro del
  // terminale, che è ciò che deve stare dentro la tela.
  //
  // La scritta è lunga apposta: con «Utenze aria» il riquadro finisce a 740, dentro gli 830
  // della tabella, e il confronto passerebbe anche se `dimensioniLayout` ignorasse del tutto il
  // terminale. Qui il bordo destro supera la tabella, quindi solo un calcolo corretto lo copre.
  it('allarga la viewBox fino a contenere la scritta delle utenze, anche lunga', () => {
    const scheda = makeScheda({
      compressori: [makeCompressore({ ha_disoleatore: false })],
      disoleatori: [],
      serbatoi: [makeSerbatoio({ orientamento: 'ORIZZONTALE' })],
      essiccatori: [],
      scambiatori: [],
      filtri: [],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
    })
    const layout = layoutSchema(
      buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })
    )
    const utenze = layout.nodi.find((n) => n.tipo === 'utenze')!
    utenze.etichetta = 'Utenze aria compressa reparto 2'

    const svg = renderSvg(layout)
    const larghezza = Number(svg.match(/viewBox="0 0 (\d+(?:\.\d+)?)/)?.[1])
    const bordoDestro = utenze.x + dimensioniDi(utenze).larghezza

    // Il fixture dev'essere quello che discrimina: il terminale deve sporgere oltre la tabella.
    expect(bordoDestro).toBeGreaterThan(830)
    expect(larghezza).toBeGreaterThanOrEqual(bordoDestro)
  })

  it('non lascia entità XML non valide nelle etichette con &', () => {
    const scheda = makeScheda({
      compressori: [makeCompressore({ marca: 'ROSSI & FIGLI', ha_disoleatore: false })],
      disoleatori: [],
      essiccatori: [],
      scambiatori: [],
      filtri: [],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
    })
    const layout = layoutSchema(
      buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })
    )

    const svg = renderSvg(layout)
    expect(svg).toContain('ROSSI &amp; FIGLI')
    expect(svg).not.toMatch(/&(?!amp;|lt;|gt;|quot;|apos;|#)/)
  })

  it('disegna il flessibile ondulato per tutta la lunghezza, non a riccioli', () => {
    const svg = svgMinimo()
    // La firma del flessibile è il suo tracciato a curve (comandi Q). Fino al 17-08-2026 questo
    // pattern finiva su `marker-end`, la punta che ogni tratto portava in coda: ora le frecce si
    // posano a mano e quel pezzo non c'è più.
    const flessibile = svg.match(/<path d="M [^"]*Q [^"]*" fill="none" stroke="#000"[^>]*\/>/g) ?? []

    expect(flessibile.length).toBeGreaterThan(0)
    // Molte onde, non le quattro del vecchio ricciolo da 40 unità.
    expect((flessibile[0].match(/Q /g) ?? []).length).toBeGreaterThan(8)
  })

  // La forma della mandata flessibile la decide `rottaFlessibile` (tratti.ts), che il render del
  // documento chiama tramite `instrada` da questo task: qui si verifica che il documento la
  // riporti davvero, non solo che disegni *un* percorso ondulato qualunque. Il vertice dove il
  // collettore piega verso la discesa è quello che discrimina: se `instrada`/`rottaFlessibile`
  // sbagliasse il verso dello scostamento (`AVVICINAMENTO`), la discesa cadrebbe dall'altra parte
  // del bocchello e nessuno degli altri test sul flessibile se ne accorgerebbe (controllano solo
  // l'onda e il punto d'arrivo finale, invariato in entrambi i casi).
  it('la discesa della mandata flessibile si stacca dal fianco del serbatoio verso l’interno', () => {
    const scheda = makeScheda({
      compressori: [makeCompressore({ ha_disoleatore: false })],
      disoleatori: [],
      serbatoi: [makeSerbatoio({ orientamento: 'ORIZZONTALE' })],
      essiccatori: [],
      scambiatori: [],
      filtri: [],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
    })
    const layout = layoutSchema(
      buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })
    )
    const arco = layout.archi.find((a) => a.stile === 'flessibile')!
    const indice = new Map(layout.nodi.map((n) => [n.id, n]))
    const pA = posizioneAncora(indice.get(arco.a.nodo)!, arco.a.ancora)
    const quote = quoteInstradamento(layout)
    const xDiscesa = pA.x - AVVICINAMENTO

    const svg = renderSvg(layout)
    const atteso = new RegExp(`Q [-\\d.]+ [-\\d.]+ ${xDiscesa} ${quote.yCollettore}`)
    expect(svg).toMatch(atteso)
  })

  // Stessa logica della sonda sul flessibile qui sopra, applicata a `rottaLinea`: il vertice
  // che discrimina è quello dove la spezzata piega, a metà strada in ORIZZONTALE (`xMedia`, sul
  // primo tratto). Nessun altro test sulle mandate di linea guarda un punto intermedio: quelli
  // esistenti controllano solo l'inizio (ancora di partenza) e la presenza/assenza della punta di
  // freccia, entrambi invarianti anche se la spezzata girasse in verticale invece che in
  // orizzontale.
  it('la mandata di linea gira a metà strada in orizzontale, non in verticale', () => {
    const scheda = makeScheda({ dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }) })
    const layout = layoutSchema(
      buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })
    )
    const indice = new Map(layout.nodi.map((n) => [n.id, n]))
    const arco = layout.archi.find(
      (a) => a.stile === 'standard' && indice.get(a.a.nodo)!.tipo !== 'utenze'
    )!
    const pDa = posizioneAncora(indice.get(arco.da.nodo)!, arco.da.ancora)
    const pA = posizioneAncora(indice.get(arco.a.nodo)!, arco.a.ancora)
    const xMedia = (pDa.x + pA.x) / 2

    const svg = renderSvg(layout)
    expect(svg).toContain(`M ${pDa.x} ${pDa.y} L ${xMedia} ${pDa.y} L ${xMedia} ${pA.y} L ${pA.x} ${pA.y}`)
  })

  // Stessa logica ancora, applicata a `rottaCondensa`: il vertice che discrimina è il primo, dove
  // il tubo sale dal nodo fino alla corsia comune restando sulla `x` di PARTENZA. Se il primo
  // salto avvenisse sulla `x` di arrivo invece che su quella di partenza, il tratto orizzontale
  // sulla corsia si sposterebbe ma il punto di partenza (che altri test verificano) e quello di
  // arrivo resterebbero identici — nessun test esistente se ne accorgerebbe.
  it('la linea condense sale dal nodo sulla propria x prima di traslare sulla corsia comune', () => {
    const scheda = makeScheda({ dati_impianto: makeDatiImpianto({ raccolta_condense: 'tanica' }) })
    const layout = layoutSchema(
      buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })
    )
    const arco = layout.archi.find((a) => a.stile === 'condensa')!
    const indice = new Map(layout.nodi.map((n) => [n.id, n]))
    const pDa = posizioneAncora(indice.get(arco.da.nodo)!, arco.da.ancora)
    const quote = quoteInstradamento(layout)

    const svg = renderSvg(layout)
    expect(svg).toContain(`M ${pDa.x} ${pDa.y} L ${pDa.x} ${quote.yCorsiaCondense}`)
  })
})

describe('attacco alle ancore', () => {
  it('la polilinea della mandata comincia esattamente sull’ancora del compressore', () => {
    const scheda = makeScheda({
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
      essiccatori: [], scambiatori: [], filtri: [],
    })
    const layout = layoutSchema(buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } }))
    const compressore = layout.nodi.find((n) => n.id === 'C1')!
    const svg = renderSvg(layout)

    // ancora 'alto-out' del compressore: (larghezza/2, 0) in coordinate locali — 60, non più
    // 64,5 da quando il compressore è sceso a 120 (Task 8, Blocco 3, per portare l'ancora sulla
    // griglia — vedi `DIMENSIONI.compressore`).
    const atteso = `M ${compressore.x + 60} ${compressore.y}`
    expect(svg).toContain(atteso)
  })

  // Questo è il caso che discrimina davvero il vecchio calcolo (corpoNodo/centro) dal nuovo:
  // per il compressore l'ancora 'alto-out' coincide algebricamente col vecchio centro/cielo del
  // corpo, quindi il test sopra passerebbe anche senza la modifica. Il separatore-pozzo invece
  // riceve la condensa di fianco (ancora 'sx'), un punto diverso sia dal centro del corpo sia dal
  // punto in cima che il vecchio calcolo produceva — solo qui una regressione a corpoNodo/centro
  // farebbe fallire il test.
  it('la linea condense entra di fianco nel separatore-pozzo, non dall’alto', () => {
    const scheda = makeScheda({
      essiccatori: [], scambiatori: [], filtri: [],
      separatori: [makeSeparatore({ codice: 'SEP1' })],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'separatore' }),
    })
    const layout = layoutSchema(buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } }))
    const sep = layout.nodi.find((n) => n.id === 'SEP1')!
    const svg = renderSvg(layout)

    // Vertice sinistro del rombo letto dal PATH VERO che `simboloDi` disegna, non da un
    // letterale a mano: fix round 1 (revisione, Task 8, Blocco 3) — la prima stesura di questo
    // test dichiarava (10, 40), lo stesso valore sbagliato che `ANCORE_ROMBO` dichiarava allora,
    // e il confronto letterale-contro-letterale non poteva scoprire che i due non
    // corrispondevano al disegno reale (il rombo, a `cx=cy=semiL=50`/`semiH=40`, disegna
    // `M 50 10 L 100 50 L 50 90 L 0 50 Z`: il quarto punto, dopo l'ultima "L", è il vertice
    // sinistro). Estrarlo da qui invece di scriverlo a mano fa cadere questo test se il rombo si
    // sposta di nuovo, invece di limitarsi a confermare se stesso.
    const separatoreNudo: SchemaNodo = {
      id: 'SEP1', tipo: 'separatore', etichetta: '', gruppo: 'ALTRO', valvoleSicurezza: [], origine: 'scheda',
    }
    const rombo = simboloDi(separatoreNudo).match(
      /<path d="M ([\d.]+) ([\d.]+) L ([\d.]+) ([\d.]+) L ([\d.]+) ([\d.]+) L ([\d.]+) ([\d.]+) Z"/
    )!
    const [vertSx, vertSy] = [Number(rombo[7]), Number(rombo[8])]
    const atteso = `L ${sep.x + vertSx} ${sep.y + vertSy}" fill="none" stroke="#000" stroke-width="2" stroke-dasharray="7 10" />`
    expect(svg).toContain(atteso)
  })

  // Simmetrico sulla partenza: il serbatoio scarica la condensa dalla propria ancora
  // 'basso-out', non da un punto ricavato scendendo di 24px oltre il fondo del corpo (come
  // faceva il vecchio calcolo).
  it('la linea condense parte esattamente dall’ancora basso-out del serbatoio', () => {
    const scheda = makeScheda({
      essiccatori: [], scambiatori: [], filtri: [],
      separatori: [makeSeparatore({ codice: 'SEP1' })],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'separatore' }),
    })
    const layout = layoutSchema(buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } }))
    const s1 = layout.nodi.find((n) => n.id === 'S1')!
    const svg = renderSvg(layout)

    // ancora 'basso-out' del serbatoio verticale: (50, 300) in coordinate locali — il corpo
    // isolato dalla valvola e centrato sul riquadro 100×300 (Task 8, Blocco 3: 100×300, non più
    // 103×298 del Task 4 — larghezza arrotondata a multiplo di 20 perché l'ancora cadesse sulla
    // griglia, vedi `CORPO_SERBATOIO_VERTICALE`).
    const atteso = `M ${s1.x + 50} ${s1.y + 300}`
    expect(svg).toContain(atteso)
  })
})

describe('varchi nel muro', () => {
  /** Fasce verticali occupate dai tronconi pieni di muratura. */
  function tronconi(svg: string, xMuro: number): [number, number][] {
    return [...svg.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="[\d.]+" height="([\d.]+)"/g)]
      .filter((m) => Number(m[1]) === xMuro)
      .map((m) => [Number(m[2]), Number(m[2]) + Number(m[3])] as [number, number])
  }

  // Con un serbatoio in linea, mandata e linee condense attraversano il muro a quote diverse:
  // un varco solo (com'era) lasciava la muratura a tagliare le tubazioni.
  /**
   * Quote alle quali le tubazioni disegnate attraversano la verticale `x`. Il flessibile ora
   * arriva ondulato (comandi Q, non L): si leggono anche i punti d'arrivo delle curve, non solo
   * quelli dei segmenti retti. Ogni Q d'un tratto originariamente orizzontale interpola in linea
   * retta lungo quello stesso tratto (solo il punto di controllo si scosta in perpendicolare), e
   * resta quindi a y costante: la sequenza di piccoli sotto-segmenti individuati così attraversa
   * `x` esattamente dove lo attraverserebbe il tratto liscio.
   */
  function attraversamenti(svg: string, x: number): number[] {
    const quote: number[] = []
    for (const path of svg.matchAll(/<path d="([^"]+)"/g)) {
      const punti = [
        ...path[1].matchAll(/[ML] ([\d.-]+) ([\d.-]+)|Q [\d.-]+ [\d.-]+ ([\d.-]+) ([\d.-]+)/g),
      ].map((p) => ({
        x: Number(p[1] ?? p[3]),
        y: Number(p[2] ?? p[4]),
      }))
      for (let i = 1; i < punti.length; i++) {
        const a = punti[i - 1]
        const b = punti[i]
        if (a.y === b.y && Math.min(a.x, b.x) <= x && x <= Math.max(a.x, b.x)) quote.push(a.y)
      }
    }
    return quote
  }

  it('apre un varco per ogni tubazione che attraversa il muro', () => {
    const scheda = makeScheda({
      serbatoi: [makeSerbatoio({ ubicazione: 'LINEA_DISTRIBUZIONE' })],
      essiccatori: [],
      scambiatori: [],
      filtri: [],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'tanica' }),
    })
    const layout = layoutSchema(
      buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })
    )
    // Dal Blocco D4 `layoutSchema` non attacca più il muro da sé: qui si prova il render dei
    // varchi dato un muro, quindi lo si ricava con la stessa regola che proponeva prima.
    layout.muro = calcolaMuro(layout.nodi)
    expect(layout.muro).not.toBeNull()

    const svg = renderSvg(layout)
    const muratura = tronconi(svg, layout.muro!.x)
    const quote = [...new Set(attraversamenti(svg, layout.muro!.x))]

    // Mandata del compressore e linea condense del disoleatore passano a quote diverse.
    expect(quote.length).toBeGreaterThan(1)
    for (const y of quote) {
      expect(muratura.some(([a, b]) => y > a && y < b)).toBe(false)
    }
  })

  it('i varchi nel muro si calcolano sulla polilinea liscia, non sull’onda', () => {
    // Se `quoteAttraversamento` ricevesse il tracciato ondulato, i tratti orizzontali non
    // sarebbero più orizzontali e nessun varco si aprirebbe: il muro tornerebbe pieno.
    const scheda = makeScheda({
      compressori: [makeCompressore({ ha_disoleatore: false })],
      disoleatori: [],
      serbatoi: [makeSerbatoio({ ubicazione: 'LINEA_DISTRIBUZIONE' })],
      essiccatori: [],
      scambiatori: [],
      filtri: [],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
    })
    const layout = layoutSchema(
      buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })
    )
    // Dal Blocco D4 `layoutSchema` non attacca più il muro da sé: qui si prova il render dei
    // varchi dato un muro, quindi lo si ricava con la stessa regola che proponeva prima.
    layout.muro = calcolaMuro(layout.nodi)

    expect(layout.muro).not.toBeNull()
    const svg = renderSvg(layout)

    // I tronconi pieni del muro sono i rect di spessore 14. Se `quoteAttraversamento` non
    // trovasse più tratti orizzontali, non si aprirebbe nessun varco e i tronconi coprirebbero
    // l'intera altezza del muro: è questo il confronto che discrimina, non il loro numero (con
    // un varco a ridosso di un estremo il troncone resta uno solo).
    const altezze = [...svg.matchAll(/<rect x="[\d.]+" y="[-\d.]+" width="14" height="([\d.]+)"/g)].map(
      (m) => Number(m[1])
    )
    const coperto = altezze.reduce((s, h) => s + h, 0)
    const altezzaMuro = layout.muro!.yMax - layout.muro!.yMin

    expect(altezze.length).toBeGreaterThan(0)
    expect(coperto).toBeLessThan(altezzaMuro)
  })

  // `varchiDelMuro` esiste perche' la tela dell'editor apra i varchi con la funzione del
  // documento e non con una copia: e' la stessa `renderArchi` che rende l'SVG, di cui si tiene
  // solo l'altra meta' del risultato.
  it('varchiDelMuro riporta le quote a cui i tubi attraversano il muro', () => {
    const layout = layoutConMuro()
    const varchi = varchiDelMuro(layout)
    expect(varchi.length).toBeGreaterThan(0)
    // Il varco non e' solo calcolato: e' davvero aperto nel muro disegnato. Il troncone di
    // muratura pieno subito dopo un varco comincia a `varco + larghezzaVarco/2` (22): è la
    // prova che `simboloMuro` (symbols/index.ts) ha davvero letto questa quota per aprirci un
    // buco, non solo che `varchiDelMuro` l'ha calcolata.
    for (const y of varchi) expect(renderSvg(layout)).toContain(`y="${y + 22}"`)
  })

  // Riferimento ESTERNO al codice corrente, non un self-comparison. Copre l'unico elemento che
  // gli altri due non toccano: il muro, e con lui i varchi che le tubazioni gli aprono. Dal
  // Blocco D4 il muro e' modificabile a mano, quindi e' l'elemento piu' esposto del disegno, e
  // senza questo pin la sua scomparsa da un impianto passerebbe inosservata.
  it('un impianto col muro resta identico al riferimento', () => {
    expect(renderSvg(layoutConMuro())).toBe(SVG_RIFERIMENTO_CON_MURO)
  })
})

describe('punti di passaggio', () => {
  it('la polilinea attraversa i gomiti imposti, nell’ordine dato', () => {
    const scheda = makeScheda({
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
      essiccatori: [], scambiatori: [], filtri: [],
    })
    const layout = layoutSchema(buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } }))
    layout.archi[0].punti = [{ x: 300, y: 500 }]

    const svg = renderSvg(layout)
    expect(svg).toContain('300 500')
  })

  it('senza punti il percorso resta quello automatico', () => {
    const scheda = makeScheda({
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
      essiccatori: [], scambiatori: [], filtri: [],
    })
    const layout = layoutSchema(buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } }))
    const automatico = renderSvg(layout)

    layout.archi[0].punti = []
    expect(renderSvg(layout)).toBe(automatico)
  })
})

describe('segno sull’arco', () => {
  it('disegna il segno di valvola nel punto che il suo `t` indica, non in un punto fisso', () => {
    const scheda = makeScheda({
      compressori: [makeCompressore({ ha_disoleatore: false })],
      disoleatori: [],
      serbatoi: [makeSerbatoio({ orientamento: 'ORIZZONTALE' })],
      essiccatori: [],
      scambiatori: [],
      filtri: [],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
    })
    const layout = layoutSchema(buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } }))
    const arco = layout.archi.find((a) => a.stile === 'flessibile')!
    arco.segni = [{ id: 'v1', tipo: 'valvola_intercettazione', t: 0 }]
    const conTAZero = renderSvg(layout)

    arco.segni = [{ id: 'v1', tipo: 'valvola_intercettazione', t: 1 }]
    const conTAUno = renderSvg(layout)

    // Stesso simbolo (stesso `<path` di valvolaIntercettazione), ma non nello stesso punto:
    // altrimenti `t` non conterebbe nulla.
    expect(conTAZero).not.toBe(conTAUno)
  })
})

describe('raccordoOrtogonale', () => {
  it('due punti già allineati non introducono un gomito superfluo', () => {
    expect(raccordoOrtogonale({ x: 10, y: 10 }, { x: 10, y: 90 })).toEqual([{ x: 10, y: 90 }])
    expect(raccordoOrtogonale({ x: 10, y: 10 }, { x: 90, y: 10 })).toEqual([{ x: 90, y: 10 }])
  })

  it('due gomiti coincidenti non producono un segmento a lunghezza zero duplicato', () => {
    expect(raccordoOrtogonale({ x: 10, y: 10 }, { x: 10, y: 10 })).toEqual([{ x: 10, y: 10 }])
  })
})

describe('righeLista', () => {
  it('elenca apparecchiature, accessori e valvole ordinati per codice', () => {
    const scheda = makeScheda({
      serbatoi: [makeSerbatoio({ valvole_aggiuntive: [makeValvola()] })],
      essiccatori: [],
      scambiatori: [],
      filtri: [],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
    })
    const layout = layoutSchema(
      buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })
    )

    expect(righeLista(layout).map((r) => (r.sinistra as { codice: string }).codice)).toEqual([
      'C1',
      'C1.1',
      'C1.2',
      'S1',
      'S1.1',
      'S1.2',
    ])
  })

  it('numera i codici in modo naturale, non lessicografico', () => {
    const scheda = makeScheda({
      compressori: Array.from({ length: 3 }, (_, i) =>
        makeCompressore({ codice: `C${i + 1}`, ha_disoleatore: false })
      ),
      disoleatori: [],
      serbatoi: Array.from({ length: 2 }, (_, i) => makeSerbatoio({ codice: `S${i + 1}` })),
      essiccatori: [],
      scambiatori: [],
      filtri: [],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
    })
    const layout = layoutSchema(
      buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })
    )

    expect(righeLista(layout).map((r) => (r.sinistra as { codice: string }).codice)).toEqual([
      'C1',
      'C2',
      'C3',
      'S1',
      'S1.1',
      'S2',
      'S2.1',
    ])
  })

  // L'ordine alfabetico metterebbe E1 prima di F1 e SEP1 in fondo, scollegando la lista dalla
  // sequenza in cui il disegno attraversa le apparecchiature.
  it('segue il flusso dell’aria e non l’alfabeto', () => {
    const scheda = makeScheda({
      compressori: [makeCompressore({ ha_disoleatore: false })],
      disoleatori: [],
      serbatoi: [makeSerbatoio()],
      essiccatori: [makeEssiccatore({ ha_scambiatore: false })],
      scambiatori: [],
      filtri: [makeFiltro({ codice: 'F1', tipo: 'PREFILTRO' })],
      separatori: [makeSeparatore({ codice: 'SEP1' })],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'separatore' }),
    })
    const layout = layoutSchema(
      buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })
    )

    expect(righeLista(layout).map((r) => (r.sinistra as { codice: string }).codice)).toEqual([
      'C1',
      'S1',
      'S1.1',
      'F1',
      'E1',
      'SEP1',
    ])
  })
})

describe('legenda dei simboli', () => {
  function descrizioni(layout: Parameters<typeof righeLegenda>[0]) {
    return righeLegenda(layout).map((r) => r.descrizione)
  }

  function layoutCon(opzioni: { condense: boolean; essiccatore: boolean }) {
    const scheda = makeScheda({
      compressori: [makeCompressore({ ha_disoleatore: false })],
      disoleatori: [],
      serbatoi: [makeSerbatoio()],
      essiccatori: opzioni.essiccatore ? [makeEssiccatore()] : [],
      scambiatori: [],
      filtri: [],
      dati_impianto: makeDatiImpianto({
        raccolta_condense: opzioni.condense ? 'tanica' : 'Nessuna',
      }),
    })
    return layoutSchema(buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } }))
  }

  it('elenca i simboli presenti, nell’ordine stabilito', () => {
    expect(descrizioni(layoutCon({ condense: true, essiccatore: true }))).toEqual([
      'Valvola di intercettazione',
      'Valvola di scarico',
      'Tubazione rigida',
      'Tubazione flessibile',
      'Linea condense',
    ])
  })

  it('tace sulla linea condense quando l’impianto non ne ha', () => {
    expect(descrizioni(layoutCon({ condense: false, essiccatore: true }))).not.toContain('Linea condense')
  })

  it('nomina la direzione del flusso solo se una freccia è stata posata', () => {
    const layout = layoutCon({ condense: false, essiccatore: true })
    expect(descrizioni(layout)).not.toContain('Direzione del flusso')

    layout.archi[0].segni = [{ id: 'F1', tipo: 'freccia_direzione', t: 0.5 }]
    expect(descrizioni(layout)).toContain('Direzione del flusso')
  })

  it('nomina anche i tipi che entrano da un cambio, non solo quelli degli archi', () => {
    // 'condensa' e non 'flessibile': questo impianto ha gia' una mandata flessibile, e con quella
    // la prima asserzione passerebbe senza discriminare nulla.
    const layout = layoutCon({ condense: false, essiccatore: true })
    expect(descrizioni(layout)).not.toContain('Linea condense')

    layout.archi[0].segni = [
      { id: 'V1', tipo: 'valvola_intercettazione', t: 0.5, stileAValle: 'condensa' },
    ]
    expect(descrizioni(layout)).toContain('Linea condense')
  })

  it('mette la valvola di scarico solo se un simbolo la disegna davvero', () => {
    // La disegnano serbatoio, essiccatore e filtro. NON il separatore («scarica da un codolo
    // nudo») e non il compressore: il commento in testa a types.ts diceva il contrario, ed è
    // il commento a sbagliare.
    const conSerbatoio = layoutCon({ condense: false, essiccatore: false })
    expect(descrizioni(conSerbatoio)).toContain('Valvola di scarico')

    const soloSeparatore: typeof conSerbatoio = {
      ...conSerbatoio,
      nodi: conSerbatoio.nodi.map((n) =>
        n.tipo === 'serbatoio' ? { ...n, tipo: 'separatore' as const, orientamento: undefined } : n
      ),
    }
    expect(descrizioni(soloSeparatore)).not.toContain('Valvola di scarico')
  })

  it('non ripete la valvola di sicurezza, che ha già la sua riga con codice', () => {
    const scheda = makeScheda({
      compressori: [makeCompressore({ ha_disoleatore: false })],
      disoleatori: [],
      serbatoi: [makeSerbatoio({ valvola_sicurezza: makeValvola() })],
      essiccatori: [],
      scambiatori: [],
      filtri: [],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
    })
    const layout = layoutSchema(
      buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })
    )

    expect(righeLista(layout).some((r) => r.descrizione.startsWith('Valvola di sicurezza'))).toBe(true)
    expect(descrizioni(layout)).not.toContain('Valvola di sicurezza')
  })

  it('la cella di sinistra porta un simbolo, non un codice', () => {
    const righe = righeLegenda(layoutCon({ condense: true, essiccatore: true }))
    expect(righe.every((r) => 'simbolo' in r.sinistra)).toBe(true)
    expect(righeLista(layoutCon({ condense: true, essiccatore: true })).every((r) => 'codice' in r.sinistra)).toBe(true)
  })

  it('il campione del flessibile è ondulato come il tubo che rappresenta', () => {
    const riga = righeLegenda(layoutCon({ condense: true, essiccatore: true })).find(
      (r) => r.descrizione === 'Tubazione flessibile'
    )!
    expect((riga.sinistra as { simbolo: string }).simbolo).toContain('Q ')
  })

  it('la tabella disegna la legenda sotto le apparecchiature e la viewBox la contiene', () => {
    const layout = layoutCon({ condense: true, essiccatore: true })
    const svg = renderSvg(layout)

    expect(svg).toContain('Valvola di intercettazione')
    expect(svg).toContain('Tubazione flessibile')

    const legenda = righeLegenda(layout)
    const righeTotali = righeLista(layout).length + legenda.length
    expect(legenda.length).toBeGreaterThan(0)

    // Righe della tabella: rettangoli alti quanto una riga. L'ascissa non è più il margine fisso
    // — dal 17-08-2026 la tabella si stringe al contenuto e si centra sul disegno — quindi si
    // riconoscono dall'altezza, che è ciò che le distingue davvero.
    const quote = [...svg.matchAll(/<rect x="[\d.]+" y="([\d.]+)" width="[\d.]+" height="34"/g)].map((m) =>
      Number(m[1])
    )
    // Intestazione più una riga per voce, legenda compresa.
    expect(quote).toHaveLength(righeTotali + 1)

    // Il fondo dell'ultima riga dev'essere dentro la viewBox. Il confronto con una soglia
    // (`altezza > 34 × righeTotali`) non discriminava: con questa fixture valeva 374 contro
    // un'altezza vera di ~1050, e sarebbe stata vera anche calcolando l'altezza sulle sole
    // `righeLista` — cioè proprio il difetto da coprire, che lascia le righe di legenda fuori
    // dalla tela e le fa sparire dal PNG.
    const altezza = Number(svg.match(/height="(\d+(?:\.\d+)?)"/)![1])
    expect(Math.max(...quote) + 34).toBeLessThanOrEqual(altezza)
  })
})

describe('righeLegenda — riduttore di pressione', () => {
  function layoutConSegno(segni: SchemaSegnoTubo[]) {
    const scheda = makeScheda({
      compressori: [makeCompressore({ ha_disoleatore: false })],
      disoleatori: [],
      serbatoi: [makeSerbatoio()],
      essiccatori: [],
      scambiatori: [],
      filtri: [],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
    })
    const layout = layoutSchema(buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } }))
    layout.archi[0].segni = segni
    return layout
  }

  it('compare solo se il disegno ha davvero un riduttore', () => {
    const senza = layoutConSegno([{ id: 'v1', tipo: 'valvola_intercettazione', t: 0.5 }])
    const con = layoutConSegno([{ id: 'r1', tipo: 'riduttore_pressione', t: 0.5 }])

    expect(righeLegenda(senza).map((r) => r.descrizione)).not.toContain('Riduttore di pressione')
    expect(righeLegenda(con).map((r) => r.descrizione)).toContain('Riduttore di pressione')
  })

  it('la valvola di intercettazione in legenda guarda i segni veri, non lo stile dell’arco', () => {
    // Prima di questo blocco la riga compariva per ogni arco standard/flessibile: da qui in
    // poi la valvola è un segno che l'utente può togliere, e se l'ha tolta la legenda non
    // deve promettere un simbolo che il disegno non ha più.
    const senzaValvole = layoutConSegno([])
    expect(righeLegenda(senzaValvole).map((r) => r.descrizione)).not.toContain('Valvola di intercettazione')
  })
})

describe('testi liberi', () => {
  function layoutConTesti(testi: { id: string; x: number; y: number; contenuto: string }[]) {
    const scheda = makeScheda({
      compressori: [makeCompressore({ ha_disoleatore: false })],
      disoleatori: [],
      serbatoi: [makeSerbatoio({ orientamento: 'ORIZZONTALE' })],
      essiccatori: [],
      scambiatori: [],
      filtri: [],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
    })
    const layout = layoutSchema(buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } }))
    return { ...layout, testi }
  }

  it('li disegna nel documento, con gli a-capo', () => {
    const svg = renderSvg(layoutConTesti([{ id: 'T1', x: 300, y: 400, contenuto: 'Linea azoto\nal reparto 2' }]))
    expect(svg).toContain('>Linea azoto</tspan>')
    expect(svg).toContain('>al reparto 2</tspan>')
  })

  it('non entrano né in lista apparecchiature né in legenda', () => {
    const svg = renderSvg(layoutConTesti([{ id: 'T1', x: 300, y: 400, contenuto: 'Nota di prova' }]))
    const tabella = svg.slice(svg.indexOf('LISTA APPARECCHIATURE'))
    expect(tabella).not.toContain('Nota di prova')
  })

  it('un layout senza testi resta identico a prima', () => {
    // Confronto con un riferimento ESTERNO (l'SVG dello stesso impianto, reso dal codice del
    // commit 7a7bfb0, l'ultimo prima del Task 7 del Blocco C2 — vedi il commento in
    // fixtures/svgRiferimentoSenzaTesti.ts), non con se stesso: `renderSvg(x) === renderSvg(x)` (la
    // versione precedente di questo test, `testi: []` contro `testi: undefined`) passa sempre,
    // qualunque cosa aggiunga `renderSvg` a OGNI documento — l'ha dimostrato la revisione
    // prefissando un `<g id="annotazioni"></g>` costante a ogni SVG: il test restava verde. Solo
    // un riferimento congelato a un punto nel tempo lo scopre.
    expect(renderSvg(layoutConTesti([]))).toBe(SVG_RIFERIMENTO_SENZA_TESTI)
  })

  it('si disegnano dopo nodi e tubazioni, così una scritta posata su un tubo resta leggibile', () => {
    // In SVG chi viene disegnato dopo sta sopra: se le annotazioni finissero prima di nodi e
    // tubazioni nella stringa concatenata, un tubo o un simbolo posati sullo stesso punto
    // coprirebbero la scritta. Niente in questo test lo impedirebbe se non l'ordine delle
    // sottostringhe: `stroke-dasharray="10 7"` è il codolo del terminale utenze, l'ultimo pezzo
    // di disegno emesso prima dei nodi (fino al 17-08-2026 qui si usava `marker-end`, che ogni
    // tratto portava in coda e che non esiste più),
    // `<circle cx="60" cy="60"` è la girante del compressore (unico nodo di questa fixture,
    // centrata sul riquadro 120×120 — 60,60, non più 64,5/64,5 su 129×129, Task 8, Blocco 3).
    const svg = renderSvg(layoutConTesti([{ id: 'T1', x: 300, y: 400, contenuto: 'Sopra il tubo' }]))
    const indiceTubo = svg.indexOf('stroke-dasharray="10 7"')
    const indiceNodo = svg.indexOf('<circle cx="60" cy="60"')
    const indiceTesto = svg.indexOf('>Sopra il tubo</tspan>')
    expect(indiceTubo).toBeGreaterThan(-1)
    expect(indiceNodo).toBeGreaterThan(-1)
    expect(indiceTesto).toBeGreaterThan(-1)
    expect(indiceTesto).toBeGreaterThan(indiceTubo)
    expect(indiceTesto).toBeGreaterThan(indiceNodo)
  })
})

describe('riferimento SVG del TEE', () => {
  function layoutConTee(): ReturnType<typeof layoutSchema> {
    const scheda = makeScheda({
      compressori: [makeCompressore({ ha_disoleatore: false })],
      disoleatori: [],
      serbatoi: [makeSerbatoio({ orientamento: 'ORIZZONTALE' })],
      essiccatori: [],
      scambiatori: [],
      filtri: [],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
    })
    const layout = layoutSchema(
      buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })
    )
    const s1 = layout.nodi.find((n) => n.id === 'S1')!
    const utenze = layout.nodi.find((n) => n.tipo === 'utenze')!
    const arcoUtenze = layout.archi.find((a) => a.a.nodo === utenze.id)!
    const pDa = posizioneAncora(s1, arcoUtenze.da.ancora)
    const pA = posizioneAncora(utenze, arcoUtenze.a.ancora)

    // Un TEE inserito a metà del tubo S1 -> UTENZE, come farebbe il gesto di trascinamento
    // (`inserimentoTee.ts`) su un tratto esistente: due tubi lo toccano da lati opposti
    // (sx/dx), il minimo che eserciti sia il raggio del pallino sia la convergenza dei capi
    // al centro del riquadro 20×20 (24×24 prima del Task 8, Blocco 3 — l'offset -10 porta
    // ancora il CENTRO del riquadro, non più il vecchio -12, sul punto voluto).
    const giunzione: SchemaNodoPosizionato = {
      id: 'M-G1',
      tipo: 'giunzione',
      etichetta: 'Giunzione',
      gruppo: 'LINEA_DISTRIBUZIONE',
      valvoleSicurezza: [],
      origine: 'manuale',
      x: (pDa.x + pA.x) / 2 - 10,
      y: pDa.y - 10,
    }
    layout.nodi.push(giunzione)
    layout.archi = layout.archi.filter((a) => a.id !== arcoUtenze.id)
    layout.archi.push(
      { id: 'tee-1', da: arcoUtenze.da, a: { nodo: giunzione.id, ancora: 'sx' }, stile: 'standard' },
      { id: 'tee-2', da: { nodo: giunzione.id, ancora: 'dx' }, a: arcoUtenze.a, stile: 'standard' }
    )
    return layout
  }

  // Riferimento ESTERNO al codice corrente, non un self-comparison: `renderSvg(x) === renderSvg(x)`
  // non discrimina nulla. Fissa la geometria del TEE — pallino al centro del riquadro e tubi che
  // vi convergono — che senza di questo nessun test del documento vede.
  it('un impianto con un TEE resta identico al riferimento', () => {
    expect(renderSvg(layoutConTee())).toBe(SVG_RIFERIMENTO_CON_TEE)
  })
})

/**
 * Il passaggio dalla porta ESTERNA (`layoutSchema` + `renderSvg`), non dalle sei porte del
 * registro (`ancoreDi`/`dimensioniDi`/...) direttamente: è nel salto fra la funzione interna e
 * la firma pubblica che un chiamante rimasto indietro sfuggirebbe a TypeScript, perché il tipo
 * del parametro (`Tarature`) non cambia se qualcuno lo dimentica — resta valido con `{}`. Vedi
 * il commento di testa a `symbols/index.ts` sul Blocco 3.
 */
describe('libreria delle tarature', () => {
  // Una tanica: il simbolo più semplice del registro (un rettangolo con un solo codice dentro,
  // una sola ancora), quindi la taratura che la scala/trasla non lascia dubbi su cosa sia
  // cambiato nell'SVG.
  function schedaConTanica() {
    return makeScheda({ dati_impianto: makeDatiImpianto({ raccolta_condense: 'tanica' }) })
  }

  it('una taratura passata a renderSvg arriva fino al disegno', () => {
    const tarata: Tarature = {
      tanica: { dx: 0, dy: 0, sx: 2, sy: 1, ancore: [{ id: 'alto-in', x: 80, y: 0, accetta: ['condensa'] }] },
    }
    const modello = buildSchemaModel({
      scheda: schedaConTanica(),
      collegamentiCompressoriSerbatoi: { C1: ['S1'] },
    })
    const layout = layoutSchema(modello, tarata)
    expect(renderSvg(layout, tarata)).not.toBe(renderSvg(layoutSchema(modello)))
  })

  /**
   * Fix round 1 (revisione): il test sopra non inchioda `layoutSchema` — con `sx: 2, sy: 1` la
   * tanica non ha altri nodi nella propria riga (`disponiInRiga` la posiziona da sola) e la sua
   * altezza non cambia, quindi NESSUNA `x`/`y` di `layout.nodi` si sposta: la differenza fra i
   * due `renderSvg` è tutta nel disegno (`simboloDi`/`ancoreDi`), non nel layout. Una `libreria`
   * ombreggiata dentro `layoutSchema` (mai propagata a `disponiInRiga`) avrebbe fatto passare
   * comunque quel test. Qui la taratura cambia anche `sy` (l'altezza, non solo la larghezza):
   * `disponiInRiga` allinea la tanica al centro della corsia condense sulla sua altezza vera
   * (`quota - dim.altezza / 2`), quindi un'altezza diversa sposta la sua `y` — un'asserzione
   * sulle POSIZIONI, non sull'SVG.
   */
  it('una taratura passata a layoutSchema sposta le posizioni dei nodi', () => {
    const tarata: Tarature = {
      tanica: { dx: 0, dy: 0, sx: 2, sy: 2, ancore: [{ id: 'alto-in', x: 80, y: 0, accetta: ['condensa'] }] },
    }
    const modello = buildSchemaModel({
      scheda: schedaConTanica(),
      collegamentiCompressoriSerbatoi: { C1: ['S1'] },
    })
    const nodoTarato = layoutSchema(modello, tarata).nodi.find((n) => n.tipo === 'tanica')!
    const nodoBase = layoutSchema(modello).nodi.find((n) => n.tipo === 'tanica')!
    expect(nodoTarato.y).not.toBe(nodoBase.y)
  })
})
