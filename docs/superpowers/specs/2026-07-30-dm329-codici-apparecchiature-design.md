# Codici apparecchiature DM329: identità stabile

**Data:** 2026-07-30
**Stato:** approvato, da implementare

## Problema

Nella scheda dati DM329 il codice mostrato in tabella e il codice memorizzato nel record possono divergere.

`UnifiedEquipmentTable` calcola il codice dalla posizione nell'array
(`generateEquipmentCode('S', i + 1)`), mentre il campo `codice` del record viene scritto una sola
volta, all'`append`, e non viene mai rinumerato. Eliminando S1, l'ex S2 scala in prima posizione e
viene mostrato come «S1» pur restando `codice: 'S2'` nei dati. Il percorso di salvataggio
riscrive `equipment_data` così com'è, senza normalizzazioni.

Conseguenza: la relazione tecnica stampa i codici memorizzati, quindi diversi da quelli visti a
schermo, e i legami per codice possono puntare a un codice ora attribuito a un'altra
apparecchiatura.

### Riferimenti per codice esistenti

| Riferimento | Posizione |
|---|---|
| `compressore_associato`, `essiccatore_associato`, `filtro_associato` | `equipment_data`, array figli |
| `codice` dei figli, nella forma `${padre}.1` | derivato all'append, mai riderivato |
| `collegamentiCompressoriSerbatoi` | `additional_info` — codici sia come chiavi sia come valori |
| `compressoriGiri` | `additional_info` — codici come chiavi |
| `spessimetrica` | `additional_info` — array di codici, inclusi i figli (`C1.1`) |
| `posizioni_compressori_spessimetrati` | colonna `text` dedicata |

`posizioni_compressori_spessimetrati` resta fuori dall'intervento: è vuota in tutte le 354 righe e
nessun percorso del codice la legge o la scrive. Va trattata come colonna abbandonata, non come
riferimento attivo.

### Stato dei dati di produzione

Verificato su `dm329_technical_data` (354 righe) il 2026-07-30:

```
apparecchiature totali:  44   (in 15 schede; le altre 339 sono vuote)
in sequenza:             35
codice null:              9   (2 schede)
fuori sequenza:           0
```

Nessuna scheda ha codici fuori sequenza: il difetto è latente, non si è ancora manifestato.
Le anomalie presenti sono di natura diversa — codici mai assegnati:

- `e642f56e-5dd6-4b63-9788-57bfe2bef407`: 2 compressori, 1 serbatoio, 2 filtri con `codice: null`
- `81e04b73-2aa7-427d-b7e8-397f45660ba0`: 3 compressori, 1 essiccatore con `codice: null`, più un
  disoleatore con `codice: "undefined.1"` e `compressore_associato: null`

Origine: `handleBatchOCRComplete` costruisce i record senza il campo `codice` e riempie i buchi con
`{}`. Il campo `codice` ha oggi due produttori e uno dei due non lo produce.

## Decisioni

1. **Identità stabile.** Il codice appartiene all'apparecchiatura: eliminando S2 da S1/S2/S3, l'ex
   S3 resta S3. La tabella smette di calcolare dall'indice e mostra il codice memorizzato.
   La relazione stampa `S1, S3`.
2. **Nuovi codici: buco più basso.** Con S1 e S3 presenti, una nuova apparecchiatura riceve S2. I
   codici restano sempre entro `1..max` di `EQUIPMENT_LIMITS`.
3. **Tabelle per-tipo legacy: intatte.** `SerbatoiTable`, `CompressoriTable`, `EssiccatoriTable`,
   `FiltriTable`, `SeparatoriTable` contengono lo stesso pattern indice-derivato ma sono codice
   morto: raggiungibili solo dagli export di `AllEquipmentSections` che nessuno monta (il form usa
   `UnifiedEquipmentTable`; di `AllEquipmentSections` si importa solo `AltriApparecchiSection`).
   Restano fuori da questo intervento, con task separato per la rimozione.

## Progetto

### Modello

Il `codice` è il dato; l'indice dell'array è solo posizione. Nessun id interno separato: in un
modello posizionale il codice *è* l'identificatore.

### `src/utils/equipmentCodes.ts` (nuovo)

Unico proprietario della logica dei codici.

| Funzione | Comportamento |
|---|---|
| `compareCodes(a, b)` | ordine naturale: `S1 < S2 < S10`, `S1 < S1.1` |
| `nextFreeCode(prefix, existing, max)` | numero libero più basso in `1..max`; `null` se pieno |
| `childCode(parentCode)` | `${parentCode}.1` — derivato, non memorizzato in modo indipendente |
| `normalizeSchedaCodes(scheda)` | idempotente: scorre ogni array nell'ordine in cui si trova e assegna a ogni record privo di codice valido il numero libero più basso, ripara i figli (`undefined.1` riderivato dal padre), risolve i duplicati conservando il primo. Ritorna `{ scheda, changed }` |
| `collectCodes(scheda)` | insieme di tutti i codici validi presenti nella scheda |
| `pruneAdditionalInfo(info, codes)` | rimuove chiavi e valori che non corrispondono a codici esistenti; ritorna `{ info, dropped }` |

`normalizeSchedaCodes` deve essere idempotente: applicata due volte produce lo stesso risultato.
È il presupposto perché possa girare a ogni caricamento senza effetti cumulativi.

### `UnifiedEquipmentTable`

- Il codice arriva dal record, non da `generateEquipmentCode(prefix, i + 1)`. Si legge via
  `useWatch` sull'array e non da `fields` di `useFieldArray`, così resta corretto anche dopo un
  `setValue` esterno (per esempio dopo il batch OCR).
- Le righe di ogni gruppo si ordinano con `compareCodes`. Serve perché un S2 rigenerato viene
  appeso in coda all'array e altrimenti comparirebbe dopo S3. L'ordine dei gruppi
  (serbatoi, compressori, essiccatori, filtri, separatori) non cambia.
- Il `base` passato a React Hook Form resta l'indice reale dell'array, così come `equipmentIndex`
  per l'OCR: l'ordinamento riguarda solo la resa.
- `addNew` usa `nextFreeCode` invece di `fields.length + 1`. Con identità stabile
  `fields.length + 1` collide: con S1/S2/S3, eliminato S2, la lunghezza è 2 e genererebbe un S3 già
  esistente.
- La voce di menu di un tipo si disabilita quando il tipo è al `max`. Applica l'invariante «i
  codici stanno sempre entro `1..max`», che oggi la tabella unificata non impone.
- Le ricerche dei figli (`compressore_associato === code`) continuano a confrontare il codice
  memorizzato del padre, che ora è stabile.

### `TechnicalDetails`

Nel caricamento, `parsedData` passa attraverso `normalizeSchedaCodes`; se `changed`, si persiste
subito. Ripara le 2 schede con codici nulli alla prima apertura e qualunque scrittura futura priva
di codice.

### `TechnicalSheetForm` — batch OCR

`handleBatchOCRComplete` assegna `codice` a ogni record creato e non lascia più buchi `{}` privi di
codice. Chiude il secondo produttore di codici mancanti.

### Igiene di `additional_info`

`additional_info` vive in una colonna separata e viene redatta nel `RelazioneDataDialog`, che già
rideriva le opzioni dalla scheda a ogni apertura ma poi risalva lo stato grezzo: le voci obsolete
sopravvivono e vengono riscritte.

- All'apertura: prune contro l'insieme dei codici correnti, con avviso in linea che elenca i
  collegamenti scartati.
- In `handleGenera`: si persiste il solo oggetto ripulito.
- `buildRelazioneModel`: ignora in modo difensivo i riferimenti a codici sconosciuti.

La pulizia non viene agganciata all'eliminazione né al salvataggio della scheda. L'autosave ha un
debounce di 120 secondi che si azzera a ogni modifica, quindi non sarebbe tempestivo; e scrivere su
`additional_info` mentre la scheda è ancora non salvata introdurrebbe un'incoerenza peggiore di
quella che risolve. Il dialog è comunque passaggio obbligato prima di generare il documento.

### Rischio residuo

Con il riempimento dei buchi un codice liberato torna disponibile: un collegamento redatto per il
vecchio S2 apparirà agganciato al nuovo S2. Il prune non può distinguere i due casi, perché in un
modello posizionale l'informazione che li separa non esiste. La mitigazione è che il dialog mostra
ogni collegamento per riconferma prima della generazione: è una mitigazione, non una garanzia. È il
prezzo della scelta di mantenere i codici entro `1..max`.

## Bonifica dati

SQL una tantum sulle 2 schede citate:

- `e642f56e`: compressori → `C1`, `C2`; serbatoio → `S1`; filtri → `F1`, `F2`
- `81e04b73`: compressori → `C1`, `C2`, `C3`; essiccatore → `E1`; disoleatore →
  `codice: 'C3.1'`, `compressore_associato: 'C3'`

L'attribuzione del disoleatore è determinata, non indovinata: il terzo compressore è l'unico con
`ha_disoleatore: true`.

La normalizzazione al caricamento coprirebbe comunque questi casi; la migrazione rende il database
coerente senza dipendere dall'apertura delle schede.

## Test

Vitest sulla sola logica, secondo le convenzioni del progetto (nessun test di interfaccia):

- `nextFreeCode`: buco intermedio, insieme vuoto, tipo al massimo
- `compareCodes`: ordine naturale oltre il 9, sotto-codici
- `normalizeSchedaCodes`: idempotenza, backfill dei nulli, riparazione di `undefined.1`, duplicati
- `pruneAdditionalInfo`: scarta gli sconosciuti, conserva i validi, riporta gli scartati

## File toccati

| File | Natura |
|---|---|
| `src/utils/equipmentCodes.ts` | nuovo |
| `src/utils/__tests__/equipmentCodes.test.ts` | nuovo |
| `src/components/technicalSheet/table/UnifiedEquipmentTable.tsx` | codice memorizzato, ordinamento, `nextFreeCode`, limite max |
| `src/components/technicalSheet/TechnicalSheetForm.tsx` | batch OCR assegna i codici |
| `src/pages/TechnicalDetails.tsx` | normalizzazione al caricamento |
| `src/components/relazione/RelazioneDataDialog.tsx` | prune all'apertura e al salvataggio, avviso |
| migrazione SQL | bonifica delle 2 schede |
