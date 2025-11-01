# Guida Applicazione Migration Database

## Problema con ENUM PostgreSQL

PostgreSQL **NON permette** di usare un nuovo valore di un ENUM nella stessa transazione in cui viene aggiunto. Per questo motivo, le migration sono state divise in **due file separati** che devono essere eseguiti **in sequenza**.

## File Migration

### 1. `20250101000003_add_userdm329_role.sql`
**Contenuto:** Aggiunge il valore `'userdm329'` all'enum `user_role`

**Deve essere eseguita PRIMA e committata**

### 2. `20250101000004_add_suspension_and_policies.sql`
**Contenuto:**
- Aggiunge campo `is_suspended` alla tabella `users`
- Crea indice per `is_suspended`
- Crea funzione `is_user_suspended()`
- Crea RLS policies per il ruolo `userdm329`

**Deve essere eseguita DOPO che la prima migration è stata committata**

## Procedura di Applicazione

### Opzione A: Supabase CLI (Locale)

```bash
# 1. Applicare la prima migration
supabase migration up --file 20250101000003_add_userdm329_role.sql

# 2. ATTENDERE il commit della transazione

# 3. Applicare la seconda migration
supabase migration up --file 20250101000004_add_suspension_and_policies.sql
```

### Opzione B: Dashboard Supabase (Consigliata)

#### Passo 1: Aggiungere valore enum
1. Andare su **Supabase Dashboard** > **SQL Editor**
2. Creare una **nuova query**
3. Copiare e incollare il contenuto di `20250101000003_add_userdm329_role.sql`:
   ```sql
   ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'userdm329';
   ```
4. **Eseguire** la query
5. ✅ Verificare successo (dovrebbe mostrare "Success")
6. **ATTENDERE alcuni secondi** per garantire il commit

#### Passo 2: Verificare enum aggiornato
1. Creare una nuova query
2. Eseguire:
   ```sql
   SELECT enum_range(NULL::user_role);
   ```
3. ✅ Verificare che l'output contenga: `{admin,tecnico,utente,userdm329}`

#### Passo 3: Aggiungere campo e policies
1. Creare una **nuova query** (importante: nuova sessione)
2. Copiare e incollare **tutto** il contenuto di `20250101000004_add_suspension_and_policies.sql`
3. **Eseguire** la query
4. ✅ Verificare successo

#### Passo 4: Verifiche finali
1. Verificare campo `is_suspended`:
   ```sql
   SELECT column_name, data_type, column_default
   FROM information_schema.columns
   WHERE table_name = 'users' AND column_name = 'is_suspended';
   ```

   **Risultato atteso:**
   ```
   column_name   | data_type | column_default
   is_suspended  | boolean   | false
   ```

2. Verificare policies create:
   ```sql
   SELECT policyname
   FROM pg_policies
   WHERE tablename = 'requests' AND policyname LIKE '%userdm329%';
   ```

   **Risultato atteso:**
   ```
   userdm329 can view DM329 requests
   userdm329 can update DM329 requests
   ```

3. Verificare funzione:
   ```sql
   SELECT proname FROM pg_proc WHERE proname = 'is_user_suspended';
   ```

   **Risultato atteso:**
   ```
   is_user_suspended
   ```

### Opzione C: Script SQL Unico (Per ambiente di produzione)

Se hai necessità di eseguire tutto in un unico script (es. pipeline CI/CD), usa questo approccio:

```sql
-- Passo 1: Aggiungere enum
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'userdm329'
        AND enumtypid = 'user_role'::regtype
    ) THEN
        ALTER TYPE user_role ADD VALUE 'userdm329';
    END IF;
END $$;

-- Passo 2: COMMIT esplicito (solo in sessioni con autocommit OFF)
-- COMMIT;

-- Passo 3: Attendere e poi eseguire in una NUOVA TRANSAZIONE
-- Il resto delle migration...
```

**⚠️ ATTENZIONE:** Anche con questo approccio, PostgreSQL potrebbe richiedere due sessioni separate.

## Errori Comuni

### Errore: "unsafe use of new value 'userdm329' of enum type user_role"

**Causa:** Stai cercando di usare il valore enum nella stessa transazione in cui è stato creato.

**Soluzione:**
1. Eseguire solo la prima migration
2. Attendere il commit
3. Aprire una **nuova sessione/query**
4. Eseguire la seconda migration

### Errore: "type 'userdm329' does not exist"

**Causa:** La prima migration non è stata eseguita o non è stata committata.

**Soluzione:**
1. Verificare che l'enum contenga il valore:
   ```sql
   SELECT enum_range(NULL::user_role);
   ```
2. Se manca, eseguire la prima migration

### Errore: "column 'is_suspended' already exists"

**Causa:** La seconda migration è già stata eseguita parzialmente.

**Soluzione:**
- Usare `IF NOT EXISTS` nelle query (già presente nelle migration)
- Oppure rimuovere manualmente:
  ```sql
  ALTER TABLE users DROP COLUMN IF EXISTS is_suspended;
  ```

## Rollback

### Rollback Passo 2 (Policies e campo)

```sql
-- Rimuovere policies
DROP POLICY IF EXISTS "userdm329 can view DM329 requests" ON requests;
DROP POLICY IF EXISTS "userdm329 can update DM329 requests" ON requests;

-- Rimuovere funzione
DROP FUNCTION IF EXISTS is_user_suspended;

-- Rimuovere indice
DROP INDEX IF EXISTS idx_users_is_suspended;

-- Rimuovere colonna
ALTER TABLE users DROP COLUMN IF EXISTS is_suspended;
```

### Rollback Passo 1 (Enum)

⚠️ **NON È POSSIBILE** rimuovere facilmente un valore da un ENUM in PostgreSQL.

**Workaround:**
1. Se nessun utente ha il ruolo `userdm329`, le policies possono essere rimosse senza problemi
2. Il valore enum rimane ma non viene mai usato
3. Se necessario rimuoverlo completamente, bisogna:
   - Creare un nuovo enum senza il valore
   - Alterare tutte le colonne che usano il vecchio enum
   - Eliminare il vecchio enum
   - **Questa è un'operazione complessa e rischiosa**

**Consigliato:** Lasciare il valore nell'enum anche dopo rollback delle policies.

## Timeline Consigliata

1. **T0:** Eseguire migration 1 (enum) ✅
2. **T0 + 10s:** Verificare enum aggiornato ✅
3. **T0 + 20s:** Eseguire migration 2 (resto) ✅
4. **T0 + 30s:** Verifiche finali ✅

## Checklist Pre-Migration

- [ ] Backup database completo
- [ ] Accesso alla Dashboard Supabase o CLI configurata
- [ ] File migration scaricati e verificati
- [ ] Piano di rollback pronto
- [ ] Ambiente di test disponibile (opzionale ma consigliato)

## Checklist Post-Migration

- [ ] Enum `user_role` contiene `userdm329`
- [ ] Colonna `is_suspended` esiste in `users`
- [ ] Indice `idx_users_is_suspended` creato
- [ ] Funzione `is_user_suspended` esiste
- [ ] Policy `userdm329 can view DM329 requests` attiva
- [ ] Policy `userdm329 can update DM329 requests` attiva
- [ ] Nessun errore nei log Supabase
- [ ] Test creazione utente con ruolo `userdm329` funzionante

## Supporto

Per problemi durante la migration:
1. Controllare i log nella Dashboard Supabase
2. Verificare le query eseguite nella sezione "Database" > "Logs"
3. Se bloccato, eseguire rollback parziale delle policies
4. Contattare supporto Supabase se persistono errori

## Note Aggiuntive

- Le migration usano `IF NOT EXISTS` per essere **idempotenti**
- Possono essere rieseguite senza errori
- PostgreSQL 13+ supporta `ADD VALUE IF NOT EXISTS` per enum
- Le RLS policies sono automaticamente attive se RLS è abilitato sulla tabella
