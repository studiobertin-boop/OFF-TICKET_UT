# Fix Finali Sistema Notifiche

## Problemi Risolti

### 1. ✅ Admin Riceve Notifiche Doppie
**Causa**: La funzione `get_notification_recipients` restituiva l'admin più volte se era anche creatore o assegnato alla richiesta.

**Soluzione**: Aggiunto `DISTINCT` nella query per eliminare duplicati.

### 2. ✅ Utente che Modifica Riceve la Notifica
**Causa**: La funzione includeva tutti (creatore, assegnato, admin) senza escludere chi esegue l'azione.

**Soluzione**: Escluso `auth.uid()` (utente corrente) dai destinatari.

### 3. ✅ Simboli Diversi tra Storico e Notifiche
**Causa**: Le notifiche create PRIMA dell'aggiornamento del trigger non hanno i campi `status_to` e `event_type` popolati correttamente.

**Soluzione**:
- Le NUOVE notifiche avranno i campi corretti
- Le VECCHIE notifiche possono essere eliminate o marchiate come lette

## SQL da Applicare

### File: `APPLY_COMPLETE_NOTIFICATION_FIX.sql`

Questo SQL contiene:

1. **Funzione `get_notification_recipients` aggiornata** (OBBLIGATORIO)
   ```sql
   CREATE OR REPLACE FUNCTION get_notification_recipients(p_request_id UUID)
   RETURNS TABLE(user_id UUID) AS $$
   DECLARE
     v_current_user UUID;
   BEGIN
     v_current_user := auth.uid();

     RETURN QUERY
     SELECT DISTINCT u.id  -- ← DISTINCT evita duplicati
     FROM users u
     WHERE
       u.id != COALESCE(v_current_user, '00000000-0000-0000-0000-000000000000'::uuid)  -- ← Esclude chi esegue
       AND (
         u.id = (SELECT created_by FROM requests WHERE id = p_request_id)
         OR u.id = (SELECT assigned_to FROM requests WHERE id = p_request_id)
         OR u.role = 'admin'
       );
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER;
   ```

2. **Pulizia vecchie notifiche** (OPZIONALE - decommentare se necessario)
   ```sql
   -- Opzione A: Elimina completamente
   DELETE FROM notifications WHERE event_type IS NULL OR status_to IS NULL;

   -- Opzione B: Marca come lette (consigliato)
   UPDATE notifications SET read = true WHERE event_type IS NULL OR status_to IS NULL;
   ```

## Come Applicare

### Step 1: Applica il Fix dei Destinatari (OBBLIGATORIO)
1. Vai su Supabase SQL Editor
2. Copia il contenuto di `APPLY_COMPLETE_NOTIFICATION_FIX.sql`
3. Esegui la parte della funzione `get_notification_recipients`

### Step 2: Gestisci le Vecchie Notifiche (OPZIONALE)

**Consigliato**: Marca le vecchie notifiche come lette
```sql
UPDATE notifications SET read = true WHERE event_type IS NULL;
```

**Alternativa**: Elimina le vecchie notifiche
```sql
DELETE FROM notifications WHERE event_type IS NULL;
```

**Nota**: Dopo questo, tutte le NUOVE notifiche avranno le icone corrette!

### Step 3: Verifica il Fix APPLY_UPDATE_NOTIFICATION_MESSAGES.sql

Assicurati di aver già applicato anche:
- `APPLY_NOTIFICATION_SYSTEM.sql` (tabelle e trigger base)
- `APPLY_UPDATE_NOTIFICATION_MESSAGES.sql` (formati messaggi migliorati)

## Logica Destinatari Notifiche

### PRIMA (con bug)
```
Esempio: Admin crea una richiesta
Destinatari:
- admin (come creatore)
- admin (come admin)
- admin (come utente che esegue)
= 3 notifiche duplicate per lo stesso admin!
```

### DOPO (corretto)
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
- Tecnico B
- Admin C
= Tecnico B e Admin C ricevono la notifica, User A no
```

```
Esempio: Tecnico B cambia stato richiesta di User A
Destinatari:
- Tecnico B (escluso perché è lui che esegue)
- User A (creatore)
- Admin C
= User A e Admin C ricevono la notifica, Tecnico B no
```

## Test da Eseguire

### Test 1: No Notifica a Chi Esegue l'Azione
1. Login come Admin
2. Crea una nuova richiesta
3. ✅ **Verifica**: Admin NON deve ricevere notifica della creazione

### Test 2: No Duplicati Admin
1. Login come Admin
2. Assegna una richiesta a te stesso
3. Fai un cambio stato
4. Logout e login come altro Admin
5. ✅ **Verifica**: L'altro admin deve ricevere UNA sola notifica (non duplicate)

### Test 3: Icone Corrette su Nuove Notifiche
1. Dopo aver applicato l'SQL, crea una nuova richiesta
2. Bloccala (→ SOSPESA)
3. ✅ **Verifica**: Icona triangolo arancio ⚠
4. Sbloccala (SOSPESA → IN_LAVORAZIONE)
5. ✅ **Verifica**: Icona check verde ✓
6. Completala (→ COMPLETATA)
7. ✅ **Verifica**: Icona cerchio grigio ⊖

### Test 4: Destinatari Corretti
1. User A crea richiesta assegnata a Tecnico B
2. ✅ **Verifica**:
   - User A: NO notifica
   - Tecnico B: SI notifica
   - Admin: SI notifica

## Files Coinvolti

### SQL da Applicare (in ordine)
1. ✅ `APPLY_NOTIFICATION_SYSTEM.sql` (già applicato)
2. ✅ `APPLY_UPDATE_NOTIFICATION_MESSAGES.sql` (già applicato)
3. 🔜 `APPLY_COMPLETE_NOTIFICATION_FIX.sql` (da applicare ora)

### Frontend (già corretto)
- ✅ [src/components/common/NotificationDrawer.tsx](src/components/common/NotificationDrawer.tsx)
- ✅ [src/services/api/notifications.ts](src/services/api/notifications.ts)
- ✅ [src/hooks/useNotifications.ts](src/hooks/useNotifications.ts)

## Riepilogo Modifiche SQL

### 1. get_notification_recipients (NUOVO)
```sql
-- Aggiunto DISTINCT
-- Aggiunto filtro u.id != v_current_user
```

### 2. Notifiche Vecchie (OPZIONALE)
```sql
-- Marcare come lette o eliminare
```

## Note Tecniche

### Perché COALESCE nell'esclusione utente?
```sql
u.id != COALESCE(v_current_user, '00000000-0000-0000-0000-000000000000'::uuid)
```

Se `auth.uid()` è NULL (es. operazione da trigger automatico), usiamo un UUID placeholder che non esiste, così non escludiamo nessuno per errore.

### Perché DISTINCT?
Un utente può essere sia creatore che admin, o sia assegnato che admin. `DISTINCT` garantisce che appaia una sola volta nella lista destinatari.

### Vecchie Notifiche
Le notifiche create prima dell'aggiornamento non hanno:
- `status_to` popolato correttamente
- `event_type` popolato correttamente
- `metadata` con dati extra

Quindi mostrano sempre l'icona default (cerchio blu info). Eliminarle o marcarle come lette risolve il problema visivo.
