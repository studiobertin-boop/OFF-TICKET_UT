# Soluzione Email Notifications: Frontend-Based

**Data**: 2025-11-08
**Problema Risolto**: Email non inviate tramite pg_net
**Soluzione Implementata**: Chiamata Edge Function dal frontend React

---

## 🔴 Problema Originale

Le notifiche email **non venivano inviate** nonostante:
- ✅ Edge Function `send-notification-email` funzionante
- ✅ Resend configurato correttamente
- ✅ Preferenze email abilitate per gli utenti
- ✅ Trigger database attivi

### Causa Identificata

Il problema era nel database trigger che usava `pg_net.http_post()` per chiamare l'Edge Function:

```sql
-- Errore HTTP 401: Invalid JWT
status_code: 401
content: {"code":401,"message":"Invalid JWT"}
```

Il token JWT **hardcoded** nella migration era **scaduto/invalido**, quindi:
- `pg_net` accodava le richieste HTTP
- Le richieste fallivano con 401 Unauthorized
- Nessuna email veniva inviata

### Problemi di pg_net

1. **Token hardcoded**: La migration aveva un Bearer token fisso che scade
2. **Debugging difficile**: I log `pg_net` sono difficili da monitorare
3. **Complessità**: Richiede configurazione database + worker attivo
4. **Affidabilità**: Il worker `pg_net` può non essere attivo su tutti i progetti Supabase

---

## ✅ Soluzione Implementata

Abbiamo **eliminato la dipendenza da pg_net** e implementato le notifiche email **direttamente dal frontend React**.

### Architettura Nuova

```
Frontend React
    ↓
requestsApi.create() / update()
    ↓
emailNotificationsApi.notifyRequestCreated()
    ↓
supabase.functions.invoke('send-notification-email')
    ↓
Edge Function → Resend API → Email inviata
```

### Vantaggi

1. ✅ **Più semplice**: Non serve configurazione database complessa
2. ✅ **Più affidabile**: Usa il SDK Supabase ufficiale
3. ✅ **Più debuggabile**: Errori visibili nella console browser
4. ✅ **Token sempre valido**: Usa automaticamente il token sessione utente
5. ✅ **Nessuna dipendenza pg_net**: Funziona su tutti i progetti Supabase

---

## 📁 File Creati/Modificati

### 1. Nuovo File: `src/services/api/emailNotifications.ts`

Service dedicato per gestire l'invio di notifiche email.

**Funzionalità**:
- `notifyRequestCreated(requestId)` - Invia email quando viene creata una nuova richiesta
- `notifyStatusChange(requestId, oldStatus, newStatus)` - Invia email quando cambia lo stato
- `getNotificationRecipients(requestId)` - Ottiene tutti i destinatari (creatore, assegnato, admin)
- `shouldNotifyUser(recipient, eventType, statusFrom, statusTo)` - Verifica preferenze utente

**Logica Notifiche**:
- Ottiene destinatari: creatore + assegnato + tutti gli admin
- Recupera preferenze email da `user_notification_preferences`
- Filtra destinatari in base a:
  - Toggle email generale (`email: true/false`)
  - Toggle transizione specifica per `status_change` (es. `APERTA_ASSEGNATA: true`)
- Chiama Edge Function `send-notification-email` per ogni destinatario
- Non blocca se l'invio email fallisce (catch silenzioso con log)

### 2. Modificato: `src/services/api/requests.ts`

**Aggiunte**:

```typescript
import { emailNotificationsApi } from './emailNotifications'

// In requestsApi.create()
emailNotificationsApi.notifyRequestCreated(data.id).catch((err) => {
  console.error('Failed to send email notifications for new request:', err)
})

// In requestsApi.update()
if (updates.status && oldStatus && oldStatus !== updates.status) {
  emailNotificationsApi.notifyStatusChange(id, oldStatus, updates.status).catch((err) => {
    console.error('Failed to send email notifications for status change:', err)
  })
}
```

**Comportamento**:
- Dopo creazione richiesta → chiama `notifyRequestCreated()` in background
- Dopo cambio stato → chiama `notifyStatusChange()` in background
- Non blocca l'operazione principale se l'email fallisce

---

## 🧪 Come Testare

### Test 1: Nuova Richiesta

**Setup**:
1. Login come utente (`frabertin@yahoo.it`)
2. Vai su Impostazioni Notifiche
3. Verifica che il toggle **"Notifiche Email"** sia **abilitato**

**Azione**:
1. Crea nuova richiesta
2. Compila il form e invia

**Risultato Atteso**:
- ✅ Richiesta creata con successo
- ✅ Admin (`studiobertin@gmail.com`) riceve email
- ✅ Email visibile su Resend Dashboard: https://resend.com/emails
- ✅ Email ricevuta nella inbox (controlla anche spam)

**Debug**:
- Apri Console Browser (F12)
- Cerca log: `Email notifications sent for request_created: N recipients`
- Se vedi errori, controlla il messaggio

### Test 2: Cambio Stato Richiesta

**Setup**:
1. Login come admin (`studiobertin@gmail.com`)
2. Vai su Impostazioni Notifiche
3. Espandi **"Transizioni di Stato"**
4. Abilita toggle per **"APERTA → ASSEGNATA"**

**Azione**:
1. Apri una richiesta esistente
2. Cambia stato da APERTA ad ASSEGNATA
3. Salva

**Risultato Atteso**:
- ✅ Stato aggiornato
- ✅ Creatore richiesta riceve email
- ✅ Email visibile su Resend Dashboard

**Debug**:
- Console Browser: `Email notifications sent for status_change: N recipients`

### Test 3: Email Non Inviate (Comportamento Corretto)

**Scenario A**: Email disabilitato
1. Utente ha toggle **"Notifiche Email"** disabilitato
2. Crea richiesta
3. ✅ Nessuna email inviata (comportamento corretto)

**Scenario B**: Transizione non abilitata
1. Utente ha email abilitato ma transizione specifica disabilitata
2. Cambia stato
3. ✅ Nessuna email per quella transizione (comportamento corretto)

---

## 📊 Monitoring

### Console Browser

Apri DevTools (F12) e guarda i log:

```javascript
// Successo
Email notifications sent for request_created: 2 recipients
Email notification sent successfully to: studiobertin@gmail.com

// Errore
Failed to send email notifications for new request: Error: ...
Error sending email notification: { error: "..." }
```

### Resend Dashboard

URL: https://resend.com/emails

**Verifica**:
- Numero email inviate
- Status: `delivered`, `bounced`, `failed`
- Destinatari corretti
- Subject e contenuto

### Network Tab Browser

Filtra per `send-notification-email`:
- Status: 200 OK
- Response: `{ success: true, message: "..." }`

---

## 🐛 Troubleshooting

### Email Non Inviate

**1. Verifica Preferenze Utente**

```sql
-- Nel SQL Editor di Supabase
SELECT
  au.email,
  unp.email as email_enabled,
  unp.status_transitions
FROM auth.users au
LEFT JOIN user_notification_preferences unp ON au.id = unp.user_id
WHERE au.email = 'studiobertin@gmail.com';
```

**Soluzioni**:
- Se `email_enabled` è `false` o `NULL` → Abilita toggle nelle Impostazioni
- Se `status_transitions` non contiene la transizione → Abilita toggle specifico

**2. Verifica Edge Function**

Test manuale:
```typescript
// Nella console browser dell'app (F12)
await window.supabase.functions.invoke('send-notification-email', {
  body: {
    to: 'test@example.com',
    user_name: 'Test User',
    event_type: 'request_created',
    message: 'Test message',
    request_id: '00000000-0000-0000-0000-000000000000',
    metadata: {}
  }
})
```

**Risultato Atteso**: `{ success: true }`

**3. Verifica Resend API Key**

```bash
# Via CLI
supabase secrets list

# Dovrebbe mostrare:
# RESEND_API_KEY
# EMAIL_FROM
```

**4. Controlla Quota Resend**

Resend free tier: 100 email/mese

Dashboard: https://resend.com/overview
- Verifica `x-resend-monthly-quota` header
- Se quota esaurita, le email non vengono inviate

---

## 🔄 Migrazione da pg_net (Opzionale)

Se vuoi rimuovere completamente il codice `pg_net` dal database:

```sql
-- Rimuovi supporto email dalla funzione create_notification
-- (mantiene solo notifiche in-app)
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_request_id UUID,
  p_event_type TEXT,
  p_message TEXT,
  p_status_from TEXT DEFAULT NULL,
  p_status_to TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
) RETURNS void AS $$
DECLARE
  v_preferences RECORD;
  v_should_notify BOOLEAN := false;
BEGIN
  SELECT * INTO v_preferences
  FROM user_notification_preferences
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    INSERT INTO user_notification_preferences (user_id, in_app, email, status_transitions)
    VALUES (p_user_id, true, false, '{}')
    RETURNING * INTO v_preferences;
  END IF;

  IF p_event_type IN ('request_created', 'request_suspended', 'request_unsuspended') THEN
    v_should_notify := true;
  ELSIF p_event_type = 'status_change' AND p_status_from IS NOT NULL AND p_status_to IS NOT NULL THEN
    v_should_notify := COALESCE(
      (v_preferences.status_transitions->>(p_status_from || '_' || p_status_to))::boolean,
      false
    );
  END IF;

  -- Solo notifiche in-app (email gestite dal frontend)
  IF v_should_notify AND v_preferences.in_app THEN
    INSERT INTO notifications (user_id, request_id, type, message, status_from, status_to, event_type, metadata, read)
    VALUES (p_user_id, p_request_id, p_event_type, p_message, p_status_from, p_status_to, p_event_type, p_metadata, false);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

Questo mantiene le notifiche in-app ma delega le email al frontend.

---

## 📝 Note Importanti

### 1. Notifiche In-App Ancora Funzionanti

Le notifiche in-app continuano a funzionare tramite:
- Trigger database `notify_request_status_change`
- Funzione `create_notification()` (solo parte in-app)
- Real-time subscriptions nel frontend

### 2. Email Inviate in Background

Le chiamate `emailNotificationsApi` sono avvolte in `.catch()`:
```typescript
emailNotificationsApi.notifyRequestCreated(data.id).catch(...)
```

Questo significa:
- Se l'email fallisce, l'operazione principale (creazione/aggiornamento) **non fallisce**
- L'utente vede la richiesta creata/aggiornata con successo
- Gli errori email vengono solo loggati nella console

### 3. Performance

L'invio email aggiunge ~1-2 secondi all'operazione, ma:
- Avviene in background dopo il return
- Non blocca l'UI
- Non rallenta la risposta al database

### 4. Scalabilità

Per molti destinatari (>10), considera:
- Implementare una coda (es. Supabase Edge Function con retry)
- Batch delle email invece di Promise.all
- Rate limiting per evitare throttling Resend

---

## 🚀 Next Steps

### A breve termine
- [x] Implementato sistema frontend-based
- [x] Test TypeScript build
- [ ] Test end-to-end con utenti reali
- [ ] Monitorare Resend Dashboard per deliverability

### A lungo termine
- [ ] Rimuovere codice pg_net dal database (opzionale)
- [ ] Aggiungere template email personalizzati per tipo richiesta
- [ ] Implementare coda per molti destinatari
- [ ] Passare a dominio aziendale `notifiche@officomp.it`

---

## 📚 Riferimenti

### File di Progetto
- [emailNotifications.ts](../src/services/api/emailNotifications.ts) - Service notifiche email
- [requests.ts](../src/services/api/requests.ts) - API richieste (modificato)
- [send-notification-email](../supabase/functions/send-notification-email/index.ts) - Edge Function

### Documentazione Precedente
- [DEBUG_EMAIL_NOTIFICATIONS.md](DEBUG_EMAIL_NOTIFICATIONS.md) - Debug pg_net
- [RESEND_ONBOARDING_STATUS.md](RESEND_ONBOARDING_STATUS.md) - Status Resend

### Dashboard
- **Resend**: https://resend.com/emails
- **Supabase Functions**: https://supabase.com/dashboard/project/uphftgpwisdiubuhohnc/functions

---

**Status**: ✅ Implementato e pronto per test
**Ultima modifica**: 2025-11-08
**Autore**: Claude Code
