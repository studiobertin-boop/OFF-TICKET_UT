# Checklist Deployment - Gestione Utenti

## Pre-Deployment

### 1. Verifiche Database
- [ ] Backup database Supabase corrente
- [ ] Verificare che il progetto Supabase sia accessibile
- [ ] Verificare permessi Admin API

### 2. Applicazione Migration

⚠️ **IMPORTANTE:** Le migration devono essere eseguite in **DUE STEP SEPARATI** a causa delle limitazioni di PostgreSQL con gli ENUM.

Consultare la guida completa: `DOCUMENTAZIONE/MIGRATION_GUIDE.md`

#### Step 1: Aggiungere valore enum
- [ ] Eseguire migration `20250101000003_add_userdm329_role.sql`

  **Via Dashboard Supabase:**
  1. Andare su SQL Editor
  2. Copiare contenuto del file (solo ALTER TYPE)
  3. Eseguire query
  4. Verificare successo
  5. **ATTENDERE 10-20 secondi**

- [ ] Verificare enum aggiornato:
  ```sql
  SELECT enum_range(NULL::user_role);
  ```
  Risultato atteso: `{admin,tecnico,utente,userdm329}`

#### Step 2: Aggiungere campo e policies
- [ ] Eseguire migration `20250101000004_add_suspension_and_policies.sql`

  **Via Dashboard Supabase (NUOVA QUERY):**
  1. Creare una **NUOVA query** (nuova sessione)
  2. Copiare tutto il contenuto del file
  3. Eseguire query
  4. Verificare successo

- [ ] Verificare creazione colonna `is_suspended` in tabella `users`
  ```sql
  SELECT * FROM users LIMIT 1;
  ```

- [ ] Verificare nuovo valore enum `userdm329`
  ```sql
  SELECT enum_range(NULL::user_role);
  ```

- [ ] Verificare creazione policies per userdm329
  ```sql
  SELECT * FROM pg_policies WHERE tablename = 'requests' AND policyname LIKE '%userdm329%';
  ```

### 3. Verifiche Codice
- [ ] Eseguire build production
  ```bash
  npm run build
  ```

- [ ] Verificare assenza errori TypeScript critici
- [ ] Verificare che `date-fns` sia installato
  ```bash
  npm list date-fns
  ```

## Deployment

### 4. Deploy Edge Function

⚠️ **CRITICO:** La Edge Function è necessaria per gestire utenti (richiede Admin API)

Consultare guida completa: `DOCUMENTAZIONE/EDGE_FUNCTION_DEPLOYMENT.md`

- [ ] Installare Supabase CLI (se non già fatto)
  ```bash
  npm install -g supabase
  ```

- [ ] Login Supabase CLI
  ```bash
  supabase login
  ```

- [ ] Link progetto
  ```bash
  supabase link --project-ref <your-project-ref>
  ```

- [ ] Deploy Edge Function
  ```bash
  supabase functions deploy manage-user
  ```

- [ ] Verificare deployment
  - Dashboard > Edge Functions
  - Verificare `manage-user` presente e attiva

- [ ] Verificare logs (opzionale)
  ```bash
  supabase functions logs manage-user
  ```

### 5. Deploy Applicazione
- [ ] Commit e push su repository Git
  ```bash
  git add .
  git commit -m "feat: implementazione gestione utenti e ruolo userdm329"
  git push
  ```

- [ ] Verificare build automatica su Vercel (se configurato)
- [ ] Controllare logs di deploy per errori

### 5. Configurazione Supabase
- [ ] Verificare che Service Role Key sia configurata
- [ ] Verificare che le RLS policies siano attive
  ```sql
  SELECT tablename, policyname, permissive, roles, cmd
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'users';
  ```

- [ ] Testare che Admin API funzioni correttamente

## Post-Deployment

### 6. Verifiche Edge Function

- [ ] Function visibile in Dashboard > Edge Functions
- [ ] Status = "Active"
- [ ] Nessun errore nei logs recenti

### 7. Test Funzionali

#### Test Accesso
- [ ] Login come admin
- [ ] Verificare visibilità menu Admin > Gestione Utenti
- [ ] Navigare su `/admin/users`
- [ ] Verificare caricamento lista utenti

#### Test Creazione Utente
- [ ] Cliccare "Nuovo Utente"
- [ ] Compilare form con dati validi
- [ ] Confermare creazione
- [ ] Verificare utente in lista
- [ ] Verificare utente creato in `auth.users` (Dashboard Supabase)
- [ ] Testare login con nuovo utente

#### Test Modifica Utente
- [ ] Cliccare modifica su utente esistente
- [ ] Modificare nome e/o ruolo
- [ ] Salvare modifiche
- [ ] Verificare aggiornamento in lista
- [ ] Logout e login con utente modificato
- [ ] Verificare che i nuovi permessi siano applicati

#### Test Reset Password
- [ ] Cliccare reset password su utente
- [ ] Inserire nuova password (es. "NewPass123")
- [ ] Confermare
- [ ] Logout
- [ ] Login con utente e nuova password
- [ ] Verificare successo login

#### Test Sospensione
- [ ] Login con utente test
- [ ] Aprire seconda tab/browser come admin
- [ ] Sospendere utente test
- [ ] Verificare che utente test venga disconnesso
- [ ] Tentare nuovo login con utente sospeso
- [ ] Verificare messaggio errore "Account sospeso"
- [ ] Riattivare utente
- [ ] Verificare login funzionante

#### Test Eliminazione
- [ ] Creare utente test
- [ ] Creare richiesta con utente test
- [ ] Come admin, eliminare utente test
- [ ] Confermare eliminazione
- [ ] Verificare utente rimosso da lista
- [ ] Verificare utente rimosso da `auth.users`
- [ ] Verificare gestione richieste orfane (cascade o errore)

#### Test Ruolo userdm329
- [ ] Creare utente con ruolo `userdm329`
- [ ] Login con utente userdm329
- [ ] Verificare redirect a dashboard DM329
- [ ] Verificare visibilità solo richieste DM329
- [ ] Tentare accesso a richieste non-DM329 (dovrebbe fallire)
- [ ] Verificare possibilità di modifica richieste DM329
- [ ] Verificare negazione accesso pagine admin

### 7. Test Sicurezza

#### RLS Policies
- [ ] Login come tecnico
- [ ] Tentare accesso diretto a `/admin/users`
- [ ] Verificare redirect a homepage

- [ ] Login come utente
- [ ] Tentare accesso diretto a `/admin/users`
- [ ] Verificare redirect a homepage

- [ ] Verificare che tecnici NON possano modificare utenti
- [ ] Verificare che utenti vedano solo proprio profilo

#### API Security
- [ ] Aprire DevTools > Network
- [ ] Eseguire operazione CRUD utenti come admin
- [ ] Verificare che Service Role Key NON sia esposta
- [ ] Verificare uso di RLS in query Supabase

### 8. Test Browser Compatibility
- [ ] Chrome/Edge (Chromium)
- [ ] Firefox
- [ ] Safari (se disponibile)

### 9. Test Responsive
- [ ] Desktop (1920x1080)
- [ ] Tablet (768x1024)
- [ ] Mobile (375x667)

### 10. Performance
- [ ] Verificare tempo caricamento lista utenti (<2s)
- [ ] Verificare reattività azioni CRUD
- [ ] Controllare bundle size
  ```bash
  npm run build
  # Verificare output vite build
  ```

## Rollback Plan

### In caso di problemi critici:

1. **Rollback Codice**
   ```bash
   git revert HEAD
   git push
   ```

2. **Rollback Database**
   - Ripristinare backup pre-migration
   - O eseguire migration inversa:
   ```sql
   -- Rimuovere policies userdm329
   DROP POLICY IF EXISTS "userdm329 can view DM329 requests" ON requests;
   DROP POLICY IF EXISTS "userdm329 can update DM329 requests" ON requests;

   -- Rimuovere colonna is_suspended
   ALTER TABLE users DROP COLUMN IF EXISTS is_suspended;

   -- Rimuovere funzione helper
   DROP FUNCTION IF EXISTS is_user_suspended;

   -- NOTA: Non è possibile rimuovere un valore da ENUM senza ricreare il tipo
   -- Se necessario, contattare supporto Supabase
   ```

## Note Finali

- [ ] Documentare eventuali issue riscontrati
- [ ] Aggiornare documentazione con configurazioni specifiche
- [ ] Notificare team/utenti del deploy
- [ ] Monitorare error logs per 24-48h post-deploy

## Contatti di Emergenza

- **Supabase Support:** https://supabase.com/dashboard/support
- **Vercel Support:** https://vercel.com/support
- **Repository Issues:** [Inserire URL repository]
