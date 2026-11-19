# Generatore di azoto — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** aggiungere il «Generatore di azoto» (N1–N3) e i suoi serbatoi interni (NS1…, valvole NS1.1…) come apparecchiature DM329 complete: catalogo, scheda, codici, classificazione e denunce, OCR, fascicolo, relazione, dichiarazioni, schema d'impianto.

**Architecture:** due array nuovi in `equipment_data`: `generatori_azoto` (non recipiente) e `serbatoi_generatore` (recipienti, codici principali `NS` con riferimento `generatore_associato`). I serbatoi interni seguono la regola di codice dei serbatoi e i dati del disoleatore. La lista «quali array sono recipienti» diventa una costante unica. Nello schema il generatore è un nodo nuovo, **fuori dalla catena**, appeso con un TEE in fondo alla linea e con un terminale «Utenze azoto» proprio.

**Tech Stack:** Vite + React 18 + TS (strict=false), MUI 6, React Hook Form, Zod, Vitest, Supabase (Postgres, Edge Functions Deno), Vercel.

**Spec:** `docs/superpowers/specs/2026-11-19-generatore-azoto-design.md` — leggerla prima di ogni task: le decisioni numerate 1–14 sono vincolanti.

## Global Constraints

- Lavoro in un worktree su ramo dedicato (`superpowers:using-git-worktrees`); **un solo rilascio** alla fine (Task 10), mai push parziali su `main`.
- Nomi fissati: tipi `GeneratoreAzoto`, `SerbatoioGeneratore`; array `generatori_azoto`, `serbatoi_generatore`; riferimento `generatore_associato`; prefissi `N` e `NS`; `EquipmentKind` `'generatore'` e `'serbatoio_generatore'`; catalogo `'Generatori azoto'` e `'Serbatoi generatore azoto'`; `SchemaNodoTipo` `'generatore_azoto'`.
- Limiti: 3 generatori, 8 serbatoi interni per generatore, 24 in tutto. Valvola principale **obbligatoria** su ogni serbatoio interno.
- Generatore: marca, modello, n_fabbrica, anno, ps_pressione_max, ts_temperatura/ts, `portata` = **aria di alimentazione in l/min**, note, foto_targhetta.
- Descrizione del serbatoio interno in ogni documento: `Serbatoio interno generatore di azoto N1` (col codice del suo generatore).
- Frase della relazione, testo esatto: singolare «A valle della linea di trattamento è installato un generatore di azoto (N1) che produce azoto in sito a partire dall'aria compressa.»; plurale «A valle della linea di trattamento sono installati due generatori di azoto (N1, N2) che producono azoto in sito a partire dall'aria compressa.» («tre» con tre).
- Una scheda **senza** i due array produce output identico a oggi in relazione, dichiarazioni, CIVA, schema: nessuna fixture SVG si muove.
- Test: `npx vitest run <file>` per singolo file; **mai più esecuzioni di vitest in parallelo**. Gate per task: test del file + `npx tsc --noEmit`.
- File CRLF: le mutazioni «rompi apposta» vanno verificate con `git diff --stat`.
- Commit Conventional Commits in italiano, con la riga `Co-Authored-By` della sessione.
- Credenziali: `.env.local` (mai stampare i valori). Prove in pagina su `002 test` (`fed244ee`), rotta `/requests/<id>/technical-details`.

## Review Focus

1. **Generatore eliminato e ricreato:** eliminando N1 si eliminano i suoi NS; un nuovo N1 nasce senza serbatoi ereditati → test in Task 1 (`pruneSchedaRefs`).
2. **Codici stabili:** eliminato NS1 con NS2 e NS3 presenti, NS2 e NS3 non cambiano codice e il prossimo serbatoio nuovo prende NS1 → test in Task 1.
3. **Schede esistenti senza i nuovi array** (`undefined`, non `[]`): nessuna eccezione e output invariato in esiti, CIVA, dichiarazioni, schema → test in Task 3, 7, 8, 10.
4. **Generatore senza serbatoi interni:** riga del generatore in esiti con esito vuoto, nessuna valvola, schema disegnato normalmente → test in Task 6 e 10.
5. **Nome file `N1.1.jpg`:** rifiutato con un messaggio che rimanda a `NS` (il serbatoio interno non è un figlio di N) → test in Task 5.

---

### Task 1: Tipi, codici e valvole

**Files:**
- Modify: `src/types/technicalSheet.ts` (interfacce, `SchedaDatiCompleta`, `EQUIPMENT_LIMITS`, costante e helper nuovi)
- Modify: `src/services/fascicolo/codiciScheda.ts` (`PARENT_ARRAYS`, nuovo `LINKED_ARRAYS`, `collectCodes`)
- Modify: `src/utils/equipmentCodes.ts` (`pruneSchedaRefs`)
- Modify: `src/utils/valvoleImpianto.ts` (`elencaValvole`)
- Test: `src/utils/__tests__/equipmentCodes.test.ts`, nuovo `src/utils/__tests__/valvoleImpianto.test.ts`

**Interfaces:**
- Produces:
  - `interface GeneratoreAzoto { codice; marca?; modello?; n_fabbrica?; anno?; ps_pressione_max?; ts_temperatura?; ts?; portata?; note?; foto_targhetta? }`
  - `interface SerbatoioGeneratore extends CampiRecipiente` = campi di `Disoleatore` con `generatore_associato: string` al posto di `compressore_associato`.
  - `SchedaDatiCompleta.generatori_azoto?: GeneratoreAzoto[]`, `serbatoi_generatore?: SerbatoioGeneratore[]` (facoltativi: le schede vecchie non li hanno).
  - `EQUIPMENT_LIMITS.generatori_azoto = { min: 0, max: 3, prefix: 'N' }`, `serbatoi_generatore = { min: 0, max: 24, prefix: 'NS' }`.
  - `MAX_SERBATOI_PER_GENERATORE = 8`.
  - `ARRAY_RECIPIENTI = ['serbatoi','disoleatori','scambiatori','recipienti_filtro','serbatoi_generatore'] as const` — l'unica lista dei recipienti, la importano i Task 3, 4, 7, 8.
  - `serbatoiDelGeneratore(scheda, codiceGeneratore: string): SerbatoioGeneratore[]`.
  - `puoAggiungereSerbatoioGeneratore(scheda, codiceGeneratore: string): boolean` (falso a 8 o a 24 complessivi).
  - In `codiciScheda.ts`: `LINKED_ARRAYS = [{ array: 'serbatoi_generatore', ref: 'generatore_associato', parent: 'generatori_azoto' }] as const`. Entrambi gli array nuovi stanno in `PARENT_ARRAYS`.
  - `elencaValvole` emette anche le valvole dei serbatoi interni (`codiciValvoleSerbatoio`), **dopo** quelle dei serbatoi, raggruppate per generatore nell'ordine N1, N2, N3.

- [ ] **Step 1: Test che falliscono** in `equipmentCodes.test.ts`:
  - `collectCodes` su una scheda con `generatori_azoto: [{codice:'N1'}]`, `serbatoi_generatore: [{codice:'NS1', generatore_associato:'N1'}]` contiene `'N1'` e `'NS1'`.
  - `pruneSchedaRefs`: con N1 eliminato, `NS1` (`generatore_associato:'N1'`) sparisce e `changed === true`; applicata di nuovo al risultato `changed === false`.
  - `pruneSchedaRefs`: un NS che punta a `'N9'` inesistente viene scartato.
  - `normalizeSchedaCodes` / `nextFreeCode('NS', …)`: con `NS2, NS3` presenti il codice libero è `'NS1'`, e `NS2`/`NS3` restano invariati.
  - `compareCodes` ordina `['S1','NS2','N1','NS1']` come `['N1','NS1','NS2','S1']`.
  - In `valvoleImpianto.test.ts`: `elencaValvole` su NS1 con principale + 1 aggiuntiva dà le posizioni `['NS1.1','NS1.2']` con `recipiente: 'NS1'`; una scheda senza i due array dà lo stesso risultato di oggi.
  - `puoAggiungereSerbatoioGeneratore` è falso con 8 serbatoi su N1 e vero su N2 vuoto.
- [ ] **Step 2:** `npx vitest run src/utils/__tests__/equipmentCodes.test.ts src/utils/__tests__/valvoleImpianto.test.ts` → FAIL.
- [ ] **Step 3: Implementare.** In `pruneSchedaRefs` aggiungere un passo `1b` che giri su `LINKED_ARRAYS` con la stessa logica del passo 1. Nessun flag sul padre. `CHILD_FLAG` resta com'è.
- [ ] **Step 4:** stessi test → PASS; `npx tsc --noEmit` pulito.
- [ ] **Step 5: Commit** `feat(dm329): tipi e codici del generatore di azoto e dei serbatoi interni`.

### Task 2: Catalogo apparecchiature

**Files:**
- Create: `supabase/migrations/20261119000000_equipment_catalog_enum_generatore_azoto.sql` (solo i due `ALTER TYPE … ADD VALUE IF NOT EXISTS`, con l'avvertenza «va eseguito da solo» copiata da `20260803000000_…recipienti_filtro.sql`)
- Modify: `src/types/index.ts` (`EquipmentCatalogType`), `src/utils/equipmentCatalogValidation.ts` (`EQUIPMENT_CATALOG_TYPES`), `src/services/equipmentAudit/specsNormalization.ts` (`CANONICAL_SPECS`, `LEGACY_SPEC_MAP`, `FORM_TO_CANONICAL`), `src/services/equipmentAudit/rules/specsIntegrity.ts` (`TIPO_LEGACY_MAP`), `scripts/import-equipment-catalog.ts`
- Test: `src/utils/__tests__/equipmentCatalogValidation.test.ts`

**Interfaces:**
- Produces: specifiche canoniche: `'Serbatoi generatore azoto'` → `RECIPIENTE_SPECS`; `'Generatori azoto'` → `{ ps, ts, portata }` (portata in l/min).

- [ ] **Step 1: Test che falliscono:** `specsSchemaFor('Generatori azoto')` accetta `{ps: 13, ts: '5 ÷ 50', portata: 1200}` e rifiuta `portata: -1`; `specsSchemaFor('Serbatoi generatore azoto')` si comporta come per `'Disoleatori'`.
- [ ] **Step 2:** `npx vitest run src/utils/__tests__/equipmentCatalogValidation.test.ts` → FAIL.
- [ ] **Step 3: Implementare** le mappe.
- [ ] **Step 4:** test PASS, `tsc` pulito.
- [ ] **Step 5: Applicare la migrazione in produzione** via Management API (curl, sessione propria), poi verificare con `SELECT enumlabel FROM pg_enum WHERE enumtypid='equipment_catalog_type'::regtype` che i 12 valori ci siano. È additiva: non cambia nulla per il client in produzione.
- [ ] **Step 6: Commit** `feat(catalogo): tipi Generatori azoto e Serbatoi generatore azoto`.

### Task 3: Classificazione, CIVA, fattura, spessimetrica

**Files:**
- Modify: `src/utils/dm329Classification.ts` (`calcolaEsitiPerCodice`), `src/utils/civaFiltering.ts` (`extractSerbatoiGeneratore`, `filterCIVAEquipment`, `extractManufacturerNames`), `src/types/civa.ts` (`TipoApparecchiaturaCIVA`), `src/utils/xFattura.ts`, `src/utils/spessimetrica.ts`
- Test: `src/utils/__tests__/dm329Classification.test.ts`, `src/utils/__tests__/xFattura.test.ts`, test di `civaFiltering` se esiste (altrimenti crearlo accanto)

**Interfaces:**
- Consumes: `ARRAY_RECIPIENTI` (Task 1). Ogni lista cablata dei quattro array va **sostituita** con un ciclo su `ARRAY_RECIPIENTI`, dove la forma del codice lo permette. Dove ogni array ha una funzione propria (CIVA), si aggiunge la funzione e un commento che rimanda alla costante.

- [ ] **Step 1: Test che falliscono:** `calcolaEsitiPerCodice` su NS1 (volume 270, PS 11) produce la stessa riga che produrrebbe un disoleatore con quei dati; la stessa scheda con gli array assenti dà l'elenco di oggi. CIVA: NS1 non denunciato con adempimento compare fra le apparecchiature CIVA con costruttore e descrizione `Serbatoio interno generatore di azoto N1`. xFattura e spessimetrica contano NS1 come un recipiente.
- [ ] **Step 2:** test → FAIL.
- [ ] **Step 3: Implementare.**
- [ ] **Step 4:** test PASS, `tsc` pulito, `grep -rn "'recipienti_filtro'" src --include=*.ts*` rivisto: ogni occorrenza rimasta che elenca i recipienti include `serbatoi_generatore` o è giustificata.
- [ ] **Step 5: Commit** `feat(dm329): serbatoi interni dei generatori in classificazione, denunce e fatturazione`.

### Task 4: Scheda dati e fascicolo

**Files:**
- Modify: `src/components/technicalSheet/table/equipmentConfig.ts`, `src/components/technicalSheet/table/UnifiedEquipmentTable.tsx`, `src/components/technicalSheet/TechnicalSheetForm.tsx`, `src/components/technicalSheet/table/ValvoleProtezioneCell.tsx`, `src/components/technicalSheet/TechnicalSheetHeader.tsx`, `src/pages/TechnicalDetails.tsx`, `src/utils/schedaCompleteness.ts`, `src/components/technicalSheet/PhotoUploadSection.tsx`, `src/services/equipmentAudit/flattenSheets.ts`, `src/utils/equipmentMatcher/compatibilita.ts` (`CAMPI_CONFRONTABILI`, `Record<EquipmentKind>`: il serbatoio interno confronta gli stessi campi del disoleatore, il generatore marca/modello/PS/TS/portata)
- Test: `src/utils/__tests__/schedaCompleteness.test.ts`

**Interfaces:**
- Consumes: Task 1 (tipi, `serbatoiDelGeneratore`, `puoAggiungereSerbatoioGeneratore`, `nextFreeCode('NS', …)`), Task 2 (tipi di catalogo).
- Produces:
  - `EQUIPMENT_DEFS.generatore`: `prefix 'N'`, `catalogType 'Generatori azoto'`, `capacitaField 'portata'`, `pressioneField 'ps_pressione_max'`, `ts: true`, `cat: false`, `autoPed: false`, `extra: [NOTE_EXTRA]`, `specsMap { portata, ps, ts }`, `childKind 'serbatoio_generatore'`, `adv ['capacita','pressione','ts']`. Etichetta della colonna portata: «Aria alim. (l/min)».
  - `EQUIPMENT_DEFS.serbatoio_generatore`: copia di `disoleatore` con `prefix 'NS'` e `catalogType 'Serbatoi generatore azoto'`.
  - `'generatore'` in `NEW_EQUIPMENT_KINDS`, `'serbatoio_generatore'` no; `KIND_ARRAY` con le due voci.

- [ ] **Step 1: Test che falliscono** in `schedaCompleteness.test.ts`: un NS1 senza volume è incompleto; un NS1 completo con la valvola principale vuota è incompleto (`mandatoryValvola`); un generatore senza PS è incompleto, uno con marca/modello/n_fabbrica/anno/PS/TS/portata è completo.
- [ ] **Step 2:** test → FAIL.
- [ ] **Step 3: Implementare** definizioni e liste osservate. In tabella: ogni generatore è seguito dai suoi NS, e ogni NS dalle sue valvole (`posizioni: codiciValvoleSerbatoio`). Sulla riga del generatore c'è l'azione «aggiungi serbatoio interno», disattivata quando `puoAggiungereSerbatoioGeneratore` è falso; il nuovo NS ha `generatore_associato` impostato e una valvola principale vuota. Contesto del fascicolo: per le righe NS `principale` = il generatore. `fascicoloDiRiferimento.ts` **non** si tocca: verificare per lettura che un NS non ripieghi sul fascicolo di N. Eliminando un generatore si chiama `pruneSchedaRefs`, come oggi per il compressore.
- [ ] **Step 4:** test PASS, `tsc` pulito, `npx eslint` sui file toccati senza errori nuovi.
- [ ] **Step 5: Prova in pagina** (`preview_start`, login vero con le credenziali di `.env.local`) su `002 test`:
  - aggiungere N1;
  - aggiungere due serbatoi interni (devono nascere NS1 e NS2, con la valvola NS1.1 / NS2.1);
  - aggiungere una valvola aggiuntiva a NS1 (deve chiamarsi NS1.2);
  - aggiungerne fino a 8 e verificare che l'azione si disattivi;
  - eliminare N1 e verificare che spariscano tutti gli NS;
  - controllare che nella console non ci siano errori.
  Dopo la prova, ripristinare la pratica e verificarla con un secondo giro dopo un reload completo della pagina (`keepMounted`).
- [ ] **Step 6: Commit** `feat(scheda): generatori di azoto e serbatoi interni nella scheda dati`.

### Task 5: OCR

**Files:**
- Modify: `src/types/ocr.ts`, `src/utils/filenameParser.ts`, `src/components/technicalSheet/BatchOCRDialog.tsx`, `src/components/technicalSheet/SingleOCRButton.tsx`, `src/utils/ocrConflictDetection.ts`, `supabase/functions/analyze-equipment-nameplate/index.ts`
- Test: test di `filenameParser` (crearlo in `src/utils/__tests__/filenameParser.test.ts` se non esiste)

**Interfaces:**
- Produces: `parseEquipmentFilename('N2.jpg')` → generatore, indice 1; `'NS3.jpg'` → serbatoio interno, indice 2; `'NS1.1.jpg'` → valvola principale di NS1; `'N1.1.jpg'` → `isValid: false`, con un errore che contiene `NS`.

- [ ] **Step 1: Test che falliscono** con i quattro casi qui sopra, più: il testo d'errore di un prefisso sconosciuto elenca `N` e `NS`.
- [ ] **Step 2:** test → FAIL.
- [ ] **Step 3: Implementare.**
  - Edge Function: in `campiSpecifici` e `promptPerTipo`, il generatore chiede marca, modello, matricola, anno, PS, TS e la **portata d'aria di alimentazione** in l/min (convertita da Nm³/h se la targa la dà così). Il prompt dice esplicitamente di non confondere l'aria di alimentazione con l'azoto prodotto. Il serbatoio interno = caso disoleatore.
  - La funzione **non** si ridistribuisce qui, ma nel Task 10.
- [ ] **Step 4:** test PASS, `tsc` pulito; `npx supabase functions serve` non serve, basta che il file Deno compili: `npx deno check` se disponibile, altrimenti una lettura attenta del diff.
- [ ] **Step 5: Commit** `feat(ocr): targhette di generatori di azoto e serbatoi interni`.

### Task 6: Relazione tecnica

**Files:**
- Modify: `src/services/relazione/engine/esiti.ts`, `engine/caratteristiche.ts`, `engine/protezioni.ts`, `engine/valvole.ts`, `preflight.ts`, `engine/fluidi.ts`, `engine/descrizioneGenerale.ts`, `src/services/relazione/helpers.ts`, `src/services/relazione/__tests__/fixtures.ts`
- Test: `src/services/relazione/__tests__/{esiti,caratteristiche,valvole,descrizioneGenerale,preflight}.test.ts`, `templateIntegration.test.ts`

**Interfaces:**
- Consumes: Task 1.
- Produces:
  - `descrizioneSerbatoioGeneratore(s: SerbatoioGeneratore): string` in `helpers.ts`, che restituisce `Serbatoio interno generatore di azoto N1`;
  - `fraseGeneratoriAzoto(generatori: GeneratoreAzoto[]): string` in `descrizioneGenerale.ts`, stringa vuota senza generatori, testo esatto dalle Global Constraints;
  - nuova fixture `schedaConGeneratore` in `fixtures.ts`: N1 con NS1 e NS2, un compressore da 2000 l/min e uno da 1500.

- [ ] **Step 1: Test che falliscono:**
  - `buildEsiti`: dopo il blocco esistente compaiono la riga «Generatore di azoto» N1 (non recipiente), con l'esito più oneroso fra NS1 e NS2, e poi le righe NS1 e NS2 con le loro valvole. Un generatore senza serbatoi ha una riga con esito vuoto.
  - `buildValvole` su NS1.1: `portataMax` = **3500** (somma delle FAD di tutti i compressori), `applicabile: true`; la verifica di pressione confronta la taratura col PS di NS1. Senza compressori: `applicabile: false`.
  - `preflight`: con i compressori presenti, nessun avviso `valvola-senza-compressori` sulle valvole NS.
  - `buildCaratteristiche`: N1 riporta la portata d'aria di alimentazione con un'etichetta che lo dice; NS si comporta come il disoleatore.
  - `buildProtezioni`: NS1 compare in `altre` con NS1.1.
  - `buildFluidi`: con un generatore la riga Azoto c'è una volta sola, anche se esiste anche un serbatoio `fluido:'AZOTO'`.
  - `fraseGeneratoriAzoto`: con 1, 2 e 3 generatori restituisce le frasi esatte; con 0 la stringa vuota.
  - Con la fixture di oggi (senza generatori) ogni test esistente resta verde **senza modifiche**.
- [ ] **Step 2:** test → FAIL.
- [ ] **Step 3: Implementare.** La frase va in coda alla sezione di trattamento, dentro il testo che `buildDescrizioneGenerale` già compone. **Nessun tag nuovo nel `.docx`**, a meno che la composizione non lo renda impossibile: in quel caso si aggiornano `scripts/tag-relazione-template.py`, `TEMPLATE_TAGS.md` e il modello, e lo si annota nel piano.
- [ ] **Step 4:** tutti i test di `src/services/relazione` → PASS (un solo processo vitest), `tsc` pulito.
- [ ] **Step 5:** generare un `.docx` di prova con `scripts/generate-relazione-sample.ts` sulla fixture col generatore e aprirlo per leggere: le tabelle e la frase. Se lo script non accetta una fixture, aggiungere un argomento.
- [ ] **Step 6: Commit** `feat(relazione): generatori di azoto e serbatoi interni nella relazione tecnica`.

### Task 7: Dichiarazioni dell'installatore

**Files:**
- Modify: `src/services/dichiarazioni/installatore/raggruppa.ts`
- Test: `src/services/dichiarazioni/installatore/__tests__/raggruppa.test.ts`

- [ ] **Step 1: Test che falliscono:** `raggruppaApparecchiatureInstallatore` su una scheda con N1, NS1 e NS2 produce le righe NS con `principale: 'Generatore di azoto'` e la descrizione del Task 6, nella stessa posizione relativa in cui stanno i disoleatori rispetto ai compressori. Senza i due array, il risultato è identico a oggi.
- [ ] **Step 2:** test → FAIL.
- [ ] **Step 3: Implementare** con `descrizioneSerbatoioGeneratore` (Task 6).
- [ ] **Step 4:** test di `src/services/dichiarazioni` → PASS, `tsc` pulito.
- [ ] **Step 5: Commit** `feat(dichiarazioni): serbatoi interni dei generatori di azoto`.

### Task 8: Simbolo del generatore nello schema

**Files:**
- Modify: `src/services/schemaImpianto/types.ts` (`SchemaNodoTipo`, flag `nonDisegnato?: boolean` su `SchemaAccessorioDipendente`), `src/services/schemaImpianto/symbols/index.ts` (`DIMENSIONI`, `DIMENSIONI_NODO`, disegno, `REGISTRO_SIMBOLI`), `src/services/schemaImpianto/persistenza.ts` (solo se non segue da sé), `src/services/schemaImpianto/appunti.ts` (`PREFISSO_COPIA`), `src/components/schemaImpianto/SchemaEditor.tsx` (`PALETTE`)
- Test: `src/services/schemaImpianto/__tests__/simboli.test.ts`, `bancoSimboli.test.ts`

**Interfaces:**
- Produces:
  - `DIMENSIONI.generatore_azoto = { larghezza: 60, altezza: 120 }`;
  - le ancore `in-alto` (x 20, y 0), `out-alto` (x 40, y 0), `basso-out` (x 30, y 120) e le quattro dei fianchi `sx-1`, `sx-2`, `dx-1`, `dx-2` alle quote CAD 2,39 e 4,21 su 20, riportate su 120 dal basso e arrotondate alla griglia di 10;
  - il disegno: rettangolo e codice dentro, in alto, come l'attributo `ID` del blocco;
  - gli accessori con `nonDisegnato: true` non si disegnano.
  Fonte: `\\192.168.1.5\ufficio tecnico bertin\N2.dxf`, blocco `Generatore_N2`. Riquadro 9,6 × 20, pallini alle coordinate scritte nella spec.

- [ ] **Step 1: Test che falliscono:** il registro espone le sette ancore con quelle coordinate; l'SVG del nodo contiene un `rect` 60 × 120 e il testo `N1`; un nodo con accessori `nonDisegnato` produce lo stesso SVG di un nodo senza accessori.
- [ ] **Step 2:** test → FAIL.
- [ ] **Step 3: Implementare.** Prima di fissare i numeri, inforcare il banco di confronto sul DXF (vedi la memoria «banco di confronto»: va agganciato al primo stadio che il blocco tocca, o misura zero). La descrizione sopra il riquadro va disegnata solo se gli altri simboli disegnano la loro: verificarlo nel codice e scrivere nel commento cosa si è trovato.
- [ ] **Step 4:** test di `src/services/schemaImpianto` → PASS, **nessuna fixture SVG modificata** (`git diff --stat src/services/schemaImpianto/__tests__/fixtures` vuoto), `tsc` pulito.
- [ ] **Step 5: Commit** `feat(schema): simbolo del generatore di azoto dal blocco CAD`.

### Task 9: La derivazione dell'azoto nello schema

**Files:**
- Modify: `src/services/schemaImpianto/buildSchemaModel.ts`, `src/services/schemaImpianto/layout.ts`, `src/services/schemaImpianto/bypass.ts` (solo per ignorare il ramo), `src/services/schemaImpianto/segniAncorati.ts` (se le rotte dall'alto lo richiedono), `src/services/schemaImpianto/renderSvg.ts` (`righeLista`, `CON_VALVOLA_SCARICO`)
- Test: `src/services/schemaImpianto/__tests__/buildSchemaModel.test.ts`, `layout.test.ts`, `renderSvg.test.ts`

**Interfaces:**
- Consumes: Task 1, Task 8.
- Produces:
  - `buildGeneratoreNodo(g: GeneratoreAzoto, scheda): SchemaNodo`, con i serbatoi interni come accessori `nonDisegnato: true` e le loro valvole;
  - id riservati che nessun codice di scheda può produrre: `ID_UTENZE_AZOTO = 'UTENZE-AZOTO'` (terminale con etichetta `'Utenze\nazoto'`) e `ID_DERIVAZIONE_AZOTO = 'DER-AZOTO'` (TEE `'giunzione'`); le giunzioni dei collettori, se servono, `DER-AZOTO-<n>`;
  - archi: TEE sull'arco *ultimo elemento → UTENZE*; dal TEE l'aria va a `in-alto` di ogni generatore; da `out-alto` di ogni generatore l'azoto va a `UTENZE-AZOTO`; da `basso-out` partono le condense verso la corsia comune (`scaricaCondensa` vero per il generatore).

- [ ] **Step 1: Test che falliscono:**
  - con N1 il modello ha `DER-AZOTO` sull'arco verso `UTENZE`, un arco `DER-AZOTO → N1` che arriva su `in-alto`, `N1 → UTENZE-AZOTO` da `out-alto`, e una linea condense da N1;
  - con N1, N2 e N3 i tre generatori sono alimentati **in parallelo** dallo stesso TEE, e nel layout stanno affiancati alla stessa `y`, con x crescenti nell'ordine N1, N2, N3;
  - il generatore non compare in `ordineLinea`, né fra gli stadi di `ordinaCatenaTrattamento` o di `catenaDagliArchi`;
  - con un separatore come ultimo elemento della linea, il TEE sta **dopo** il separatore;
  - `righeLista` elenca N1, poi NS1 con NS1.1, poi NS2 con NS2.1;
  - una scheda senza generatori dà lo stesso modello e lo stesso SVG di oggi: tutte e tre le fixture SVG restano intatte;
  - con un by-pass sull'ultimo elemento, la derivazione resta agganciata a valle del capo di uscita del by-pass.
- [ ] **Step 2:** test → FAIL.
- [ ] **Step 3: Implementare.** Il TEE si posa con la stessa giunzione dei by-pass. Il ramo passa sopra i generatori e scende negli ingressi in alto. Le uscite risalgono a un collettore che va al terminale. Le quote si ricavano dalle costanti esistenti (`PASSO_CORSIA_BYPASS`, `PASSO_GIUNZIONE`, `PASSO_TERMINALE`), senza inventarne di nuove dove una esistente serve. `layout.ts` deve considerare il rettangolo alto come terzo caso di corpo. Controllare che nessun `y` sia negativo: `renderSvg` taglia in silenzio tutto ciò che sta sopra lo zero.
- [ ] **Step 4:** test di `src/services/schemaImpianto` → PASS, fixture intatte, `tsc` pulito.
- [ ] **Step 5: Guardare il disegno:** generare l'SVG da una scheda di prova con 1 e con 3 generatori, rasterizzarlo con `sharp` (`density: 130`) e controllare con gli occhi che nessun tubo corra sotto un altro simbolo e che le entrate siano dall'alto.
- [ ] **Step 6: Commit** `feat(schema): derivazione dei generatori di azoto con terminale utenze azoto`.

### Task 10: Prova completa e rilascio

- [ ] **Step 1: Gate** sul ramo: `npx vitest run` (un processo), `npx tsc --noEmit`, `npm run lint` (nessun errore nuovo rispetto a `main`).
- [ ] **Step 2: Prova in pagina** su `002 test`, con login vero:
  - inserire N1 con due serbatoi e N2 con uno;
  - aprire SC, premere «Genera schema» e verificare TEE, generatori affiancati, «Utenze azoto» e la lista con NS e valvole;
  - generare la relazione e leggere esiti, valvole e frase nel `.docx`;
  - generare le dichiarazioni;
  - controllare il fascicolo di NS1;
  - lanciare l'OCR su una foto chiamata `NS1.jpg`.
  Ripristinare la pratica e riverificarla dopo un reload completo.
- [ ] **Step 3:** `git fetch`, poi simulare il merge con `git merge-tree` contro `origin/main` (mai contro il `main` locale).
- [ ] **Step 4: Chiedere al committente il via alla pubblicazione.** Ottenuto il via:
  - merge su `main` e push;
  - `npx supabase functions deploy pulisci-fascicoli-scaduti` e `npx supabase functions deploy analyze-equipment-nameplate`.
  La funzione dei fascicoli va ridistribuita **subito** dopo il push: prima che giri la passata notturna.
- [ ] **Step 5:** verificare che il deploy Vercel sia READY e che il bundle servito contenga le stringhe nuove (es. `Generatore di azoto`, `UTENZE-AZOTO`). Aggiornare `DOCUMENTAZIONE/fixes.md` e scrivere in coda a questo piano il paragrafo «cosa è andato diversamente».
