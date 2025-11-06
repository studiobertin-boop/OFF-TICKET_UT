-- =====================================================
-- MANUAL MIGRATION: Add DELETE policy for deletion_archives
-- =====================================================
-- ISTRUZIONI:
-- 1. Apri il Supabase Dashboard
-- 2. Vai su SQL Editor
-- 3. Copia e incolla questo intero script
-- 4. Esegui
-- =====================================================

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

-- =====================================================
-- COMPLETED!
-- =====================================================
-- Gli amministratori possono ora eliminare gli archivi di eliminazione.
