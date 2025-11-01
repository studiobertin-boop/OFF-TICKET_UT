-- =============================================
-- TRIGGER: Inserisci record storico alla creazione richiesta
-- =============================================
-- Questo trigger inserisce automaticamente un record nello storico
-- quando viene creata una nuova richiesta, registrando lo stato iniziale

CREATE OR REPLACE FUNCTION insert_initial_request_history()
RETURNS TRIGGER AS $$
BEGIN
  -- Inserisci il primo record nello storico con status_from = NULL
  INSERT INTO request_history (
    request_id,
    status_from,
    status_to,
    changed_by,
    notes,
    created_at
  ) VALUES (
    NEW.id,
    NULL,  -- status_from è NULL per la creazione iniziale
    NEW.status,
    NEW.created_by,
    'Richiesta creata',
    NEW.created_at
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crea il trigger che si attiva dopo ogni INSERT su requests
CREATE TRIGGER after_request_insert_create_history
  AFTER INSERT ON requests
  FOR EACH ROW
  EXECUTE FUNCTION insert_initial_request_history();

-- Commento per documentazione
COMMENT ON FUNCTION insert_initial_request_history() IS
'Inserisce automaticamente un record nello storico quando viene creata una nuova richiesta';
COMMENT ON TRIGGER after_request_insert_create_history ON requests IS
'Registra lo stato iniziale di ogni nuova richiesta nello storico';
