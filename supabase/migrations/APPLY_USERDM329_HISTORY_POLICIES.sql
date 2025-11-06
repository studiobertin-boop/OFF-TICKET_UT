-- MANUAL MIGRATION: Add request_history policies for userdm329
-- Date: 2025-11-05
-- To apply: Copy and paste this SQL in Supabase SQL Editor
-- Description: Allow userdm329 to view and insert history for DM329 requests

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "userdm329 can view DM329 request history" ON request_history;
DROP POLICY IF EXISTS "userdm329 can insert history for DM329 requests" ON request_history;

-- userdm329: can view history of DM329 requests
CREATE POLICY "userdm329 can view DM329 request history"
  ON request_history FOR SELECT
  USING (
    get_user_role() = 'userdm329' AND
    EXISTS (
      SELECT 1 FROM requests r
      JOIN request_types rt ON r.request_type_id = rt.id
      WHERE r.id = request_history.request_id
      AND rt.name = 'DM329'
    )
  );

-- userdm329: can insert history for DM329 requests
CREATE POLICY "userdm329 can insert history for DM329 requests"
  ON request_history FOR INSERT
  WITH CHECK (
    get_user_role() = 'userdm329' AND
    changed_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM requests r
      JOIN request_types rt ON r.request_type_id = rt.id
      WHERE r.id = request_history.request_id
      AND rt.name = 'DM329'
    )
  );

COMMENT ON POLICY "userdm329 can view DM329 request history" ON request_history IS 'Userdm329 can view history of DM329 requests';
COMMENT ON POLICY "userdm329 can insert history for DM329 requests" ON request_history IS 'Userdm329 can create history entries for DM329 requests';
