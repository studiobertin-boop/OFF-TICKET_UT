# Migration: Storico Iniziale Richieste

## Problema Risolto
Quando viene creata una nuova richiesta, lo storico dei cambi stato non include il record iniziale "APERTA". Lo storico inizia solo dal primo cambio stato successivo.

## Soluzione
Aggiunto un trigger PostgreSQL che inserisce automaticamente un record nello storico quando viene creata una nuova richiesta.

## File Migration
`supabase/migrations/20250101000003_add_initial_history_trigger.sql`

## Come Applicare

### Via Dashboard Supabase

1. Vai al SQL Editor: https://supabase.com/dashboard/project/uphftgpwisdiubuhohnc/editor

2. Copia e incolla il contenuto del file `20250101000003_add_initial_history_trigger.sql`

3. Clicca "Run" per eseguire la migration

4. Verifica che sia stata applicata correttamente:
```sql
-- Verifica che la function esista
SELECT routine_name
FROM information_schema.routines
WHERE routine_name = 'insert_initial_request_history';

-- Verifica che il trigger esista
SELECT trigger_name
FROM information_schema.triggers
WHERE trigger_name = 'after_request_insert_create_history';
```

## Comportamento

### Prima della Migration
```
requests:
  id: xxx
  status: APERTA
  created_at: 2025-01-01 10:00

request_history:
  (vuoto fino al primo cambio stato)
```

### Dopo la Migration
```
requests:
  id: xxx
  status: APERTA
  created_at: 2025-01-01 10:00

request_history:
  id: yyy
  request_id: xxx
  status_from: NULL
  status_to: APERTA
  changed_by: (utente creatore)
  notes: "Richiesta creata"
  created_at: 2025-01-01 10:00
```

### Al primo cambio stato
```
request_history:
  1) status_from: NULL → status_to: APERTA (creazione)
  2) status_from: APERTA → status_to: ASSEGNATA (primo cambio)
```

## Test

Dopo aver applicato la migration, testa creando una nuova richiesta:

1. Accedi all'app come utente
2. Crea una nuova richiesta
3. Vai al dettaglio della richiesta
4. Verifica che lo storico mostri:
   - Prima voce: "Richiesta creata" → APERTA
   - Voce successiva (se c'è): APERTA → [stato successivo]

## Nota Importante

Questa migration NON modifica lo storico delle richieste esistenti. Solo le nuove richieste create dopo l'applicazione della migration avranno il record iniziale nello storico.

Se vuoi popolare lo storico per le richieste esistenti che non hanno ancora cambi stato, esegui questo script manuale:

```sql
-- OPZIONALE: Popola storico per richieste esistenti senza history
INSERT INTO request_history (request_id, status_from, status_to, changed_by, notes, created_at)
SELECT
  r.id,
  NULL,
  r.status,
  r.created_by,
  'Richiesta creata (retroattivo)',
  r.created_at
FROM requests r
WHERE NOT EXISTS (
  SELECT 1 FROM request_history rh WHERE rh.request_id = r.id
);
```

## Rollback

Se necessario rollback:

```sql
-- Rimuovi il trigger
DROP TRIGGER IF EXISTS after_request_insert_create_history ON requests;

-- Rimuovi la function
DROP FUNCTION IF EXISTS insert_initial_request_history();

-- (Opzionale) Rimuovi record storico creati dal trigger
DELETE FROM request_history WHERE notes = 'Richiesta creata';
```
