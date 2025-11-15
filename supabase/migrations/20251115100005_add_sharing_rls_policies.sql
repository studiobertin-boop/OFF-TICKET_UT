-- Migration: Add RLS policies for sharing system
-- Description: Policies for dm329_technical_data_shared_users and update existing dm329_technical_data policies
-- Date: 2025-11-15

-- ============================================================================
-- PART 1: RLS Policies for dm329_technical_data_shared_users table
-- ============================================================================

ALTER TABLE dm329_technical_data_shared_users ENABLE ROW LEVEL SECURITY;

-- Policy: Admin can view all shares
CREATE POLICY "Admin can view all shares"
  ON dm329_technical_data_shared_users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Policy: userdm329 can view shares for all DM329 technical data
CREATE POLICY "userdm329 can view all shares"
  ON dm329_technical_data_shared_users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'userdm329'
    )
  );

-- Policy: tecnicoDM329 can view shares for their assigned technical data
CREATE POLICY "tecnicoDM329 can view shares for assigned data"
  ON dm329_technical_data_shared_users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN dm329_technical_data td ON td.id = technical_data_id
      JOIN requests r ON r.id = td.request_id
      WHERE u.id = auth.uid()
      AND u.role = 'tecnicoDM329'
      AND r.assigned_to = auth.uid()
    )
  );

-- Policy: Admin can create shares
CREATE POLICY "Admin can create shares"
  ON dm329_technical_data_shared_users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
    AND shared_by = auth.uid()
  );

-- Policy: userdm329 can create shares
CREATE POLICY "userdm329 can create shares"
  ON dm329_technical_data_shared_users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'userdm329'
    )
    AND shared_by = auth.uid()
  );

-- Policy: tecnicoDM329 can create shares for their assigned technical data
CREATE POLICY "tecnicoDM329 can create shares for assigned data"
  ON dm329_technical_data_shared_users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN dm329_technical_data td ON td.id = technical_data_id
      JOIN requests r ON r.id = td.request_id
      WHERE u.id = auth.uid()
      AND u.role = 'tecnicoDM329'
      AND r.assigned_to = auth.uid()
    )
    AND shared_by = auth.uid()
  );

-- Policy: Admin can delete any share
CREATE POLICY "Admin can delete shares"
  ON dm329_technical_data_shared_users
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Policy: userdm329 can delete shares
CREATE POLICY "userdm329 can delete shares"
  ON dm329_technical_data_shared_users
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'userdm329'
    )
  );

-- Policy: tecnicoDM329 can delete shares for their assigned data
CREATE POLICY "tecnicoDM329 can delete shares for assigned data"
  ON dm329_technical_data_shared_users
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN dm329_technical_data td ON td.id = technical_data_id
      JOIN requests r ON r.id = td.request_id
      WHERE u.id = auth.uid()
      AND u.role = 'tecnicoDM329'
      AND r.assigned_to = auth.uid()
    )
  );

-- ============================================================================
-- PART 2: Update dm329_technical_data policies to include shared users
-- ============================================================================

-- Drop and recreate SELECT policy to include shared users
DROP POLICY IF EXISTS "Admin and userdm329 can view all technical data" ON dm329_technical_data;
DROP POLICY IF EXISTS "tecnicoDM329 can view assigned technical data" ON dm329_technical_data;

CREATE POLICY "Users can view technical data based on role and sharing"
  ON dm329_technical_data
  FOR SELECT
  TO authenticated
  USING (
    -- Admin can view all
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
    OR
    -- userdm329 can view all
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'userdm329'
    )
    OR
    -- tecnicoDM329 can view assigned sheets
    EXISTS (
      SELECT 1 FROM users u
      JOIN requests r ON r.id = dm329_technical_data.request_id
      WHERE u.id = auth.uid()
      AND u.role = 'tecnicoDM329'
      AND r.assigned_to = auth.uid()
    )
    OR
    -- userDM329 shared: can view shared sheets
    EXISTS (
      SELECT 1 FROM dm329_technical_data_shared_users sh
      WHERE sh.technical_data_id = dm329_technical_data.id
      AND sh.user_id = auth.uid()
    )
  );

-- Drop and recreate UPDATE policy to include shared users
DROP POLICY IF EXISTS "Admin and userdm329 can update technical data" ON dm329_technical_data;
DROP POLICY IF EXISTS "tecnicoDM329 can update assigned technical data" ON dm329_technical_data;

CREATE POLICY "Users can update technical data based on role and sharing"
  ON dm329_technical_data
  FOR UPDATE
  TO authenticated
  USING (
    -- Admin can update all
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
    OR
    -- userdm329 can update all
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'userdm329'
    )
    OR
    -- tecnicoDM329 can update assigned sheets
    EXISTS (
      SELECT 1 FROM users u
      JOIN requests r ON r.id = dm329_technical_data.request_id
      WHERE u.id = auth.uid()
      AND u.role = 'tecnicoDM329'
      AND r.assigned_to = auth.uid()
    )
    OR
    -- userDM329 shared: can update shared sheets
    EXISTS (
      SELECT 1 FROM dm329_technical_data_shared_users sh
      WHERE sh.technical_data_id = dm329_technical_data.id
      AND sh.user_id = auth.uid()
    )
  )
  WITH CHECK (
    -- Same conditions for WITH CHECK
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'userdm329')
    )
    OR
    EXISTS (
      SELECT 1 FROM users u
      JOIN requests r ON r.id = dm329_technical_data.request_id
      WHERE u.id = auth.uid()
      AND u.role = 'tecnicoDM329'
      AND r.assigned_to = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM dm329_technical_data_shared_users sh
      WHERE sh.technical_data_id = dm329_technical_data.id
      AND sh.user_id = auth.uid()
    )
  );
