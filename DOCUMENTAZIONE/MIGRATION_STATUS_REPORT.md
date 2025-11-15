# Report Stato Migration Database - 15/11/2025

## ❓ Domanda: "Sei sicuro che queste migration non siano già state applicate?"

## ✅ Risposta: NO, le 6 migration critiche NON sono state applicate

### 📊 Evidenze

#### 1. Output `supabase migration list`

```
Local          | Remote         | Time (UTC)
----------------|----------------|---------------------
20251112100000 |                | 2025-11-12 10:00:00  ❌ NON REMOTA
20251112100001 |                | 2025-11-12 10:00:01  ❌ NON REMOTA
20251112100002 |                | 2025-11-12 10:00:02  ❌ NON REMOTA
20251112100003 |                | 2025-11-12 10:00:03  ❌ NON REMOTA
20251113100000 |                | 2025-11-13 10:00:00  ❌ NON REMOTA
20251114000000 |                | 2025-11-14 00:00:00  ❌ NON REMOTA
```

**Interpretazione:**
- La colonna "Remote" è **vuota** per tutte e 6 le migration
- Questo significa che sono presenti **solo localmente**
- **NON sono state registrate** in `supabase_migrations.schema_migrations`

#### 2. Ultima Migration Remota Applicata

```
20251102000003 | 20251102000003 | 2025-11-02 00:00:03  ✅ ULTIMA REMOTA
```

L'ultima migration presente sul database remoto ha timestamp **2025-11-02**, mentre le nostre sono del **2025-11-12** e successive.

---

## 🎯 Conclusione

### Migration da Applicare (in ordine):

| # | Timestamp | Nome File | Tabella/Oggetto Creato | Status |
|---|-----------|-----------|------------------------|--------|
| 1 | 20251112100000 | SQL_01_feature_flags.sql | `feature_flags` table | ❌ DA APPLICARE |
| 2 | 20251112100001 | SQL_02_customer_users.sql | `customer_users` table | ❌ DA APPLICARE |
| 3 | 20251112100002 | SQL_03_dm329_technical_data.sql | `dm329_technical_data` table | ❌ DA APPLICARE |
| 4 | 20251112100003 | SQL_04_equipment_catalog.sql | `equipment_catalog` table | ❌ DA APPLICARE |
| 5 | 20251113100000 | SQL_05_enhance_equipment_catalog.sql | `equipment_catalog_type` ENUM | ❌ DA APPLICARE |
| 6 | 20251114000000 | SQL_06_request_attribution.sql | `requests.attributed_to` column | ❌ DA APPLICARE |

---

## 🔍 Come Verificare Personalmente

### Opzione 1: Via Supabase Dashboard (RACCOMANDATO)

1. Vai su: https://supabase.com/dashboard/project/uphftgpwisdiubuhohnc/sql/new
2. Copia e incolla il contenuto di `verify_migrations.sql`
3. Esegui la query
4. Vedrai un report completo con:
   - ✅ Tabelle esistenti
   - ❌ Tabelle mancanti
   - Riepilogo migration da applicare

### Opzione 2: Via CLI

```bash
supabase migration list
```

Guarda la colonna "Remote":
- Se **vuota** = migration NON applicata
- Se **popolata** = migration già applicata

---

## ⚠️ Importante: Perché le Migration Non Sono State Applicate Automaticamente?

### Motivi:

1. **Comando `supabase db push` fallito** - Il tentativo automatico è fallito per errore di connessione:
   ```
   failed to connect to postgres: hostname resolving error
   ```

2. **Migration con timestamp "fuori sequenza"** - Le nuove migration hanno timestamp più recenti dell'ultima applicata, ma Supabase richiede conferma esplicita con flag `--include-all`

3. **Non esiste auto-deploy database** - A differenza del frontend (Vercel), le migration database richiedono **applicazione manuale** o via CI/CD configurato

---

## 📋 Checklist Pre-Applicazione

Prima di applicare le migration, verifica:

- [ ] **Tabella `customers` esiste?** (richiesta da SQL_02_customer_users.sql)
  ```sql
  SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_name = 'customers'
  );
  ```

- [ ] **Request type 'DM329' esiste?** (richiesto da SQL_03_dm329_technical_data.sql)
  ```sql
  SELECT EXISTS (
    SELECT FROM request_types
    WHERE name = 'DM329'
  );
  ```

- [ ] **Estensione `pg_trgm` disponibile?** (richiesta da SQL_04_equipment_catalog.sql)
  ```sql
  SELECT * FROM pg_available_extensions
  WHERE name = 'pg_trgm';
  ```

Se una di queste condizioni **NON è soddisfatta**, le migration potrebbero fallire.

---

## 🚀 Procedura Applicazione Sicura

### Step 1: Verifica Prerequisiti
Esegui `verify_migrations.sql` per controllare lo stato attuale

### Step 2: Applica in Ordine
Esegui le 6 migration nell'ordine indicato, una alla volta

### Step 3: Verifica Dopo Ogni Migration
Dopo ogni migration, verifica:
```sql
-- Controlla tabella creata
SELECT table_name FROM information_schema.tables
WHERE table_name = 'NOME_TABELLA';

-- Controlla errori
SELECT * FROM pg_stat_activity WHERE state = 'idle in transaction (aborted)';
```

### Step 4: Registra nel Sistema
Dopo aver applicato tutte le migration con successo:
```sql
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES
  ('20251112100000', 'create_feature_flags', ARRAY['Applied manually']),
  ('20251112100001', 'create_customer_users', ARRAY['Applied manually']),
  ('20251112100002', 'create_dm329_technical_data', ARRAY['Applied manually']),
  ('20251112100003', 'create_equipment_catalog', ARRAY['Applied manually']),
  ('20251113100000', 'enhance_equipment_catalog', ARRAY['Applied manually']),
  ('20251114000000', 'add_request_attribution', ARRAY['Applied manually'])
ON CONFLICT (version) DO NOTHING;
```

---

## 🔧 Troubleshooting

### "La tabella esiste già"
Possibili cause:
1. Migration applicata manualmente in passato ma non registrata
2. Tabella creata con nome diverso
3. Schema diverso (controlla `table_schema`)

**Soluzione:** Usa `CREATE TABLE IF NOT EXISTS` (già presente nelle migration)

### "Tipo ENUM già esiste"
**Soluzione:**
```sql
DROP TYPE IF EXISTS equipment_catalog_type CASCADE;
-- Poi riesegui la migration
```
⚠️ Attenzione: `CASCADE` elimina tutte le dipendenze!

### "Policy già esiste"
**Soluzione:** Le migration includono già `DROP POLICY IF EXISTS`

---

## 📞 Supporto

Se hai dubbi durante l'applicazione:
1. Leggi i messaggi di errore completi
2. Controlla prerequisiti con `verify_migrations.sql`
3. Verifica log Supabase Dashboard → Logs
4. Consulta la documentazione in `MANUAL_MIGRATIONS_GUIDE.md`

---

**Data report:** 15/11/2025 16:45
**Database:** Supabase uphftgpwisdiubuhohnc
**Ambiente:** Production
**Status:** Migration pendenti, applicazione manuale richiesta
