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
 */
export const RIGHE_SVG_RIFERIMENTO_SENZA_TESTI = [
  `<svg xmlns="http://www.w3.org/2000/svg" width="909" height="800" viewBox="0 0 909 800">`,
  `<defs><marker id="freccia" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#000" /></marker></defs>`,
  `<rect width="909" height="800" fill="#fff" />`,
  `<path d="M 104.5 279 Q 109.5 276.53 104.5 274.07 Q 99.5 271.6 104.5 269.14 Q 109.5 266.67 104.5 264.2 Q 99.5 261.74 104.5 259.27 Q 109.5 256.81 104.5 254.34 Q 99.5 251.88 104.5 249.41 Q 109.5 246.94 104.5 244.48 Q 99.5 242.01 104.5 239.55 Q 109.5 237.08 104.5 234.61 Q 99.5 232.15 104.5 229.68 Q 109.5 227.22 104.5 224.75 Q 99.5 222.28 104.5 219.82 Q 109.5 217.35 104.5 214.89 Q 99.5 212.42 104.5 209.95 Q 109.5 207.49 104.5 205.02 Q 99.5 202.56 104.5 200.09 Q 109.5 197.63 104.5 195.16 Q 99.5 192.69 104.5 190.23 Q 109.5 187.76 104.5 185.3 Q 99.5 182.83 104.5 180.36 Q 109.5 177.9 104.5 175.43 Q 99.5 172.97 104.5 170.5 Q 107.01 175.5 109.51 170.5 Q 112.02 165.5 114.53 170.5 Q 117.04 175.5 119.54 170.5 Q 122.05 165.5 124.56 170.5 Q 127.07 175.5 129.57 170.5 Q 132.08 165.5 134.59 170.5 Q 137.1 175.5 139.6 170.5 Q 142.11 165.5 144.62 170.5 Q 147.13 175.5 149.63 170.5 Q 152.14 165.5 154.65 170.5 Q 157.15 175.5 159.66 170.5 Q 162.17 165.5 164.68 170.5 Q 167.18 175.5 169.69 170.5 Q 172.2 165.5 174.71 170.5 Q 177.21 175.5 179.72 170.5 Q 182.23 165.5 184.74 170.5 Q 187.24 175.5 189.75 170.5 Q 192.26 165.5 194.76 170.5 Q 197.27 175.5 199.78 170.5 Q 202.29 165.5 204.79 170.5 Q 207.3 175.5 209.81 170.5 Q 212.32 165.5 214.82 170.5 Q 217.33 175.5 219.84 170.5 Q 222.35 165.5 224.85 170.5 Q 227.36 175.5 229.87 170.5 Q 232.38 165.5 234.88 170.5 Q 237.39 175.5 239.9 170.5 Q 242.4 165.5 244.91 170.5 Q 247.42 175.5 249.93 170.5 Q 252.43 165.5 254.94 170.5 Q 257.45 175.5 259.96 170.5 Q 262.46 165.5 264.97 170.5 Q 267.48 175.5 269.99 170.5 Q 272.49 165.5 275 170.5 Q 270 172.97 275 175.43 Q 280 177.9 275 180.36 Q 270 182.83 275 185.3 Q 280 187.76 275 190.23 Q 270 192.69 275 195.16 Q 280 197.63 275 200.09 Q 270 202.56 275 205.02 Q 280 207.49 275 209.95 Q 270 212.42 275 214.89 Q 280 217.35 275 219.82 Q 270 222.28 275 224.75 Q 280 227.22 275 229.68 Q 270 232.15 275 234.61 Q 280 237.08 275 239.55 Q 270 242.01 275 244.48 Q 280 246.94 275 249.41 Q 270 251.88 275 254.34 Q 280 256.81 275 259.27 Q 270 261.74 275 264.2 Q 280 266.67 275 269.14 Q 270 271.6 275 274.07 Q 280 276.53 275 279 Q 277.43 284 279.86 279 Q 282.29 274 284.71 279 Q 287.14 284 289.57 279 Q 292 274 294.43 279 Q 296.86 284 299.29 279 Q 301.71 274 304.14 279 Q 306.57 279 309 279" fill="none" stroke="#000" stroke-width="2" marker-end="url(#freccia)" />`,
  `<rect x="197.75" y="162.5" width="18" height="16" fill="#fff" stroke="none" />`,
  `<path d="M 197.75 162.5 L 197.75 178.5 L 206.75 170.5 Z M 215.75 162.5 L 215.75 178.5 L 206.75 170.5 Z" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" />`,
  `<path d="M 619 279 L 655 279 L 655 259 L 691 259" fill="none" stroke="#000" stroke-width="2" />`,
  `<g transform="translate(40 279)"><rect x="0" y="0" width="129" height="129" fill="none" stroke="#000" stroke-width="2" /><circle cx="64.5" cy="64.5" r="32.25" fill="none" stroke="#000" stroke-width="2" /><path d="M 49.9875 35.7975 L 92.5575 48.375" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /><path d="M 49.9875 93.2025 L 92.5575 80.625" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /><text x="10" y="20" font-family="Arial, Helvetica, sans-serif" font-size="24" text-anchor="start" dominant-baseline="central" fill="#000">C1</text></g>`,
  `<g transform="translate(309 190.5)"><rect x="0" y="40" width="310" height="97" rx="48.5" ry="48.5" fill="none" stroke="#000" stroke-width="2" /><text x="192.2" y="88.5" font-family="Arial, Helvetica, sans-serif" font-size="24" text-anchor="middle" dominant-baseline="central" fill="#000">S1</text><path d="M 68.2 40 L 68.2 34" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /><rect x="62.2" y="22" width="12" height="12" fill="none" stroke="#000" stroke-width="2" /><path d="M 62.2 25 L 74.2 25 M 62.2 28 L 74.2 28 M 62.2 31 L 74.2 31" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /><text x="68.2" y="10" font-family="Arial, Helvetica, sans-serif" font-size="14" text-anchor="middle" dominant-baseline="central" fill="#000">S1.1</text><path d="M 237.3 138 L 246.3 138 L 241.8 147 Z M 237.3 156 L 246.3 156 L 241.8 147 Z" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /><path d="M 241.8 156 L 241.8 164" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /></g>`,
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
