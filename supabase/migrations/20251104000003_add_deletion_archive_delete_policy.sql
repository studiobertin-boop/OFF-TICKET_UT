-- Migration: Add DELETE policy for deletion_archives
-- Date: 2025-11-04
-- Description: Adds missing DELETE policy for admin users to delete deletion archives

-- Drop existing delete policy if exists
DROP POLICY IF EXISTS "Admin can delete deletion archives" ON deletion_archives;

-- Admin can delete archives
CREATE POLICY "Admin can delete deletion archives"
  ON deletion_archives FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

COMMENT ON POLICY "Admin can delete deletion archives" ON deletion_archives IS 'Allows admin users to delete deletion archive records';
