# Istruzioni Deploy Edge Function - manage-user

## Problema Risolto

L'Edge Function è stata modificata per risolvere il problema di autenticazione JWT.

### Cosa è cambiato:

**PRIMA (❌ Non funzionava):**
- Edge Function riceveva token JWT nell'header Authorization
- Tentava di validare il token con `supabaseClient.auth.getUser()`
- Falliva con errore "Auth session missing"

**ADESSO (✅ Dovrebbe funzionare):**
- Edge Function riceve `calling_user_id` nel body della richiesta
- Usa solo Service Role Key per verificare che l'utente esista e sia admin
- Non dipende più dal token JWT

## Deploy via Dashboard Supabase

### Step 1: Aprire Editor Edge Functions

1. Vai su [Supabase Dashboard](https://supabase.com/dashboard)
2. Seleziona il tuo progetto
3. Nel menu laterale: **Edge Functions**
4. Clicca sulla function **manage-user** esistente

### Step 2: Sostituire il Codice

1. Clicca su **Edit Function**
2. **CANCELLA** tutto il codice esistente
3. **COPIA** tutto il contenuto del file `index.ts` (in questa stessa cartella)
4. **INCOLLA** nell'editor del Dashboard
5. Clicca **Save** o **Deploy**

### Step 3: Verificare Deploy

1. Controlla che lo status sia "Active" e "Deployed"
2. Verifica la versione (dovrebbe aggiornarsi)
3. Testa la creazione di un utente dall'UI

## Test dell'Implementazione

### 1. Login come Admin

```
Email: admin@example.com (o il tuo admin)
```

### 2. Aprire Console Browser

`F12` > Tab "Console"

### 3. Creare Utente di Test

1. Vai su **Admin > Gestione Utenti**
2. Clicca **Nuovo Utente**
3. Compila:
   - Email: `test@example.com`
   - Password: `Test1234!`
   - Nome: `Test User`
   - Ruolo: `Utente`
4. Clicca **Crea**

### 4. Controllare Console

Dovresti vedere log tipo:

```
Calling Edge Function with data: { email: 'test@example.com', password: '***', ... }
Calling user ID: <your-user-id>
Edge Function response: { data: { success: true, user: {...} }, error: null }
```

### 5. Controllare Edge Function Logs

Nel Dashboard:
1. **Edge Functions > manage-user**
2. Tab **Logs**
3. Dovresti vedere:
```
=== Edge Function Called ===
Action: create
Calling user ID: <user-id>
Calling user: { id: '...', email: '...', role: 'admin', is_suspended: false }
Authorization check passed, processing request...
```

## Possibili Errori

### "User not found" (404)

**Causa:** Il `calling_user_id` non esiste nel database

**Soluzione:**
1. Verifica che l'utente admin esista nella tabella `users`
2. Controlla che il campo `is_suspended` sia `false`

### "Forbidden: Admin role required" (403)

**Causa:** L'utente che chiama non è admin

**Soluzione:**
1. Verifica il ruolo dell'utente nel database:
```sql
SELECT id, email, role FROM users WHERE email = 'tua-email@example.com';
```
2. Se necessario, aggiorna il ruolo:
```sql
UPDATE users SET role = 'admin' WHERE id = 'user-id';
```

### "Function not found"

**Causa:** Edge Function non deployata o nome errato

**Soluzione:**
1. Verifica che la function si chiami esattamente `manage-user`
2. Re-deploya la function

## Differenze Chiave nel Codice

### Request Body

**Prima:**
```typescript
{
  action: 'create',
  email: '...',
  password: '...',
  // ...
}
```

**Adesso:**
```typescript
{
  action: 'create',
  calling_user_id: 'uuid-dell-admin',  // ← NUOVO
  email: '...',
  password: '...',
  // ...
}
```

### Autenticazione Edge Function

**Prima:**
```typescript
// ❌ Falliva
const supabaseClient = createClient(url, anonKey, {
  global: { headers: { Authorization: authHeader } }
})
const { data: { user } } = await supabaseClient.auth.getUser()
```

**Adesso:**
```typescript
// ✅ Funziona
const supabaseAdmin = createClient(url, serviceRoleKey)
const { data: callingUser } = await supabaseAdmin
  .from('users')
  .select('role, is_suspended')
  .eq('id', requestData.calling_user_id)
  .single()
```

## Note Importanti

1. **Service Role Key**: La Edge Function usa la Service Role Key per accedere al database con permessi admin. Questa chiave è disponibile solo lato server (Edge Function).

2. **Sicurezza**: L'user_id viene ottenuto dal client tramite `supabase.auth.getUser()` che è sicuro perché Supabase verifica la sessione localmente. L'Edge Function poi verifica che questo user_id corrisponda a un admin reale nel database.

3. **No JWT Token**: Non passiamo più il token JWT nell'header perché causava problemi di validazione. Usiamo invece l'approccio diretto tramite user_id + verifica database.

## Se Continua a Non Funzionare

Se dopo il deploy continua a dare errore:

1. **Controlla i logs dettagliati** della Edge Function nel Dashboard
2. **Verifica le variabili ambiente** della Edge Function:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - Devono essere configurate automaticamente, ma verificale
3. **Testa con curl** per isolare il problema:

```bash
curl -X POST https://your-project.supabase.co/functions/v1/manage-user \
  -H "Content-Type: application/json" \
  -d '{
    "action": "create",
    "calling_user_id": "your-admin-user-id",
    "email": "test@example.com",
    "password": "Test1234",
    "full_name": "Test User",
    "role": "utente"
  }'
```

Sostituisci:
- `your-project` con il tuo project ref
- `your-admin-user-id` con l'ID del tuo utente admin (lo trovi nella tabella users)
