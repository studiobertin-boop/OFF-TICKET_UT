# Email Notifications - Guida Deployment

## Checklist Completa per l'Implementazione

### ✅ Fase 1: Verifica File Creati

Assicurati che tutti i file siano presenti:

- [x] `supabase/functions/send-notification-email/index.ts`
- [x] `supabase/functions/test-notification-email/index.ts`
- [x] `supabase/migrations/20251106000001_add_email_notifications.sql`
- [x] `src/pages/NotificationSettings.tsx` (modificato)
- [x] `setup-email-secrets.sh`
- [x] `setup-email-secrets.ps1`
- [x] `supabase/migrations/APPLY_DATABASE_SETTINGS_FOR_EMAIL.sql`
- [x] `DOCUMENTAZIONE/EMAIL_NOTIFICATIONS_SETUP.md`

### 📋 Fase 2: Deploy (Esegui in Ordine)

#### Step 1: Configurazione Secrets Supabase

**Opzione A - Script Automatico (Consigliato)**

```bash
# Linux/Mac
bash setup-email-secrets.sh

# Windows PowerShell
.\setup-email-secrets.ps1
```

**Opzione B - Manuale via CLI**

```bash
supabase secrets set RESEND_API_KEY=re_gmvhhY1N_3muRNSkMKLKZwfYJ9egpKfas
supabase secrets set EMAIL_FROM=notifiche@officomp.it
supabase secrets set APP_URL=https://off-ticket-ut.vercel.app
```

**Opzione C - Via Dashboard**

1. Vai su [Supabase Dashboard](https://app.supabase.com)
2. Seleziona progetto
3. Settings > Edge Functions > Secrets
4. Aggiungi manualmente:
   - `RESEND_API_KEY`: `re_gmvhhY1N_3muRNSkMKLKZwfYJ9egpKfas`
   - `EMAIL_FROM`: `notifiche@officomp.it`
   - `APP_URL`: `https://off-ticket-ut.vercel.app`

#### Step 2: Deploy Edge Functions

```bash
# Deploy send-notification-email
supabase functions deploy send-notification-email

# Deploy test-notification-email
supabase functions deploy test-notification-email
```

**Verifica deploy:**

```bash
supabase functions list
```

Dovresti vedere entrambe le funzioni nella lista.

#### Step 3: Configura Database Settings

1. Apri Supabase Dashboard
2. Vai su SQL Editor
3. Apri il file `supabase/migrations/APPLY_DATABASE_SETTINGS_FOR_EMAIL.sql`
4. **SOSTITUISCI i placeholder:**
   - `YOUR_PROJECT_REF`: Prendi da Settings > API > Project URL (es: `abcdefghijklmnopqrst`)
   - `YOUR_ANON_KEY`: Prendi da Settings > API > anon public key
5. Esegui lo script modificato

**Esempio script modificato:**

```sql
ALTER DATABASE postgres SET app.settings.supabase_url = 'https://abcdefghijklmnopqrst.supabase.co';
ALTER DATABASE postgres SET app.settings.supabase_anon_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

**Verifica configurazione:**

```sql
SELECT name, setting
FROM pg_settings
WHERE name LIKE 'app.settings%';
```

#### Step 4: Applica Migration Database

**Opzione A - Via CLI (Development)**

```bash
supabase db push
```

**Opzione B - Via Dashboard (Production - Consigliato)**

1. Apri SQL Editor
2. Copia contenuto di `supabase/migrations/20251106000001_add_email_notifications.sql`
3. Incolla ed esegui
4. Verifica che non ci siano errori

**Verifica migration:**

```sql
-- Controlla che la funzione sia aggiornata
SELECT routine_name, routine_definition
FROM information_schema.routines
WHERE routine_name = 'create_notification'
AND routine_schema = 'public';

-- Controlla che pg_net sia installato
SELECT * FROM pg_available_extensions WHERE name = 'pg_net';
```

#### Step 5: Deploy Frontend (Vercel)

Il frontend è già aggiornato. Esegui il deploy su Vercel:

```bash
# Commit changes
git add .
git commit -m "feat: Add email notification system with Resend integration"
git push origin main
```

Vercel farà il deploy automatico.

### 🧪 Fase 3: Testing

#### Test 1: Email di Test (Admin Only)

1. Accedi come **admin**
2. Vai su **Impostazioni Notifiche**
3. Scorri fino a "Test Email (Solo Admin)"
4. Clicca "Invia Email di Test"
5. Verifica che:
   - Alert successo appare
   - Email arriva nella tua casella
   - Template HTML è corretto
   - Link funzionano

#### Test 2: Notifica Creazione Richiesta

1. Abilita "Notifiche via email" nelle impostazioni
2. Crea una nuova richiesta
3. Verifica che:
   - Notifica in-app arriva ✓
   - Email arriva ✓
   - Subject: `"[Cliente] - [Tipo] - Nuova richiesta creata"`
   - Contenuto email corretto
   - Link alla richiesta funziona

#### Test 3: Notifica Cambio Stato

1. Abilita una specifica transizione (es: APERTA → ASSEGNATA)
2. Cambia stato di una richiesta
3. Verifica email arriva con dettagli corretti

#### Test 4: Notifica Blocco/Sblocco

1. Blocca una richiesta (→ SOSPESA)
2. Verifica email "richiesta bloccata"
3. Sblocca richiesta (SOSPESA → altro stato)
4. Verifica email "richiesta sbloccata"

#### Test 5: Rispetto Preferenze

1. Disabilita "Notifiche via email"
2. Genera un evento
3. Verifica che:
   - Notifica in-app arriva ✓
   - Email NON arriva ✓

#### Test 6: Transizioni Configurabili

1. Disabilita una specifica transizione
2. Genera quella transizione
3. Verifica che email NON arriva

### 📊 Fase 4: Monitoraggio

#### Monitoraggio Edge Functions

```bash
# Log in tempo reale send-notification-email
supabase functions logs send-notification-email --follow

# Log specifico periodo
supabase functions logs send-notification-email --since 1h

# Log test function
supabase functions logs test-notification-email
```

#### Monitoraggio Database

```sql
-- Notifiche create oggi
SELECT COUNT(*) as total_notifications
FROM notifications
WHERE created_at >= CURRENT_DATE;

-- Errori email (cerca in pg logs)
SELECT * FROM pg_stat_statements
WHERE query LIKE '%send-notification-email%'
ORDER BY last_exec_time DESC
LIMIT 10;

-- Preferenze utente email
SELECT
  u.email,
  u.full_name,
  unp.in_app,
  unp.email as email_enabled
FROM user_notification_preferences unp
JOIN users u ON u.id = unp.user_id;
```

#### Monitoraggio Resend

1. Vai su [Resend Dashboard](https://resend.com/dashboard)
2. Controlla:
   - Email inviate oggi
   - Bounce rate
   - Errori
   - Delivery rate

### 🔧 Troubleshooting

#### Problema: Email non arrivano

**Verifica 1: Secrets configurati?**

```bash
supabase secrets list
```

Dovresti vedere:
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `APP_URL`

**Verifica 2: Edge Function funziona?**

```bash
# Test manuale via curl
curl -X POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/test-notification-email' \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

**Verifica 3: Database settings configurati?**

```sql
SELECT name, setting FROM pg_settings WHERE name LIKE 'app.settings%';
```

**Verifica 4: Preferenze utente?**

```sql
SELECT * FROM user_notification_preferences WHERE user_id = 'USER_ID';
```

**Verifica 5: Log Edge Function**

```bash
supabase functions logs send-notification-email --since 10m
```

Cerca errori come:
- `Resend API error`
- `Missing required fields`
- `Authorization failed`

#### Problema: Template HTML non rendering

- Testa su client diversi (Gmail, Outlook, Apple Mail)
- Valida HTML: [validator.w3.org](https://validator.w3.org)
- Usa [Litmus](https://litmus.com) per preview multi-client

#### Problema: Performance lente

- Verifica cold start Edge Functions (primo invio più lento)
- Controlla latenza Resend API
- Monitora `pg_net` overhead

### ✅ Checklist Finale Deployment

- [ ] Secrets Supabase configurati
- [ ] Edge Functions deployate
- [ ] Database settings configurati
- [ ] Migration database applicata
- [ ] Frontend deployato su Vercel
- [ ] Test email inviata con successo
- [ ] Test notifica creazione richiesta ✓
- [ ] Test notifica cambio stato ✓
- [ ] Test notifica blocco/sblocco ✓
- [ ] Test rispetto preferenze utente ✓
- [ ] Monitoraggio Resend attivo
- [ ] Log Edge Functions verificati

### 📖 Documentazione

- **Setup completo**: `DOCUMENTAZIONE/EMAIL_NOTIFICATIONS_SETUP.md`
- **Deployment**: `DOCUMENTAZIONE/EMAIL_NOTIFICATIONS_DEPLOY.md` (questo file)
- **Migration SQL**: `supabase/migrations/20251106000001_add_email_notifications.sql`
- **Database settings**: `supabase/migrations/APPLY_DATABASE_SETTINGS_FOR_EMAIL.sql`

### 🚀 Post-Deployment

1. **Comunica agli utenti** la nuova funzionalità
2. **Monitora per 48h** email inviate e delivery rate
3. **Raccogli feedback** su template email
4. **Ottimizza** se necessario (colori, contenuto, frequenza)

### 📈 Metriche da Monitorare

- **Email inviate/giorno**: Target ~100-200 (20 utenti × 20 ticket/settimana)
- **Delivery rate**: Target >95%
- **Bounce rate**: Target <5%
- **Errori Edge Function**: Target <1%
- **Tempo medio invio**: Target <2 secondi

### 🎯 Next Steps (Opzionali)

1. **Digest email**: Email riassuntiva giornaliera
2. **Template personalizzati**: Template diversi per tipo evento
3. **Attachments**: Allegare PDF richiesta
4. **Reply-to**: Supporto risposta → commento
5. **Unsubscribe**: Link disattivazione rapida
6. **A/B Testing**: Test subject/template
7. **Analytics**: Tracciamento aperture/click
