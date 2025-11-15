-- ============================================================================
-- Migration: Add tecnicoDM329 notifications policy
-- Description: Restrict tecnicoDM329 users to see only notifications for assigned requests
-- ============================================================================

-- Drop and recreate the "Users can view own notifications" policy to be more specific
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;

-- Policy for non-tecnicoDM329 users: can view all their notifications
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    AND get_user_role() != 'tecnicoDM329'
  );

-- Policy for tecnicoDM329 users: can only view notifications for assigned requests
CREATE POLICY "tecnicoDM329 can view assigned notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    AND get_user_role() = 'tecnicoDM329'
    AND (
      -- Notification is about a request assigned to them
      request_id IS NULL -- System notifications
      OR EXISTS (
        SELECT 1 FROM requests r
        WHERE r.id = notifications.request_id
        AND r.assigned_to = auth.uid()
      )
    )
  );

-- Update the "Users can update own notifications" policy for tecnicoDM329
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND (
      get_user_role() != 'tecnicoDM329'
      OR request_id IS NULL
      OR EXISTS (
        SELECT 1 FROM requests r
        WHERE r.id = notifications.request_id
        AND r.assigned_to = auth.uid()
      )
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND (
      get_user_role() != 'tecnicoDM329'
      OR request_id IS NULL
      OR EXISTS (
        SELECT 1 FROM requests r
        WHERE r.id = notifications.request_id
        AND r.assigned_to = auth.uid()
      )
    )
  );

-- Update the "Users can delete own notifications" policy for tecnicoDM329
DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;

CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND (
      get_user_role() != 'tecnicoDM329'
      OR request_id IS NULL
      OR EXISTS (
        SELECT 1 FROM requests r
        WHERE r.id = notifications.request_id
        AND r.assigned_to = auth.uid()
      )
    )
  );

COMMENT ON POLICY "tecnicoDM329 can view assigned notifications" ON notifications IS
  'tecnicoDM329 users can only view notifications for requests assigned to them';
