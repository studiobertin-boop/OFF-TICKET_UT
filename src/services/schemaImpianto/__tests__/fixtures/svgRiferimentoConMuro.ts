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
 * ascissa (x=190, non 230: cifra corretta qui perché falsa fin da prima del Task 8): a y=90
 * (mandata del compressore verso il serbatoio in linea) e a y=470 (linea condense del disoleatore
 * verso la tanica, coerente col y=466,5 del paragrafo qui sotto sul fix round 1) — i tre tronconi
 * di muratura piena (`<rect x="190" ... width="14" .../>`, spessore 14) sono ciò che ne resta. I due varchi distano troppo
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
 *
 * Generato di nuovo al commit cb31278 ("feat(schema): le ancore di fabbrica cadono tutte sulla
 * griglia"), Task 8 del Blocco 3: le ancore di
 * fabbrica sono arrotondate ai multipli di 10 — compressore 129×129 → 120×120, serbatoio
 * 103×298 → 100×300, tanica 86×43 → 80×40, muro a x=190 invece di 199 (segue il nuovo bordo
 * destro del compressore). Il secondo varco si sposta da y=466,5 a y=470 (la tanica non
 * rientrata più nulla, ma il suo corpo e quello del serbatoio hanno dimensioni nuove). Cambiano
 * `viewBox`, i capi degli archi, le coordinate dei nodi e i tronconi di muratura; il testo delle
 * celle e delle voci di legenda non cambia.
 *
 * Generato di nuovo al commit e003967 ("feat(schema): valvole, riduttore, freccia e muro fedeli
 * ai blocchi"), Task 13 del Blocco 3: la farfalla della valvola di intercettazione e il marker
 * della freccia di flusso cambiano rapporto (come nei due gemelli senza muro), e
 * `TRATTEGGIO_CONDENSE` si inverte ('10 7' → '7 10', il blocco CAD disegna dash più corti dei
 * gap) — le due linee condense disegnate e la riga di legenda "Linea condense" lo mostrano. Il
 * muro stesso (tronconi, varchi, tratteggio a 45°) resta invariato: verificato contro il CAD e
 * già fedele. Nessuna posizione di nodo o percorso di tubo si sposta.
 *
 * Generato di nuovo il 17-08-2026 (rifinitura R5): il passo dell'onda del flessibile raddoppia —
 * metà delle ondulazioni sulla stessa lunghezza, come chiesto dal committente. Cambiano solo i
 * tracciati ondulati (la mandata del compressore e il campione "Tubazione flessibile" della
 * legenda); nessuna posizione di nodo e nessun capo di tubo si sposta.
*
 * Generato di nuovo il 17-08-2026 (rifinitura R1): le tubazioni non portano più la punta di
 * freccia d'ufficio. Spariscono `marker-end="url(#freccia)"` da ogni tratto e il `<marker>` dai
 * `<defs>`; le frecce ora si posano a mano dall'editor, e questi layout non ne hanno. Nessuna
 * posizione si sposta.
 *
 * Generato di nuovo il 17-08-2026 (rifinitura R2): la scritta del terminale utenze passa sopra la
 * punta di freccia, centrata su di essa. Il codolo â€” e con lui l'ancora `in` â€” si sposta a metÃ 
 * larghezza, o metÃ  della scritta cadrebbe fuori dal riquadro; il terminale diventa piÃ¹ largo
 * (200 di minimo) e piÃ¹ alto (l'etichetta di default Ã¨ su due righe). Di conseguenza il tubo che
 * lo raggiunge arriva piÃ¹ a destra, la tela si allarga di 10 e la tabella con lei. Nessun altro
 * nodo si sposta.
 *
 * Generato di nuovo il 17-08-2026: la tabella si stringe al proprio contenuto invece di occupare
 * tutto il foglio, e si centra — con la nota — sul centro del disegno anziché su quello della
 * pagina. Si muovono soltanto la testata (`width`/`viewBox`), il rettangolo di fondo e le righe
 * della tabella. Il disegno non cambia di un carattere — muro e varchi compresi: verificato
 * confrontando, prima di aggiornare questo file, la porzione fra il fondo bianco e l'inizio della
 * tabella.
 *
 * Generato di nuovo il 17-08-2026: `xml:space="preserve"` sul `<text>` composto da
 * `testoMultiRiga`, perché gli spazi consecutivi di un'annotazione non vengano più collassati.
 * Cambia UN SOLO attributo, sulla scritta del terminale utenze; verificato che l'SVG privato di
 * quell'attributo torni identico carattere per carattere al riferimento precedente.
 *
 * Generato di nuovo il 17-08-2026: la stima della larghezza delle celle passa da 0,5 a 0,62 per
 * carattere. La prova in pagina ha mostrato due descrizioni USCIRE dal bordo destro della cella —
 * marca e modello arrivano in maiuscolo dal catalogo, e su quelle 0,5 sottostima (misurato: 0,587).
 * La tabella si allarga di conseguenza, e con lei il foglio; il disegno non cambia.
 */
export const RIGHE_SVG_RIFERIMENTO_CON_MURO = [
  `<svg xmlns="http://www.w3.org/2000/svg" width="730" height="1078" viewBox="0 0 730 1078">`,
  `<rect width="730" height="1078" fill="#fff" />`,
  `<rect x="190" y="55" width="14" height="13" fill="none" stroke="#000" stroke-width="2" />`,
  `<rect x="190" y="112" width="14" height="336" fill="none" stroke="#000" stroke-width="2" />`,
  `<rect x="190" y="492" width="14" height="113" fill="none" stroke="#000" stroke-width="2" />`,
  `<path d="M 190 67 L 204 55 M 190 124 L 204 112 M 190 136 L 204 124 M 190 148 L 204 136 M 190 160 L 204 148 M 190 172 L 204 160 M 190 184 L 204 172 M 190 196 L 204 184 M 190 208 L 204 196 M 190 220 L 204 208 M 190 232 L 204 220 M 190 244 L 204 232 M 190 256 L 204 244 M 190 268 L 204 256 M 190 280 L 204 268 M 190 292 L 204 280 M 190 304 L 204 292 M 190 316 L 204 304 M 190 328 L 204 316 M 190 340 L 204 328 M 190 352 L 204 340 M 190 364 L 204 352 M 190 376 L 204 364 M 190 388 L 204 376 M 190 400 L 204 388 M 190 412 L 204 400 M 190 424 L 204 412 M 190 436 L 204 424 M 190 504 L 204 492 M 190 516 L 204 504 M 190 528 L 204 516 M 190 540 L 204 528 M 190 552 L 204 540 M 190 564 L 204 552 M 190 576 L 204 564 M 190 588 L 204 576 M 190 600 L 204 588" fill="none" stroke="#000" stroke-width="1" />`,
  `<path d="M 100 290 Q 105 285 100 280 Q 95 275 100 270 Q 105 265 100 260 Q 95 255 100 250 Q 105 245 100 240 Q 95 235 100 230 Q 105 225 100 220 Q 95 215 100 210 Q 105 205 100 200 Q 95 195 100 190 Q 105 185 100 180 Q 95 175 100 170 Q 105 165 100 160 Q 95 155 100 150 Q 105 145 100 140 Q 95 135 100 130 Q 105 125 100 120 Q 95 115 100 110 Q 105 105 100 100 Q 95 95 100 90 Q 104.88 95 109.76 90 Q 114.65 85 119.53 90 Q 124.41 95 129.29 90 Q 134.18 85 139.06 90 Q 143.94 95 148.82 90 Q 153.71 85 158.59 90 Q 163.47 95 168.35 90 Q 173.24 85 178.12 90 Q 183 95 187.88 90 Q 192.76 85 197.65 90 Q 202.53 95 207.41 90 Q 212.29 85 217.18 90 Q 222.06 95 226.94 90 Q 231.82 85 236.71 90 Q 241.59 95 246.47 90 Q 251.35 85 256.24 90 Q 261.12 95 266 90 Q 261 95 266 100 Q 271 105 266 110 Q 261 115 266 120 Q 271 125 266 130 Q 261 135 266 140 Q 271 145 266 150 Q 261 155 266 160 Q 271 165 266 170 Q 261 175 266 180 Q 271 185 266 190 Q 261 195 266 200 Q 271.67 205 277.33 200 Q 283 195 288.67 200 Q 294.33 200 300 200" fill="none" stroke="#000" stroke-width="2" />`,
  `<rect x="146" y="85.5" width="18" height="9" fill="#fff" stroke="none" />`,
  `<path d="M 146 85.5 L 146 94.5 L 155 90 Z M 164 85.5 L 164 94.5 L 155 90 Z" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" />`,
  `<path d="M 400 200 L 480 200 L 480 260 L 560 260" fill="none" stroke="#000" stroke-width="2" />`,
  `<path d="M 100 410 L 100 470 L 500 470 L 500 510" fill="none" stroke="#000" stroke-width="2" stroke-dasharray="7 10" />`,
  `<path d="M 350 410 L 350 470 L 500 470 L 500 510" fill="none" stroke="#000" stroke-width="2" stroke-dasharray="7 10" />`,
  `<g transform="translate(40 290)"><rect x="0" y="0" width="120" height="120" fill="none" stroke="#000" stroke-width="2" /><circle cx="83.88" cy="65.88000000000001" r="30" fill="none" stroke="#000" stroke-width="2" /><path d="M 70.38 39.18000000000001 L 109.97999999999999 50.88000000000001" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /><path d="M 70.38 92.58000000000001 L 109.97999999999999 80.88000000000001" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /><text x="110" y="20" font-family="Arial, Helvetica, sans-serif" font-size="24" text-anchor="end" dominant-baseline="central" fill="#000">C1</text><rect x="3.2399999999999998" y="54" width="47.88" height="60.12" fill="none" stroke="#000" stroke-width="2" /><text x="7.24" y="102.12" font-family="Arial, Helvetica, sans-serif" font-size="14" text-anchor="start" dominant-baseline="central" fill="#000">C1.1</text><rect x="21.12" y="37.44" width="12" height="12" fill="none" stroke="#000" stroke-width="2" /><path d="M 21.12 40.44 L 33.120000000000005 40.44 M 21.12 43.44 L 33.120000000000005 43.44 M 21.12 46.44 L 33.120000000000005 46.44" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /><text x="21.12" y="24.439999999999998" font-family="Arial, Helvetica, sans-serif" font-size="14" text-anchor="start" dominant-baseline="central" fill="#000">C1.2</text></g>`,
  `<g transform="translate(300 110)"><rect x="0" y="40" width="100" height="260" rx="50" ry="50" fill="none" stroke="#000" stroke-width="2" /><text x="50" y="170" font-family="Arial, Helvetica, sans-serif" font-size="24" text-anchor="middle" dominant-baseline="central" fill="#000">S1</text><path d="M 50 40 L 50 34" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /><rect x="44" y="22" width="12" height="12" fill="none" stroke="#000" stroke-width="2" /><path d="M 44 25 L 56 25 M 44 28 L 56 28 M 44 31 L 56 31" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /><text x="50" y="10" font-family="Arial, Helvetica, sans-serif" font-size="14" text-anchor="middle" dominant-baseline="central" fill="#000">S1.1</text><path d="M 45.5 301 L 54.5 301 L 50 310 Z M 45.5 319 L 54.5 319 L 50 310 Z" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /><path d="M 50 319 L 50 327" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /></g>`,
  `<g transform="translate(460 510)"><rect x="0" y="0" width="80" height="40" fill="none" stroke="#000" stroke-width="2" /><text x="40" y="20" font-family="Arial, Helvetica, sans-serif" font-size="20" text-anchor="middle" dominant-baseline="central" fill="#000">T</text></g>`,
  `<g transform="translate(460 90)"><path d="M 100 170 L 100 68.5" fill="none" stroke="#000" stroke-width="2" stroke-dasharray="10 7" /><path d="M 94 69.5 L 100 56.5 L 106 69.5 Z" fill="#000" /><text xml:space="preserve" font-family="Arial, Helvetica, sans-serif" font-size="18" text-anchor="middle" dominant-baseline="central" fill="#000"><tspan x="100" y="19">Utenze</tspan><tspan x="100" y="41.5">aria</tspan></text></g>`,
  `<rect x="40" y="630" width="650" height="34" fill="none" stroke="#000" stroke-width="2" />`,
  `<text x="365" y="647" font-family="Arial, Helvetica, sans-serif" font-size="20" text-anchor="middle" dominant-baseline="central" fill="#000">LISTA APPARECCHIATURE</text>`,
  `<rect x="40" y="664" width="650" height="34" fill="none" stroke="#000" stroke-width="1" />`,
  `<line x1="170" y1="664" x2="170" y2="698" stroke="#000" stroke-width="1" />`,
  `<text x="105" y="681" font-family="Arial, Helvetica, sans-serif" font-size="16" text-anchor="middle" dominant-baseline="central" fill="#000">C1</text>`,
  `<text x="182" y="681" font-family="Arial, Helvetica, sans-serif" font-size="16" dominant-baseline="central" fill="#000">Compressore KAESER Mod. CSD 105 SFC</text>`,
  `<rect x="40" y="698" width="650" height="34" fill="none" stroke="#000" stroke-width="1" />`,
  `<line x1="170" y1="698" x2="170" y2="732" stroke="#000" stroke-width="1" />`,
  `<text x="105" y="715" font-family="Arial, Helvetica, sans-serif" font-size="16" text-anchor="middle" dominant-baseline="central" fill="#000">C1.1</text>`,
  `<text x="182" y="715" font-family="Arial, Helvetica, sans-serif" font-size="16" dominant-baseline="central" fill="#000">Serbatoio disoleatore AIR COM S.r.l. Mod. 25ADK1</text>`,
  `<rect x="40" y="732" width="650" height="34" fill="none" stroke="#000" stroke-width="1" />`,
  `<line x1="170" y1="732" x2="170" y2="766" stroke="#000" stroke-width="1" />`,
  `<text x="105" y="749" font-family="Arial, Helvetica, sans-serif" font-size="16" text-anchor="middle" dominant-baseline="central" fill="#000">C1.2</text>`,
  `<text x="182" y="749" font-family="Arial, Helvetica, sans-serif" font-size="16" dominant-baseline="central" fill="#000">Valvola di sicurezza PADOVAN VALERIO snc Mod. TW3</text>`,
  `<rect x="40" y="766" width="650" height="34" fill="none" stroke="#000" stroke-width="1" />`,
  `<line x1="170" y1="766" x2="170" y2="800" stroke="#000" stroke-width="1" />`,
  `<text x="105" y="783" font-family="Arial, Helvetica, sans-serif" font-size="16" text-anchor="middle" dominant-baseline="central" fill="#000">S1</text>`,
  `<text x="182" y="783" font-family="Arial, Helvetica, sans-serif" font-size="16" dominant-baseline="central" fill="#000">Serbatoio SICC TECH s.r.l. Mod. 2000-20011R2</text>`,
  `<rect x="40" y="800" width="650" height="34" fill="none" stroke="#000" stroke-width="1" />`,
  `<line x1="170" y1="800" x2="170" y2="834" stroke="#000" stroke-width="1" />`,
  `<text x="105" y="817" font-family="Arial, Helvetica, sans-serif" font-size="16" text-anchor="middle" dominant-baseline="central" fill="#000">S1.1</text>`,
  `<text x="182" y="817" font-family="Arial, Helvetica, sans-serif" font-size="16" dominant-baseline="central" fill="#000">Valvola di sicurezza PADOVAN VALERIO snc Mod. TA21</text>`,
  `<rect x="40" y="834" width="650" height="34" fill="none" stroke="#000" stroke-width="1" />`,
  `<line x1="170" y1="834" x2="170" y2="868" stroke="#000" stroke-width="1" />`,
  `<text x="105" y="851" font-family="Arial, Helvetica, sans-serif" font-size="16" text-anchor="middle" dominant-baseline="central" fill="#000">T</text>`,
  `<text x="182" y="851" font-family="Arial, Helvetica, sans-serif" font-size="16" dominant-baseline="central" fill="#000">Tanica raccolta condense</text>`,
  `<rect x="40" y="868" width="650" height="34" fill="none" stroke="#000" stroke-width="1" />`,
  `<line x1="170" y1="868" x2="170" y2="902" stroke="#000" stroke-width="1" />`,
  `<g transform="translate(105 885)"><rect x="-9" y="-4.5" width="18" height="9" fill="#fff" stroke="none" /><path d="M -9 -4.5 L -9 4.5 L 0 0 Z M 9 -4.5 L 9 4.5 L 0 0 Z" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /></g>`,
  `<text x="182" y="885" font-family="Arial, Helvetica, sans-serif" font-size="16" dominant-baseline="central" fill="#000">Valvola di intercettazione</text>`,
  `<rect x="40" y="902" width="650" height="34" fill="none" stroke="#000" stroke-width="1" />`,
  `<line x1="170" y1="902" x2="170" y2="936" stroke="#000" stroke-width="1" />`,
  `<g transform="translate(105 919)"><path d="M -4.5 -13 L 4.5 -13 L 0 -4 Z M -4.5 5 L 4.5 5 L 0 -4 Z" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /><path d="M 0 5 L 0 13" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /></g>`,
  `<text x="182" y="919" font-family="Arial, Helvetica, sans-serif" font-size="16" dominant-baseline="central" fill="#000">Valvola di scarico</text>`,
  `<rect x="40" y="936" width="650" height="34" fill="none" stroke="#000" stroke-width="1" />`,
  `<line x1="170" y1="936" x2="170" y2="970" stroke="#000" stroke-width="1" />`,
  `<g transform="translate(105 953)"><path d="M -30 0 L 30 0" fill="none" stroke="#000" stroke-width="2" /></g>`,
  `<text x="182" y="953" font-family="Arial, Helvetica, sans-serif" font-size="16" dominant-baseline="central" fill="#000">Tubazione rigida</text>`,
  `<rect x="40" y="970" width="650" height="34" fill="none" stroke="#000" stroke-width="1" />`,
  `<line x1="170" y1="970" x2="170" y2="1004" stroke="#000" stroke-width="1" />`,
  `<g transform="translate(105 987)"><path d="M -30 0 Q -25 5 -20 0 Q -15 -5 -10 0 Q -5 5 0 0 Q 5 -5 10 0 Q 15 5 20 0 Q 25 0 30 0" fill="none" stroke="#000" stroke-width="2" /></g>`,
  `<text x="182" y="987" font-family="Arial, Helvetica, sans-serif" font-size="16" dominant-baseline="central" fill="#000">Tubazione flessibile</text>`,
  `<rect x="40" y="1004" width="650" height="34" fill="none" stroke="#000" stroke-width="1" />`,
  `<line x1="170" y1="1004" x2="170" y2="1038" stroke="#000" stroke-width="1" />`,
  `<g transform="translate(105 1021)"><path d="M -30 0 L 30 0" fill="none" stroke="#000" stroke-width="2" stroke-dasharray="7 10" /></g>`,
  `<text x="182" y="1021" font-family="Arial, Helvetica, sans-serif" font-size="16" dominant-baseline="central" fill="#000">Linea condense</text>`,
  `</svg>`
]

/** Ricomposto qui, non lasciato come array nel test: il confronto resta su una stringa sola. */
export const SVG_RIFERIMENTO_CON_MURO = RIGHE_SVG_RIFERIMENTO_CON_MURO.join('')
