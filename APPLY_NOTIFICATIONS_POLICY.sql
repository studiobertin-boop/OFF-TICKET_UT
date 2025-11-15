-- ============================================================================
-- APPLICAZIONE MIGRATION: tecnicoDM329 notifications policy
-- ============================================================================
-- Esegui questo script nella Dashboard Supabase → SQL Editor
-- Questa migration limita le notifiche visibili ai tecnicoDM329 solo a quelle
-- relative alle richieste a loro assegnate
-- ============================================================================

BEGIN;

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

-- Registra la migration
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('20251115100006', 'add_tecnicodm329_notifications_policy', ARRAY[]::text[])
ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ============================================================================
-- FINE SCRIPT - Verifica il risultato con:
-- SELECT * FROM supabase_migrations.schema_migrations WHERE version = '20251115100006';
-- ============================================================================
