# Setup Email Notifications - Sistema Ticketing

## Panoramica

Sistema completo di notifiche email integrato con il sistema di notifiche in-app esistente. Le email vengono inviate tramite Resend e rispettano le preferenze utente configurate nella pagina Impostazioni Notifiche.

## Componenti Implementati

### 1. Edge Functions

#### `send-notification-email`
- **Percorso**: `supabase/functions/send-notification-email/index.ts`
- **Scopo**: Invia email di notifica via Resend con template HTML professionale
- **Features**:
  - Template HTML responsive con branding Officomp
  - Subject dinamico basato su tipo evento
  - Link diretto alla richiesta
  - Dettagli completi: titolo, cliente, tipo, stato, tecnico assegnato
  - Gestione errori silente (non blocca notifiche in-app)

#### `test-notification-email`
- **Percorso**: `supabase/functions/test-notification-email/index.ts`
- **Scopo**: Endpoint per test invio email (solo admin)
- **Usage**: Invia email di test all'admin corrente per verificare configurazione

### 2. Database Migration

**File**: `supabase/migrations/20251106000001_add_email_notifications.sql`

Aggiornamenti:
- Extension `pg_net` per chiamate HTTP asincrone
- Funzione `create_notification()` modificata per:
  - Verificare preferenza `email = true`
  - Recuperare dati completi utente e richiesta
  - Chiamare Edge Function via `net.http_post()`
  - Gestire errori senza bloccare notifica in-app

### 3. Frontend

**File**: `src/pages/NotificationSettings.tsx`

Modifiche:
- Toggle email abilitato (rimosso `disabled`)
- Label aggiornata: "Notifiche via email"

## Configurazione Secrets Supabase

### Opzione 1: Via Supabase Dashboard

1. Vai su [Supabase Dashboard](https://app.supabase.com)
2. Seleziona il progetto
3. Vai su **Settings** > **Edge Functions** > **Secrets**
4. Aggiungi i seguenti secrets:

```
RESEND_API_KEY=re_gmvhhY1N_3muRNSkMKLKZwfYJ9egpKfas
EMAIL_FROM=notifiche@officomp.it
APP_URL=https://off-ticket-ut.vercel.app
```

### Opzione 2: Via Supabase CLI

```bash
# Configura secrets per Edge Functions
supabase secrets set RESEND_API_KEY=re_gmvhhY1N_3muRNSkMKLKZwfYJ9egpKfas
supabase secrets set EMAIL_FROM=notifiche@officomp.it
supabase secrets set APP_URL=https://off-ticket-ut.vercel.app
```

### Opzione 3: Configurazione Database per pg_net

Per permettere a `pg_net` di chiamare le Edge Functions, configura anche:

```sql
-- Esegui nel SQL Editor del Dashboard
ALTER DATABASE postgres SET app.settings.supabase_url = 'https://your-project-ref.supabase.co';
ALTER DATABASE postgres SET app.settings.supabase_anon_key = 'your-anon-key-here';
```

**Sostituisci:**
- `your-project-ref` con il ref del tuo progetto
- `your-anon-key-here` con la chiave anonima (Settings > API > anon public)

## Deploy Edge Functions

```bash
# Deploy entrambe le funzioni
supabase functions deploy send-notification-email
supabase functions deploy test-notification-email
```

## Applicare Migration Database

### Via Dashboard (consigliato per produzione)

1. Apri **SQL Editor**
2. Copia il contenuto di `supabase/migrations/20251106000001_add_email_notifications.sql`
3. Incolla ed esegui

### Via CLI (per development)

```bash
supabase db push
```

## Testing

### 1. Test Email di Sistema

Come **admin**, chiama l'endpoint di test:

```bash
# Ottieni il token JWT dalla sessione
curl -X POST \
  'https://your-project-ref.supabase.co/functions/v1/test-notification-email' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json'
```

Oppure via frontend (aggiungi temporaneamente un bottone in NotificationSettings):

```typescript
const handleTestEmail = async () => {
  const { data, error } = await supabase.functions.invoke('test-notification-email')
  if (error) console.error('Test failed:', error)
  else console.log('Test success:', data)
}
```

### 2. Test Eventi Reali

1. Accedi come utente
2. Vai su **Impostazioni Notifiche**
3. Abilita "Notifiche via email"
4. Abilita alcune transizioni di stato
5. Crea/modifica una richiesta per generare evento
6. Verifica ricezione email

### 3. Verifica Template Email

Client email consigliati per test:
- Gmail (web + mobile)
- Outlook (web + desktop)
- Apple Mail (iOS + macOS)

## Workflow Completo

```
┌─────────────────┐
│  Evento DB      │
│  (INSERT/UPDATE)│
└────────┬────────┘
         │
         v
┌─────────────────┐
│ Trigger SQL     │
│ notify_request  │
│ _status_change()│
└────────┬────────┘
         │
         v
┌─────────────────┐
│ create_         │
│ notification()  │
└────┬───────┬────┘
     │       │
     v       v
┌────────┐ ┌──────────────┐
│in_app  │ │email (se     │
│notif   │ │enabled)      │
└────────┘ └──────┬───────┘
                  │
                  v
           ┌──────────────┐
           │pg_net.http   │
           │_post()       │
           └──────┬───────┘
                  │
                  v
           ┌──────────────┐
           │Edge Function │
           │send-notif... │
           └──────┬───────┘
                  │
                  v
           ┌──────────────┐
           │Resend API    │
           │(email sent)  │
           └──────────────┘
```

## Gestione Errori

- **Email failure**: Loggato ma non blocca notifica in-app
- **Resend API error**: Ritorna 200 per evitare retry loops
- **Missing secrets**: Log warning, notifica in-app funziona
- **Invalid email**: Gestito da Resend, log errore

## Monitoraggio

### Log Edge Functions

```bash
# Visualizza log send-notification-email
supabase functions logs send-notification-email

# Visualizza log in tempo reale
supabase functions logs send-notification-email --follow
```

### Log Database

```sql
-- Visualizza warning/errori email
SELECT * FROM pg_stat_statements
WHERE query LIKE '%send-notification-email%';
```

### Resend Dashboard

Monitora invii, bounce rate, errori su [resend.com/dashboard](https://resend.com/dashboard)

## Personalizzazione Template

Il template HTML è nel file `supabase/functions/send-notification-email/index.ts`:

### Modifica Colori Brand

```typescript
// Header gradient
background: linear-gradient(135deg, #1e293b 0%, #334155 100%);

// CTA button
background-color: #3b82f6;

// Status badge
background-color: #3b82f6;
```

### Modifica Logo

Aggiungi logo come immagine inline nel template:

```html
<img src="https://your-cdn.com/logo.png" alt="Officomp" style="max-width: 200px;">
```

### Modifica Subject

Funzione `generateSubject()` in `index.ts`:

```typescript
function generateSubject(payload: EmailPayload): string {
  // Personalizza qui la logica subject
}
```

## Preferenze Utente

Gli utenti possono configurare:
- ✅ In-app notifications (on/off)
- ✅ Email notifications (on/off)
- ✅ Specifiche transizioni di stato per cui ricevere notifiche

Eventi **sempre attivi** (non disabilitabili):
- Creazione nuova richiesta
- Blocco richiesta (→ SOSPESA)
- Sblocco richiesta (SOSPESA → altro stato)

## Troubleshooting

### Email non arrivano

1. Verifica secrets configurati:
   ```bash
   supabase secrets list
   ```

2. Controlla log Edge Function:
   ```bash
   supabase functions logs send-notification-email
   ```

3. Verifica preferenze utente:
   ```sql
   SELECT * FROM user_notification_preferences WHERE user_id = 'USER_ID';
   ```

4. Controlla Resend Dashboard per errori

### Template HTML non rendering

1. Testa su [litmus.com](https://litmus.com) o [emailonacid.com](https://emailonacid.com)
2. Valida HTML su [validator.w3.org](https://validator.w3.org)
3. Test inline CSS

### Performance Issues

1. Usa `pg_net` (asincrono) invece di `http` extension
2. Monitora Supabase Edge Function cold starts
3. Considera batching per notifiche multiple

## Costi Stimati

### Resend
- **Free tier**: 100 email/giorno
- **Pro**: $20/mese per 50,000 email/mese
- **Stima**: 20 utenti × 20 ticket/settimana × ~5 notifiche/ticket = ~2,000 email/mese (free tier ok)

### Supabase Edge Functions
- **Free tier**: 500,000 invocazioni/mese
- **Pro**: Incluso nel piano
- **Stima**: Trascurabili con 2,000 invocazioni/mese

## Next Steps (Opzionali)

1. **Digest Email**: Email riassuntiva giornaliera/settimanale
2. **Rich Templates**: Template diversi per tipo evento
3. **Attachments**: Allegare PDF richiesta
4. **Reply-to**: Supporto risposta email → commento richiesta
5. **Unsubscribe**: Link per disabilitare email
6. **Email Preview**: Anteprima template nel frontend
7. **Scheduled Emails**: Reminder per richieste in stallo

## Riferimenti

- [Resend Docs](https://resend.com/docs)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [pg_net Extension](https://supabase.com/docs/guides/database/extensions/pg_net)
- [Email HTML Best Practices](https://www.emailonacid.com/blog/article/email-development/email-development-best-practices)
