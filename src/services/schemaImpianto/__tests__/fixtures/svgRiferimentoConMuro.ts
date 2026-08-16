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
 * quadrato (129×129, prima 160×150, il disoleatore che porta dentro di sé è un riquadro interno
 * più piccolo, non un simbolo a sé) con la girante a due corde oblique, il serbatoio in linea ha
 * un riquadro proprio — cambiano `viewBox`, le coordinate di nodi e tubi, e il conteggio dei
 * tratti di muratura (l'inviluppo verticale che dimensiona il muro dipende dagli stessi
 * ingombri). Il testo della tabella e delle legende non cambia.
 *
 * Verificato di nuovo (fix round 1, revisione dello stesso Task 4): la girante del compressore e
 * il riquadro del disoleatore, che si sovrapponevano di alcune unità, non si toccano più
 * (`simboloCompressore`); il serbatoio in linea allinea la propria base a quella del compressore
 * per altezza vera (`disponiInRiga`, allineamento `'basso'`) invece che su un'altezza di riga
 * assunta uniforme; e la tanica di questa fixture (raccolta_condense: 'tanica') disegna ora il
 * rettangolo esteso quanto il proprio riquadro (`simboloTanica`, prima rientrato di 6 unità per
 * lato: 74×31 dentro 86×43 diventa 86×43 pieno) — il suo corpo (`corpoNodo`) non è più rientrato
 * neppure lui, e la corsia condense (che si appoggia al corpo del pozzo di raccolta) si sposta di
 * conseguenza, da y=472,5 a y=466,5. Sposta ulteriormente coordinate e conteggio dei tratti di
 * muratura, nessun altro cambiamento.
 *
 * Verificato di nuovo (fix round 2, revisione dello stesso Task 4): il box del disoleatore dentro
 * il compressore torna alle proporzioni misurate sul blocco CAD `compressore-disoleatore`
 * (51,5×64,5 circa, non più il quadrato 46×46 del giro precedente — vedi il commento su
 * `simboloCompressore` in symbols/index.ts) — sposta la sagoma del disoleatore in questa fixture
 * (che porta C1 con disoleatore), nessun altro cambiamento.
 */
export const RIGHE_SVG_RIFERIMENTO_CON_MURO = [
  `<svg xmlns="http://www.w3.org/2000/svg" width="830" height="1077.5" viewBox="0 0 830 1077.5">`,
  `<defs><marker id="freccia" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#000" /></marker></defs>`,
  `<rect width="830" height="1077.5" fill="#fff" />`,
  `<rect x="199" y="55" width="14" height="13" fill="none" stroke="#000" stroke-width="2" />`,
  `<rect x="199" y="112" width="14" height="332.5" fill="none" stroke="#000" stroke-width="2" />`,
  `<rect x="199" y="488.5" width="14" height="116" fill="none" stroke="#000" stroke-width="2" />`,
  `<path d="M 199 67 L 213 55 M 199 124 L 213 112 M 199 136 L 213 124 M 199 148 L 213 136 M 199 160 L 213 148 M 199 172 L 213 160 M 199 184 L 213 172 M 199 196 L 213 184 M 199 208 L 213 196 M 199 220 L 213 208 M 199 232 L 213 220 M 199 244 L 213 232 M 199 256 L 213 244 M 199 268 L 213 256 M 199 280 L 213 268 M 199 292 L 213 280 M 199 304 L 213 292 M 199 316 L 213 304 M 199 328 L 213 316 M 199 340 L 213 328 M 199 352 L 213 340 M 199 364 L 213 352 M 199 376 L 213 364 M 199 388 L 213 376 M 199 400 L 213 388 M 199 412 L 213 400 M 199 424 L 213 412 M 199 436 L 213 424 M 199 500.5 L 213 488.5 M 199 512.5 L 213 500.5 M 199 524.5 L 213 512.5 M 199 536.5 L 213 524.5 M 199 548.5 L 213 536.5 M 199 560.5 L 213 548.5 M 199 572.5 L 213 560.5 M 199 584.5 L 213 572.5 M 199 596.5 L 213 584.5" fill="none" stroke="#000" stroke-width="1" />`,
  `<path d="M 104.5 279 Q 109.5 276.51 104.5 274.03 Q 99.5 271.54 104.5 269.05 Q 109.5 266.57 104.5 264.08 Q 99.5 261.59 104.5 259.11 Q 109.5 256.62 104.5 254.13 Q 99.5 251.64 104.5 249.16 Q 109.5 246.67 104.5 244.18 Q 99.5 241.7 104.5 239.21 Q 109.5 236.72 104.5 234.24 Q 99.5 231.75 104.5 229.26 Q 109.5 226.78 104.5 224.29 Q 99.5 221.8 104.5 219.32 Q 109.5 216.83 104.5 214.34 Q 99.5 211.86 104.5 209.37 Q 109.5 206.88 104.5 204.39 Q 99.5 201.91 104.5 199.42 Q 109.5 196.93 104.5 194.45 Q 99.5 191.96 104.5 189.47 Q 109.5 186.99 104.5 184.5 Q 99.5 182.01 104.5 179.53 Q 109.5 177.04 104.5 174.55 Q 99.5 172.07 104.5 169.58 Q 109.5 167.09 104.5 164.61 Q 99.5 162.12 104.5 159.63 Q 109.5 157.14 104.5 154.66 Q 99.5 152.17 104.5 149.68 Q 109.5 147.2 104.5 144.71 Q 99.5 142.22 104.5 139.74 Q 109.5 137.25 104.5 134.76 Q 99.5 132.28 104.5 129.79 Q 109.5 127.3 104.5 124.82 Q 99.5 122.33 104.5 119.84 Q 109.5 117.36 104.5 114.87 Q 99.5 112.38 104.5 109.89 Q 109.5 107.41 104.5 104.92 Q 99.5 102.43 104.5 99.95 Q 109.5 97.46 104.5 94.97 Q 99.5 92.49 104.5 90 Q 107.01 95 109.51 90 Q 112.02 85 114.53 90 Q 117.04 95 119.54 90 Q 122.05 85 124.56 90 Q 127.07 95 129.57 90 Q 132.08 85 134.59 90 Q 137.1 95 139.6 90 Q 142.11 85 144.62 90 Q 147.13 95 149.63 90 Q 152.14 85 154.65 90 Q 157.15 95 159.66 90 Q 162.17 85 164.68 90 Q 167.18 95 169.69 90 Q 172.2 85 174.71 90 Q 177.21 95 179.72 90 Q 182.23 85 184.74 90 Q 187.24 95 189.75 90 Q 192.26 85 194.76 90 Q 197.27 95 199.78 90 Q 202.29 85 204.79 90 Q 207.3 95 209.81 90 Q 212.32 85 214.82 90 Q 217.33 95 219.84 90 Q 222.35 85 224.85 90 Q 227.36 95 229.87 90 Q 232.38 85 234.88 90 Q 237.39 95 239.9 90 Q 242.4 85 244.91 90 Q 247.42 95 249.93 90 Q 252.43 85 254.94 90 Q 257.45 95 259.96 90 Q 262.46 85 264.97 90 Q 267.48 95 269.99 90 Q 272.49 85 275 90 Q 270 92.49 275 94.97 Q 280 97.46 275 99.95 Q 270 102.43 275 104.92 Q 280 107.41 275 109.89 Q 270 112.38 275 114.87 Q 280 117.36 275 119.84 Q 270 122.33 275 124.82 Q 280 127.3 275 129.79 Q 270 132.28 275 134.76 Q 280 137.25 275 139.74 Q 270 142.22 275 144.71 Q 280 147.2 275 149.68 Q 270 152.17 275 154.66 Q 280 157.14 275 159.63 Q 270 162.12 275 164.61 Q 280 167.09 275 169.58 Q 270 172.07 275 174.55 Q 280 177.04 275 179.53 Q 270 182.01 275 184.5 Q 280 186.99 275 189.47 Q 270 191.96 275 194.45 Q 280 196.93 275 199.42 Q 270 201.91 275 204.39 Q 280 206.88 275 209.37 Q 270 211.86 275 214.34 Q 280 216.83 275 219.32 Q 270 221.8 275 224.29 Q 280 226.78 275 229.26 Q 270 231.75 275 234.24 Q 280 236.72 275 239.21 Q 270 241.7 275 244.18 Q 280 246.67 275 249.16 Q 270 251.64 275 254.13 Q 280 256.62 275 259.11 Q 270 261.59 275 264.08 Q 280 266.57 275 269.05 Q 270 271.54 275 274.03 Q 280 276.51 275 279 Q 277.43 284 279.86 279 Q 282.29 274 284.71 279 Q 287.14 284 289.57 279 Q 292 274 294.43 279 Q 296.86 284 299.29 279 Q 301.71 274 304.14 279 Q 306.57 279 309 279" fill="none" stroke="#000" stroke-width="2" marker-end="url(#freccia)" />`,
  `<rect x="197.75" y="82" width="18" height="16" fill="#fff" stroke="none" />`,
  `<path d="M 197.75 82 L 197.75 98 L 206.75 90 Z M 215.75 82 L 215.75 98 L 206.75 90 Z" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" />`,
  `<path d="M 412 279 L 448 279 L 448 259 L 484 259" fill="none" stroke="#000" stroke-width="2" />`,
  `<path d="M 104.5 408 L 104.5 466.5 L 515 466.5 L 515 506.5" fill="none" stroke="#000" stroke-width="2" stroke-dasharray="10 7" marker-end="url(#freccia)" />`,
  `<path d="M 360.5 408 L 360.5 466.5 L 515 466.5 L 515 506.5" fill="none" stroke="#000" stroke-width="2" stroke-dasharray="10 7" marker-end="url(#freccia)" />`,
  `<g transform="translate(40 279)"><rect x="0" y="0" width="129" height="129" fill="none" stroke="#000" stroke-width="2" /><circle cx="90.2" cy="70.8" r="32.25" fill="none" stroke="#000" stroke-width="2" /><path d="M 75.6875 42.0975 L 118.25750000000001 54.675" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /><path d="M 75.6875 99.5025 L 118.25750000000001 86.925" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /><text x="119" y="20" font-family="Arial, Helvetica, sans-serif" font-size="24" text-anchor="end" dominant-baseline="central" fill="#000">C1</text><rect x="3.5" y="58" width="51.5" height="64.5" fill="none" stroke="#000" stroke-width="2" /><text x="7.5" y="110.5" font-family="Arial, Helvetica, sans-serif" font-size="14" text-anchor="start" dominant-baseline="central" fill="#000">C1.1</text><rect x="23.2" y="40.7" width="12" height="12" fill="none" stroke="#000" stroke-width="2" /><path d="M 23.2 43.7 L 35.2 43.7 M 23.2 46.7 L 35.2 46.7 M 23.2 49.7 L 35.2 49.7" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /><text x="23.2" y="27.7" font-family="Arial, Helvetica, sans-serif" font-size="14" text-anchor="start" dominant-baseline="central" fill="#000">C1.2</text></g>`,
  `<g transform="translate(309 110)"><rect x="0" y="40" width="103" height="258" rx="51.5" ry="51.5" fill="none" stroke="#000" stroke-width="2" /><text x="51.5" y="169" font-family="Arial, Helvetica, sans-serif" font-size="24" text-anchor="middle" dominant-baseline="central" fill="#000">S1</text><path d="M 51.5 40 L 51.5 34" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /><rect x="45.5" y="22" width="12" height="12" fill="none" stroke="#000" stroke-width="2" /><path d="M 45.5 25 L 57.5 25 M 45.5 28 L 57.5 28 M 45.5 31 L 57.5 31" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /><text x="51.5" y="10" font-family="Arial, Helvetica, sans-serif" font-size="14" text-anchor="middle" dominant-baseline="central" fill="#000">S1.1</text><path d="M 47 299 L 56 299 L 51.5 308 Z M 47 317 L 56 317 L 51.5 308 Z" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /><path d="M 51.5 317 L 51.5 325" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /></g>`,
  `<g transform="translate(472 506.5)"><rect x="0" y="0" width="86" height="43" fill="none" stroke="#000" stroke-width="2" /><text x="43" y="21.5" font-family="Arial, Helvetica, sans-serif" font-size="20" text-anchor="middle" dominant-baseline="central" fill="#000">T</text></g>`,
  `<g transform="translate(472 139)"><path d="M 12 120 L 12 26" fill="none" stroke="#000" stroke-width="2" stroke-dasharray="10 7" /><path d="M 6 27 L 12 14 L 18 27 Z" fill="#000" /><text font-family="Arial, Helvetica, sans-serif" font-size="18" text-anchor="start" dominant-baseline="central" fill="#000"><tspan x="30" y="20">Utenze aria</tspan></text></g>`,
  `<rect x="40" y="629.5" width="750" height="34" fill="none" stroke="#000" stroke-width="2" />`,
  `<text x="415" y="646.5" font-family="Arial, Helvetica, sans-serif" font-size="20" text-anchor="middle" dominant-baseline="central" fill="#000">LISTA APPARECCHIATURE</text>`,
  `<rect x="40" y="663.5" width="750" height="34" fill="none" stroke="#000" stroke-width="1" />`,
  `<line x1="170" y1="663.5" x2="170" y2="697.5" stroke="#000" stroke-width="1" />`,
  `<text x="105" y="680.5" font-family="Arial, Helvetica, sans-serif" font-size="16" text-anchor="middle" dominant-baseline="central" fill="#000">C1</text>`,
  `<text x="182" y="680.5" font-family="Arial, Helvetica, sans-serif" font-size="16" dominant-baseline="central" fill="#000">Compressore KAESER Mod. CSD 105 SFC</text>`,
  `<rect x="40" y="697.5" width="750" height="34" fill="none" stroke="#000" stroke-width="1" />`,
  `<line x1="170" y1="697.5" x2="170" y2="731.5" stroke="#000" stroke-width="1" />`,
  `<text x="105" y="714.5" font-family="Arial, Helvetica, sans-serif" font-size="16" text-anchor="middle" dominant-baseline="central" fill="#000">C1.1</text>`,
  `<text x="182" y="714.5" font-family="Arial, Helvetica, sans-serif" font-size="16" dominant-baseline="central" fill="#000">Serbatoio disoleatore AIR COM S.r.l. Mod. 25ADK1</text>`,
  `<rect x="40" y="731.5" width="750" height="34" fill="none" stroke="#000" stroke-width="1" />`,
  `<line x1="170" y1="731.5" x2="170" y2="765.5" stroke="#000" stroke-width="1" />`,
  `<text x="105" y="748.5" font-family="Arial, Helvetica, sans-serif" font-size="16" text-anchor="middle" dominant-baseline="central" fill="#000">C1.2</text>`,
  `<text x="182" y="748.5" font-family="Arial, Helvetica, sans-serif" font-size="16" dominant-baseline="central" fill="#000">Valvola di sicurezza PADOVAN VALERIO snc Mod. TW3</text>`,
  `<rect x="40" y="765.5" width="750" height="34" fill="none" stroke="#000" stroke-width="1" />`,
  `<line x1="170" y1="765.5" x2="170" y2="799.5" stroke="#000" stroke-width="1" />`,
  `<text x="105" y="782.5" font-family="Arial, Helvetica, sans-serif" font-size="16" text-anchor="middle" dominant-baseline="central" fill="#000">S1</text>`,
  `<text x="182" y="782.5" font-family="Arial, Helvetica, sans-serif" font-size="16" dominant-baseline="central" fill="#000">Serbatoio SICC TECH s.r.l. Mod. 2000-20011R2</text>`,
  `<rect x="40" y="799.5" width="750" height="34" fill="none" stroke="#000" stroke-width="1" />`,
  `<line x1="170" y1="799.5" x2="170" y2="833.5" stroke="#000" stroke-width="1" />`,
  `<text x="105" y="816.5" font-family="Arial, Helvetica, sans-serif" font-size="16" text-anchor="middle" dominant-baseline="central" fill="#000">S1.1</text>`,
  `<text x="182" y="816.5" font-family="Arial, Helvetica, sans-serif" font-size="16" dominant-baseline="central" fill="#000">Valvola di sicurezza PADOVAN VALERIO snc Mod. TA21</text>`,
  `<rect x="40" y="833.5" width="750" height="34" fill="none" stroke="#000" stroke-width="1" />`,
  `<line x1="170" y1="833.5" x2="170" y2="867.5" stroke="#000" stroke-width="1" />`,
  `<text x="105" y="850.5" font-family="Arial, Helvetica, sans-serif" font-size="16" text-anchor="middle" dominant-baseline="central" fill="#000">T</text>`,
  `<text x="182" y="850.5" font-family="Arial, Helvetica, sans-serif" font-size="16" dominant-baseline="central" fill="#000">Tanica raccolta condense</text>`,
  `<rect x="40" y="867.5" width="750" height="34" fill="none" stroke="#000" stroke-width="1" />`,
  `<line x1="170" y1="867.5" x2="170" y2="901.5" stroke="#000" stroke-width="1" />`,
  `<g transform="translate(105 884.5)"><rect x="-9" y="-8" width="18" height="16" fill="#fff" stroke="none" /><path d="M -9 -8 L -9 8 L 0 0 Z M 9 -8 L 9 8 L 0 0 Z" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /></g>`,
  `<text x="182" y="884.5" font-family="Arial, Helvetica, sans-serif" font-size="16" dominant-baseline="central" fill="#000">Valvola di intercettazione</text>`,
  `<rect x="40" y="901.5" width="750" height="34" fill="none" stroke="#000" stroke-width="1" />`,
  `<line x1="170" y1="901.5" x2="170" y2="935.5" stroke="#000" stroke-width="1" />`,
  `<g transform="translate(105 918.5)"><path d="M -4.5 -13 L 4.5 -13 L 0 -4 Z M -4.5 5 L 4.5 5 L 0 -4 Z" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /><path d="M 0 5 L 0 13" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /></g>`,
  `<text x="182" y="918.5" font-family="Arial, Helvetica, sans-serif" font-size="16" dominant-baseline="central" fill="#000">Valvola di scarico</text>`,
  `<rect x="40" y="935.5" width="750" height="34" fill="none" stroke="#000" stroke-width="1" />`,
  `<line x1="170" y1="935.5" x2="170" y2="969.5" stroke="#000" stroke-width="1" />`,
  `<g transform="translate(105 952.5)"><path d="M -30 0 L 30 0" fill="none" stroke="#000" stroke-width="2" /></g>`,
  `<text x="182" y="952.5" font-family="Arial, Helvetica, sans-serif" font-size="16" dominant-baseline="central" fill="#000">Tubazione rigida</text>`,
  `<rect x="40" y="969.5" width="750" height="34" fill="none" stroke="#000" stroke-width="1" />`,
  `<line x1="170" y1="969.5" x2="170" y2="1003.5" stroke="#000" stroke-width="1" />`,
  `<g transform="translate(105 986.5)"><path d="M -30 0 Q -27.5 5 -25 0 Q -22.5 -5 -20 0 Q -17.5 5 -15 0 Q -12.5 -5 -10 0 Q -7.5 5 -5 0 Q -2.5 -5 0 0 Q 2.5 5 5 0 Q 7.5 -5 10 0 Q 12.5 5 15 0 Q 17.5 -5 20 0 Q 22.5 5 25 0 Q 27.5 0 30 0" fill="none" stroke="#000" stroke-width="2" /></g>`,
  `<text x="182" y="986.5" font-family="Arial, Helvetica, sans-serif" font-size="16" dominant-baseline="central" fill="#000">Tubazione flessibile</text>`,
  `<rect x="40" y="1003.5" width="750" height="34" fill="none" stroke="#000" stroke-width="1" />`,
  `<line x1="170" y1="1003.5" x2="170" y2="1037.5" stroke="#000" stroke-width="1" />`,
  `<g transform="translate(105 1020.5)"><path d="M -30 0 L 30 0" fill="none" stroke="#000" stroke-width="2" stroke-dasharray="10 7" /></g>`,
  `<text x="182" y="1020.5" font-family="Arial, Helvetica, sans-serif" font-size="16" dominant-baseline="central" fill="#000">Linea condense</text>`,
  `</svg>`,
]

/** Ricomposto qui, non lasciato come array nel test: il confronto resta su una stringa sola. */
export const SVG_RIFERIMENTO_CON_MURO = RIGHE_SVG_RIFERIMENTO_CON_MURO.join('')
