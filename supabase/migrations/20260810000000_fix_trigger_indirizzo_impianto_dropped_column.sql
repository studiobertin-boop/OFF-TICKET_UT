-- Fix: create_technical_data_for_dm329() inserisce ancora dm329_technical_data.indirizzo_impianto,
-- colonna rimossa da 20260802000000_drop_indirizzo_impianto_legacy.sql. Da quel momento ogni
-- creazione di richiesta DM329 fallisce (il trigger AFTER INSERT su requests va in errore:
-- "column indirizzo_impianto of relation dm329_technical_data does not exist").
--
-- requests.indirizzo_impianto resta comunque la sorgente unica (vedi 20260801000000): il trigger
-- deve solo smettere di travasarlo sulla scheda tecnica.

CREATE OR REPLACE FUNCTION create_technical_data_for_dm329()
RETURNS TRIGGER AS $$
DECLARE
  v_request_type_name TEXT;
BEGIN
  SELECT name INTO v_request_type_name FROM request_types WHERE id = NEW.request_type_id;

  IF v_request_type_name = 'DM329' THEN
    INSERT INTO dm329_technical_data (request_id, created_by)
    VALUES (NEW.id, NEW.created_by);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
