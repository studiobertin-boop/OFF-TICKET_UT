# Pulsante "SC" e finestra SCHEMA IMPIANTO separata dalla relazione — specifica

**Data:** 17-08-2026
**Origine:** richiesta diretta del committente: lo schema d'impianto (editor, associazione
compressori-serbatoi) non deve più vivere solo dentro la finestra "Dati per la relazione tecnica",
ma avere un proprio pulsante e una propria finestra, analoghi a quelli già esistenti per R
(relazione) e D (dichiarazioni).

## Cosa c'è oggi

**`TechnicalSheetHeader.tsx`** mostra in barra titolo, dopo il chip di compilazione, un chip per
ogni fascicolo di apparecchiatura, poi **R** (relazione), **D** (dichiarazioni), **F**
(documentazione completa). `R` è verde quando `relazioneSalvata` esiste (un vero file `.docx` già
generato e salvato — `RelazioneDataDialog.handleGenera` → `relazioneDocumentiApi.salvaFinale`).

**`RelazioneDataDialog.tsx`** possiede da solo tutto ciò che serve alla relazione, compresi due
pezzi che il committente vuole ora altrove:

- la `GruppoCampi` "Collegamenti compressori → serbatoi" (una `Select` multipla per compressore);
- `SchemaImpiantoSection`, l'editor/generatore dello schema d'impianto.

Questi dati (`collegamenti`, `schema`, `layoutSalvato`, `layout`, `taraturaPratica`,
`layoutRicalcolato`) sono **stato locale di `RelazioneDataDialog`**, risincronizzato da
`additional_info` **ogni volta che il dialog si riapre** (l'effetto guardia
`sincronizzatoRef`, righe 179-223), e **scritti su database solo dentro `handleGenera`**, insieme
a tutto il resto di `additionalInfo` — mai prima. Chiudere il dialog senza generare butta via
qualunque ritocco fatto sullo schema in quella sessione.

## Cosa cambia

### Un nuovo chip "SC", a sinistra di "R"

`TechnicalSheetHeader` guadagna un terzo chip fra il fascicoli e "R": `sigla="SC"`, stesso
componente `ChipAzione` già usato dagli altri, senza menu (`voci`) — apre sempre la finestra, non
scarica né rigenera nulla da qui. Due prop nuove: `schemaGenerato: boolean` (governa `fatto`) e
`onSchemaImpianto: () => void`.

**"R" cambia condizione di verde.** Oggi `relazionePronta = !!relazioneSalvata`. Da questa
modifica: **`relazionePronta = !!relazioneSalvata && schemaGenerato`** — il documento esiste **e**
lo schema è pronto in questa sessione. È la richiesta esplicita del committente ("oltre alle altre
informazioni già necessarie, anche lo schema è già generato"). Il chip "F" (documentazione
completa) non cambia: eredita la condizione perché legge già `relazionePronta`.

### Una nuova finestra, `SchemaImpiantoDialog.tsx`

Nuovo componente in `src/components/relazione/` (stessa cartella di `SchemaImpiantoSection.tsx` e
`RelazioneDataDialog.tsx`: dipendono dagli stessi tipi di dominio). Contiene, spostati **tali e
quali** da `RelazioneDataDialog.tsx`:

- la `GruppoCampi` "Collegamenti compressori → serbatoi";
- `<SchemaImpiantoSection>`.

Le due costanti di stile condivise dalle `Select` (`LARGHEZZA_SELECT`, `ETICHETTA_TRONCATA`)
escono in un modulo comune, `src/components/relazione/selectStyles.ts`, perché servono sia qui sia
alla `Select` dei giri che resta in `RelazioneDataDialog`.

### Dove vive adesso lo stato condiviso

`collegamenti`, `schema`, `layoutSalvato`, `layout`, `taraturaPratica`, `layoutRicalcolato`
**salgono a `TechnicalDetails.tsx`** (il genitore comune delle due finestre): sia la finestra SC
che genera/rifinisce lo schema, sia la finestra R che legge `schema` per incorporarlo nel `.docx`
e `collegamenti` per il calcolo delle valvole di sicurezza, devono vedere **lo stesso stato**.

**Inizializzazione una sola volta**, non ad ogni apertura di dialog: appena `technicalData` è
caricata (guardia `schemaSincronizzatoRef`, sullo stesso schema di `pruneAdditionalInfo` +
`collectCodes` già usato da `RelazioneDataDialog`). Da qui in poi lo stato di pagina resta
l'unica verità per la sessione: aprire e chiudere una delle due finestre non lo azzera più. È un
cambiamento deliberato rispetto a oggi (dove ogni riapertura di `RelazioneDataDialog` resetta
`schema`/`layout` a `null` e li rigenera da capo): con due finestre indipendenti, resettare allo
stato salvato ogni volta che l'utente passa dall'una all'altra butterebbe via lavoro dell'altra.

`RelazioneDataDialog` **non possiede più** questi campi: li riceve come prop già pronte
all'uso — `collegamentiCompressoriSerbatoi`, `schemaImpianto` (il PNG), `schemaLayoutDaPersistere`
(il `LayoutSalvato | undefined` già calcolato da `layoutDaPersistere` a livello di pagina). Il suo
`additionalInfo` (usato sia per il preflight sia per `handleGenera`) li legge da lì invece di
ricalcolarli.

### Persistenza: la finestra SC salva da sola alla chiusura

**Decisione del committente (17-08-2026):** a differenza di oggi, dove schema e collegamenti si
scrivono su database solo generando il `.docx`, la finestra SC scrive su `additional_info` **ogni
volta che si chiude** — bottone "Chiudi", Escape o clic sullo sfondo, sono equivalenti (nessuna
delle cautele "non buttare il lavoro" che protegge invece l'editor annidato "Rifinisci schema",
che non cambia).

La scrittura è un **merge esplicito**, non un `additionalInfoSchema.parse` (che pretende
`descrizioneAttivita` non vuota — campo che questa finestra non conosce): si passano avanti gli
altri campi di `additional_info` così come sono e si sovrascrivono solo `collegamentiCompressoriSerbatoi`
e `schemaLayout`, esattamente come già fa `DichiarazioniSection.genera` per `dataEmissione`
(`updateAdditionalInfo` sovrascrive l'intera colonna, non fa merge lui). Prima di scrivere, si
ripassano da `pruneAdditionalInfo` insieme agli altri campi correnti: un'apparecchiatura eliminata
dalla tabella mentre SC è aperta non deve sopravvivere nel salvato.

### Il chip "SC" deve riflettere lo stato vero anche dopo un ricaricamento

`schemaGenerato = !!schema` (il PNG rasterizzato, non solo il layout salvato): è lo stesso segnale
che oggi decide se mostrare "Rifinisci schema" invece di "Genera schema". Perché sia vero **anche
prima che l'utente apra la finestra SC** — altrimenti al ricaricamento della pagina il chip
resterebbe grigio finché non si apre SC almeno una volta, pur con un layout già salvato — il
`Dialog` di `SchemaImpiantoDialog` porta `keepMounted`: `SchemaImpiantoSection` monta subito
(appena `technicalData` è pronta) e il suo effetto di generazione automatica — invariato, non
tocca `SchemaImpiantoSection.tsx` — produce `schema` in sottofondo, finestra chiusa o aperta che
sia.

Caso noto e volutamente non risolto qui: un disegno **caricato** (AutoCAD, non generato
dall'editor) non ha mai un `layout` e quindi non è mai persistito — oggi come dopo questa modifica.
Dopo un ricaricamento della pagina il chip torna grigio per quel caso, esattamente come lo schema
caricato stesso sparisce (limite preesistente, non introdotto qui).

## Cosa NON cambia

- `SchemaImpiantoSection.tsx`, `SchemaEditor.tsx` e tutto `services/schemaImpianto/`: zero
  modifiche. L'editor annidato "Rifinisci schema", le sue cautele su Escape/sfondo, la
  generazione automatica, la riconciliazione: tutto invariato.
- Il preflight (`services/relazione/preflight.ts`): `schema-assente` resta un avviso, non un
  errore — lo schema non è mai stato un requisito bloccante per generare la relazione, e non lo
  diventa ora.
- `handleGenera` in `RelazioneDataDialog`: stessa logica di validazione, stesso
  `pruneAdditionalInfo` prima di salvare, stesso download.

## Cosa cambia, file per file

**Nuovo `src/components/relazione/selectStyles.ts`** — `LARGHEZZA_SELECT`, `ETICHETTA_TRONCATA`,
spostate identiche da `RelazioneDataDialog.tsx`.

**Nuovo `src/components/relazione/SchemaImpiantoDialog.tsx`** — `Dialog` con `keepMounted`,
la `GruppoCampi` collegamenti spostata identica, `<SchemaImpiantoSection>` spostata identica,
un avviso (`Alert`) per i collegamenti scartati alla sincronizzazione, un solo bottone "Chiudi".

**`RelazioneDataDialog.tsx`** — perde: lo stato `collegamenti`/`schema`/`layoutSalvato`/`layout`/
`taraturaPratica`/`layoutRicalcolato`, `compressoriCodes`, `setCollegamentoFor`, l'import di
`SchemaImpiantoSection` e dei moduli di `services/schemaImpianto/` che servivano solo a quello
stato, la `GruppoCampi` "Collegamenti" e il blocco `<SchemaImpiantoSection>` nel JSX. Guadagna tre
prop (`collegamentiCompressoriSerbatoi`, `schemaImpianto`, `schemaLayoutDaPersistere`), lette al
posto dello stato rimosso in `additionalInfo`/`segnalazioni`/`handleGenera`.

**`TechnicalSheetHeader.tsx`** — nuovo chip "SC", due prop nuove, `relazionePronta` (letta dal
chiamante, non ricalcolata qui) ora include anche `schemaGenerato` a monte, in
`TechnicalDetails.tsx`.

**`TechnicalDetails.tsx`** — nuovo stato di pagina, effetto di sincronizzazione una tantum,
`schemaLayoutDaPersistere` derivato con `useMemo`, `handleCloseSchemaDialog` (salva e chiude),
nuovo `<SchemaImpiantoDialog>` montato accanto a `<RelazioneDataDialog>`, prop nuove passate a
entrambi.

**`TechnicalSheetHeader.test.tsx`** — le prop nuove diventano obbligatorie: ogni montaggio diretto
del componente nel file va aggiornato, più un test nuovo per il chip "SC" (stesso schema dei test
già presenti per "D").

## Come si verifica

**Nessun test di interfaccia nuovo per `SchemaImpiantoDialog`** (convenzione del progetto,
`CLAUDE.md`): non ha logica propria, è ricomposizione di pezzi già montati altrove. Il file di test
esistente di `TechnicalSheetHeader` si aggiorna e si estende (quello è già un test di interfaccia
esistente, non nuovo).

**Comandi, tutti, prima di chiudere qualunque task:** `npx vitest run`, `npx tsc --noEmit`,
`npx eslint src/components/relazione src/components/technicalSheet src/pages/TechnicalDetails.tsx
--max-warnings 0`.

**In pagina** (dev server, DM329 con dati sufficienti a generare lo schema):

1. Il chip "SC" compare a sinistra di "R", grigio all'apertura su una pratica senza schema
   salvato.
2. Cliccando "SC" si apre "Schema d'impianto": collegamenti compressori→serbatoi e l'editor,
   nessun altro campo della relazione.
3. Con dati sufficienti lo schema si genera da solo appena la finestra si apre (comportamento
   preesistente, ora nella nuova finestra).
4. Chiudendo "SC" (bottone, Escape, clic fuori) il chip diventa verde. Riaprendo "R", il chip "R"
   resta grigio finché il `.docx` non è mai stato generato — poi verde solo se anche "SC" lo è.
5. Cliccando "Rimuovi" dentro l'editor schema e richiudendo "SC", il chip torna grigio.
6. Ricaricando la pagina dopo il passo 4 (schema salvato), il chip "SC" torna verde **senza**
   riaprire la finestra — verifica diretta del `keepMounted`.
7. Generando la relazione da "R": il `.docx` scaricato incorpora l'immagine dello schema
   generato in "SC", e la portata delle valvole tiene conto dei collegamenti impostati lì.
8. Eliminando un serbatoio referenziato in un collegamento salvato, poi riaprendo "SC": l'avviso
   sui riferimenti scartati compare, e il collegamento sparisce dalla `Select`.

**Sui dati di produzione**, se si prova con una pratica vera: ripulire ciò che si scrive e
riverificare l'assenza con una query diretta, come da convenzione del progetto.
