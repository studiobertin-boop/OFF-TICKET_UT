-- =============================================
-- ADD REQUEST ATTRIBUTION FEATURE
-- =============================================
-- Permette agli admin di attribuire richieste ad altri utenti
-- Gli utenti attributari vedono la richiesta come se fosse loro

-- Add attributed_to column to requests table
ALTER TABLE requests
ADD COLUMN attributed_to UUID REFERENCES users(id) ON DELETE SET NULL;

-- Create index for performance on attributed_to queries
CREATE INDEX idx_requests_attributed ON requests(attributed_to) WHERE attributed_to IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN requests.attributed_to IS 'Utente a cui la richiesta è stata attribuita. Se valorizzato, questo utente può vedere e gestire la richiesta come se fosse il creatore originale.';

-- =============================================
-- UPDATE RLS POLICIES FOR ATTRIBUTED REQUESTS
-- =============================================

-- Drop existing SELECT policy for users
DROP POLICY IF EXISTS "Users can view their own requests" ON requests;

-- Recreate SELECT policy with attributed_to support
CREATE POLICY "Users can view their own or attributed requests"
ON requests
FOR SELECT
TO authenticated
USING (
  CASE
    WHEN (SELECT role FROM users WHERE id = auth.uid()) = 'admin' THEN true
    WHEN (SELECT role FROM users WHERE id = auth.uid()) = 'tecnico' THEN assigned_to = auth.uid()
    ELSE created_by = auth.uid() OR attributed_to = auth.uid()
  END
);

-- Drop existing UPDATE policy for users
DROP POLICY IF EXISTS "Users can update their own requests" ON requests;

-- Recreate UPDATE policy with attributed_to support
CREATE POLICY "Users can update their own or attributed requests"
ON requests
FOR UPDATE
TO authenticated
USING (
  CASE
    WHEN (SELECT role FROM users WHERE id = auth.uid()) = 'admin' THEN true
    WHEN (SELECT role FROM users WHERE id = auth.uid()) = 'tecnico' THEN assigned_to = auth.uid()
    ELSE created_by = auth.uid() OR attributed_to = auth.uid()
  END
)
WITH CHECK (
  CASE
    WHEN (SELECT role FROM users WHERE id = auth.uid()) = 'admin' THEN true
    WHEN (SELECT role FROM users WHERE id = auth.uid()) = 'tecnico' THEN assigned_to = auth.uid()
    ELSE created_by = auth.uid() OR attributed_to = auth.uid()
  END
);

-- =============================================
-- ADD ATTRIBUTION EVENT TO NOTIFICATIONS
-- =============================================

-- Add new event_type for request attribution tracking
-- Note: notifications table already supports custom event_type via TEXT column
-- No schema change needed, just documenting the new event type

COMMENT ON TABLE notifications IS 'Sistema notifiche. event_type supportati: request_created, status_change, request_suspended, request_unsuspended, request_attributed (new)';

-- =============================================
-- CREATE HELPER FUNCTION FOR REQUEST ATTRIBUTION
-- =============================================

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
  v_creator RECORD;
  v_previous_attributed UUID;
  v_result JSON;
BEGIN
  -- Verify admin role
  IF (SELECT role FROM users WHERE id = p_attributed_by) != 'admin' THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Solo gli admin possono attribuire richieste'
    );
  END IF;

  -- Get request details
  SELECT * INTO v_request
  FROM requests
  WHERE id = p_request_id;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Richiesta non trovata'
    );
  END IF;

  -- Get target user details
  SELECT * INTO v_attributed_user
  FROM users
  WHERE id = p_attributed_to;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Utente target non trovato'
    );
  END IF;

  -- Store previous attribution for history
  v_previous_attributed := v_request.attributed_to;

  -- Update request with new attribution
  UPDATE requests
  SET
    attributed_to = p_attributed_to,
    updated_at = NOW()
  WHERE id = p_request_id;

  -- Track in request_history
  INSERT INTO request_history (
    request_id,
    status_from,
    status_to,
    changed_by,
    notes
  ) VALUES (
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

  -- Create notification for attributed user
  INSERT INTO notifications (
    user_id,
    request_id,
    type,
    message,
    event_type,
    metadata,
    read
  ) VALUES (
    p_attributed_to,
    p_request_id,
    'info',
    'Ti è stata attribuita la richiesta: ' || v_request.title,
    'request_attributed',
    json_build_object(
      'attributed_by', p_attributed_by,
      'attributed_by_name', (SELECT full_name FROM users WHERE id = p_attributed_by),
      'notes', p_notes
    ),
    false
  );

  -- Create notification for original creator (if different from attributed user)
  SELECT * INTO v_creator FROM users WHERE id = v_request.created_by;

  IF v_request.created_by != p_attributed_to THEN
    INSERT INTO notifications (
      user_id,
      request_id,
      type,
      message,
      event_type,
      metadata,
      read
    ) VALUES (
      v_request.created_by,
      p_request_id,
      'info',
      'La richiesta "' || v_request.title || '" è stata attribuita a ' || v_attributed_user.full_name,
      'request_attributed',
      json_build_object(
        'attributed_to', p_attributed_to,
        'attributed_to_name', v_attributed_user.full_name,
        'attributed_by', p_attributed_by,
        'attributed_by_name', (SELECT full_name FROM users WHERE id = p_attributed_by)
      ),
      false
    );
  END IF;

  -- Return success
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
    RETURN json_build_object(
      'success', false,
      'message', 'Errore durante l''attribuzione: ' || SQLERRM
    );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION attribute_request(UUID, UUID, UUID, TEXT) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION attribute_request IS 'Attribuisce una richiesta ad un utente. Solo admin possono eseguire questa operazione. Crea automaticamente notifiche e traccia in request_history.';
