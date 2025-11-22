-- Migration: Add INSERT policy for tecnicoDM329 on dm329_technical_data
-- Purpose: Allow tecnicoDM329 to create technical data sheets for assigned requests
-- This enables on-demand creation of missing technical data for old DM329 requests

-- Drop existing policy if it exists (for idempotency)
DROP POLICY IF EXISTS "tecnicoDM329 can create technical data for assigned requests" ON dm329_technical_data;

-- Allow tecnicoDM329 to create technical data ONLY for requests assigned to them
CREATE POLICY "tecnicoDM329 can create technical data for assigned requests"
  ON dm329_technical_data FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN requests r ON r.id = dm329_technical_data.request_id
      WHERE u.id = auth.uid()
      AND u.role = 'tecnicoDM329'
      AND r.assigned_to = auth.uid()
    )
  );

-- Note: Admin and userdm329 already have INSERT permissions via existing policies
-- This policy specifically enables tecnicoDM329 to create sheets for their own requests
