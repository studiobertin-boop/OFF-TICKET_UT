# Guida Rapida - Fix Utente Admin Francesco Bertin

## Problema
Riesci a loggarti come admin con `francesco.bertin@officomp.it`, ma l'utente **non appare** in:
- Tabella `public.users` di Supabase
- Pannello "Gestione Utenti" della web app

## Causa
L'utente esiste in `auth.users` (tabella autenticazione) ma **NON** in `public.users` (tabella applicazione con ruoli/permessi).

## Soluzione in 3 Passi

### 📋 Passo 1: Apri Supabase SQL Editor
1. Vai su [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Seleziona il tuo progetto
3. Clicca su **SQL Editor** nel menu laterale sinistro
4. Clicca su **New Query**

### 📝 Passo 2: Esegui lo Script SQL
Copia e incolla **tutto il contenuto** del file:
```
supabase/FIX_FRANCESCO_BERTIN.sql
```

Oppure usa questo script veloce:

```sql
-- SINCRONIZZA utenti mancanti
INSERT INTO public.users (id, email, role, full_name, is_suspended)
SELECT
  au.id,
  au.email,
  'utente' as role,
  split_part(au.email, '@', 1) as full_name,
  false as is_suspended
FROM auth.users au
LEFT JOIN public.users u ON au.id = u.id
WHERE u.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- AGGIORNA Francesco Bertin come admin
UPDATE public.users
SET role = 'admin', full_name = 'Francesco Bertin'
WHERE email = 'francesco.bertin@officomp.it';

-- VERIFICA
SELECT email, role, full_name, is_suspended
FROM public.users
ORDER BY role, email;
```

### ✅ Passo 3: Verifica nella Web App
1. Vai alla web app
2. Naviga su **Gestione Utenti** (menu admin)
3. Dovresti vedere `francesco.bertin@officomp.it` con ruolo **Admin**
4. Dovresti vedere anche eventuali altri utenti che erano mancanti

## Cosa Fa lo Script

### Step 1-3: Diagnosi
Mostra:
- Tutti gli utenti in `auth.users`
- Tutti gli utenti in `public.users`
- Gli utenti **mancanti** in `public.users`

### Step 4: Sincronizzazione
Inserisce TUTTI gli utenti mancanti con ruolo default `utente`

### Step 5: Promozione Admin
Aggiorna `francesco.bertin@officomp.it` con:
- Role: `admin`
- Full name: `Francesco Bertin`

### Step 6-7: Verifica
Mostra tutti gli utenti sincronizzati e i dettagli di Francesco Bertin

## Risultato Atteso

Dopo aver eseguito lo script, nella tabella `public.users` dovresti vedere:

| Email | Role | Full Name | Status |
|-------|------|-----------|--------|
| francesco.bertin@officomp.it | **admin** | Francesco Bertin | Attivo |
| studiobertin@gmail.com | admin | SB | Attivo |
| ... | ... | ... | ... |

E nella web app, pannello "Gestione Utenti", vedrai la stessa lista.

## Troubleshooting

### ❌ "Non vedo ancora Francesco Bertin"
1. Fai refresh della pagina "Gestione Utenti"
2. Verifica in Supabase Table Editor:
   - Vai su **Table Editor** > **users**
   - Cerca `francesco.bertin@officomp.it`

### ❌ "Vedo l'utente ma non è admin"
Riesegui solo questo:
```sql
UPDATE public.users
SET role = 'admin', full_name = 'Francesco Bertin'
WHERE email = 'francesco.bertin@officomp.it';
```

### ❌ "L'utente c'è ma il login non funziona"
Verifica che `is_suspended` sia `false`:
```sql
UPDATE public.users
SET is_suspended = false
WHERE email = 'francesco.bertin@officomp.it';
```

## File Correlati

- [FIX_FRANCESCO_BERTIN.sql](../supabase/FIX_FRANCESCO_BERTIN.sql) - Script completo con diagnosi
- [APPLY_FIX_ADMIN_USER_SYNC.sql](../supabase/APPLY_FIX_ADMIN_USER_SYNC.sql) - Script alternativo
- [FIX_LOGIN_ADMIN_SYNC.md](FIX_LOGIN_ADMIN_SYNC.md) - Documentazione dettagliata del problema

## Prevenzione Futura

Questo problema accade quando crei utenti in `auth.users` (via Supabase Dashboard > Authentication) senza crearli anche in `public.users`.

**Best Practice**:
- Usa sempre il pannello "Gestione Utenti" della web app per creare nuovi utenti
- La web app gestisce automaticamente entrambe le tabelle

Se devi creare utenti manualmente:
1. Crea in `auth.users` (Supabase Dashboard > Authentication)
2. Crea SUBITO in `public.users` usando questo template:
```sql
INSERT INTO public.users (id, email, role, full_name, is_suspended)
VALUES (
  'ID_FROM_AUTH_USERS',
  'email@example.com',
  'utente',  -- o 'admin', 'tecnico', 'userdm329'
  'Nome Cognome',
  false
);
```

## Supporto

Se il problema persiste dopo aver seguito questi passi:
1. Controlla i log del browser (F12 > Console)
2. Controlla che le RLS policies siano applicate correttamente
3. Verifica che il ruolo sia scritto correttamente (`admin`, non `Admin` o `ADMIN`)
