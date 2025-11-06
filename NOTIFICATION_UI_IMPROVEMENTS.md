# Miglioramenti UI Notifiche

## Implementazioni Completate ✅

### 1. Icone Notifiche Aggiornate

**Richiesta Sbloccata (SOSPESA → altro stato)**
- ✅ **Prima**: Icona cerchio verde con check ✓
- ✅ **Dopo**: Icona **PlayArrow** verde (simbolo "via libera" ▶️)

**Richiesta Abortita**
- ✅ **Aggiunta**: Icona **Cancel** rossa (cerchio con X ⊗)
- ✅ Rilevamento automatico quando `status_to === 'ABORTITA'`

**Codice**: [NotificationDrawer.tsx](src/components/common/NotificationDrawer.tsx:35-55)

```typescript
function getNotificationIcon(notification: Notification) {
  const { event_type, status_to } = notification

  // Icona speciale per richieste abortite
  if (status_to === 'ABORTITA') {
    return <CancelIcon color="error" />  // ← X rossa
  }

  switch (event_type) {
    case 'request_created':
      return <InfoIcon color="info" />
    case 'request_suspended':
      return <BlockIcon color="error" />
    case 'request_unsuspended':
      return <PlayArrowIcon color="success" />  // ← Via libera verde
    case 'status_change':
      return <WarningIcon color="warning" />
    default:
      return <InfoIcon />
  }
}
```

### 2. Formato Messaggi Notifiche Aggiornato

**Prima:**
- DM329: `"Richiesta DM329 è stata creata"`
- Generali: `"La richiesta TIPO RICHIESTA - DATA è stata bloccata"`

**Dopo:**
```
CLIENTE - TIPO RICHIESTA - azione

Esempi:
- "Acme Corp - DM329 DARA - richiesta creata"
- "Studio Rossi - Richiesta Allacciamento - richiesta bloccata"
- "Industriale SRL - DM329 DARA - richiesta sbloccata"
- "Casa SPA - Sopralluogo - richiesta abortita"
```

**Se la richiesta non ha cliente:**
```
TIPO RICHIESTA - azione

Esempio:
- "DM329 DARA - richiesta creata"
```

**Azioni supportate:**
- `richiesta creata` (nuovo)
- `richiesta bloccata` (sospesa)
- `richiesta sbloccata` (unsospesa)
- `richiesta abortita` (abortita)
- `richiesta completata` (completata)
- `cambiata da X a Y` (altri cambi stato)

### 3. Implementazione Database

Il trigger SQL aggiornato in [20251105000004_update_notification_messages.sql](supabase/migrations/20251105000004_update_notification_messages.sql):

```sql
-- Ottieni dati con JOIN
SELECT
  r.title,
  rt.name,
  c.ragione_sociale,  -- ← Nome cliente
  CASE WHEN rt.name LIKE '%DM329%' THEN true ELSE false END
INTO
  v_request_title,
  v_request_type_name,
  v_customer_name,
  v_is_dm329
FROM requests r
LEFT JOIN request_types rt ON r.request_type_id = rt.id
LEFT JOIN customers c ON r.customer_id = c.id  -- ← JOIN clienti
WHERE r.id = NEW.id;

-- Costruisci prefisso
IF v_customer_name IS NOT NULL THEN
  v_prefix := v_customer_name || ' - ' || v_request_type_name;
ELSE
  v_prefix := v_request_type_name;
END IF;

-- Messaggio finale
v_message := v_prefix || ' - ' || v_action;
```

## Come Applicare le Modifiche

### Frontend (già applicato)
✅ Il codice TypeScript è già aggiornato e compila correttamente

### Backend (da applicare manualmente)

**Opzione 1: SQL Editor Supabase**
1. Vai su https://app.supabase.com
2. Apri il tuo progetto
3. SQL Editor
4. Copia e incolla il contenuto di `APPLY_UPDATE_NOTIFICATION_MESSAGES.sql`
5. Esegui

**Opzione 2: CLI (se migrations allineate)**
```bash
npx supabase db push
```

## Files Modificati

### Frontend ✅
- [src/components/common/NotificationDrawer.tsx](src/components/common/NotificationDrawer.tsx)
  - Aggiornate funzioni `getNotificationIcon()` e `getNotificationColor()`
  - Rimossi import non utilizzati

### Backend 📝
- [supabase/migrations/20251105000004_update_notification_messages.sql](supabase/migrations/20251105000004_update_notification_messages.sql)
- [supabase/migrations/APPLY_UPDATE_NOTIFICATION_MESSAGES.sql](supabase/migrations/APPLY_UPDATE_NOTIFICATION_MESSAGES.sql)

## Test da Eseguire

### Test 1: Icone
1. Crea una richiesta qualsiasi
2. Bloccala (→ SOSPESA)
3. ✅ Verifica icona **Block** rossa
4. Sbloccala (SOSPESA → IN_LAVORAZIONE)
5. ✅ Verifica icona **PlayArrow** verde (▶️)
6. Abortisci una richiesta (→ ABORTITA)
7. ✅ Verifica icona **Cancel** rossa (⊗)

### Test 2: Messaggi
Dopo aver applicato la migration SQL:

1. **Richiesta con cliente DM329:**
   - Crea richiesta DM329 per "Acme Corp"
   - ✅ Messaggio: `"Acme Corp - DM329 DARA - richiesta creata"`

2. **Richiesta senza cliente:**
   - Crea richiesta generica senza cliente
   - ✅ Messaggio: `"TIPO RICHIESTA - richiesta creata"`

3. **Blocco/Sblocco:**
   - Blocca richiesta
   - ✅ Messaggio: `"CLIENTE - TIPO - richiesta bloccata"`
   - Sblocca richiesta
   - ✅ Messaggio: `"CLIENTE - TIPO - richiesta sbloccata"`

4. **Abortita:**
   - Aborti richiesta
   - ✅ Messaggio: `"CLIENTE - TIPO - richiesta abortita"`
   - ✅ Icona: X rossa

## Note Tecniche

### Metadata Aggiuntivi
Le notifiche ora includono nei metadata JSONB:
- `request_title`: Titolo completo richiesta
- `request_type_name`: Nome tipo richiesta
- `customer_name`: Nome cliente (se presente)
- `is_dm329`: Boolean per identificare DM329
- `is_suspension`: Boolean per blocco
- `is_unsuspension`: Boolean per sblocco

Questi dati sono disponibili per future implementazioni (es. filtri, raggruppamenti).

### Retrocompatibilità
✅ Le notifiche esistenti continuano a funzionare
✅ Solo le nuove notifiche avranno il formato aggiornato
✅ Le icone si adattano anche alle vecchie notifiche
