# Configurazione Dominio Resend per officomp.it

## ⚠️ Premessa Importante

Il dominio `officomp.it` usa **Office 365** per le email. Dobbiamo configurare Resend senza interferire con i servizi email esistenti.

## 📋 Checklist Setup

- [ ] Dominio aggiunto su Resend Dashboard
- [ ] Record SPF aggiornato (non sostituito!)
- [ ] Record DKIM aggiunti (3 CNAME)
- [ ] Record DMARC configurato (opzionale)
- [ ] Verifica dominio su Resend (click "Verify")
- [ ] Test email da `notifiche@officomp.it`
- [ ] Aggiornamento secret `EMAIL_FROM` su Supabase

---

## 🔧 Step 1: Aggiungi Dominio su Resend

1. Vai su: https://resend.com/domains
2. Click **"Add Domain"**
3. Inserisci: `officomp.it`
4. Click **"Add"**

Resend ti mostrerà i record DNS specifici per il tuo dominio.

---

## 📝 Step 2: Verifica Record DNS Esistenti

Prima di modificare, verifica cosa c'è già configurato:

### Windows PowerShell:
```powershell
# SPF
nslookup -type=TXT officomp.it

# MX (Office 365)
nslookup -type=MX officomp.it

# DMARC
nslookup -type=TXT _dmarc.officomp.it
```

### Linux/Mac:
```bash
# SPF
dig TXT officomp.it

# MX (Office 365)
dig MX officomp.it

# DMARC
dig TXT _dmarc.officomp.it
```

---

## 🌐 Step 3: Configurazione Record DNS

### A. Record SPF (TXT)

**⚠️ IMPORTANTE**: Non sostituire l'SPF esistente di Office 365!

**SPF Attuale (Office 365):**
```
v=spf1 include:spf.protection.outlook.com -all
```

**SPF Nuovo (Office 365 + Resend):**
```
v=spf1 include:spf.protection.outlook.com include:_spf.resend.com ~all
```

**Configurazione:**
- **Nome/Host**: `@` (o lascia vuoto, dipende dal provider)
- **Tipo**: `TXT`
- **Valore**: `v=spf1 include:spf.protection.outlook.com include:_spf.resend.com ~all`
- **TTL**: `3600` (o default)

### B. Record DKIM (CNAME)

Resend ti fornirà 3 record CNAME. Esempio:

**Record 1:**
- **Nome/Host**: `resend._domainkey`
- **Tipo**: `CNAME`
- **Valore**: `resend._domainkey.resend.com` (controlla dashboard Resend)
- **TTL**: `3600`

**Record 2:**
- **Nome/Host**: `resend2._domainkey`
- **Tipo**: `CNAME`
- **Valore**: `resend2._domainkey.resend.com`
- **TTL**: `3600`

**Record 3:**
- **Nome/Host**: `resend3._domainkey`
- **Tipo**: `CNAME`
- **Valore**: `resend3._domainkey.resend.com`
- **TTL**: `3600`

### C. Record DMARC (TXT) - Opzionale

**Configurazione:**
- **Nome/Host**: `_dmarc`
- **Tipo**: `TXT`
- **Valore**: `v=DMARC1; p=none; rua=mailto:francesco.bertin@officomp.it`
- **TTL**: `3600`

**Spiegazione parametri:**
- `p=none`: policy in monitoraggio (raccoglie statistiche senza bloccare)
- `rua=mailto:...`: invia report aggregati a questo indirizzo

**Alternative policy:**
- `p=quarantine`: metti in spam email sospette
- `p=reject`: rifiuta email sospette

**Consiglio**: Inizia con `p=none` per qualche settimana, monitora i report, poi passa a `p=quarantine` o `p=reject`.

---

## 🖥️ Step 4: Dove Configurare i DNS

### Opzione A: DNS Gestito da Office 365

1. Vai su: https://admin.microsoft.com
2. **Settings** > **Domains** > `officomp.it`
3. Click **"DNS records"** o **"Advanced DNS Management"**
4. Click **"Add record"**
5. Aggiungi i record TXT e CNAME come specificato sopra

### Opzione B: DNS Gestito da Provider Esterno

Provider comuni in Italia:

**Aruba:**
1. Login su: https://admin.aruba.it
2. Domini > Gestione DNS
3. Aggiungi record TXT e CNAME

**Register.it:**
1. Login su: https://www.register.it/login
2. Domini > Gestione DNS
3. Aggiungi record

**Cloudflare:**
1. Login su: https://dash.cloudflare.com
2. Seleziona dominio `officomp.it`
3. DNS > Add record

**GoDaddy:**
1. Login su: https://account.godaddy.com
2. My Products > DNS
3. Add record

---

## ✅ Step 5: Verifica Configurazione

### A. Su Resend Dashboard

1. Vai su: https://resend.com/domains
2. Trova `officomp.it`
3. Click **"Verify"**
4. Attendi conferma (può richiedere fino a 48h, ma spesso 1-2 ore)

### B. Con Comandi DNS

```powershell
# Verifica SPF
nslookup -type=TXT officomp.it

# Verifica DKIM 1
nslookup -type=CNAME resend._domainkey.officomp.it

# Verifica DKIM 2
nslookup -type=CNAME resend2._domainkey.officomp.it

# Verifica DKIM 3
nslookup -type=CNAME resend3._domainkey.officomp.it

# Verifica DMARC
nslookup -type=TXT _dmarc.officomp.it
```

### C. Tool Online

- **MXToolbox**: https://mxtoolbox.com/SuperTool.aspx
  - Inserisci: `officomp.it`
  - Controlla SPF, DKIM, DMARC

- **Google Admin Toolbox**: https://toolbox.googleapps.com/apps/checkmx/
  - Verifica configurazione email completa

---

## 🔄 Step 6: Aggiorna Configurazione Supabase

Una volta verificato il dominio su Resend:

```bash
# Aggiorna secret EMAIL_FROM
supabase secrets set EMAIL_FROM=notifiche@officomp.it
```

---

## 🧪 Step 7: Test Invio Email

### A. Test da App

1. Login come admin su: https://off-ticket-ut.vercel.app
2. Vai su: Impostazioni Notifiche
3. Click: "Invia Email di Test"
4. Verifica ricezione email da `notifiche@officomp.it`

### B. Test da CLI

```bash
node test-resend-node.js
```

Modifica il file per usare:
```javascript
from: 'Officomp Ticketing <notifiche@officomp.it>'
```

---

## ⚠️ Note Importanti

### 1. **Non Toccare Record MX**
I record MX devono rimanere quelli di Office 365:
```
officomp-it.mail.protection.outlook.com (priority 0)
```

### 2. **Propagazione DNS**
I record DNS possono richiedere:
- **Minimo**: 5-15 minuti
- **Tipico**: 1-2 ore
- **Massimo**: 48 ore

### 3. **SPF Multiple Include**
SPF supporta fino a 10 `include:`. Verifica di non superare il limite.

### 4. **Office 365 e Resend Coesistono**
- **Office 365**: gestisce ricezione email (`@officomp.it`)
- **Resend**: gestisce solo invio da `notifiche@officomp.it`
- Non c'è conflitto

---

## 🐛 Troubleshooting

### Email Non Arrivano da Dominio Verificato

**Controlla:**
1. Dominio verificato su Resend (green checkmark)
2. Secret `EMAIL_FROM` aggiornato su Supabase
3. Record DKIM configurati correttamente (3 CNAME)
4. SPF include `_spf.resend.com`

**Verifica log Resend:**
- https://resend.com/emails
- Cerca errori di autenticazione (DKIM/SPF fail)

### Email Finiscono in Spam

**Soluzioni:**
1. Configura DMARC con `p=quarantine` (dopo test con `p=none`)
2. Aggiungi record PTR (reverse DNS) se hai IP dedicato
3. Monitora reputation del dominio: https://senderscore.org
4. Aggiungi link "Unsubscribe" nelle email
5. Evita parole spam nel subject/body

### Errore "Domain Not Verified"

**Cause:**
1. Record DNS non propagati (attendi 1-2 ore)
2. Record DNS configurati male (controlla typo)
3. TTL troppo alto (riduci a 3600)

**Verifica manuale:**
```powershell
nslookup -type=TXT resend._domainkey.officomp.it
```

---

## 📊 Monitoraggio

### Dashboard Resend
- **Email Sent**: https://resend.com/emails
- **Domain Health**: https://resend.com/domains
- **API Logs**: https://resend.com/logs

### DMARC Reports
Se hai configurato DMARC con `rua=mailto:...`, riceverai report XML giornalieri.

**Tool per analizzare report:**
- https://dmarc.postmarkapp.com
- https://dmarcian.com

---

## 📚 Riferimenti

- **Resend Docs**: https://resend.com/docs/dashboard/domains/introduction
- **SPF Guide**: https://www.dmarcanalyzer.com/spf/
- **DKIM Guide**: https://www.dmarcanalyzer.com/dkim/
- **DMARC Guide**: https://dmarc.org/overview/

---

## ✅ Checklist Finale

Prima di considerare completato:

- [ ] Dominio `officomp.it` aggiunto su Resend
- [ ] Record SPF aggiornato (include Office 365 + Resend)
- [ ] 3 Record DKIM (CNAME) aggiunti
- [ ] Record DMARC configurato
- [ ] Dominio verificato su Resend (green checkmark)
- [ ] Secret `EMAIL_FROM=notifiche@officomp.it` su Supabase
- [ ] Test email inviata e ricevuta con successo
- [ ] Email non finisce in spam
- [ ] Log Resend non mostra errori DKIM/SPF

---

## 🚀 Next Steps

Una volta completato:

1. **Applica stessa configurazione a `send-notification-email` function**
   - Aggiorna template email con dominio verificato
   - Testa notifiche automatiche da trigger database

2. **Configura template professionali**
   - Logo Officomp nell'header
   - Footer con link unsubscribe
   - Design responsive

3. **Monitoring e alerting**
   - Setup webhook Resend per bounce/complaint
   - Dashboard metriche email (delivered/opened/clicked)

---

**Ultima modifica**: 2025-11-07
**Autore**: Claude Code
