# Fix: Persistenza Preferenze Notifiche

## Problema Risolto

Le impostazioni di notifica personalizzate dall'utente non erano persistenti:
- Le preferenze di transizione stato tornavano a "disattivate" dopo il refresh
- Le notifiche configurate non venivano generate

## Causa del Bug

### 1. **API updateStatusTransitionPreference** non preservava le proprietà esistenti
```typescript
// PRIMA - ERRATO
async updateStatusTransitionPreference(...): Promise<void> {
  const currentPrefs = await this.getNotificationPreferences()
  const statusTransitions = currentPrefs?.status_transitions || {}

  statusTransitions[key] = enabled

  // ❌ Sovrascriveva solo status_transitions, perdendo in_app ed email
  await this.upsertNotificationPreferences({ status_transitions: statusTransitions })
}
```

Il problema era che l'upsert con solo `{ status_transitions }` sovrascriveva l'intero record, perdendo le proprietà `in_app` ed `email`.

### 2. **Mancanza di gestione errori** nell'UI
- Nessun feedback visivo del salvataggio
- Nessun ripristino dello stato in caso di errore

## Soluzione Implementata

### 1. **API: Preservare tutte le proprietà** ✓

File: [src/services/api/notifications.ts](src/services/api/notifications.ts:141-175)

```typescript
// DOPO - CORRETTO
async updateStatusTransitionPreference(
  statusFrom: string,
  statusTo: string,
  enabled: boolean
): Promise<UserNotificationPreferences> {  // ← Ora ritorna i dati aggiornati
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('User not authenticated')

  const currentPrefs = await this.getNotificationPreferences()

  // ✅ Gestione caso preferenze non esistenti
  if (!currentPrefs) {
    const key = `${statusFrom}_${statusTo}`
    return await this.upsertNotificationPreferences({
      in_app: true,
      email: false,
      status_transitions: { [key]: enabled }
    })
  }

  // ✅ Clona status_transitions per immutabilità
  const statusTransitions = { ...(currentPrefs.status_transitions || {}) }
  const key = `${statusFrom}_${statusTo}`
  statusTransitions[key] = enabled

  // ✅ IMPORTANTE: Salva TUTTE le proprietà esistenti
  return await this.upsertNotificationPreferences({
    in_app: currentPrefs.in_app,      // ← Preservato
    email: currentPrefs.email,         // ← Preservato
    status_transitions: statusTransitions  // ← Aggiornato
  })
}
```

**Modifiche chiave:**
1. ✅ Ritorna `UserNotificationPreferences` invece di `void`
2. ✅ Gestisce il caso di preferenze non esistenti
3. ✅ Preserva **esplicitamente** `in_app` ed `email` nell'upsert
4. ✅ Clona l'oggetto `status_transitions` invece di mutarlo

### 2. **UI: Gestione errori e feedback** ✓

File: [src/pages/NotificationSettings.tsx](src/pages/NotificationSettings.tsx:85-100)

```typescript
const handleToggleTransition = (from: string, to: string, enabled: boolean) => {
  const key = `${from}_${to}`

  // ✅ Aggiorna immediatamente lo stato locale per feedback visivo (optimistic update)
  setStatusTransitions((prev) => ({ ...prev, [key]: enabled }))

  // ✅ Salva sul backend con gestione errori
  updateStatusTransition(
    { statusFrom: from, statusTo: to, enabled },
    {
      onError: (error) => {
        console.error('Errore salvataggio preferenza:', error)
        // ✅ Ripristina lo stato locale in caso di errore (rollback)
        setStatusTransitions((prev) => ({ ...prev, [key]: !enabled }))
      }
    }
  )
}
```

**Pattern Optimistic Update:**
1. ✅ Aggiorna immediatamente l'UI (feedback istantaneo)
2. ✅ Invia la richiesta al backend
3. ✅ Se fallisce, ripristina lo stato precedente (rollback)

## Come Funziona Ora

### Salvataggio Preferenze
1. **Utente toglie lo switch** su una transizione (es. APERTA → ASSEGNATA)
2. **UI si aggiorna immediatamente** (optimistic update)
3. **Backend riceve la chiamata** con tutti i dati:
   ```json
   {
     "in_app": true,
     "email": false,
     "status_transitions": {
       "APERTA_ASSEGNATA": true,
       "altre_transizioni": false
     }
   }
   ```
4. **Supabase salva con upsert** preservando tutto
5. **Query viene invalidata** e ricarica i dati freschi

### Generazione Notifiche
Il trigger database in `create_notification()` ora funziona correttamente:

```sql
-- Verifica se la transizione è nelle preferenze
v_should_notify := COALESCE(
  (v_preferences.status_transitions->>(p_status_from || '_' || p_status_to))::boolean,
  false
);
```

Poiché `status_transitions` ora è correttamente salvato, le notifiche vengono generate quando:
- ✅ La preferenza esiste nel JSONB
- ✅ Il valore è `true`
- ✅ L'utente ha `in_app: true`

## Test da Eseguire

### Test 1: Salvataggio Preferenze
1. Vai su Impostazioni Notifiche
2. Attiva una transizione (es. APERTA → ASSEGNATA)
3. Ricarica la pagina (F5)
4. ✅ **Verifica**: Lo switch deve rimanere attivo

### Test 2: Generazione Notifiche
1. Con le preferenze salvate, crea una richiesta
2. Cambia lo stato secondo la transizione configurata
3. ✅ **Verifica**: Deve arrivare la notifica

### Test 3: Preservazione Altre Proprietà
1. Disattiva "Notifiche in-app" e salva
2. Attiva una transizione di stato
3. Ricarica la pagina
4. ✅ **Verifica**: "Notifiche in-app" deve essere ancora disattivata

### Test 4: Gestione Errori
1. Apri Network DevTools
2. Simula un errore di rete (Offline)
3. Prova a cambiare una transizione
4. ✅ **Verifica**: Lo switch deve tornare alla posizione precedente
5. ✅ **Verifica**: Deve apparire un errore in console

## Files Modificati

- ✅ [src/services/api/notifications.ts](src/services/api/notifications.ts) - Correzione logica upsert
- ✅ [src/pages/NotificationSettings.tsx](src/pages/NotificationSettings.tsx) - Gestione errori e optimistic update

## Note Tecniche

### Upsert in Supabase
Quando usiamo `.upsert()` in Supabase con un oggetto parziale, dobbiamo:
1. **Specificare TUTTE le colonne** che vogliamo mantenere
2. Supabase usa `user_id` come chiave unica per l'upsert
3. Se omettiamo colonne, potrebbero essere sovrascritte con `NULL` o valori default

### JSONB in PostgreSQL
Il campo `status_transitions` è di tipo JSONB:
- Supporta operatori `->` e `->>`
- Gli aggiornamenti JSONB sono sempre full replace (non merge)
- Dobbiamo clonare l'intero oggetto e riassegnarlo

### Optimistic Updates
Pattern UX per ridurre latency percepita:
1. Aggiorna UI immediatamente
2. Invia richiesta al server
3. Se fallisce, rollback UI
4. Se succede, la query revalidation conferma i dati

## Prossimi Step

Una volta verificato che tutto funziona:
1. ✅ Testare il salvataggio delle preferenze
2. ✅ Testare la generazione notifiche con preferenze custom
3. ✅ Verificare che le notifiche automatiche funzionino ancora
4. 🔜 Procedere con Fase 2: Notifiche Email
