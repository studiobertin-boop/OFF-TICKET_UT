# Edge Function: manage-user

## Scopo

Questa Edge Function gestisce operazioni CRUD sugli utenti che richiedono accesso all'Admin API di Supabase.

## Perché serve?

Il client browser non può usare `supabase.auth.admin.*` perché richiede la **Service Role Key**, che non può essere esposta nel client per motivi di sicurezza.

La Edge Function:
- Gira lato server su infrastruttura Supabase
- Ha accesso sicuro alla Service Role Key
- Verifica che l'utente chiamante sia admin
- Esegue operazioni privilegiate in modo sicuro

## Azioni Supportate

### 1. Create User
```typescript
{
  action: 'create',
  email: string,
  password: string,
  full_name: string,
  role: 'admin' | 'tecnico' | 'utente' | 'userdm329'
}
```

**Cosa fa:**
- Crea utente in `auth.users`
- Aggiorna profilo in `public.users` con ruolo corretto
- Rollback automatico in caso di errore

### 2. Update User
```typescript
{
  action: 'update',
  userId: string,
  full_name?: string,
  role?: 'admin' | 'tecnico' | 'utente' | 'userdm329',
  is_suspended?: boolean
}
```

**Cosa fa:**
- Aggiorna profilo utente in `public.users`
- Permette cambio ruolo e sospensione

### 3. Delete User
```typescript
{
  action: 'delete',
  userId: string
}
```

**Cosa fa:**
- Elimina utente da `auth.users`
- CASCADE elimina automaticamente da `public.users`

### 4. Reset Password
```typescript
{
  action: 'reset-password',
  userId: string,
  newPassword: string
}
```

**Cosa fa:**
- Resetta password utente senza richiedere la vecchia
- Usa Admin API per bypass

## Sicurezza

### Autenticazione
- Richiede header `Authorization` con JWT token valido
- Verifica che l'utente sia autenticato

### Autorizzazione
- Controlla che l'utente abbia ruolo `admin`
- Ritorna 403 Forbidden se non admin

### CORS
- Configurato per accettare richieste dal client
- Headers CORS inclusi in tutte le risposte

## Deployment

```bash
# Deploy
supabase functions deploy manage-user

# Logs
supabase functions logs manage-user

# Test locale
supabase functions serve manage-user
```

Vedere `DOCUMENTAZIONE/EDGE_FUNCTION_DEPLOYMENT.md` per guida completa.

## Utilizzo nel Client

```typescript
import { supabase } from './supabase'

// Creare utente
const { data, error } = await supabase.functions.invoke('manage-user', {
  body: {
    action: 'create',
    email: 'nuovo@example.com',
    password: 'password123',
    full_name: 'Nuovo Utente',
    role: 'utente',
  },
})

// Aggiornare utente
const { data, error } = await supabase.functions.invoke('manage-user', {
  body: {
    action: 'update',
    userId: 'uuid-here',
    role: 'tecnico',
  },
})

// Eliminare utente
const { data, error } = await supabase.functions.invoke('manage-user', {
  body: {
    action: 'delete',
    userId: 'uuid-here',
  },
})

// Reset password
const { data, error } = await supabase.functions.invoke('manage-user', {
  body: {
    action: 'reset-password',
    userId: 'uuid-here',
    newPassword: 'nuovapassword123',
  },
})
```

## Risposta

**Successo:**
```json
{
  "success": true,
  "user": { ... }  // Solo per create e update
}
```

**Errore:**
```json
{
  "error": "Messaggio errore"
}
```

## Variabili d'Ambiente

La function ha automaticamente accesso a:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

✅ Non serve configurare nulla!

## Monitoring

Dashboard Supabase > Edge Functions > manage-user mostra:
- Numero invocazioni
- Errori
- Latenza
- Logs in real-time

## Troubleshooting

### "Function not found"
- Verificare deploy: `supabase functions list`
- Ri-deployare se necessario

### "Unauthorized"
- Token JWT non valido o scaduto
- Fare logout/login nell'app

### "Forbidden"
- Utente non è admin
- Verificare ruolo nel database

### "Auth error"
- Email già in uso (per create)
- Password troppo debole
- Utente non esiste (per update/delete)

## Note

- Timeout massimo: 60 secondi
- Memoria: 150MB
- Rate limit: Gestito automaticamente da Supabase
- Retry: Il client gestisce automaticamente retry su errori temporanei
