# Applicazione Migrazioni al Database Supabase

## Istruzioni per applicare le migrazioni

### Metodo 1: Via Dashboard Supabase (Raccomandato)

1. Vai su: https://supabase.com/dashboard/project/uphftgpwisdiubuhohnc/editor
2. Apri il SQL Editor
3. Copia e incolla il contenuto dei seguenti file **in ordine**:

   **Step 1:** Esegui `migrations/20250101000000_initial_schema.sql`
   - Questo crea tutte le tabelle, enum, trigger e la funzione di validazione

   **Step 2:** Esegui `migrations/20250101000001_rls_policies.sql`
   - Questo abilita RLS e crea tutte le policy di sicurezza

   **Step 3:** Esegui `migrations/20250101000002_fix_rls_recursion.sql`
   - Fix per problemi di ricorsione nelle policy RLS

   **Step 4:** Esegui `migrations/20250101000003_add_initial_history_trigger.sql`
   - Aggiunge trigger per creare automaticamente record storico alla creazione richiesta
   - Vedi `DOCUMENTAZIONE/Migration_Initial_History.md` per dettagli

   **Step 5:** Esegui `migrations/20250101000004_validate_assigned_status.sql`
   - Aggiunge constraint per impedire stato ASSEGNATA senza tecnico assegnato
   - Vedi `DOCUMENTAZIONE/Migration_Validate_Assigned_Status.md` per dettagli

   **Step 6 (Opzionale):** Esegui `seed.sql`
   - Questo popola il database con dati di test
   - NOTA: Prima di eseguire seed.sql, devi creare gli utenti via Supabase Auth Dashboard

### Metodo 2: Via Supabase CLI (Alternativo)

```bash
# Installa Supabase CLI (se non già installato)
npm install -g supabase

# Login
supabase login

# Link al progetto remoto
supabase link --project-ref uphftgpwisdiubuhohnc

# Applica le migrazioni
supabase db push
```

### Creazione Utenti di Test

Dopo aver applicato le migrazioni, crea gli utenti di test via Dashboard:

1. Vai su: https://supabase.com/dashboard/project/uphftgpwisdiubuhohnc/auth/users
2. Clicca "Add user" → "Create new user"
3. Crea questi 3 utenti:

   **Admin:**
   - Email: admin@studiobertin.it
   - Password: admin123
   - Metadata: `{"full_name": "Admin Ufficio Tecnico"}`

   **Tecnico:**
   - Email: tecnico@studiobertin.it
   - Password: tecnico123
   - Metadata: `{"full_name": "Marco Rossi"}`

   **Utente:**
   - Email: utente@studiobertin.it
   - Password: utente123
   - Metadata: `{"full_name": "Laura Bianchi"}`

4. Dopo la creazione, esegui questo SQL nel SQL Editor per aggiornare i ruoli:

```sql
UPDATE users SET role = 'admin' WHERE email = 'admin@studiobertin.it';
UPDATE users SET role = 'tecnico' WHERE email = 'tecnico@studiobertin.it';
UPDATE users SET role = 'utente' WHERE email = 'utente@studiobertin.it';
```

5. Poi esegui il seed.sql per creare richieste di esempio

### Verifica

Dopo aver applicato tutto, esegui queste query per verificare:

```sql
-- Verifica tabelle create
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Verifica utenti
SELECT id, email, role, full_name FROM users;

-- Verifica tipi di richiesta
SELECT id, name, is_active FROM request_types;

-- Verifica richieste
SELECT id, title, status FROM requests;

-- Verifica RLS abilitato
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';
```

## Risultato Atteso

Dovresti vedere:
- 6 tabelle create (users, request_types, requests, request_history, attachments, notifications)
- 3 utenti con ruoli diversi
- 3 tipi di richiesta (DM329, Supporto IT, Richiesta Manutenzione)
- 4 richieste di esempio in vari stati
- RLS abilitato su tutte le tabelle
