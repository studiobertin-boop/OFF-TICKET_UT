# Consegna alla sessione successiva — schema d'impianto, la taratura visiva (Blocco 4)

Scritto il 18-08-2026, a Blocchi 1, 2 e 3 finiti. Chi riprende parte da qui.

## Dove sta il lavoro

Ramo **`worktree-schema-prima-versione-blocco1`**, worktree
`.claude/worktrees/schema-prima-versione-blocco1`. **Ventotto commit, nulla fuso su `main`.**

**Merge simulato fatto** a fine Blocco 3, con `git fetch` prima: `git merge-tree --write-tree`
contro `origin/main` appena aggiornato dà **zero conflitti**, e `origin/main` è ancora fermo a
`8381f53`, cioè alla base del ramo — sarebbe un fast-forward. **Non fuso e non pubblicato: la
decisione è del committente.** Se passa altro tempo, rifare il `fetch` prima di rifidarsi di
questo esito (è la trappola già pagata su questo repo: mai simulare contro il `main` locale).

**Baseline al commit `8ee7c0a`: 1451 test verdi, 101 file, `tsc` pulito, eslint 0 / 3 / 18.**

`.env.local` è git-ignored: va copiato dal checkout principale nel worktree, o un file di test
fallisce per variabili mancanti. **Contiene anche le credenziali dell'applicazione**
(`APP_LOGIN_EMAIL` / `APP_LOGIN_PASSWORD`, ruolo admin): non chiederle al committente.

## Da leggere, in quest'ordine

1. **La specifica**, per intera:
   `docs/superpowers/specs/2026-08-17-schema-impianto-prima-versione-design.md`.
2. **Il piano del Blocco 3**:
   `docs/superpowers/plans/2026-08-18-schema-impianto-prima-versione-blocco3.md`, col paragrafo
   «cosa è andato diversamente» e l'esito della prova in pagina in coda.
3. **I riferimenti visivi, in git:** `DOCUMENTAZIONE/relazione/si bypass.png` e
   `DOCUMENTAZIONE/relazione/no bypass.png`. Sono i due nomi giusti, e i riferimenti nei documenti
   sono stati corretti il 18-08-2026. *(Resta nel checkout principale una copia non tracciata
   `no byass.png`, col refuso, rimasta da una sessione precedente: i blocchi 2 e 3 la citavano
   credendola il nome vero. Va cancellata quando il ramo viene fuso, non prima — nel checkout
   principale i due png sono ancora untracked, ed è quella copia a tenerli lì.)*

## Cosa è finito nei Blocchi 1–3

La prima versione generata riproduce **entrambi** i disegni di riferimento sulle convenzioni di
struttura: linea di processo dritta e allineata all'uscita del serbatoio, stadi adiacenti,
mandata agganciata in basso con la valvola sotto la dorsale, valvole di riserva ai due capi,
condense dal flag dell'operatore, e — dal Blocco 3 — il by-pass con le sue giunzioni, il ponte
coi tre segni e la linea di processo che scende di una corsia per passargli sotto.

Restano da tarare le **distanze**, che non si provano coi test.

## Il Blocco 4 — la taratura visiva

Si generano gli schemi sulle pratiche vere, li si mette a fianco dei riferimenti e si correggono
le costanti. **Nessuna logica nuova.** La prova non è un test: è il confronto a occhio.

Come si guarda un disegno senza browser: **`sharp` è già fra le dipendenze** —
`sharp(Buffer.from(svg), {density: 130}).png().toFile(...)`. Uno script `.mts` alla radice del
worktree, eseguito con `npx tsx`, e cancellato a fine giro (attenzione: fuori dal worktree non
risolve `node_modules`, e `tsx` non digerisce il `top-level await` in un `.ts`).

### Le costanti, e cosa si è già visto

| costante | file | valore | cosa si è visto |
|---|---|---|---|
| `ALTEZZA_BYPASS` | `layout.ts` | 60 | **Probabilmente troppo poco.** Nel disegno corretto a mano il ponte corre alla STESSA quota dell'uscita del serbatoio (`ALTEZZA_BYPASS == PASSO_CORSIA_BYPASS`); ora sta 20 unità sotto, e il tratto di flessibile sotto le valvole dei montanti si riduce a una sola ondulazione contro le tre o quattro del riferimento. |
| `PASSO_CORSIA_BYPASS` | `layout.ts` | 80 | Misurato ~75 sul riferimento. Regge. |
| `PASSO_GIUNZIONE` | `layout.ts` | 20 | Nel riferimento il TEE di monte sta ~12 unità dalla punta del primo stadio, quello di valle ~25. Un valore solo è la scelta simmetrica; due costanti se il committente li vuole diversi. |
| `GIOCO_FRA_STADI` | `layout.ts` | 0 → **20** | **Deciso dal committente il 18-08-2026: 20.** I rombi portano codoli da 10 unità che sporgono fuori dal riquadro: a gioco 0 il codolo destro di ogni stadio entrava di 10 unità nella punta del vicino, a 20 i codoli si toccano e formano il collegamento. Cambia il passo fra stadi da 100 a 120. **Non muove nessuna fixture e non fa cadere nessun test — provato il 18-08-2026 mettendo 20 e rilanciando la suite:** le fixture descrivono impianti senza stadi, e i test della convenzione 3 asseriscono sulla costante, non sul valore. È la costante più economica da chiudere. |
| `MARGINE_COLLETTORE` | `layout.ts` | 10 | Nel disegno corretto a mano la dorsale è ancora un po' più bassa e il tratto di molla più corto di quanto esca ora. |

### Le altre due code

- **Compattezza in larghezza** (convenzione 8): gli spazi fra compressori, serbatoio e primo
  stadio restano più larghi che nel riferimento. **Non** ritoccare `PASSO_ORIZZONTALE`
  (`layout.ts`), condiviso con `calcolaMuro` e con la spaziatura di compressori e serbatoi:
  introdurre `PASSO_COMPRESSORI` e `PASSO_SERBATOI` separati.
- **Il tratteggio delle condense si perde dove le linee si sovrappongono** (osservazione del
  committente, 18-08-2026). Sei linee condense corrono sulla stessa corsia orizzontale con le fasi
  disallineate — `stroke-dasharray` riparte da capo su ogni `<path>`, e ogni tratto riempie i vuoti
  del vicino: il risultato sembra una linea continua.
  **Strada scelta dal committente il 18-08-2026: fasare i tratteggi.** Si calcola uno
  `stroke-dashoffset` dalla lunghezza percorsa fino all'inizio del tratto orizzontale, così tutti
  i tratti cadono sulla stessa griglia. **Locale a `trattoSvg` (`renderSvg.ts`): non tocca il
  modello, non tocca il layout, non tocca il formato salvato.**
  *(L'altra strada — un collettore condense unico, una sola orizzontale coi montanti che vi si
  innestano — era più fedele agli schemi veri ma cambiava il modello: oggi ogni apparecchiatura ha
  il suo arco fino al pozzo. Scartata, non ridiscutere.)*
  **Attenzione:** l'offset va calcolato sulla polilinea **già instradata**, e la stessa formula
  serve alla tela dell'editor (`SchemaEdgeTubazione`) o documento e tela torneranno a disegnare
  tratteggi diversi — è la divergenza che `instrada` condivisa è nata per chiudere.

### Una scelta di forma, non di distanza

**Dove cade il gradino dal serbatoio al primo TEE.** Ora sta a mezza strada (`gradinoVersoIlTee`,
`segniAncorati.ts`); nel riferimento il committente fa correre l'orizzontale fin quasi al primo
stadio e scende lì. Le due forme sono entrambe sensate, ma la seconda accorcia la linea di
processo di un passo. Da mostrargli affiancate.

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

**Alcune fixture SVG cambieranno in questo blocco**, perché le distanze si muovono — ma **non per `GIOCO_FRA_STADI`**, che è già stato provato a 20 senza che nessuna si muovesse (vedi la tabella qui sopra). A muoverle saranno semmai `MARGINE_COLLETTORE` e i passi di compressori e serbatoi, che toccano impianti senza stadi. Si rigenerano
seguendo la procedura scritta nel loro header — rendere col codice nuovo, spezzare per riga,
**leggere il diff**, annotare in testa il perché — e mai per far tornare verde un test. Il taglio
giusto è **a profondità 1, con emissione anche quando un figlio si chiude**: a profondità 0 esce
una riga sola, che è proprio ciò che l'header vieta.

Nessun test di interfaccia: la logica provabile va in servizi e hook (`CLAUDE.md`).

## Trappole che restano vere

1. **Zod cancella i campi che non conosce.** `additionalInfoSchema` (`services/relazione/schema.ts`)
   è un `z.object` senza `passthrough`, e `additionalInfo` in `RelazioneDataDialog.tsx` è costruito
   da un letterale che non fa spread. Un campo nuovo in `additional_info` va dichiarato in
   **entrambi** o sparisce alla prima relazione generata, in silenzio. *(Non ha morso su
   `preferenzeApplicate`, che viaggia dentro `schemaLayout`, dichiarato `z.any()`.)*
2. **I file del repo hanno fine riga CRLF.** Le mutazioni «rompi apposta» scritte con pattern
   multi-riga non agganciano e sembrano innocue: nel Blocco 3 due mutazioni sono risultate «non
   colte dai test» quando in realtà non erano mai state applicate. **Verificare sempre con
   `git diff --stat` che la mutazione sia entrata** prima di concludere che manca un test.
3. **I test verdi per la ragione sbagliata** sono la classe di difetto numero uno di questo modulo.
   Nel Blocco 3 ne sono stati trovati due: un test sui gruppi annidati che non esisteva (e ha
   scoperto anche una logica delle corsie rovesciata), e un test sugli archi ripescati costruito su
   un caso dove le due fonti danno lo stesso oggetto — verde a vuoto.
4. **La prova in pagina trova ciò che i test non vedono.** Nel Blocco 3 ha trovato il difetto più
   grave del blocco — il tubo che sembrava uscire dalla pancia del serbatoio — che nessun test
   poteva vedere, perché la geometria era coerente e solo nascosta sotto un altro simbolo.
   **Non saltarla.** Pratica di prova: **`002 test`** (`fed244ee-26e6-4d32-8c01-45abd393879d`),
   rotta `/requests/<id>/technical-details`, poi il chip **SC**.
5. **`SchemaImpiantoDialog` monta col `keepMounted`**: i suoi pulsanti sono nel DOM anche a
   finestra chiusa. Cercarli con `querySelector` e cliccarli da script colpisce elementi invisibili
   e non fa nulla di ciò che sembra. Filtrare per `getBoundingClientRect().height > 0`, o usare i
   `ref` dello snapshot di Playwright.
6. **La finestra è più larga del viewport di default**: allargare il browser a 1920×1080 prima di
   interagire, o i controlli del pannello restano fuori schermo e i click vanno in timeout.
7. **`sx-basso` non esiste sul serbatoio ORIZZONTALE**, e una taratura permanente può toglierlo
   anche al verticale. Si legge l'**esistenza** dell'ancora, mai la geometria (`ancoraMandata`,
   `buildSchemaModel.ts`).
8. **L'arco si emette sempre**, anche degenere fra due stadi adiacenti — è il tessuto che ripara il
   disegno appena l'operatore li separa — e **non gli si mette mai un segno**.
9. **`t` di ripiego.** Ogni segno ancorato nasce con `t: 0.5`. Se il risolutore torna `null`, la
   valvola compare a metà tubo: sbagliata ma visibile. Degradazione voluta, mai un'eccezione.
10. **Un cambio di preferenze non deve MAI ridisegnare da sé.** Verificato dal vivo nei Blocchi 2 e
    3: la guardia `generazioneTentata` è un `useRef` mai riazzerato. Se il Blocco 4 tocca quel
    percorso, riprovarlo.
11. **Il server MCP di Playwright può andare in timeout.** Per guardare un disegno senza browser,
    vedi `sharp` qui sopra.
12. **Il dev server**: la 5173 è di un altro progetto (nel Blocco 3 si è usata la 5199), e i server
    dei worktree sopravvivono alla sessione che li ha accesi. **Spegnerlo a fine sessione**, e
    verificare che la porta sia davvero libera: fermare il task non basta, il processo `vite` resta
    e va chiuso per PID.
13. **Non lanciare più esecuzioni di `vitest run` in parallelo.** Si accavallano sui core e la
    suite passa da 2 minuti a non finire più; nel Blocco 3 è successo con una trentina di processi
    node vivi insieme.

## Deciso dal committente il 18-08-2026, non ridiscutere

- **`GIOCO_FRA_STADI` = 20.**
- **Tratteggio delle condense: si fasano i tratteggi** con `stroke-dashoffset`, locale al render.
  Il collettore condense unico è scartato.
- **Il nome giusto del riferimento è `no bypass.png`**, quello in git. Riferimenti corretti
  ovunque.
- **Il merge si fa DOPO il Blocco 4**, non prima: il committente vuole chiudere la taratura e
  pubblicare in un colpo solo. 30 commit pronti, merge simulato pulito (rifare `git fetch` prima
  di ripetere la simulazione: `origin/main` può essere avanzato nel frattempo).
