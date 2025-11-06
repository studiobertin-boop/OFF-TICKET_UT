-- Migration: Add INSERT policy for userdm329 role
-- Date: 2025-11-05
-- Description: Allow userdm329 users to create DM329 requests

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "userdm329 can create DM329 requests" ON requests;

-- Policy for userdm329: INSERT only for DM329 request type
CREATE POLICY "userdm329 can create DM329 requests"
  ON requests FOR INSERT
  WITH CHECK (
    get_user_role() = 'userdm329' AND
    request_type_id IN (
      SELECT id FROM request_types WHERE name = 'DM329'
    ) AND
    created_by = auth.uid()
  );

COMMENT ON POLICY "userdm329 can create DM329 requests" ON requests IS 'Userdm329 can create new DM329 requests';
