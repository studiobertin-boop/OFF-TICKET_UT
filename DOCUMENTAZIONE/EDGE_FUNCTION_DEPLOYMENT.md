# Deployment Edge Function - Gestione Utenti

## Problema Risolto

**Errore:** `User not allowed` durante la creazione di utenti

**Causa:** Il client browser non può usare `supabase.auth.admin.*` che richiede la Service Role Key. Esporre questa chiave nel client sarebbe un **grave rischio di sicurezza**.

**Soluzione:** Usare una **Supabase Edge Function** che:
- Viene eseguita lato server
- Ha accesso sicuro alla Service Role Key
- Verifica che l'utente chiamante sia admin
- Esegue operazioni Admin API in modo sicuro

## Edge Function Creata

**Path:** `supabase/functions/manage-user/index.ts`

**Azioni supportate:**
- `create` - Crea nuovo utente
- `update` - Aggiorna utente esistente
- `delete` - Elimina utente
- `reset-password` - Reset password utente

## Deployment Supabase Edge Function

### Prerequisiti

1. **Supabase CLI installato:**
   ```bash
   npm install -g supabase
   ```

2. **Login Supabase CLI:**
   ```bash
   supabase login
   ```

3. **Link al progetto:**
   ```bash
   supabase link --project-ref <your-project-ref>
   ```

   Trovare il `project-ref` nella Dashboard Supabase > Settings > General

### Deploy della Edge Function

**Opzione A: Deploy via CLI (Consigliata)**

```bash
# Dalla root del progetto
supabase functions deploy manage-user
```

Questo comando:
- Compila la TypeScript Edge Function
- Carica il codice su Supabase
- Rende la function disponibile all'endpoint

**Opzione B: Deploy via Dashboard**

1. Andare su **Supabase Dashboard** > **Edge Functions**
2. Cliccare **Create a new function**
3. Nome: `manage-user`
4. Copiare il contenuto di `supabase/functions/manage-user/index.ts`
5. Cliccare **Deploy**

### Verificare Deployment

1. **Via Dashboard:**
   - Dashboard > Edge Functions
   - Verificare che `manage-user` sia presente
   - Status deve essere "Active"

2. **Via CLI:**
   ```bash
   supabase functions list
   ```

3. **Test Function:**
   ```bash
   supabase functions invoke manage-user --body '{"action":"test"}'
   ```

### Configurazione Secrets

Le Edge Functions hanno automaticamente accesso a:
- `SUPABASE_URL` - URL del progetto
- `SUPABASE_ANON_KEY` - Chiave anonima
- `SUPABASE_SERVICE_ROLE_KEY` - Chiave service role (per Admin API)

✅ **Non serve configurare nulla!** Le variabili sono già disponibili.

## URL Edge Function

Dopo il deployment, la function sarà disponibile all'URL:

```
https://<project-ref>.supabase.co/functions/v1/manage-user
```

Il client Supabase usa automaticamente questo URL quando chiami:
```typescript
supabase.functions.invoke('manage-user', { ... })
```

## Sicurezza

### Controlli Implementati

1. **Autenticazione richiesta:**
   - La function richiede header `Authorization` con JWT token
   - Verifica che l'utente sia autenticato

2. **Verifica ruolo admin:**
   - Controlla che l'utente abbia ruolo `admin`
   - Se non admin, ritorna 403 Forbidden

3. **Service Role Key protetta:**
   - Usata solo lato server nella Edge Function
   - MAI esposta al client
   - Logs non mostrano la chiave

### CORS

La function gestisce CORS per permettere chiamate dal browser:
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
```

Per ambiente production, considerare di limitare l'origin:
```typescript
'Access-Control-Allow-Origin': 'https://tuodominio.com',
```

## Testing

### Test Locale (Opzionale)

```bash
# Serve la function localmente
supabase functions serve manage-user

# In un altro terminale, testare
curl -i --location --request POST 'http://localhost:54321/functions/v1/manage-user' \
  --header 'Authorization: Bearer YOUR_JWT_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{"action":"create","email":"test@test.com","password":"password123","full_name":"Test User","role":"utente"}'
```

### Test Production

Dopo il deploy, testare dalla UI dell'applicazione:
1. Login come admin
2. Navigare su Admin > Gestione Utenti
3. Cliccare "Nuovo Utente"
4. Compilare form e creare

✅ Se funziona, la Edge Function è configurata correttamente!

## Monitoring e Logs

### Visualizzare Logs

**Via Dashboard:**
1. Dashboard > Edge Functions
2. Cliccare su `manage-user`
3. Tab "Logs"
4. Vedere richieste in real-time

**Via CLI:**
```bash
supabase functions logs manage-user
```

### Metriche

Dashboard > Edge Functions > manage-user mostra:
- Numero invocazioni
- Tempo medio esecuzione
- Tasso errori
- Utilizzo risorse

## Troubleshooting

### Errore: "Function not found"

**Soluzione:**
```bash
supabase functions deploy manage-user --project-ref <your-project-ref>
```

### Errore: "Invalid JWT"

**Causa:** Token JWT scaduto o non valido

**Soluzione:**
- Fare logout e login nell'app
- Verificare che l'header Authorization sia corretto

### Errore: "Forbidden: Admin role required"

**Causa:** Utente non è admin

**Soluzione:**
- Verificare ruolo utente nel database
- Aggiornare ruolo a 'admin' se necessario

### Errore: "Service role key not found"

**Causa:** Edge Function non ha accesso alle variabili d'ambiente

**Soluzione:**
1. Verificare che il progetto sia correttamente linkato
2. Ri-deployare la function:
   ```bash
   supabase functions deploy manage-user
   ```

### Timeout Function

**Causa:** Function impiega troppo tempo (>60s)

**Soluzione:**
- Ottimizzare query database
- Rimuovere operazioni lente
- Considerare di usare background jobs per operazioni lunghe

## Aggiornamenti Edge Function

Dopo modifiche al codice della function:

```bash
# 1. Modificare il file
nano supabase/functions/manage-user/index.ts

# 2. Ri-deployare
supabase functions deploy manage-user

# 3. Verificare nuova versione
supabase functions list
```

## Rollback

In caso di problemi con la nuova versione:

1. **Via Dashboard:**
   - Edge Functions > manage-user
   - Tab "Versions"
   - Cliccare "Restore" sulla versione precedente

2. **Via CLI:**
   ```bash
   # Checkout versione precedente del file
   git checkout HEAD~1 supabase/functions/manage-user/index.ts

   # Ri-deploy
   supabase functions deploy manage-user
   ```

## Best Practices

1. **Testare localmente** prima del deploy in production
2. **Monitorare logs** dopo deploy per individuare errori
3. **Versioning:** Committare sempre le modifiche su Git
4. **Rate Limiting:** Supabase applica automaticamente limiti
5. **Error Handling:** Loggare sempre errori dettagliati
6. **Timeout:** Mantenere operazioni sotto 30s se possibile

## Limiti Supabase Edge Functions

| Piano | Invocazioni/mese | Timeout | Memoria |
|-------|------------------|---------|---------|
| Free | 500,000 | 60s | 150MB |
| Pro | 2,000,000 | 60s | 150MB |
| Team | 10,000,000+ | 60s | 150MB |

Per il nostro caso d'uso (gestione utenti, ~100 invocazioni/mese), il piano Free è più che sufficiente.

## Checklist Deployment

- [ ] Supabase CLI installato e configurato
- [ ] Progetto linkato con `supabase link`
- [ ] File `supabase/functions/manage-user/index.ts` presente
- [ ] Deploy eseguito con `supabase functions deploy manage-user`
- [ ] Function visibile nella Dashboard > Edge Functions
- [ ] Test creazione utente dall'UI funzionante
- [ ] Logs verificati senza errori
- [ ] Test update, delete, reset password funzionanti

## Supporto

- **Documentazione:** https://supabase.com/docs/guides/functions
- **Troubleshooting:** https://supabase.com/docs/guides/functions/troubleshooting
- **Support:** https://supabase.com/dashboard/support
