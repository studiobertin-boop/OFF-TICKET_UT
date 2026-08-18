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
 *
 * Generato di nuovo al commit e003967 ("feat(schema): valvole, riduttore, freccia e muro fedeli
 * ai blocchi"), Task 13 del Blocco 3: la farfalla della valvola di intercettazione (rapporto
 * misurato sul CAD 2,01, non più 1,125 — vedi `RAPPORTO_ALA_FARFALLA`) e il marker della freccia
 * di flusso (rapporto 1,50, non più 1,0) cambiano forma nel disegno e nella riga di legenda.
 * Nessuna posizione di nodo o percorso di tubo si sposta: questo impianto non ha condense né
 * riduttori, quindi non copre quella metà del task.
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
 * della tabella. Il disegno non cambia di un carattere: verificato confrontando, prima di
 * aggiornare questo file, la porzione fra il fondo bianco e l'inizio della tabella.
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
 *
 * Generato di nuovo il 18-08-2026, Task 4 del Blocco 2 («la linea di processo si dispone per
 * ancore»). Due righe cambiate, per un'unica causa: il terminale utenze si allinea alla quota
 * dell'ancora `dx` del serbatoio (convenzione 4) invece che alla mezzeria del suo riquadro, e la
 * tubazione che vi arriva diventa quindi DRITTA — spariscono i due vertici della piega, che
 * `rottaLinea` non emette piu' quando i capi stanno alla stessa quota. Nessun simbolo e nessuna
 * regola di instradamento sono stati toccati: il resto del disegno e' identico carattere per
 * carattere.
 *
 * Generato di nuovo il 18-08-2026, Task 6 del Blocco 2 («il modello dice dove vanno le valvole e
 * da dove esce la mandata»). Tre cambiamenti, tutti voluti:
 *
 * - la **mandata del compressore si spezza in due tronconi**: ondulata dal cielo del compressore
 *   fino alla valvola, dritta da li' in su (`stileAValle: 'standard'` sul segno) — convenzione 1,
 *   «sotto la valvola flessibile, sopra rigido»;
 * - la **valvola della mandata passa dal mezzo del tubo al montante**, un passo di griglia (10)
 *   sotto la dorsale: e' il primo ancoraggio che `risolviSegniAncorati` traduce davvero in una `t`;
 * - compare la **valvola di riserva prima del tratto verso le utenze** (convenzione 6), a meta'
 *   del primo tratto.
 *
 * Dove il serbatoio e' VERTICALE si vede anche la convenzione 2: la dorsale scende fino
 * all'ancora `sx-basso` invece di fermarsi alla `sx`, 160 unita' piu' in alto.
 *
 * Ritoccato di nuovo il 18-08-2026, dopo che il committente ha corretto a mano il disegno
 * generato. Due misure:
 *
 * - la **dorsale dei compressori scende**. Correva sopra il RIQUADRO del serbatoio, che comprende
 *   lo spazio della valvola di sicurezza: ora passa un passo di griglia sopra il CORPO, e i
 *   montanti non nascono piu' lunghi il doppio del disegno vero. Quando i compressori sono piu'
 *   alti del corpo del serbatoio — col serbatoio ORIZZONTALE, che e' il caso di questa fixture —
 *   sono loro a dettare la quota, con un margine piu' largo (60) che lascia posto alla valvola e
 *   a un tratto di molla;
 * - la **valvola della mandata scende di un altro passo**, da 10 a 20 unita' sotto la dorsale.
 *
 * Generato di nuovo il 18-08-2026, Task 3 del Blocco 4 («il disegno si stringe in larghezza»). Gli
 * stacchi fra le famiglie diventano costanti proprie e scendono ai valori misurati sui riferimenti:
 * fra due compressori da 60 a 20 (`PASSO_COMPRESSORI`), fra l'ultimo compressore e il serbatoio da
 * 140 a 90 (`STACCO_COMPRESSORI_SERBATOI`, che prima non aveva un nome: era `PASSO_ORIZZONTALE` piu'
 * `PASSO_VERTICALE`), e fra il serbatoio e il primo stadio da 60 a 70 (`STACCO_SERBATOI_LINEA`, il
 * solo che cresce — su quel tratto sta la valvola di riserva). `xFinale` di `disponiInRiga` diventa
 * il solo bordo destro dell'ultimo elemento, senza il passo implicito che ci finiva dentro.
 *
 * Verificato sul diff, e non a occhio: il markup e' identico carattere per carattere a meno dei
 * numeri, e fra i numeri cambiano SOLO quelli dell'asse x — `x`, `x1`, `x2`, le ascisse dentro `d` e
 * `transform`, `viewBox` e `width`. Nessuna ordinata, nessuna altezza, nessun simbolo.
 */
export const RIGHE_SVG_RIFERIMENTO_SENZA_TESTI = [
  `<svg xmlns="http://www.w3.org/2000/svg" width="870" height="802" viewBox="0 0 870 802">`,
  `<rect width="870" height="802" fill="#fff" />`,
  `<path d="M 100 290 Q 105 285 100 280 Q 95 275 100 270 Q 105 265 100 260 Q 100 255 100 250" fill="none" stroke="#000" stroke-width="2" />`,
  `<path d="M 100 250 L 100 230 L 216 230 L 216 360 L 250 360" fill="none" stroke="#000" stroke-width="2" />`,
  `<rect x="95.5" y="241" width="9" height="18" fill="#fff" stroke="none" />`,
  `<path d="M 95.5 241 L 104.5 241 L 100 250 Z M 95.5 259 L 104.5 259 L 100 250 Z" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" />`,
  `<path d="M 560 360 L 730 360" fill="none" stroke="#000" stroke-width="2" />`,
  `<rect x="636" y="355.5" width="18" height="9" fill="#fff" stroke="none" />`,
  `<path d="M 636 355.5 L 636 364.5 L 645 360 Z M 654 355.5 L 654 364.5 L 645 360 Z" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" />`,
  `<g transform="translate(40 290)"><rect x="0" y="0" width="120" height="120" fill="none" stroke="#000" stroke-width="2" /><circle cx="60" cy="60" r="30" fill="none" stroke="#000" stroke-width="2" /><path d="M 46.5 33.3 L 86.1 45" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /><path d="M 46.5 86.7 L 86.1 75" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /><text x="10" y="20" font-family="Arial, Helvetica, sans-serif" font-size="24" text-anchor="start" dominant-baseline="central" fill="#000">C1</text></g>`,
  `<g transform="translate(250 270)"><rect x="0" y="40" width="310" height="100" rx="50" ry="50" fill="none" stroke="#000" stroke-width="2" /><text x="192.2" y="90" font-family="Arial, Helvetica, sans-serif" font-size="24" text-anchor="middle" dominant-baseline="central" fill="#000">S1</text><path d="M 70 40 L 70 34" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /><rect x="64" y="22" width="12" height="12" fill="none" stroke="#000" stroke-width="2" /><path d="M 64 25 L 76 25 M 64 28 L 76 28 M 64 31 L 76 31" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /><text x="70" y="10" font-family="Arial, Helvetica, sans-serif" font-size="14" text-anchor="middle" dominant-baseline="central" fill="#000">S1.1</text><path d="M 235.5 141 L 244.5 141 L 240 150 Z M 235.5 159 L 244.5 159 L 240 150 Z" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /><path d="M 240 159 L 240 167" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /></g>`,
  `<g transform="translate(630 190)"><path d="M 100 170 L 100 68.5" fill="none" stroke="#000" stroke-width="2" stroke-dasharray="10 7" /><path d="M 94 69.5 L 100 56.5 L 106 69.5 Z" fill="#000" /><text xml:space="preserve" font-family="Arial, Helvetica, sans-serif" font-size="18" text-anchor="middle" dominant-baseline="central" fill="#000"><tspan x="100" y="19">Utenze</tspan><tspan x="100" y="41.5">aria</tspan></text></g>`,
  `<rect x="110" y="490" width="650" height="34" fill="none" stroke="#000" stroke-width="2" />`,
  `<text x="435" y="507" font-family="Arial, Helvetica, sans-serif" font-size="20" text-anchor="middle" dominant-baseline="central" fill="#000">LISTA APPARECCHIATURE</text>`,
  `<rect x="110" y="524" width="650" height="34" fill="none" stroke="#000" stroke-width="1" />`,
  `<line x1="240" y1="524" x2="240" y2="558" stroke="#000" stroke-width="1" />`,
  `<text x="175" y="541" font-family="Arial, Helvetica, sans-serif" font-size="16" text-anchor="middle" dominant-baseline="central" fill="#000">C1</text>`,
  `<text x="252" y="541" font-family="Arial, Helvetica, sans-serif" font-size="16" dominant-baseline="central" fill="#000">Compressore KAESER Mod. CSD 105 SFC</text>`,
  `<rect x="110" y="558" width="650" height="34" fill="none" stroke="#000" stroke-width="1" />`,
  `<line x1="240" y1="558" x2="240" y2="592" stroke="#000" stroke-width="1" />`,
  `<text x="175" y="575" font-family="Arial, Helvetica, sans-serif" font-size="16" text-anchor="middle" dominant-baseline="central" fill="#000">S1</text>`,
  `<text x="252" y="575" font-family="Arial, Helvetica, sans-serif" font-size="16" dominant-baseline="central" fill="#000">Serbatoio SICC TECH s.r.l. Mod. 2000-20011R2</text>`,
  `<rect x="110" y="592" width="650" height="34" fill="none" stroke="#000" stroke-width="1" />`,
  `<line x1="240" y1="592" x2="240" y2="626" stroke="#000" stroke-width="1" />`,
  `<text x="175" y="609" font-family="Arial, Helvetica, sans-serif" font-size="16" text-anchor="middle" dominant-baseline="central" fill="#000">S1.1</text>`,
  `<text x="252" y="609" font-family="Arial, Helvetica, sans-serif" font-size="16" dominant-baseline="central" fill="#000">Valvola di sicurezza PADOVAN VALERIO snc Mod. TA21</text>`,
  `<rect x="110" y="626" width="650" height="34" fill="none" stroke="#000" stroke-width="1" />`,
  `<line x1="240" y1="626" x2="240" y2="660" stroke="#000" stroke-width="1" />`,
  `<g transform="translate(175 643)"><rect x="-9" y="-4.5" width="18" height="9" fill="#fff" stroke="none" /><path d="M -9 -4.5 L -9 4.5 L 0 0 Z M 9 -4.5 L 9 4.5 L 0 0 Z" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /></g>`,
  `<text x="252" y="643" font-family="Arial, Helvetica, sans-serif" font-size="16" dominant-baseline="central" fill="#000">Valvola di intercettazione</text>`,
  `<rect x="110" y="660" width="650" height="34" fill="none" stroke="#000" stroke-width="1" />`,
  `<line x1="240" y1="660" x2="240" y2="694" stroke="#000" stroke-width="1" />`,
  `<g transform="translate(175 677)"><path d="M -4.5 -13 L 4.5 -13 L 0 -4 Z M -4.5 5 L 4.5 5 L 0 -4 Z" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /><path d="M 0 5 L 0 13" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /></g>`,
  `<text x="252" y="677" font-family="Arial, Helvetica, sans-serif" font-size="16" dominant-baseline="central" fill="#000">Valvola di scarico</text>`,
  `<rect x="110" y="694" width="650" height="34" fill="none" stroke="#000" stroke-width="1" />`,
  `<line x1="240" y1="694" x2="240" y2="728" stroke="#000" stroke-width="1" />`,
  `<g transform="translate(175 711)"><path d="M -30 0 L 30 0" fill="none" stroke="#000" stroke-width="2" /></g>`,
  `<text x="252" y="711" font-family="Arial, Helvetica, sans-serif" font-size="16" dominant-baseline="central" fill="#000">Tubazione rigida</text>`,
  `<rect x="110" y="728" width="650" height="34" fill="none" stroke="#000" stroke-width="1" />`,
  `<line x1="240" y1="728" x2="240" y2="762" stroke="#000" stroke-width="1" />`,
  `<g transform="translate(175 745)"><path d="M -30 0 Q -25 5 -20 0 Q -15 -5 -10 0 Q -5 5 0 0 Q 5 -5 10 0 Q 15 5 20 0 Q 25 0 30 0" fill="none" stroke="#000" stroke-width="2" /></g>`,
  `<text x="252" y="745" font-family="Arial, Helvetica, sans-serif" font-size="16" dominant-baseline="central" fill="#000">Tubazione flessibile</text>`,
  `</svg>`
]

/** Ricomposto qui, non lasciato come array nel test: il confronto resta su una stringa sola. */
export const SVG_RIFERIMENTO_SENZA_TESTI = RIGHE_SVG_RIFERIMENTO_SENZA_TESTI.join('')
