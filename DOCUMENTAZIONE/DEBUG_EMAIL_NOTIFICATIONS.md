# Debug: Email Notifications Non Inviate

**Data**: 2025-11-08
**Problema**: Le notifiche in-app funzionano, ma le email non vengono inviate
**Test email manuale**: ✅ Funziona (bottone "Invia email di test")
**Notifiche automatiche**: ❌ Non vengono inviate

---

## Sintomi

1. ✅ Bottone "Invia Email di Test" → Email arriva correttamente
2. ✅ Toggle email abilitati per entrambi gli utenti (`studiobertin@gmail.com`, `frabertin@yahoo.it`)
3. ❌ Creazione nuova richiesta → Email NON inviata
4. ❌ Cambio stato richiesta → Email NON inviata
5. ❌ Nessun invio email visibile su Resend Dashboard

---

## Causa Probabile

La **migration per il supporto email** (`20251106000002_fix_email_notifications.sql`) **NON è stata applicata** al database production.

Questo significa che la funzione `create_notification()` nel database:
- ✅ Crea notifiche in-app (funziona)
- ❌ NON chiama l'Edge Function per inviare email (mancante)

---

## Verifica (Step 1)

### Opzione A: Via Supabase Dashboard SQL Editor

1. Vai su: https://supabase.com/dashboard/project/uphftgpwisdiubuhohnc/sql
2. Copia e incolla il contenuto di [`CHECK_EMAIL_NOTIFICATIONS_STATUS.sql`](../CHECK_EMAIL_NOTIFICATIONS_STATUS.sql)
3. Clicca "Run"
4. Analizza i risultati

### Risultati Attesi

**Se la migration NON è applicata**:
```
check_name                      | status
create_notification function   | ❌ NON ha supporto email
```

**Se la migration È applicata**:
```
check_name                      | status
create_notification function   | ✅ Ha supporto email
```

### Risultati Preferenze Utenti

Dovresti vedere:
```
user_email                | email_enabled | status
studiobertin@gmail.com   | true          | ✅ Email abilitate
frabertin@yahoo.it       | true          | ✅ Email abilitate
```

Se vedi `false` o `NULL`, il problema è nelle preferenze, non nella funzione.

---

## Soluzione (Step 2)

### Se `create_notification` NON ha supporto email

Devi applicare manualmente la migration.

**Via Supabase Dashboard SQL Editor:**

1. Vai su: https://supabase.com/dashboard/project/uphftgpwisdiubuhohnc/sql
2. Copia e incolla il contenuto di [`MANUAL_APPLY_EMAIL_FUNCTION.sql`](../MANUAL_APPLY_EMAIL_FUNCTION.sql)
3. Clicca "Run"
4. Verifica che lo status sia: `has_email_support: true`

**Via CLI (alternativa):**

```bash
# Connettiti al database
supabase db push

# Se fallisce per conflitti migration, applica manualmente:
cat MANUAL_APPLY_EMAIL_FUNCTION.sql | supabase db execute
```

### Se le Preferenze Utenti sono Disabilitate

**Via App (Frontend):**

1. Login come `studiobertin@gmail.com`
2. Vai su: Impostazioni Notifiche
3. Attiva toggle "Notifiche Email"
4. Salva
5. Ripeti per `frabertin@yahoo.it`

**Via SQL Editor (alternativa):**

```sql
-- Abilita email per studiobertin@gmail.com
UPDATE user_notification_preferences
SET email = true
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'studiobertin@gmail.com');

-- Abilita email per frabertin@yahoo.it
UPDATE user_notification_preferences
SET email = true
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'frabertin@yahoo.it');
```

---

## Test End-to-End (Step 3)

### Scenario 1: Nuova Richiesta

**Azione:**
1. Login come `frabertin@yahoo.it` (utente)
2. Crea nuova richiesta

**Risultato Atteso:**
- ✅ Notifica in-app creata per admin (`studiobertin@gmail.com`)
- ✅ Email inviata a `studiobertin@gmail.com`
- ✅ Email visibile su Resend Dashboard: https://resend.com/emails

**Verifica Email:**
- **Mittente**: `Officomp Ticketing <onboarding@resend.dev>`
- **Destinatario**: `studiobertin@gmail.com`
- **Oggetto**: `[Cliente] - [Tipo Richiesta] - Nuova richiesta creata`
- **Contenuto**: Dettagli richiesta + link "Visualizza Richiesta"

### Scenario 2: Cambio Stato Richiesta

**Azione:**
1. Login come `studiobertin@gmail.com` (admin)
2. Assegna richiesta a se stesso
3. Cambio stato: APERTA → ASSEGNATA

**Risultato Atteso:**
- ✅ Notifica in-app per creatore richiesta (`frabertin@yahoo.it`)
- ✅ Email inviata a `frabertin@yahoo.it`
- ✅ Email visibile su Resend Dashboard

**IMPORTANTE**: Per ricevere email su cambio stato, devi:
1. Andare su Impostazioni Notifiche
2. Espandere "Transizioni di Stato"
3. Attivare toggle per la transizione specifica (es. "APERTA → ASSEGNATA")

### Scenario 3: Richiesta Assegnata a Tecnico

**Azione:**
1. Login come admin
2. Assegna richiesta a tecnico diverso

**Risultato Atteso:**
- ✅ Email a creatore richiesta
- ✅ Email a tecnico assegnato
- ✅ Email a tutti gli admin

---

## Troubleshooting

### Email Non Arriva Ancora

**1. Verifica Resend Dashboard**

Vai su: https://resend.com/emails

**Cosa cercare:**
- Se vedi email con status "delivered" → Email inviata, controlla spam
- Se vedi email con status "bounced" → Indirizzo email non valido
- Se NON vedi email → Edge Function non viene chiamata

**2. Verifica Log Edge Function**

Purtroppo Supabase CLI non ha comando diretto per i log. Usa la Dashboard:

1. Vai su: https://supabase.com/dashboard/project/uphftgpwisdiubuhohnc/functions
2. Clicca su `send-notification-email`
3. Tab "Logs"
4. Guarda gli ultimi invochi

**Cosa cercare:**
- Se vedi log → Edge Function viene chiamata
- Se NON vedi log → Funzione `create_notification` non chiama Edge Function

**3. Verifica pg_net**

Se `create_notification` ha supporto email ma le email non vengono inviate, il problema potrebbe essere `pg_net`.

**Test:**

```sql
-- Verifica che pg_net sia installato
SELECT * FROM pg_extension WHERE extname = 'pg_net';

-- Se non restituisce righe, installa pg_net:
CREATE EXTENSION pg_net;
```

**NOTA**: `CREATE EXTENSION` richiede permessi superuser. Se fallisce:
- Contatta supporto Supabase
- Oppure usa il metodo alternativo (supabase_url in Edge Function)

**4. Test Manuale Chiamata HTTP**

```sql
-- Test chiamata Edge Function direttamente da SQL
SELECT net.http_post(
  url := 'https://uphftgpwisdiubuhohnc.supabase.co/functions/v1/send-notification-email',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVwaGZ0Z3B3aXNkaXVidWhvaG5jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzA5MjYyMzQsImV4cCI6MjA0NjUwMjIzNH0.Nt3n1axV5TaDPSXrzaO0PLd78pJ-T2CdhTIKJdmhEPY'
  ),
  body := jsonb_build_object(
    'to', 'francesco.bertin@officomp.it',
    'user_name', 'Test User',
    'event_type', 'request_created',
    'message', 'Test email da SQL',
    'request_id', '00000000-0000-0000-0000-000000000000',
    'metadata', '{}'::jsonb
  )
);
```

**Risultato Atteso:**
- Restituisce un ID numerico (request ID di pg_net)
- Email appare su Resend Dashboard dopo pochi secondi

**Se Fallisce:**
- Error "function net.http_post does not exist" → pg_net non installato
- Error "connection refused" → URL Edge Function sbagliato
- Error "unauthorized" → Token authorization sbagliato

---

## Checklist Finale

Prima di considerare risolto, verifica:

- [ ] `CHECK_EMAIL_NOTIFICATIONS_STATUS.sql` restituisce ✅ per `create_notification`
- [ ] Preferenze email utenti mostrano `email_enabled: true`
- [ ] Test manuale chiamata HTTP (`net.http_post`) funziona
- [ ] Creazione nuova richiesta → Email su Resend Dashboard
- [ ] Email arriva a destinatario (controlla anche spam)
- [ ] Cambio stato con toggle abilitato → Email inviata
- [ ] Log Edge Function mostrano chiamate riuscite

---

## Riferimenti

### File di Debug
- [`CHECK_EMAIL_NOTIFICATIONS_STATUS.sql`](../CHECK_EMAIL_NOTIFICATIONS_STATUS.sql) - Script diagnostica
- [`MANUAL_APPLY_EMAIL_FUNCTION.sql`](../MANUAL_APPLY_EMAIL_FUNCTION.sql) - Fix manuale

### Migration Originali
- [`20251106000001_add_email_notifications.sql`](../supabase/migrations/20251106000001_add_email_notifications.sql)
- [`20251106000002_fix_email_notifications.sql`](../supabase/migrations/20251106000002_fix_email_notifications.sql)

### Configurazione
- [RESEND_ONBOARDING_STATUS.md](RESEND_ONBOARDING_STATUS.md) - Status configurazione Resend
- [RESEND_DOMAIN_SETUP.md](RESEND_DOMAIN_SETUP.md) - Guida dominio aziendale (futuro)

### Dashboard
- **Supabase SQL Editor**: https://supabase.com/dashboard/project/uphftgpwisdiubuhohnc/sql
- **Supabase Functions**: https://supabase.com/dashboard/project/uphftgpwisdiubuhohnc/functions
- **Resend Dashboard**: https://resend.com/emails

---

## Prossimi Passi (Dopo Fix)

1. **Testa tutti gli scenari** per assicurarti che le email vengano inviate
2. **Monitora Resend Dashboard** per deliverability e bounce rate
3. **Abilita transizioni stato** nelle preferenze per ricevere email su ogni cambio
4. **Considera upgrade piano Resend** se superi 100 email/mese
5. **Passa a dominio aziendale** quando vai in produzione (segui RESEND_DOMAIN_SETUP.md)

---

**Status**: Debugging in corso
**Ultima modifica**: 2025-11-08
**Autore**: Claude Code
