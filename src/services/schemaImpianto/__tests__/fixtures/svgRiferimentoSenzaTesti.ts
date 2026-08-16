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
 */
export const RIGHE_SVG_RIFERIMENTO_SENZA_TESTI = [
  `<svg xmlns="http://www.w3.org/2000/svg" width="909" height="800" viewBox="0 0 909 800">`,
  `<defs><marker id="freccia" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#000" /></marker></defs>`,
  `<rect width="909" height="800" fill="#fff" />`,
  `<path d="M 104.5 279 Q 109.5 276.67 104.5 274.33 Q 99.5 272 104.5 269.67 Q 109.5 267.33 104.5 265 Q 99.5 262.67 104.5 260.33 Q 109.5 258 104.5 255.67 Q 99.5 253.33 104.5 251 Q 107.01 256 109.51 251 Q 112.02 246 114.53 251 Q 117.04 256 119.54 251 Q 122.05 246 124.56 251 Q 127.07 256 129.57 251 Q 132.08 246 134.59 251 Q 137.1 256 139.6 251 Q 142.11 246 144.62 251 Q 147.13 256 149.63 251 Q 152.14 246 154.65 251 Q 157.15 256 159.66 251 Q 162.17 246 164.68 251 Q 167.18 256 169.69 251 Q 172.2 246 174.71 251 Q 177.21 256 179.72 251 Q 182.23 246 184.74 251 Q 187.24 256 189.75 251 Q 192.26 246 194.76 251 Q 197.27 256 199.78 251 Q 202.29 246 204.79 251 Q 207.3 256 209.81 251 Q 212.32 246 214.82 251 Q 217.33 256 219.84 251 Q 222.35 246 224.85 251 Q 227.36 256 229.87 251 Q 232.38 246 234.88 251 Q 237.39 256 239.9 251 Q 242.4 246 244.91 251 Q 247.42 256 249.93 251 Q 252.43 246 254.94 251 Q 257.45 256 259.96 251 Q 262.46 246 264.97 251 Q 267.48 256 269.99 251 Q 272.49 246 275 251 Q 270 253.47 275 255.93 Q 280 258.4 275 260.86 Q 270 263.33 275 265.8 Q 280 268.26 275 270.73 Q 270 273.19 275 275.66 Q 280 278.13 275 280.59 Q 270 283.06 275 285.52 Q 280 287.99 275 290.45 Q 270 292.92 275 295.39 Q 280 297.85 275 300.32 Q 270 302.78 275 305.25 Q 280 307.72 275 310.18 Q 270 312.65 275 315.11 Q 280 317.58 275 320.05 Q 270 322.51 275 324.98 Q 280 327.44 275 329.91 Q 270 332.38 275 334.84 Q 280 337.31 275 339.77 Q 270 342.24 275 344.7 Q 280 347.17 275 349.64 Q 270 352.1 275 354.57 Q 280 357.03 275 359.5 Q 277.43 364.5 279.86 359.5 Q 282.29 354.5 284.71 359.5 Q 287.14 364.5 289.57 359.5 Q 292 354.5 294.43 359.5 Q 296.86 364.5 299.29 359.5 Q 301.71 354.5 304.14 359.5 Q 306.57 359.5 309 359.5" fill="none" stroke="#000" stroke-width="2" marker-end="url(#freccia)" />`,
  `<rect x="238" y="243" width="18" height="16" fill="#fff" stroke="none" />`,
  `<path d="M 238 243 L 238 259 L 247 251 Z M 256 243 L 256 259 L 247 251 Z" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" />`,
  `<path d="M 619 359.5 L 655 359.5 L 655 259 L 691 259" fill="none" stroke="#000" stroke-width="2" />`,
  `<g transform="translate(40 279)"><rect x="0" y="0" width="129" height="129" fill="none" stroke="#000" stroke-width="2" /><circle cx="64.5" cy="64.5" r="32.25" fill="none" stroke="#000" stroke-width="2" /><path d="M 49.9875 35.7975 L 92.5575 48.375" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /><path d="M 49.9875 93.2025 L 92.5575 80.625" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /><text x="10" y="20" font-family="Arial, Helvetica, sans-serif" font-size="24" text-anchor="start" dominant-baseline="central" fill="#000">C1</text></g>`,
  `<g transform="translate(309 271)"><rect x="0" y="40" width="310" height="97" rx="48.5" ry="48.5" fill="none" stroke="#000" stroke-width="2" /><text x="192.2" y="88.5" font-family="Arial, Helvetica, sans-serif" font-size="24" text-anchor="middle" dominant-baseline="central" fill="#000">S1</text><path d="M 68.2 40 L 68.2 34" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /><rect x="62.2" y="22" width="12" height="12" fill="none" stroke="#000" stroke-width="2" /><path d="M 62.2 25 L 74.2 25 M 62.2 28 L 74.2 28 M 62.2 31 L 74.2 31" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /><text x="68.2" y="10" font-family="Arial, Helvetica, sans-serif" font-size="14" text-anchor="middle" dominant-baseline="central" fill="#000">S1.1</text><path d="M 237.3 138 L 246.3 138 L 241.8 147 Z M 237.3 156 L 246.3 156 L 241.8 147 Z" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /><path d="M 241.8 156 L 241.8 164" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /></g>`,
  `<g transform="translate(679 139)"><path d="M 12 120 L 12 26" fill="none" stroke="#000" stroke-width="2" stroke-dasharray="10 7" /><path d="M 6 27 L 12 14 L 18 27 Z" fill="#000" /><text font-family="Arial, Helvetica, sans-serif" font-size="18" text-anchor="start" dominant-baseline="central" fill="#000"><tspan x="30" y="20">Utenze aria</tspan></text></g>`,
  `<rect x="40" y="488" width="829" height="34" fill="none" stroke="#000" stroke-width="2" />`,
  `<text x="454.5" y="505" font-family="Arial, Helvetica, sans-serif" font-size="20" text-anchor="middle" dominant-baseline="central" fill="#000">LISTA APPARECCHIATURE</text>`,
  `<rect x="40" y="522" width="829" height="34" fill="none" stroke="#000" stroke-width="1" />`,
  `<line x1="170" y1="522" x2="170" y2="556" stroke="#000" stroke-width="1" />`,
  `<text x="105" y="539" font-family="Arial, Helvetica, sans-serif" font-size="16" text-anchor="middle" dominant-baseline="central" fill="#000">C1</text>`,
  `<text x="182" y="539" font-family="Arial, Helvetica, sans-serif" font-size="16" dominant-baseline="central" fill="#000">Compressore KAESER Mod. CSD 105 SFC</text>`,
  `<rect x="40" y="556" width="829" height="34" fill="none" stroke="#000" stroke-width="1" />`,
  `<line x1="170" y1="556" x2="170" y2="590" stroke="#000" stroke-width="1" />`,
  `<text x="105" y="573" font-family="Arial, Helvetica, sans-serif" font-size="16" text-anchor="middle" dominant-baseline="central" fill="#000">S1</text>`,
  `<text x="182" y="573" font-family="Arial, Helvetica, sans-serif" font-size="16" dominant-baseline="central" fill="#000">Serbatoio SICC TECH s.r.l. Mod. 2000-20011R2</text>`,
  `<rect x="40" y="590" width="829" height="34" fill="none" stroke="#000" stroke-width="1" />`,
  `<line x1="170" y1="590" x2="170" y2="624" stroke="#000" stroke-width="1" />`,
  `<text x="105" y="607" font-family="Arial, Helvetica, sans-serif" font-size="16" text-anchor="middle" dominant-baseline="central" fill="#000">S1.1</text>`,
  `<text x="182" y="607" font-family="Arial, Helvetica, sans-serif" font-size="16" dominant-baseline="central" fill="#000">Valvola di sicurezza PADOVAN VALERIO snc Mod. TA21</text>`,
  `<rect x="40" y="624" width="829" height="34" fill="none" stroke="#000" stroke-width="1" />`,
  `<line x1="170" y1="624" x2="170" y2="658" stroke="#000" stroke-width="1" />`,
  `<g transform="translate(105 641)"><rect x="-9" y="-8" width="18" height="16" fill="#fff" stroke="none" /><path d="M -9 -8 L -9 8 L 0 0 Z M 9 -8 L 9 8 L 0 0 Z" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /></g>`,
  `<text x="182" y="641" font-family="Arial, Helvetica, sans-serif" font-size="16" dominant-baseline="central" fill="#000">Valvola di intercettazione</text>`,
  `<rect x="40" y="658" width="829" height="34" fill="none" stroke="#000" stroke-width="1" />`,
  `<line x1="170" y1="658" x2="170" y2="692" stroke="#000" stroke-width="1" />`,
  `<g transform="translate(105 675)"><path d="M -4.5 -13 L 4.5 -13 L 0 -4 Z M -4.5 5 L 4.5 5 L 0 -4 Z" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /><path d="M 0 5 L 0 13" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /></g>`,
  `<text x="182" y="675" font-family="Arial, Helvetica, sans-serif" font-size="16" dominant-baseline="central" fill="#000">Valvola di scarico</text>`,
  `<rect x="40" y="692" width="829" height="34" fill="none" stroke="#000" stroke-width="1" />`,
  `<line x1="170" y1="692" x2="170" y2="726" stroke="#000" stroke-width="1" />`,
  `<g transform="translate(105 709)"><path d="M -30 0 L 30 0" fill="none" stroke="#000" stroke-width="2" /></g>`,
  `<text x="182" y="709" font-family="Arial, Helvetica, sans-serif" font-size="16" dominant-baseline="central" fill="#000">Tubazione rigida</text>`,
  `<rect x="40" y="726" width="829" height="34" fill="none" stroke="#000" stroke-width="1" />`,
  `<line x1="170" y1="726" x2="170" y2="760" stroke="#000" stroke-width="1" />`,
  `<g transform="translate(105 743)"><path d="M -30 0 Q -27.5 5 -25 0 Q -22.5 -5 -20 0 Q -17.5 5 -15 0 Q -12.5 -5 -10 0 Q -7.5 5 -5 0 Q -2.5 -5 0 0 Q 2.5 5 5 0 Q 7.5 -5 10 0 Q 12.5 5 15 0 Q 17.5 -5 20 0 Q 22.5 5 25 0 Q 27.5 0 30 0" fill="none" stroke="#000" stroke-width="2" /></g>`,
  `<text x="182" y="743" font-family="Arial, Helvetica, sans-serif" font-size="16" dominant-baseline="central" fill="#000">Tubazione flessibile</text>`,
  `</svg>`,
]

/** Ricomposto qui, non lasciato come array nel test: il confronto resta su una stringa sola. */
export const SVG_RIFERIMENTO_SENZA_TESTI = RIGHE_SVG_RIFERIMENTO_SENZA_TESTI.join('')
