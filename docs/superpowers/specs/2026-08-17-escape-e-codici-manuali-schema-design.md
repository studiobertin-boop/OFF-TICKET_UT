# Escape che non butta via il disegno, e codici scritti a mano — specifica

**Data:** 17-08-2026
**Origine:** due richieste del committente dopo aver provato in produzione l'editor dello schema
d'impianto, chiuso fino a `727fdce`.

**I tre riferimenti SVG non devono muoversi di una coordinata.** Nessuno dei due fix cambia il
disegno: il primo vive tutto nell'interfaccia, il secondo aggiunge un campo che sui layout già
salvati è assente e ricade sul valore di oggi. Un riferimento che si muove qui è un difetto, non
un aggiornamento da accettare.

## A — Escape toglie la selezione, non il lavoro

**Oggi:** il Dialog che monta l'editor (`SchemaImpiantoSection.tsx`, riga 578) passa
`chiudiEditorScartando` a `onClose`, e MUI chiama `onClose` sia per Escape sia per il clic sullo
sfondo. Chi disegna per mezz'ora e sfiora Escape perde tutto, senza che nulla glielo chieda. Il
commento sopra `chiudiEditorScartando` (righe 244-252) dichiara la cosa deliberata: «Annulla
modifiche», Escape e il clic sullo sfondo sono «la stessa uscita vista da tre gesti diversi».

**Voluto:** Escape toglie **solo** la selezione. Il clic sullo sfondo **non fa niente**. Per uscire
senza salvare resta «Annulla modifiche», e resta l'unica strada. Deciso dal committente il
17-08-2026: se si toglie la trappola a Escape e la si lascia allo sfondo, il rischio è identico.

### La trappola misurata: MUI inghiotte Escape anche senza `onClose`

Togliere `onClose` e basta lascerebbe Escape **inerte**, non funzionante.
`node_modules/@mui/material/Modal/useModal.js`, righe 114-125:

```js
if (event.key !== 'Escape' || event.which === 229 || !isTopModal()) return
if (!disableEscapeKeyDown) {
  // Swallow the event, in case someone is listening for the escape key on the body.
  event.stopPropagation()
  if (onClose) onClose(event, 'escapeKeyDown')
}
```

Lo `stopPropagation` viene **prima** del controllo su `onClose`, ed è un handler React sul root del
Modal — che vive in un portale su `document.body`, dove React 18 aggancia i propri listener. Il
listener dell'editor sta su `window`, cioè più in alto nella risalita: fermato lì, Escape non ci
arriverebbe mai.

Serve quindi **anche** `disableEscapeKeyDown`, che fa uscire il gestore MUI alla riga 119, prima
dello `stopPropagation`. Il nome inganna: non spegne Escape, smette di rubarlo.

### Cosa cambia

**`SchemaImpiantoSection.tsx`** — il Dialog dell'editor perde `onClose` e guadagna
`disableEscapeKeyDown`. Senza `onClose` il clic sullo sfondo non fa niente, esattamente come già
fa `DialogoUscitaTaratura` (`BarraTaratura.tsx`, riga 542). `chiudiEditorScartando` resta e non
cambia comportamento, ma da qui in poi la chiama **solo** «Annulla modifiche»: il suo commento va
riscritto, perché i tre gesti equivalenti non sono più tre.

**`SchemaEditor.tsx`, gestore tastiera su `window`** — si aggiunge il ramo Escape **dopo** la
guardia esistente `if (scritturaAperta || dialogoUscitaAperto) return` (che resta la protezione dei
due dialoghi annidati e non va toccata) e **prima** del blocco `if (modoTaratura) { … return }`.
L'ordine non è un dettaglio di stile: quel blocco chiude con un `return` incondizionato, e un ramo
Escape scritto sotto non verrebbe mai raggiunto in modo taratura. Un solo `if (e.key === 'Escape')`
che si biforca al suo interno, quindi, e non due rami sparsi:

- **in modo taratura:** `togliAncoraSelezionata()`. La selezione lì è un'ancora, non un nodo. Se
  nessuna ancora è selezionata non succede nulla. **L'uscita dal modo continua a passare solo dal
  dialogo a tre vie** — Escape non la avvia e non la scavalca.
- **fuori dal modo taratura:** `deselezionaReactFlow()` e `setSelezioneLibera(null)`. La prima
  esiste già (righe 981-991) e passa da `aggiornaSenzaCronologia` proprio perché deselezionare non
  deve diventare un passo di Ctrl+Z; la seconda copre muro e annotazioni, che non sono nodi di
  react-flow e hanno una selezione propria.

L'array di dipendenze dell'effetto guadagna `deselezionaReactFlow` — che a sua volta dipende dalla
selezione corrente e cambia identità, quindi va dichiarato o `eslint` lo segnala.

### I due Escape annidati, che devono continuare a funzionare

Nessuno dei due si tocca, ma entrambi vanno **riprovati in pagina** dopo il fix:

- **Il dialogo di scrittura** (`SchemaEditor.tsx`, riga ~1636) gestisce Escape da sé con
  `stopPropagation` e chiude solo se stesso. Quando è aperto è lui il modale in cima, quindi
  `isTopModal()` fa uscire subito il gestore del Dialog dell'editor: il `disableEscapeKeyDown`
  aggiunto sotto non lo riguarda.
- **Il dialogo a tre vie della taratura** non ha `onClose` e non ha `disableEscapeKeyDown`: MUI
  continua a inghiottire Escape lì sopra, e il dialogo non si chiude né con Escape né col fondale.
  È voluto e resta.

### I commenti che diventano falsi

- **`SchemaEditor.tsx`, riga 1600**, sopra «Annulla modifiche» e «Conferma schema»: «Escape resta
  la via d'uscita sicura dall'intero editor (non tocca questi pulsanti, non va toccato lui)». Da
  questo fix è falso. Va corretto **accorciando** — la frase su Escape sparisce, resta quella sul
  modo taratura — non precisando.
- **`SchemaImpiantoSection.tsx`, righe 244-252**, il commento di `chiudiEditorScartando`: i tre
  gesti diventano uno.
- **`BarraTaratura.tsx`, riga 542** parla di Escape nel dialogo della taratura e **resta vero**:
  non si tocca.

## B — Codice e descrizione modificabili sulle apparecchiature aggiunte a mano

**Oggi:** ciò che si aggiunge dalla palette nasce con un codice d'ufficio `M-S1`, `M-F1`, `M-G1`…
(`codiceLibero` e `PREFISSO_MANUALE = 'M-'`, righe 246-258), e né il codice né la descrizione si
possono cambiare: `onNodeDoubleClick` (riga 1130) esce subito se `tipo !== 'utenze'`. Quel codice
e quella descrizione finiscono tali e quali nella tabella sotto il disegno.

**Voluto:** per queste apparecchiature — e solo per queste — si possono cambiare codice e
descrizione, e sia il disegno sia la tabella li riportano.

### Dove il codice si vede davvero

Il briefing dava per scontato che il codice stesse solo in tabella. Non è così: **è disegnato
dentro il simbolo**. `symbols/index.ts` scrive `nodo.id` in sei punti — compressore senza
accessorio (450), compressore con disoleatore (498), serbatoio (550), rombo, cioè essiccatore,
filtro e separatore (651), tanica (737), pacco bombole (787) — e `SchemaEdgeTubazione.tsx` (501) lo
usa come nome del nodo nell'editor. `righeLista` (`renderSvg.ts`, 220) è l'ottavo punto.

La **descrizione** invece compare **solo in tabella**: nessun simbolo la disegna, tranne il
terminale utenze, che ha una strada tutta sua e non c'entra con questo fix.

La **giunzione (TEE)** non disegna nessun codice — è un pallino pieno, `DIAMETRO_GIUNZIONE` — e
`righeLista` la salta insieme al terminale utenze. Un codice scritto lì non comparirebbe da nessuna
parte.

### La decisione: campo `codice` a parte, id interno invariato

Le due strade sono state pesate. **Decisa dal committente il 17-08-2026: campo a parte.**

**Rinominare l'id** riscriverebbe in un colpo `nodes[].id`, `source`/`target` degli archi,
`arco.da.nodo`/`a.nodo` e il bersaglio della taratura; disegno e tabella si aggiornerebbero da soli,
perché leggono già `nodo.id`. **Ma riapre esattamente il difetto per cui esiste il prefisso `M-`**,
scritto nel commento a `SchemaEditor.tsx` righe 246-249: un nodo manuale chiamato `S2` collide con
un vero S2 comparso **più tardi** in scheda, che `riconcilia` da lì in poi scambia per quello già
presente — non entra mai fra gli `aggiunti` e resta «Serbatoio» per sempre, senza marca né valvole.
È una collisione che al momento della scrittura non si può controllare, perché il codice rivale
ancora non esiste. Scartata per questo.

**Il campo a parte** lascia l'id interno a `M-S1`, che nessuno vede più. Archi, capi, segni,
cronologia e taratura continuano a parlare di `M-S1` e non si toccano. Una collisione futura con la
scheda produce al peggio due righe uguali in tabella — visibile e correggibile — non un nodo che
smette per sempre di aggiornarsi.

### Cosa cambia

**`types.ts`** — `SchemaNodo` guadagna `codice?: string`. Assente su ogni layout già salvato, e
assente su ogni nodo di origine `scheda`, dove il codice è e resta l'id di scheda.

**Nuovo `services/schemaImpianto/codici.ts`**, tre funzioni pure, tutte con test Vitest — la logica
provabile sta lì e non nel componente, come già `codiceLibero`:

- `codiceVisibile(nodo)` → `nodo.codice ?? nodo.id`.
- `codiciOccupati(nodi, escluso?)` → l'insieme di tutto ciò che occupa un codice: id e `codice` di
  ogni nodo, `accessorio.codice`, e i codici delle valvole di sicurezza — sia quelle del nodo sia
  quelle dell'accessorio. `escluso` è l'id del nodo in modifica, che non deve collidere con sé.
- `motivoRifiutoCodice(codice, nodi, idNodo)` → la frase da mostrare sotto il campo, o `null`.
  Rifiuta il vuoto, il codice più lungo di **6 caratteri** e il codice già occupato.

**`persistenza.ts` non cambia.** `serializzaLayout` clona i nodi interi (`structuredClone`), quindi
il campo nuovo viaggia da solo; `deserializzaLayout` non filtra i campi e `contenutoRiconoscibile`
guarda solo `tipo`; `riconcilia` lascia passare intatti i nodi di origine `manuale` (righe 312-316),
ed è esattamente ciò che rende possibile questo fix.

**Gli otto punti che mostrano il codice** passano da `nodo.id` a `codiceVisibile(nodo)`: i sei
simboli, `righeLista`, e il nome del nodo in `SchemaEdgeTubazione.tsx`.

**`SchemaEditor.tsx`:**

- `onNodeDoubleClick` guadagna un secondo caso. `tipo === 'utenze'` resta com'è. Un nodo con
  `origine === 'manuale'` e `tipo !== 'giunzione'` apre il dialogo sul nuovo bersaglio
  `'apparecchiatura'`, con il codice visibile e la descrizione correnti. Tutto il resto — le
  apparecchiature di scheda, il TEE — continua a non rispondere al doppio clic. Il modo taratura
  continua a spegnere il gestore per intero.
- Lo stato `scrittura` guadagna un campo `codice`. Il dialogo resta uno solo: per
  `'apparecchiatura'` mostra due campi a riga singola, «Codice» e «Descrizione», entrambi
  obbligatori, con il messaggio di rifiuto sotto il campo del codice e il pulsante di conferma
  spento finché non è valido. Le cautele già scritte lì su tasti, Escape e propagazione valgono
  invariate per il terzo bersaglio.
- `confermaScrittura` guadagna il ramo che scrive `codice` ed `etichetta` **insieme**, con un solo
  `applica`: un Ctrl+Z li riporta indietro entrambi. Se il codice scritto coincide con l'id
  d'ufficio, il campo torna **assente** invece di duplicarlo — così un nodo mai rinominato e uno
  rinominato al proprio codice restano indistinguibili nel salvato.

### Il limite di 6 caratteri

Il codice è disegnato dentro il simbolo a corpo fisso (24px sui simboli grandi, 14px sul pacco
bombole): un codice lungo esce dal riquadro, e nessun test lo vedrebbe. Il committente ha fissato
il limite a **6 caratteri**, che è esattamente la lunghezza del codice d'ufficio più lungo di oggi,
`M-SEP1`.

Il limite vale **solo su ciò che si scrive a mano**. L'id generato da `codiceLibero` non passa
dalla validazione e non è toccato: un ipotetico `M-SEP10`, a sette caratteri, resta legittimo come
oggi.

### Il commento che diventa falso

**`SchemaEditor.tsx`, riga 323**, sopra lo stato `scrittura`: dice che le etichette delle
apparecchiature non si possono cambiare perché «vengono dalla scheda dati e la riconciliazione le
riscrive alla riapertura». **È vero solo per i nodi di origine `scheda`.** Va corretto dicendo la
distinzione, non cancellata.

### Il doppione che resta possibile

Un codice scritto a mano non può collidere con nulla di ciò che esiste **al momento della
scrittura**. Può ancora collidere con un codice di scheda che compare **dopo**: in quel caso la
tabella mostra due righe con lo stesso codice, il che è visibile e si corregge riaprendo l'editor.
La riconciliazione non ne risente, perché l'id interno resta `M-…`. **Rischio noto e accettato**,
ed è il motivo per cui la strada del rinominare l'id è stata scartata: lì lo stesso caso non si
vedeva e non si correggeva.

## Come si verifica

**I tre comandi**, tutti, prima di chiudere qualunque cosa: `npx vitest run`, `npx tsc --noEmit`,
`npx eslint src/components/schemaImpianto src/services/schemaImpianto --max-warnings 0`. Il lint
gira a zero warning sopra i tre preesistenti: attenzione a esportare funzioni da file di
componenti, che fa scattare `react-refresh`. Niente `prettier --write`.

**I test nuovi coprono `codici.ts` e nient'altro di nuovo.** Nessun test di interfaccia per i
componenti (`CLAUDE.md`): entrambi i fix vivono in `SchemaEditor.tsx` e nel Dialog che lo monta,
quindi **si provano in pagina**. Ogni test nuovo va visto cadere per mutazione, ripristinata da una
copia e mai con `git checkout`.

**In pagina**, la lista di ciò che va riprovato:

1. Escape con un'apparecchiatura selezionata: la selezione se ne va, il disegno resta, l'editor
   resta aperto.
2. Escape con il muro selezionato, e con un'annotazione selezionata: stessa cosa.
3. Clic sullo sfondo: non succede niente.
4. Escape dentro il dialogo di scrittura: chiude **solo** quello, e il nodo selezionato sotto resta
   selezionato.
5. Escape dentro il dialogo a tre vie della taratura: non chiude niente.
6. Escape in modo taratura con un'ancora selezionata: toglie l'ancora, il modo resta acceso.
7. «Annulla modifiche» esce ancora, e scarta.
8. Doppio clic su un'apparecchiatura aggiunta a mano: codice e descrizione si cambiano, e il nuovo
   codice compare **sia dentro il simbolo sia in tabella** — l'anteprima è un SVG in chiaro
   (`img[alt="Anteprima del disegno finale"]`), leggerne il sorgente è più solido che guardare
   l'immagine.
9. Un codice già usato, e un codice di sette caratteri: il pulsante resta spento e il perché si
   legge.
10. Ctrl+Z dopo il cambio: codice e descrizione tornano indietro insieme, in un colpo solo.
11. Doppio clic su un'apparecchiatura di scheda e su un TEE: non succede niente.
12. Doppio clic sul terminale utenze: apre il campo unico di sempre.

**Sui dati di produzione** si può provare, ma tutto ciò che si scrive va ripulito e l'assenza
riverificata con una query diretta. Le pratiche con un layout salvato devono restare **due**: ORVED
(`a8bbdbe1-f7ad-40d9-86a0-9483b5dcc7f4`) e LOWA R&D (`c6f56ca5-d57b-408c-a4e5-69a207812b0d`).

**Prima di pubblicare:** `git fetch`, poi simulare il merge con `git merge-tree` — il diff da solo
inganna, e su questo repo ha già ingannato. Non si pubblica senza il via esplicito del committente.
