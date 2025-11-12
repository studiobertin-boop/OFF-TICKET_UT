# Fix Eliminazione Utenti

## Problema
Quando si tentava di eliminare un utente dal pannello "Gestione Utenti", il popup di conferma rimaneva aperto e l'utente non veniva eliminato. La console mostrava:

```
Error: Edge Function returned a non-2xx status code
Failed to load resource: the server responded with a status of 500 ()
```

## Causa
La Edge Function `manage-user` tentava di eliminare l'utente direttamente da `auth.users`, ma falliva a causa di **constraint di foreign key** non gestiti:

1. L'utente aveva richieste collegate in `requests` (come `created_by` o `assigned_to`)
2. L'utente aveva notifiche in `notifications`
3. Eliminare da `auth.users` non eliminava automaticamente da `public.users`
4. I foreign key constraints impedivano l'eliminazione

## Soluzione Implementata

### 1. **Edge Function Migliorata** - [manage-user/index.ts:182-252](../supabase/functions/manage-user/index.ts#L182-L252)

La Edge Function ora segue una **procedura di eliminazione CASCADE manuale**:

#### Step 1: Rimuovere riferimenti alle richieste (mantenendo le richieste)
```typescript
// Impostare assigned_to a NULL per richieste assegnate
update('requests')
  .set({ assigned_to: null })
  .where('assigned_to', userId)

// Impostare created_by a NULL per richieste create (MANTIENE LE RICHIESTE)
update('requests')
  .set({ created_by: null })
  .where('created_by', userId)
```

#### Step 2: Eliminare notifiche
```typescript
delete('notifications')
  .where('user_id', userId)
```

#### Step 3: Eliminare da public.users
```typescript
delete('users')
  .where('id', userId)
```

#### Step 4: Eliminare da auth.users
```typescript
supabaseAdmin.auth.admin.deleteUser(userId)
```

### 2. **Frontend Migliorato** - [AdminUsers.tsx](../src/pages/admin/AdminUsers.tsx)

#### Gestione Errori
- [Line 66](../src/pages/admin/AdminUsers.tsx#L66): Aggiunto stato `deleteError` per mostrare errori
- [Line 83-111](../src/pages/admin/AdminUsers.tsx#L83-L111): Funzioni `handleDeleteClick`, `handleConfirmDelete`, `handleCancelDelete` con gestione errori completa
- [Line 308-327](../src/pages/admin/AdminUsers.tsx#L308-L327): Alert rosso nel dialog per mostrare errori all'utente

#### UI Migliorata
- Indicatore di caricamento durante eliminazione
- Pulsante con stato dinamico ("Elimina" → "Eliminazione...")
- Icona delete sul pulsante
- Dialog non chiudibile durante eliminazione

### 3. **API con Logging Esteso** - [users.ts:152-196](../src/services/api/users.ts#L152-L196)

```typescript
// Log ad ogni step
console.log('deleteUser called with userId:', userId)
console.log('Calling Edge Function manage-user with action: delete')
console.log('Edge Function response:', { data, error })
console.log('User deleted successfully')
```

## Comportamento Atteso

### Quando Elimini un Utente:

1. **Dialog di Conferma** si apre
2. Clic su **"Elimina"**
3. Pulsante mostra **"Eliminazione..."** con spinner
4. La Edge Function:
   - Aggiorna le richieste assegnate (assigned_to → NULL)
   - Elimina le richieste create dall'utente
   - Elimina le notifiche dell'utente
   - Elimina da `public.users`
   - Elimina da `auth.users`
5. **Dialog si chiude** automaticamente
6. **Lista utenti si ricarica** (l'utente scompare)

### In Caso di Errore:

1. **Dialog rimane aperto**
2. **Alert rosso** mostra l'errore specifico
3. **Console** mostra log dettagliati per debug
4. Puoi **riprovare** o **annullare**

## Test

### Test Caso di Successo:
1. Vai su "Gestione Utenti"
2. Seleziona un utente di test (es. FB - frabertin@yahoo.it)
3. Clicca icona 🗑️ (Elimina)
4. Conferma con "Elimina"
5. L'utente dovrebbe scomparire dalla lista

### Test Caso di Errore:
1. Apri Console (F12)
2. Tenta di eliminare un utente
3. Se c'è un errore, vedrai:
   - Messaggio di errore nel dialog
   - Log dettagliati in console

## Comportamento Attuale

✅ **Le richieste vengono MANTENUTE**: Quando un utente viene eliminato, le richieste create da lui vengono mantenute ma il campo `created_by` viene impostato a NULL.

Questo significa che:
- Le richieste restano nel sistema
- Lo storico è preservato
- Il creatore originale non è più visibile (appare come "Sconosciuto" o NULL)

Se preferisci un comportamento diverso (es. archiviare, marcare come eliminate, ecc.), possiamo modificare la logica.

## File Modificati

1. [supabase/functions/manage-user/index.ts](../supabase/functions/manage-user/index.ts) - Edge Function con eliminazione CASCADE
2. [src/pages/admin/AdminUsers.tsx](../src/pages/admin/AdminUsers.tsx) - UI migliorata con gestione errori
3. [src/services/api/users.ts](../src/services/api/users.ts) - Logging esteso

## File Creati

1. [supabase/CHECK_DELETE_CASCADE.sql](../supabase/CHECK_DELETE_CASCADE.sql) - Query diagnostiche per verificare constraint
2. [DOCUMENTAZIONE/FIX_DELETE_USER.md](../DOCUMENTAZIONE/FIX_DELETE_USER.md) - Questa documentazione

## Deployment

La Edge Function è già stata deployata con la logica aggiornata:
```bash
supabase functions deploy manage-user
# Deployed Functions on project uphftgpwisdiubuhohnc: manage-user
# Version: 21 (mantiene le richieste)
```

## Verifiche Post-Deployment

✅ Edge Function deployata (versione 21)
✅ Frontend aggiornato con gestione errori
✅ Logging esteso per debugging
✅ Le richieste vengono mantenute (created_by → NULL)
✅ Dialog aggiornato con messaggio corretto
⏳ **Test manuale richiesto**: Verifica che le richieste siano mantenute dopo eliminazione utente

## Considerazioni Future

### Opzione 1: Soft Delete
Invece di eliminare fisicamente, marcare l'utente come "eliminato":
- Aggiungere campo `deleted_at TIMESTAMP`
- Filtrare utenti con `deleted_at IS NULL`
- Mantiene storico completo

### Opzione 2: Archivio Eliminazioni
- Creare tabella `deleted_users` per storico
- Spostare dati prima dell'eliminazione
- Utile per audit e compliance

### Opzione 3: Protezione Admin
- Impedire eliminazione di utenti admin
- Richiedere secondo admin per conferma
- Prevenire eliminazioni accidentali

## Supporto

Se l'eliminazione continua a fallire:
1. Controlla la console del browser per errori dettagliati
2. Verifica i log della Edge Function nel Supabase Dashboard
3. Esegui [CHECK_DELETE_CASCADE.sql](../supabase/CHECK_DELETE_CASCADE.sql) per verificare constraint
