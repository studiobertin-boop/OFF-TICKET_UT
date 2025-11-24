-- =============================================
-- UPDATE ATTACHMENTS POLICIES
-- =============================================
-- This migration updates attachments policies to:
-- 1. Allow tecnici and new roles (userdm329, tecnicoDM329) to delete attachments
-- 2. Improve storage bucket policies
-- 3. Support the new request-attachments bucket name
-- =============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Admin can view all attachments" ON attachments;
DROP POLICY IF EXISTS "Admin can insert attachments" ON attachments;
DROP POLICY IF EXISTS "Admin can delete attachments" ON attachments;
DROP POLICY IF EXISTS "Tecnico can view assigned request attachments" ON attachments;
DROP POLICY IF EXISTS "Tecnico can add attachments to assigned requests" ON attachments;
DROP POLICY IF EXISTS "Utente can view own request attachments" ON attachments;
DROP POLICY IF EXISTS "Utente can add attachments to own requests" ON attachments;
DROP POLICY IF EXISTS "Utente can delete own attachments" ON attachments;
DROP POLICY IF EXISTS "Utente can delete attachments from own requests" ON attachments;
DROP POLICY IF EXISTS "Tecnico can delete attachments from assigned requests" ON attachments;

-- =============================================
-- ADMIN POLICIES (full access)
-- =============================================

CREATE POLICY "Admin can view all attachments"
  ON attachments FOR SELECT
  USING (get_user_role() = 'admin');

CREATE POLICY "Admin can insert attachments"
  ON attachments FOR INSERT
  WITH CHECK (get_user_role() = 'admin');

CREATE POLICY "Admin can delete attachments"
  ON attachments FOR DELETE
  USING (get_user_role() = 'admin');

-- =============================================
-- TECNICO POLICIES (assigned requests)
-- =============================================

-- Tecnico: can view/add/delete attachments for assigned requests
CREATE POLICY "Tecnico can view assigned request attachments"
  ON attachments FOR SELECT
  USING (
    get_user_role() IN ('tecnico', 'tecnicoDM329') AND
    EXISTS (
      SELECT 1 FROM requests
      WHERE requests.id = attachments.request_id
      AND requests.assigned_to = auth.uid()
    )
  );

CREATE POLICY "Tecnico can add attachments to assigned requests"
  ON attachments FOR INSERT
  WITH CHECK (
    get_user_role() IN ('tecnico', 'tecnicoDM329') AND
    uploaded_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM requests
      WHERE requests.id = attachments.request_id
      AND requests.assigned_to = auth.uid()
    )
  );

CREATE POLICY "Tecnico can delete attachments from assigned requests"
  ON attachments FOR DELETE
  USING (
    get_user_role() IN ('tecnico', 'tecnicoDM329') AND
    EXISTS (
      SELECT 1 FROM requests
      WHERE requests.id = attachments.request_id
      AND requests.assigned_to = auth.uid()
    )
  );

-- =============================================
-- UTENTE POLICIES (own requests)
-- =============================================

-- Utente and userdm329: can view/add/delete attachments for their own requests
CREATE POLICY "Utente can view own request attachments"
  ON attachments FOR SELECT
  USING (
    get_user_role() IN ('utente', 'userdm329') AND
    EXISTS (
      SELECT 1 FROM requests
      WHERE requests.id = attachments.request_id
      AND requests.created_by = auth.uid()
    )
  );

CREATE POLICY "Utente can add attachments to own requests"
  ON attachments FOR INSERT
  WITH CHECK (
    get_user_role() IN ('utente', 'userdm329') AND
    uploaded_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM requests
      WHERE requests.id = attachments.request_id
      AND requests.created_by = auth.uid()
    )
  );

CREATE POLICY "Utente can delete attachments from own requests"
  ON attachments FOR DELETE
  USING (
    get_user_role() IN ('utente', 'userdm329') AND
    EXISTS (
      SELECT 1 FROM requests
      WHERE requests.id = attachments.request_id
      AND requests.created_by = auth.uid()
    )
  );

-- =============================================
-- STORAGE BUCKET POLICIES UPDATE
-- =============================================
-- The 'attachments' bucket already exists, we just need to update its policies

-- Drop old storage policies (clean up any existing policies)
DROP POLICY IF EXISTS "Users can upload attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can view attachments they have access to" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own attachments" ON storage.objects;
DROP POLICY IF EXISTS "Admin can manage all attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to attachments bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view attachments bucket" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete attachments they have access to" ON storage.objects;
DROP POLICY IF EXISTS "Admin can manage all attachments bucket" ON storage.objects;

-- Updated storage policies for 'attachments' bucket
CREATE POLICY "Authenticated users can upload to attachments bucket"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'attachments' AND
    auth.role() = 'authenticated'
  );

CREATE POLICY "Authenticated users can view attachments bucket"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'attachments' AND
    auth.role() = 'authenticated'
  );

CREATE POLICY "Users can delete attachments they have access to"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'attachments' AND
    auth.role() = 'authenticated' AND
    (
      -- Admin can delete all
      get_user_role() = 'admin' OR
      -- Users can delete from their own requests folders
      -- Path structure: requests/{request_id}/{filename}
      EXISTS (
        SELECT 1 FROM requests
        WHERE (storage.foldername(name))[2] = requests.id::text
        AND (
          requests.created_by = auth.uid() OR
          requests.assigned_to = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Admin can manage all attachments bucket"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'attachments' AND
    get_user_role() = 'admin'
  );
