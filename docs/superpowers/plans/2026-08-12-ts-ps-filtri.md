# PS e TS sul Filtro (F1–F8) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere PS e TS al tipo "Filtro" (F1–F8) della scheda dati DM329, con piena parità
d'esperienza rispetto a Serbatoi/Disoleatori (integrazione col catalogo apparecchiature,
cascata delle varianti di pressione, comparsa nella relazione tecnica) ma come dati
**opzionali**, esclusi dal conteggio di completezza sia in scheda dati sia nell'audit del
catalogo.

**Architecture:** Il sistema è già interamente guidato da due contratti dichiarativi:
`CANONICAL_SPECS` (catalogo apparecchiature, in `specsNormalization.ts`) e `EQUIPMENT_DEFS`
(tabella unica scheda dati, in `equipmentConfig.ts`). Estendendo queste due dichiarazioni con
le nuove definizioni PS/TS per "Filtri", tutta l'infrastruttura generica a valle (form del
catalogo, chip, validazione Zod, cascata varianti, confronto scheda↔catalogo, calcolo di
completezza) si aggiorna automaticamente, senza toccare quel codice. Le uniche modifiche non
derivate sono: l'aggiunta dei tre campi all'interfaccia `Filtro`, un nuovo flag
`pressioneTsOpzionali` che disaccoppia "il campo esiste" da "il campo è conteggiato" nel
motore di completezza, e la lettura dei nuovi campi nella riga "Filtro" della relazione
tecnica.

**Tech Stack:** TypeScript, Zod, Vitest, Supabase Postgres (migrazione SQL via Management API).

## Global Constraints

- PS e TS sul Filtro sono **opzionali**: non devono mai comparire come "mancanti" nel
  calcolo di completezza della scheda dati, né rendere una voce di catalogo "Filtri"
  incompleta nell'audit del catalogo.
- Capacità/volume e categoria PED **non** vanno aggiunti al Filtro: restano solo sul
  Recipiente filtro, che resta invariato.
- Nessun test di UI (React Testing Library) va aggiunto: per convenzione di questo repo
  (`CLAUDE.md`) i test coprono solo logica di workflow, validazioni e calcoli.
- Ogni file toccato che ha già una suite Vitest va lasciato verde: gli assert che
  presupponevano il vecchio comportamento di "Filtri" (nessuna variante di pressione, nessun
  dato tecnico) vanno aggiornati, non cancellati — spostando l'esempio "tipo senza dati
  tecnici" su un tipo che li ha ancora davvero vuoti (`Separatori`).

---

## File Structure

| File | Ruolo |
|---|---|
| `supabase/migrations/20260812000000_equipment_catalog_filtri_ps.sql` | Nuovo. Sposta `'Filtri'` dall'indice unico "senza pressione" a quello "con PS". |
| `src/services/equipmentAudit/specsNormalization.ts` | Modifica. `CANONICAL_SPECS.Filtri` e `FORM_TO_CANONICAL.Filtri` da vuoti a PS(opzionale)+TS. |
| `src/services/equipmentAudit/__tests__/specsNormalization.test.ts` | Modifica. Aggiorna 3 assert che presupponevano `Filtri` senza varianti; aggiunge un blocco di test dedicato. |
| `src/types/technicalSheet.ts` | Modifica. Estende l'interfaccia `Filtro` con `ps_pressione_max`, `ts_temperatura`, `ts`. |
| `src/components/technicalSheet/table/equipmentConfig.ts` | Modifica. Nuovo flag `pressioneTsOpzionali` su `EquipmentTypeDef`; `EQUIPMENT_DEFS.filtro` guadagna `pressioneField`, `ts`, `specsMap`, `adv`, `pressioneTsOpzionali`. |
| `src/utils/schedaCompleteness.ts` | Modifica. `completezzaRiga` rispetta il nuovo flag. |
| `src/utils/__tests__/schedaCompleteness.test.ts` | Modifica. Nuovo test che verifica l'esclusione dal conteggio. |
| `src/services/relazione/engine/caratteristiche.ts` | Modifica. La riga "Filtro" legge PS/TS invece di stringhe vuote fisse. |
| `src/services/relazione/__tests__/caratteristiche.test.ts` | Modifica. Nuovo blocco di test; aggiunge `makeFiltro` agli import. |
| `src/utils/__tests__/equipmentCatalogValidation.test.ts` | Modifica. Sposta l'esempio "tipo senza dati tecnici" su `Separatori`; aggiunge test per lo schema PS/TS di `Filtri`. |
| `src/utils/__tests__/equipmentSpecsComparison.test.ts` | Modifica. Stesso spostamento; aggiunge test sul confronto scheda↔catalogo per `Filtri`. |

Nessun file nuovo lato applicazione (solo la migrazione SQL è un file nuovo). Nessuna
modifica a componenti React: le celle della tabella unica (`useCellePrincipali.tsx`) sono già
generiche rispetto a `pressioneField`/`ts` e non richiedono modifiche.

---

### Task 1: Migrazione database — indice unico PS per "Filtri"

**Contesto:** oggi "Filtri" vive nell'indice `equipment_catalog_unique_senza_pressione`
(univoco su tipo+marca+modello — una sola riga per modello, nessuna pressione ammessa nella
chiave). Verificato in produzione il 2026-08-12 che l'indice reale coincide esattamente con
`supabase/migrations/20260805000000_equipment_catalog_variante_ps.sql`, e che non esistono
oggi righe `Filtri` attive duplicate su marca+modello (query di preflight già eseguita,
risultato vuoto). "Filtri" deve passare all'indice `equipment_catalog_unique_ps` (univoco su
tipo+marca+modello+PS), per poter registrare più varianti di pressione dello stesso modello,
come già avviene per Serbatoi/Disoleatori/Essiccatori/Scambiatori/Recipienti filtro.

**Files:**
- Create: `supabase/migrations/20260812000000_equipment_catalog_filtri_ps.sql`

**Interfaces:**
- Produces: l'indice `equipment_catalog_unique_ps` copre anche `'Filtri'`; l'indice
  `equipment_catalog_unique_senza_pressione` resta solo per `'Separatori'` e `'Altro'`. Nessuna
  interfaccia TypeScript coinvolta — è un vincolo del database che rende possibile il resto
  del lavoro (una riga di catalogo "Filtri" con `specs.ps` valorizzata due volte a pressioni
  diverse deve essere ammessa; due volte alla stessa pressione no).

- [ ] **Step 1: Preflight — riconferma nessuna collisione**

Da eseguire manualmente prima di applicare (il preflight è già stato eseguito una volta in
fase di pianificazione; va ripetuto immediatamente prima di applicare, per sicurezza contro
scritture avvenute nel frattempo):

```bash
cd "c:\Users\FrancescoBertin\Desktop\CLAUDE CODE\OFF-TICKET_UT"
set -a && source .env.local && set +a
PROJECT_REF=$(echo "$VITE_SUPABASE_URL" | sed -E 's#https://([^.]+)\.supabase\.co#\1#')
curl -s "https://api.supabase.com/v1/projects/$PROJECT_REF/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"SELECT marca, modello, count(*) FROM equipment_catalog WHERE tipo_apparecchiatura = '\''Filtri'\'' AND is_active GROUP BY 1,2 HAVING count(*) > 1;"}'
```

Expected: `[]` (nessuna riga). Se non è vuoto, fermarsi: significa che nel frattempo sono
state inserite righe duplicate che l'indice attuale avrebbe dovuto impedire — non applicare
la migrazione senza prima capire come sono comparse.

- [ ] **Step 2: Scrivere il file di migrazione**

```sql
-- "Filtri" guadagna PS e TS: da indice univoco su (tipo, marca, modello) a uno che ammette
-- più varianti di pressione dello stesso modello, come già per Serbatoi, Disoleatori,
-- Essiccatori, Scambiatori e Recipienti filtro (20260805000000_equipment_catalog_variante_ps.sql).
--
-- Preflight eseguito il 2026-08-12 su tutte le righe attive di tipo 'Filtri': nessuna
-- collisione (l'indice attuale già impedirebbe due righe identiche su marca+modello).
--   SELECT marca, modello, count(*)
--   FROM equipment_catalog
--   WHERE tipo_apparecchiatura = 'Filtri' AND is_active
--   GROUP BY 1, 2 HAVING count(*) > 1;
-- Risultato: nessuna riga.

BEGIN;

DROP INDEX IF EXISTS equipment_catalog_unique_ps;
CREATE UNIQUE INDEX equipment_catalog_unique_ps
  ON equipment_catalog (
    tipo_apparecchiatura, marca, modello,
    (COALESCE(specs ->> 'ps', specs ->> 'pressione', ''))
  )
  WHERE tipo_apparecchiatura IN
        ('Serbatoi', 'Disoleatori', 'Essiccatori', 'Scambiatori', 'Recipienti filtro', 'Filtri')
    AND is_active = true;

DROP INDEX IF EXISTS equipment_catalog_unique_senza_pressione;
CREATE UNIQUE INDEX equipment_catalog_unique_senza_pressione
  ON equipment_catalog (tipo_apparecchiatura, marca, modello)
  WHERE tipo_apparecchiatura IN ('Separatori', 'Altro')
    AND is_active = true;

COMMIT;
```

Salvare in `supabase/migrations/20260812000000_equipment_catalog_filtri_ps.sql`.

- [ ] **Step 3: Applicare al database remoto**

```bash
node scripts/apply-migration.mjs supabase/migrations/20260812000000_equipment_catalog_filtri_ps.sql
```

Expected output: `✅ Migration applicata con successo.`

- [ ] **Step 4: Verificare il risultato**

```bash
set -a && source .env.local && set +a
PROJECT_REF=$(echo "$VITE_SUPABASE_URL" | sed -E 's#https://([^.]+)\.supabase\.co#\1#')
curl -s "https://api.supabase.com/v1/projects/$PROJECT_REF/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"SELECT indexname, indexdef FROM pg_indexes WHERE tablename = '\''equipment_catalog'\'' AND indexname LIKE '\''equipment_catalog_unique%'\'' ORDER BY indexname;"}'
```

Expected: `equipment_catalog_unique_ps` include `'Filtri'` nel suo `WHERE`;
`equipment_catalog_unique_senza_pressione` include solo `'Separatori'` e `'Altro'`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260812000000_equipment_catalog_filtri_ps.sql
git commit -m "feat(dm329): sposta Filtri nell'indice unico con variante di pressione"
```

---

### Task 2: Catalogo apparecchiature — PS/TS opzionali per "Filtri"

**Files:**
- Modify: `src/services/equipmentAudit/specsNormalization.ts:83-154, 181-237` (per riferimento — le righe esatte da toccare sono indicate nei diff sotto)
- Test: `src/services/equipmentAudit/__tests__/specsNormalization.test.ts`

**Interfaces:**
- Consumes: `CanonicalSpecDef`, `PS`, `TS` (costanti già definite in `specsNormalization.ts:83-90`).
- Produces: `CANONICAL_SPECS.Filtri` → `[PS_OPZIONALE, TS]` dove `PS_OPZIONALE` è come `PS` ma
  con `required: false`. `FORM_TO_CANONICAL.Filtri` → `{ ps_pressione_max: 'ps', ts: 'ts',
  ts_temperatura: 'ts' }`. Da questo momento `variantSpecKey('Filtri')` restituisce `'ps'` (non
  più `null`), e questo è ciò che a valle abilita automaticamente la cascata di catalogo sulla
  colonna PS del Filtro (Task 4).

- [ ] **Step 1: Aggiornare gli assert del test esistente che presupponevano "Filtri" senza varianti**

In `src/services/equipmentAudit/__tests__/specsNormalization.test.ts`, tre assert oggi
verificano che "Filtri" non abbia una chiave di variante — comportamento che stiamo per
cambiare deliberatamente. Vanno aggiornati per riflettere il nuovo comportamento, spostando
l'esempio "tipo senza variante" su `Separatori` (che resta vuoto):

Riga 156-163, blocco `describe('chiave di variante', ...)`, primo `it`:
```ts
  it('individua la chiave che distingue le varianti di un modello', () => {
    expect(variantSpecKey('Compressori')).toBe('pressione_esercizio')
    expect(variantSpecKey('Valvole di sicurezza')).toBe('ptar')
    expect(variantSpecKey('Serbatoi')).toBe('ps')
    expect(variantSpecKey('Filtri')).toBe('ps')
    expect(variantSpecKey('Separatori')).toBeNull()
    expect(variantSpecKey(null)).toBeNull()
  })
```

Riga 185-190, ultimo `it` dello stesso `describe`:
```ts
  it('restituisce null se il tipo non ha varianti o il dato manca', () => {
    expect(readVariantValue('Serbatoi', { ps: 11 })).toBe(11)
    expect(readVariantValue('Separatori', { ps: 11 })).toBeNull()
    expect(readVariantValue('Compressori', { fad: 2000 })).toBeNull()
    expect(readVariantValue('Compressori', null)).toBeNull()
  })
```

Riga 215-219, ultimo `it` di `describe('pressione dichiarata dalla scheda dati', ...)`:
```ts
  it('senza pressioni, o su un tipo che non ne ha, è null', () => {
    expect(readSheetPressure('Compressori', { fad: 2000 })).toBeNull()
    expect(readSheetPressure('Separatori', { ps: 11 })).toBeNull()
    expect(readSheetPressure(null, { ps: 11 })).toBeNull()
  })
```

- [ ] **Step 2: Aggiungere il blocco di test per il nuovo comportamento di "Filtri"**

In coda al file (dopo il blocco `describe('pressione_esercizio resta operativa pur essendo interna', ...)`), aggiungere:

```ts
describe('Filtri — PS opzionale, a parità con gli altri recipienti', () => {
  it('ha una chiave di variante come i recipienti, ma non è obbligatoria', () => {
    expect(variantSpecKey('Filtri')).toBe('ps')
    expect(missingCanonicalSpecs('Filtri', {}).map(d => d.key)).toEqual([])
  })

  it('legge PS come pressione di scheda, come sugli altri recipienti', () => {
    expect(sheetPressureKey('Filtri')).toBe('ps')
    expect(readSheetPressure('Filtri', { ps: 11 })).toBe(11)
    expect(readVariantValue('Filtri', { ps: 11 })).toBe(11)
  })

  it('traduce i campi della scheda dati come per i serbatoi', () => {
    expect(canonicalFromForm('Filtri', { ps_pressione_max: 11, ts: '-10 ÷ +50' }))
      .toEqual({ ps: 11, ts: '-10 ÷ +50' })
  })
})
```

- [ ] **Step 3: Eseguire i test e verificare che falliscano**

```bash
npx vitest run src/services/equipmentAudit/__tests__/specsNormalization.test.ts
```

Expected: FAIL — gli assert appena scritti/modificati si aspettano `'ps'`/`11`/mappe
popolate, ma il codice sorgente restituisce ancora `null`/`{}` per "Filtri".

- [ ] **Step 4: Implementare — estendere `CANONICAL_SPECS` e `FORM_TO_CANONICAL`**

In `src/services/equipmentAudit/specsNormalization.ts`, subito dopo la costante `CATEGORIA_PED`
(righe 91-93), aggiungere:

```ts
/**
 * Come `PS`, ma non obbligatoria: a differenza degli altri recipienti, il Filtro la dichiara
 * solo quando ha senso (es. filtro monoblocco già in pressione, senza un Recipiente filtro
 * separato) e non deve mai risultare "incompleto" per la sua assenza.
 */
const PS_OPZIONALE: CanonicalSpecDef = { ...PS, required: false }
```

Poi, nell'oggetto `CANONICAL_SPECS` (righe 97-154), sostituire:

```ts
  Filtri: [],
```

con:

```ts
  Filtri: [PS_OPZIONALE, TS],
```

Infine, nell'oggetto `FORM_TO_CANONICAL` (righe 181-237), sostituire:

```ts
  Filtri: {},
```

con:

```ts
  Filtri: {
    ps_pressione_max: 'ps',
    ts: 'ts',
    ts_temperatura: 'ts',
  },
```

Nota: `LEGACY_SPEC_MAP.Filtri` (riga 168) **non va toccata** — mappa già `pressione`→`ps` e
`temperatura`→`ts`, scritta a suo tempo in modo uniforme per tutti i tipi indipendentemente
da `CANONICAL_SPECS`, e coincide già con le nuove chiavi canoniche.

- [ ] **Step 5: Eseguire i test e verificare che passino**

```bash
npx vitest run src/services/equipmentAudit/__tests__/specsNormalization.test.ts
```

Expected: PASS, tutti i test verdi.

- [ ] **Step 6: Commit**

```bash
git add src/services/equipmentAudit/specsNormalization.ts src/services/equipmentAudit/__tests__/specsNormalization.test.ts
git commit -m "feat(dm329): PS e TS opzionali per il catalogo apparecchiature di tipo Filtri"
```

---

### Task 3: Scheda dati — estendere l'interfaccia `Filtro`

**Files:**
- Modify: `src/types/technicalSheet.ts:262-272`

**Interfaces:**
- Produces: `Filtro.ps_pressione_max?: number`, `Filtro.ts_temperatura?: number`,
  `Filtro.ts?: string` — gli stessi tre campi già presenti su `Serbatoio`/`Disoleatore`, letti
  da Task 4 (config tabella) e Task 6 (relazione tecnica).

Questo task non ha una propria suite di test dedicata (è un'estensione di interfaccia
TypeScript, priva di logica): la verifica è che il progetto continui a compilare, incluso
`src/services/relazione/__tests__/fixtures.ts`, la cui `makeFiltro` (riga 170-180) accetta
già `Partial<Filtro>` e quindi non richiede modifiche.

- [ ] **Step 1: Verificare lo stato di partenza (compilazione pulita)**

```bash
npx tsc --noEmit
```

Expected: nessun errore (stato di partenza pulito, per avere un confronto dopo la modifica).

- [ ] **Step 2: Estendere l'interfaccia**

In `src/types/technicalSheet.ts`, sostituire (righe 262-272):

```ts
export interface Filtro {
  codice: string // F1, F2, ... F8
  marca?: string // Suggerimento DB + OCR
  modello?: string // Suggerimento DB + OCR
  tipo?: TipoFiltro // Default LINEA
  n_fabbrica?: string // OCR
  anno?: number // intero (min 1980, max 2100)
  note?: string
  ha_recipiente?: boolean // Flag per relazione con recipiente filtro
  foto_targhetta?: string
}
```

con:

```ts
export interface Filtro {
  codice: string // F1, F2, ... F8
  marca?: string // Suggerimento DB + OCR
  modello?: string // Suggerimento DB + OCR
  tipo?: TipoFiltro // Default LINEA
  n_fabbrica?: string // OCR
  anno?: number // intero (min 1980, max 2100)
  ps_pressione_max?: number // PS (bar) - opzionale: non conta ai fini della completezza
  ts_temperatura?: number // TS (°C) legacy - opzionale
  ts?: string // TS libero (valore singolo o intervallo), precompilato da catalogo - opzionale
  note?: string
  ha_recipiente?: boolean // Flag per relazione con recipiente filtro
  foto_targhetta?: string
}
```

- [ ] **Step 3: Verificare che il progetto compili ancora**

```bash
npx tsc --noEmit
```

Expected: nessun errore.

- [ ] **Step 4: Commit**

```bash
git add src/types/technicalSheet.ts
git commit -m "feat(dm329): aggiunge PS e TS opzionali al tipo Filtro"
```

---

### Task 4: Tabella unica — flag `pressioneTsOpzionali` e configurazione del Filtro

**Files:**
- Modify: `src/components/technicalSheet/table/equipmentConfig.ts:53-69, 154-163`

**Interfaces:**
- Consumes: `Filtro.ps_pressione_max`, `Filtro.ts` (da Task 3).
- Produces: `EquipmentTypeDef.pressioneTsOpzionali?: boolean` — nuovo campo opzionale,
  consumato da Task 5 (`schedaCompleteness.ts`). `EQUIPMENT_DEFS.filtro.pressioneField`,
  `.ts`, `.specsMap`, `.adv`, `.pressioneTsOpzionali` valorizzati.

Non c'è un test dedicato a questo file (è configurazione dichiarativa, senza logica propria);
la verifica di comportamento arriva dai test di `schedaCompleteness.test.ts` (Task 5), che
leggono `EQUIPMENT_DEFS.filtro` per davvero.

- [ ] **Step 1: Aggiungere il campo `pressioneTsOpzionali` all'interfaccia `EquipmentTypeDef`**

In `src/components/technicalSheet/table/equipmentConfig.ts`, nell'interfaccia
`EquipmentTypeDef` (righe 53-69), dopo `roleHidden?: boolean` aggiungere:

```ts
  /**
   * PS e TS sono colonne mostrate e compilabili ma non contano ai fini della completezza
   * della riga (`schedaCompleteness.ts`) — usato dal Filtro, dove a differenza degli altri
   * recipienti non sono dati obbligatori.
   */
  pressioneTsOpzionali?: boolean
```

- [ ] **Step 2: Aggiornare `EQUIPMENT_DEFS.filtro`**

Sostituire (righe 154-163):

```ts
  filtro: {
    kind: 'filtro', label: 'Filtro', prefix: 'F', catalogType: 'Filtri',
    ts: false, cat: false, autoPed: false,
    extra: [
      { name: 'tipo', label: 'Tipo', kind: 'select', options: TIPO_FILTRO_OPTIONS, display: TIPO_FILTRO_LABELS, labels: TIPO_FILTRO_LABELS, emptyLabel: 'Filtro di linea' },
      NOTE_EXTRA,
    ],
    specsMap: {},
    childKind: 'recipiente',
  },
```

con:

```ts
  filtro: {
    kind: 'filtro', label: 'Filtro', prefix: 'F', catalogType: 'Filtri',
    pressioneField: 'ps_pressione_max', ts: true, cat: false, autoPed: false,
    extra: [
      { name: 'tipo', label: 'Tipo', kind: 'select', options: TIPO_FILTRO_OPTIONS, display: TIPO_FILTRO_LABELS, labels: TIPO_FILTRO_LABELS, emptyLabel: 'Filtro di linea' },
      NOTE_EXTRA,
    ],
    specsMap: { ps: 'ps_pressione_max', ts: 'ts' },
    childKind: 'recipiente',
    adv: ['pressione', 'ts'],
    pressioneTsOpzionali: true,
  },
```

`cat`, `autoPed` e l'assenza di `capacitaField` restano invariati: il Filtro non guadagna
categoria PED né capacità. `adv: ['pressione', 'ts']` nasconde le due colonne a
`tecnicoDM329`, come già avviene su Serbatoio/Disoleatore/Scambiatore/Recipiente filtro.

- [ ] **Step 3: Verificare che il progetto compili**

```bash
npx tsc --noEmit
```

Expected: nessun errore.

- [ ] **Step 4: Commit**

```bash
git add src/components/technicalSheet/table/equipmentConfig.ts
git commit -m "feat(dm329): colonne PS/TS sul Filtro, opzionali e nascoste a tecnicoDM329"
```

---

### Task 5: Completezza — PS/TS del Filtro non contano

**Files:**
- Modify: `src/utils/schedaCompleteness.ts:141,143`
- Test: `src/utils/__tests__/schedaCompleteness.test.ts`

**Interfaces:**
- Consumes: `EquipmentTypeDef.pressioneTsOpzionali` (Task 4).
- Produces: nessuna nuova funzione esportata — `completezzaRiga` cambia comportamento interno.

- [ ] **Step 1: Aggiungere il test che verifica l'esclusione**

In `src/utils/__tests__/schedaCompleteness.test.ts`, nel blocco
`describe('completezzaRiga — il denominatore lo detta il tipo', ...)` (righe 20-63), dopo il
primo `it` (righe 21-27, che resta invariato e continua a fare da guardia di non-regressione:
oggi passa perché il Filtro non ha PS/TS, e deve continuare a passare identico anche dopo
l'aggiunta, perché il flag li esclude comunque dal conteggio), aggiungere un nuovo `it`:

```ts
  it('non conta PS e TS sui filtri neppure quando sono compilati: sono opzionali', () => {
    const vuoto = completezzaRiga(EQUIPMENT_DEFS.filtro, { ...targhetta })
    const compilato = completezzaRiga(EQUIPMENT_DEFS.filtro, {
      ...targhetta,
      ps_pressione_max: 11,
      ts: '150',
    })
    expect(compilato.previsti).toBe(vuoto.previsti)
    expect(compilato.mancanti).not.toContain('PS')
    expect(compilato.mancanti).not.toContain('TS')
  })
```

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

```bash
npx vitest run src/utils/__tests__/schedaCompleteness.test.ts
```

Expected: FAIL sul nuovo test — con `EQUIPMENT_DEFS.filtro.pressioneField`/`ts` ora
valorizzati (Task 4) ma senza ancora il rispetto del flag in `completezzaRiga`, `previsti`
sale da 5 a 7 e PS/TS restano fuori solo perché compilati, non perché esclusi (il test sul
caso "vuoto" fallirebbe se scritto per opposizione — verificarlo con un `console.log` non è
necessario: l'assert su `previsti` uguali basta a rilevare la discrepanza).

- [ ] **Step 3: Implementare — rispettare il flag in `completezzaRiga`**

In `src/utils/schedaCompleteness.ts`, sostituire (righe 141, 143):

```ts
  if (def.pressioneField) q.campo('PS', campo(def.pressioneField))
  if (def.capacitaField) q.campo('Capacità', campo(def.capacitaField))
  if (def.ts) q.campo('TS', campo('ts'))
```

con:

```ts
  if (def.pressioneField && !def.pressioneTsOpzionali) q.campo('PS', campo(def.pressioneField))
  if (def.capacitaField) q.campo('Capacità', campo(def.capacitaField))
  if (def.ts && !def.pressioneTsOpzionali) q.campo('TS', campo('ts'))
```

- [ ] **Step 4: Eseguire i test e verificare che passino**

```bash
npx vitest run src/utils/__tests__/schedaCompleteness.test.ts
```

Expected: PASS, incluso il test preesistente riga 21-27 (rimasto identico).

- [ ] **Step 5: Commit**

```bash
git add src/utils/schedaCompleteness.ts src/utils/__tests__/schedaCompleteness.test.ts
git commit -m "feat(dm329): esclude PS/TS del filtro dal conteggio di completezza"
```

---

### Task 6: Relazione tecnica — la riga "Filtro" riporta PS e TS

**Files:**
- Modify: `src/services/relazione/engine/caratteristiche.ts:122-130`
- Test: `src/services/relazione/__tests__/caratteristiche.test.ts`

**Interfaces:**
- Consumes: `Filtro.ps_pressione_max`, `Filtro.ts`, `Filtro.ts_temperatura` (Task 3);
  `formatNumberIT`, `formatTemperatura` (già importati in `caratteristiche.ts:14-20`);
  `makeFiltro` (fixture già esistente in `src/services/relazione/__tests__/fixtures.ts:170-180`).
- Produces: nessuna nuova funzione — cambia solo il contenuto della riga generata per ogni
  elemento di `scheda.filtri`.

- [ ] **Step 1: Aggiungere `makeFiltro` agli import del test**

In `src/services/relazione/__tests__/caratteristiche.test.ts`, riga 3-11, aggiungere
`makeFiltro` all'elenco degli import da `./fixtures`:

```ts
import {
  makeScheda,
  makeCompressore,
  makeDisoleatore,
  makeSerbatoio,
  makeScambiatore,
  makeEssiccatore,
  makeValvola,
  makeFiltro,
} from './fixtures'
```

- [ ] **Step 2: Aggiungere il blocco di test**

In coda al file, dopo `describe('buildCaratteristiche — categoria della valvola di sicurezza', ...)`, aggiungere:

```ts
describe('buildCaratteristiche — PS e TS sul filtro', () => {
  test('il filtro riporta PS e TS quando compilati, come gli altri recipienti', () => {
    const rows = buildCaratteristiche(
      makeScheda({
        compressori: [],
        disoleatori: [],
        serbatoi: [],
        essiccatori: [],
        scambiatori: [],
        filtri: [makeFiltro({ codice: 'F1', ps_pressione_max: 11, ts: '150' })],
      })
    )
    const f = rows.find((r) => r.pos === 'F1')!
    expect(f.pressione).toBe('11')
    expect(f.temperatura).toBe('-10÷+150')
    expect(f.capacita).toBe('')
    expect(f.categoria).toBe('')
  })

  test('senza PS/TS compilati la riga resta vuota', () => {
    const rows = buildCaratteristiche(
      makeScheda({
        compressori: [],
        disoleatori: [],
        serbatoi: [],
        essiccatori: [],
        scambiatori: [],
        filtri: [makeFiltro({ codice: 'F1' })],
      })
    )
    const f = rows.find((r) => r.pos === 'F1')!
    expect(f.pressione).toBe('')
    expect(f.temperatura).toBe('')
  })
})
```

- [ ] **Step 3: Eseguire i test e verificare che falliscano**

```bash
npx vitest run src/services/relazione/__tests__/caratteristiche.test.ts
```

Expected: FAIL sul primo nuovo test (`f.pressione`/`f.temperatura` sono oggi sempre `''`); il
secondo passa già oggi banalmente (comportamento invariato) ma va comunque eseguito insieme.

- [ ] **Step 4: Implementare — leggere PS/TS nella riga "Filtro"**

In `src/services/relazione/engine/caratteristiche.ts`, sostituire (righe 122-130):

```ts
  // Filtri (+ recipienti)
  for (const f of scheda.filtri ?? []) {
    rows.push({
      ...base(f.codice, 'Filtro', f.marca, f.modello, f.anno, f.n_fabbrica),
      capacita: '',
      pressione: '',
      temperatura: '',
      categoria: '',
    })
```

con:

```ts
  // Filtri (+ recipienti)
  for (const f of scheda.filtri ?? []) {
    rows.push({
      ...base(f.codice, 'Filtro', f.marca, f.modello, f.anno, f.n_fabbrica),
      capacita: '',
      pressione: formatNumberIT(f.ps_pressione_max),
      temperatura: formatTemperatura(TEMP_MIN_RECIPIENTE, f.ts, f.ts_temperatura),
      categoria: '',
    })
```

(`TEMP_MIN_RECIPIENTE` è già definita e importata nello stesso file, riga 23 — stesso minimo
convenzionale già usato da serbatoi, disoleatori e recipienti filtro.)

- [ ] **Step 5: Eseguire i test e verificare che passino**

```bash
npx vitest run src/services/relazione/__tests__/caratteristiche.test.ts
```

Expected: PASS, tutti i test verdi (inclusi quelli preesistenti, non toccati).

- [ ] **Step 6: Commit**

```bash
git add src/services/relazione/engine/caratteristiche.ts src/services/relazione/__tests__/caratteristiche.test.ts
git commit -m "feat(dm329): la riga Filtro della relazione tecnica riporta PS e TS"
```

---

### Task 7: Aggiornare i test a valle che presupponevano "Filtri" senza dati tecnici

**Contesto:** due suite in moduli diversi da quelli toccati finora hanno un test che usa
`'Filtri'` come esempio di "tipo senza dati tecnici/senza confronto possibile". Con Task 2
questo non è più vero: vanno spostati su un tipo che lo è ancora (`Separatori`), e va
aggiunta una copertura reale del nuovo comportamento di `Filtri` in questi due moduli
generici (`equipmentCatalogValidation.ts`, `equipmentSpecsComparison.ts`), che non richiedono
modifiche al codice sorgente — sono già generici — ma vanno esercitati per dimostrarlo.

**Files:**
- Test: `src/utils/__tests__/equipmentCatalogValidation.test.ts`
- Test: `src/utils/__tests__/equipmentSpecsComparison.test.ts`

**Interfaces:**
- Consumes: `specsSchemaFor` (da `equipmentCatalogValidation.ts`), `compareSpecs` (da
  `equipmentSpecsComparison.ts`) — entrambe già esistenti, guidate da `CANONICAL_SPECS` /
  `FORM_TO_CANONICAL` modificate in Task 2. Nessuna modifica al codice sorgente in questo
  task: solo test.

- [ ] **Step 1: `equipmentCatalogValidation.test.ts` — spostare l'esempio e aggiungere copertura**

Sostituire (righe 115-117):

```ts
  it('i tipi senza dati tecnici non impongono nulla', () => {
    expect(specsSchemaFor('Filtri').safeParse({}).success).toBe(true)
  })
```

con:

```ts
  it('i tipi senza dati tecnici non impongono nulla', () => {
    expect(specsSchemaFor('Separatori').safeParse({}).success).toBe(true)
  })

  it('per i filtri PS e TS sono opzionali', () => {
    expect(specsSchemaFor('Filtri').safeParse({}).success).toBe(true)
    expect(specsSchemaFor('Filtri').safeParse({ ps: 11, ts: '-10 ÷ +50' }).success).toBe(true)
  })
```

- [ ] **Step 2: `equipmentSpecsComparison.test.ts` — spostare l'esempio e aggiungere copertura**

Sostituire (righe 89-91):

```ts
  it('non confronta i tipi senza dati tecnici', () => {
    expect(compareSpecs({}, { codice: 'F1' } as any, 'Filtri').hasChanges).toBe(false)
  })
```

con:

```ts
  it('non confronta i tipi senza dati tecnici', () => {
    expect(compareSpecs({}, { codice: 'F1' } as any, 'Separatori').hasChanges).toBe(false)
  })

  it('confronta PS e TS per i filtri, come per gli altri recipienti', () => {
    const c = compareSpecs(
      { ps: 11, ts: '-10 ÷ +100' },
      { ps_pressione_max: 11, ts: '-10 ÷ +120' } as any,
      'Filtri'
    )
    expect(c.modifiedFields.ts).toEqual({ oldValue: '-10 ÷ +100', newValue: '-10 ÷ +120' })
  })

  it('propone una nuova variante quando la PS del filtro non è quella a catalogo', () => {
    const c = compareSpecs(
      { ps: 11 },
      { ps_pressione_max: 13 } as any,
      'Filtri'
    )
    expect(c.suggestNewVariant).toBe(true)
    expect(c.hasChanges).toBe(false)
  })
```

- [ ] **Step 3: Eseguire entrambe le suite e verificare che passino**

```bash
npx vitest run src/utils/__tests__/equipmentCatalogValidation.test.ts src/utils/__tests__/equipmentSpecsComparison.test.ts
```

Expected: PASS. (Questi test non hanno un ciclo rosso-verde significativo: verificano
comportamento già corretto di codice generico non modificato in questo task — la loro
funzione è documentare e fissare il nuovo comportamento di `Filtri`, non guidarne
l'implementazione. Se uno di questi fallisse, indicherebbe un problema in Task 2, da
correggere lì.)

- [ ] **Step 4: Commit**

```bash
git add src/utils/__tests__/equipmentCatalogValidation.test.ts src/utils/__tests__/equipmentSpecsComparison.test.ts
git commit -m "test(dm329): copre il confronto scheda-catalogo e la validazione per Filtri"
```

---

### Task 8: Verifica finale

**Files:** nessuno (solo comandi di verifica).

- [ ] **Step 1: Suite completa**

```bash
npm test -- --run
```

Expected: tutti i test verdi, nessuna regressione nelle altre suite (es.
`equipmentSpecsIntegrity`, `duplicati`, `EquipmentCatalogTable`-adjacent, ecc., che leggono
`CANONICAL_SPECS`/`FORM_TO_CANONICAL` genericamente e non dovrebbero essere impattate, ma vanno
comunque riverificate).

- [ ] **Step 2: Typecheck e build**

```bash
npm run build:check
```

Expected: nessun errore.

- [ ] **Step 3: Lint**

```bash
npm run lint
```

Expected: nessun errore.

- [ ] **Step 4: Verifica manuale in dev server (facoltativa, consigliata)**

```bash
npm run dev
```

Aprire una pratica DM329, aggiungere un Filtro nella scheda dati, verificare a occhio che:
- la colonna PS proponga la cascata di catalogo (selezionando marca+modello di un filtro già
  censito con più varianti di pressione, se presente, o creandone una nuova dal catalogo);
- la colonna TS sia compilabile come testo libero;
- lasciando PS/TS vuoti, la riga Filtro non compaia come "incompleta"/non contribuisca a
  percentuali sotto al 100% per quella sola assenza;
- generando l'anteprima della relazione tecnica, la riga del Filtro compilato mostri PS e TS
  nella tabella caratteristiche apparecchiature.

Questo passaggio non è automatizzabile con Vitest (nessun test di UI per convenzione di
progetto) ed è quindi l'unica verifica end-to-end del lavoro.
