-- Migration: Fix manufacturers RLS policies to use get_user_role() helper
-- Description: Fixes "permission denied for table users" error by using
--              existing get_user_role() function instead of direct users table query

-- ============================================================================
-- DROP OLD POLICIES THAT DIRECTLY QUERY users TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Anyone can view active manufacturers" ON manufacturers;
DROP POLICY IF EXISTS "Admin and userdm329 can insert manufacturers" ON manufacturers;
DROP POLICY IF EXISTS "Admin and userdm329 can update manufacturers" ON manufacturers;
DROP POLICY IF EXISTS "Admin and userdm329 can delete manufacturers" ON manufacturers;
DROP POLICY IF EXISTS "Admin can delete manufacturers" ON manufacturers;

-- ============================================================================
-- CREATE NEW POLICIES USING get_user_role() HELPER FUNCTION
-- ============================================================================

-- SELECT: Anyone authenticated can view active manufacturers
-- Admin and userdm329 can view all (including inactive)
CREATE POLICY "Anyone can view active manufacturers"
  ON manufacturers
  FOR SELECT
  USING (
    is_active = true
    OR
    get_user_role() IN ('admin', 'userdm329')
  );

-- INSERT: Only admin and userdm329 can create manufacturers
CREATE POLICY "Admin and userdm329 can insert manufacturers"
  ON manufacturers
  FOR INSERT
  WITH CHECK (
    get_user_role() IN ('admin', 'userdm329')
  );

-- UPDATE: Only admin and userdm329 can update manufacturers
CREATE POLICY "Admin and userdm329 can update manufacturers"
  ON manufacturers
  FOR UPDATE
  USING (
    get_user_role() IN ('admin', 'userdm329')
  )
  WITH CHECK (
    get_user_role() IN ('admin', 'userdm329')
  );

-- DELETE: Only admin can delete manufacturers (soft delete via is_active recommended)
CREATE POLICY "Admin can delete manufacturers"
  ON manufacturers
  FOR DELETE
  USING (
    get_user_role() = 'admin'
  );

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Summary:
-- ✓ Replaced direct users table queries with get_user_role() function
-- ✓ Fixed "permission denied for table users" error
-- ✓ Maintained same access control logic: admin and userdm329 can modify
-- ✓ All authenticated users can view active manufacturers
-- ✓ Admin can view inactive manufacturers
