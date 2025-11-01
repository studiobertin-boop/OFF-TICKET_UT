-- =============================================
-- CONSTRAINT: Valida stato ASSEGNATA richiede assigned_to
-- =============================================
-- Impedisce che una richiesta abbia stato ASSEGNATA senza un tecnico assegnato

-- STEP 1: Correggi dati esistenti inconsistenti
-- Riporta a APERTA le richieste con stato ASSEGNATA ma senza tecnico
UPDATE requests
SET status = 'APERTA'
WHERE status = 'ASSEGNATA' AND assigned_to IS NULL;

-- STEP 2: Aggiungi constraint alla tabella requests
ALTER TABLE requests
ADD CONSTRAINT check_assigned_status_requires_user
CHECK (
  (status = 'ASSEGNATA' AND assigned_to IS NOT NULL) OR
  (status != 'ASSEGNATA')
);

-- Commento per documentazione
COMMENT ON CONSTRAINT check_assigned_status_requires_user ON requests IS
'Impedisce che una richiesta abbia stato ASSEGNATA senza un tecnico assegnato (assigned_to deve essere valorizzato)';
