-- Migration: Add RLS policies for tecnicoDM329 role on dm329_technical_data
-- Description: tecnicoDM329 can view and edit only technical data for requests assigned to them
-- Date: 2025-11-15

-- Policy: tecnicoDM329 can view technical data for requests assigned to them
CREATE POLICY "tecnicoDM329 can view assigned technical data"
  ON dm329_technical_data
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN requests r ON r.id = dm329_technical_data.request_id
      WHERE u.id = auth.uid()
      AND u.role = 'tecnicoDM329'
      AND r.assigned_to = auth.uid()
    )
  );

-- Policy: tecnicoDM329 can update technical data for requests assigned to them
CREATE POLICY "tecnicoDM329 can update assigned technical data"
  ON dm329_technical_data
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN requests r ON r.id = dm329_technical_data.request_id
      WHERE u.id = auth.uid()
      AND u.role = 'tecnicoDM329'
      AND r.assigned_to = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN requests r ON r.id = dm329_technical_data.request_id
      WHERE u.id = auth.uid()
      AND u.role = 'tecnicoDM329'
      AND r.assigned_to = auth.uid()
    )
  );

-- Note: tecnicoDM329 cannot INSERT or DELETE technical data
-- INSERT is handled automatically by trigger when DM329 request is created
-- DELETE is only allowed for admin role
