# Sistema Notifiche - Guida Applicazione Fix Finali

## Stato Attuale

### ✅ Frontend - Completato e Funzionante
- [NotificationDrawer.tsx](src/components/common/NotificationDrawer.tsx) - Icone corrette
- [Layout.tsx](src/components/common/Layout.tsx) - Badge con counter
- [NotificationSettings.tsx](src/pages/NotificationSettings.tsx) - Configurazione preferenze
- Hook `useNotifications` con Realtime subscriptions
- API completa per CRUD notifiche

### 📝 Backend - 3 Fix SQL da Applicare

## Azioni Richieste

### 1. OBBLIGATORIO - Fix Destinatari Notifiche

**File**: `supabase/migrations/APPLY_COMPLETE_NOTIFICATION_FIX.sql`

**Cosa Risolve**:
- ✅ Admin non riceve più notifiche duplicate
- ✅ Chi esegue un'azione non riceve la notifica della propria azione
- ✅ Usa `DISTINCT` per evitare duplicati quando un utente ha più ruoli

**Come Applicare**:
1. Vai su [Supabase SQL Editor](https://app.supabase.com)
2. Apri il tuo progetto OFF-TICKET_UT
3. SQL Editor
4. Copia il contenuto del file `APPLY_COMPLETE_NOTIFICATION_FIX.sql`
5. Esegui

**Nota**: Questo file contiene la funzione aggiornata `get_notification_recipients()` che sostituisce quella vecchia.

---

### 2. CONSIGLIATO - Pulisci Vecchie Notifiche

**Problema**: Le notifiche create PRIMA dell'aggiornamento non hanno i campi `event_type` e `status_to` popolati correttamente, quindi mostrano sempre l'icona blu "i" invece delle icone corrette.

**Opzione A - Segna come Lette** (Consigliato):
```sql
UPDATE notifications SET read = true WHERE event_type IS NULL OR status_to IS NULL;
```

**Opzione B - Elimina**:
```sql
DELETE FROM notifications WHERE event_type IS NULL OR status_to IS NULL;
```

**Nota**: Dopo questa pulizia, TUTTE le nuove notifiche avranno le icone corrette!

---

### 3. VERIFICA - Formato Messaggi con Nome Cliente

**File**: `supabase/migrations/APPLY_UPDATE_NOTIFICATION_MESSAGES.sql`

Questo dovrebbe già essere stato applicato. Verifica che i messaggi delle notifiche siano nel formato:

✅ **Con cliente**: `"Acme Corp - Allacciamento - richiesta creata"`
✅ **Senza cliente**: `"Allacciamento - richiesta creata"`

Se vedi ancora il vecchio formato `"La richiesta TIPO - DATA ..."`, applica questo file.

---

## Logica Destinatari PRIMA e DOPO

### ❌ PRIMA (con bug)
```
Esempio: Admin crea una richiesta
Destinatari:
- admin (come creatore)
- admin (come admin)
- admin (come utente che esegue)
= 3 notifiche duplicate per lo stesso admin!
```

### ✅ DOPO (corretto)
```
Esempio: Admin crea una richiesta
Destinatari:
- admin (escluso perché è lui che esegue l'azione)
- altri admin (DISTINCT)
= Nessuna notifica ad admin che ha creato, notifica solo agli altri admin
```

```
Esempio: User A crea richiesta assegnata a Tecnico B
Destinatari:
- User A (escluso perché è lui che esegue)
- Tecnico B (riceve notifica)
- Admin C (riceve notifica)
= Tecnico B e Admin C ricevono la notifica, User A no
```

---

## Test Post-Applicazione

### Test 1: No Auto-Notifica
1. Login come Admin
2. Crea una nuova richiesta
3. ✅ **Verifica**: Admin NON deve vedere notifica della propria creazione

### Test 2: No Duplicati
1. Login come Admin A
2. Cambia stato su una richiesta
3. Logout e login come Admin B
4. ✅ **Verifica**: Admin B vede UNA sola notifica (non duplicate)

### Test 3: Icone Corrette su Nuove Notifiche
1. Dopo pulizia vecchie notifiche, crea una nuova richiesta
2. Bloccala (→ SOSPESA)
3. ✅ **Verifica**: Icona triangolo arancio ⚠
4. Sbloccala (SOSPESA → IN_LAVORAZIONE)
5. ✅ **Verifica**: Icona check verde ✓
6. Completala (→ COMPLETATA)
7. ✅ **Verifica**: Icona cerchio grigio ⊖

### Test 4: Formato Messaggio
1. Crea richiesta per cliente "Acme Corp"
2. ✅ **Verifica messaggio**: `"Acme Corp - TIPO - azione"`

---

## Mappa Icone Finale

| Evento | Icona | Colore | Condizione |
|--------|-------|--------|------------|
| Creazione richiesta | ⓘ Info | Blu | `event_type = 'request_created'` |
| Cambio stato intermedio | ⓘ Info | Blu | `event_type = 'status_change'` |
| Richiesta bloccata | ⚠ Warning | Arancione | `event_type = 'request_suspended'` |
| Richiesta sbloccata | ✓ CheckCircle | Verde | `event_type = 'request_unsuspended'` |
| Richiesta abortita | ⊗ Cancel | Rosso | `status_to = 'ABORTITA'` |
| Richiesta completata | ⊖ RemoveCircle | Grigio | `status_to = 'COMPLETATA' OR '7-CHIUSA'` |

---

## Ordine Applicazione Consigliato

1. ✅ Applica `APPLY_COMPLETE_NOTIFICATION_FIX.sql` (obbligatorio)
2. ✅ Pulisci vecchie notifiche con UPDATE o DELETE (consigliato)
3. ✅ Verifica formato messaggi, eventualmente applica `APPLY_UPDATE_NOTIFICATION_MESSAGES.sql`
4. ✅ Esegui i test

---

## Domande Frequenti

**Q: Posso eliminare i file APPLY_* dopo averli applicati?**
A: Sì, ma è meglio tenerli come riferimento storico. Puoi spostarli in una cartella `applied/`.

**Q: Devo riavviare il server Supabase?**
A: No, le modifiche SQL sono immediate.

**Q: E se ho già notifiche non lette con le icone sbagliate?**
A: Segnale come lette con l'opzione A sopra, poi tutte le nuove avranno le icone corrette.

**Q: La fase 2 (Email) quando la facciamo?**
A: Dopo che questo sistema in-app è completamente testato e stabile.

---

## File Riferimento Documentazione

- [NOTIFICATION_FIXES_FINAL.md](NOTIFICATION_FIXES_FINAL.md) - Dettagli tecnici fix
- [NOTIFICATION_ICONS_FINAL.md](NOTIFICATION_ICONS_FINAL.md) - Mappa completa icone
- [NOTIFICATION_UI_IMPROVEMENTS.md](NOTIFICATION_UI_IMPROVEMENTS.md) - Storia miglioramenti UI
