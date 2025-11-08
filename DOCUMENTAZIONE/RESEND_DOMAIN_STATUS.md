# Report Verifica Configurazione Resend - officomp.it

**Data**: 2025-11-08
**Dominio**: officomp.it
**Email invio**: notifiche@officomp.it

⚠️ **NOTA**: Questa è una guida per la configurazione FUTURA del dominio aziendale.
**Configurazione attuale**: Si sta usando `onboarding@resend.dev` (dominio test Resend).
Vedi [RESEND_ONBOARDING_STATUS.md](RESEND_ONBOARDING_STATUS.md) per lo stato corrente.

---

## Riepilogo Stato

| Componente | Stato | Note |
|-----------|-------|------|
| API Key Resend | ✅ Configurata | Secret RESEND_API_KEY presente in Supabase |
| Secret EMAIL_FROM | ✅ Configurato | Impostato su `notifiche@officomp.it` |
| Edge Function | ✅ Configurata | Usa correttamente EMAIL_FROM |
| Record SPF | ⚠️ INCOMPLETO | Manca `include:_spf.resend.com` |
| Record DKIM 1 | ❌ MANCANTE | `resend._domainkey` non configurato |
| Record DKIM 2 | ❌ MANCANTE | `resend2._domainkey` non configurato |
| Record DKIM 3 | ❌ MANCANTE | `resend3._domainkey` non configurato |
| Record DMARC | ✅ Configurato | Policy `p=none` attiva |
| Dominio verificato su Resend | ❓ DA VERIFICARE | Richiede controllo su dashboard |

---

## Dettaglio Record DNS Attuali

### SPF (TXT) - ⚠️ INCOMPLETO
```
Host: @
Tipo: TXT
Valore: v=spf1 include:spf.protection.outlook.com include:spf.turbo-smtp.com -all
```

**Problema**: Manca `include:_spf.resend.com`

**Dovrebbe essere**:
```
v=spf1 include:spf.protection.outlook.com include:spf.turbo-smtp.com include:_spf.resend.com -all
```

### DKIM (CNAME) - ❌ MANCANTI

**Record 1**:
```
Host: resend._domainkey
Tipo: CNAME
Valore: [DA RECUPERARE DA RESEND DASHBOARD]
```
**Stato**: Non esiste

**Record 2**:
```
Host: resend2._domainkey
Tipo: CNAME
Valore: [DA RECUPERARE DA RESEND DASHBOARD]
```
**Stato**: Non esiste

**Record 3**:
```
Host: resend3._domainkey
Tipo: CNAME
Valore: [DA RECUPERARE DA RESEND DASHBOARD]
```
**Stato**: Non esiste

### DMARC (TXT) - ✅ CONFIGURATO
```
Host: _dmarc
Tipo: TXT
Valore: v=DMARC1; p=none; adkim=r; aspf=r;
```
**Stato**: OK (policy in monitoraggio)

---

## Azioni Necessarie

### 1. Accedi alla Dashboard Resend
URL: https://resend.com/domains

**Controlla**:
- [ ] Il dominio `officomp.it` è stato aggiunto?
- [ ] Qual è lo stato di verifica del dominio?
- [ ] Quali sono i valori ESATTI dei 3 record DKIM?

### 2. Aggiungi/Aggiorna Record DNS

Accedi al pannello DNS del dominio (probabilmente Office 365 o provider esterno).

#### A. Aggiorna SPF (MODIFICA record esistente)
```
Host/Nome: @
Tipo: TXT
Valore: v=spf1 include:spf.protection.outlook.com include:spf.turbo-smtp.com include:_spf.resend.com -all
TTL: 3600
```

⚠️ **IMPORTANTE**:
- NON creare un nuovo record SPF
- MODIFICA quello esistente aggiungendo `include:_spf.resend.com`
- Può esserci un solo record SPF per dominio

#### B. Aggiungi 3 Record DKIM (NUOVI record CNAME)

Dalla dashboard Resend copia i valori esatti e crea 3 nuovi record CNAME:

```
Record 1:
Host/Nome: resend._domainkey
Tipo: CNAME
Valore: [COPIA DA RESEND DASHBOARD]
TTL: 3600

Record 2:
Host/Nome: resend2._domainkey
Tipo: CNAME
Valore: [COPIA DA RESEND DASHBOARD]
TTL: 3600

Record 3:
Host/Nome: resend3._domainkey
Tipo: CNAME
Valore: [COPIA DA RESEND DASHBOARD]
TTL: 3600
```

### 3. Attendi Propagazione DNS
⏱️ Da 15 minuti a 2 ore (max 48h)

### 4. Verifica su Resend Dashboard
- Vai su: https://resend.com/domains
- Click "Verify" sul dominio `officomp.it`
- Verifica che appaia ✅ (green checkmark)

### 5. Test Invio Email
Esegui test con dominio verificato:
```bash
node test-resend-node.js
```

Modifica prima il file per usare:
```javascript
from: 'Officomp Ticketing <notifiche@officomp.it>'
```

---

## Verifica Post-Configurazione

Dopo aver aggiunto i record DNS, attendi 1-2 ore e verifica con:

### Windows PowerShell
```powershell
# SPF
nslookup -type=TXT officomp.it

# DKIM 1
nslookup -type=CNAME resend._domainkey.officomp.it

# DKIM 2
nslookup -type=CNAME resend2._domainkey.officomp.it

# DKIM 3
nslookup -type=CNAME resend3._domainkey.officomp.it
```

### Risultati Attesi

**SPF**:
```
v=spf1 include:spf.protection.outlook.com include:spf.turbo-smtp.com include:_spf.resend.com -all
```

**DKIM 1-3**:
Ciascun record dovrebbe puntare a un CNAME fornito da Resend (es. `xxx._domainkey.resend.com`)

---

## Tool Online per Verifica

Una volta configurato tutto:

1. **MXToolbox SuperTool**
   - URL: https://mxtoolbox.com/SuperTool.aspx
   - Inserisci: `officomp.it`
   - Test: SPF, DKIM, DMARC

2. **Resend Dashboard**
   - URL: https://resend.com/domains
   - Controlla stato verifica dominio

3. **Mail Tester**
   - URL: https://www.mail-tester.com
   - Invia email di test all'indirizzo fornito
   - Controlla score (dovrebbe essere 10/10)

---

## Perché la Configurazione Attuale Non Funziona

### Problema 1: SPF Incompleto
Senza `include:_spf.resend.com` nel record SPF, i server email destinatari vedranno che:
- L'email arriva da `notifiche@officomp.it`
- Ma i server Resend NON sono autorizzati a inviare per conto di `officomp.it`
- Risultato: Email bloccata o finisce in spam

### Problema 2: DKIM Mancanti
DKIM firma digitalmente le email per provare che provengono veramente dal dominio dichiarato.
Senza DKIM:
- Non c'è prova crittografica dell'autenticità
- I filtri antispam assegnano un punteggio negativo
- Risultato: Email molto probabilmente finisce in spam

### Problema 3: Dominio Non Verificato
Se il dominio non è verificato su Resend:
- Resend potrebbe rifiutare di inviare email
- Le email inviate potrebbero fallire silenziosamente
- I log Resend mostreranno errori di autenticazione

---

## Configurazione Attualmente Funzionante

L'unica configurazione che funziona adesso è:
```javascript
from: 'Officomp Ticketing <onboarding@resend.dev>'
```

Questo usa il dominio di test di Resend (`resend.dev`), che:
✅ È già verificato
✅ Ha SPF/DKIM configurati
❌ Ma NON è il tuo dominio aziendale
❌ Finisce in spam più facilmente
❌ Sembra meno professionale

---

## Prossimi Passi

1. **IMMEDIATO**: Accedi a Resend Dashboard e recupera i valori DKIM
2. **URGENTE**: Configura i record DNS (SPF + 3 DKIM)
3. **DOPO 1-2 ORE**: Verifica propagazione DNS
4. **DOPO VERIFICA**: Testa invio email con `notifiche@officomp.it`
5. **FINALE**: Monitora deliverability e score spam

---

## Note Tecniche

### Coesistenza con Office 365
La configurazione è progettata per NON interferire con Office 365:
- **Office 365**: Gestisce ricezione email su `@officomp.it`
- **Resend**: Gestisce SOLO invio da `notifiche@officomp.it`
- **SPF**: Include sia Outlook che Resend
- **DKIM**: Usa selettore `resend._domainkey` separato da Office 365
- **MX**: Rimangono quelli di Office 365 (non toccare!)

### Sicurezza
- Non esporre mai `RESEND_API_KEY` nel codice
- Usa sempre Supabase Secrets per chiavi API
- Monitora dashboard Resend per bounce/complaint
- Implementa rate limiting per prevenire abusi

---

**Autore**: Claude Code
**Ultima Verifica**: 2025-11-08
