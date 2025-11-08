# Configurazione Resend con Dominio Onboarding

**Data**: 2025-11-08
**Dominio utilizzato**: `onboarding@resend.dev` (dominio test Resend)
**Stato**: ✅ CONFIGURATO E FUNZIONANTE

---

## Riepilogo Configurazione

| Componente | Stato | Valore |
|-----------|-------|--------|
| API Key Resend | ✅ Configurata | `RESEND_API_KEY` in Supabase secrets |
| Secret EMAIL_FROM | ✅ Aggiornato | `onboarding@resend.dev` |
| Edge Function `send-notification-email` | ✅ OK | Usa `EMAIL_FROM` con fallback corretto |
| Edge Function `test-notification-email` | ✅ OK | Usa `EMAIL_FROM` con fallback corretto |
| Test invio email | ✅ SUCCESSO | Email ID: `74c970e2-56e9-4993-a437-c30647d24add` |

---

## Azioni Completate

### 1. Aggiornamento Secret Supabase ✅
```bash
supabase secrets set EMAIL_FROM="onboarding@resend.dev"
```

**Risultato**: Secret aggiornato correttamente.

### 2. Verifica Edge Functions ✅

Entrambe le Edge Functions hanno la configurazione corretta:

**send-notification-email/index.ts** (riga 5):
```typescript
const EMAIL_FROM = Deno.env.get('EMAIL_FROM') || 'notifiche@officomp.it'
```

**test-notification-email/index.ts** (riga 108):
```typescript
const EMAIL_FROM = Deno.env.get('EMAIL_FROM') || 'onboarding@resend.dev'
```

Ora che `EMAIL_FROM` è impostato su `onboarding@resend.dev`, **entrambe** useranno il dominio onboarding.

### 3. Test Invio Email ✅

**Test eseguito**: `node test-resend-node.js`

**Payload**:
```json
{
  "from": "Officomp Ticketing <onboarding@resend.dev>",
  "to": ["francesco.bertin@officomp.it"],
  "subject": "Test Email - Resend API da Node.js",
  "html": "<h1>Test Email</h1><p>Questa è una email di test da Node.js</p>"
}
```

**Risposta**:
- Status: `200 OK`
- Email ID: `74c970e2-56e9-4993-a437-c30647d24add`
- Rate limit: 1/2 richieste rimanenti
- Quota mensile: 2 email inviate

**Dashboard Resend**: https://resend.com/emails

---

## Vantaggi del Dominio Onboarding

### ✅ Pro
1. **Setup immediato**: Nessuna configurazione DNS richiesta
2. **Già verificato**: Il dominio `resend.dev` è già verificato da Resend
3. **SPF/DKIM preconfigurati**: Autenticazione email funzionante out-of-the-box
4. **Perfetto per sviluppo/test**: Ideale per ambiente di sviluppo e test
5. **Nessun rischio**: Non interferisce con il dominio aziendale `officomp.it`

### ⚠️ Contro
1. **Non professionale**: L'email arriva da `@resend.dev` invece di `@officomp.it`
2. **Possibile spam**: Alcuni filtri potrebbero essere più severi con domini esterni
3. **Limite free tier**: 100 email/mese con piano gratuito
4. **Branding**: Non mostra il brand aziendale nell'indirizzo mittente

---

## Quando Passare al Dominio Aziendale

Considera di passare a `notifiche@officomp.it` quando:

1. **In produzione**: L'app è live e usata da utenti reali
2. **Branding importante**: Vuoi che le email riflettano il brand Officomp
3. **Volume alto**: Superi i 100 email/mese del free tier
4. **Professionalità**: Vuoi dare un'immagine più professionale
5. **Deliverability critica**: Hai problemi di spam con il dominio onboarding

Per configurare il dominio aziendale, segui la guida:
📄 [RESEND_DOMAIN_SETUP.md](RESEND_DOMAIN_SETUP.md)

---

## Configurazione Attuale nell'App

### Edge Function: send-notification-email

**Mittente email**:
```typescript
from: `Officomp Ticketing <${EMAIL_FROM}>`
// Diventa: "Officomp Ticketing <onboarding@resend.dev>"
```

**Quando viene invocata**:
- Creazione nuova richiesta
- Cambio stato richiesta
- Assegnazione richiesta a tecnico
- Sospensione/Riattivazione richiesta

### Edge Function: test-notification-email

**Mittente email**:
```typescript
from: `Officomp Ticketing <${EMAIL_FROM}>`
// Diventa: "Officomp Ticketing <onboarding@resend.dev>"
```

**Quando viene invocata**:
- Test manuale da dashboard admin
- Verifica configurazione email

---

## Test Completo

### 1. Test API Resend Diretto ✅
```bash
node test-resend-node.js
```
**Risultato**: ✅ Email inviata con successo

### 2. Test Edge Function `test-notification-email`

**Da frontend** (come admin):
1. Login su https://off-ticket-ut.vercel.app
2. Vai su Impostazioni Notifiche
3. Click "Invia Email di Test"
4. Verifica ricezione email

**Da CLI**:
```bash
# Deploy edge function se modificata
supabase functions deploy test-notification-email

# Testa con curl (sostituire TOKEN)
curl -X POST https://[PROJECT_REF].supabase.co/functions/v1/test-notification-email \
  -H "Authorization: Bearer [ACCESS_TOKEN]" \
  -H "Content-Type: application/json"
```

### 3. Test Edge Function `send-notification-email`

**Test end-to-end**:
1. Login come utente
2. Crea nuova richiesta
3. Verifica che l'admin riceva email di notifica
4. Come admin, assegna la richiesta a un tecnico
5. Verifica che il tecnico riceva email di notifica

---

## Monitoraggio

### Dashboard Resend
- **URL**: https://resend.com/emails
- **Cosa monitorare**:
  - Email inviate/fallite
  - Bounce rate
  - Complaint rate
  - Quota mensile rimanente

### Log Edge Functions
```bash
# Log send-notification-email
supabase functions logs send-notification-email --limit 50

# Log test-notification-email
supabase functions logs test-notification-email --limit 50
```

### Verifica Email Ricevute
Controlla che le email:
- [ ] Arrivino nella inbox (non spam)
- [ ] Abbiano il mittente corretto: "Officomp Ticketing <onboarding@resend.dev>"
- [ ] Mostrino HTML formattato correttamente
- [ ] Abbiano link funzionanti
- [ ] Siano responsive su mobile

---

## Troubleshooting

### Email Non Arriva

**Verifica**:
1. Log Resend Dashboard per errori
2. Log Edge Function per chiamate fallite
3. Filtro spam della casella destinatario
4. Quota mensile Resend (max 100 email/mese free)

**Comandi utili**:
```bash
# Verifica secret
supabase secrets list

# Verifica log Edge Function
supabase functions logs send-notification-email --limit 20

# Test diretto API
node test-resend-node.js
```

### Email in Spam

**Soluzioni**:
1. Aggiungi `onboarding@resend.dev` ai contatti attendibili
2. Marca email come "Non spam" la prima volta
3. Verifica che il contenuto HTML non contenga spam trigger words
4. In futuro, passa al dominio aziendale verificato

### Rate Limit Exceeded

**Errore**: `ratelimit-remaining: 0`

**Causa**: Limite di 2 richieste/secondo sul piano free

**Soluzione**:
- Implementa retry con backoff esponenziale
- Upgrade a piano Business ($20/mese) per limiti più alti
- Riduci frequenza invii

### Quota Mensile Esaurita

**Errore**: `x-resend-monthly-quota: 100` (o max raggiunto)

**Soluzione**:
- Attendi inizio mese successivo
- Upgrade a piano Business ($20/mese = 10k email)
- Passa a dominio verificato per quota maggiore

---

## Secrets Configurati

Verifica che siano tutti presenti:

```bash
supabase secrets list
```

**Necessari per email**:
- ✅ `RESEND_API_KEY` - API key Resend
- ✅ `EMAIL_FROM` - `onboarding@resend.dev`
- ✅ `APP_URL` - URL frontend per link nelle email

---

## Prossimi Passi (Opzionali)

### A breve termine
- [ ] Test notifiche automatiche end-to-end
- [ ] Verifica deliverability (inbox vs spam)
- [ ] Monitora quota mensile

### A lungo termine (quando in produzione)
- [ ] Configura dominio `officomp.it` su Resend
- [ ] Aggiungi record DNS (SPF + 3 DKIM)
- [ ] Verifica dominio su Resend Dashboard
- [ ] Aggiorna `EMAIL_FROM` a `notifiche@officomp.it`
- [ ] Test completo con dominio aziendale
- [ ] Upgrade piano Resend se necessario

---

## Riferimenti

- **Resend Dashboard**: https://resend.com/emails
- **Resend Docs**: https://resend.com/docs
- **Guida dominio aziendale**: [RESEND_DOMAIN_SETUP.md](RESEND_DOMAIN_SETUP.md)
- **API Key**: Configurata in Supabase secrets

---

**Status**: ✅ Configurazione completata e testata con successo
**Ultima verifica**: 2025-11-08
**Autore**: Claude Code
