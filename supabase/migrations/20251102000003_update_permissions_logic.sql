-- Migration: Update permissions logic for blocking and status changes
-- Date: 2025-11-02
-- Description: Revise permissions according to new requirements:
--   - admin: see all, set any status, block/unblock all
--   - tecnico: see/create ONLY general requests (no DM329), can ONLY UNBLOCK (not block), can change status
--   - userdm329: see/create ONLY DM329 requests, can block AND unblock, can change status
--   - utente: see/create ONLY general requests (no DM329), can ONLY UNBLOCK (not block), CANNOT change status

-- =====================================================
-- PART 1: Drop existing RLS policies for request_blocks
-- =====================================================

DROP POLICY IF EXISTS "Tecnico can block assigned requests" ON request_blocks;
DROP POLICY IF EXISTS "Tecnico can resolve blocks on accessible requests" ON request_blocks;

-- =====================================================
-- PART 2: Update RLS policies for request_blocks
-- =====================================================

-- Drop existing policies that will be recreated
DROP POLICY IF EXISTS "Tecnico can unblock general requests" ON request_blocks;
DROP POLICY IF EXISTS "userdm329 can unblock DM329 requests" ON request_blocks;

-- Tecnico can ONLY unblock (not create blocks)
-- Can unblock on general requests (not DM329)
CREATE POLICY "Tecnico can unblock general requests"
  ON request_blocks
  FOR UPDATE
  USING (
    get_user_role() = 'tecnico' AND
    EXISTS (
      SELECT 1 FROM requests r
      JOIN request_types rt ON r.request_type_id = rt.id
      WHERE r.id = request_id
      AND rt.name != 'DM329'
      AND (r.assigned_to = auth.uid() OR r.created_by = auth.uid())
    ) AND
    is_active = true
  )
  WITH CHECK (
    unblocked_by = auth.uid() AND
    is_active = false
  );

-- userdm329 can also UNBLOCK DM329 requests (in addition to blocking)
CREATE POLICY "userdm329 can unblock DM329 requests"
  ON request_blocks
  FOR UPDATE
  USING (
    get_user_role() = 'userdm329' AND
    EXISTS (
      SELECT 1 FROM requests r
      JOIN request_types rt ON r.request_type_id = rt.id
      WHERE r.id = request_id
      AND rt.name = 'DM329'
    ) AND
    is_active = true
  )
  WITH CHECK (
    unblocked_by = auth.uid() AND
    is_active = false
  );

-- =====================================================
-- PART 3: Update validate_status_transition function
-- =====================================================

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

    -- DM329 workflow: sequential states
    CASE
      WHEN v_current_status = '1-INCARICO_RICEVUTO' AND p_new_status = '2-SCHEDA_DATI_PRONTA' THEN
        RETURN QUERY SELECT true, 'Transizione valida';
      WHEN v_current_status = '2-SCHEDA_DATI_PRONTA' AND p_new_status = '3-MAIL_CLIENTE_INVIATA' THEN
        RETURN QUERY SELECT true, 'Transizione valida';
      WHEN v_current_status = '3-MAIL_CLIENTE_INVIATA' AND p_new_status = '4-DOCUMENTI_PRONTI' THEN
        RETURN QUERY SELECT true, 'Transizione valida';
      WHEN v_current_status = '4-DOCUMENTI_PRONTI' AND p_new_status = '5-ATTESA_FIRMA' THEN
        RETURN QUERY SELECT true, 'Transizione valida';
      WHEN v_current_status = '5-ATTESA_FIRMA' AND p_new_status = '6-PRONTA_PER_CIVA' THEN
        RETURN QUERY SELECT true, 'Transizione valida';
      WHEN v_current_status = '6-PRONTA_PER_CIVA' AND p_new_status = '7-CHIUSA' THEN
        RETURN QUERY SELECT true, 'Transizione valida';
      ELSE
        RETURN QUERY SELECT false, 'Transizione non permessa per workflow DM329';
    END CASE;
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

COMMENT ON FUNCTION validate_status_transition IS 'Validates status transitions based on user role, request type workflow, and blocked state. Admin: any status. Tecnico: only general requests. Userdm329: only DM329 requests. Utente: cannot change status.';

-- =====================================================
-- PART 4: Update RLS policies for requests table
-- =====================================================

-- Drop old policies that don't filter by request type
DROP POLICY IF EXISTS "Tecnico can view assigned requests" ON requests;
DROP POLICY IF EXISTS "Tecnico can update assigned requests" ON requests;
DROP POLICY IF EXISTS "Utente can view own requests" ON requests;
DROP POLICY IF EXISTS "Utente can create requests" ON requests;
DROP POLICY IF EXISTS "Utente can update own requests" ON requests;

-- Drop policies that might have been created by previous runs of this migration
DROP POLICY IF EXISTS "Tecnico can view assigned general requests" ON requests;
DROP POLICY IF EXISTS "Tecnico can update assigned general requests" ON requests;
DROP POLICY IF EXISTS "Utente can view own general requests" ON requests;
DROP POLICY IF EXISTS "Utente can create general requests" ON requests;
DROP POLICY IF EXISTS "Utente can update own general requests" ON requests;

-- Tecnico: can ONLY view/update GENERAL requests (not DM329) assigned to them
CREATE POLICY "Tecnico can view assigned general requests"
  ON requests FOR SELECT
  USING (
    get_user_role() = 'tecnico' AND
    assigned_to = auth.uid() AND
    request_type_id NOT IN (
      SELECT id FROM request_types WHERE name = 'DM329'
    )
  );

CREATE POLICY "Tecnico can update assigned general requests"
  ON requests FOR UPDATE
  USING (
    get_user_role() = 'tecnico' AND
    assigned_to = auth.uid() AND
    request_type_id NOT IN (
      SELECT id FROM request_types WHERE name = 'DM329'
    )
  );

-- Utente: can ONLY view/create/update GENERAL requests (not DM329)
CREATE POLICY "Utente can view own general requests"
  ON requests FOR SELECT
  USING (
    get_user_role() = 'utente' AND
    created_by = auth.uid() AND
    request_type_id NOT IN (
      SELECT id FROM request_types WHERE name = 'DM329'
    )
  );

CREATE POLICY "Utente can create general requests"
  ON requests FOR INSERT
  WITH CHECK (
    get_user_role() = 'utente' AND
    created_by = auth.uid() AND
    request_type_id NOT IN (
      SELECT id FROM request_types WHERE name = 'DM329'
    )
  );

CREATE POLICY "Utente can update own general requests"
  ON requests FOR UPDATE
  USING (
    get_user_role() = 'utente' AND
    created_by = auth.uid() AND
    request_type_id NOT IN (
      SELECT id FROM request_types WHERE name = 'DM329'
    )
  )
  WITH CHECK (
    created_by = auth.uid() AND
    request_type_id NOT IN (
      SELECT id FROM request_types WHERE name = 'DM329'
    )
  );

-- userdm329: policies already exist in 20250101000004_add_suspension_and_policies.sql
-- They correctly filter for DM329 requests only

-- =====================================================
-- PART 5: Trigger to prevent utente from changing assigned_to
-- =====================================================

CREATE OR REPLACE FUNCTION prevent_utente_reassignment()
RETURNS TRIGGER AS $$
BEGIN
  -- If user is 'utente' and trying to change assigned_to, reject
  IF get_user_role() = 'utente' AND
     OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
    RAISE EXCEPTION 'Gli utenti non possono modificare l''assegnazione delle richieste';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trigger_prevent_utente_reassignment ON requests;

CREATE TRIGGER trigger_prevent_utente_reassignment
  BEFORE UPDATE ON requests
  FOR EACH ROW
  EXECUTE FUNCTION prevent_utente_reassignment();

COMMENT ON POLICY "Tecnico can view assigned general requests" ON requests IS 'Tecnico can only see general requests (not DM329) assigned to them';
COMMENT ON POLICY "Utente can view own general requests" ON requests IS 'Utente can only see their own general requests (not DM329)';
COMMENT ON POLICY "userdm329 can view DM329 requests" ON requests IS 'Userdm329 can only see DM329 requests';
