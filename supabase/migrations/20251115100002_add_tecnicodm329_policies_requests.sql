-- Migration: Add RLS policies for tecnicoDM329 role on requests table
-- Description: tecnicoDM329 can only view DM329 requests assigned to them, no insert/update/delete
-- Date: 2025-11-15

-- Drop old policy if exists
DROP POLICY IF EXISTS "tecnicoDM329 can view assigned DM329 requests" ON requests;

-- Policy: tecnicoDM329 can view only DM329 requests assigned to them
CREATE POLICY "tecnicoDM329 can view assigned DM329 requests"
  ON requests
  FOR SELECT
  TO authenticated
  USING (
    get_user_role() = 'tecnicoDM329'
    AND assigned_to = auth.uid()
    AND request_type_id IN (
      SELECT id FROM request_types WHERE name = 'DM329'
    )
  );

-- Note: tecnicoDM329 has NO permissions for INSERT, UPDATE, or DELETE on requests
-- They can only view and edit the technical data sheets for requests assigned to them
