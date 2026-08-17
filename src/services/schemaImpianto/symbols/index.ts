/**
 * Libreria dei simboli, ricalcata sui blocchi AutoCAD in `DOCUMENTAZIONE/relazione/Blocchi.pdf`.
 *
 * Ogni simbolo è una funzione pura che produce un frammento SVG in coordinate locali
 * (origine in alto a sinistra del riquadro dichiarato in `REGISTRO_SIMBOLI`): il render
 * statico li concatena, l'editor li riusa dentro i custom node di react-flow, così il
 * disegno è lo stesso nelle due modalità.
 *
 * Convenzioni grafiche del CAD di riferimento: solo tratto nero su fondo bianco, nessun
 * riempimento colorato, spessore uniforme.
 *
 * Ingombri e ancore vivono qui, non in `layout.ts`: nascono dalla stessa geometria che
 * disegna i simboli, quindi il registro (`REGISTRO_SIMBOLI`) è la fonte unica e `layout.ts`
 * si limita a riesportare `DIMENSIONI_NODO` per i consumatori esistenti.
 */
import { ondula } from '../tratti'
import type { SchemaArcoStile, SchemaNodoTipo, SchemaNodo, SchemaAncora, SchemaLatoAncora, ChiaveSimbolo } from '../types'
import { chiaveSimbolo } from '../types'
import type { Tarature, TaraturaSimbolo } from '../libreria'
import { taraturaDi } from '../libreria'

export const TRATTO = 2
/**
 * Tratteggio delle linee condense, unica fonte per il documento e per la tela dell'editor.
 * Fino al Blocco D4 il numero era scritto due volte con due valori diversi ('10 7' qui, '8 6' in
 * SchemaEdgeTubazione.tsx): finche' la tela era nera la differenza non si notava, su fondo bianco
 * il confronto con l'anteprima e' immediato. Non e' il tratteggio del codolo del terminale utenze
 * (`simboloUtenze`), che vuol dire un'altra cosa ed e' rimasto a '10 7' — il valore che questa
 * costante aveva fino al Task 13, e con cui non coincide piu'.
 *
 * '7 10' (Task 13, Blocco 3), non più '10 7': il blocco CAD `linea-condense` (Blocchi.pdf) non
 * disegna un dash-array nativo — la tratteggia con dieci trattini separati, letti uno per uno
 * (`page.get_drawings()`, coordinate assolute) — dash ≈3,2pt, passo fra un trattino e il
 * successivo ≈8,0pt, quindi gap ≈4,8pt: rapporto dash:gap ≈ 3,2:4,8 = 2:3, l'ESATTO opposto di
 * '10 7' (dash più lungo del gap, ≈1,43:1). Somma invariata (17→17, qui 7+10) per continuità di
 * scala: cambia solo quale dei due numeri è il dash e quale il gap.
 */
export const TRATTEGGIO_CONDENSE = '7 10'
/**
 * Tratteggio della verticale interna del filtro (`simboloRombo`, segno `verticale-tratteggiata`).
 * Rapporto dash:gap fra 3:1 e 4:1, misurato sui quattro trattini che il blocco CAD `filtro`
 * disegna fra il vertice alto del rombo e il tratto orizzontale basso: 4,98 / 6,42 / 6,36 / 4,98pt
 * — i due centrali più lunghi dei due esterni — su gap di 1,62pt esatti, cioè da 3,07 a 3,96 volte
 * il gap (media ≈3,5). '8 2' è la cifra tonda di quella famiglia, non la misura di un trattino in
 * particolare. Non è `TRATTEGGIO_CONDENSE` (7 10, rapporto ≈0,7:1): è un segno diverso,
 * con un ritmo diverso — usare lo stesso tratteggio dei due li renderebbe indistinguibili se mai
 * comparissero nello stesso disegno.
 */
export const TRATTEGGIO_FILTRO = '8 2'
/**
 * Esportato perché non lo usa solo l'SVG: l'editor rende le annotazioni libere in HTML sulla
 * tela (TestiLiberi.tsx) e deve usare lo STESSO carattere del documento, non una seconda
 * dichiarazione uguale che nessuno terrebbe allineata a questa.
 */
export const FONT = 'Arial, Helvetica, sans-serif'

/**
 * Spazio sopra il corpo dei serbatoi, riservato alla valvola di sicurezza e alla sua sigla: nel
 * blocco CAD, verticale e orizzontale, la valvola sta sempre appena sopra il corpo, mai di fianco
 * (vedi `cad-serbatoio-verticale.png`/`cad-serbatoio-orizzontale.png`, Task 1).
 *
 * NON è la sola estensione della valvola misurata sul CAD: quella è misurabile — valvola 9,4pt
 * sopra il corpo, scarico 10,1pt sotto, ~19,5pt in totale, la stessa cifra nei due orientamenti
 * — e vale ~0,43 rombi, ~47 unità qui, non 40. La differenza è che nel blocco CAD la SIGLA della
 * valvola (`S1.1`) è un testo separato, posato sulla pagina fuori dal riquadro del blocco; qui
 * invece è disegnata dentro il riquadro del nodo (`simboloSerbatoio`, la linea/quadratino/sigla
 * sopra il corpo), che deve contenerla per intero o verrebbe tagliata nell'editor e nel PNG. 40
 * è quindi la cifra che il file aveva già per il verticale prima del Task 4 (non toccata, perché
 * dà margine sufficiente alla sigla — verificato nel confronto visivo), condivisa ora da entrambi
 * gli orientamenti invece di un centraggio diverso per ciascuno: una scelta di leggibilità di
 * questo editor, non la misura del CAD (fix round 1, revisione: il test sul rapporto del
 * serbatoio orizzontale non usa più questa costante come bersaglio, per non restare tautologico
 * — vedi `simboli.test.ts`).
 *
 * Esportata perché non la legge solo `simboloSerbatoio`: `corpoNodo` (layout.ts), il riquadro a
 * cui le tubazioni si attaccano davvero, disegna la stessa geometria e deve restare d'accordo con
 * questa, o le tubazioni si staccherebbero dal simbolo che l'utente vede.
 */
export const MARGINE_VALVOLA_SERBATOIO = 40

/**
 * Corpo dei serbatoi (la sola capsula, non il riquadro con valvola e scarico), misurato isolando
 * i tracciati del corpo sul blocco CAD `Blocchi.pdf` (script `scripts/blocchi-cad.py`, misura
 * manuale a mano sui sotto-elementi del gruppo: il rettangolo pieno del gruppo comprende anche la
 * valvola di sicurezza sopra e lo scarico sotto — l'avvertenza del Task 4):
 * - verticale: capsula da y=203,78pt a y=310,46pt, larga 42,72pt (x=438,12→480,84) → 0,94×2,34
 *   rombi (rombo = larghezza del blocco `essiccatore`, 45,54pt, la base comune misurata da
 *   `blocchi-cad.py --misure`);
 * - orizzontale: capsula da x=432,84pt a x=561,36pt, alta 40,02pt (y=390,20→430,22) → 2,82×0,88
 *   rombi.
 * Il rombo dell'editor è largo 110 unità (`essiccatore` qui sotto): le due capsule sono quelle
 * proporzioni scalate a quell'unità, poi arrotondate (Task 8, Blocco 3) ai multipli di 10 (di 20
 * per la larghezza, che `simboloSerbatoio` dimezza per il raggio delle calotte): le ancore dei
 * fianchi nascono dove le calotte — semicerchi di raggio metà larghezza — incontrano il
 * cilindro, quindi cadono sulla griglia da sole quando lo fa la sagoma; senza arrotondare
 * uscivano a quote come 91,5 e 246,5. Scarto dal rapporto CAD entro il decimo su ogni asse
 * (0,94→0,91 e 2,34→2,36 sul verticale; 2,82 invariato e 0,88→0,91 sull'orizzontale).
 */
const CORPO_SERBATOIO_VERTICALE = { larghezza: 100, altezza: 260 } // 0,91×110 e 2,36×110
const CORPO_SERBATOIO_ORIZZONTALE = { larghezza: 310, altezza: 100 } // 2,82×110 e 0,91×110

/**
 * Ingombro del serbatoio orizzontale: un riquadro proprio, non `DIMENSIONI.serbatoio` (quello del
 * verticale). Prima del Task 4 i due condividevano lo stesso oggetto — la sagoma orizzontale
 * finiva quindi disegnata dentro un riquadro alto quanto il verticale, con due terzi di tela
 * vuota sopra e sotto il corpo (vedi il commento su `simboloSerbatoio`).
 */
const DIMENSIONI_SERBATOIO_ORIZZONTALE = {
  larghezza: CORPO_SERBATOIO_ORIZZONTALE.larghezza,
  altezza: CORPO_SERBATOIO_ORIZZONTALE.altezza + MARGINE_VALVOLA_SERBATOIO,
}

/** Ingombri per tipo, in unità SVG: le funzioni di disegno vi leggono `larghezza`/`altezza`. */
const DIMENSIONI: Record<SchemaNodoTipo, { larghezza: number; altezza: number }> = {
  // 129 = 1,17×110 (rombo), misurato sul blocco CAD `compressore` (53,40×53,34pt su un rombo di
  // 45,54pt): un quadrato, non più 160×150 (Task 4). Arrotondato a 120 = 1,09×110 (Task 8,
  // Blocco 3): le due ancore (centro dell'orlo superiore/inferiore) leggono `larghezza/2`, che
  // cade sulla griglia solo se `larghezza` è multiplo di 20 — 129 non lo è, 120 sì. Scarto dal
  // rapporto CAD entro il decimo (1,17→1,09, 6,97%).
  compressore: { larghezza: 120, altezza: 120 },
  serbatoio: {
    larghezza: CORPO_SERBATOIO_VERTICALE.larghezza,
    altezza: CORPO_SERBATOIO_VERTICALE.altezza + MARGINE_VALVOLA_SERBATOIO,
  },
  essiccatore: { larghezza: 110, altezza: 110 },
  filtro: { larghezza: 110, altezza: 110 },
  separatore: { larghezza: 110, altezza: 110 },
  // 86×43 = 0,78×110 e 0,39×110, misurato sul blocco CAD `tanica` (35,52×17,76pt su un rombo di
  // 45,54pt, rapporto 2:1 esatto: 35,52 = 2×17,76). Non ha valvola né scarico da isolare (Task 4,
  // avvertenza): la misura grezza è già il corpo. Arrotondato a 80×40 = 0,73×110 e 0,36×110
  // (Task 8, Blocco 3): l'unica ancora legge `larghezza/2`, che vuole `larghezza` multiplo di
  // 20 — 86 non lo è, 80 sì; l'altezza segue lo stesso 2:1 del CAD. Scarto entro il decimo
  // (0,78→0,73 e 0,39→0,36, ~6,8% su entrambi gli assi).
  tanica: { larghezza: 80, altezza: 40 },
  // 129×129 = 1,17×110, misurato sul blocco CAD `pacco-bombole` (53,40×53,40pt su un rombo di
  // 45,54pt): un quadrato, come il compressore (Task 4). Nessun accessorio da isolare.
  // Arrotondato a 120×120 come il compressore (Task 8, Blocco 3, stessa misura CAD, stesso
  // vincolo sull'ancora `dx`: y legge `altezza/2`, che vuole `altezza` multiplo di 20).
  pacco_bombole: { larghezza: 120, altezza: 120 },
  utenze: { larghezza: 190, altezza: 120 },
  // 24 → 20 (Task 8, Blocco 3): le quattro ancore coincidono nel centro (`larghezza/2`), che
  // cade sulla griglia solo se `larghezza` è multiplo di 20. Non è una misura CAD (la giunzione
  // è un segnaposto, vedi `simboloGiunzione`): 20 resta ampiamente più largo del pallino
  // (`DIAMETRO_GIUNZIONE`), la sola cosa che deve contenere.
  giunzione: { larghezza: 20, altezza: 20 },
}

/** Testo: `x`/`y` sono il centro, o il capo iniziale/finale se `ancora` lo dice. */
function testo(
  x: number,
  y: number,
  contenuto: string,
  dimensione = 20,
  ancora: 'middle' | 'start' | 'end' = 'middle'
): string {
  return `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${dimensione}" text-anchor="${ancora}" dominant-baseline="central" fill="#000">${escapeXml(contenuto)}</text>`
}

/**
 * Interlinea, in multipli del corpo del carattere. Sotto 1,2 le righe si toccano nei glifi
 * discendenti; molto sopra, il blocco di testo si sfilaccia e non si legge più come un'unità.
 */
export const INTERLINEA_TESTO = 1.25

/**
 * Testo che va a capo sugli `\n`. Un `<text>` SVG non manda a capo da sé — un `\n` dentro il
 * contenuto verrebbe reso come uno spazio — quindi ogni riga è un `<tspan>` con la propria
 * ascissa e ordinata, incolonnate sulla stessa `x`.
 *
 * `x`/`y` sono il primo capo della PRIMA riga (o il suo centro, secondo `ancora`): le righe
 * successive scendono. Chi calcola l'ingombro di un testo deve quindi tenere conto che il
 * blocco cresce verso il basso — `dimensioniDi`, per il terminale utenze, è dove questo calcolo
 * vive.
 *
 * Due consumatori: il terminale utenze (`simboloUtenze`), il primo in questo repo, e le
 * annotazioni libere (`renderTestiLiberi`, renderSvg.ts), che l'editor permette di posare sul
 * disegno. `testo()` resta il disegno di tutto ciò che è a riga singola: codici, etichette,
 * tabella.
 */
export function testoMultiRiga(
  x: number,
  y: number,
  contenuto: string,
  dimensione = 20,
  ancora: 'middle' | 'start' | 'end' = 'middle'
): string {
  const righe = contenuto.split('\n')
  const tspan = righe
    .map((riga, i) => `<tspan x="${x}" y="${y + i * dimensione * INTERLINEA_TESTO}">${escapeXml(riga)}</tspan>`)
    .join('')
  return `<text font-family="${FONT}" font-size="${dimensione}" text-anchor="${ancora}" dominant-baseline="central" fill="#000">${tspan}</text>`
}

export function escapeXml(valore: string): string {
  return valore
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function traccia(d: string): string {
  return `<path d="${d}" fill="none" stroke="#000" stroke-width="${TRATTO}" stroke-linecap="round" />`
}

/**
 * Valvola di sicurezza: quadratino con tratteggio orizzontale, posato sopra il recipiente
 * che protegge. `x`/`y` sono il centro del simbolo.
 */
export function valvolaSicurezza(x: number, y: number): string {
  const lato = 12
  const mezzo = lato / 2
  const righe = [-3, 0, 3]
    .map((dy) => `M ${x - mezzo} ${y + dy} L ${x + mezzo} ${y + dy}`)
    .join(' ')
  return [
    `<rect x="${x - mezzo}" y="${y - mezzo}" width="${lato}" height="${lato}" fill="none" stroke="#000" stroke-width="${TRATTO}" />`,
    traccia(righe),
  ].join('')
}

/**
 * Semiasse orizzontale (apice-base, lungo il tubo) di un'ala di farfalla, in unità del semiasse
 * verticale (`h` di quell'ala): rapporto l:h = 2:1, misurato isolando il gruppo CAD «valvole»
 * (Blocchi.pdf, script `scripts/blocchi-cad.py`) — l'icona «Valvola di intercettazione» è un
 * quad 11,22×5,58pt (apice-base 5,61, mezza-base 2,79, 5,61/2,79 ≈ 2,01) e l'ala grande del
 * gruppo «riduttore» (sotto) misura 5,64×5,64pt (apice-base 5,64, mezza-base 2,82, rapporto
 * identico entro l'1%). Prima di questo task l=9/h=8 (rapporto 1,125): una farfalla troppo
 * alta e stretta, non la sagoma bassa e larga che il CAD disegna.
 */
const RAPPORTO_ALA_FARFALLA = 2

/**
 * Valvola di intercettazione: farfalla con l'asse lungo la tubazione. Su un montante va
 * ruotata: nel blocco CAD la farfalla è sempre in linea col tubo, mai di traverso.
 *
 * `l=9` è ereditato dal codice precedente per continuità (nessuna misura CAD affidabile lo
 * fissa in assoluto, la stessa ambiguità di calibrazione già documentata su `valvolaScarico`);
 * `h=4,5` viene invece dal rapporto misurato (`RAPPORTO_ALA_FARFALLA`) applicato a quell'`l` —
 * prima era 8, quasi il doppio di quanto il CAD disegna.
 */
export function valvolaIntercettazione(
  x: number,
  y: number,
  orientamento: 'orizzontale' | 'verticale' = 'orizzontale'
): string {
  const l = 9
  const h = l / RAPPORTO_ALA_FARFALLA
  const d =
    orientamento === 'orizzontale'
      ? `M ${x - l} ${y - h} L ${x - l} ${y + h} L ${x} ${y} Z M ${x + l} ${y - h} L ${x + l} ${y + h} L ${x} ${y} Z`
      : `M ${x - h} ${y - l} L ${x + h} ${y - l} L ${x} ${y} Z M ${x - h} ${y + l} L ${x + h} ${y + l} L ${x} ${y} Z`
  // Il tubo passa SOTTO la valvola e il disegno tecnico vuole che si interrompa: invece di
  // spezzare la polilinea a una lunghezza d'arco data — matematica fragile sui flessibili, che
  // non sono polilinee ma onde di curve quadratiche — la si copre con un rettangolo bianco
  // grande esattamente quanto la farfalla. Va PRIMA dei tratti, o coprirebbe la farfalla stessa.
  // Copre tutto cio' che ha sotto, non solo il tubo: e' il motivo per cui non e' un'unita' piu'
  // grande dell'ingombro.
  const [larghezza, altezza] = orientamento === 'orizzontale' ? [l, h] : [h, l]
  const copertura = `<rect x="${x - larghezza}" y="${y - altezza}" width="${larghezza * 2}" height="${altezza * 2}" fill="#fff" stroke="none" />`
  return copertura + traccia(d)
}

/**
 * Riduttore di pressione: la STESSA farfalla della valvola di intercettazione, ma con un'ala
 * ridotta — non uno stelo di regolazione aggiunto sopra. Fino a questo task il commento diceva
 * «simbolo segnaposto... non un blocco CAD del committente»: falso, ed è la terza volta in
 * questo blocco che un commento dichiara assente qualcosa che nel CAD c'era (le prime due, Task
 * 4: pacco bombole e compressore-disoleatore) — il blocco esiste (`riduttore` in `NOMI`,
 * `scripts/blocchi-cad.py`), con l'etichetta «Riduttore di pressione» accanto (letta con
 * `page.get_text("words")`, non solo dedotta dall'ordine).
 *
 * Isolando i tracciati del gruppo (coordinate assolute, non solo il bounding box): due triangoli
 * che condividono l'apice — (452,58; 1034,72) per entrambi — non un bowtie simmetrico. Il primo,
 * (446,94; 1031,90)-(446,94; 1037,54), è 5,64×5,64pt: apice-base 5,64, mezza-base 2,82, lo
 * STESSO rapporto 2:1 (`RAPPORTO_ALA_FARFALLA`) e la STESSA misura assoluta (entro l'1%)
 * dell'ala della valvola di intercettazione. Il secondo, (455,94; 1033,04)-(455,94; 1036,40), è
 * 3,36×3,36pt: rapporto fra le due ali 3,36/5,64 = 0,596 ≈ 0,60 — è questo, non uno stelo, a
 * distinguere il riduttore dalla valvola nel disegno del committente.
 *
 * Convenzione di orientamento (non misurabile dal CAD, che non instrada tubi): l'ala grande
 * resta a sinistra/in alto e la piccola a destra/in basso, indipendentemente dal verso di
 * percorrenza del tubo — lo stesso limite di `valvolaIntercettazione`, che non conosce la
 * direzione del flusso.
 */
export function riduttorePressione(
  x: number,
  y: number,
  orientamento: 'orizzontale' | 'verticale' = 'orizzontale'
): string {
  const lGrande = 9 // stessa `l` della valvola di intercettazione (vedi il suo commento)
  const hGrande = lGrande / RAPPORTO_ALA_FARFALLA
  const SCALA_ALA_PICCOLA = 0.6 // 3,36/5,64 ≈ 0,596, misurato sul blocco CAD «riduttore»
  const lPiccola = lGrande * SCALA_ALA_PICCOLA
  const hPiccola = hGrande * SCALA_ALA_PICCOLA

  const d =
    orientamento === 'orizzontale'
      ? `M ${x - lGrande} ${y - hGrande} L ${x - lGrande} ${y + hGrande} L ${x} ${y} Z ` +
        `M ${x + lPiccola} ${y - hPiccola} L ${x + lPiccola} ${y + hPiccola} L ${x} ${y} Z`
      : `M ${x - hGrande} ${y - lGrande} L ${x + hGrande} ${y - lGrande} L ${x} ${y} Z ` +
        `M ${x - hPiccola} ${y + lPiccola} L ${x + hPiccola} ${y + lPiccola} L ${x} ${y} Z`

  // Copertura come in `valvolaIntercettazione`, ma qui l'ingombro NON è simmetrico rispetto al
  // centro (l'ala grande sporge più della piccola): i quattro margini (sinistra/destra o
  // sopra/sotto) vanno calcolati a parte invece di raddoppiare un solo [larghezza, altezza].
  // Orizzontale: l'ala grande sta a sinistra (margine `lGrande`) e la piccola a destra
  // (`lPiccola`); l'altezza è simmetrica sui due lati, dominata dall'ala grande (`hGrande` >
  // `hPiccola`). Verticale: stesso ragionamento con gli assi scambiati.
  const [xMeno, xPiu, yMeno, yPiu] =
    orientamento === 'orizzontale'
      ? [lGrande, lPiccola, hGrande, hGrande]
      : [hGrande, hGrande, lGrande, lPiccola]
  const copertura = `<rect x="${x - xMeno}" y="${y - yMeno}" width="${xMeno + xPiu}" height="${yMeno + yPiu}" fill="#fff" stroke="none" />`
  return copertura + traccia(d)
}

/**
 * Valvola di scarico: farfalla verticale con stelo. `x`/`y` al centro della farfalla.
 *
 * Il blocco CAD «valvole» (Blocchi.pdf) ne porta DUE misure, non una: quella sotto i serbatoi
 * è 4,44×8,94pt, quella sotto rombi e filtri 3,12×6,30pt — rapporto larghezza 3,12/4,44 = 0,70,
 * rapporto altezza 6,30/8,94 = 0,70 (stesso 0,70 su entrambi gli assi). Fino al Blocco 3 Task 3
 * un'unica misura (l=8, h=9) copriva i due casi, ed era più grande di entrambe — non solo della
 * più piccola. Il CAD mostra anche una farfalla molto più STRETTA di quella che questo codice
 * disegnava: rapporto larghezza:altezza ≈ 1:2 su entrambe le misure (3,12:6,30 e 4,44:8,94),
 * contro l'8:9 (quasi 1:1) di prima — non solo due misure diverse, una forma diversa.
 */
export function valvolaScarico(x: number, y: number, misura: 'serbatoio' | 'apparecchio'): string {
  // Base sul serbatoio: l:h = 4,5:9 = 1:2, il rapporto misurato sul blocco CAD — ma il 9
  // dell'altezza è ereditato dal codice precedente per continuità, non una misura in sé (il
  // solo modo di leggere una dimensione assoluta dal CAD è calibrarla su un tratto già disegnato
  // qui accanto, e il rombo di questo editor non è quadrato come quello del CAD: due tratti a
  // scelta danno due fattori di scala che divergono di un buon 25%). Rombi e filtri scalano al
  // 70% (il rapporto 0,70 misurato fra le due misure del blocco «valvole», questo sì confrontato
  // direttamente fra le due farfalle e quindi indipendente dalla calibrazione assoluta).
  const scala = misura === 'serbatoio' ? 1 : 0.7
  const l = 4.5 * scala
  const h = 9 * scala
  const stelo = 8 * scala
  return [
    traccia(
      `M ${x - l} ${y - h} L ${x + l} ${y - h} L ${x} ${y} Z M ${x - l} ${y + h} L ${x + l} ${y + h} L ${x} ${y} Z`
    ),
    traccia(`M ${x} ${y + h} L ${x} ${y + h + stelo}`),
  ].join('')
}

/**
 * Campione di tubazione per la legenda: un tratto orizzontale centrato sull'origine, reso con
 * lo stesso stile che `renderSvg` dà alla tubazione vera. Riusare qui la funzione che disegna
 * (`ondula`) invece di ridisegnare un'onda a mano è ciò che tiene campione e disegno d'accordo
 * per costruzione: un'onda «di legenda» diversa da quella dei tubi sarebbe una didascalia falsa.
 */
export function campioneTubazione(stile: SchemaArcoStile): string {
  const meta = 30
  const capi = [
    { x: -meta, y: 0 },
    { x: meta, y: 0 },
  ]
  if (stile === 'flessibile') {
    return `<path d="${ondula(capi)}" fill="none" stroke="#000" stroke-width="${TRATTO}" />`
  }
  const tratteggio = stile === 'condensa' ? ` stroke-dasharray="${TRATTEGGIO_CONDENSE}"` : ''
  return `<path d="M ${-meta} 0 L ${meta} 0" fill="none" stroke="#000" stroke-width="${TRATTO}"${tratteggio} />`
}

/**
 * Frazioni delle due corde della girante, in raggi (`raggio` = 1): misurate sul blocco CAD
 * `compressore` (Blocchi.pdf) isolando cerchio e segmenti — cerchio centro (455,13; 41,45)pt,
 * raggio 13,35pt; corda alta da (449,16; 29,60) a (466,68; 34,82)pt, corda bassa specchiata
 * sull'asse orizzontale del cerchio, da (449,16; 53,42) a (466,68; 48,20)pt. Relative al centro
 * e al raggio: capo sinistro a -0,45r (x) e ∓0,89r (y, sopra per la corda alta, sotto per la
 * bassa), capo destro a +0,87r (x) e ∓0,50r (y). Non è più un'unica diagonale passante per il
 * centro (quella disegnata fino al Blocco 3 Task 3): sono due corde separate, ciascuna dentro
 * la propria metà del cerchio, come nel blocco CAD.
 */
const CORDA_GIRANTE = { sx: -0.45, dx: 0.87, altoSx: -0.89, altoDx: -0.5 }

/**
 * Compressore: riquadro con la girante (cerchio tagliato da due corde oblique, non da un
 * diametro). Nel blocco CAD il codice sta in alto a sinistra sul filo del riquadro e la girante è
 * centrata; quando c'è il disoleatore la girante slitta a destra per fargli posto, il codice
 * passa a destra e a sinistra compaiono la valvola di sicurezza e il riquadro del disoleatore.
 */
export function simboloCompressore(nodo: SchemaNodo): string {
  const { larghezza, altezza } = DIMENSIONI.compressore
  const corpo = `<rect x="0" y="0" width="${larghezza}" height="${altezza}" fill="none" stroke="#000" stroke-width="${TRATTO}" />`
  // 0,25×larghezza: raggio 13,35pt su un riquadro 53,40pt largo nel blocco CAD (vedi il commento
  // sulla costante `DIMENSIONI.compressore` per la misura del riquadro stesso).
  const raggio = larghezza * 0.25

  /** Girante: cerchio con due corde oblique, una per metà, come nel blocco CAD. */
  const girante = (cx: number, cy: number): string => {
    const corda = (verso: 1 | -1) =>
      `M ${cx + CORDA_GIRANTE.sx * raggio} ${cy + verso * CORDA_GIRANTE.altoSx * raggio} ` +
      `L ${cx + CORDA_GIRANTE.dx * raggio} ${cy + verso * CORDA_GIRANTE.altoDx * raggio}`
    return [
      `<circle cx="${cx}" cy="${cy}" r="${raggio}" fill="none" stroke="#000" stroke-width="${TRATTO}" />`,
      traccia(corda(1)),
      traccia(corda(-1)),
    ].join('')
  }

  if (!nodo.accessorio) {
    return corpo + girante(larghezza / 2, altezza / 2) + testo(10, 20, nodo.id, 24, 'start')
  }

  // Disoleatore: riquadro in basso a sinistra, con sopra la propria valvola di sicurezza.
  //
  // Fix round 2 (revisione): il giro precedente diceva «il CAD non porta una variante "con
  // disoleatore" a sé» — falso, e la seconda volta in questo file che una costante viene
  // dichiarata non misurabile a torto (la prima è stata il pacco bombole, fix round 1). Il
  // blocco esiste: `compressore-disoleatore` in `NOMI` (`scripts/blocchi-cad.py`), il caso
  // esplicito che `scripts/confronto-simboli.ts` genera apposta perché ometterlo «mente per
  // omissione» (il suo stesso commento di testa, Task 1).
  //
  // Misurato isolando i sotto-elementi del gruppo (`scripts/blocchi-cad.py`, misura manuale sui
  // sotto-elementi come per le altre costanti di questo file — vedi `CORPO_SERBATOIO_VERTICALE`):
  // riquadro 53,40×53,34pt — lo stesso quadrato del compressore
  // semplice, stesso raggio 0,25×larghezza. Girante: centro a (37,35; 29,31)pt dall'angolo del
  // blocco → frazioni (0,699; 0,549). Box del disoleatore: origine a (1,44; 24,00)pt, dimensioni
  // 21,30×26,70pt → frazioni origine (0,027; 0,450), dimensioni (0,399; 0,501) — un box più alto
  // che largo, non il quadrato 46×46 che il giro precedente disegnava (46 era il 29% più basso
  // del vero, e sbagliato nella forma). Le frazioni, non più i prodotti già fatti (Task 8,
  // Blocco 3: il riquadro è sceso da 129 a 120 per portare le ancore sulla griglia, vedi
  // `DIMENSIONI.compressore` — ricalcolare qui a mano avrebbe richiesto tenere allineate due
  // fonti della stessa cifra).
  const cx = 0.699 * larghezza // 83,9 su un riquadro 120
  const conGirante = girante(cx, 0.549 * larghezza) // 65,9

  const dw = 0.399 * larghezza // 47,9
  const dh = 0.501 * larghezza // 60,1
  const dx = 0.027 * larghezza // 3,2
  const dy = 0.45 * larghezza // 54
  const disoleatore = [
    `<rect x="${dx}" y="${dy}" width="${dw}" height="${dh}" fill="none" stroke="#000" stroke-width="${TRATTO}" />`,
    testo(dx + 4, dy + dh - 12, nodo.accessorio.codice, 14, 'start'),
  ].join('')

  // Valvola di sicurezza del disoleatore: icona 5,10×9,42pt centrata a (12,09; 19,29)pt
  // dall'angolo del blocco → frazioni (0,226; 0,362) — il suo bordo inferiore tocca il bordo
  // superiore del box del disoleatore (0,362×120 + mezza icona ≈ 49,4, il box comincia a 54: il
  // resto è margine, non un errore). L'icona condivisa (`valvolaSicurezza`) resta 12×12 come
  // altrove nel file — solo il suo CENTRO è misurato qui. Il franco fra il bordo sinistro della
  // girante e il bordo destro del box (`cx - raggio` contro `dx + dw`, ≈2,8 unità su un riquadro
  // 120) è il CAD stesso a lasciarlo — non una scelta di questo editor — e torna da sé dalle
  // frazioni sopra, senza bisogno di scostare la girante a mano.
  const vx = 0.226 * larghezza // 27,1
  const vy = 0.362 * larghezza // 43,4
  const valvola = nodo.accessorio.valvoleSicurezza[0]
  const conValvola = valvola ? valvolaSicurezza(vx, vy) + testo(vx - 6, vy - 19, valvola.codice, 14, 'start') : ''

  return corpo + conGirante + testo(larghezza - 10, 20, nodo.id, 24, 'end') + disoleatore + conValvola
}

/**
 * Serbatoio: capsula verticale od orizzontale, con valvole di sicurezza sopra e scarico sotto.
 *
 * Legge le proprie misure dal registro (`definizioneDi(nodo).dimensioni`), non da
 * `DIMENSIONI.serbatoio`: quest'ultima è solo il verticale — l'orizzontale ha un riquadro suo
 * (`DIMENSIONI_SERBATOIO_ORIZZONTALE`, Task 4) — e leggere sempre da lì lo farebbe disegnare
 * dentro il riquadro sbagliato. Il corpo riempie il riquadro per intero in larghezza (`w =
 * larghezza`, `x = 0`): non c'è più un centraggio diverso fra i due orientamenti, perché ora
 * ciascuno ha un riquadro tagliato sulla propria capsula, non un riquadro condiviso più grande
 * di uno dei due corpi.
 *
 * `definizioneDi(nodo)` senza `libreria`: qui non cambierebbe nulla. Nel ramo tarato
 * `definizioneDi` restituisce `{ ...base, ancore: taratura.ancore, disegna: ... }` — `.dimensioni`
 * non è fra i campi sostituiti, resta sempre quella del registro (vedi il commento di testa a
 * `definizioneDi`, symbols/index.ts). Passare `libreria` qui sarebbe un parametro morto, la
 * stessa categoria di `presaDi` e del vecchio `corpoNodo` (layout.ts, fix round 1 del Task 7).
 */

/**
 * Ascissa della valvola (e, specchiata, dello scarico) sul serbatoio orizzontale: unità
 * assolute, non più la frazione `0,22×w`/`0,78×w` di prima, che usciva a 68,2/241,8pt, fuori
 * dai multipli di 10 (Task 8, Blocco 3). 70 è il valore tondo più vicino (0,226×310, scarto
 * 2,6% dalla frazione originale — non una misura CAD: il blocco non documenta questa quota a
 * parte da `MARGINE_VALVOLA_SERBATOIO`); lo scarico usa il suo specchio `w - 70` = 240, così le
 * due ascisse restano simmetriche per costruzione, come lo erano le frazioni. Esportata perché
 * il registro (`REGISTRO_SIMBOLI` sotto) dichiara le stesse ascisse per le ancore
 * `alto-in`/`basso-out`: una sola fonte, non due numeri scritti a mano da tenere allineati.
 */
export const OFFSET_VALVOLA_ORIZZONTALE = 70

export function simboloSerbatoio(nodo: SchemaNodo): string {
  const { larghezza, altezza } = definizioneDi(nodo).dimensioni
  const orizzontale = nodo.orientamento === 'ORIZZONTALE'

  const w = larghezza
  const h = altezza - MARGINE_VALVOLA_SERBATOIO
  const x = 0
  const y = MARGINE_VALVOLA_SERBATOIO
  const raggio = Math.min(w, h) / 2

  const corpo = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${raggio}" ry="${raggio}" fill="none" stroke="#000" stroke-width="${TRATTO}" />`

  // Nel serbatoio orizzontale il blocco CAD sposta le valvole ai due capi e il codice verso
  // destra; in quello verticale sta tutto sull'asse. `xCodice` resta una frazione (0,62×w): è
  // testo, non un'ancora, non deve cadere sulla griglia.
  const xValvole = orizzontale ? x + OFFSET_VALVOLA_ORIZZONTALE : larghezza / 2
  const xScarico = orizzontale ? x + w - OFFSET_VALVOLA_ORIZZONTALE : larghezza / 2
  const xCodice = orizzontale ? x + w * 0.62 : larghezza / 2

  const etichettaCodice = testo(xCodice, y + h / 2, nodo.id, 24)

  // Le valvole di sicurezza si appoggiano sulla sommità, affiancate quando sono più d'una.
  const valvole = nodo.valvoleSicurezza
    .map((v, i) => {
      const passo = 34
      const vx = xValvole + (i - (nodo.valvoleSicurezza.length - 1) / 2) * passo
      const vy = y - 12
      return [
        traccia(`M ${vx} ${y} L ${vx} ${vy + 6}`),
        valvolaSicurezza(vx, vy),
        testo(vx, vy - 18, v.codice, 14),
      ].join('')
    })
    .join('')

  const scarico = valvolaScarico(xScarico, y + h + 10, 'serbatoio')
  return corpo + etichettaCodice + valvole + scarico
}

/**
 * Quota dei segni interni dei rombi che stanno SOPRA il centro, in frazione del semiasse
 * verticale (`semiH`) del rombo: letta sul blocco CAD `essiccatore` (linea superiore a
 * 10,2/17,76 = 0,574 del semiasse) e sul blocco `separatore` (bordo superiore del rettangolo
 * interno a 10,41/17,73 = 0,587) — media 0,58.
 */
const FRAZIONE_SEGNO_ALTO = 0.58
/**
 * Quota dei segni interni che stanno SOTTO il centro, stessa unità della precedente: letta sulla
 * linea inferiore dell'essiccatore (9,9/17,76 = 0,557), sul tratto orizzontale in fondo alla
 * verticale del filtro (9,84/17,76 = 0,554) e sul bordo inferiore del rettangolo del separatore
 * (9,87/17,73 = 0,557) — le tre misure coincidono (0,554–0,557): è la stessa quota che il CAD usa
 * per «chiudere» il segno interno in tutti e tre i rombi, arrotondata a 0,56.
 */
const FRAZIONE_SEGNO_BASSO = 0.56
/**
 * Semilarghezza dei segni interni, in frazione del semiasse orizzontale (`semiL`): letta sui due
 * tratti dell'essiccatore (7,53 e 7,89 su 17,76 = 0,42–0,44) e sul rettangolo del separatore
 * (7,56/17,76 = 0,4256). Il codice disegnava già l'unico tratto che aveva a 0,42: la misura lo
 * conferma, non lo smentisce.
 */
const FRAZIONE_SEGNO_LARGHEZZA = 0.42

/**
 * Simbolo a rombo (essiccatore, filtro, separatore). Nei blocchi CAD i tre si distinguono per il
 * segno interno, non per la sagoma esterna, che è la stessa per tutti e tre — rombo con due
 * attacchi che sporgono ai fianchi, dove si innestano le tubazioni:
 * - l'essiccatore porta DUE tratti orizzontali, uno sopra e uno sotto la sigla;
 * - il filtro porta una verticale TRATTEGGIATA che scende dal vertice alto fino alla quota del
 *   tratto basso (non attraversa tutto il rombo), più un tratto orizzontale alla stessa quota;
 * - il separatore porta un rettangolo verticale, ai bordi delle stesse due quote.
 * Le tre quote (alto/basso/larghezza) sono condivise perché nel CAD coincidono fra i tre blocchi
 * (vedi le costanti `FRAZIONE_SEGNO_*` sopra): è la ragione per cui il rettangolo del separatore
 * e i due tratti dell'essiccatore, se sovrapposti, hanno gli stessi quattro angoli.
 */
function simboloRombo(
  nodo: SchemaNodo,
  segno: 'due-tratti' | 'verticale-tratteggiata' | 'rettangolo',
  scarico: 'apparecchio' | 'nessuno'
): string {
  const { larghezza, altezza } = DIMENSIONI[nodo.tipo]
  // Il rombo non è centrato esattamente nel riquadro 110×110: cx/cy sono spostati di 5 unità dal
  // centro vero (55,55), e semiL/semiH accorciati della stessa misura (semiH di 15, non 5, per
  // lasciare la stessa aria sopra la sigla che dava il -16 di prima). Non è un ritocco estetico:
  // è la condizione perché i quattro vertici del rombo — le ancore sx/dx/alto-in/basso-out —
  // cadano sui multipli di 10 (PASSO_GRIGLIA) restando dentro un riquadro invariato, la stessa
  // unità "rombo" su cui sono calibrati compressore/tanica/pacco bombole/serbatoi (Task 8,
  // Blocco 3: prima gli offset erano 0/6/6/16 e i vertici uscivano a 55/6/104/10/88, fuori
  // griglia). Gli offset non sono una misura CAD — la sagoma del rombo nel blocco
  // `essiccatore`/`filtro`/`separatore` non dichiara un margine — sono la più piccola
  // correzione che porta tutti e quattro i vertici sulla griglia.
  const cx = larghezza / 2 - 5
  const cy = altezza / 2 - 5
  const semiL = larghezza / 2 - 5
  const semiH = altezza / 2 - 15

  const rombo = traccia(
    `M ${cx} ${cy - semiH} L ${cx + semiL} ${cy} L ${cx} ${cy + semiH} L ${cx - semiL} ${cy} Z`
  )
  const attacchi = traccia(
    `M ${cx - semiL - 10} ${cy} L ${cx - semiL} ${cy} M ${cx + semiL} ${cy} L ${cx + semiL + 10} ${cy}`
  )

  const yAlto = cy - semiH * FRAZIONE_SEGNO_ALTO
  const yBasso = cy + semiH * FRAZIONE_SEGNO_BASSO
  const xSx = cx - semiL * FRAZIONE_SEGNO_LARGHEZZA
  const xDx = cx + semiL * FRAZIONE_SEGNO_LARGHEZZA

  let interno: string
  if (segno === 'due-tratti') {
    interno = traccia(`M ${xSx} ${yAlto} L ${xDx} ${yAlto}`) + traccia(`M ${xSx} ${yBasso} L ${xDx} ${yBasso}`)
  } else if (segno === 'verticale-tratteggiata') {
    // `traccia()` non prende un tratteggio: qui serve, quindi il `<path>` è scritto a mano come
    // fa già `simboloUtenze` per il proprio codolo tratteggiato.
    const verticale = `<path d="M ${cx} ${cy - semiH} L ${cx} ${yBasso}" fill="none" stroke="#000" stroke-width="${TRATTO}" stroke-linecap="round" stroke-dasharray="${TRATTEGGIO_FILTRO}" />`
    interno = verticale + traccia(`M ${xSx} ${yBasso} L ${xDx} ${yBasso}`)
  } else {
    interno = `<rect x="${xSx}" y="${yAlto}" width="${xDx - xSx}" height="${yBasso - yAlto}" fill="none" stroke="#000" stroke-width="${TRATTO}" />`
  }

  const haAccessorio = Boolean(nodo.accessorio)
  const etichettaCodice = testo(cx, haAccessorio ? cy - 12 : cy, nodo.id, haAccessorio ? 16 : 18)

  // L'accessorio ha una resa propria: uno stadio (rettangolo dagli angoli arrotondati a mezza
  // altezza, non un riquadro appena smussato) per il recipiente del filtro; un cerchio col
  // serpentino a zigzag del circuito frigorifero, a cavallo del tratto basso, per lo
  // scambiatore dell'essiccatore — così nei blocchi CAD `filtro-recipiente` ed
  // `essiccatore-scambiatore`.
  let accessorio = ''
  if (nodo.accessorio && nodo.tipo === 'filtro') {
    const rw = 40
    const rh = 18
    // Raggio a metà altezza: uno stadio pieno, come lo ha descritto il committente
    // guardando il blocco ingrandito («uno stadio, non un riquadro squadrato»). Il CAD misura
    // un raggio più piccolo (≈0,35 dell'altezza, 2,67/7,68pt) ma a questa scala un raggio
    // parziale si legge come un rettangolo smussato, non come uno stadio.
    const raggio = rh / 2
    accessorio =
      `<rect x="${cx - rw / 2}" y="${cy + 2}" width="${rw}" height="${rh}" rx="${raggio}" ry="${raggio}" fill="none" stroke="#000" stroke-width="${TRATTO}" />` +
      testo(cx, cy + 2 + rh / 2, nodo.accessorio.codice, 11)
  } else if (nodo.accessorio) {
    const r = 9
    // Stessa quota del tratto basso dell'essiccatore: nel CAD il cerchio è centrato lì,
    // «a cavallo» del tratto (il cerchio ne copre il tratto centrale, non lo sostituisce).
    const cyCerchio = cy + semiH * FRAZIONE_SEGNO_BASSO
    const zigzag = [
      [cx - r * 0.7, cyCerchio],
      [cx - r * 0.25, cyCerchio - r * 0.45],
      [cx + r * 0.25, cyCerchio + r * 0.45],
      [cx + r * 0.7, cyCerchio],
    ]
      .map(([px, py]) => `${px.toFixed(1)} ${py.toFixed(1)}`)
      .join(' L ')
    accessorio =
      testo(cx, cy + 6, nodo.accessorio.codice, 12) +
      `<circle cx="${cx}" cy="${cyCerchio}" r="${r}" fill="none" stroke="#000" stroke-width="${TRATTO}" />` +
      traccia(`M ${zigzag}`)
  }

  const scaricoSvg = scarico === 'apparecchio' ? valvolaScarico(cx, cy + semiH + 12, 'apparecchio') : ''
  return rombo + attacchi + interno + etichettaCodice + accessorio + scaricoSvg
}

export function simboloEssiccatore(nodo: SchemaNodo): string {
  return simboloRombo(nodo, 'due-tratti', 'apparecchio')
}

export function simboloFiltro(nodo: SchemaNodo): string {
  return simboloRombo(nodo, 'verticale-tratteggiata', 'apparecchio')
}

/**
 * Il separatore non porta la valvola di scarico degli altri due rombi: nel blocco CAD scarica da
 * un tratto nudo che scende dal vertice basso e, staccato da un vuoto, un secondo segmento più
 * in basso — non una farfalla. Il CAD misura 2,28pt/4,8pt/2,22pt (tratto/vuoto/segmento, rapporto
 * ≈1:2:1); qui in unità assolute (5/10/5, stesso rapporto) perché l'ingombro del nodo (Task 4,
 * non questo) lascia poco margine sotto il vertice basso — a 110 di altezza e vertice a y=90
 * (non più 88: fix round 1 del Task 8, Blocco 3 — `cx`/`cy`/`semiH` duplicavano qui la vecchia
 * geometria di `simboloRombo`, 0/6/16, invece di leggere quella vera, 5/5/15) restano solo 20
 * unità prima del bordo dichiarato, e il secondo segmento vi arriva esattamente.
 */
export function simboloSeparatore(nodo: SchemaNodo): string {
  const { larghezza, altezza } = DIMENSIONI.separatore
  const cx = larghezza / 2 - 5
  const cy = altezza / 2 - 5
  const semiH = altezza / 2 - 15
  const yVertice = cy + semiH
  return (
    simboloRombo(nodo, 'rettangolo', 'nessuno') +
    traccia(`M ${cx} ${yVertice} L ${cx} ${yVertice + 5}`) +
    traccia(`M ${cx} ${yVertice + 15} L ${cx} ${yVertice + 20}`)
  )
}

/**
 * Tanica raccolta condense: riquadro chiuso col solo codice dentro.
 *
 * Fix round 1 (revisione del Task 4): il blocco CAD `tanica` è un SOLO rettangolo, 35,52×17,76pt
 * (2:1 esatto) — non un rettangolo rientrato dentro un riquadro più grande. Il rientro di 6 unità
 * per lato che il codice disegnava prima (rettangolo 74×31, rapporto 2,39:1) non era nel CAD:
 * faceva passare il test sul `DIMENSIONI` (il riquadro) senza che il DISEGNO rispettasse lo
 * stesso rapporto. Ora il rettangolo disegnato è il riquadro stesso.
 */
export function simboloTanica(nodo: SchemaNodo): string {
  const { larghezza, altezza } = DIMENSIONI.tanica
  return [
    `<rect x="0" y="0" width="${larghezza}" height="${altezza}" fill="none" stroke="#000" stroke-width="${TRATTO}" />`,
    testo(larghezza / 2, altezza / 2, nodo.id, 20),
  ].join('')
}

/**
 * Pacco bombole: quattro bombole a fondo piatto e cielo arrotondato, col codice dentro il telaio.
 *
 * Fix round 1 (revisione del Task 4): il giro precedente diceva «nessun rettangolo di cornice nel
 * CAD» — falso. Riestraendo il gruppo `pacco-bombole` da `Blocchi.pdf`, il PRIMO sotto-elemento
 * è un quadrato di 53,40×53,40pt che coincide esattamente col riquadro dell'intero blocco (non un
 * `re` esplicito ma un quad di stroke, `qu` — per questo era sfuggito isolando solo i comandi
 * `l`/`c`). **La cornice esiste, ed È il blocco**: le quattro bombole vi affiancano a bordo pieno
 * (prima a x=436,68, quarta a x=490,08 — gli stessi bordi del quadrato), senza margine.
 *
 * Passo = `larghezza / 4` (non `(larghezza - margine*2) / 4`: niente margine da sottrarre, per lo
 * stesso motivo). Bombola larga 13,38pt su un blocco di 53,40pt → rapporto larghezza:altezza
 * **1:4** (non l'1:2,9 che usciva dal margine sbagliato). Colletto largo 2,70pt, lo 0,20 del
 * passo — da cui l'offset ±3 delle due tacche sotto (0,20 di `r` = passo/2 = 15, su un riquadro
 * sceso a 120 dal Task 8, Blocco 3 — vedi `DIMENSIONI.pacco_bombole`). Colletto alto 3,12pt, lo
 * 0,0584 del blocco → 7 unità su un riquadro di 120 (era 8 su 129, la stessa frazione). L'arco
 * del cielo resta un semicerchio pieno (raggio = `r`, non i 5,31pt di sagitta misurati sul CAD):
 * una semplificazione già presente prima del Task 4, non una misura.
 */
export function simboloPaccoBombole(nodo: SchemaNodo): string {
  const { larghezza, altezza } = DIMENSIONI.pacco_bombole
  const bombole = 4
  const passo = larghezza / bombole
  const r = passo / 2
  const collo = 7 // 3,12pt su 53,40pt di blocco (0,0584) -> 120*0,0584 ~= 7,0

  const cilindri = Array.from({ length: bombole }, (_, i) => {
    const bx = i * passo
    const cielo = collo
    const fondo = altezza
    // Corpo a U rovesciata: fianchi dritti, cielo arrotondato, fondo sul bordo del telaio (che è
    // il riquadro stesso). Le bombole affiancano a bordo pieno (`bx`/passo intero, senza scarto
    // fra loro): il fianco destro dell'una coincide col fianco sinistro della successiva, e la
    // prima/l'ultima coincidono coi due lati del telaio — come nel blocco CAD.
    const corpo = traccia(
      `M ${bx} ${fondo} L ${bx} ${cielo + r} A ${r} ${r} 0 0 1 ${bx + passo} ${cielo + r} L ${bx + passo} ${fondo}`
    )
    // Le due tacche del colletto occupano l'intera fascia sopra il cielo (da y=0, il bordo alto
    // del telaio, fino a y=cielo, dove comincia l'arco): la fascia stessa è il colletto.
    const tacche = traccia(`M ${bx + r - 3} ${cielo} L ${bx + r - 3} 0 M ${bx + r + 3} ${cielo} L ${bx + r + 3} 0`)
    return corpo + tacche
  }).join('')

  return [
    `<rect x="0" y="0" width="${larghezza}" height="${altezza}" fill="none" stroke="#000" stroke-width="${TRATTO}" />`,
    cilindri,
    testo(6, 12, nodo.id, 14, 'start'),
  ].join('')
}

/**
 * Diametro del pallino della giunzione. Fino al 17-08-2026 era lo stesso dei punti di ancoraggio
 * delle apparecchiature sulla tela (`LATO_HANDLE`, SchemaNodeSymbol.tsx); il committente lo ha
 * poi chiesto dimezzato, e i due valori non sono più legati — gli attacchi restano dove sono,
 * cambia solo il cerchio disegnato.
 */
export const DIAMETRO_GIUNZIONE = 5

/**
 * Giunzione (TEE): un punto pieno, senza monconi. Fino al Blocco B disegnava tre tratti verso
 * sinistra, destra e basso, che restavano visibili anche quando nessuna tubazione ci arrivava
 * e fissavano il ramo di diramazione verso il basso; il committente ha chiesto un attacco
 * libero da qualunque lato, e la forma a T (o a croce, o a gomito) la disegnano ora le
 * tubazioni che ci arrivano davvero.
 *
 * Il pallino sta al centro del riquadro, dove stanno anche le quattro ancore: i tubi
 * convergono tutti lì, quindi fra la fine di un tubo e la giunzione non c'è buco a nessun
 * raggio. È questo a permettergli di essere piccolo — fino al Blocco D2 il raggio era metà
 * della larghezza del riquadro, l'unico valore che toccasse le ancore quando stavano sui bordi.
 */
export function simboloGiunzione(_nodo: SchemaNodo): string {
  const { larghezza, altezza } = DIMENSIONI.giunzione
  return `<circle cx="${larghezza / 2}" cy="${altezza / 2}" r="${DIAMETRO_GIUNZIONE / 2}" fill="#000" />`
}

/**
 * Geometria del terminale utenze, condivisa fra chi lo disegna (`simboloUtenze`) e chi ne calcola
 * l'ingombro (`dimensioniDi`): sono la stessa cosa vista da due parti, e tenerle separate è
 * esattamente ciò che faceva uscire la scritta dal riquadro.
 */
const UTENZE = {
  /**
   * Ascissa del codolo, la stessa dell'ancora `in` nel registro: 10, non più 12 (Task 8, Blocco
   * 3 — non una misura del disegno di riferimento del committente, solo il valore più vicino
   * che cade sulla griglia).
   */
  x: 10,
  /** Rientro della scritta rispetto al codolo. */
  rientroScritta: 18,
  dimensioneScritta: 18,
  /** Aria fra la fine della scritta e il bordo destro del riquadro. */
  margineDestro: 12,
  /**
   * Larghezza media di un carattere, in frazione della dimensione del font. Per Arial 0,5 è una
   * buona approssimazione: serve a decidere quanto allargare la tela, non a comporre
   * tipograficamente, e misurare i glifi richiederebbe un DOM che queste funzioni non hanno.
   */
  larghezzaCarattere: 0.5,
  /** Aria fra l'ultima riga della scritta e il fondo del riquadro. */
  margineInferiore: 10,
}

/**
 * Le annotazioni libere (`SchemaTestoLibero`) usano lo stesso carattere e lo stesso corpo della
 * scritta del terminale utenze, come deciso col committente: sono entrambe scritte libere posate
 * sul disegno, senza cornice. `larghezzaCarattere` è la stessa approssimazione di `UTENZE` (vedi
 * il suo commento) esposta qui: chi stima l'ingombro di un'annotazione (`ingombroTesto` in
 * `layout.ts`) la legge da qui, non da un `0.5` scritto a mano una seconda volta — le due stime
 * altrimenti potrebbero divergere in silenzio se una sola delle due venisse mai ritoccata.
 */
export const TESTO_LIBERO = { dimensione: UTENZE.dimensioneScritta, larghezzaCarattere: UTENZE.larghezzaCarattere }

/**
 * Terminale «Alle utenze»: codolo tratteggiato che sale dall'ancora, punta di freccia e la
 * scritta accanto. Riproduce la forma del disegno di riferimento del committente
 * (`DOCUMENTAZIONE/relazione/schema.png`), dove il tratteggio è corto e il tratto prima è
 * tubazione vera.
 *
 * La punta è un triangolo pieno e non un `marker-end`: nell'editor `SchemaNodeSymbol` monta il
 * simbolo in un `<svg>` suo, senza i `<defs>` che `renderSvg` dichiara, e un marker non
 * verrebbe disegnato affatto.
 *
 * `dimensioniDi(nodo)` senza `libreria`, di proposito: il codolo si disegna in coordinate locali,
 * non tarate, e alla trasformazione pensa `simboloTrasformato` sul risultato. Con `libreria`
 * l'altezza sarebbe l'`inviluppo(...)` della taratura, già scalato, e la scala finirebbe applicata
 * due volte.
 */
export function simboloUtenze(nodo: SchemaNodo): string {
  const { altezza } = dimensioniDi(nodo)
  const x = UTENZE.x
  const yPunta = 14
  return [
    `<path d="M ${x} ${altezza} L ${x} ${yPunta + 12}" fill="none" stroke="#000" stroke-width="${TRATTO}" stroke-dasharray="10 7" />`,
    `<path d="M ${x - 6} ${yPunta + 13} L ${x} ${yPunta} L ${x + 6} ${yPunta + 13} Z" fill="#000" />`,
    testoMultiRiga(x + UTENZE.rientroScritta, yPunta + 6, nodo.etichetta, UTENZE.dimensioneScritta, 'start'),
  ].join('')
}

export interface DefinizioneSimbolo {
  dimensioni: { larghezza: number; altezza: number }
  ancore: SchemaAncora[]
  disegna: (nodo: SchemaNodo) => string
}

/**
 * Ancore condivise da essiccatore e filtro, che hanno la stessa geometria e sono solo stadi
 * della linea aria: i quattro vertici VERI del rombo disegnato da `simboloRombo` — con
 * `cx=cy=semiL=50`, `semiH=40` (vedi i suoi commenti), il path è `M 50 10 L 100 50 L 50 90 L 0
 * 50 Z` (verificato renderizzando `simboloDi`, non solo calcolato a mano), quindi vertice alto
 * (50,10), destro (100,50), basso (50,90), sinistro (0,50). Fix round 1 (revisione, Task 8,
 * Blocco 3): la prima stesura dichiarava `sx=(10,40)`/`dx=(90,40)`/`basso-out=(50,70)` — tre
 * vertici su quattro staccati dal disegno vero di 14-20 unità, un resto della bozza scartata
 * che riscalava il rombo a un riquadro 100×100 (mai arrivata al codice finale, che invece tiene
 * il riquadro 110×110 invariato — vedi il commento su `simboloRombo`). Erano comunque multipli
 * di 10, quindi il test di regolarità sulla griglia non se ne accorgeva: cadere sulla griglia
 * non basta, l'ancora deve cadere sul vertice — 6/104/49/10/88 prima del Task 8 (rombo centrato
 * nel riquadro, fuori griglia), 0/100/50/10/90 ora (vertici veri, sulla griglia per costruzione,
 * non per coincidenza).
 */
const ANCORE_ROMBO: SchemaAncora[] = [
  { id: 'sx', x: 0, y: 50, accetta: ['aria'] },
  { id: 'dx', x: 100, y: 50, accetta: ['aria'] },
  { id: 'alto-in', x: 50, y: 10, accetta: ['aria'] },
  { id: 'basso-out', x: 50, y: 90, accetta: ['condensa'] },
]

/**
 * Ancore del separatore: stessa geometria del rombo, ma quando fa da pozzo di raccolta
 * condense (`dati_impianto.raccolta_condense: 'separatore'`) la corsia condense entra di
 * fianco, non dall'alto (schemi storici, `555_RELAZIONE_TECNICA_00-2025.pdf` pag. 3): `sx`/`dx`
 * accettano anche condensa, oltre all'aria che già passa quando il separatore è uno stadio
 * di linea.
 */
const ANCORE_SEPARATORE: SchemaAncora[] = [
  { id: 'sx', x: 0, y: 50, accetta: ['aria', 'condensa'] },
  { id: 'dx', x: 100, y: 50, accetta: ['aria', 'condensa'] },
  { id: 'alto-in', x: 50, y: 10, accetta: ['aria'] },
  { id: 'basso-out', x: 50, y: 90, accetta: ['condensa'] },
]

/**
 * Registro dei simboli: unisce per ogni variante grafica l'ingombro, i punti di aggancio
 * delle tubazioni e la funzione di disegno, così i tre non possono più andare fuori sincrono
 * come accadeva quando vivevano in file separati (`DIMENSIONI_NODO` in `layout.ts`, disegno
 * qui). Le coordinate delle ancore sono ricavate a mano dalla geometria di ogni funzione
 * `simbolo*` (vedi `corpoNodo` in `layout.ts` per i riquadri del corpo disegnato).
 */
export const REGISTRO_SIMBOLI: Record<ChiaveSimbolo, DefinizioneSimbolo> = {
  compressore: {
    dimensioni: DIMENSIONI.compressore,
    // Centro del riquadro (120/2 = 60): il compressore è quadrato dal Task 4, e da 129 è sceso a
    // 120 nel Task 8 (Blocco 3) perché 129/2 = 64,5 non cadeva sulla griglia — vedi il commento
    // su `DIMENSIONI.compressore`.
    ancore: [
      { id: 'alto-out', x: 60, y: 0, accetta: ['aria'] },
      { id: 'basso-out', x: 60, y: 120, accetta: ['condensa'] },
    ],
    disegna: simboloCompressore,
  },
  'serbatoio:VERTICALE': {
    dimensioni: DIMENSIONI.serbatoio,
    // Le cinque ancore chieste dal committente (Task 8, Blocco 3), non più le quattro di prima
    // (sx/dx a metà altezza, alto-in/basso-out sull'asse): quattro sui fianchi, alle due quote
    // dove le calotte — semicerchi di raggio 50, metà della larghezza 100 — incontrano il
    // cilindro (40 + 50 = 90 in alto, 40 + 260 - 50 = 250 in basso, sui due fianchi x=0/100),
    // più una in basso al centro (x=50) sulla valvola di scarico (y=300, il fondo del
    // riquadro). Le quattro laterali accettano aria (compressore e stadio successivo si
    // agganciano indifferentemente in alto o in basso); quella in basso condensa. `sx`/`dx`
    // restano gli id del Task 4 (li legge `buildSchemaModel.ts` per la mandata dal compressore
    // e per la catena di trattamento): sono la coppia alta, `sx-basso`/`dx-basso` la bassa.
    ancore: [
      { id: 'sx', x: 0, y: 90, accetta: ['aria'] },
      { id: 'dx', x: 100, y: 90, accetta: ['aria'] },
      { id: 'sx-basso', x: 0, y: 250, accetta: ['aria'] },
      { id: 'dx-basso', x: 100, y: 250, accetta: ['aria'] },
      { id: 'basso-out', x: 50, y: 300, accetta: ['condensa'] },
    ],
    disegna: simboloSerbatoio,
  },
  'serbatoio:ORIZZONTALE': {
    dimensioni: DIMENSIONI_SERBATOIO_ORIZZONTALE,
    // Riquadro proprio (310×140, Task 4/8), non più quello del verticale: sx/dx sui due capi
    // della capsula, a metà della sua altezza (40 + 100/2 = 90); alto-in/basso-out alle stesse
    // ascisse che `simboloSerbatoio` usa per valvola e scarico (`OFFSET_VALVOLA_ORIZZONTALE`,
    // 70 e il suo specchio 310-70=240), sul filo sopra e sotto il corpo.
    ancore: [
      { id: 'sx', x: 0, y: 90, accetta: ['aria'] },
      { id: 'dx', x: 310, y: 90, accetta: ['aria'] },
      { id: 'alto-in', x: OFFSET_VALVOLA_ORIZZONTALE, y: 40, accetta: ['aria', 'valvola_sicurezza'] },
      { id: 'basso-out', x: 310 - OFFSET_VALVOLA_ORIZZONTALE, y: 140, accetta: ['condensa'] },
    ],
    disegna: simboloSerbatoio,
  },
  essiccatore: { dimensioni: DIMENSIONI.essiccatore, ancore: ANCORE_ROMBO, disegna: simboloEssiccatore },
  filtro: { dimensioni: DIMENSIONI.filtro, ancore: ANCORE_ROMBO, disegna: simboloFiltro },
  separatore: { dimensioni: DIMENSIONI.separatore, ancore: ANCORE_SEPARATORE, disegna: simboloSeparatore },
  tanica: {
    dimensioni: DIMENSIONI.tanica,
    // Centro orizzontale (80/2 = 40), sul filo superiore (y=0): il rettangolo disegnato è il
    // riquadro stesso (fix round 1, Task 4); 80 invece di 86 dal Task 8 (Blocco 3), perché
    // 86/2 = 43 non cadeva sulla griglia — vedi il commento su `DIMENSIONI.tanica`.
    ancore: [{ id: 'alto-in', x: 40, y: 0, accetta: ['condensa'] }],
    disegna: simboloTanica,
  },
  pacco_bombole: {
    dimensioni: DIMENSIONI.pacco_bombole,
    // Bordo destro del telaio (120, il riquadro stesso — fix round 1, Task 4; sceso da 129 nel
    // Task 8, Blocco 3, perché 129/2 = 64,5 non cadeva sulla griglia), a metà altezza (120/2 = 60).
    ancore: [{ id: 'dx', x: 120, y: 60, accetta: ['aria'] }],
    disegna: simboloPaccoBombole,
  },
  giunzione: {
    dimensioni: DIMENSIONI.giunzione,
    // Quattro attacchi sempre disponibili, uno per lato: non c'è un «davanti», quindi non
    // c'è nulla da ruotare. Gli id sono i nomi dei quattro lati: sx/dx/alto/basso.
    //
    // Le ANCORE stanno tutte al centro (10,10 su un riquadro sceso a 20 nel Task 8, Blocco 3 —
    // 24/2 = 12 non cadeva sulla griglia): i tubi convergono in un punto solo, e fra tubo e
    // giunzione non resta buco a nessun raggio — è ciò che permette al pallino di scendere a
    // `DIAMETRO_GIUNZIONE` (osservazione 4 del committente). I PUNTI DI PRESA restano sulle
    // mezzerie dei lati, dove le ancore stavano fino al Blocco D2: il TEE si afferra e si
    // collega esattamente come prima, con le maniglie larghe invece che sovrapposte.
    //
    // Il `lato` è dichiarato perché con quattro ancore coincidenti la deduzione di `latoDi`
    // (SchemaNodeSymbol.tsx) è degenere: le appoggerebbe tutte e quattro a sinistra.
    ancore: [
      { id: 'sx', x: 10, y: 10, accetta: ['aria'], presa: { x: 0, y: 10 }, lato: 'sx' },
      { id: 'dx', x: 10, y: 10, accetta: ['aria'], presa: { x: 20, y: 10 }, lato: 'dx' },
      { id: 'alto', x: 10, y: 10, accetta: ['aria'], presa: { x: 10, y: 0 }, lato: 'alto' },
      { id: 'basso', x: 10, y: 10, accetta: ['aria'], presa: { x: 10, y: 20 }, lato: 'basso' },
    ],
    disegna: simboloGiunzione,
  },
  utenze: {
    dimensioni: DIMENSIONI.utenze,
    // Una sola: la linea aria ci arriva e finisce lì. Sta in fondo al codolo, dove il
    // tratteggio comincia, così la tubazione entrante e il codolo formano un tratto continuo.
    // x=10 (UTENZE.x), non più 12 (Task 8, Blocco 3).
    ancore: [{ id: 'in', x: 10, y: 120, accetta: ['aria'] }],
    disegna: simboloUtenze,
  },
}

/**
 * `libreria` di default `{}`: nessuna pratica passa oggi una libreria vera (i due punti che la
 * costruiranno sono `SchemaEditor.tsx` e `SchemaImpiantoSection.tsx`, Blocco 3 Task 7), quindi il
 * ramo con taratura resta silenzioso ovunque tranne nei test che la passano esplicitamente.
 *
 * Con una taratura per la chiave del nodo, `ancore` e `disegna` vengono dalla taratura (le
 * ancore SOSTITUISCONO quelle del registro, `disegna` viene avvolto da `simboloTrasformato`);
 * `dimensioni` resta quella del registro — l'ingombro tarato è `inviluppo(...)`, e lo calcola
 * solo `dimensioniDi`, che ha anche le ancore già risolte per farlo.
 */
export function definizioneDi(
  nodo: { tipo: SchemaNodoTipo; orientamento?: 'VERTICALE' | 'ORIZZONTALE' },
  libreria: Tarature = {}
): DefinizioneSimbolo {
  const chiave = chiaveSimbolo(nodo)
  const base = REGISTRO_SIMBOLI[chiave]
  const taratura = taraturaDi(libreria, chiave)
  if (!taratura) return base
  return { ...base, ancore: taratura.ancore, disegna: (n) => simboloTrasformato(base.disegna(n), taratura) }
}

/**
 * Le ancore di un nodo: quelle della taratura per la sua chiave, se `libreria` ne ha una
 * (`definizioneDi`), altrimenti quelle del registro. Il terminale utenze è un caso ulteriore
 * sopra i due: il suo attacco `in` segue l'altezza vera del riquadro (`dimensioniDi`), che
 * cresce con la scritta — non la quota fissa che l'una o l'altra fonte dichiarano.
 */
export function ancoreDi(nodo: SchemaNodo, libreria: Tarature = {}): SchemaAncora[] {
  const ancore = definizioneDi(nodo, libreria).ancore
  if (nodo.tipo !== 'utenze') return ancore
  const { altezza } = dimensioniDi(nodo, libreria)
  return ancore.map((a) => (a.id === 'in' ? { ...a, y: altezza } : a))
}

export function ancoraDi(nodo: SchemaNodo, id: string, libreria: Tarature = {}): SchemaAncora | undefined {
  return ancoreDi(nodo, libreria).find((a) => a.id === id)
}

/**
 * Il lato da cui una tubazione deve imboccare questo capo, quando il capo lo impone;
 * `undefined` quando la rotta è libera di arrivare come vuole.
 *
 * Lo impone la sola **giunzione**: è l'unico simbolo le cui quattro ancore coincidono — stanno
 * tutte al centro del pallino — quindi l'unico per cui il disegno non può dedurre da che parte
 * il tubo entra, ed è anche l'unico la cui forma (la T, o la croce, o il gomito) è disegnata
 * per intero dalle tubazioni che vi arrivano.
 *
 * La condizione è sul TIPO e non sulla presenza del campo `lato`: così la regola non si allarga
 * in silenzio ad altri simboli il giorno che uno di loro dichiarasse un lato per ragioni sue.
 */
export function latoImposto(nodo: SchemaNodo, ancoraId: string, libreria: Tarature = {}): SchemaLatoAncora | undefined {
  if (nodo.tipo !== 'giunzione') return undefined
  return ancoraDi(nodo, ancoraId, libreria)?.lato
}

/**
 * Dove si afferra un attacco sulla tela dell'editor: coincide con l'ancora quando il simbolo
 * non dichiara una `presa` propria.
 *
 * Restituisce sempre un oggetto nuovo: il chiamante ne ricava uno stile CSS, e il registro è
 * condiviso fra documento ed editor — una mutazione accidentale lo corromperebbe per entrambi.
 *
 * Non prende `libreria`: a differenza delle altre cinque porte non guarda il registro, legge
 * solo l'`ancora` che riceve — che il chiamante ha già risolto con `ancoreDi`/`ancoraDi`, quindi
 * già tarata quando c'è una taratura. Un parametro qui sarebbe silenziosamente inutilizzato.
 */
export function presaDi(ancora: SchemaAncora): { x: number; y: number } {
  return ancora.presa ? { x: ancora.presa.x, y: ancora.presa.y } : { x: ancora.x, y: ancora.y }
}

/**
 * Quanto spazio occupa un nodo. È il riquadro di `riquadroDi` senza il suo angolo: la forma che
 * chi posiziona, allinea, distanzia o misura una distanza fra apparecchiature usa da sempre — lì
 * serve l'ingombro, non da dove comincia il disegno.
 */
export function dimensioniDi(nodo: SchemaNodo, libreria: Tarature = {}): { larghezza: number; altezza: number } {
  const { larghezza, altezza } = riquadroDi(nodo, libreria)
  return { larghezza, altezza }
}

/**
 * Riquadro effettivo di un nodo: ingombro e ANGOLO alto-sinistro, quest'ultimo in coordinate
 * locali al nodo (`x`/`y` rispetto a `SchemaNodoPosizionato.x`/`.y`). È zero per ogni simbolo non
 * tarato — i simboli del registro sono disegnati a partire dalla propria origine — e diventa
 * negativo quando una taratura porta la sagoma a sinistra o in alto dei pallini (`inviluppo`, e
 * la ragione per cui non basta una misura). Chi DISEGNA il simbolo, o misura quanto disegno c'è
 * sul foglio, deve leggere da qui: `SchemaNodeSymbol` per il riquadro della tela dell'editor,
 * `dimensioniLayout` per il bordo del PNG. Sono gli stessi due punti in cui conta l'ingombro
 * dinamico del terminale utenze, qui sotto.
 *
 * Il riquadro coincide con quello dichiarato nel registro per tutti i tipi tranne il terminale
 * utenze, la cui scritta è libera: l'utente la cambia dall'editor, e con la larghezza fissa di 190
 * le restavano una diciassettina di caratteri — oltre, la scritta usciva dal riquadro, tagliata
 * subito nell'editor (`SchemaNodeSymbol` monta un `<svg>` largo quanto l'ingombro) e tagliata nel
 * PNG appena superava il margine. La larghezza si ricava quindi dalla lunghezza della riga più
 * lunga dell'etichetta, con quella del registro come minimo, così `dimensioniLayout` allarga da sé
 * la tela come la spec promette. Da quando la scritta può andare a capo (vedi `testoMultiRiga`),
 * anche l'altezza cresce allo stesso modo, sull'ultima riga: sotto il numero di righe che il
 * registro prevedeva resta quella fissa, sopra si allunga per farcele stare tutte.
 *
 * `DIMENSIONI_NODO` resta un `Record` statico per tipo e non può portare questa informazione:
 * chi ha in mano il nodo (e quindi la sua etichetta) passa di qui, gli altri continuano a leggere
 * il registro. `simboloUtenze` e `ancoreDi` leggono l'altezza da `dimensioniDi` anziché dal
 * registro, per la stessa ragione.
 */
export function riquadroDi(
  nodo: SchemaNodo,
  libreria: Tarature = {}
): { x: number; y: number; larghezza: number; altezza: number } {
  const chiave = chiaveSimbolo(nodo)
  const taratura = taraturaDi(libreria, chiave)
  // Con taratura l'ingombro è l'inviluppo di sagoma trasformata e ancore (vedi `inviluppo` più
  // sotto), non più il riquadro fisso del registro: la crescita dinamica del terminale utenze
  // qui sotto è un caso a parte che con una taratura non si applica. Da `taratura.ancore`
  // direttamente, non da `ancoreDi(nodo, libreria)`: per 'utenze' quest'ultima richiama
  // `dimensioniDi` per la propria altezza (il ramo sotto), e richiamarla da qui ricreerebbe lo
  // stesso ciclo — `taratura.ancore` è già il dato finale, nessuna chiamata in più serve.
  if (taratura) return inviluppo(REGISTRO_SIMBOLI[chiave].dimensioni, taratura, taratura.ancore)

  // Senza taratura il riquadro parte sempre dall'origine del nodo: i simboli del registro sono
  // disegnati in coordinate locali a partire da (0,0), e nessuno di loro sporge all'indietro.
  const dimensioni = definizioneDi(nodo, libreria).dimensioni
  if (nodo.tipo !== 'utenze') return { x: 0, y: 0, ...dimensioni }

  const righe = nodo.etichetta.split('\n')
  const piuLunga = Math.max(...righe.map((r) => r.length))
  const scritta = piuLunga * UTENZE.dimensioneScritta * UTENZE.larghezzaCarattere
  const larghezzaNecessaria = UTENZE.x + UTENZE.rientroScritta + scritta + UTENZE.margineDestro
  // La prima riga è centrata a `yPunta + 6` = 20; ogni riga successiva scende di un'interlinea.
  const ultimaRiga = 20 + (righe.length - 1) * UTENZE.dimensioneScritta * INTERLINEA_TESTO
  const altezzaNecessaria = ultimaRiga + UTENZE.margineInferiore
  return {
    x: 0,
    y: 0,
    larghezza: Math.max(dimensioni.larghezza, Math.ceil(larghezzaNecessaria)),
    altezza: Math.max(dimensioni.altezza, Math.ceil(altezzaNecessaria)),
  }
}

/** Ingombri per tipo, ricavati dal registro. Conserva la forma che `layout.ts` già usa. */
export const DIMENSIONI_NODO: Record<SchemaNodoTipo, { larghezza: number; altezza: number }> = {
  compressore: REGISTRO_SIMBOLI.compressore.dimensioni,
  serbatoio: REGISTRO_SIMBOLI['serbatoio:VERTICALE'].dimensioni,
  essiccatore: REGISTRO_SIMBOLI.essiccatore.dimensioni,
  filtro: REGISTRO_SIMBOLI.filtro.dimensioni,
  separatore: REGISTRO_SIMBOLI.separatore.dimensioni,
  tanica: REGISTRO_SIMBOLI.tanica.dimensioni,
  pacco_bombole: REGISTRO_SIMBOLI.pacco_bombole.dimensioni,
  giunzione: REGISTRO_SIMBOLI.giunzione.dimensioni,
  utenze: REGISTRO_SIMBOLI.utenze.dimensioni,
}

/**
 * Frammento SVG del nodo in coordinate locali (senza traslazione). Non è una delle sei porte,
 * ma è il solo punto che chiama `.disegna`: senza `libreria` qui, il `simboloTrasformato` che
 * `definizioneDi` applica alla taratura non disegnerebbe mai nulla di diverso, in nessuna delle
 * due catene (editor, documento) — è quindi propagato allo stesso modo.
 */
export function simboloDi(nodo: SchemaNodo, libreria: Tarature = {}): string {
  return definizioneDi(nodo, libreria).disegna(nodo)
}

/**
 * Larghezza del muro disegnato da `simboloMuro`. Esportata perché il Blocco D4 la serve anche
 * fuori di qui: `MuroSeparazione.tsx` la usa per l'area di presa e il contorno di selezione
 * sulla tela, che devono corrispondere all'ingombro vero e non a una seconda cifra scritta a
 * mano — la stessa ragione per cui `TRATTEGGIO_CONDENSE` è esportata.
 */
export const SPESSORE_MURO = 14

/**
 * Muro di separazione sala compressori / stabilimento: muratura tratteggiata a 45°, interrotta
 * da un varco per ogni tubazione che lo attraversa. Varchi troppo vicini vengono fusi in uno
 * solo, o fra i due resterebbe un moncone di muro largo pochi pixel.
 */
export function simboloMuro(x: number, yMin: number, yMax: number, varchi: number[]): string {
  const larghezzaVarco = 44

  const aperture: [number, number][] = []
  for (const y of [...new Set(varchi)].sort((a, b) => a - b)) {
    const inizio = y - larghezzaVarco / 2
    const fine = y + larghezzaVarco / 2
    const ultima = aperture[aperture.length - 1]
    if (ultima && inizio <= ultima[1] + 20) ultima[1] = Math.max(ultima[1], fine)
    else aperture.push([inizio, fine])
  }

  // I tronconi pieni sono ciò che resta del muro fra un'apertura e la successiva.
  const tronconi: [number, number][] = []
  let cursore = yMin
  for (const [inizio, fine] of aperture) {
    if (inizio > cursore) tronconi.push([cursore, inizio])
    cursore = Math.max(cursore, fine)
  }
  if (cursore < yMax) tronconi.push([cursore, yMax])

  const segmenti = tronconi
    .map(
      ([a, b]) =>
        `<rect x="${x}" y="${a}" width="${SPESSORE_MURO}" height="${b - a}" fill="none" stroke="#000" stroke-width="${TRATTO}" />`
    )
    .join('')

  const tratti = tronconi
    .flatMap(([a, b]) => {
      const righe: string[] = []
      for (let y = a; y + 12 < b; y += 12) righe.push(`M ${x} ${y + 12} L ${x + SPESSORE_MURO} ${y}`)
      return righe
    })
    .join(' ')

  return segmenti + `<path d="${tratti}" fill="none" stroke="#000" stroke-width="1" />`
}

/**
 * Punto di ancoraggio della contro-scala di un `<text>`: le sue proprie `x`/`y` quando le porta,
 * altrimenti quelle del primo `<tspan>` del suo contenuto.
 *
 * Il secondo caso è `testoMultiRiga`: il `<text>` che genera non porta `x`/`y` proprie (stanno sui
 * singoli `tspan`, una per riga), ma il PRIMO tspan porta l'ascissa e l'ordinata della prima riga
 * — le stesse `x`/`y` che il chiamante di `testoMultiRiga` ha passato — ed è quindi l'ancoraggio
 * naturale, esattamente come lo sono `x`/`y` per un `<text>` a riga singola.
 *
 * Se nessuno dei due porta coordinate (caso che oggi non si presenta), l'ancora ricade su (0,0):
 * un punto fisso di qualunque scala, quindi la contro-scala vi si annulla esattamente sulla
 * POSIZIONE — il testo riceve solo la traslazione del gruppo, non la sua scala. È il sintomo
 * concreto di un'ancora sbagliata (trovato in revisione sul terminale utenze prima di questa
 * correzione), non un semplice "meno preciso": ecco perché la lettura del tspan è la prima cosa da
 * tentare, e la (0,0) di riserva resta un ultimo ripiego silenzioso solo perché nessun caso reale
 * lo raggiunge più.
 */
function ancoraDiTesto(attributiText: string, contenuto: string): { x: number; y: number } {
  const xText = /\sx="(-?[\d.]+)"/.exec(attributiText)?.[1]
  const yText = /\sy="(-?[\d.]+)"/.exec(attributiText)?.[1]
  if (xText !== undefined && yText !== undefined) return { x: Number(xText), y: Number(yText) }
  const primoTspan = /<tspan\b([^>]*)>/.exec(contenuto)?.[1] ?? ''
  const x = Number(/\sx="(-?[\d.]+)"/.exec(primoTspan)?.[1] ?? 0)
  const y = Number(/\sy="(-?[\d.]+)"/.exec(primoTspan)?.[1] ?? 0)
  return { x, y }
}

/**
 * Contro-scala ogni `<text>` del frammento: la sagoma può stirarsi (è la deformazione che chi
 * tara ha scelto), ma una scritta stirata diventerebbe illeggibile. Il gruppo che avvolge la
 * sagoma applicherà `scale(sx sy)`; questa funzione anticipa l'inverso sul singolo `<text>`,
 * ancorato al suo punto proprio (`ancoraDiTesto`, `translate(x y) scale(1/sx 1/sy) translate(-x
 * -y)`), così l'anello sagoma-scritta si annulla per la sola FORMA della scritta e la sua POSIZIONE
 * segue comunque la trasformazione del gruppo, come ogni altro elemento — testo a riga singola e
 * multi-riga (`testoMultiRiga`) allo stesso modo, vedi `ancoraDiTesto`.
 *
 * Cattura l'elemento per intero (`<text ...>...</text>`, non solo il tag di apertura) perché il
 * caso multi-riga ha bisogno del contenuto per trovare il primo `<tspan>`.
 */
function controScalaTesti(svg: string, t: TaraturaSimbolo): string {
  if (t.sx === 1 && t.sy === 1) return svg
  const invSx = 1 / t.sx
  const invSy = 1 / t.sy
  return svg.replace(/<text\b([^>]*)>([\s\S]*?)<\/text>/g, (_intero, attributi: string, contenuto: string) => {
    const { x, y } = ancoraDiTesto(attributi, contenuto)
    const transform = `translate(${x} ${y}) scale(${invSx} ${invSy}) translate(${-x} ${-y})`
    return `<text${attributi} transform="${transform}">${contenuto}</text>`
  })
}

/**
 * Il meccanismo portante del Blocco 3: avvolge la sagoma (già disegnata in coordinate locali,
 * vedi il commento di testa al file) in un `<g>` che la trasla e la scala secondo la taratura,
 * mentre le ANCORE — dichiarate a parte in `t.ancore`, già sui multipli della griglia — non
 * passano di qui e non subiscono nulla: è questo a rendere possibile il gesto di chi tara, far
 * scorrere il disegno sotto pallini che restano fermi (vedi `TaraturaSimbolo` in `libreria.ts`).
 *
 * A taratura NEUTRA restituisce la stringa invariata, senza avvolgerla in un `<g>`: è ciò che
 * tiene fermi tutti i simboli non tarati, e con loro i riferimenti SVG committati (vedi
 * `simboli.test.ts`, test «la taratura neutra non aggiunge nulla»). Se emettesse un `<g>` anche
 * qui, ogni simbolo del documento cambierebbe senza che nulla sia davvero cambiato.
 */
export function simboloTrasformato(svg: string, t: TaraturaSimbolo): string {
  if (t.dx === 0 && t.dy === 0 && t.sx === 1 && t.sy === 1) return svg
  const controScalato = controScalaTesti(svg, t)
  return `<g transform="translate(${t.dx} ${t.dy}) scale(${t.sx} ${t.sy})">${controScalato}</g>`
}

/**
 * Ingombro dopo la taratura: l'inviluppo del riquadro della sagoma trasformata e di ogni ancora.
 * Non riceve l'SVG e non lo parsa — sarebbe fragile, e il registro dichiara già `dimensioni`, la
 * sola cosa che serve. Le ancore vivono già nel sistema finale (`TaraturaSimbolo.ancore`, sui
 * multipli della griglia) e NON subiscono la trasformazione (vedi `simboloTrasformato`): possono
 * quindi cadere fuori dal riquadro scalato della sagoma — è il caso, ad esempio, di un'ancora
 * spostata più in alto del disegno per far posto a una valvola — e quando succede l'ingombro deve
 * allargarsi per contenerle, o il nodo le taglierebbe fuori sulla tela.
 *
 * Restituisce un RIQUADRO e non due misure: `x`/`y` sono l'angolo alto-sinistro dell'inviluppo
 * nel sistema locale del nodo, e con `dx`/`dy` negativi — «avvicina il blocco al pallino
 * trascinandolo a sinistra», il gesto per cui il modo taratura esiste — sono negativi anche loro.
 * Fino alla revisione finale la funzione restituiva la sola misura (`maxX - minX`) e ogni
 * consumatore leggeva il riquadro come `[0 .. larghezza]` a partire da `node.position`: la parte
 * di sagoma a sinistra dell'origine restava fuori dal riquadro dichiarato, e le due catene ne
 * davano due letture diverse — sulla tela il `<svg viewBox="0 0 …">` la tagliava, nel documento
 * il `<g transform="translate(x y)">` la disegnava. Chi ha bisogno delle sole misure legge
 * `dimensioniDi`; chi deve disegnare o misurare il disegno legge `riquadroDi`.
 */
export function inviluppo(
  dimensioni: { larghezza: number; altezza: number },
  t: TaraturaSimbolo,
  ancore: SchemaAncora[]
): { x: number; y: number; larghezza: number; altezza: number } {
  // Riquadro della sagoma trasformata: parte da (0,0) — l'origine locale della sagoma — e finisce
  // in (larghezza*sx, altezza*sy), poi entrambi i capi si traslano di dx/dy. Min/max invece di
  // dare per scontato che il capo "0" resti il minimo: sx/sy negativi (una specchiatura) lo
  // capovolgerebbero, anche se nessuna taratura di oggi lo chiede.
  const x0 = t.dx
  const y0 = t.dy
  const x1 = t.dx + dimensioni.larghezza * t.sx
  const y1 = t.dy + dimensioni.altezza * t.sy

  let minX = Math.min(x0, x1)
  let maxX = Math.max(x0, x1)
  let minY = Math.min(y0, y1)
  let maxY = Math.max(y0, y1)

  for (const a of ancore) {
    minX = Math.min(minX, a.x)
    maxX = Math.max(maxX, a.x)
    minY = Math.min(minY, a.y)
    maxY = Math.max(maxY, a.y)
  }

  return { x: minX, y: minY, larghezza: maxX - minX, altezza: maxY - minY }
}
