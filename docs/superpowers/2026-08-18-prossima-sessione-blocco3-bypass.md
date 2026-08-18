# Consegna alla sessione successiva — schema d'impianto, il by-pass (Blocco 3)

Scritto il 18-08-2026, a Blocchi 1 e 2 finiti. Chi riprende parte da qui.

## Dove sta il lavoro

Ramo **`worktree-schema-prima-versione-blocco1`**, worktree
`.claude/worktrees/schema-prima-versione-blocco1`. **Quattordici commit, nulla fuso su `main`.**
Il Blocco 3 continua su questo stesso ramo; il merge simulato con `git merge-tree` contro un
`origin/main` appena `fetch`ato si fa **alla fine del Blocco 3**, non prima.

`.env.local` è git-ignored: va copiato dal checkout principale nel worktree, o un file di test
fallisce per variabili mancanti. **Contiene anche le credenziali dell'applicazione**
(`APP_LOGIN_EMAIL` / `APP_LOGIN_PASSWORD`, ruolo admin): non chiederle al committente.

**Baseline al commit `9963307`: 1394 test verdi, 100 file, `tsc` pulito, eslint invariato.**

## Da leggere, in quest'ordine

1. **La specifica**, per intera: `docs/superpowers/specs/2026-08-17-schema-impianto-prima-versione-design.md`
   — le otto convenzioni, le decisioni del committente, i rischi.
2. **Il piano del Blocco 2**: `docs/superpowers/plans/2026-08-18-schema-impianto-prima-versione-blocco2.md`,
   col paragrafo «cosa è andato diversamente» in coda. Il Blocco 3 si appoggia su quella geometria.
3. **La consegna precedente**: `docs/superpowers/2026-08-18-prossima-sessione-schema-prima-versione.md`
   — dieci trappole e le decisioni da non ridiscutere. **Due sue affermazioni sono state smentite,
   vedi sotto.**
4. **I riferimenti visivi, in git:** `DOCUMENTAZIONE/relazione/si bypass.png` (il metro di QUESTO
   blocco) e `no byass.png` (attenzione al nome: `byass`, refuso del committente, non correggerlo o
   i link si rompono).

## Cosa esiste già, e che il Blocco 3 consuma

Dal **Blocco 1**: `SchemaAncoraggioSegno` e `tDaAncoraggio` (`tratti.ts`);
`additional_info.schemaPreferenze`; `services/schemaImpianto/preferenze.ts` con `famiglieDaScheda`,
`risolviPreferenze`, `contigui`, `prossimoIdBypass`, `improntaPreferenze`;
`components/relazione/PannelloPreferenzeSchema.tsx` con «Crea by-pass» già in interfaccia.

Dal **Blocco 2**:

- **`preferenzeRisolteDaScheda(scheda, preferenze)`** è l'**unico ingresso** per chi parte da una
  scheda. Pannello e generatore passano di lì: non aggiungerne un secondo.
- **`catenaDagliArchi(model, pozzo)`** (`layout.ts`) legge la sequenza della linea **dagli archi**.
  Attraversa già i nodi `giunzione`: i TEE del by-pass entreranno nella catena senza toccarla.
- **`risolviSegniAncorati(layout, quote, libreria)`** (`segniAncorati.ts`), ultimo passo di
  `layoutSchema`. **Contratto di sola andata**: `ancoraggio` entra e non esce. Verificato sul dato
  vero in produzione — il layout salvato di `002 test` non porta nessun `ancoraggio` residuo.
- **`buildSchemaModel`** riceve `preferenze: PreferenzeRisolte` e `libreria: Tarature`. Legge già
  `preferenze.bypass` per decidere se seminare le valvole di riserva (`scavalcati`): nel Blocco 2
  quell'insieme è sempre vuoto, nel Blocco 3 si popola.
- **`GIOCO_FRA_STADI`** (0), **`MARGINE_COLLETTORE`** (10), **`MARGINE_COLLETTORE_COMPRESSORI`**
  (60): le costanti esposte per la taratura del Blocco 4.

## Il Blocco 3 — il by-pass

Riproduce `si bypass.png`. Modulo nuovo `services/schemaImpianto/bypass.ts`, **non** dentro
`buildArchi`: è una trasformazione di sequenza con invarianti proprie (contiguità, id stabili, un
TEE per confine) che merita test suoi.

- Un gruppo = **due nodi `giunzione`** sulla linea (`BP1-IN`, `BP1-OUT`, da `bp1` delle
  preferenze) più **un arco** che li unisce, con gomiti espliciti: sale, corre, ridiscende.
- Sull'arco **tre segni**: valvola sul montante sinistro `{vertice: 1, scarto: -20}` con
  `stileAValle: 'standard'`; valvola `{meta: tratto 1}` senza `stileAValle`; valvola sul montante
  destro `{vertice: 2, scarto: +20}` con `stileAValle: 'flessibile'`. Stile di partenza dell'arco:
  `'flessibile'`.
  **Nota:** la specifica dice `±10`. Sono **20** dal 18-08-2026, per la stessa correzione che il
  committente ha fatto sulle valvole della mandata — le due misure devono restare uguali, o due
  valvole affiancate nel disegno starebbero a quote diverse.
- **I gomiti sono obbligatori, non un'ottimizzazione.** Entrambi i capi stanno su una giunzione,
  che impone il lato: senza gomiti `rottaImboccata` piega a `yMedia` (`tratti.ts`) — che coi due
  TEE alla stessa quota è la loro stessa quota — e `dedup` collassa tutto in una retta orizzontale
  sovrapposta alla linea di processo. Il by-pass sparirebbe alla vista pur esistendo nel modello.
- Origine dei TEE: **`'scheda'`**, come `UTENZE`. `'manuale'` li renderebbe indistruttibili, e
  sciogliere un gruppo lascerebbe due TEE orfani su ogni disegno riaperto.
- **Con almeno un by-pass la linea di processo scende di una corsia**, così il ponte corre sotto
  l'uscita del serbatoio invece di accavallarcisi.
- `riconcilia` (`persistenza.ts:297-419`), due correzioni: **`archiNuovi` deve prendere gli archi
  dal layout automatico, non dal modello** (righe 356-364 e 401) — dal modello arriverebbero con
  `t` di ripiego e senza ponte; e **sciogliere un by-pass spezza la catena**, perché l'arco
  sostitutivo non viene ripescato (nessuno dei due capi è fra i nodi aggiunti): serve un'invariante
  sullo stampo di quella già scritta per il terminale alle righe 400-403.
- `improntaPreferenze` esiste già e qui trova il suo uso, con un campo opzionale
  `preferenzeApplicate` su `LayoutSalvato` (nessun bump di `VERSIONE`).

**Nessuna fixture deve cambiare nel Blocco 3**: descrivono impianti senza stadi e senza by-pass.
Se cambiano, è un difetto — e stavolta l'avvertenza vale davvero anche per `svgRiferimentoConTee`.

## Due affermazioni della consegna precedente che sono state smentite

1. **«`svgRiferimentoConTee` costruisce il layout a mano e non passa da `buildSchemaModel`».**
   Falso: ci passa, e costruisce a mano solo la giunzione. Tutte e tre le fixture cambiano quando
   cambia il layout, e nel Blocco 2 sono cambiate tutte e tre.
2. **«La convenzione 1 vuole la valvola un passo di griglia sotto la dorsale».** Il committente,
   correggendo il disegno il 18-08-2026, l'ha portata a **due** passi (20). Vale anche per le
   valvole del ponte.

## Aperto per il Blocco 4, da non perdere

- **Il tratteggio delle condense si perde dove le linee si sovrappongono** (osservazione del
  committente, 18-08-2026). Sei linee condense corrono sulla stessa corsia orizzontale con le fasi
  disallineate — `stroke-dasharray` riparte da capo su ogni `<path>`, e ogni tratto riempie i vuoti
  del vicino: il risultato sembra una linea continua. Due strade:
  - **fasare i tratteggi**, calcolando uno `stroke-dashoffset` dalla lunghezza percorsa fino
    all'inizio del tratto orizzontale, così tutti cadono sulla stessa griglia. Locale a
    `trattoSvg` (`renderSvg.ts`), non tocca il modello. È la strada che consiglio;
  - **un collettore condense unico**: una sola linea orizzontale, coi montanti che vi si
    innestano. Più fedele agli schemi veri, ma è un cambiamento del modello (oggi ogni
    apparecchiatura ha il suo arco fino al pozzo) e va discusso col committente.
- **La compattezza in larghezza** (convenzione 8): gli spazi fra compressori, serbatoio e primo
  stadio restano più larghi che nel riferimento. **Non** ritoccare `PASSO_ORIZZONTALE`
  (`layout.ts`), condiviso con `calcolaMuro` e con la spaziatura di compressori e serbatoi:
  introdurre `PASSO_COMPRESSORI` e `PASSO_SERBATOI` separati.
- **`GIOCO_FRA_STADI`, 0 o 20.** I rombi portano codoli da 10 unità che sporgono fuori dal
  riquadro: a gioco 0 il codolo destro di ogni stadio entra di 10 unità nella punta del vicino. A
  20 i codoli si toccano e formano il collegamento. **Domanda aperta al committente**, posta il
  18-08-2026 e non ancora risposta.
- Nel disegno corretto a mano dal committente la dorsale è ancora un po' più bassa e il tratto di
  molla più corto di quanto esca ora: `MARGINE_COLLETTORE` è la costante da guardare.

## Il gate, a ogni task

```
npx vitest run
npx tsc --noEmit
npx eslint <percorsi toccati>
```

Niente `prettier --write`. **Il conto dei warning eslint non è zero ovunque: è «non uno più di
prima»** — `src/services/schemaImpianto` 0, `src/components/schemaImpianto` 3 (preesistenti),
`services/relazione` + `components/relazione` + `pages/TechnicalDetails.tsx` +
`utils/equipmentCodes.ts` 18. Un `--max-warnings 0` su quei percorsi fallisce anche senza toccarli.

Nessun test di interfaccia: la logica provabile va in servizi e hook (`CLAUDE.md`).

## Trappole che restano vere

1. **Zod cancella i campi che non conosce.** `additionalInfoSchema` (`services/relazione/schema.ts`)
   è un `z.object` senza `passthrough`, e `additionalInfo` in `RelazioneDataDialog.tsx` è costruito
   da un letterale che non fa spread. Un campo nuovo in `additional_info` va dichiarato in
   **entrambi** o sparisce alla prima relazione generata, in silenzio.
2. **`sx-basso` non esiste sul serbatoio ORIZZONTALE**, e una taratura permanente può toglierlo
   anche al verticale. Si legge l'**esistenza** dell'ancora, mai la geometria (`ancoraMandata`,
   `buildSchemaModel.ts`).
3. **L'arco si emette sempre**, anche degenere fra due stadi adiacenti — è il tessuto che ripara il
   disegno appena l'operatore li separa — e **non gli si mette mai un segno**.
4. **`t` di ripiego.** Ogni segno ancorato nasce con `t: 0.5`. Se il risolutore torna `null`, la
   valvola compare a metà tubo: sbagliata ma visibile. Degradazione voluta, mai un'eccezione.
5. **Un cambio di preferenze non deve MAI ridisegnare da sé.** Verificato dal vivo nel Blocco 2:
   la guardia `generazioneTentata` è un `useRef` mai riazzerato. Se il Blocco 3 tocca quell'effetto,
   riprovarlo.
6. **I test verdi per la ragione sbagliata** sono la classe di difetto numero uno di questo modulo.
   Un test che fallisce solo perché il modulo non esiste ancora **non** l'hai visto fallire per la
   ragione giusta: rompi apposta la logica e guarda quali cadono. Nel Blocco 2 questo ha trovato
   tre buchi veri nei test appena scritti.
7. **La prova in pagina.** Nel Blocco 2 non ha trovato difetti — prima volta — ma nei tre blocchi
   precedenti sì, ogni volta. Pratica di prova: **`002 test`** (`fed244ee-26e6-4d32-8c01-45abd393879d`),
   rotta `/requests/<id>/technical-details`, poi il chip **SC**.
8. `browser_drag` non è affidabile su react-flow. Su dnd-kit funziona il trascinamento **da
   tastiera**: focus sulla maniglia, `Space`, frecce, `Space` — provato.
9. **Il server MCP di Playwright può andare in timeout.** Per guardare un disegno senza browser:
   **`sharp` è già fra le dipendenze** — `sharp(svg, {density: 130}).png().toFile(...)`.
10. **Il dev server**: la 5173 è di un altro progetto (ne ho usata una libera, la 5199), e i server
    dei worktree sopravvivono alla sessione che li ha accesi. Spegnerlo a fine sessione.

## Come si rigenerano le fixture SVG

Serve un generatore che spezzi l'SVG **un elemento di primo livello per riga**, come vuole l'header
delle fixture. Nel Blocco 2 ci sono voluti tre tentativi: tagliare a profondità 0 produce **una riga
sola** (proprio ciò che l'header vieta), e non emettere alla chiusura di un figlio accorpa `</g>`
col fratello successivo. **Il taglio giusto è a profondità 1, con emissione anche quando un figlio
si chiude.** Poi: rendere col codice nuovo, **leggere il diff**, annotare in testa il perché — e mai
per far tornare verde un test.
