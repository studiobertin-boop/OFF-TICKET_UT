# Matching OCR ↔ catalogo apparecchiature (scheda dati DM329)

## Contesto

Nella scheda dati DM329, il pulsante fotocamera accanto a ogni riga di apparecchiatura
(`src/components/technicalSheet/SingleOCRButton.tsx:226-238`) manda una foto o un PDF di
targhetta alla edge function `analyze-equipment-nameplate`, che restituisce marca, modello,
numero di fabbrica, anno e i dati tecnici leggibili. I valori tornati vengono scritti tali e
quali nelle celle da `applyOcr`
(`src/components/technicalSheet/table/UnifiedEquipmentTable.tsx:127-154`).

Il problema: **nessuno di quei valori viene ricondotto a una riga di
`equipment_catalog`**. Se la targhetta dice `SICC`, in cella finisce la stringa `SICC`,
mentre a catalogo le ragioni sociali sono `SICC S.p.A.`, `SICC S.r.L.`, `SICC TECH s.r.l.` e
`SICC TECH`. Marca e modello non corrispondono ad alcuna voce, quindi Volume, PS e TS non
vengono auto-compilati dal catalogo ma restano quelli letti (TS non viene letto affatto:
l'OCR non lo estrae), la riga risulta priva di origine a catalogo, e compare il pulsante «+»
che propone di aggiungere l'apparecchiatura come nuova. Ogni apparecchiatura già censita
viene ripresentata come sconosciuta.

### Perché il meccanismo esistente non funziona

Un tentativo di normalizzazione esiste già in `src/utils/equipmentNormalizer.ts`: cerca il
match esatto case-insensitive e, fallendo quello, ripiega sulla RPC `search_equipment_fuzzy`.
**Quella RPC è rotta in produzione.** Invocata sul progetto di produzione risponde:

```
{"code":"42804",
 "message":"structure of query does not match function result type",
 "details":"Returned type timestamp with time zone does not match expected type
            timestamp without time zone in column 8."}
```

La dichiarazione `RETURNS TABLE` in
`supabase/migrations/20251113100000_enhance_equipment_catalog.sql:126` dichiara
`created_at TIMESTAMP` mentre la colonna è `TIMESTAMPTZ`. Ogni chiamata solleva
l'eccezione, quindi **ogni fuzzy match fallisce silenziosamente** e resta operativo solo il
confronto esatto — che su `SICC` contro `SICC S.p.A.` non scatta mai. Lo stesso vale per
`fuzzy_matches` nella risposta della edge function
(`supabase/functions/analyze-equipment-nameplate/index.ts:371-400`), che è sempre `[]`.

### Il catalogo reale

Rilevato dalla produzione il 2026-08-16: **1221 righe, 37 marche distinte**. Distribuzione
per tipo: Compressori 639, Serbatoi 182, Disoleatori 153, Essiccatori 121, Valvole di
sicurezza 76, Filtri 33, Separatori 9, Scambiatori 6.

Due fatti di dominio che governano l'intero design:

**1. I produttori cambiano ragione sociale, e a catalogo restano righe sotto entrambe.**

| famiglia | ragioni sociali a catalogo | righe |
|---|---|---|
| SICC | `SICC S.p.A.` · `SICC S.r.L.` · `SICC TECH s.r.l.` · `SICC TECH` | 38 · 38 · 39 · 1 |
| CECCATO | `CECCATO ARIA COMPRESSA S.R.L.` · `A.ARIA C S.r.l. (ABAC)` | 188 · 55 |

Lo stesso modello può esistere sotto più ragioni sociali della stessa azienda a seconda
dell'anno di fabbricazione: il compressore `FONOCOMPACT PRO 270 F6S` è a catalogo sia sotto
`CECCATO ARIA COMPRESSA S.R.L.` sia sotto `A.ARIA C S.r.l. (ABAC)`. I certificati riportano
sempre la ragione sociale completa, le targhette non sempre.

`CECCATO ARIA COMPRESSA` e `A.ARIA C` non condividono alcun carattere: nessuna misura di
somiglianza testuale potrà mai collegarle. **Serve una mappa esplicita di famiglie
produttore, scritta a mano.**

**2. Le stesse specs sotto ragioni sociali diverse sono indistinguibili.**
`SICC TECH s.r.l. / 500-12783` e `SICC S.p.A. / 500 - 12783` hanno entrambe volume 500,
PS 11, TS `-10 ÷ +120`. Nessun algoritmo può sceglierne una: casi come questo devono
finire davanti all'operatore, sempre.

### Decisione esplicita sull'anno

L'anno di fabbricazione **non** viene usato per discriminare fra ragioni sociali della stessa
famiglia, benché l'OCR lo legga. Gli anni di transizione non sono noti con certezza e
un'attribuzione automatica sbagliata è peggio di una domanda in più. Quando lo stesso modello
esiste sotto più ragioni sociali della stessa famiglia, decide l'operatore.

---

## Obiettivo

Interporre fra OCR e scrittura in cella uno stadio di matching col catalogo, con tre esiti:

- **A — trovato con certezza**: si applica la riga di catalogo, come se l'operatore
  l'avesse selezionata a mano dagli autocomplete.
- **B — più candidati o divergenza**: popup che mostra i candidati con il confronto
  campo per campo, l'operatore sceglie o li scarta tutti.
- **C — nessun candidato**: i campi si compilano coi dati letti, come oggi, e resta
  disponibile il «+» per aggiungere l'apparecchiatura a catalogo.

---

## Cosa cambia

### 1. `src/utils/equipmentMatcher.ts` — nuovo, funzione pura

```ts
matchEquipment(
  kind: EquipmentKind,
  datiOcr: OCRExtractedData,
  righe: EquipmentCatalogRow[]
): RisultatoMatch
```

Nessuna dipendenza da React o Supabase: riceve i dati letti e l'elenco delle righe del tipo,
restituisce l'esito. È il cuore testabile della funzionalità.

```ts
type RisultatoMatch =
  | { esito: 'certo';  candidato: Candidato }
  | { esito: 'ambiguo'; candidati: Candidato[]; motivo: MotivoAmbiguita }
  | { esito: 'nessuno' }

interface Candidato {
  riga: EquipmentCatalogRow
  simModello: number                 // 0..1
  marcaEsatta: boolean               // la targhetta dà la ragione sociale completa e combacia
  confronti: ConfrontoSpec[]         // per il popup: campo, valore catalogo, valore letto, esito
}

type MotivoAmbiguita =
  | 'piu_candidati'          // più righe compatibili
  | 'divergenza_specs'       // candidato unico, ma un dato letto contraddice il catalogo
  | 'somiglianza_incerta'    // modello nella fascia 0,60–0,85
  | 'ragione_sociale_altra'  // la targhetta dà una ragione sociale, il modello sta solo sotto un'altra della famiglia
```

### 2. Normalizzazione delle stringhe

Due livelli, entrambi nel matcher:

**Livello stretto** (ragione sociale conservata). Maiuscole, punti e spazi rimossi dalle
forme societarie, che si canonicalizzano a un token: `S.p.A.` = `SPA` = `S.P.A.` → `SPA`;
`s.r.l.` = `S.R.L.` = `Srl` → `SRL`; e così per `SAS`, `SNC`, `GMBH`, `SE`, `NV`,
`LTD`, `CO`. Le parentetiche restano ma non pesano: `A.ARIA C S.r.l. (ABAC)` → `A ARIA C SRL`.

**Livello famiglia** (forma societaria rimossa): `SICC S.p.A.` → `SICC`,
`SICC TECH s.r.l.` → `SICC TECH`, `A.ARIA C S.r.l. (ABAC)` → `A ARIA C`.

**Modelli**: maiuscole; separatori `-`, `–`, `/`, `_` e spazi multipli collassati a spazio
singolo. `500 - 12783`, `500-12783` e `500/12783` convergono tutti su `500 12783`.

### 3. Mappa delle famiglie produttore

Un file versionato `src/utils/marcheFamiglie.ts`, con le ragioni sociali **esattamente come
sono scritte a catalogo**:

```ts
export const FAMIGLIE_MARCHE: Famiglia[] = [
  { famiglia: 'SICC',    marche: ['SICC S.p.A.', 'SICC S.r.L.', 'SICC TECH s.r.l.', 'SICC TECH'] },
  { famiglia: 'CECCATO', marche: ['CECCATO ARIA COMPRESSA S.R.L.', 'A.ARIA C S.r.l. (ABAC)'] },
  { famiglia: 'FIAC',    marche: ['FIAC', 'FIAC AIR COMPRESSORS S.p.A.'] },
]
```

Le tre famiglie sopra sono quelle rilevabili dal catalogo attuale; le prime due sono
confermate dall'utente. Una marca che non compare in nessuna famiglia fa famiglia da sé.

Un test di coerenza verifica che ogni stringa elencata nella mappa esista davvero fra le
marche a catalogo — così un refuso, o una marca rinominata, emerge come test rosso invece di
degradare il matching in silenzio. Il test gira su una fixture, non sul database.

### 4. Selezione dei candidati

**Passo 1 — restringere per marca.** Se la marca letta, al livello stretto, combacia con una
o più ragioni sociali del tipo, si cerca **solo fra quelle**: una targhetta che dice
`SICC TECH s.r.l.` non fa nemmeno guardare le 76 righe SpA/S.r.L. Se non combacia con
nessuna — targhetta parziale, `SICC` e basta, oppure illeggibile — si allarga alla famiglia.
Se la marca non risolve alcuna famiglia, si cerca su tutto il tipo.

**Ripiego alla famiglia.** Quando la restrizione stretta ha selezionato delle righe ma
*nessuna* raggiunge la soglia di somiglianza sul modello, la ricerca si riapre sull'intera
famiglia. I candidati eventualmente trovati lì portano con sé il motivo
`ragione_sociale_altra` e non possono in nessun caso essere applicati in automatico: la
targhetta dichiara una ragione sociale e il modello risulta censito sotto un'altra, e questa
contraddizione va vista. Senza questo ripiego un catalogo incompleto produrrebbe un falso
esito «nessuno», riproponendo come nuova un'apparecchiatura già presente.

Nota conseguente: `SICC S.p.A.` e `SICC S.r.L.` differiscono **unicamente** per la forma
societaria, quindi al livello stretto restano entrambe selezionate e resteranno sempre
ambigue fra loro. `SICC TECH s.r.l.` è invece distinguibile.

**Passo 2 — somiglianza del modello.** Coefficiente di Dice sui trigrammi (la stessa misura
di `pg_trgm`, implementata in TypeScript), fra il modello letto normalizzato e quello di
ogni riga dell'insieme ristretto. Soglia di ingresso 0,60.

**Passo 3 — compatibilità tecnica.** Un candidato è *compatibile* se nessun dato tecnico
letto contraddice le sue specs. Un dato che l'OCR non ha letto non contraddice nulla: una
targhetta rovinata riduce la certezza, non produce esclusioni.

Corrispondenza fra campo letto e chiave di `specs`, per tipo (le chiavi `specs` sono quelle
già dichiarate in `specsMap`, `src/components/technicalSheet/table/equipmentConfig.ts:97-198`):

| tipo | `volume` letto → | `pressione_max` letto → | tolleranza |
|---|---|---|---|
| serbatoio, disoleatore, scambiatore, recipiente | `specs.volume` | `specs.ps` | volume esatto · PS ± 0,05 bar |
| compressore | *(non estratto dall'OCR)* | `specs.pressione_max` | PS ± 0,05 bar |
| essiccatore | *(non estratto)* | `specs.ps` | PS ± 0,05 bar |
| valvola | *(non estratto)* | `specs.ptar` da `diametro_pressione` | Ptar ± 0,05 bar |
| filtro, separatore | — | — | nessun discriminante tecnico |

La tolleranza sulla PS assorbe gli arrotondamenti di lettura, non le differenze reali:
11 e 11,5 restano valori diversi e producono divergenza.

**TS non entra mai nel confronto**: l'OCR non lo estrae (`schemaPerTipo`,
`supabase/functions/analyze-equipment-nameplate/index.ts:269-329`). Arriva sempre dal
catalogo, ed è uno dei campi che oggi restano da compilare a mano.

Nota di taratura: per **Compressori** — 639 righe, il tipo più affollato — il solo
discriminante tecnico è la PS, perché lo schema OCR del compressore non estrae il volume.
Lì il peso ricade quasi interamente sulla somiglianza del modello, ed è il tipo su cui le
soglie andranno verificate per primo sul campo.

### 5. Regola di decisione

Le tre condizioni si valutano **in quest'ordine**, e `ambiguo` è il ripiego generale: ogni
situazione che non soddisfa né `nessuno` né `certo` finisce davanti all'operatore. Non
esistono casi non coperti.

| ordine | esito | condizione |
|---|---|---|
| 1 | **nessuno** | nessun candidato con `simModello ≥ 0,60`, né nell'insieme ristretto né nel ripiego alla famiglia |
| 2 | **certo** | *tutte* le seguenti: un solo candidato compatibile · `simModello == 1` (modello identico dopo normalizzazione) · almeno un dato tecnico letto che lo conferma · nessuna divergenza · motivo diverso da `ragione_sociale_altra` |
| 3 | **ambiguo** | tutto il resto |

Il `motivo` allegato all'esito ambiguo serve a formulare il messaggio del popup e si sceglie
col primo criterio che si applica: `ragione_sociale_altra`, poi `divergenza_specs`, poi
`piu_candidati`, altrimenti `somiglianza_incerta`. Un candidato unico, compatibile e senza
divergenze ma con modello soltanto somigliante (`0,60 ≤ simModello < 1`) è ambiguo per
`somiglianza_incerta`: confermarlo costa un clic, applicarlo a torto costa una scheda
sbagliata.

I tipi senza discriminante tecnico (filtro, separatore) non possono raggiungere «certo» per
la clausola *«almeno un dato tecnico letto che lo conferma»*. È voluto: su quei tipi il
solo modello non basta a garantire l'identità, e un candidato unico si presenta comunque in
popup, dove confermarlo è un clic.

### 6. Il popup — `src/components/technicalSheet/EquipmentMatchDialog.tsx`

Nuovo componente che sostituisce `NormalizationSuggestionDialog`. In testa i dati letti
dalla targhetta, sotto i candidati (al massimo cinque, i migliori in cima), ognuno con la
ragione sociale **per esteso** e il confronto campo per campo:

```
Dalla targhetta:   SICC · 500-12783 · 500 L · 11 bar · matr. 4471 · 2003

○ SICC S.p.A.        500 - 12783    Volume 500 ✓   PS 11 ✓   TS -10 ÷ +120  (da catalogo)
○ SICC TECH s.r.l.   500-12783      Volume 500 ✓   PS 11 ✓   TS -10 ÷ +120  (da catalogo)

                                           [ Nessuno di questi ]  [ Usa selezionato ]
```

I valori divergenti si evidenziano col valore letto accanto (`PS 11 ✗ targhetta: 11,5`).
Quando il motivo è `ragione_sociale_altra`, un avviso in testa segnala la contraddizione:
la targhetta dichiara una ragione sociale, ma quel modello a catalogo esiste solo sotto
un'altra della stessa famiglia — o il catalogo è incompleto, o la lettura è errata.

«Nessuno di questi» ricade nel caso C.

Fuori scope, deciso esplicitamente: **non** si offre di agganciare un candidato tenendo i
valori letti. Chi sceglie un candidato prende quella riga per intero; se è il catalogo a
essere sbagliato, lo si corregge modificando la cella dopo, attraverso il flusso di
divergenza già esistente (`UpdateCatalogDialog`).

### 7. Applicazione della riga scelta (esito A, ed esito B dopo la scelta)

L'applicazione dev'essere **indistinguibile da una selezione fatta a mano** negli
autocomplete, altrimenti si ricrea il problema di partenza. Si riusa perciò
`selettoreCatalogo` (`src/components/technicalSheet/table/UnifiedEquipmentTable.tsx:594-605`),
che applica `specsMap` e — passaggio cruciale — registra l'origine con
`setOrigine(rowKey, { catalogItem, appliedSpecs })`.

Da quella registrazione discendono tre comportamenti che oggi non si verificano:

- il «+» *Aggiungi al catalogo* non compare (`EquipmentAutocomplete.tsx:204-240`);
- `useRowCatalogDivergence` sa da cosa misurare gli scostamenti se una cella viene poi
  modificata a mano;
- `usage_count` si incrementa sulla voce di catalogo.

Ripartizione dei dati applicati:

| dalla riga di catalogo | dalla targhetta |
|---|---|
| marca (ragione sociale completa), modello, Volume, PS, TS, categoria PED | numero di fabbrica, anno |

Numero di fabbrica e anno appartengono all'esemplare, non al modello, e vengono sempre dalla
targhetta.

**Da verificare in implementazione**: per Compressori e Valvole di sicurezza le specs
dipendono dalla variante di PS, normalmente scelta in `PressioneCatalogCell`. Il match
individua già la riga esatta, PS inclusa, quindi si applica quella riga e la cella deve
rispecchiarla senza riaprire la scelta della variante.

### 8. Il flusso batch

Il matching gira su ogni targhetta riconosciuta. Gli esiti A e C si applicano da soli; gli
esiti B si accumulano e, a OCR concluso, si presentano in coda — lo stesso
`EquipmentMatchDialog`, una scheda dopo l'altra, con l'indicazione del file in esame.

L'applicazione al form resta **un'unica riscrittura finale**, come oggi: prima si esaurisce
la coda, poi si scrive. Questo conserva intatto il `reset` con codici normalizzati di
`TechnicalSheetForm.tsx:492`, che è delicato e non viene toccato. Chiudere la coda a metà
equivale a «nessuno di questi» per le ambiguità rimaste: campi compilati dai dati letti,
nulla va perso.

In questo blocco **il nome del file continua a determinare la destinazione** (`S1.jpg` → il
record con codice S1). Rimuovere quel vincolo è oggetto del blocco 2.

Il riepilogo finale — oggi un `alert()`, `TechnicalSheetForm.tsx:496-506` — guadagna il
conteggio delle apparecchiature agganciate a catalogo.

### 9. Codice da rimuovere

Sostituito integralmente dal nuovo matcher:

- `src/utils/equipmentNormalizer.ts` (intero file)
- `src/components/technicalSheet/NormalizationSuggestionDialog.tsx` (intero file)
- `equipmentCatalogApi.searchFuzzy` (`src/services/api/equipmentCatalog.ts:205`)
- `searchFuzzyMatches` e il campo `fuzzy_matches` nella edge function
  (`supabase/functions/analyze-equipment-nameplate/index.ts:174, 371-400`)
- `normalizeEquipment` e `requiresNormalizationConfirmation` in `useOCRAnalysis.ts`
- migrazione che esegue `DROP FUNCTION search_equipment_fuzzy(TEXT, equipment_catalog_type, INTEGER)`

La RPC viene eliminata anziché riparata: con il matching lato client non ha più consumatori.

---

## Test

Vitest su `equipmentMatcher`, con righe di catalogo **vere** copiate come fixture dalla
produzione (le quattro ragioni sociali SICC, la coppia CECCATO/A.ARIA C con il
`FONOCOMPACT PRO 270 F6S` presente sotto entrambe). Le fixture sono statiche: i test non
interrogano il database.

| caso | atteso |
|---|---|
| `SICC TECH s.r.l.` + modello esatto + volume e PS confermati | **certo**, riga TECH |
| `SICC` + `500-12783` + 500 L + 11 bar | **ambiguo** `piu_candidati`, due candidati SpA e TECH |
| candidato unico ma PS letta 11,5 contro 11 a catalogo | **ambiguo** `divergenza_specs` |
| `SICC TECH s.r.l.` con modello presente solo sotto `SICC S.p.A.` | **ambiguo** `ragione_sociale_altra` |
| candidato unico, compatibile, senza divergenze, ma `simModello` 0,9 | **ambiguo** `somiglianza_incerta` (mai `certo`) |
| tipo senza discriminante tecnico (filtro), candidato unico e modello identico | **ambiguo**, mai `certo` |
| `A.ARIA C` + `FONOCOMPACT PRO 270 F6S` | candidati da entrambe le ragioni sociali CECCATO |
| marca fuori catalogo | **nessuno** |
| solo il modello leggibile, marca vuota | candidati cercati su tutto il tipo |
| `500-12783` contro `500 - 12783` a catalogo | stessa somiglianza del confronto identico |
| PS letta 11,02 contro 11 a catalogo | compatibile (dentro tolleranza) |
| mappa famiglie: ogni marca elencata esiste a catalogo | verde |

Collaudo sul campo dopo il rilascio, su targhette reali non usate per i test: è l'unico
passaggio che verifica che l'OCR legga davvero ciò che i test presuppongono.

---

## Fuori scope

- **Blocco 2** — eliminazione del vincolo «nome file = codice apparecchiatura» nel batch,
  con deduzione di tipo e destinazione. Spec separata, successiva; riuserà questo matcher,
  perché il catalogo è il segnale più affidabile per dedurre il tipo.
- **Bonifica del catalogo** — `SICC TECH` (1 riga) è quasi certamente un refuso di
  `SICC TECH s.r.l.` (39 righe), e righe con specs identiche sotto ragioni sociali diverse
  resteranno per sempre ambigue. Il matching le rende *visibili*, il che è utile; ripulirle
  è lavoro di bonifica dati, separato.
- **`PhotoUploadSection.tsx`** — già oggi codice morto, non importato da alcun modulo,
  benché chiami la stessa edge function. Segnalato, non toccato.
