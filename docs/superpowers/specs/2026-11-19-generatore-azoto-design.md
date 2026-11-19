# Generatore di azoto fra le apparecchiature DM329

**Data:** 19-11-2026
**Stato:** progettato, da implementare

## Perché

Negli impianti che lo studio verifica compaiono generatori di azoto alimentati dall'aria
compressa. Contengono fino a otto recipienti in pressione interni, ciascuno con la propria
valvola di sicurezza, che vanno classificati e denunciati secondo il DM 329/2004 con le stesse
regole degli altri recipienti. Oggi l'applicazione non ha un posto dove metterli: si finisce a
descriverli a mano fuori dalla scheda, e restano fuori da relazione, dichiarazioni, denunce e
schema.

Il generatore deve diventare **un'apparecchiatura come le altre**, con lo stesso trattamento
dei compressori col loro disoleatore: un padre che non è un recipiente e dei figli che lo sono.

## Decisioni del committente (19-11-2026)

1. **Perimetro: tutto**, come per le altre apparecchiature — catalogo, scheda dati,
   classificazione DM329 e denunce, relazione tecnica, dichiarazioni dell'installatore,
   fascicolo, OCR, schema d'impianto.
2. **Numero:** al massimo **3 generatori** per impianto, ciascuno con **0–8 serbatoi interni**.
3. **Numerazione a due livelli, prefisso unico (variante A):**
   - generatori **N1, N2, N3**;
   - serbatoi interni **NS1, NS2, NS3…** numerati di seguito su tutto l'impianto, a prescindere
     dal generatore a cui appartengono;
   - valvole **NS1.1** (principale) e **NS1.2, NS1.3…** se aggiuntive — esattamente la regola
     dei serbatoi (S1 → S1.1).
   - Il generatore di appartenenza non si legge dal codice: lo dicono la scheda e la lista
     apparecchiature.
   - Esempio: N1 con due serbatoi → NS1, NS2 (valvole NS1.1, NS2.1); N2 con un serbatoio → NS3.
   - Scartata la variante NA/NB/NC (lettera per generatore) e la strada del disoleatore
     (N1.1… con valvole a seguire, che rinumera le valvole a ogni serbatoio aggiunto).
4. **Valvola di sicurezza sempre obbligatoria** sui serbatoi interni, come su serbatoi e
   disoleatori.
5. **Dati del generatore:** marca, modello, matricola (n. fabbrica), anno, PS, TS, portata.
6. **Dati dei serbatoi interni:** gli stessi del disoleatore (marca, modello, n. fabbrica, anno,
   volume, PS, TS, categoria PED, note, già denunciato, matricola INAIL, spessimetrica,
   certificazione, valvola principale + aggiuntive, foto targhetta).
7. **Denunce:** i serbatoi interni seguono le regole degli altri recipienti (DM 329/2004).
8. **Schema d'impianto:** il generatore sta **a valle dell'ultimo filtro di linea**. L'aria
   entra dal connettore **in alto a sinistra**, l'azoto esce dal connettore **in alto a destra**,
   il connettore in basso al centro è lo **scarico condense**. Nel disegno il generatore si
   rappresenta **sempre senza serbatoi interni**; i serbatoi interni compaiono **solo nella
   lista apparecchiature** sotto il disegno.

### Seconda tornata (19-11-2026, dopo la revisione)

9. **Il generatore sta in derivazione, non in linea.** La linea dell'aria prosegue verso
   «Utenze aria»; il generatore si stacca con un TEE e ha la sua uscita verso un terminale
   «Utenze azoto».
10. **Più generatori stanno in parallelo**, uno accanto all'altro, non in serie.
11. **La derivazione sta in fondo a tutto**, dopo l'ultimo elemento della linea (anche dopo i
    separatori): nessun elemento della linea d'aria finisce sul ramo dell'azoto.
12. **Le valvole dei serbatoi interni si verificano con la portata dei compressori a monte**,
    non con la portata del generatore (che è minore dell'aria che può entrare: verificare su di
    lei sarebbe a sfavore di sicurezza).
13. **La «portata» del generatore è la portata d'aria di alimentazione**, il dato di scheda
    tecnica — non l'azoto prodotto. Nessun campo purezza.
14. **Frase della relazione approvata:** «A valle della linea di trattamento è installato un
    generatore di azoto (N1) che produce azoto in sito a partire dall'aria compressa.» Al
    plurale con più generatori («sono installati due generatori di azoto (N1, N2) che
    producono…»).

## Obiettivi, non-obiettivi, anti-obiettivi

**Obiettivi**
- Inserire in scheda da 0 a 3 generatori e i loro serbatoi interni, con catalogo e OCR come per
  le altre apparecchiature.
- Ogni serbatoio interno viene classificato, entra negli esiti, nelle denunce CIVA, nelle
  dichiarazioni, nel fascicolo, nella fattura (xFattura) e nella spessimetrica come ogni altro
  recipiente.
- La relazione descrive la generazione di azoto e riporta generatore, serbatoi e valvole nelle
  sue tabelle.
- Lo schema generato posa il generatore dopo l'ultimo filtro, col simbolo del DXF.

**Non-obiettivi**
- Disegnare i serbatoi interni nello schema.
- Una rete di distribuzione dell'azoto oltre il terminale «Utenze azoto» (lo schema si ferma
  al terminale, come per l'aria).
- Cambiare la numerazione di apparecchiature esistenti.

**Anti-obiettivi (sarebbe un fallimento anche se «funziona»)**
- Che la pulizia notturna dei fascicoli (`pulisci-fascicoli-scaduti`) consideri orfani i
  documenti di N/NS e li cancelli: la Edge Function **va ridistribuita** insieme al client.
- Che un serbatoio interno sfugga alla classificazione o alle denunce perché manca in una delle
  liste cablate dei «recipienti» (vedi sotto: la lista è ripetuta in una decina di posti).
- Che una pratica esistente, senza generatori, produca anche un solo byte diverso in relazione,
  dichiarazioni o schema.
- Che il codice NS di un serbatoio cambi da solo quando si aggiunge o toglie un serbatoio a un
  altro generatore (le foto e i documenti sono indicizzati per codice).

## Approcci considerati (per la numerazione e il modello dati)

| Approccio | Pro | Contro | Esito |
|---|---|---|---|
| **A. NS come array principale con riferimento al generatore** | Regola identica ai serbatoi, `parseCode` e `codiciValvoleSerbatoio` funzionano già; nessuna eccezione nuova nei codici | Il generatore non si legge dal codice; serve una regola nuova di «figlio di» fuori da `CHILD_ARRAYS` | **Scelto** |
| B. Prefisso per generatore (NA/NB/NC) | Il generatore si legge dal codice | Mappa A↔N1 da imparare, tre prefissi nuovi, errori nei nomi file | Scartato |
| C. Come il disoleatore (N1.1… con valvole a seguire) | Nessun prefisso nuovo | Le valvole cambiano codice a ogni serbatoio aggiunto; rompe documenti e foto | Scartato |
| (Tre livelli N1.1.1, proposta iniziale) | Leggibile | Cambia `CODE_RE` condiviso con la Edge Function, rischio sulle cancellazioni | Scartato dal committente |

## Modello dati

### Scheda (`src/types/technicalSheet.ts`)

```ts
export interface GeneratoreAzoto {
  codice: string            // N1, N2, N3
  marca?: string
  modello?: string
  n_fabbrica?: string       // matricola
  anno?: number
  ps_pressione_max?: number // PS (bar)
  ts_temperatura?: number   // TS (°C)
  ts?: string               // TS libero, precompilato da catalogo (come gli altri)
  portata?: number          // portata d'aria di ALIMENTAZIONE, l/min (decisione 13).
                            // l/min come la FAD dei compressori (mia scelta): le schede tecniche
                            // la danno spesso in Nm³/h, il campo può offrire la conversione.
  note?: string
  foto_targhetta?: string
}

export interface SerbatoioGeneratore extends CampiRecipiente {
  codice: string                 // NS1, NS2, …
  generatore_associato: string   // N1, N2, N3
  // …tutti i campi di Disoleatore, compresi valvola_sicurezza (obbligatoria) e valvole_aggiuntive
}
```

- `SchedaDatiCompleta` guadagna `generatori_azoto: GeneratoreAzoto[]` (max 3) e
  `serbatoi_generatore: SerbatoioGeneratore[]` (max 24 complessivi, **max 8 per generatore**
  imposto dall'interfaccia). Entrambi **facoltativi in lettura**: le schede esistenti non li
  hanno e devono leggersi come array vuoti.
- `EQUIPMENT_LIMITS`: `generatori_azoto: { min: 0, max: 3, prefix: 'N' }`,
  `serbatoi_generatore: { min: 0, max: 24, prefix: 'NS' }`.
- Nessun flag `ha_serbatoi` sul generatore: la presenza si deriva dai serbatoi che lo citano.
- **Nessun campo `fluido` sui serbatoi interni** (*mia scelta*): un generatore PSA contiene
  insieme aria e azoto (polmone d'aria, colonne, polmone d'azoto), il gruppo DM329 è 2 in ogni
  caso, e la descrizione «Serbatoio interno generatore di azoto N1» dice già cosa sono.
- **Nessun dato esistente da migrare:** verificato in produzione il 19-11-2026, zero schede su
  `dm329_technical_data` contengono «azoto» o «generatore» in `equipment_data`, e nel catalogo
  non ci sono voci che ne facciano le veci.

### Codici (`codiciScheda.ts`, `equipmentCodes.ts`, `valvoleImpianto.ts`)

- Entrambi gli array entrano in **`PARENT_ARRAYS`** (codice assegnato con `nextFreeCode`, che
  riusa i buchi: è ciò che garantisce che un codice NS non cambi quando se ne toglie un altro).
  `parseCode` legge già `NS1.1` come prefisso `NS` e `compareCodes` ordina N < NS < S.
- **Regola nuova «figlio per riferimento»** accanto a `CHILD_ARRAYS` (es.
  `LINKED_ARRAYS = [{ array: 'serbatoi_generatore', ref: 'generatore_associato', parent:
  'generatori_azoto', figliMax: 8 }]`), letta da `pruneSchedaRefs`: eliminato un generatore,
  **si eliminano i suoi serbatoi interni** (come oggi il disoleatore segue il compressore).
  Il punto 3 di `pruneSchedaRefs`, che cabla `['scambiatori','recipienti_filtro']` per
  `valvole_protezione`, va esteso se la nuova famiglia lo richiede.
- `elencaValvole` aggiunge un giro sui serbatoi interni con `codiciValvoleSerbatoio`: da lì
  seguono `risolviValvole`, `ValvoleProtezioneCell`, `useHydrateCatalogOrigini`,
  `buildSchemaModel`.
- La Edge Function `pulisci-fascicoli-scaduti` importa `collectCodes` per percorso relativo:
  segue da sola, ma **va ridistribuita nello stesso rilascio**.

### Catalogo (database)

- Migrazione nuova, **da eseguire da sola** (PostgreSQL non usa un valore di enum nella stessa
  transazione che lo crea, vedi `20260803000000_equipment_catalog_enum_recipienti_filtro.sql`):
  `ALTER TYPE equipment_catalog_type ADD VALUE 'Generatori azoto'` e
  `ADD VALUE 'Serbatoi generatore azoto'`. I nomi sono una mia proposta, allineati al plurale
  degli altri valori.
- Si applica in produzione via Management API (preferenza del progetto), verificando prima lo
  schema vivo (il repo non è affidabile, vedi la nota sullo scostamento DB/repo).
- `EquipmentCatalogType` (`src/types/index.ts`), `EQUIPMENT_CATALOG_TYPES`
  (`equipmentCatalogValidation.ts`), `CANONICAL_SPECS` / `LEGACY_SPEC_MAP` /
  `FORM_TO_CANONICAL` (`specsNormalization.ts`), `TIPO_LEGACY_MAP` (`specsIntegrity.ts`),
  `CAMPI_CONFRONTABILI` (`equipmentMatcher/compatibilita.ts`), mappa dello script di import.
  Specifiche canoniche: il serbatoio interno usa `RECIPIENTE_SPECS`; il generatore un insieme
  nuovo con `ps`, `ts`, `portata`.

## Scheda dati (interfaccia)

- `equipmentConfig.ts`: due `EquipmentKind` nuovi.
  - **Generatore**: in `NEW_EQUIPMENT_KINDS` (si aggiunge dal menu «nuova apparecchiatura»),
    portata come `capacitaField`, azione «aggiungi serbatoio interno» sulla riga, disattivata
    a 8 serbatoi.
  - **Serbatoio interno**: copia della definizione `disoleatore` — `mandatoryValvola: true`,
    `RECIPIENTE_EXTRA`, `DENUNCIA_EXTRA`, `autoPed`. Non si aggiunge dal menu generale, solo
    dalla riga del generatore.
- `UnifiedEquipmentTable.tsx`: `useFieldArray`/`useWatch` per i due array, conteggi e limiti,
  `aggiungi`, ordine delle righe (**ogni generatore seguito dai suoi serbatoi interni, ognuno
  seguito dalle sue valvole**), colore per tipo, contesto del fascicolo (`principale` = il
  generatore per le righe NS). Le valvole NS usano `posizioni: codiciValvoleSerbatoio`.
- `TechnicalSheetForm.tsx`: `TYPE_TO_FIELD`, array vuoti di default, conteggio `principali`, OCR
  in blocco (NS **non** passa da `CHILD_REF_FIELD`, che deriva il codice dal padre).
- `ValvoleProtezioneCell.tsx`, `TechnicalSheetHeader.tsx`, `TechnicalDetails.tsx`,
  `schedaCompleteness.ts` (`TIPI_IN_TABELLA`), `PhotoUploadSection.tsx`: aggiungere i nuovi
  array/tipi alle liste osservate.
- Visibilità per `tecnicoDM329` (`useTecnicoDM329Visibility.ts`, guidata dai def): i campi
  nascosti seguono gli analoghi esistenti — PS/TS/categoria del serbatoio interno come il
  disoleatore; PS/TS/portata del generatore come PS/portata dell'essiccatore. *Mia scelta.*

## Classificazione DM329, denunce, fatturazione, spessimetrica

Non esiste un'unica fonte di «quali array sono recipienti»: la lista dei quattro array è
ripetuta. **Ogni punto riceve `serbatoi_generatore`**, nessuno riceve `generatori_azoto` (il
generatore non è un recipiente):

- `dm329Classification.ts` — `calcolaEsitiPerCodice` (la lista centrale per adempimento e
  fascicolo). Azoto = gruppo 2, già l'ipotesi del modulo.
- `civaFiltering.ts` — `extractSerbatoiGeneratore` sul modello di `extractDisoleatori`, più
  `filterCIVAEquipment` ed `extractManufacturerNames`; `TipoApparecchiaturaCIVA` in
  `types/civa.ts`.
- `xFattura.ts`, `spessimetrica.ts`.
- **Suggerimento al costruttore:** estrarre la lista in una costante unica
  (`ARRAY_RECIPIENTI`) e farla importare da tutti questi punti, invece di aggiungere
  l'undicesima copia. È il modo più sicuro di onorare l'anti-obiettivo sulle denunce.

## Relazione tecnica (`src/services/relazione/**`)

- `engine/esiti.ts`: riga «Generatore di azoto» come `rigaNonRecipiente` (eredita
  `esitoPiuOneroso` dei suoi serbatoi, come l'essiccatore dai suoi scambiatori), seguita dalle
  righe `rigaRecipiente` dei serbatoi interni con le loro valvole.
- `engine/caratteristiche.ts`: generatore con la portata nella colonna portata; serbatoi interni
  come i disoleatori.
- `engine/protezioni.ts`: serbatoi interni in `altre`, con le loro valvole, come il disoleatore.
- `engine/valvole.ts`: verifica di pressione come il disoleatore (taratura ≤ PS del serbatoio).
  Verifica di portata: **con la portata dei compressori a monte** (decisione 12). Poiché la
  derivazione sta in fondo alla linea, a monte del generatore ci sono **tutti i compressori
  dell'impianto**: si confronta lo scarico della valvola con la somma delle loro FAD, senza
  chiedere collegamenti nuovi in `additional_info` (*mia scelta*: evita di toccare
  `additionalInfoSchema` e il pannello SC). Senza compressori, `applicabile: false` e
  `preflight.ts` avvisa come già fa per i serbatoi.
- `engine/fluidi.ts`: la presenza di un generatore aggiunge la riga Azoto («produzione in
  sito»), anche senza serbatoi `fluido: 'AZOTO'`. Se esistono anche serbatoi `fluido: 'AZOTO'`
  la riga resta una sola.
- Portata del generatore nella colonna portata di `caratteristiche`: è la portata d'aria di
  alimentazione (decisione 13); l'etichetta deve dirlo («aria di alimentazione»), o si legge
  come azoto prodotto.
- `engine/descrizioneGenerale.ts`: la frase approvata (decisione 14) dopo la sezione di
  trattamento, al singolare o al plurale secondo il numero di generatori; nessuna frase senza
  generatori.
- Il modello `.docx` (`public/templates/relazione-dm329.docx`) ha tabelle guidate dal modello:
  servono tag nuovi solo per prosa nuova. Se servono, aggiornare anche
  `scripts/tag-relazione-template.py` e `TEMPLATE_TAGS.md`.
- Descrizione del serbatoio interno nelle tabelle: «Serbatoio interno generatore di azoto N1»
  (*mia proposta*).

## Dichiarazioni dell'installatore

`dichiarazioni/installatore/raggruppa.ts`: un giro sui serbatoi interni con
`principale: 'Generatore di azoto'`, sul modello dei disoleatori (che hanno il compressore come
principale).

## Fascicolo

Ogni serbatoio interno ha il **proprio** fascicolo. Il ripiego sul fascicolo del padre
(`fascicoloDiRiferimento.ts`) gira solo su `CHILD_ARRAYS` e **non va esteso**: un generatore
ha più serbatoi e un documento del generatore non vale per tutti. Il generatore, come
l'essiccatore, ha il suo fascicolo per i documenti propri (manuale, dichiarazione CE).

## OCR

- `types/ocr.ts`: due `EquipmentType` nuovi.
- Edge Function `analyze-equipment-nameplate`: `campiSpecifici` e `promptPerTipo`. Serbatoio
  interno = caso disoleatore (volume, PS, TS, valvola); generatore = marca, modello, matricola,
  anno, PS, TS, portata d'aria di alimentazione (il prompt deve chiedere quella, non l'azoto
  prodotto, che sulle targhe compare più spesso). **Va ridistribuita.**
- `filenameParser.ts`: prefissi `N` e `NS` in `FILENAME_PREFIX_MAP`; `NS1.1` = valvola, come
  `S1.1`; `N1.1` non è un formato valido (messaggio d'errore che rimanda a NS). La regex golosa
  tiene `NS` distinto da `N`. Aggiornare il testo dei prefissi validi.
- `BatchOCRDialog.tsx`, `SingleOCRButton.tsx` (mappe catalogo→OCR e prefissi),
  `ocrConflictDetection.ts` (liste campi per tipo).

## Schema d'impianto

### Il simbolo (dal DXF `N2.dxf`, blocco `Generatore_N2`)

- Riquadro rettangolare **9,6 × 20** unità CAD (rapporto 0,48), attributo `ID` («N1») dentro, in
  alto, e attributo `DESCRIZIONE` («Generatore di Azoto») sopra il riquadro.
- Sette pallini di aggancio, in coordinate CAD con l'origine al centro del lato inferiore:
  - in alto: (−1,6; 20) **ingresso aria**, (+1,6; 20) **uscita azoto**;
  - in basso al centro: (0; 0) **scarico condense**;
  - sui fianchi, due per lato a quota 2,39 e 4,21: non usati dalla generazione automatica.
- Proposta di misura nella tela: **60 × 120** unità (stessa altezza di compressore ed
  essiccatore, ancore sulla griglia di 20 una volta arrotondate: ingresso a x=20, uscita a x=40,
  condense a x=30). Il costruttore verifica col banco di confronto (`scripts/blocchi-cad.py`,
  `confronto-simboli.ts`) e arrotonda le ancore come fatto nel Blocco 3.
- Le quattro ancore dei fianchi si dichiarano comunque nel registro, così l'editor le offre per
  collegamenti a mano. *Mia scelta.*
- La descrizione sopra il riquadro: seguire ciò che fanno oggi gli altri simboli (se nessuno la
  disegna, non la disegna nemmeno lui; la descrizione sta nella lista).

### Il modello

- `SchemaNodoTipo` guadagna `'generatore_azoto'`. Tutti i `Record<SchemaNodoTipo>`
  (`DIMENSIONI`, `DIMENSIONI_NODO`) lo impongono al compilatore.
- `buildSchemaModel.ts`: `buildGeneratoreNodo` sul modello di `buildEssiccatoreNodo`. I
  serbatoi interni diventano accessori del nodo (`accessorio` + `accessoriAggiuntivi`) **marcati
  come non disegnati**: il simbolo li ignora, `righeLista` in `renderSvg.ts` li elenca con le
  loro valvole dopo il generatore.
- **Il generatore non entra in `ordineLinea`** e non è uno stadio della catena
  (decisioni 9 e 11): la catena dell'aria resta com'è, e `ordinaCatenaTrattamento` /
  `catenaDagliArchi` / `famiglieDaScheda` non lo vedono. È la ragione per cui le pratiche senza
  generatore non cambiano.
- **La derivazione** (decisioni 9–11), forma proposta (*mia*, da confermare sulla prima prova in
  pagina):
  - un **TEE** sull'arco fra l'ultimo elemento della linea e il terminale «Utenze aria»;
  - dal TEE un ramo che sale e corre **orizzontale sopra i generatori**, posati **affiancati**
    alla stessa quota sulla riga della catena o sotto di essa, uno per generatore (N1, N2, N3);
  - da quel collettore d'aria una calata verso l'**ingresso in alto a sinistra** di ciascun
    generatore;
  - dalle **uscite in alto a destra** un collettore dell'azoto che porta a **un solo terminale
    «Utenze azoto»** (`nodoUtenze` con etichetta propria);
  - uno scarico condense per generatore, dal connettore in basso, verso la corsia condense
    comune (`scaricaCondensa`).
  Oggi tutto lo schema è un'unica catena lineare: il ramo è **geometria nuova** in
  `buildArchi`, `layout.ts` e nella linearizzazione dei by-pass (`bypass.ts`), che deve
  ignorare il ramo. Il TEE si posa con la stessa giunzione già usata dai by-pass
  (`'giunzione'`). Un by-pass che scavalca l'ultimo elemento convive col TEE della derivazione:
  da provare.
- Le linee entrano ed escono **dall'alto**: `rottaImboccata` e `gradinoVersoIlTee` vanno provati
  su questo caso, mai incontrato (tutti gli stadi di oggi entrano di lato).
- Senza generatori nessun TEE, nessun ramo, nessun terminale azoto: fixture SVG intatte.
- `scaricaCondensa`: il generatore scarica condense, dal connettore in basso.
- `layout.ts`: `inLinea` in `catenaDagliArchi`, i rami del riquadro del corpo (serbatoio vs
  rombo: il generatore è un terzo caso, rettangolo alto), le regole di passo.
- `renderSvg.ts`: `CON_VALVOLA_SCARICO` se applicabile.
- `persistenza.ts` (valida `n.tipo in DIMENSIONI_NODO`, segue da sé), `appunti.ts`
  (`PREFISSO_COPIA`), `SchemaEditor.tsx` (`PALETTE`: voce «Generatore di azoto», prefisso N).
- **Nessun disegno consegnato cambia**: le pratiche senza generatore non devono muovere nessuna
  fixture SVG.

## Vincoli

- TypeScript strict=false, Zod a runtime, test Vitest su logica (codici, classificazione,
  motore relazione, modello dello schema), nessun test di interfaccia.
- **`additionalInfoSchema` è un `z.object` senza `passthrough`**: se il lavoro aggiunge campi in
  `additional_info`, vanno dichiarati sia lì sia nel letterale di `RelazioneDataDialog.tsx`.
  (Il progetto, così com'è, non ne aggiunge: i dati stanno in `equipment_data`.)
- Le Edge Function toccate (`pulisci-fascicoli-scaduti`, `analyze-equipment-nameplate`) si
  ridistribuiscono con `npx supabase functions deploy`.
- Rilascio unico: il lavoro si fa in un ramo a parte e si pubblica tutto insieme. Un rilascio
  parziale (scheda senza relazione o senza denunce) produrrebbe documenti che ignorano
  recipienti presenti in scheda.
- Le prove in pagina si fanno su `002 test` (`fed244ee`), la pratica creata apposta.

## Lasciato al costruttore

- Nomi esatti degli array e dei tipi (proposti qui: `generatori_azoto`, `serbatoi_generatore`,
  `GeneratoreAzoto`, `SerbatoioGeneratore`, `'generatore_azoto'`).
- Se estrarre la costante unica dei recipienti (consigliato) e dove.
- Ordine dei blocchi di lavoro nel piano; suddivisione suggerita: (1) tipi, codici, catalogo,
  scheda; (2) classificazione, CIVA, fattura, spessimetrica, fascicolo, OCR; (3) relazione e
  dichiarazioni; (4) schema d'impianto.
- Taratura fine del simbolo sul banco di confronto.
