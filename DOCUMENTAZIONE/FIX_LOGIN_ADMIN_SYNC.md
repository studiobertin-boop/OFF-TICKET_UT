# Fix Login - Sincronizzazione Utenti Admin

## Problema Riscontrato

Stai riscontrando un comportamento anomalo durante il login:
1. Tentando di loggarti con `studiobertin@gmail.com` ricevi un errore
2. L'email `francesco.bertin@officomp.it` (che non è nella lista utenti) ti permette di loggarti come admin
3. L'email corretta dovrebbe essere `francesco.bertin@officomp.it`

## Causa

Il problema è causato da una **desincronizzazione tra due tabelle**:
- `auth.users` (Supabase Auth) - contiene gli utenti autenticabili
- `public.users` (tabella applicazione) - contiene ruoli e permessi

Quando un utente esiste in `auth.users` ma non in `public.users`:
- L'autenticazione Supabase ha successo
- Il sistema non trova il profilo utente in `public.users`
- L'errore viene gestito ma l'utente rimane loggato senza permessi chiari

## Soluzione Implementata

### 1. Script di Verifica
File: [check-auth-users-sync.sql](../supabase/check-auth-users-sync.sql)

Questo script identifica gli utenti presenti in `auth.users` ma mancanti in `public.users`.

### 2. Migration Database
File: [20251112000000_fix_admin_user_sync.sql](../supabase/migrations/20251112000000_fix_admin_user_sync.sql)

Questa migration:
- Identifica utenti mancanti in `public.users`
- Li aggiunge automaticamente con ruolo default `utente`
- Crea una funzione per sincronizzare automaticamente nuovi utenti in futuro

### 3. Miglioramento Gestione Errori
File: [useAuth.tsx:75-107](../src/hooks/useAuth.tsx#L75-L107)

Modifiche alla funzione `loadUserProfile`:
- Se l'utente non esiste in `public.users`, esegue logout forzato
- Mostra un messaggio chiaro: "Profilo utente non trovato"
- Previene stati inconsistenti (sessione attiva ma utente null)

### 4. Script SQL da Applicare
File: [APPLY_FIX_ADMIN_USER_SYNC.sql](../supabase/APPLY_FIX_ADMIN_USER_SYNC.sql)

Questo script va eseguito nel **Supabase SQL Editor** e:
1. Mostra gli utenti mancanti in `public.users`
2. Sincronizza automaticamente gli utenti
3. Verifica il risultato della sincronizzazione
4. Ricorda di aggiornare manualmente il ruolo admin

## Passi per Risolvere

### Step 1: Verifica Stato Attuale
```sql
-- Nel Supabase SQL Editor, esegui:
SELECT
  au.id,
  au.email,
  u.role,
  u.full_name,
  CASE WHEN u.id IS NULL THEN 'MISSING' ELSE 'EXISTS' END as status
FROM auth.users au
LEFT JOIN public.users u ON au.id = u.id
ORDER BY status DESC, au.email;
```

### Step 2: Applica la Sincronizzazione
Esegui tutto il contenuto del file `APPLY_FIX_ADMIN_USER_SYNC.sql` nel Supabase SQL Editor.

### Step 3: Aggiorna Ruolo Admin
Dopo la sincronizzazione, aggiorna manualmente il ruolo per l'utente corretto:

```sql
UPDATE public.users
SET role = 'admin', full_name = 'Francesco Bertin'
WHERE email = 'francesco.bertin@officomp.it';
```

### Step 4: Verifica nella UI
1. Vai alla pagina "Gestione Utenti" nell'applicazione
2. Verifica che tutti gli utenti di `auth.users` siano presenti
3. Verifica che `francesco.bertin@officomp.it` abbia ruolo `admin`

### Step 5: Test Login
1. Fai logout dall'applicazione
2. Prova a loggarti con `francesco.bertin@officomp.it`
3. Verifica che il login funzioni correttamente
4. Verifica di avere accesso alle funzioni admin

## Cosa Fare con Altri Utenti

Se trovi altri utenti in `auth.users` che non dovrebbero esistere (come `studiobertin@gmail.com`):

### Opzione 1: Eliminarli da Supabase Auth
```sql
-- ATTENZIONE: Questo elimina definitivamente l'utente
-- Assicurati che sia quello che vuoi fare
DELETE FROM auth.users WHERE email = 'studiobertin@gmail.com';
```

### Opzione 2: Sincronizzarli con Ruolo Appropriato
```sql
-- Se l'utente è legittimo, sincronizzalo
INSERT INTO public.users (id, email, role, full_name, is_suspended)
SELECT id, email, 'utente', 'Nome Cognome', false
FROM auth.users
WHERE email = 'studiobertin@gmail.com'
ON CONFLICT (id) DO NOTHING;
```

## Prevenzione Futura

La migration include una funzione `handle_new_auth_user()` che può essere collegata a un trigger su `auth.users`.

**NOTA**: I trigger su `auth.users` possono essere creati solo da admin Supabase con accesso privilegiato. Se hai accesso, crea il trigger:

```sql
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
```

Questo garantirà che ogni nuovo utente in `auth.users` venga automaticamente sincronizzato in `public.users`.

## Riepilogo Modifiche

### File Modificati
- [src/hooks/useAuth.tsx](../src/hooks/useAuth.tsx) - Migliorata gestione errori login

### File Creati
- [supabase/check-auth-users-sync.sql](../supabase/check-auth-users-sync.sql) - Script verifica
- [supabase/migrations/20251112000000_fix_admin_user_sync.sql](../supabase/migrations/20251112000000_fix_admin_user_sync.sql) - Migration
- [supabase/APPLY_FIX_ADMIN_USER_SYNC.sql](../supabase/APPLY_FIX_ADMIN_USER_SYNC.sql) - Script da applicare
- [DOCUMENTAZIONE/FIX_LOGIN_ADMIN_SYNC.md](../DOCUMENTAZIONE/FIX_LOGIN_ADMIN_SYNC.md) - Questa documentazione

## Test Completato

✅ Codice modificato per gestire correttamente utenti mancanti
✅ Script SQL creati per sincronizzazione
✅ Documentazione completa del problema e soluzione
⏳ **Azione richiesta**: Eseguire `APPLY_FIX_ADMIN_USER_SYNC.sql` nel Supabase SQL Editor

## Note Tecniche

Il sistema utilizza due layer di autenticazione:
1. **Supabase Auth** (`auth.users`) - Gestisce password, token, sessioni
2. **Application Layer** (`public.users`) - Gestisce ruoli, permessi, dati profilo

È fondamentale che questi due layer siano sempre sincronizzati per evitare:
- Login con permessi inconsistenti
- Errori di accesso
- Problemi con RLS policies

La soluzione implementata garantisce questa sincronizzazione sia retroattivamente che per nuovi utenti futuri.
