# Migration: Validazione Stato ASSEGNATA

## Problema Risolto
Era possibile cambiare lo stato di una richiesta in "ASSEGNATA" senza aver prima assegnato la richiesta a un tecnico. Questo creava inconsistenze logiche nel workflow.

## Soluzione Implementata

### 1. Constraint Database
**File:** `supabase/migrations/20250101000004_validate_assigned_status.sql`

Aggiunto constraint a livello database che impedisce di avere stato ASSEGNATA senza un tecnico assegnato:

```sql
ALTER TABLE requests
ADD CONSTRAINT check_assigned_status_requires_user
CHECK (
  (status = 'ASSEGNATA' AND assigned_to IS NOT NULL) OR
  (status != 'ASSEGNATA')
);
```

### 2. Validazione Lato Applicazione
**File modificato:** `src/services/requestService.ts`

Aggiunta validazione nella funzione `updateRequestStatus` (righe 80-86):
```typescript
if (newStatus === 'ASSEGNATA' && !request.assigned_to) {
  return {
    success: false,
    message: 'Non è possibile impostare lo stato ASSEGNATA senza aver prima assegnato la richiesta a un tecnico.',
  }
}
```

### 3. UI - Nascondere Pulsante ASSEGNATA
**File modificato:** `src/components/requests/StatusTransitionButtons.tsx`

- Aggiunto parametro `assignedTo` alla props (riga 27)
- Filtro per nascondere il pulsante "ASSEGNATA" se non c'è un tecnico assegnato (righe 52-58)

**File modificato:** `src/pages/RequestDetail.tsx`

- Passato `assignedTo={request.assigned_to}` al componente StatusTransitionButtons (riga 145)

## Come Applicare

### 1. Applica Migration Database

**Via Dashboard Supabase:**

1. Vai al SQL Editor: https://supabase.com/dashboard/project/uphftgpwisdiubuhohnc/editor

2. Copia e incolla il contenuto di `20250101000004_validate_assigned_status.sql`

3. Clicca "Run"

4. Verifica che sia stata applicata:
```sql
-- Verifica constraint creato
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname = 'check_assigned_status_requires_user';
```

### 2. Codice Frontend

Il codice frontend è già stato aggiornato automaticamente. Dopo aver applicato la migration database, ricarica l'applicazione.

## Comportamento

### Prima della Fix

```
Stato: APERTA
assigned_to: NULL
Azioni disponibili: [ASSEGNATA] ← ERRORE! Permetteva di selezionare ASSEGNATA
```

### Dopo la Fix

```
Scenario 1: Senza tecnico assegnato
Stato: APERTA
assigned_to: NULL
Azioni disponibili: [] (ASSEGNATA non viene mostrata)

Scenario 2: Con tecnico assegnato
Stato: APERTA
assigned_to: tecnico-123
Azioni disponibili: [ASSEGNATA] ← OK! Pulsante disponibile
```

## Test

### Test 1: Tentativo di cambio stato senza assegnazione
1. Apri una richiesta con stato APERTA
2. NON assegnare nessun tecnico
3. Verifica che il pulsante "ASSEGNATA" NON sia visibile

### Test 2: Cambio stato dopo assegnazione
1. Apri una richiesta con stato APERTA
2. Assegna un tecnico dalla sezione "Assegnazione"
3. Verifica che il pulsante "ASSEGNATA" sia ora visibile
4. Clicca su "ASSEGNATA"
5. Verifica che il cambio stato funzioni correttamente

### Test 3: Validazione Database
Prova a forzare l'update via SQL (dovrebbe fallire):
```sql
-- Questo dovrebbe FALLIRE con constraint violation
UPDATE requests
SET status = 'ASSEGNATA', assigned_to = NULL
WHERE id = 'qualche-id';

-- Errore atteso: violazione del constraint check_assigned_status_requires_user
```

### Test 4: Validazione API
Prova a chiamare l'API direttamente (dovrebbe fallire):
```javascript
// Questo dovrebbe restituire success: false
await updateRequestStatus(requestId, 'ASSEGNATA', userId, userRole)
// Con messaggio: "Non è possibile impostare lo stato ASSEGNATA..."
```

## Note Importanti

### Comportamento Assegnazione Automatica
La funzione `assignRequest` (in `requestService.ts`, riga 192-195) continua a funzionare come prima:
```typescript
// Se lo stato è APERTA, cambia automaticamente a ASSEGNATA dopo l'assegnazione
if (currentStatus === 'APERTA') {
  await updateRequestStatus(requestId, 'ASSEGNATA', assignedBy, 'admin')
}
```

Questo è il flusso corretto:
1. Admin assegna tecnico → `assigned_to` viene valorizzato
2. Se stato è APERTA → cambio automatico a ASSEGNATA
3. Validazione passa perché `assigned_to` è ora valorizzato

### Richieste Esistenti
Se hai richieste esistenti con stato ASSEGNATA ma senza tecnico assegnato (dati inconsistenti), devi correggerle manualmente:

```sql
-- Trova richieste inconsistenti
SELECT id, title, status, assigned_to
FROM requests
WHERE status = 'ASSEGNATA' AND assigned_to IS NULL;

-- Opzione 1: Riporta a APERTA
UPDATE requests
SET status = 'APERTA'
WHERE status = 'ASSEGNATA' AND assigned_to IS NULL;

-- Opzione 2: Assegna un tecnico di default
UPDATE requests
SET assigned_to = 'id-tecnico-default'
WHERE status = 'ASSEGNATA' AND assigned_to IS NULL;
```

## Rollback

Se necessario rollback:

```sql
-- Rimuovi constraint
ALTER TABLE requests
DROP CONSTRAINT IF EXISTS check_assigned_status_requires_user;
```

Poi reversa le modifiche al codice frontend usando git.

## File Modificati

- ✅ **Nuovo:** `supabase/migrations/20250101000004_validate_assigned_status.sql`
- ✅ **Modificato:** `src/services/requestService.ts` (righe 80-86)
- ✅ **Modificato:** `src/components/requests/StatusTransitionButtons.tsx` (righe 27, 52-58)
- ✅ **Modificato:** `src/pages/RequestDetail.tsx` (riga 145)
