# Email Notifications - Quick Reference

## 🚀 Deploy Rapido (5 minuti)

### 1. Configura Secrets

```bash
# Windows PowerShell
.\setup-email-secrets.ps1

# Linux/Mac
bash setup-email-secrets.sh
```

### 2. Deploy Edge Functions

```bash
supabase functions deploy send-notification-email
supabase functions deploy test-notification-email
```

### 3. Configura Database

1. Apri Supabase Dashboard > SQL Editor
2. Modifica e esegui `supabase/migrations/APPLY_DATABASE_SETTINGS_FOR_EMAIL.sql`
   - Sostituisci `YOUR_PROJECT_REF` e `YOUR_ANON_KEY`
3. Esegui `supabase/migrations/20251106000001_add_email_notifications.sql`

### 4. Deploy Frontend

```bash
git add .
git commit -m "feat: Add email notifications"
git push origin main
```

### 5. Test

1. Accedi come admin
2. Vai su Impostazioni Notifiche
3. Clicca "Invia Email di Test"
4. ✅ Verifica email ricevuta

## 📁 File Creati

```
supabase/
  functions/
    send-notification-email/index.ts    # Edge Function invio email
    test-notification-email/index.ts    # Edge Function test
  migrations/
    20251106000001_add_email_notifications.sql         # Migration principale
    APPLY_DATABASE_SETTINGS_FOR_EMAIL.sql              # Config DB manuale

src/
  pages/
    NotificationSettings.tsx            # UI aggiornata con toggle email + test

DOCUMENTAZIONE/
  EMAIL_NOTIFICATIONS_SETUP.md          # Guida completa setup
  EMAIL_NOTIFICATIONS_DEPLOY.md         # Guida deployment step-by-step

setup-email-secrets.sh                  # Script config secrets (Linux/Mac)
setup-email-secrets.ps1                 # Script config secrets (Windows)
```

## ⚙️ Configurazione

### Secrets Supabase

```
RESEND_API_KEY=re_gmvhhY1N_3muRNSkMKLKZwfYJ9egpKfas
EMAIL_FROM=notifiche@officomp.it
APP_URL=https://off-ticket-ut.vercel.app
```

### Database Settings

```sql
ALTER DATABASE postgres SET app.settings.supabase_url = 'https://[PROJECT_REF].supabase.co';
ALTER DATABASE postgres SET app.settings.supabase_anon_key = '[ANON_KEY]';
```

## 🧪 Test Commands

```bash
# Log Edge Function
supabase functions logs send-notification-email --follow

# Verifica secrets
supabase secrets list

# Verifica DB settings
# Esegui nel SQL Editor:
SELECT name, setting FROM pg_settings WHERE name LIKE 'app.settings%';
```

## 📧 Come Funziona

1. **Trigger DB**: Evento su richiesta → trigger `notify_request_status_change()`
2. **Filtro Preferenze**: Funzione `create_notification()` verifica `email = true`
3. **Chiamata Asincrona**: `pg_net.http_post()` chiama Edge Function
4. **Invio Email**: Edge Function chiama Resend API
5. **Gestione Errori**: Fallimento email non blocca notifica in-app

## 🎯 Feature Implementate

- ✅ Template HTML responsive professionale
- ✅ Subject dinamico basato su evento
- ✅ Link diretto alla richiesta
- ✅ Dettagli completi richiesta in email
- ✅ Rispetto preferenze utente (on/off)
- ✅ Rispetto transizioni configurabili
- ✅ Gestione errori silente
- ✅ Endpoint test per admin
- ✅ UI toggle email abilitato

## 📖 Documentazione Completa

- **Setup**: [EMAIL_NOTIFICATIONS_SETUP.md](DOCUMENTAZIONE/EMAIL_NOTIFICATIONS_SETUP.md)
- **Deploy**: [EMAIL_NOTIFICATIONS_DEPLOY.md](DOCUMENTAZIONE/EMAIL_NOTIFICATIONS_DEPLOY.md)

## 🐛 Troubleshooting Veloce

**Email non arrivano?**

```bash
# 1. Verifica secrets
supabase secrets list

# 2. Verifica log Edge Function
supabase functions logs send-notification-email --since 10m

# 3. Verifica preferenze utente nel DB
# SELECT * FROM user_notification_preferences WHERE user_id = 'USER_ID';
```

**Template non rendering?**
- Test su Gmail, Outlook, Apple Mail
- Verifica HTML valido: [validator.w3.org](https://validator.w3.org)

## 🎨 Personalizzazione Template

File: `supabase/functions/send-notification-email/index.ts`

**Colori brand:**
- Header gradient: `#1e293b` → `#334155`
- CTA button: `#3b82f6`
- Status badge: `#3b82f6`

**Subject:**
Funzione `generateSubject()` - personalizza logica

**Contenuto:**
Funzione `generateEmailHTML()` - modifica template HTML

## 📊 Monitoraggio

- **Resend Dashboard**: [resend.com/dashboard](https://resend.com/dashboard)
- **Edge Functions Logs**: `supabase functions logs send-notification-email`
- **Database Notifiche**: Query su tabella `notifications`

## 💰 Costi

- **Resend Free**: 100 email/giorno (ok per ~2,000 email/mese)
- **Supabase**: Funzioni incluse nel piano Free/Pro
- **Stima**: 20 utenti × 20 ticket/settimana × 5 notifiche = ~2,000 email/mese

## ✅ Quick Checklist

- [ ] Secrets configurati
- [ ] Edge Functions deployate
- [ ] DB settings configurati
- [ ] Migration applicata
- [ ] Frontend deployato
- [ ] Test email inviata con successo

## 🚨 Support

Issues o domande? Vedi:
- [EMAIL_NOTIFICATIONS_SETUP.md](DOCUMENTAZIONE/EMAIL_NOTIFICATIONS_SETUP.md) - Setup dettagliato
- [EMAIL_NOTIFICATIONS_DEPLOY.md](DOCUMENTAZIONE/EMAIL_NOTIFICATIONS_DEPLOY.md) - Troubleshooting
