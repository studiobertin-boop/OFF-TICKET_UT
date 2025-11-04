# Bugfix: Prevenzione Cambio Stato su Richieste Bloccate

**Data**: 2025-11-02
**Problema**: Gli utenti potevano cambiare lo stato di una richiesta anche quando questa era bloccata
**Gravità**: Alta - compromette la logica di business del sistema di blocco

## Problema Riscontrato

Durante i test è emerso che un utente con ruolo `utente` poteva modificare lo stato di una pratica anche quando questa era bloccata. Questo vanifica completamente lo scopo del sistema di blocco, che dovrebbe impedire qualsiasi avanzamento della pratica fino alla risoluzione del blocco.

### Causa Root

1. **Backend (Database)**: La funzione `validate_status_transition` non verificava se la richiesta fosse bloccata prima di autorizzare la transizione
2. **Frontend**: Il componente `StatusTransitionButtons` non disabilitava i pulsanti quando la richiesta era bloccata

## Soluzione Implementata

### 1. Migrazione Database

**File**: `supabase/migrations/20251102000002_prevent_status_change_when_blocked.sql`

Aggiornata la funzione `validate_status_transition` per:
- Recuperare lo stato `is_blocked` dalla richiesta
- Verificare se la richiesta è bloccata **dopo** il check admin ma **prima** dei controlli workflow
- Restituire errore se utente non-admin tenta di cambiare stato su richiesta bloccata
- Permettere agli admin di cambiare stato anche su richieste bloccate

```sql
-- Check if request is blocked (non-admin users cannot change status)
IF v_is_blocked THEN
  RETURN QUERY SELECT false, 'Impossibile cambiare stato: la richiesta è bloccata. Risolvi il blocco prima di procedere.';
  RETURN;
END IF;
```

### 2. Frontend - StatusTransitionButtons

**File**: `src/components/requests/StatusTransitionButtons.tsx`

Modifiche:
- Aggiunto prop `isBlocked?: boolean`
- Calcolato `isDisabledDueToBlock = isBlocked && user.role !== 'admin'`
- Mostrato Alert warning se disabilitato per blocco
- Admin continua a vedere i pulsanti normalmente

### 3. Frontend - RequestDetail

**File**: `src/pages/RequestDetail.tsx`

Modifiche:
- Passato prop `isBlocked={request.is_blocked}` a `StatusTransitionButtons`

## Comportamento Corretto

### Utenti Non-Admin (utente, tecnico, userdm329)

Quando la richiesta è bloccata:
- ❌ Non vedono i pulsanti di cambio stato
- ✅ Vedono un alert warning: "Impossibile cambiare stato: la richiesta è bloccata. Risolvi il blocco prima di procedere."
- ✅ Se tentano di bypassare l'UI, il backend blocca l'operazione con lo stesso messaggio

### Utenti Admin

Quando la richiesta è bloccata:
- ✅ Vedono normalmente tutti i pulsanti di cambio stato
- ✅ Possono cambiare stato anche su richieste bloccate
- **Rationale**: Admin ha controllo totale per gestire situazioni eccezionali

## Ordine di Applicazione

1. Applica prima la migrazione `20251102000002_prevent_status_change_when_blocked.sql` via Supabase Dashboard
2. Deploy frontend con le modifiche a `StatusTransitionButtons.tsx` e `RequestDetail.tsx`

## Test di Verifica

### Test Case 1: Utente blocca, poi tenta cambio stato
```
1. Login come utente (creator della richiesta)
2. Richiesta viene bloccata da tecnico
3. Utente vede alert warning e non può cambiare stato
4. ✅ Comportamento corretto
```

### Test Case 2: Tecnico blocca, poi tenta cambio stato
```
1. Login come tecnico (assegnato alla richiesta)
2. Tecnico blocca la richiesta
3. Tecnico vede alert warning e non può cambiare stato
4. ✅ Comportamento corretto
```

### Test Case 3: Admin può sempre cambiare stato
```
1. Login come admin
2. Richiesta è bloccata
3. Admin vede normalmente i pulsanti di cambio stato
4. Admin cambia stato con successo
5. ✅ Comportamento corretto
```

### Test Case 4: Tentativo bypass via API
```
1. Utente non-admin tenta di chiamare updateRequestStatus via API su richiesta bloccata
2. Backend restituisce: { success: false, message: 'Impossibile cambiare stato: la richiesta è bloccata...' }
3. ✅ Comportamento corretto
```

## Note Tecniche

- Il controllo è implementato sia lato client (UX) che lato server (sicurezza)
- Admin mantiene pieno controllo per gestire edge cases
- Il messaggio di errore è consistente tra frontend e backend
- La funzione database è idempotente e può essere riapplicata senza problemi
