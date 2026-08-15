/**
 * SVG di riferimento per il test 'un impianto con un TEE resta identico al riferimento'
 * (renderSvg.test.ts).
 *
 * Copre UN SOLO impianto: compressore + serbatoio orizzontale, senza note tubazioni e senza pozzo
 * di raccolta condense, con una giunzione (TEE) inserita a metà del tubo che porta alle utenze
 * (`layoutConTee()` in renderSvg.test.ts) — due tubi la toccano da lati opposti (sx/dx), il minimo
 * che eserciti sia il raggio del pallino sia la convergenza dei capi al centro del riquadro. Non
 * intercetta quindi un cambiamento che tocchi solo il muro di separazione, le linee condense o un
 * attacco 'alto'/'basso' della giunzione: nessuno dei tre compare in questo disegno.
 *
 * È un riferimento ESTERNO al codice corrente, non un self-comparison: un confronto
 * `renderSvg(x) === renderSvg(x)` non discrimina nulla, perché i due lati passano sempre per lo
 * stesso codice (vedi il commento gemello in svgRiferimentoSenzaTesti.ts, che lo dimostra con la
 * revisione del `<g id="annotazioni"></g>` costante). Solo un riferimento congelato a un punto nel
 * tempo lo scopre — qui, la geometria della giunzione decisa nel Blocco D3: pallino a diametro 10
 * (raggio 5) e le sue quattro ancore tutte al centro del riquadro 24×24, non più sulle mezzerie dei
 * lati.
 *
 * Un elemento per riga, non un unico blocco da ~8500 caratteri: quando questo test cade, il valore
 * sta nel diff che qualcuno guarda per decidere se il cambiamento è voluto. Una stringa su riga
 * singola renderebbe quel diff una riga tolta e una messa da ottomila caratteri — illeggibile
 * quanto un binario, e il primo cambiamento legittimo verrebbe approvato senza essere guardato.
 *
 * Quando è legittimo aggiornarlo: SOLO quando si cambia di proposito il disegno di QUESTO impianto
 * (per esempio un ritocco alla geometria della giunzione, o alla tabella) — mai per far tornare
 * verde questo test. Per rigenerarlo: rendere lo stesso layout (`layoutConTee()` nel test) con il
 * codice NUOVO, spezzare l'SVG risultante un elemento per riga come qui sotto (un
 * `<rect>`/`<line>`/`<text>`/`<path>`/`<g>` top-level per voce), e aggiornare la riga
 * "generato l'ultima volta dal commit" con l'hash del commit che introduce il cambiamento voluto —
 * il motivo del cambiamento va nel messaggio di quel commit, non ripetuto qui.
 *
 * Generato l'ultima volta dal commit f13a090 ("feat(schema): la linea si interrompe dentro
 * valvole e riduttori"), Task 3 del Blocco D4: il rettangolo bianco che copre la farfalla della
 * valvola di intercettazione (`<rect ... fill="#fff" />` prima del `<path>` della farfalla, sia
 * nel disegno sia nella riga di legenda).
 */
export const RIGHE_SVG_RIFERIMENTO_CON_TEE = [
  `<svg xmlns="http://www.w3.org/2000/svg" width="830" height="762" viewBox="0 0 830 762">`,
  `<defs><marker id="freccia" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#000" /></marker></defs>`,
  `<rect width="830" height="762" fill="#fff" />`,
  `<path d="M 120 220 Q 125 217.5 120 215 Q 115 212.5 120 210 Q 125 207.5 120 205 Q 115 202.5 120 200 Q 125 197.5 120 195 Q 115 192.5 120 190 Q 125 187.5 120 185 Q 115 182.5 120 180 Q 125 177.5 120 175 Q 115 172.5 120 170 Q 125 167.5 120 165 Q 115 162.5 120 160 Q 125 157.5 120 155 Q 115 152.5 120 150 Q 125 147.5 120 145 Q 115 142.5 120 140 Q 125 137.5 120 135 Q 115 132.5 120 130 Q 125 127.5 120 125 Q 115 122.5 120 120 Q 125 117.5 120 115 Q 115 112.5 120 110 Q 125 107.5 120 105 Q 115 102.5 120 100 Q 125 97.5 120 95 Q 115 92.5 120 90 Q 122.51 95 125.03 90 Q 127.54 85 130.05 90 Q 132.57 95 135.08 90 Q 137.59 85 140.11 90 Q 142.62 95 145.14 90 Q 147.65 85 150.16 90 Q 152.68 95 155.19 90 Q 157.7 85 160.22 90 Q 162.73 95 165.24 90 Q 167.76 85 170.27 90 Q 172.78 95 175.3 90 Q 177.81 85 180.32 90 Q 182.84 95 185.35 90 Q 187.86 85 190.38 90 Q 192.89 95 195.41 90 Q 197.92 85 200.43 90 Q 202.95 95 205.46 90 Q 207.97 85 210.49 90 Q 213 95 215.51 90 Q 218.03 85 220.54 90 Q 223.05 95 225.57 90 Q 228.08 85 230.59 90 Q 233.11 95 235.62 90 Q 238.14 85 240.65 90 Q 243.16 95 245.68 90 Q 248.19 85 250.7 90 Q 253.22 95 255.73 90 Q 258.24 85 260.76 90 Q 263.27 95 265.78 90 Q 268.3 85 270.81 90 Q 273.32 95 275.84 90 Q 278.35 85 280.86 90 Q 283.38 95 285.89 90 Q 288.41 85 290.92 90 Q 293.43 95 295.95 90 Q 298.46 85 300.97 90 Q 303.49 95 306 90 Q 301 92.5 306 95 Q 311 97.5 306 100 Q 301 102.5 306 105 Q 311 107.5 306 110 Q 301 112.5 306 115 Q 311 117.5 306 120 Q 301 122.5 306 125 Q 311 127.5 306 130 Q 301 132.5 306 135 Q 311 137.5 306 140 Q 301 142.5 306 145 Q 311 147.5 306 150 Q 301 152.5 306 155 Q 311 157.5 306 160 Q 301 162.5 306 165 Q 311 167.5 306 170 Q 301 172.5 306 175 Q 311 177.5 306 180 Q 301 182.5 306 185 Q 311 187.5 306 190 Q 301 192.5 306 195 Q 311 197.5 306 200 Q 301 202.5 306 205 Q 311 207.5 306 210 Q 301 212.5 306 215 Q 311 217.5 306 220 Q 301 222.5 306 225 Q 311 227.5 306 230 Q 301 232.5 306 235 Q 311 237.5 306 240 Q 308.43 245 310.86 240 Q 313.29 235 315.71 240 Q 318.14 245 320.57 240 Q 323 235 325.43 240 Q 327.86 245 330.29 240 Q 332.71 235 335.14 240 Q 337.57 240 340 240" fill="none" stroke="#000" stroke-width="2" marker-end="url(#freccia)" />`,
  `<rect x="231" y="82" width="18" height="16" fill="#fff" stroke="none" />`,
  `<path d="M 231 82 L 231 98 L 240 90 Z M 249 82 L 249 98 L 240 90 Z" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" />`,
  `<path d="M 490 240 L 526 240" fill="none" stroke="#000" stroke-width="2" marker-end="url(#freccia)" />`,
  `<path d="M 526 240 L 562 240" fill="none" stroke="#000" stroke-width="2" />`,
  `<g transform="translate(40 220)"><rect x="0" y="0" width="160" height="150" fill="none" stroke="#000" stroke-width="2" /><circle cx="80" cy="75" r="36" fill="none" stroke="#000" stroke-width="2" /><path d="M 54.08 95.16 L 105.92 43.32" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /><text x="10" y="20" font-family="Arial, Helvetica, sans-serif" font-size="24" text-anchor="start" dominant-baseline="central" fill="#000">C1</text></g>`,
  `<g transform="translate(340 110)"><rect x="0" y="88" width="150" height="84" rx="42" ry="42" fill="none" stroke="#000" stroke-width="2" /><text x="93" y="130" font-family="Arial, Helvetica, sans-serif" font-size="24" text-anchor="middle" dominant-baseline="central" fill="#000">S1</text><path d="M 33 88 L 33 82" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /><rect x="27" y="70" width="12" height="12" fill="none" stroke="#000" stroke-width="2" /><path d="M 27 73 L 39 73 M 27 76 L 39 76 M 27 79 L 39 79" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /><text x="33" y="58" font-family="Arial, Helvetica, sans-serif" font-size="14" text-anchor="middle" dominant-baseline="central" fill="#000">S1.1</text><path d="M 109 173 L 125 173 L 117 182 Z M 109 191 L 125 191 L 117 182 Z" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /><path d="M 117 191 L 117 199" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /></g>`,
  `<g transform="translate(550 120)"><path d="M 12 120 L 12 26" fill="none" stroke="#000" stroke-width="2" stroke-dasharray="10 7" /><path d="M 6 27 L 12 14 L 18 27 Z" fill="#000" /><text font-family="Arial, Helvetica, sans-serif" font-size="18" text-anchor="start" dominant-baseline="central" fill="#000"><tspan x="30" y="20">Utenze aria</tspan></text></g>`,
  `<g transform="translate(514 228)"><circle cx="12" cy="12" r="5" fill="#000" /></g>`,
  `<rect x="40" y="450" width="750" height="34" fill="none" stroke="#000" stroke-width="2" />`,
  `<text x="415" y="467" font-family="Arial, Helvetica, sans-serif" font-size="20" text-anchor="middle" dominant-baseline="central" fill="#000">LISTA APPARECCHIATURE</text>`,
  `<rect x="40" y="484" width="750" height="34" fill="none" stroke="#000" stroke-width="1" />`,
  `<line x1="170" y1="484" x2="170" y2="518" stroke="#000" stroke-width="1" />`,
  `<text x="105" y="501" font-family="Arial, Helvetica, sans-serif" font-size="16" text-anchor="middle" dominant-baseline="central" fill="#000">C1</text>`,
  `<text x="182" y="501" font-family="Arial, Helvetica, sans-serif" font-size="16" dominant-baseline="central" fill="#000">Compressore KAESER Mod. CSD 105 SFC</text>`,
  `<rect x="40" y="518" width="750" height="34" fill="none" stroke="#000" stroke-width="1" />`,
  `<line x1="170" y1="518" x2="170" y2="552" stroke="#000" stroke-width="1" />`,
  `<text x="105" y="535" font-family="Arial, Helvetica, sans-serif" font-size="16" text-anchor="middle" dominant-baseline="central" fill="#000">S1</text>`,
  `<text x="182" y="535" font-family="Arial, Helvetica, sans-serif" font-size="16" dominant-baseline="central" fill="#000">Serbatoio SICC TECH s.r.l. Mod. 2000-20011R2</text>`,
  `<rect x="40" y="552" width="750" height="34" fill="none" stroke="#000" stroke-width="1" />`,
  `<line x1="170" y1="552" x2="170" y2="586" stroke="#000" stroke-width="1" />`,
  `<text x="105" y="569" font-family="Arial, Helvetica, sans-serif" font-size="16" text-anchor="middle" dominant-baseline="central" fill="#000">S1.1</text>`,
  `<text x="182" y="569" font-family="Arial, Helvetica, sans-serif" font-size="16" dominant-baseline="central" fill="#000">Valvola di sicurezza PADOVAN VALERIO snc Mod. TA21</text>`,
  `<rect x="40" y="586" width="750" height="34" fill="none" stroke="#000" stroke-width="1" />`,
  `<line x1="170" y1="586" x2="170" y2="620" stroke="#000" stroke-width="1" />`,
  `<g transform="translate(105 603)"><rect x="-9" y="-8" width="18" height="16" fill="#fff" stroke="none" /><path d="M -9 -8 L -9 8 L 0 0 Z M 9 -8 L 9 8 L 0 0 Z" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /></g>`,
  `<text x="182" y="603" font-family="Arial, Helvetica, sans-serif" font-size="16" dominant-baseline="central" fill="#000">Valvola di intercettazione</text>`,
  `<rect x="40" y="620" width="750" height="34" fill="none" stroke="#000" stroke-width="1" />`,
  `<line x1="170" y1="620" x2="170" y2="654" stroke="#000" stroke-width="1" />`,
  `<g transform="translate(105 637)"><path d="M -8 -13 L 8 -13 L 0 -4 Z M -8 5 L 8 5 L 0 -4 Z" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /><path d="M 0 5 L 0 13" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /></g>`,
  `<text x="182" y="637" font-family="Arial, Helvetica, sans-serif" font-size="16" dominant-baseline="central" fill="#000">Valvola di scarico</text>`,
  `<rect x="40" y="654" width="750" height="34" fill="none" stroke="#000" stroke-width="1" />`,
  `<line x1="170" y1="654" x2="170" y2="688" stroke="#000" stroke-width="1" />`,
  `<g transform="translate(105 671)"><path d="M -30 0 L 30 0" fill="none" stroke="#000" stroke-width="2" /></g>`,
  `<text x="182" y="671" font-family="Arial, Helvetica, sans-serif" font-size="16" dominant-baseline="central" fill="#000">Tubazione rigida</text>`,
  `<rect x="40" y="688" width="750" height="34" fill="none" stroke="#000" stroke-width="1" />`,
  `<line x1="170" y1="688" x2="170" y2="722" stroke="#000" stroke-width="1" />`,
  `<g transform="translate(105 705)"><path d="M -30 0 Q -27.5 5 -25 0 Q -22.5 -5 -20 0 Q -17.5 5 -15 0 Q -12.5 -5 -10 0 Q -7.5 5 -5 0 Q -2.5 -5 0 0 Q 2.5 5 5 0 Q 7.5 -5 10 0 Q 12.5 5 15 0 Q 17.5 -5 20 0 Q 22.5 5 25 0 Q 27.5 0 30 0" fill="none" stroke="#000" stroke-width="2" /></g>`,
  `<text x="182" y="705" font-family="Arial, Helvetica, sans-serif" font-size="16" dominant-baseline="central" fill="#000">Tubazione flessibile</text>`,
  `</svg>`,
]

/** Ricomposto qui, non lasciato come array nel test: il confronto resta su una stringa sola. */
export const SVG_RIFERIMENTO_CON_TEE = RIGHE_SVG_RIFERIMENTO_CON_TEE.join('')
