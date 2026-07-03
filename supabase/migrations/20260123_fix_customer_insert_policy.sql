-- Migration: Fix customer INSERT policy for userdm329 and tecnico roles
-- Date: 2026-01-23
-- Description:
--   Allow userdm329 and tecnico roles to insert customers (currently only admins can insert)
--   This fixes the "new row violates row-level security policy" error

-- ============================================================================
-- Drop existing INSERT policy and create new one for admin + userdm329 + tecnico
-- ============================================================================

-- Drop old policy that only allows admin
DROP POLICY IF EXISTS "Admin can insert customers" ON customers;

-- Create new policy allowing admin, userdm329, and tecnico to insert
CREATE POLICY "Admin, DM329 users, and tecnici can insert customers"
  ON customers
  FOR INSERT
  WITH CHECK (get_user_role() IN ('admin', 'userdm329', 'tecnico'));

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Summary:
-- ✓ Dropped old "Admin can insert customers" policy
-- ✓ Created new "Admin, DM329 users, and tecnici can insert customers" policy
-- ✓ admin, userdm329, and tecnico roles can now create new customers
-- ✗ utente and tecnicoDM329 roles still cannot create customers (by design)
