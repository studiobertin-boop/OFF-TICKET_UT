# Guida Applicazione Manuale Migration Database

## ⚠️ IMPORTANTE
Queste migration devono essere applicate manualmente via **Supabase Dashboard** > **SQL Editor** nell'ordine indicato.

---

## 📋 Migration da Applicare (in ordine)

### 1️⃣ Feature Flags (`20251112100000_create_feature_flags.sql`)

**Cosa fa:** Crea la tabella `feature_flags` per gestire l'abilitazione/disabilitazione delle funzionalità

**Come applicare:**
1. Vai su [Supabase Dashboard](https://supabase.com/dashboard/project/uphftgpwisdiubuhohnc/sql/new)
2. Copia e incolla il contenuto del file: `supabase/migrations/20251112100000_create_feature_flags.sql`
3. Esegui la query
4. Verifica che la tabella `feature_flags` sia stata creata con un record per `dm329_full_workflow`

**Elementi chiave creati:**
- Tabella `feature_flags` con RLS
- Trigger per `updated_at`
- Policy: tutti possono leggere, solo admin possono modificare
- Record iniziale: `dm329_full_workflow` (disabilitato di default)

---

### 2️⃣ Customer Users (`20251112100001_create_customer_users.sql`)

**Cosa fa:** Crea la tabella `customer_users` per gli utenti cliente che accedono al portale

**Come applicare:**
1. Apri SQL Editor su Supabase Dashboard
2. Copia il contenuto del file: `supabase/migrations/20251112100001_create_customer_users.sql`
3. Esegui la query
4. Verifica la creazione della tabella

**Elementi chiave creati:**
- Tabella `customer_users` con vincoli email
- RLS policies per admin/userdm329
- Funzione `customer_user_has_access_to_request()`

---

### 3️⃣ DM329 Technical Data (`20251112100002_create_dm329_technical_data.sql`)

**Cosa fa:** Crea la tabella `dm329_technical_data` per le schede tecniche DM329

**Come applicare:**
1. Apri SQL Editor su Supabase Dashboard
2. Copia il contenuto del file: `supabase/migrations/20251112100002_create_dm329_technical_data.sql`
3. Esegui la query
4. Verifica la creazione della tabella e dei trigger

**Elementi chiave creati:**
- Tabella `dm329_technical_data` con campi JSONB per dati flessibili
- Trigger per creare automaticamente scheda quando viene creata richiesta DM329
- Trigger per aggiornare stato richiesta a `2-SCHEDA_DATI_PRONTA` al completamento
- RLS policies per admin/userdm329

**⚠️ Dipendenze:** Richiede che esista il request_type 'DM329'

---

### 4️⃣ Equipment Catalog (`20251112100003_create_equipment_catalog.sql`)

**Cosa fa:** Crea il catalogo apparecchiature per matching OCR

**Come applicare:**
1. Apri SQL Editor su Supabase Dashboard
2. Copia il contenuto del file: `supabase/migrations/20251112100003_create_equipment_catalog.sql`
3. Esegui la query
4. Verifica che la tabella sia creata con dati di esempio

**Elementi chiave creati:**
- Estensione `pg_trgm` per fuzzy search
- Tabella `equipment_catalog` con indici trigram
- Campo `normalized_name` generato automaticamente
- Funzioni `search_equipment_fuzzy()` e `increment_equipment_usage()`
- 5 record di esempio (Atlas Copco, Kaeser, Ingersoll Rand)

---

### 5️⃣ Equipment Catalog Enhancement (`20251113100000_enhance_equipment_catalog.sql`)

**Cosa fa:** Aggiunge ENUM `equipment_catalog_type` e funzioni per filtri cascata

**Come applicare:**
1. Apri SQL Editor su Supabase Dashboard
2. Copia il contenuto del file: `supabase/migrations/20251113100000_enhance_equipment_catalog.sql`
3. Esegui la query
4. Verifica che l'ENUM sia stato creato

**Elementi chiave creati:**
- ENUM `equipment_catalog_type` con 9 valori (Serbatoi, Compressori, ecc.)
- Colonne `tipo_apparecchiatura`, `is_user_defined`, `created_by`
- Indici compositi per performance filtri cascata
- Funzioni:
  - `get_marche_by_tipo()`
  - `get_modelli_by_tipo_marca()`
  - `add_equipment_to_catalog()`
  - `search_equipment_fuzzy()` (versione aggiornata)

**⚠️ Dipendenze:** Richiede migration #4 (equipment_catalog)

---

### 6️⃣ Request Attribution (`20251114000000_add_request_attribution.sql`)

**Cosa fa:** Aggiunge sistema di attribuzione richieste ad altri utenti

**Come applicare:**
1. Apri SQL Editor su Supabase Dashboard
2. Copia il contenuto del file: `supabase/migrations/20251114000000_add_request_attribution.sql`
3. Esegui la query
4. Verifica che la colonna `attributed_to` sia stata aggiunta

**Elementi chiave creati:**
- Colonna `requests.attributed_to`
- Indice per query su richieste attribuite
- Policy RLS aggiornate per permettere accesso a richieste attribuite
- Funzione `attribute_request()` con notifiche automatiche

**⚠️ ATTENZIONE:**
Questa migration **elimina e ricrea** le policy RLS esistenti:
- `"Users can view their own requests"`
- `"Users can update their own requests"`

Assicurati che non ci siano altre policy custom che potrebbero essere perse.

---

## ✅ Verifica Post-Applicazione

Dopo aver applicato tutte le migration, esegui questa query per verificare:

```sql
-- Verifica tabelle create
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'feature_flags',
  'customer_users',
  'dm329_technical_data',
  'equipment_catalog'
)
ORDER BY table_name;

-- Verifica ENUM creato
SELECT typname, enumlabel
FROM pg_type
JOIN pg_enum ON pg_enum.enumtypid = pg_type.oid
WHERE typname = 'equipment_catalog_type'
ORDER BY enumsortorder;

-- Verifica colonna attributed_to
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'requests'
AND column_name = 'attributed_to';

-- Verifica feature flags
SELECT flag_name, is_enabled, description
FROM feature_flags;
```

**Risultati attesi:**
- 4 tabelle trovate
- 9 valori nell'ENUM `equipment_catalog_type`
- Colonna `attributed_to` presente in `requests`
- 1 record in `feature_flags` con `dm329_full_workflow`

---

## 🔧 Troubleshooting

### Errore: "relation already exists"
Significa che la tabella è già presente. Puoi:
- Saltare quella migration specifica
- Usare `DROP TABLE IF EXISTS` prima di creare (⚠️ attenzione ai dati!)

### Errore: "type already exists"
L'ENUM `equipment_catalog_type` esiste già. Puoi:
- Saltare il `CREATE TYPE`
- Usare `DROP TYPE IF EXISTS equipment_catalog_type CASCADE` (⚠️ elimina tutte le dipendenze!)

### Errore: "policy already exists"
Le policy RLS esistono già con quel nome. Puoi:
- Aggiungere `DROP POLICY IF EXISTS` prima di creare
- La migration già include `DROP POLICY IF EXISTS` per alcune policy

### Errore: "function does not exist: auth.uid()"
Assicurati di essere connesso al database Supabase corretto e che l'estensione `auth` sia abilitata.

---

## 📊 Registrazione Migration nel Sistema

Dopo aver applicato manualmente le migration, registrale nella tabella di sistema:

```sql
-- Registra le migration applicate
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES
  ('20251112100000', 'create_feature_flags', ARRAY['-- Applied manually via Dashboard']),
  ('20251112100001', 'create_customer_users', ARRAY['-- Applied manually via Dashboard']),
  ('20251112100002', 'create_dm329_technical_data', ARRAY['-- Applied manually via Dashboard']),
  ('20251112100003', 'create_equipment_catalog', ARRAY['-- Applied manually via Dashboard']),
  ('20251113100000', 'enhance_equipment_catalog', ARRAY['-- Applied manually via Dashboard']),
  ('20251114000000', 'add_request_attribution', ARRAY['-- Applied manually via Dashboard'])
ON CONFLICT (version) DO NOTHING;
```

Questo eviterà che Supabase provi a riapplicarle in futuro.

---

## 🎯 Prossimi Passi Dopo le Migration

1. **Abilitare Feature Flag:**
   ```sql
   UPDATE feature_flags
   SET is_enabled = true
   WHERE flag_name = 'dm329_full_workflow';
   ```

2. **Importare Catalogo Apparecchiature:**
   - Usare lo script `scripts/import-equipment-catalog.ts`
   - Oppure importare manualmente da `equipment_analysis_clean.json`

3. **Deploy Edge Function OCR:**
   ```bash
   supabase functions deploy analyze-equipment-nameplate
   ```

4. **Verificare Frontend:**
   - Controllare che la pagina TechnicalDetails sia accessibile
   - Testare upload foto e OCR
   - Verificare funzionamento filtri cascata equipments

---

**Data creazione:** 2025-11-15
**Versione applicazione:** v1.0 - DM329 Full Workflow
**Database:** Supabase (uphftgpwisdiubuhohnc)
