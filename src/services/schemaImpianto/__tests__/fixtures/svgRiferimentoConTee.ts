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
 * tempo lo scopre — qui, la geometria della giunzione decisa nel Blocco D3: il pallino col suo
 * raggio e le sue quattro ancore tutte al centro del riquadro 20×20 (24×24 fino al Task 8 del
 * Blocco 3), non più sulle mezzerie dei lati.
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
 * Generato l'ultima volta dal commit 86a3767 ("feat(schema): la linea si interrompe dentro
 * valvole e riduttori"), Task 3 del Blocco D4: il rettangolo bianco che copre la farfalla della
 * valvola di intercettazione (`<rect ... fill="#fff" />` prima del `<path>` della farfalla, sia
 * nel disegno sia nella riga di legenda).
 *
 * Verificato di nuovo al commit 5cfe586 ("feat(schema): il muro non si disegna piu' da solo"),
 * Task 5 del Blocco D4: contenuto invariato. L'impianto di questa fixture ha apparecchiature in
 * un solo gruppo (nessuna in linea distribuzione), quindi non aveva un muro nemmeno prima — il
 * Task 5, che toglie il muro disegnato in automatico, non ha nulla da togliere qui.
 *
 * Generato di nuovo al commit 2bb8482 ("feat(schema): i tre rombi si distinguono per il segno
 * interno, come nel CAD"), Task 3 del Blocco 3: `valvolaScarico` prende una misura
 * ('serbatoio' | 'apparecchio') e la farfalla del serbatoio S1 diventa più stretta (semilarghezza
 * 8 -> 4,5, rapporto ~1:2 misurato sul CAD anziché l'8:9 quasi quadrato di prima) — nel disegno e
 * nella riga di legenda "Valvola di scarico". Questo impianto non porta essiccatori, filtri né
 * separatori: il segno interno dei tre rombi (l'altra metà del task) non è coperto qui.
 *
 * Generato di nuovo al commit ebbde4c ("feat(schema): proporzioni dei simboli dai blocchi CAD,
 * ingombro proprio per il serbatoio orizzontale"), Task 4 del Blocco 3: compressore quadrato
 * (129×129, due corde oblique nella girante) e serbatoio orizzontale con riquadro proprio
 * (310×137) spostano le coordinate di nodi e tubi, e il tratto dalla giunzione verso le utenze
 * guadagna un gomito (`raccordoOrtogonale`) che prima non serviva, perché i due capi non sono più
 * sullo stesso asse. Il testo della tabella e delle legende non cambia.
 *
 * Verificato di nuovo (fix round 1, revisione dello stesso Task 4): il serbatoio orizzontale ora
 * allinea la propria base a quella del compressore per altezza vera (`disponiInRiga`,
 * allineamento `'basso'`, layout.ts) invece che su un'altezza di riga assunta uniforme — sposta
 * ulteriormente le coordinate di nodi e tubi, nessun altro cambiamento.
 *
 * Generato di nuovo al commit cb31278 ("feat(schema): le ancore di fabbrica cadono tutte sulla
 * griglia"), Task 8 del Blocco 3: le ancore di
 * fabbrica sono arrotondate ai multipli di 10 — compressore 129×129 → 120×120, serbatoio
 * orizzontale 310×137 → 310×140, giunzione 24×24 → 20×20 (il test in renderSvg.test.ts che
 * costruisce questo layout sposta di conseguenza l'offset che centra la giunzione sul tubo, da
 * -12 a -10). Cambiano `viewBox`, i capi degli archi e le coordinate dei nodi; il testo della
 * tabella e delle legende non cambia.
 *
 * Generato di nuovo al commit e003967 ("feat(schema): valvole, riduttore, freccia e muro fedeli
 * ai blocchi"), Task 13 del Blocco 3: stesso cambiamento del gemello `svgRiferimentoSenzaTesti.ts`
 * (stesso impianto di base) — la farfalla della valvola di intercettazione e il marker della
 * freccia di flusso cambiano rapporto. Nessuna posizione di nodo o percorso di tubo si sposta.
 *
 * Generato di nuovo il 17-08-2026 (rifinitura R4): il pallino della giunzione dimezza il raggio su
 * richiesta del committente. Una riga sola cambia, il `<circle>` dentro il `<g>` della giunzione;
 * le ancore restano dove sono, quindi nessuna coordinata di nodo o di tubo si sposta.
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
 * della tabella. Il disegno non cambia di un carattere — la geometria del TEE compresa, che è ciò
 * che questa fixture esiste per sorvegliare: verificato confrontando, prima di aggiornare questo
 * file, la porzione fra il fondo bianco e l'inizio della tabella.
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
 *
 * **Una premessa dei documenti precedenti era falsa, e questo e' il posto per dirlo.** La specifica
 * del 17-08-2026 e le consegne dei Blocchi 2 e 3 dicevano che questa fixture «costruisce il layout a
 * mano», e ne ricavavano la regola «se cambia, ci si ferma». Mano e' solo il TEE: `layoutConTee`
 * (renderSvg.test.ts) parte da `layoutSchema` sulla stessa scheda minima delle altre due, e ci
 * innesta la giunzione a meta' del tubo S1 -> UTENZE. Ogni costante che muove il serbatoio muove
 * quindi anche questo disegno, TEE compreso, e non e' un difetto.
 *
 * La regola resta buona nella sostanza — se cambia, si GUARDA il diff prima di qualsiasi altra cosa
 * — ma la sua ragione e' un'altra: qui, a differenza delle altre due, si vede la geometria del TEE
 * (pallino al centro del riquadro e tubi che vi convergono), che nessun altro test del documento
 * copre.
 *
 * Generato di nuovo il 18-08-2026, Task 4 del Blocco 4 («la dorsale scende sulla cima dei
 * compressori»). `MARGINE_COLLETTORE_COMPRESSORI` passa da 60 a 80, il valore misurato su
 * `no bypass.png` (46 px fra la dorsale e la cima dei compressori, cioe' 79 unita' alla scala di
 * quell'immagine). Questa fixture porta un serbatoio ORIZZONTALE, il cui corpo sta piu' in basso
 * della cima dei compressori: e' il caso in cui sono loro a dettare la quota, e infatti si muove.
 *
 * Verificato sul diff: cambiano SOLO le ordinate, di 20 unita', e il montante flessibile guadagna
 * due ondulazioni perche' e' piu' lungo di altrettanto (`ondula` ne emette una ogni 10 unita', quindi
 * il tracciato ha due `Q` in piu' — l'unica riga in cui cambia il markup, e cambia in lunghezza, non
 * in forma). Nessuna ascissa, nessuna larghezza, nessun simbolo.
 *
 * Generato di nuovo il 18-08-2026, fix di `PASSO_TERMINALE` (difetto trovato su una pratica vera,
 * BADOER INFISSI): il terminale utenze non si posa piu' a `rigaCatena.xFinale` (bordo destro
 * dell'ultimo elemento piu' `PASSO_ORIZZONTALE`, un margine fra FAMIGLIE non fra un elemento e il
 * tratto che lo prosegue) ma a un passo fisso dall'ancora `dx` dell'ultimo elemento della linea —
 * venti unita', come ogni altro «vicino» della catena, non le centosettanta di prima. Il TEE di
 * questa fixture si posa a meta' del tubo S1 → UTENZE: muovendosi il capo UTENZE, si muove anche
 * lui, e con lui i due tratti che lo toccano.
 *
 * Verificato sul diff: il markup resta identico, cambiano solo le ascisse (mai un'ordinata, mai un
 * simbolo). `d.x`/`transform.x` -150 e -75 (il TEE e cio' che sta oltre), `viewBox.x`/`width` -140
 * (il foglio si stringe), `x`/`x1`/`x2` -70 (tabella, che si ricentra sul disegno piu' stretto).
 *
 * Generato di nuovo il 19-08-2026, rifiniture dei blocchi chieste dal committente: il riquadro del
 * serbatoio riserva ora spazio sotto il corpo per la valvola di scarico
 * (`MARGINE_SCARICO_SERBATOIO`, 30) e 10 in piu' sopra (`MARGINE_VALVOLA_SERBATOIO` 40 → 50), la
 * valvola di scarico si attacca al corpo e porta il braccio di manovra.
 *
 * Verificato sul diff (confronto strutturato, 43 elementi da entrambi i lati): nessun elemento in
 * piu' o in meno, nessuna scritta cambiata, markup diverso nei soli due elementi attesi — il
 * simbolo del serbatoio e la riga di legenda «Valvola di scarico». Cambiano `height`/`viewBox`
 * (+40, il foglio si allunga) e le ordinate: la GIUNZIONE scende di 10 (sta a meta' del tubo
 * S1 → UTENZE, che nasce dall'ancora `dx` del serbatoio, scesa con il corpo), e con lei il
 * terminale e i due tratti che la toccano. Nessuna ascissa.
 */
export const RIGHE_SVG_RIFERIMENTO_CON_TEE = [
  `<svg xmlns="http://www.w3.org/2000/svg" width="730" height="842" viewBox="0 0 730 842">`,
  `<rect width="730" height="842" fill="#fff" />`,
  `<path d="M 100 330 Q 105 325 100 320 Q 95 315 100 310 Q 105 305 100 300 Q 95 295 100 290 Q 105 285 100 280 Q 100 275 100 270" fill="none" stroke="#000" stroke-width="2" />`,
  `<path d="M 100 270 L 100 250 L 216 250 L 216 370 L 250 370" fill="none" stroke="#000" stroke-width="2" />`,
  `<rect x="95.5" y="261" width="9" height="18" fill="#fff" stroke="none" />`,
  `<path d="M 95.5 261 L 104.5 261 L 100 270 Z M 95.5 279 L 104.5 279 L 100 270 Z" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" />`,
  `<path d="M 560 370 L 570 370" fill="none" stroke="#000" stroke-width="2" />`,
  `<path d="M 570 370 L 580 370" fill="none" stroke="#000" stroke-width="2" />`,
  `<g transform="translate(40 330)"><rect x="0" y="0" width="120" height="120" fill="none" stroke="#000" stroke-width="2" /><circle cx="60" cy="60" r="30" fill="none" stroke="#000" stroke-width="2" /><path d="M 46.5 33.3 L 86.1 45" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /><path d="M 46.5 86.7 L 86.1 75" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /><text x="10" y="20" font-family="Arial, Helvetica, sans-serif" font-size="24" text-anchor="start" dominant-baseline="central" fill="#000">C1</text></g>`,
  `<g transform="translate(250 270)"><rect x="0" y="50" width="310" height="100" rx="50" ry="50" fill="none" stroke="#000" stroke-width="2" /><text x="192.2" y="100" font-family="Arial, Helvetica, sans-serif" font-size="24" text-anchor="middle" dominant-baseline="central" fill="#000">S1</text><path d="M 70 50 L 70 44" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /><rect x="62.5" y="24" width="15" height="20" fill="none" stroke="#000" stroke-width="2" /><path d="M 62.5 29.4 L 77.5 29.4" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /><path d="M 63.5 31.346666666666664 L 76.5 35.24 M 76.5 35.24 L 63.5 39.13333333333333 M 63.5 39.13333333333333 L 76.5 43.026666666666664" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /><text x="70" y="12" font-family="Arial, Helvetica, sans-serif" font-size="14" text-anchor="middle" dominant-baseline="central" fill="#000">S1.1</text><path d="M 235.5 150 L 244.5 150 L 240 159 Z M 235.5 168 L 244.5 168 L 240 159 Z" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /><path d="M 234.6 159 L 240 159" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /><path d="M 234.6 156.525 L 234.6 161.475" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /><path d="M 240 168 L 240 180" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /></g>`,
  `<g transform="translate(480 200)"><path d="M 100 170 L 100 68.5" fill="none" stroke="#000" stroke-width="2" stroke-dasharray="10 7" /><path d="M 94 69.5 L 100 56.5 L 106 69.5 Z" fill="#000" /><text xml:space="preserve" font-family="Arial, Helvetica, sans-serif" font-size="18" text-anchor="middle" dominant-baseline="central" fill="#000"><tspan x="100" y="19">Utenze</tspan><tspan x="100" y="41.5">aria</tspan></text></g>`,
  `<g transform="translate(560 360)"><circle cx="10" cy="10" r="2.5" fill="#000" /></g>`,
  `<rect x="40" y="530" width="650" height="34" fill="none" stroke="#000" stroke-width="2" />`,
  `<text x="365" y="547" font-family="Arial, Helvetica, sans-serif" font-size="20" text-anchor="middle" dominant-baseline="central" fill="#000">LISTA APPARECCHIATURE</text>`,
  `<rect x="40" y="564" width="650" height="34" fill="none" stroke="#000" stroke-width="1" />`,
  `<line x1="170" y1="564" x2="170" y2="598" stroke="#000" stroke-width="1" />`,
  `<text x="105" y="581" font-family="Arial, Helvetica, sans-serif" font-size="16" text-anchor="middle" dominant-baseline="central" fill="#000">C1</text>`,
  `<text x="182" y="581" font-family="Arial, Helvetica, sans-serif" font-size="16" dominant-baseline="central" fill="#000">Compressore KAESER Mod. CSD 105 SFC</text>`,
  `<rect x="40" y="598" width="650" height="34" fill="none" stroke="#000" stroke-width="1" />`,
  `<line x1="170" y1="598" x2="170" y2="632" stroke="#000" stroke-width="1" />`,
  `<text x="105" y="615" font-family="Arial, Helvetica, sans-serif" font-size="16" text-anchor="middle" dominant-baseline="central" fill="#000">S1</text>`,
  `<text x="182" y="615" font-family="Arial, Helvetica, sans-serif" font-size="16" dominant-baseline="central" fill="#000">Serbatoio SICC TECH s.r.l. Mod. 2000-20011R2</text>`,
  `<rect x="40" y="632" width="650" height="34" fill="none" stroke="#000" stroke-width="1" />`,
  `<line x1="170" y1="632" x2="170" y2="666" stroke="#000" stroke-width="1" />`,
  `<text x="105" y="649" font-family="Arial, Helvetica, sans-serif" font-size="16" text-anchor="middle" dominant-baseline="central" fill="#000">S1.1</text>`,
  `<text x="182" y="649" font-family="Arial, Helvetica, sans-serif" font-size="16" dominant-baseline="central" fill="#000">Valvola di sicurezza PADOVAN VALERIO snc Mod. TA21</text>`,
  `<rect x="40" y="666" width="650" height="34" fill="none" stroke="#000" stroke-width="1" />`,
  `<line x1="170" y1="666" x2="170" y2="700" stroke="#000" stroke-width="1" />`,
  `<g transform="translate(105 683)"><rect x="-9" y="-4.5" width="18" height="9" fill="#fff" stroke="none" /><path d="M -9 -4.5 L -9 4.5 L 0 0 Z M 9 -4.5 L 9 4.5 L 0 0 Z" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /></g>`,
  `<text x="182" y="683" font-family="Arial, Helvetica, sans-serif" font-size="16" dominant-baseline="central" fill="#000">Valvola di intercettazione</text>`,
  `<rect x="40" y="700" width="650" height="34" fill="none" stroke="#000" stroke-width="1" />`,
  `<line x1="170" y1="700" x2="170" y2="734" stroke="#000" stroke-width="1" />`,
  `<g transform="translate(105 717)"><path d="M -4.5 -13 L 4.5 -13 L 0 -4 Z M -4.5 5 L 4.5 5 L 0 -4 Z" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /><path d="M -5.3999999999999995 -4 L 0 -4" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /><path d="M -5.3999999999999995 -6.475 L -5.3999999999999995 -1.525" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /><path d="M 0 5 L 0 13" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" /></g>`,
  `<text x="182" y="717" font-family="Arial, Helvetica, sans-serif" font-size="16" dominant-baseline="central" fill="#000">Valvola di scarico</text>`,
  `<rect x="40" y="734" width="650" height="34" fill="none" stroke="#000" stroke-width="1" />`,
  `<line x1="170" y1="734" x2="170" y2="768" stroke="#000" stroke-width="1" />`,
  `<g transform="translate(105 751)"><path d="M -30 0 L 30 0" fill="none" stroke="#000" stroke-width="2" /></g>`,
  `<text x="182" y="751" font-family="Arial, Helvetica, sans-serif" font-size="16" dominant-baseline="central" fill="#000">Tubazione rigida</text>`,
  `<rect x="40" y="768" width="650" height="34" fill="none" stroke="#000" stroke-width="1" />`,
  `<line x1="170" y1="768" x2="170" y2="802" stroke="#000" stroke-width="1" />`,
  `<g transform="translate(105 785)"><path d="M -30 0 Q -25 5 -20 0 Q -15 -5 -10 0 Q -5 5 0 0 Q 5 -5 10 0 Q 15 5 20 0 Q 25 0 30 0" fill="none" stroke="#000" stroke-width="2" /></g>`,
  `<text x="182" y="785" font-family="Arial, Helvetica, sans-serif" font-size="16" dominant-baseline="central" fill="#000">Tubazione flessibile</text>`,
  `</svg>`
]

/** Ricomposto qui, non lasciato come array nel test: il confronto resta su una stringa sola. */
export const SVG_RIFERIMENTO_CON_TEE = RIGHE_SVG_RIFERIMENTO_CON_TEE.join('')
