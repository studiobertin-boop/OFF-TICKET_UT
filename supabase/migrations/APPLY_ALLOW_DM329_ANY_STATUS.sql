-- MANUAL MIGRATION: Allow userdm329 to set any DM329 status
-- Date: 2025-11-05
-- To apply: Copy and paste this SQL in Supabase SQL Editor
-- Description: Update validate_status_transition to allow userdm329 full access to all DM329 statuses

CREATE OR REPLACE FUNCTION validate_status_transition(
  p_request_id UUID,
  p_new_status TEXT,
  p_user_role user_role,
  p_request_type_name TEXT DEFAULT NULL
)
RETURNS TABLE(valid BOOLEAN, message TEXT) AS $$
DECLARE
  v_current_status TEXT;
  v_request_type TEXT;
  v_is_blocked BOOLEAN;
BEGIN
  -- Get current status, request type, and blocked state
  SELECT r.status, rt.name, COALESCE(r.is_blocked, false)
  INTO v_current_status, v_request_type, v_is_blocked
  FROM requests r
  JOIN request_types rt ON r.request_type_id = rt.id
  WHERE r.id = p_request_id;

  -- If request not found
  IF v_current_status IS NULL THEN
    RETURN QUERY SELECT false, 'Richiesta non trovata';
    RETURN;
  END IF;

  -- Admin can set any status (even if blocked)
  IF p_user_role = 'admin' THEN
    RETURN QUERY SELECT true, 'Transizione permessa (Admin)';
    RETURN;
  END IF;

  -- Utente (role=utente) CANNOT change status at all
  IF p_user_role = 'utente' THEN
    RETURN QUERY SELECT false, 'Gli utenti non possono modificare lo stato delle richieste';
    RETURN;
  END IF;

  -- Check if request is blocked (non-admin users cannot change status when blocked)
  IF v_is_blocked THEN
    RETURN QUERY SELECT false, 'Impossibile cambiare stato: la richiesta è bloccata. Risolvi il blocco prima di procedere.';
    RETURN;
  END IF;

  -- Check if it's a DM329 request (special workflow)
  IF v_request_type = 'DM329' THEN
    -- Only userdm329 and admin can change DM329 status
    IF p_user_role != 'userdm329' THEN
      RETURN QUERY SELECT false, 'Solo gli utenti DM329 possono modificare lo stato di richieste DM329';
      RETURN;
    END IF;

    -- userdm329 can set ANY DM329 status (like admin)
    -- Validate that the new status is a valid DM329 status
    IF p_new_status IN (
      '1-INCARICO_RICEVUTO',
      '2-SCHEDA_DATI_PRONTA',
      '3-MAIL_CLIENTE_INVIATA',
      '4-DOCUMENTI_PRONTI',
      '5-ATTESA_FIRMA',
      '6-PRONTA_PER_CIVA',
      '7-CHIUSA'
    ) THEN
      RETURN QUERY SELECT true, 'Transizione permessa (userdm329)';
    ELSE
      RETURN QUERY SELECT false, 'Stato non valido per richieste DM329';
    END IF;
    RETURN;
  END IF;

  -- Standard workflow for other request types (tecnico role)
  -- Only tecnico can change status on general requests (not DM329)
  IF p_user_role != 'tecnico' THEN
    RETURN QUERY SELECT false, 'Solo i tecnici possono modificare lo stato di richieste generali';
    RETURN;
  END IF;

  CASE
    -- From APERTA
    WHEN v_current_status = 'APERTA' AND p_new_status IN ('ASSEGNATA', 'ABORTITA') THEN
      RETURN QUERY SELECT true, 'Transizione valida';

    -- From ASSEGNATA
    WHEN v_current_status = 'ASSEGNATA' AND p_new_status IN ('IN_LAVORAZIONE', 'APERTA') THEN
      RETURN QUERY SELECT true, 'Transizione valida';

    -- From IN_LAVORAZIONE
    WHEN v_current_status = 'IN_LAVORAZIONE' AND p_new_status IN ('INFO_NECESSARIE', 'COMPLETATA', 'SOSPESA') THEN
      RETURN QUERY SELECT true, 'Transizione valida';

    -- From INFO_NECESSARIE
    WHEN v_current_status = 'INFO_NECESSARIE' AND p_new_status IN ('INFO_TRASMESSE', 'IN_LAVORAZIONE') THEN
      RETURN QUERY SELECT true, 'Transizione valida';

    -- From INFO_TRASMESSE
    WHEN v_current_status = 'INFO_TRASMESSE' AND p_new_status IN ('IN_LAVORAZIONE', 'INFO_NECESSARIE') THEN
      RETURN QUERY SELECT true, 'Transizione valida';

    -- From SOSPESA
    WHEN v_current_status = 'SOSPESA' AND p_new_status IN ('IN_LAVORAZIONE', 'ABORTITA') THEN
      RETURN QUERY SELECT true, 'Transizione valida';

    -- From COMPLETATA or ABORTITA (only admin can reopen, but we already checked admin above)
    WHEN v_current_status IN ('COMPLETATA', 'ABORTITA') THEN
      RETURN QUERY SELECT false, 'Le richieste chiuse possono essere riaperte solo dagli amministratori';

    -- Invalid transition
    ELSE
      RETURN QUERY SELECT false, 'Transizione non permessa: da ' || v_current_status || ' a ' || p_new_status;
  END CASE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION validate_status_transition IS 'Validates status transitions based on user role, request type workflow, and blocked state. Admin: any status. Userdm329: any DM329 status. Tecnico: only general requests with workflow. Utente: cannot change status.';
