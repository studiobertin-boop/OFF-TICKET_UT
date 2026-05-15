-- Migration: Allow revoking attribution by passing NULL as p_attributed_to
-- Date: 2026-05-12

CREATE OR REPLACE FUNCTION attribute_request(
  p_request_id UUID,
  p_attributed_to UUID,       -- NULL = revoca attribuzione
  p_attributed_by UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request RECORD;
  v_attributed_user RECORD;
  v_attributor RECORD;
  v_previous_attributed UUID;
BEGIN
  -- Get attributor role
  SELECT * INTO v_attributor FROM users WHERE id = p_attributed_by;

  IF v_attributor.role NOT IN ('admin', 'userdm329') THEN
    RETURN json_build_object('success', false, 'message', 'Solo admin e utenti DM329 possono gestire le attribuzioni');
  END IF;

  -- Get request details
  SELECT r.*, rt.name AS request_type_name
  INTO v_request
  FROM requests r
  JOIN request_types rt ON r.request_type_id = rt.id
  WHERE r.id = p_request_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Richiesta non trovata');
  END IF;

  IF v_attributor.role = 'userdm329' AND v_request.request_type_name NOT IN ('DM329', 'DM329-Integrazioni') THEN
    RETURN json_build_object('success', false, 'message', 'Gli utenti DM329 possono gestire solo pratiche DM329');
  END IF;

  v_previous_attributed := v_request.attributed_to;

  -- Se p_attributed_to è NULL: revoca attribuzione
  IF p_attributed_to IS NULL THEN
    IF v_previous_attributed IS NULL THEN
      RETURN json_build_object('success', false, 'message', 'La richiesta non è attribuita a nessuno');
    END IF;

    UPDATE requests SET attributed_to = NULL, updated_at = NOW() WHERE id = p_request_id;

    INSERT INTO request_history (request_id, status_from, status_to, changed_by, notes)
    VALUES (
      p_request_id,
      'ATTRIBUTED_TO:' || (SELECT full_name FROM users WHERE id = v_previous_attributed),
      'NOT_ATTRIBUTED',
      p_attributed_by,
      COALESCE(p_notes, 'Attribuzione revocata')
    );

    RETURN json_build_object(
      'success', true,
      'message', 'Attribuzione revocata',
      'data', json_build_object('request_id', p_request_id, 'attributed_to', null)
    );
  END IF;

  -- Altrimenti: attribuisci a p_attributed_to
  SELECT * INTO v_attributed_user FROM users WHERE id = p_attributed_to;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Utente target non trovato');
  END IF;

  UPDATE requests SET attributed_to = p_attributed_to, updated_at = NOW() WHERE id = p_request_id;

  INSERT INTO request_history (request_id, status_from, status_to, changed_by, notes)
  VALUES (
    p_request_id,
    CASE WHEN v_previous_attributed IS NOT NULL
      THEN 'ATTRIBUTED_TO:' || (SELECT full_name FROM users WHERE id = v_previous_attributed)
      ELSE 'NOT_ATTRIBUTED'
    END,
    'ATTRIBUTED_TO:' || v_attributed_user.full_name,
    p_attributed_by,
    COALESCE(p_notes, 'Richiesta attribuita')
  );

  INSERT INTO notifications (user_id, request_id, type, message, event_type, metadata, read)
  VALUES (
    p_attributed_to, p_request_id, 'info',
    'Ti è stata attribuita la richiesta: ' || v_request.title,
    'request_attributed',
    json_build_object('attributed_by', p_attributed_by, 'attributed_by_name', v_attributor.full_name, 'notes', p_notes),
    false
  );

  IF v_request.created_by != p_attributed_to THEN
    INSERT INTO notifications (user_id, request_id, type, message, event_type, metadata, read)
    VALUES (
      v_request.created_by, p_request_id, 'info',
      'La richiesta "' || v_request.title || '" è stata attribuita a ' || v_attributed_user.full_name,
      'request_attributed',
      json_build_object('attributed_to', p_attributed_to, 'attributed_to_name', v_attributed_user.full_name,
        'attributed_by', p_attributed_by, 'attributed_by_name', v_attributor.full_name),
      false
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'message', 'Richiesta attribuita con successo a ' || v_attributed_user.full_name,
    'data', json_build_object('request_id', p_request_id, 'attributed_to', p_attributed_to,
      'attributed_to_name', v_attributed_user.full_name, 'previous_attributed_to', v_previous_attributed)
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'message', 'Errore: ' || SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION attribute_request(UUID, UUID, UUID, TEXT) TO authenticated;
