-- Migration: Allow userdm329 to attribute DM329-family requests and read all users
-- Date: 2026-05-12

-- ============================================================
-- 1. USERS TABLE: userdm329 può leggere tutti gli utenti attivi
--    (necessario per il dropdown del dialog Attribuisci)
-- ============================================================
DROP POLICY IF EXISTS "userdm329 can view all active users" ON users;

CREATE POLICY "userdm329 can view all active users"
  ON users
  FOR SELECT
  TO authenticated
  USING (
    get_user_role() = 'userdm329'
    AND (is_suspended = false OR is_suspended IS NULL)
  );

-- ============================================================
-- 2. ATTRIBUTE_REQUEST: permetti a userdm329 di attribuire
--    richieste DM329-family (non solo admin)
-- ============================================================
CREATE OR REPLACE FUNCTION attribute_request(
  p_request_id UUID,
  p_attributed_to UUID,
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
  v_creator RECORD;
  v_previous_attributed UUID;
  v_request_type_name TEXT;
BEGIN
  -- Get attributor role
  SELECT * INTO v_attributor FROM users WHERE id = p_attributed_by;

  -- Permesso: admin sempre; userdm329 solo su pratiche DM329-family
  IF v_attributor.role NOT IN ('admin', 'userdm329') THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Solo admin e utenti DM329 possono attribuire richieste'
    );
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

  -- userdm329 può attribuire solo pratiche DM329-family
  IF v_attributor.role = 'userdm329' AND v_request.request_type_name NOT IN ('DM329', 'DM329-Integrazioni') THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Gli utenti DM329 possono attribuire solo pratiche DM329'
    );
  END IF;

  -- Get target user details
  SELECT * INTO v_attributed_user FROM users WHERE id = p_attributed_to;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Utente target non trovato');
  END IF;

  -- Store previous attribution for history
  v_previous_attributed := v_request.attributed_to;

  -- Update request with new attribution
  UPDATE requests
  SET attributed_to = p_attributed_to, updated_at = NOW()
  WHERE id = p_request_id;

  -- Track in request_history
  INSERT INTO request_history (request_id, status_from, status_to, changed_by, notes)
  VALUES (
    p_request_id,
    CASE
      WHEN v_previous_attributed IS NOT NULL THEN
        'ATTRIBUTED_TO:' || (SELECT full_name FROM users WHERE id = v_previous_attributed)
      ELSE 'NOT_ATTRIBUTED'
    END,
    'ATTRIBUTED_TO:' || v_attributed_user.full_name,
    p_attributed_by,
    COALESCE(p_notes, 'Richiesta attribuita')
  );

  -- Notification for attributed user
  INSERT INTO notifications (user_id, request_id, type, message, event_type, metadata, read)
  VALUES (
    p_attributed_to,
    p_request_id,
    'info',
    'Ti è stata attribuita la richiesta: ' || v_request.title,
    'request_attributed',
    json_build_object(
      'attributed_by', p_attributed_by,
      'attributed_by_name', v_attributor.full_name,
      'notes', p_notes
    ),
    false
  );

  -- Notification for original creator (if different)
  IF v_request.created_by != p_attributed_to THEN
    INSERT INTO notifications (user_id, request_id, type, message, event_type, metadata, read)
    VALUES (
      v_request.created_by,
      p_request_id,
      'info',
      'La richiesta "' || v_request.title || '" è stata attribuita a ' || v_attributed_user.full_name,
      'request_attributed',
      json_build_object(
        'attributed_to', p_attributed_to,
        'attributed_to_name', v_attributed_user.full_name,
        'attributed_by', p_attributed_by,
        'attributed_by_name', v_attributor.full_name
      ),
      false
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'message', 'Richiesta attribuita con successo a ' || v_attributed_user.full_name,
    'data', json_build_object(
      'request_id', p_request_id,
      'attributed_to', p_attributed_to,
      'attributed_to_name', v_attributed_user.full_name,
      'previous_attributed_to', v_previous_attributed
    )
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'message', 'Errore durante l''attribuzione: ' || SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION attribute_request(UUID, UUID, UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION attribute_request IS
  'Attribuisce una richiesta. Admin: qualsiasi pratica. Userdm329: solo pratiche DM329/DM329-Integrazioni.';
