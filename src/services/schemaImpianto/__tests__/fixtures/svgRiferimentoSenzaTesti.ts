/**
 * SVG di riferimento per il test 'un layout senza testi resta identico a prima' (renderSvg.test.ts).
 *
 * Copre UN SOLO impianto: compressore + serbatoio orizzontale, senza note tubazioni e senza pozzo
 * di raccolta condense (lo stesso di `svgMinimo()`/`layoutConTesti([])` in
 * renderSvg.test.ts). Non intercetta quindi un cambiamento che tocchi solo il muro di separazione
 * o le linee condense: nessuno dei due compare in questo disegno.
 *
 * È un riferimento ESTERNO al codice corrente, non un self-comparison: un confronto
 * `renderSvg(x) === renderSvg(x)` non discrimina nulla, perché i due lati passano sempre
 * per lo stesso codice — è la ragione per cui una versione precedente di questo test (`testi: []`
 * contro `testi: undefined`) non si accorgeva di un elemento costante aggiunto a ogni SVG.
 *
 * Un elemento per riga, non un unico blocco da ~8300 caratteri: quando questo test cade, il valore
 * sta nel diff che qualcuno guarda per decidere se il cambiamento è voluto. Una stringa su riga
 * singola renderebbe quel diff una riga tolta e una messa da ottomila caratteri — illeggibile
 * quanto un binario, e il primo cambiamento legittimo verrebbe approvato senza essere guardato.
 *
 * Quando è legittimo aggiornarlo: SOLO quando si cambia di proposito il disegno di QUESTO impianto
 * (per esempio un ritocco alla geometria di un simbolo, o alla tabella) — mai per far tornare verde
 * questo test. Per rigenerarlo: rendere lo stesso layout (`layoutConTesti([])` nel test) con il
 * codice NUOVO, spezzare l'SVG risultante un elemento per riga come qui sotto (un
 * `<rect>`/`<line>`/`<text>`/`<path>`/`<g>` top-level per voce), e aggiornare la riga
 * "generato l'ultima volta dal commit" con l'hash del commit che introduce il cambiamento voluto —
 * il motivo del cambiamento va nel messaggio di quel commit, non ripetuto qui.
 *
 * Generato l'ultima volta dal commit 86a3767 ("feat(schema): la linea si interrompe dentro
 * valvole e riduttori"), Task 3 del Blocco D4: il rettangolo bianco che copre la farfalla della
 * valvola di intercettazione (`<rect ... fill="#fff" />` prima del `<path>` della farfalla, sia
 * nel disegno sia nella riga di legenda).
 *
 * Verificato di nuovo al commit 5cfe586 ("feat(schema): il muro non si disegna piu' da solo"),
 * Task 5 del Blocco D4: contenuto invariato. L'impianto di questa fixture ha un solo gruppo
 * (compressore + serbatoio, nessuno in linea distribuzione), quindi non aveva un muro nemmeno
 * prima — il Task 5, che toglie il muro disegnato in automatico, non ha nulla da togliere qui.
 *
 * Generato di nuovo al commit 2bb8482 ("feat(schema): i tre rombi si distinguono per il segno
 * interno, come nel CAD"), Task 3 del Blocco 3: `valvolaScarico` prende una misura
 * ('serbatoio' | 'apparecchio') e la farfalla del serbatoio S1 diventa più stretta (semilarghezza
 * 8 -> 4,5, rapporto ~1:2 misurato sul CAD anziché l'8:9 quasi quadrato di prima) — nel disegno e
 * nella riga di legenda "Valvola di scarico". Questo impianto non porta essiccatori, filtri né
 * separatori: il segno interno dei tre rombi (l'altra metà del task) non è coperto qui.
 *
 * Generato di nuovo al commit ebbde4c ("feat(schema): proporzioni dei simboli dai blocchi CAD,
 * ingombro proprio per il serbatoio orizzontale"), Task 4 del Blocco 3: il compressore diventa
 * quadrato (129×129, prima 160×150) con la girante a due corde oblique, e il serbatoio
 * orizzontale ha un riquadro proprio (310×137, prima condiviso col verticale 150×260) — cambiano
 * `viewBox`, tutte le coordinate dei nodi e dei tubi, e il markup della girante. Questo impianto
 * non porta un pacco bombole (nessun nodo di quel tipo in `svgMinimo()`). Il testo della tabella
 * e delle legende non cambia.
 *
 * Verificato di nuovo (fix round 1, revisione dello stesso Task 4): il serbatoio orizzontale ora
 * allinea la propria base a quella del compressore per altezza vera (`disponiInRiga`,
 * allineamento `'basso'`, layout.ts) invece che su un'altezza di riga assunta uniforme — sposta
 * ulteriormente le coordinate di nodi e tubi, nessun altro cambiamento.
 *
 * Generato di nuovo al commit cb31278 ("feat(schema): le ancore di fabbrica cadono tutte sulla
 * griglia"), Task 8 del Blocco 3: le ancore di
 * fabbrica sono arrotondate ai multipli di 10, quindi ogni ingombro che ne dipende cambia di
 * qualche unità — compressore 129×129 → 120×120, serbatoio orizzontale 310×137 → 310×140,
 * terminale utenze `UTENZE.x` 12 → 10. Cambiano il `viewBox`, i capi degli archi (mandata
 * flessibile e linea condense verso il terminale), le coordinate dei nodi (compressore,
 * serbatoio, terminale) e, di conseguenza, la quota `y` di ogni riga della tabella (l'impianto è
 * complessivamente un po' più alto). Il testo delle celle e delle voci di legenda non cambia:
 * solo le quote si spostano.
 */
export const RIGHE_SVG_RIFERIMENTO_SENZA_TESTI = [
  `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="802" viewBox="0 0 900 802">`,
  `<defs><marker id="freccia" viewBox="0 0 15 10" refX="14" refY="5" markerWidth="9" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 15 5 L 0 10 z" fill="#000" /></marker></defs>`,
  `<rect width="900" height="802" fill="#fff" />`,
  `<path d="M 100 290 Q 105 287.5 100 285 Q 95 282.5 100 280 Q 105 277.5 100 275 Q 95 272.5 100 270 Q 105 267.5 100 265 Q 95 262.5 100 260 Q 105 257.5 100 255 Q 95 252.5 100 250 Q 102.52 255 105.03 250 Q 107.55 245 110.06 250 Q 112.58 255 115.09 250 Q 117.61 245 120.12 250 Q 122.64 255 125.15 250 Q 127.67 245 130.18 250 Q 132.7 255 135.21 250 Q 137.73 245 140.24 250 Q 142.76 255 145.27 250 Q 147.79 245 150.3 250 Q 152.82 255 155.33 250 Q 157.85 245 160.36 250 Q 162.88 255 165.39 250 Q 167.91 245 170.42 250 Q 172.94 255 175.45 250 Q 177.97 245 180.48 250 Q 183 255 185.52 250 Q 188.03 245 190.55 250 Q 193.06 255 195.58 250 Q 198.09 245 200.61 250 Q 203.12 255 205.64 250 Q 208.15 245 210.67 250 Q 213.18 255 215.7 250 Q 218.21 245 220.73 250 Q 223.24 255 225.76 250 Q 228.27 245 230.79 250 Q 233.3 255 235.82 250 Q 238.33 245 240.85 250 Q 243.36 255 245.88 250 Q 248.39 245 250.91 250 Q 253.42 255 255.94 250 Q 258.45 245 260.97 250 Q 263.48 255 266 250 Q 261 252.5 266 255 Q 271 257.5 266 260 Q 261 262.5 266 265 Q 271 267.5 266 270 Q 261 272.5 266 275 Q 271 277.5 266 280 Q 261 282.5 266 285 Q 271 287.5 266 290 Q 261 292.5 266 295 Q 271 297.5 266 300 Q 261 302.5 266 305 Q 271 307.5 266 310 Q 261 312.5 266 315 Q 271 317.5 266 320 Q 261 322.5 266 325 Q 271 327.5 266 330 Q 261 332.5 266 335 Q 271 337.5 266 340 Q 261 342.5 266 345 Q 271 347.5 266 350 Q 261 352.5 266 355 Q 271 357.5 266 360 Q 268.43 365 270.86 360 Q 273.29 355 275.71 360 Q 278.14 365 280.57 360 Q 283 355 285.43 360 Q 287.86 365 290.29 360 Q 292.71 355 295.14 360 Q 297.57 360 300 360" fill="none" stroke="#000" stroke-width="2" marker-end="url(#freccia)" />`,
  `<rect x="226" y="245.5" width="18" height="9" fill="#fff" stroke="none" />`,
  `<path d="M 226 245.5 L 226 254.5 L 235 250 Z M 244 245.5 L 244 254.5 L 235 250 Z" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" />`,
  `<path d="M 610 360 L 645 360 L 645 260 L 680 260" fill="none" stroke="#000" stroke-width="2" />`,
  `<g transform="translate(40 290)"><rect x="0" y="0" width="120" height="120" fill="none" stroke="#000" stroke-width="2" /><circle cx="60" cy="60" r="30" fill="none" stroke="#000" stroke-width="2" /><path d="M 46.5 33.3 L 86.1 45" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /><path d="M 46.5 86.7 L 86.1 75" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /><text x="10" y="20" font-family="Arial, Helvetica, sans-serif" font-size="24" text-anchor="start" dominant-baseline="central" fill="#000">C1</text></g>`,
  `<g transform="translate(300 270)"><rect x="0" y="40" width="310" height="100" rx="50" ry="50" fill="none" stroke="#000" stroke-width="2" /><text x="192.2" y="90" font-family="Arial, Helvetica, sans-serif" font-size="24" text-anchor="middle" dominant-baseline="central" fill="#000">S1</text><path d="M 70 40 L 70 34" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /><rect x="64" y="22" width="12" height="12" fill="none" stroke="#000" stroke-width="2" /><path d="M 64 25 L 76 25 M 64 28 L 76 28 M 64 31 L 76 31" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /><text x="70" y="10" font-family="Arial, Helvetica, sans-serif" font-size="14" text-anchor="middle" dominant-baseline="central" fill="#000">S1.1</text><path d="M 235.5 141 L 244.5 141 L 240 150 Z M 235.5 159 L 244.5 159 L 240 150 Z" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /><path d="M 240 159 L 240 167" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /></g>`,
  `<g transform="translate(670 140)"><path d="M 10 120 L 10 26" fill="none" stroke="#000" stroke-width="2" stroke-dasharray="10 7" /><path d="M 4 27 L 10 14 L 16 27 Z" fill="#000" /><text font-family="Arial, Helvetica, sans-serif" font-size="18" text-anchor="start" dominant-baseline="central" fill="#000"><tspan x="28" y="20">Utenze aria</tspan></text></g>`,
  `<rect x="40" y="490" width="820" height="34" fill="none" stroke="#000" stroke-width="2" />`,
  `<text x="450" y="507" font-family="Arial, Helvetica, sans-serif" font-size="20" text-anchor="middle" dominant-baseline="central" fill="#000">LISTA APPARECCHIATURE</text>`,
  `<rect x="40" y="524" width="820" height="34" fill="none" stroke="#000" stroke-width="1" />`,
  `<line x1="170" y1="524" x2="170" y2="558" stroke="#000" stroke-width="1" />`,
  `<text x="105" y="541" font-family="Arial, Helvetica, sans-serif" font-size="16" text-anchor="middle" dominant-baseline="central" fill="#000">C1</text>`,
  `<text x="182" y="541" font-family="Arial, Helvetica, sans-serif" font-size="16" dominant-baseline="central" fill="#000">Compressore KAESER Mod. CSD 105 SFC</text>`,
  `<rect x="40" y="558" width="820" height="34" fill="none" stroke="#000" stroke-width="1" />`,
  `<line x1="170" y1="558" x2="170" y2="592" stroke="#000" stroke-width="1" />`,
  `<text x="105" y="575" font-family="Arial, Helvetica, sans-serif" font-size="16" text-anchor="middle" dominant-baseline="central" fill="#000">S1</text>`,
  `<text x="182" y="575" font-family="Arial, Helvetica, sans-serif" font-size="16" dominant-baseline="central" fill="#000">Serbatoio SICC TECH s.r.l. Mod. 2000-20011R2</text>`,
  `<rect x="40" y="592" width="820" height="34" fill="none" stroke="#000" stroke-width="1" />`,
  `<line x1="170" y1="592" x2="170" y2="626" stroke="#000" stroke-width="1" />`,
  `<text x="105" y="609" font-family="Arial, Helvetica, sans-serif" font-size="16" text-anchor="middle" dominant-baseline="central" fill="#000">S1.1</text>`,
  `<text x="182" y="609" font-family="Arial, Helvetica, sans-serif" font-size="16" dominant-baseline="central" fill="#000">Valvola di sicurezza PADOVAN VALERIO snc Mod. TA21</text>`,
  `<rect x="40" y="626" width="820" height="34" fill="none" stroke="#000" stroke-width="1" />`,
  `<line x1="170" y1="626" x2="170" y2="660" stroke="#000" stroke-width="1" />`,
  `<g transform="translate(105 643)"><rect x="-9" y="-4.5" width="18" height="9" fill="#fff" stroke="none" /><path d="M -9 -4.5 L -9 4.5 L 0 0 Z M 9 -4.5 L 9 4.5 L 0 0 Z" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /></g>`,
  `<text x="182" y="643" font-family="Arial, Helvetica, sans-serif" font-size="16" dominant-baseline="central" fill="#000">Valvola di intercettazione</text>`,
  `<rect x="40" y="660" width="820" height="34" fill="none" stroke="#000" stroke-width="1" />`,
  `<line x1="170" y1="660" x2="170" y2="694" stroke="#000" stroke-width="1" />`,
  `<g transform="translate(105 677)"><path d="M -4.5 -13 L 4.5 -13 L 0 -4 Z M -4.5 5 L 4.5 5 L 0 -4 Z" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /><path d="M 0 5 L 0 13" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /></g>`,
  `<text x="182" y="677" font-family="Arial, Helvetica, sans-serif" font-size="16" dominant-baseline="central" fill="#000">Valvola di scarico</text>`,
  `<rect x="40" y="694" width="820" height="34" fill="none" stroke="#000" stroke-width="1" />`,
  `<line x1="170" y1="694" x2="170" y2="728" stroke="#000" stroke-width="1" />`,
  `<g transform="translate(105 711)"><path d="M -30 0 L 30 0" fill="none" stroke="#000" stroke-width="2" /></g>`,
  `<text x="182" y="711" font-family="Arial, Helvetica, sans-serif" font-size="16" dominant-baseline="central" fill="#000">Tubazione rigida</text>`,
  `<rect x="40" y="728" width="820" height="34" fill="none" stroke="#000" stroke-width="1" />`,
  `<line x1="170" y1="728" x2="170" y2="762" stroke="#000" stroke-width="1" />`,
  `<g transform="translate(105 745)"><path d="M -30 0 Q -27.5 5 -25 0 Q -22.5 -5 -20 0 Q -17.5 5 -15 0 Q -12.5 -5 -10 0 Q -7.5 5 -5 0 Q -2.5 -5 0 0 Q 2.5 5 5 0 Q 7.5 -5 10 0 Q 12.5 5 15 0 Q 17.5 -5 20 0 Q 22.5 5 25 0 Q 27.5 0 30 0" fill="none" stroke="#000" stroke-width="2" /></g>`,
  `<text x="182" y="745" font-family="Arial, Helvetica, sans-serif" font-size="16" dominant-baseline="central" fill="#000">Tubazione flessibile</text>`,
  `</svg>`

]

/** Ricomposto qui, non lasciato come array nel test: il confronto resta su una stringa sola. */
export const SVG_RIFERIMENTO_SENZA_TESTI = RIGHE_SVG_RIFERIMENTO_SENZA_TESTI.join('')
