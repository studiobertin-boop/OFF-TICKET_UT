-- Migration: Add request_blocks table and is_blocked field
-- Description: Implements blocking system for requests (replaces INFO_NECESSARIE/INFO_TRASMESSE states)
-- Date: 2025-11-02

-- =====================================================
-- PART 1: Create request_blocks table
-- =====================================================

CREATE TABLE IF NOT EXISTS request_blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  blocked_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  blocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unblocked_by UUID REFERENCES users(id) ON DELETE RESTRICT,
  unblocked_at TIMESTAMPTZ,
  reason TEXT NOT NULL,
  resolution_notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- PART 2: Add is_blocked field to requests table
-- =====================================================

ALTER TABLE requests
ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT false;

-- =====================================================
-- PART 3: Create indexes for performance
-- =====================================================

-- Index for active blocks by request (most common query)
CREATE INDEX IF NOT EXISTS idx_blocks_request_active
  ON request_blocks(request_id, is_active)
  WHERE is_active = true;

-- Index for blocks by user (for tecnico to see their blocks)
CREATE INDEX IF NOT EXISTS idx_blocks_blocked_by
  ON request_blocks(blocked_by, is_active);

-- Index for blocked requests (for filtering and sorting)
CREATE INDEX IF NOT EXISTS idx_requests_blocked
  ON requests(is_blocked)
  WHERE is_blocked = true;

-- Composite index for request type filtering with blocked status
CREATE INDEX IF NOT EXISTS idx_requests_type_blocked
  ON requests(request_type_id, is_blocked);

-- =====================================================
-- PART 4: Create trigger to update is_blocked field
-- =====================================================

-- Function to update is_blocked field on requests table
CREATE OR REPLACE FUNCTION update_request_blocked_status()
RETURNS TRIGGER AS $$
BEGIN
  -- When a block is inserted or updated
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    -- Update the request's is_blocked status based on active blocks
    UPDATE requests
    SET is_blocked = NEW.is_active,
        updated_at = NOW()
    WHERE id = NEW.request_id;
  END IF;

  -- When a block is deleted (cleanup)
  IF TG_OP = 'DELETE' THEN
    -- Check if there are any other active blocks
    UPDATE requests
    SET is_blocked = EXISTS(
      SELECT 1 FROM request_blocks
      WHERE request_id = OLD.request_id
      AND is_active = true
      AND id != OLD.id
    ),
    updated_at = NOW()
    WHERE id = OLD.request_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on request_blocks to maintain is_blocked consistency
CREATE TRIGGER trigger_update_request_blocked_status
  AFTER INSERT OR UPDATE OR DELETE ON request_blocks
  FOR EACH ROW
  EXECUTE FUNCTION update_request_blocked_status();

-- =====================================================
-- PART 5: Create trigger for automatic notifications
-- =====================================================

-- Function to notify when a request is blocked
CREATE OR REPLACE FUNCTION notify_on_request_blocked()
RETURNS TRIGGER AS $$
DECLARE
  v_request requests;
  v_blocked_by_user users;
BEGIN
  -- Only process if block is being activated
  IF NEW.is_active = true AND (TG_OP = 'INSERT' OR OLD.is_active = false) THEN
    -- Get request details
    SELECT * INTO v_request FROM requests WHERE id = NEW.request_id;

    -- Get blocker details
    SELECT * INTO v_blocked_by_user FROM users WHERE id = NEW.blocked_by;

    -- Notify the request creator
    INSERT INTO notifications (
      id,
      user_id,
      request_id,
      type,
      message,
      read,
      created_at
    ) VALUES (
      uuid_generate_v4(),
      v_request.created_by,
      NEW.request_id,
      'request_blocked',
      'La richiesta "' || v_request.title || '" è stata bloccata da ' ||
        COALESCE(v_blocked_by_user.full_name, v_blocked_by_user.email) ||
        ': ' || NEW.reason,
      false,
      NOW()
    );

    -- Also notify assigned tecnico if different from creator and blocker
    IF v_request.assigned_to IS NOT NULL
       AND v_request.assigned_to != v_request.created_by
       AND v_request.assigned_to != NEW.blocked_by THEN
      INSERT INTO notifications (
        id,
        user_id,
        request_id,
        type,
        message,
        read,
        created_at
      ) VALUES (
        uuid_generate_v4(),
        v_request.assigned_to,
        NEW.request_id,
        'request_blocked',
        'La richiesta "' || v_request.title || '" è stata bloccata da ' ||
          COALESCE(v_blocked_by_user.full_name, v_blocked_by_user.email) ||
          ': ' || NEW.reason,
        false,
        NOW()
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for block notifications
CREATE TRIGGER trigger_notify_on_request_blocked
  AFTER INSERT OR UPDATE ON request_blocks
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_request_blocked();

-- Function to notify when a block is resolved
CREATE OR REPLACE FUNCTION notify_on_block_resolved()
RETURNS TRIGGER AS $$
DECLARE
  v_request requests;
  v_unblocked_by_user users;
BEGIN
  -- Only process if block is being resolved (was active, now inactive)
  IF OLD.is_active = true AND NEW.is_active = false AND NEW.unblocked_by IS NOT NULL THEN
    -- Get request details
    SELECT * INTO v_request FROM requests WHERE id = NEW.request_id;

    -- Get resolver details
    SELECT * INTO v_unblocked_by_user FROM users WHERE id = NEW.unblocked_by;

    -- Notify the person who created the block
    INSERT INTO notifications (
      id,
      user_id,
      request_id,
      type,
      message,
      read,
      created_at
    ) VALUES (
      uuid_generate_v4(),
      NEW.blocked_by,
      NEW.request_id,
      'block_resolved',
      'Il blocco sulla richiesta "' || v_request.title || '" è stato risolto da ' ||
        COALESCE(v_unblocked_by_user.full_name, v_unblocked_by_user.email) ||
        CASE
          WHEN NEW.resolution_notes IS NOT NULL AND NEW.resolution_notes != ''
          THEN ': ' || NEW.resolution_notes
          ELSE ''
        END,
      false,
      NOW()
    );

    -- Also notify assigned tecnico if different from blocker
    IF v_request.assigned_to IS NOT NULL
       AND v_request.assigned_to != NEW.blocked_by
       AND v_request.assigned_to != NEW.unblocked_by THEN
      INSERT INTO notifications (
        id,
        user_id,
        request_id,
        type,
        message,
        read,
        created_at
      ) VALUES (
        uuid_generate_v4(),
        v_request.assigned_to,
        NEW.request_id,
        'block_resolved',
        'Il blocco sulla richiesta "' || v_request.title || '" è stato risolto da ' ||
          COALESCE(v_unblocked_by_user.full_name, v_unblocked_by_user.email),
        false,
        NOW()
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for resolution notifications
CREATE TRIGGER trigger_notify_on_block_resolved
  AFTER UPDATE ON request_blocks
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_block_resolved();

-- =====================================================
-- PART 6: Row Level Security (RLS) Policies
-- =====================================================

-- Enable RLS on request_blocks
ALTER TABLE request_blocks ENABLE ROW LEVEL SECURITY;

-- Admin can do everything with blocks
CREATE POLICY "Admin full access to request_blocks"
  ON request_blocks
  FOR ALL
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

-- Tecnico can view blocks on requests they can see
CREATE POLICY "Tecnico can view blocks on accessible requests"
  ON request_blocks
  FOR SELECT
  USING (
    get_user_role() = 'tecnico' AND
    EXISTS (
      SELECT 1 FROM requests r
      WHERE r.id = request_blocks.request_id
      AND (r.assigned_to = auth.uid() OR r.created_by = auth.uid())
    )
  );

-- Tecnico can create blocks on requests assigned to them
CREATE POLICY "Tecnico can block assigned requests"
  ON request_blocks
  FOR INSERT
  WITH CHECK (
    get_user_role() = 'tecnico' AND
    EXISTS (
      SELECT 1 FROM requests r
      WHERE r.id = request_id
      AND r.assigned_to = auth.uid()
    ) AND
    blocked_by = auth.uid()
  );

-- Utente can view blocks on their own requests
CREATE POLICY "Utente can view blocks on own requests"
  ON request_blocks
  FOR SELECT
  USING (
    get_user_role() = 'utente' AND
    EXISTS (
      SELECT 1 FROM requests r
      WHERE r.id = request_blocks.request_id
      AND r.created_by = auth.uid()
    )
  );

-- Utente can resolve blocks on their own requests
CREATE POLICY "Utente can resolve blocks on own requests"
  ON request_blocks
  FOR UPDATE
  USING (
    get_user_role() = 'utente' AND
    EXISTS (
      SELECT 1 FROM requests r
      WHERE r.id = request_id
      AND r.created_by = auth.uid()
    ) AND
    is_active = true
  )
  WITH CHECK (
    unblocked_by = auth.uid() AND
    is_active = false
  );

-- userdm329 can view blocks on DM329 requests
CREATE POLICY "userdm329 can view blocks on DM329 requests"
  ON request_blocks
  FOR SELECT
  USING (
    get_user_role() = 'userdm329' AND
    EXISTS (
      SELECT 1 FROM requests r
      JOIN request_types rt ON r.request_type_id = rt.id
      WHERE r.id = request_blocks.request_id
      AND rt.name = 'DM329'
    )
  );

-- userdm329 can create blocks on DM329 requests
CREATE POLICY "userdm329 can block DM329 requests"
  ON request_blocks
  FOR INSERT
  WITH CHECK (
    get_user_role() = 'userdm329' AND
    EXISTS (
      SELECT 1 FROM requests r
      JOIN request_types rt ON r.request_type_id = rt.id
      WHERE r.id = request_id
      AND rt.name = 'DM329'
    ) AND
    blocked_by = auth.uid()
  );

-- userdm329 can update blocks on DM329 requests (for resolution by creators)
CREATE POLICY "userdm329 can resolve blocks on DM329 requests"
  ON request_blocks
  FOR UPDATE
  USING (
    get_user_role() = 'userdm329' AND
    EXISTS (
      SELECT 1 FROM requests r
      JOIN request_types rt ON r.request_type_id = rt.id
      WHERE r.id = request_id
      AND rt.name = 'DM329'
      AND (r.created_by = auth.uid() OR blocked_by = auth.uid())
    ) AND
    is_active = true
  )
  WITH CHECK (
    unblocked_by = auth.uid() AND
    is_active = false
  );

-- =====================================================
-- PART 7: Add comments for documentation
-- =====================================================

COMMENT ON TABLE request_blocks IS 'Stores blocking events for requests. Replaces INFO_NECESSARIE/INFO_TRASMESSE workflow states.';
COMMENT ON COLUMN request_blocks.is_active IS 'True if block is currently active, false if resolved';
COMMENT ON COLUMN request_blocks.reason IS 'Reason provided by blocker (tecnico/admin) for blocking the request';
COMMENT ON COLUMN request_blocks.resolution_notes IS 'Notes provided by request creator when resolving the block';
COMMENT ON COLUMN requests.is_blocked IS 'Denormalized field indicating if request currently has active blocks (maintained by trigger)';
