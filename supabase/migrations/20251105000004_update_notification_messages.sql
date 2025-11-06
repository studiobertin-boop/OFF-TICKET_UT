-- Aggiorna il trigger per creare messaggi di notifica con formato migliorato
CREATE OR REPLACE FUNCTION notify_request_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_recipient UUID;
  v_message TEXT;
  v_request_title TEXT;
  v_request_type_name TEXT;
  v_customer_name TEXT;
  v_event_type TEXT;
  v_is_suspension BOOLEAN := false;
  v_is_unsuspension BOOLEAN := false;
  v_is_dm329 BOOLEAN := false;
BEGIN
  -- Ottieni dati della richiesta con JOIN
  SELECT
    r.title,
    rt.name,
    c.ragione_sociale,
    CASE WHEN rt.name LIKE '%DM329%' THEN true ELSE false END
  INTO
    v_request_title,
    v_request_type_name,
    v_customer_name,
    v_is_dm329
  FROM requests r
  LEFT JOIN request_types rt ON r.request_type_id = rt.id
  LEFT JOIN customers c ON r.customer_id = c.id
  WHERE r.id = NEW.id;

  -- Costruisci il prefisso del messaggio basato sul tipo di richiesta
  DECLARE
    v_prefix TEXT;
    v_action TEXT;
  BEGIN
    -- Costruisci prefisso: "CLIENTE - TIPO RICHIESTA" o solo "TIPO RICHIESTA" se no cliente
    IF v_customer_name IS NOT NULL THEN
      v_prefix := v_customer_name || ' - ' || v_request_type_name;
    ELSE
      v_prefix := v_request_type_name;
    END IF;

    -- Determina tipo evento e azione
    IF OLD.status IS NULL THEN
      -- Nuova richiesta
      v_event_type := 'request_created';
      v_action := 'richiesta creata';
    ELSIF NEW.status = 'SOSPESA' AND OLD.status != 'SOSPESA' THEN
      -- Blocco
      v_event_type := 'request_suspended';
      v_action := 'richiesta bloccata';
      v_is_suspension := true;
    ELSIF OLD.status = 'SOSPESA' AND NEW.status != 'SOSPESA' THEN
      -- Sblocco
      v_event_type := 'request_unsuspended';
      v_action := 'richiesta sbloccata';
      v_is_unsuspension := true;
    ELSIF NEW.status = 'ABORTITA' THEN
      -- Abortita
      v_event_type := 'status_change';
      v_action := 'richiesta abortita';
    ELSIF NEW.status = 'COMPLETATA' THEN
      -- Completata
      v_event_type := 'status_change';
      v_action := 'richiesta completata';
    ELSE
      -- Cambio stato generico
      v_event_type := 'status_change';
      v_action := 'cambiata da ' || OLD.status || ' a ' || NEW.status;
    END IF;

    -- Costruisci messaggio finale
    v_message := v_prefix || ' - ' || v_action;
  END;

  -- Notifica tutti i destinatari
  FOR v_recipient IN
    SELECT * FROM get_notification_recipients(NEW.id)
  LOOP
    PERFORM create_notification(
      v_recipient,
      NEW.id,
      v_event_type,
      v_message,
      OLD.status,
      NEW.status,
      jsonb_build_object(
        'request_title', v_request_title,
        'request_type_name', v_request_type_name,
        'customer_name', v_customer_name,
        'is_dm329', v_is_dm329,
        'is_suspension', v_is_suspension,
        'is_unsuspension', v_is_unsuspension
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
