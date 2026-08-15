/**
 * SVG di riferimento per il test 'un impianto col muro resta identico al riferimento'
 * (renderSvg.test.ts).
 *
 * Copre UN SOLO impianto: compressore con disoleatore + serbatoio in linea di distribuzione,
 * raccolta condense su tanica, senza note tubazioni (`layoutConMuro()` in renderSvg.test.ts, la
 * fixture del Task 4 del Blocco D4). È il primo riferimento a intercettare il muro di
 * separazione: gli altri due (`svgRiferimentoSenzaTesti.ts`, `svgRiferimentoConTee.ts`) coprono
 * impianti con apparecchiature in un solo gruppo, senza nulla in linea di distribuzione, quindi
 * senza muro. Il muro qui disegnato ha due varchi aperti dalle tubazioni che attraversano la sua
 * ascissa (x=230): a y=90 (mandata del compressore verso il serbatoio in linea) e a y=421 (linea
 * condense del disoleatore verso la tanica) — i tre tronconi di muratura piena (`<rect
 * x="230" ... width="14" .../>`, spessore 14) sono ciò che ne resta. I due varchi distano troppo
 * per fondersi in un'unica apertura, quindi questo riferimento prova che i varchi vengono aperti e
 * alla larghezza giusta (44), non che vengano fusi: la fusione dei varchi vicini è provata a parte,
 * su `simboloMuro` isolato, in `describe('simboloMuro')` di `simboli.test.ts`. Non intercetta
 * inoltre una giunzione TEE (copertura di `svgRiferimentoConTee.ts`) né un attacco 'alto'/'basso'
 * alla giunzione: nessuno dei due compare in questo disegno.
 *
 * È un riferimento ESTERNO al codice corrente, non un self-comparison: un confronto
 * `renderSvg(x) === renderSvg(x)` non discrimina nulla, perché i due lati passano sempre
 * per lo stesso codice — è la ragione per cui una versione precedente di questo test (`testi: []`
 * contro `testi: undefined`) non si accorgeva di un elemento costante aggiunto a ogni SVG (vedi il
 * commento gemello in svgRiferimentoSenzaTesti.ts). Solo un riferimento congelato a un punto nel
 * tempo lo scopre.
 *
 * Un elemento per riga, non un unico blocco da ~12800 caratteri: quando questo test cade, il
 * valore sta nel diff che qualcuno guarda per decidere se il cambiamento è voluto. Una stringa su
 * riga singola renderebbe quel diff una riga tolta e una messa da tredicimila caratteri —
 * illeggibile quanto un binario, e il primo cambiamento legittimo verrebbe approvato senza essere
 * guardato.
 *
 * Quando è legittimo aggiornarlo: SOLO quando si cambia di proposito il disegno di QUESTO impianto
 * (per esempio un ritocco alla geometria del muro, dei suoi varchi, o alla tabella) — mai per far
 * tornare verde questo test. Per rigenerarlo: rendere lo stesso layout (`layoutConMuro()` nel
 * test) con il codice NUOVO, spezzare l'SVG risultante un elemento per riga come qui sotto (un
 * `<rect>`/`<line>`/`<text>`/`<path>`/`<g>` top-level per voce), e aggiornare la riga
 * "generato l'ultima volta dal commit" con l'hash del commit che introduce il cambiamento voluto —
 * il motivo del cambiamento va nel messaggio di quel commit, non ripetuto qui.
 *
 * Generato l'ultima volta dal commit 5cfe586 ("feat(schema): il muro non si disegna
 * piu' da solo"), Task 5 del Blocco D4: la logica del muro e dei suoi varchi (spessore,
 * larghezza dei varchi, fusione dei varchi vicini) in `symbols/index.ts` non è cambiata da lì fino
 * al commit di apertura del Task 6 (`git log --oneline 5cfe586..HEAD -- src/services/schemaImpianto`
 * mostra solo commit `docs`), quindi è il commit che meglio descrive perché `layout.muro` va
 * attaccato a mano (`calcolaMuro`, come fa `layoutConMuro()`) invece che nascere già valorizzato
 * da `layoutSchema`.
 */
export const RIGHE_SVG_RIFERIMENTO_CON_MURO = [
  `<svg xmlns="http://www.w3.org/2000/svg" width="830" height="1053" viewBox="0 0 830 1053">`,
  `<defs><marker id="freccia" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#000" /></marker></defs>`,
  `<rect width="830" height="1053" fill="#fff" />`,
  `<rect x="230" y="55" width="14" height="13" fill="none" stroke="#000" stroke-width="2" />`,
  `<rect x="230" y="112" width="14" height="287" fill="none" stroke="#000" stroke-width="2" />`,
  `<rect x="230" y="443" width="14" height="137" fill="none" stroke="#000" stroke-width="2" />`,
  `<path d="M 230 67 L 244 55 M 230 124 L 244 112 M 230 136 L 244 124 M 230 148 L 244 136 M 230 160 L 244 148 M 230 172 L 244 160 M 230 184 L 244 172 M 230 196 L 244 184 M 230 208 L 244 196 M 230 220 L 244 208 M 230 232 L 244 220 M 230 244 L 244 232 M 230 256 L 244 244 M 230 268 L 244 256 M 230 280 L 244 268 M 230 292 L 244 280 M 230 304 L 244 292 M 230 316 L 244 304 M 230 328 L 244 316 M 230 340 L 244 328 M 230 352 L 244 340 M 230 364 L 244 352 M 230 376 L 244 364 M 230 388 L 244 376 M 230 455 L 244 443 M 230 467 L 244 455 M 230 479 L 244 467 M 230 491 L 244 479 M 230 503 L 244 491 M 230 515 L 244 503 M 230 527 L 244 515 M 230 539 L 244 527 M 230 551 L 244 539 M 230 563 L 244 551 M 230 575 L 244 563" fill="none" stroke="#000" stroke-width="1" />`,
  `<path d="M 120 220 Q 125 217.5 120 215 Q 115 212.5 120 210 Q 125 207.5 120 205 Q 115 202.5 120 200 Q 125 197.5 120 195 Q 115 192.5 120 190 Q 125 187.5 120 185 Q 115 182.5 120 180 Q 125 177.5 120 175 Q 115 172.5 120 170 Q 125 167.5 120 165 Q 115 162.5 120 160 Q 125 157.5 120 155 Q 115 152.5 120 150 Q 125 147.5 120 145 Q 115 142.5 120 140 Q 125 137.5 120 135 Q 115 132.5 120 130 Q 125 127.5 120 125 Q 115 122.5 120 120 Q 125 117.5 120 115 Q 115 112.5 120 110 Q 125 107.5 120 105 Q 115 102.5 120 100 Q 125 97.5 120 95 Q 115 92.5 120 90 Q 122.49 95 124.98 90 Q 127.47 85 129.95 90 Q 132.44 95 134.93 90 Q 137.42 85 139.91 90 Q 142.4 95 144.89 90 Q 147.38 85 149.86 90 Q 152.35 95 154.84 90 Q 157.33 85 159.82 90 Q 162.31 95 164.8 90 Q 167.28 85 169.77 90 Q 172.26 95 174.75 90 Q 177.24 85 179.73 90 Q 182.22 95 184.7 90 Q 187.19 85 189.68 90 Q 192.17 95 194.66 90 Q 197.15 85 199.64 90 Q 202.13 95 204.61 90 Q 207.1 85 209.59 90 Q 212.08 95 214.57 90 Q 217.06 85 219.55 90 Q 222.03 95 224.52 90 Q 227.01 85 229.5 90 Q 231.99 95 234.48 90 Q 236.97 85 239.45 90 Q 241.94 95 244.43 90 Q 246.92 85 249.41 90 Q 251.9 95 254.39 90 Q 256.88 85 259.36 90 Q 261.85 95 264.34 90 Q 266.83 85 269.32 90 Q 271.81 95 274.3 90 Q 276.78 85 279.27 90 Q 281.76 95 284.25 90 Q 286.74 85 289.23 90 Q 291.72 95 294.2 90 Q 296.69 85 299.18 90 Q 301.67 95 304.16 90 Q 306.65 85 309.14 90 Q 311.63 95 314.11 90 Q 316.6 85 319.09 90 Q 321.58 95 324.07 90 Q 326.56 85 329.05 90 Q 331.53 95 334.02 90 Q 336.51 85 339 90 Q 334 92.5 339 95 Q 344 97.5 339 100 Q 334 102.5 339 105 Q 344 107.5 339 110 Q 334 112.5 339 115 Q 344 117.5 339 120 Q 334 122.5 339 125 Q 344 127.5 339 130 Q 334 132.5 339 135 Q 344 137.5 339 140 Q 334 142.5 339 145 Q 344 147.5 339 150 Q 334 152.5 339 155 Q 344 157.5 339 160 Q 334 162.5 339 165 Q 344 167.5 339 170 Q 334 172.5 339 175 Q 344 177.5 339 180 Q 334 182.5 339 185 Q 344 187.5 339 190 Q 334 192.5 339 195 Q 344 197.5 339 200 Q 334 202.5 339 205 Q 344 207.5 339 210 Q 334 212.5 339 215 Q 344 217.5 339 220 Q 334 222.5 339 225 Q 344 227.5 339 230 Q 334 232.5 339 235 Q 344 237.5 339 240 Q 334 242.5 339 245 Q 344 247.5 339 250 Q 334 252.5 339 255 Q 344 257.5 339 260 Q 341.43 265 343.86 260 Q 346.29 255 348.71 260 Q 351.14 265 353.57 260 Q 356 255 358.43 260 Q 360.86 265 363.29 260 Q 365.71 255 368.14 260 Q 370.57 260 373 260" fill="none" stroke="#000" stroke-width="2" marker-end="url(#freccia)" />`,
  `<rect x="257.5" y="82" width="18" height="16" fill="#fff" stroke="none" />`,
  `<path d="M 257.5 82 L 257.5 98 L 266.5 90 Z M 275.5 82 L 275.5 98 L 266.5 90 Z" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" />`,
  `<path d="M 457 260 L 509.5 260 L 509.5 240 L 562 240" fill="none" stroke="#000" stroke-width="2" />`,
  `<path d="M 120 370 L 120 421 L 590 421 L 590 461" fill="none" stroke="#000" stroke-width="2" stroke-dasharray="10 7" marker-end="url(#freccia)" />`,
  `<path d="M 415 370 L 415 421 L 590 421 L 590 461" fill="none" stroke="#000" stroke-width="2" stroke-dasharray="10 7" marker-end="url(#freccia)" />`,
  `<g transform="translate(40 220)"><rect x="0" y="0" width="160" height="150" fill="none" stroke="#000" stroke-width="2" /><circle cx="106" cy="83" r="36" fill="none" stroke="#000" stroke-width="2" /><path d="M 80.08 103.16 L 131.92 51.32" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /><text x="150" y="20" font-family="Arial, Helvetica, sans-serif" font-size="24" text-anchor="end" dominant-baseline="central" fill="#000">C1</text><rect x="8" y="88" width="64" height="54" fill="none" stroke="#000" stroke-width="2" /><text x="12" y="130" font-family="Arial, Helvetica, sans-serif" font-size="14" text-anchor="start" dominant-baseline="central" fill="#000">C1.1</text><rect x="20" y="38" width="12" height="12" fill="none" stroke="#000" stroke-width="2" /><path d="M 20 41 L 32 41 M 20 44 L 32 44 M 20 47 L 32 47" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /><text x="8" y="22" font-family="Arial, Helvetica, sans-serif" font-size="14" text-anchor="start" dominant-baseline="central" fill="#000">C1.2</text></g>`,
  `<g transform="translate(340 110)"><rect x="33" y="40" width="84" height="220" rx="42" ry="42" fill="none" stroke="#000" stroke-width="2" /><text x="75" y="150" font-family="Arial, Helvetica, sans-serif" font-size="24" text-anchor="middle" dominant-baseline="central" fill="#000">S1</text><path d="M 75 40 L 75 34" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /><rect x="69" y="22" width="12" height="12" fill="none" stroke="#000" stroke-width="2" /><path d="M 69 25 L 81 25 M 69 28 L 81 28 M 69 31 L 81 31" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /><text x="75" y="10" font-family="Arial, Helvetica, sans-serif" font-size="14" text-anchor="middle" dominant-baseline="central" fill="#000">S1.1</text><path d="M 67 261 L 83 261 L 75 270 Z M 67 279 L 83 279 L 75 270 Z" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /><path d="M 75 279 L 75 287" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /></g>`,
  `<g transform="translate(550 455)"><rect x="6" y="6" width="68" height="58" fill="none" stroke="#000" stroke-width="2" /><text x="40" y="35" font-family="Arial, Helvetica, sans-serif" font-size="20" text-anchor="middle" dominant-baseline="central" fill="#000">T</text></g>`,
  `<g transform="translate(550 120)"><path d="M 12 120 L 12 26" fill="none" stroke="#000" stroke-width="2" stroke-dasharray="10 7" /><path d="M 6 27 L 12 14 L 18 27 Z" fill="#000" /><text font-family="Arial, Helvetica, sans-serif" font-size="18" text-anchor="start" dominant-baseline="central" fill="#000"><tspan x="30" y="20">Utenze aria</tspan></text></g>`,
  `<rect x="40" y="605" width="750" height="34" fill="none" stroke="#000" stroke-width="2" />`,
  `<text x="415" y="622" font-family="Arial, Helvetica, sans-serif" font-size="20" text-anchor="middle" dominant-baseline="central" fill="#000">LISTA APPARECCHIATURE</text>`,
  `<rect x="40" y="639" width="750" height="34" fill="none" stroke="#000" stroke-width="1" />`,
  `<line x1="170" y1="639" x2="170" y2="673" stroke="#000" stroke-width="1" />`,
  `<text x="105" y="656" font-family="Arial, Helvetica, sans-serif" font-size="16" text-anchor="middle" dominant-baseline="central" fill="#000">C1</text>`,
  `<text x="182" y="656" font-family="Arial, Helvetica, sans-serif" font-size="16" dominant-baseline="central" fill="#000">Compressore KAESER Mod. CSD 105 SFC</text>`,
  `<rect x="40" y="673" width="750" height="34" fill="none" stroke="#000" stroke-width="1" />`,
  `<line x1="170" y1="673" x2="170" y2="707" stroke="#000" stroke-width="1" />`,
  `<text x="105" y="690" font-family="Arial, Helvetica, sans-serif" font-size="16" text-anchor="middle" dominant-baseline="central" fill="#000">C1.1</text>`,
  `<text x="182" y="690" font-family="Arial, Helvetica, sans-serif" font-size="16" dominant-baseline="central" fill="#000">Serbatoio disoleatore AIR COM S.r.l. Mod. 25ADK1</text>`,
  `<rect x="40" y="707" width="750" height="34" fill="none" stroke="#000" stroke-width="1" />`,
  `<line x1="170" y1="707" x2="170" y2="741" stroke="#000" stroke-width="1" />`,
  `<text x="105" y="724" font-family="Arial, Helvetica, sans-serif" font-size="16" text-anchor="middle" dominant-baseline="central" fill="#000">C1.2</text>`,
  `<text x="182" y="724" font-family="Arial, Helvetica, sans-serif" font-size="16" dominant-baseline="central" fill="#000">Valvola di sicurezza PADOVAN VALERIO snc Mod. TW3</text>`,
  `<rect x="40" y="741" width="750" height="34" fill="none" stroke="#000" stroke-width="1" />`,
  `<line x1="170" y1="741" x2="170" y2="775" stroke="#000" stroke-width="1" />`,
  `<text x="105" y="758" font-family="Arial, Helvetica, sans-serif" font-size="16" text-anchor="middle" dominant-baseline="central" fill="#000">S1</text>`,
  `<text x="182" y="758" font-family="Arial, Helvetica, sans-serif" font-size="16" dominant-baseline="central" fill="#000">Serbatoio SICC TECH s.r.l. Mod. 2000-20011R2</text>`,
  `<rect x="40" y="775" width="750" height="34" fill="none" stroke="#000" stroke-width="1" />`,
  `<line x1="170" y1="775" x2="170" y2="809" stroke="#000" stroke-width="1" />`,
  `<text x="105" y="792" font-family="Arial, Helvetica, sans-serif" font-size="16" text-anchor="middle" dominant-baseline="central" fill="#000">S1.1</text>`,
  `<text x="182" y="792" font-family="Arial, Helvetica, sans-serif" font-size="16" dominant-baseline="central" fill="#000">Valvola di sicurezza PADOVAN VALERIO snc Mod. TA21</text>`,
  `<rect x="40" y="809" width="750" height="34" fill="none" stroke="#000" stroke-width="1" />`,
  `<line x1="170" y1="809" x2="170" y2="843" stroke="#000" stroke-width="1" />`,
  `<text x="105" y="826" font-family="Arial, Helvetica, sans-serif" font-size="16" text-anchor="middle" dominant-baseline="central" fill="#000">T</text>`,
  `<text x="182" y="826" font-family="Arial, Helvetica, sans-serif" font-size="16" dominant-baseline="central" fill="#000">Tanica raccolta condense</text>`,
  `<rect x="40" y="843" width="750" height="34" fill="none" stroke="#000" stroke-width="1" />`,
  `<line x1="170" y1="843" x2="170" y2="877" stroke="#000" stroke-width="1" />`,
  `<g transform="translate(105 860)"><rect x="-9" y="-8" width="18" height="16" fill="#fff" stroke="none" /><path d="M -9 -8 L -9 8 L 0 0 Z M 9 -8 L 9 8 L 0 0 Z" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /></g>`,
  `<text x="182" y="860" font-family="Arial, Helvetica, sans-serif" font-size="16" dominant-baseline="central" fill="#000">Valvola di intercettazione</text>`,
  `<rect x="40" y="877" width="750" height="34" fill="none" stroke="#000" stroke-width="1" />`,
  `<line x1="170" y1="877" x2="170" y2="911" stroke="#000" stroke-width="1" />`,
  `<g transform="translate(105 894)"><path d="M -8 -13 L 8 -13 L 0 -4 Z M -8 5 L 8 5 L 0 -4 Z" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /><path d="M 0 5 L 0 13" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /></g>`,
  `<text x="182" y="894" font-family="Arial, Helvetica, sans-serif" font-size="16" dominant-baseline="central" fill="#000">Valvola di scarico</text>`,
  `<rect x="40" y="911" width="750" height="34" fill="none" stroke="#000" stroke-width="1" />`,
  `<line x1="170" y1="911" x2="170" y2="945" stroke="#000" stroke-width="1" />`,
  `<g transform="translate(105 928)"><path d="M -30 0 L 30 0" fill="none" stroke="#000" stroke-width="2" /></g>`,
  `<text x="182" y="928" font-family="Arial, Helvetica, sans-serif" font-size="16" dominant-baseline="central" fill="#000">Tubazione rigida</text>`,
  `<rect x="40" y="945" width="750" height="34" fill="none" stroke="#000" stroke-width="1" />`,
  `<line x1="170" y1="945" x2="170" y2="979" stroke="#000" stroke-width="1" />`,
  `<g transform="translate(105 962)"><path d="M -30 0 Q -27.5 5 -25 0 Q -22.5 -5 -20 0 Q -17.5 5 -15 0 Q -12.5 -5 -10 0 Q -7.5 5 -5 0 Q -2.5 -5 0 0 Q 2.5 5 5 0 Q 7.5 -5 10 0 Q 12.5 5 15 0 Q 17.5 -5 20 0 Q 22.5 5 25 0 Q 27.5 0 30 0" fill="none" stroke="#000" stroke-width="2" /></g>`,
  `<text x="182" y="962" font-family="Arial, Helvetica, sans-serif" font-size="16" dominant-baseline="central" fill="#000">Tubazione flessibile</text>`,
  `<rect x="40" y="979" width="750" height="34" fill="none" stroke="#000" stroke-width="1" />`,
  `<line x1="170" y1="979" x2="170" y2="1013" stroke="#000" stroke-width="1" />`,
  `<g transform="translate(105 996)"><path d="M -30 0 L 30 0" fill="none" stroke="#000" stroke-width="2" stroke-dasharray="10 7" /></g>`,
  `<text x="182" y="996" font-family="Arial, Helvetica, sans-serif" font-size="16" dominant-baseline="central" fill="#000">Linea condense</text>`,
  `</svg>`,
]

/** Ricomposto qui, non lasciato come array nel test: il confronto resta su una stringa sola. */
export const SVG_RIFERIMENTO_CON_MURO = RIGHE_SVG_RIFERIMENTO_CON_MURO.join('')
