-- Migration: Robust DM329 status validation for userdm329
-- Date: 2026-07-03
-- Description:
--   Fixes the bug where userdm329 could not set the status 'ARCHIVIATA NON FINITA'
--   (and would break again for any future DM329 status). The previous version
--   validated p_new_status against a hardcoded whitelist that had to be updated by
--   hand every time a new status was added to the dm329_status enum.
--
--   This version validates p_new_status dynamically against the dm329_status enum,
--   so any value that is part of the enum is accepted for userdm329 (who has
--   admin-like access to DM329 statuses). New statuses added to the enum in the
--   future work automatically, with no further changes to this function.
--
--   Self-contained: also ensures 'ARCHIVIATA NON FINITA' exists in the dm329_status
--   enum (idempotent), so this single script fixes the bug even if the earlier
--   enum migration (20251110000000) was never applied to this database.

-- Ensure the archival status exists in the enum. IF NOT EXISTS makes this idempotent.
-- Safe to run in the same script as the function below: the function stores its body
-- as text and only evaluates the enum at call time, not at definition time.
ALTER TYPE dm329_status ADD VALUE IF NOT EXISTS 'ARCHIVIATA NON FINITA';

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

  -- Check if it's a DM329-family request (DM329 or DM329-Integrazioni)
  IF v_request_type IN ('DM329', 'DM329-Integrazioni') THEN
    -- Only userdm329 and admin can change DM329-family status
    IF p_user_role != 'userdm329' THEN
      RETURN QUERY SELECT false, 'Solo gli utenti DM329 possono modificare lo stato di richieste DM329';
      RETURN;
    END IF;

    -- userdm329 can set ANY valid DM329 status (like admin).
    -- Validate dynamically against the dm329_status enum so new statuses
    -- (e.g. 'ARCHIVIATA NON FINITA') work without editing this function.
    IF p_new_status = ANY (enum_range(NULL::dm329_status)::text[]) THEN
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

COMMENT ON FUNCTION validate_status_transition IS 'Validates status transitions based on user role, request type workflow, and blocked state. Admin: any status. Userdm329: any valid dm329_status enum value (validated dynamically). Tecnico: only general requests with workflow. Utente: cannot change status.';
