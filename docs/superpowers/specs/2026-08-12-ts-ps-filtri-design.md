# PS e TS sul Filtro (F1–F8)

## Contesto

Nella scheda dati DM329, il tipo "Filtro" (F1–F8, prefiltro o filtro di linea) non porta oggi
alcun dato tecnico proprio: né PS, né TS, né capacità. `EQUIPMENT_DEFS.filtro`
(`src/components/technicalSheet/table/equipmentConfig.ts:154-163`) dichiara
`pressioneField` assente e `ts: false`, e la riga generata in relazione tecnica esce sempre
con pressione e temperatura vuote (`src/services/relazione/engine/caratteristiche.ts:122-130`).

Questi dati esistono già, ma solo sul figlio opzionale "Recipiente filtro" — la riga che
descrive il corpo a pressione del filtro quando ne ha uno separato dall'elemento filtrante.
Se un filtro non ha un Recipiente filtro associato (es. filtro monoblocco già in pressione),
oggi non c'è modo di dichiararne PS e TS, e la sua riga in relazione tecnica non porta
quei dati.

L'obiettivo è aggiungere PS e TS anche al Filtro stesso, con la stessa esperienza già
offerta per Serbatoi/Disoleatori — inclusa l'integrazione col catalogo apparecchiature
(selezione marca+modello che propone le varianti di pressione già censite) — ma **opzionali**:
a differenza degli altri recipienti, dove PS è un dato obbligatorio, per il Filtro non deve
mai risultare "incompleto" per la loro assenza, né in scheda dati né nell'audit del catalogo.

Il Recipiente filtro resta invariato: i due tipi restano distinti, ciascuno con i propri PS/TS.

## Cosa cambia

### 1. Indice unico a catalogo (migrazione database)

Oggi "Filtri" è compreso nell'indice `equipment_catalog_unique_senza_pressione`
(univoco su tipo+marca+modello — nessuna variante di pressione ammessa per lo stesso
modello), definito in `supabase/migrations/20260805000000_equipment_catalog_variante_ps.sql`.
Per poter registrare a catalogo più varianti di pressione dello stesso modello di filtro,
"Filtri" deve passare all'indice `equipment_catalog_unique_ps` (univoco su
tipo+marca+modello+PS, con lo stesso `COALESCE(specs->>'ps', specs->>'pressione', '')`
già usato da Serbatoi/Disoleatori/Essiccatori/Scambiatori/Recipienti filtro).

Nuova migrazione che:
- ricrea `equipment_catalog_unique_ps` includendo `'Filtri'` nella lista dei tipi;
- ricrea `equipment_catalog_unique_senza_pressione` escludendo `'Filtri'` (restano solo
  `'Separatori', 'Altro'`).

Preflight preventivo: verificare che non ci siano collisioni (stesso tipo+marca+modello
con PS diverse già presenti come righe distinte) prima di applicare — impossibile oggi
perché l'indice attuale lo impedirebbe già, quindi il preflight è solo una verifica di
sicurezza formale.

### 2. Catalogo apparecchiature — `src/services/equipmentAudit/specsNormalization.ts`

- `CANONICAL_SPECS.Filtri`: da `[]` a `[PS opzionale, TS]`, dove PS è la stessa definizione
  condivisa (`isVariantKey: true, isSheetPressure: true`) ma con `required: false` (a
  differenza di `RECIPIENTE_SPECS`, dove PS è obbligatoria) — serve una costante separata
  dalla `PS` condivisa, non una sua modifica in-place, perché resta obbligatoria per gli
  altri tipi.
- `LEGACY_SPEC_MAP.Filtri` e `FORM_TO_CANONICAL.Filtri`: da `{}` alle stesse mappe già usate
  da Serbatoi (`ps_pressione_max`→`ps`, `ts`/`ts_temperatura`→`ts`).

Questo, da solo, abilita automaticamente per il tipo "Filtri" nel catalogo admin: campi
PS/TS nel form "Nuova apparecchiatura"/"Modifica", chip riassuntivi in tabella, validazione
Zod (`specsSchemaFor`) — tutta l'infrastruttura del catalogo (`EquipmentFormFields`,
`EquipmentCatalogTable`, `equipmentCatalogValidation.ts`) è generica e guidata da
`CANONICAL_SPECS`, senza liste di tipi hardcoded da aggiornare altrove.

L'audit di coerenza del catalogo (`missingCanonicalSpecs`) non segnalerà più righe Filtri
come incomplete per PS/TS mancanti, perché `required: false`.

### 3. Scheda dati — `src/types/technicalSheet.ts`

Estendere l'interfaccia `Filtro` (righe 262-272) con:
```ts
ps_pressione_max?: number // PS (bar) - opzionale, non conta ai fini della completezza
ts_temperatura?: number   // TS (°C) legacy - opzionale
ts?: string                // TS libero, precompilato da catalogo - opzionale
```

### 4. Tabella unica — `src/components/technicalSheet/table/equipmentConfig.ts`

- Nuovo campo su `EquipmentTypeDef`: `pressioneTsOpzionali?: boolean` — quando `true`, PS e
  TS restano colonne visibili e compilabili ma non contano nel denominatore di completezza
  della riga.
- `EQUIPMENT_DEFS.filtro`: aggiungere `pressioneField: 'ps_pressione_max'`, `ts: true`,
  `specsMap: { ps: 'ps_pressione_max', ts: 'ts' }`, `adv: ['pressione', 'ts']` (nascosti a
  `tecnicoDM329`, come sugli altri recipienti), `pressioneTsOpzionali: true`.
- `cat`, `autoPed`, `capacitaField` restano invariati (nessuna categoria PED né capacità sul
  Filtro: non richieste, restano solo sul Recipiente filtro).

Nessuna modifica necessaria a `useCellePrincipali.tsx`: la cella PS diventa automaticamente
`PressioneCatalogCell` (cascata a catalogo) invece di `NumberCell`, perché
`variantSpecKey('Filtri')` non è più `null` una volta aggiunta la definizione PS a
`CANONICAL_SPECS.Filtri` — la logica è già generica.

### 5. Completezza — `src/utils/schedaCompleteness.ts`

`completezzaRiga` (righe 141, 143): la conta di PS/TS diventa condizionata anche
all'assenza del flag:
```ts
if (def.pressioneField && !def.pressioneTsOpzionali) q.campo('PS', campo(def.pressioneField))
if (def.ts && !def.pressioneTsOpzionali) q.campo('TS', campo('ts'))
```

### 6. Relazione tecnica — `src/services/relazione/engine/caratteristiche.ts`

La riga "Filtro" (righe 122-130), oggi con `pressione`/`temperatura` sempre vuote, legge i
nuovi campi:
```ts
pressione: formatNumberIT(f.ps_pressione_max),
temperatura: formatTemperatura(TEMP_MIN_RECIPIENTE, f.ts, f.ts_temperatura),
```
riusando la costante `TEMP_MIN_RECIPIENTE` (-10°C) già in uso per gli altri recipienti —
stessa convenzione, nessuna nuova costante. `capacita` e `categoria` restano stringa vuota
(il Filtro non ha volume né categoria PED propri).

Il Recipiente filtro, quando presente, continua a generare la propria riga separata subito
sotto, come oggi.

## Fuori scope

- Capacità/volume e categoria PED sul Filtro: non richiesti, non aggiunti.
- Qualsiasi modifica al Recipiente filtro o alla tabella "esiti DM329"
  (`src/services/relazione/engine/esiti.ts`), che non referenzia il Filtro.
- La riga "categoria" del Recipiente filtro in `caratteristiche.ts:138`, sempre vuota a
  differenza degli altri recipienti: comportamento preesistente, non toccato da questo lavoro.

## Rischio principale

La migrazione dell'indice unico è l'unico cambiamento con effetto diretto sui dati di
produzione. Va applicata con lo stesso schema difensivo delle migrazioni precedenti su
questa tabella (preflight di verifica prima del `DROP INDEX` / `CREATE UNIQUE INDEX`,
transazione singola).
