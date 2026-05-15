-- Migration: Add policies for DM329-Integrazioni request type
-- Date: 2026-05-12
-- Description: Estende le stesse regole di DM329 al nuovo tipo DM329-Integrazioni.
--   userdm329 può creare pratiche DM329-Integrazioni.
--   tecnicoDM329 può leggere le pratiche DM329-Integrazioni assegnate a loro.
--   validate_status_transition gestisce DM329-Integrazioni con lo stesso workflow di DM329.

-- ============================================================
-- 1. USERDM329: INSERT policy per DM329-Integrazioni
-- ============================================================
DROP POLICY IF EXISTS "userdm329 can create DM329-Integrazioni requests" ON requests;

CREATE POLICY "userdm329 can create DM329-Integrazioni requests"
  ON requests FOR INSERT
  WITH CHECK (
    get_user_role() = 'userdm329' AND
    request_type_id IN (
      SELECT id FROM request_types WHERE name = 'DM329-Integrazioni'
    ) AND
    created_by = auth.uid()
  );

COMMENT ON POLICY "userdm329 can create DM329-Integrazioni requests" ON requests
  IS 'Userdm329 can create new DM329-Integrazioni requests';

-- ============================================================
-- 1b. USERDM329: SELECT policy per DM329-Integrazioni
-- ============================================================
DROP POLICY IF EXISTS "userdm329 can view DM329-Integrazioni requests" ON requests;

CREATE POLICY "userdm329 can view DM329-Integrazioni requests"
  ON requests
  FOR SELECT
  TO authenticated
  USING (
    get_user_role() = 'userdm329'
    AND request_type_id IN (
      SELECT id FROM request_types WHERE name = 'DM329-Integrazioni'
    )
  );

COMMENT ON POLICY "userdm329 can view DM329-Integrazioni requests" ON requests
  IS 'Userdm329 can view DM329-Integrazioni requests';

-- ============================================================
-- 2. TECNICODM329: SELECT policy per DM329-Integrazioni
-- ============================================================
DROP POLICY IF EXISTS "tecnicoDM329 can view assigned DM329-Integrazioni requests" ON requests;

CREATE POLICY "tecnicoDM329 can view assigned DM329-Integrazioni requests"
  ON requests
  FOR SELECT
  TO authenticated
  USING (
    get_user_role() = 'tecnicoDM329'
    AND assigned_to = auth.uid()
    AND request_type_id IN (
      SELECT id FROM request_types WHERE name = 'DM329-Integrazioni'
    )
  );

COMMENT ON POLICY "tecnicoDM329 can view assigned DM329-Integrazioni requests" ON requests
  IS 'tecnicoDM329 can view only DM329-Integrazioni requests assigned to them';

-- ============================================================
-- 3. VALIDATE_STATUS_TRANSITION: aggiungi DM329-Integrazioni
-- ============================================================
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

    -- userdm329 can set ANY DM329 status (like admin)
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
  IF p_user_role != 'tecnico' THEN
    RETURN QUERY SELECT false, 'Solo i tecnici possono modificare lo stato di richieste generali';
    RETURN;
  END IF;

  CASE
    WHEN v_current_status = 'APERTA' AND p_new_status IN ('ASSEGNATA', 'ABORTITA') THEN
      RETURN QUERY SELECT true, 'Transizione valida';
    WHEN v_current_status = 'ASSEGNATA' AND p_new_status IN ('IN_LAVORAZIONE', 'APERTA') THEN
      RETURN QUERY SELECT true, 'Transizione valida';
    WHEN v_current_status = 'IN_LAVORAZIONE' AND p_new_status IN ('INFO_NECESSARIE', 'COMPLETATA', 'SOSPESA') THEN
      RETURN QUERY SELECT true, 'Transizione valida';
    WHEN v_current_status = 'INFO_NECESSARIE' AND p_new_status IN ('INFO_TRASMESSE', 'IN_LAVORAZIONE') THEN
      RETURN QUERY SELECT true, 'Transizione valida';
    WHEN v_current_status = 'INFO_TRASMESSE' AND p_new_status IN ('IN_LAVORAZIONE', 'INFO_NECESSARIE') THEN
      RETURN QUERY SELECT true, 'Transizione valida';
    WHEN v_current_status = 'SOSPESA' AND p_new_status IN ('IN_LAVORAZIONE', 'ABORTITA') THEN
      RETURN QUERY SELECT true, 'Transizione valida';
    WHEN v_current_status IN ('COMPLETATA', 'ABORTITA') THEN
      RETURN QUERY SELECT false, 'Le richieste chiuse possono essere riaperte solo dagli amministratori';
    ELSE
      RETURN QUERY SELECT false, 'Transizione non permessa: da ' || v_current_status || ' a ' || p_new_status;
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 4. USERS TABLE: userdm329 può leggere i tecnici DM329
-- ============================================================
DROP POLICY IF EXISTS "userdm329 can view tecnicoDM329 users" ON users;

CREATE POLICY "userdm329 can view tecnicoDM329 users"
  ON users
  FOR SELECT
  TO authenticated
  USING (
    get_user_role() = 'userdm329' AND role = 'tecnicoDM329'
  );

COMMENT ON POLICY "userdm329 can view tecnicoDM329 users" ON users
  IS 'Userdm329 can read tecnicoDM329 users to populate the assignment dropdown';

COMMENT ON FUNCTION validate_status_transition IS
  'Validates status transitions. Admin: any status. Userdm329: any DM329-family status (DM329, DM329-Integrazioni). Tecnico: general requests only. Utente: cannot change status.';
