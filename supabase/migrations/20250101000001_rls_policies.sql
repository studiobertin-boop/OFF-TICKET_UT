-- =============================================
-- ENABLE ROW LEVEL SECURITY
-- =============================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- =============================================
-- HELPER FUNCTION TO GET CURRENT USER ROLE
-- =============================================
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- =============================================
-- USERS TABLE POLICIES
-- =============================================

-- Admin: full access
CREATE POLICY "Admin can view all users"
  ON users FOR SELECT
  USING (get_user_role() = 'admin');

CREATE POLICY "Admin can insert users"
  ON users FOR INSERT
  WITH CHECK (get_user_role() = 'admin');

CREATE POLICY "Admin can update all users"
  ON users FOR UPDATE
  USING (get_user_role() = 'admin');

CREATE POLICY "Admin can delete users"
  ON users FOR DELETE
  USING (get_user_role() = 'admin');

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile (except role)
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND
    (SELECT role FROM users WHERE id = auth.uid()) = role -- Role cannot be changed
  );

-- Tecnici can view other users (for assignments)
CREATE POLICY "Tecnici can view users"
  ON users FOR SELECT
  USING (get_user_role() IN ('tecnico', 'admin'));

-- =============================================
-- REQUEST_TYPES TABLE POLICIES
-- =============================================

-- Everyone can view active request types
CREATE POLICY "Everyone can view active request types"
  ON request_types FOR SELECT
  USING (is_active = true OR get_user_role() = 'admin');

-- Only admin can manage request types
CREATE POLICY "Admin can insert request types"
  ON request_types FOR INSERT
  WITH CHECK (get_user_role() = 'admin');

CREATE POLICY "Admin can update request types"
  ON request_types FOR UPDATE
  USING (get_user_role() = 'admin');

CREATE POLICY "Admin can delete request types"
  ON request_types FOR DELETE
  USING (get_user_role() = 'admin');

-- =============================================
-- REQUESTS TABLE POLICIES
-- =============================================

-- Admin: full access to all requests
CREATE POLICY "Admin can view all requests"
  ON requests FOR SELECT
  USING (get_user_role() = 'admin');

CREATE POLICY "Admin can insert requests"
  ON requests FOR INSERT
  WITH CHECK (get_user_role() = 'admin');

CREATE POLICY "Admin can update all requests"
  ON requests FOR UPDATE
  USING (get_user_role() = 'admin');

CREATE POLICY "Admin can delete requests"
  ON requests FOR DELETE
  USING (get_user_role() = 'admin');

-- Tecnico: can view requests assigned to them
CREATE POLICY "Tecnico can view assigned requests"
  ON requests FOR SELECT
  USING (
    get_user_role() = 'tecnico' AND
    assigned_to = auth.uid()
  );

-- Tecnico: can update requests assigned to them
CREATE POLICY "Tecnico can update assigned requests"
  ON requests FOR UPDATE
  USING (
    get_user_role() = 'tecnico' AND
    assigned_to = auth.uid()
  );

-- Utente: can view their own requests
CREATE POLICY "Utente can view own requests"
  ON requests FOR SELECT
  USING (
    get_user_role() = 'utente' AND
    created_by = auth.uid()
  );

-- Utente: can create new requests
CREATE POLICY "Utente can create requests"
  ON requests FOR INSERT
  WITH CHECK (
    get_user_role() = 'utente' AND
    created_by = auth.uid()
  );

-- Utente: can update their own requests (limited fields)
CREATE POLICY "Utente can update own requests"
  ON requests FOR UPDATE
  USING (
    get_user_role() = 'utente' AND
    created_by = auth.uid()
  )
  WITH CHECK (
    created_by = auth.uid() AND
    -- Utente cannot change assigned_to
    assigned_to = (SELECT assigned_to FROM requests WHERE id = requests.id)
  );

-- =============================================
-- REQUEST_HISTORY TABLE POLICIES
-- =============================================

-- Admin: full access
CREATE POLICY "Admin can view all history"
  ON request_history FOR SELECT
  USING (get_user_role() = 'admin');

CREATE POLICY "Admin can insert history"
  ON request_history FOR INSERT
  WITH CHECK (get_user_role() = 'admin');

-- Tecnico: can view history of assigned requests
CREATE POLICY "Tecnico can view assigned request history"
  ON request_history FOR SELECT
  USING (
    get_user_role() = 'tecnico' AND
    EXISTS (
      SELECT 1 FROM requests
      WHERE requests.id = request_history.request_id
      AND requests.assigned_to = auth.uid()
    )
  );

-- Tecnico: can insert history for assigned requests
CREATE POLICY "Tecnico can insert history for assigned requests"
  ON request_history FOR INSERT
  WITH CHECK (
    get_user_role() = 'tecnico' AND
    changed_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM requests
      WHERE requests.id = request_history.request_id
      AND requests.assigned_to = auth.uid()
    )
  );

-- Utente: can view history of their own requests
CREATE POLICY "Utente can view own request history"
  ON request_history FOR SELECT
  USING (
    get_user_role() = 'utente' AND
    EXISTS (
      SELECT 1 FROM requests
      WHERE requests.id = request_history.request_id
      AND requests.created_by = auth.uid()
    )
  );

-- Utente: can insert history for their own requests
CREATE POLICY "Utente can insert history for own requests"
  ON request_history FOR INSERT
  WITH CHECK (
    get_user_role() = 'utente' AND
    changed_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM requests
      WHERE requests.id = request_history.request_id
      AND requests.created_by = auth.uid()
    )
  );

-- =============================================
-- ATTACHMENTS TABLE POLICIES
-- =============================================

-- Admin: full access
CREATE POLICY "Admin can view all attachments"
  ON attachments FOR SELECT
  USING (get_user_role() = 'admin');

CREATE POLICY "Admin can delete attachments"
  ON attachments FOR DELETE
  USING (get_user_role() = 'admin');

-- Tecnico: can view/add attachments for assigned requests
CREATE POLICY "Tecnico can view assigned request attachments"
  ON attachments FOR SELECT
  USING (
    get_user_role() = 'tecnico' AND
    EXISTS (
      SELECT 1 FROM requests
      WHERE requests.id = attachments.request_id
      AND requests.assigned_to = auth.uid()
    )
  );

CREATE POLICY "Tecnico can add attachments to assigned requests"
  ON attachments FOR INSERT
  WITH CHECK (
    get_user_role() = 'tecnico' AND
    uploaded_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM requests
      WHERE requests.id = attachments.request_id
      AND requests.assigned_to = auth.uid()
    )
  );

-- Utente: can view/add/delete attachments for their own requests
CREATE POLICY "Utente can view own request attachments"
  ON attachments FOR SELECT
  USING (
    get_user_role() = 'utente' AND
    EXISTS (
      SELECT 1 FROM requests
      WHERE requests.id = attachments.request_id
      AND requests.created_by = auth.uid()
    )
  );

CREATE POLICY "Utente can add attachments to own requests"
  ON attachments FOR INSERT
  WITH CHECK (
    get_user_role() = 'utente' AND
    uploaded_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM requests
      WHERE requests.id = attachments.request_id
      AND requests.created_by = auth.uid()
    )
  );

CREATE POLICY "Utente can delete own attachments"
  ON attachments FOR DELETE
  USING (
    get_user_role() = 'utente' AND
    uploaded_by = auth.uid()
  );

-- =============================================
-- NOTIFICATIONS TABLE POLICIES
-- =============================================

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own notifications
CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  USING (user_id = auth.uid());

-- System can insert notifications (will be handled by triggers/functions)
CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

-- Admin can manage all notifications
CREATE POLICY "Admin can view all notifications"
  ON notifications FOR SELECT
  USING (get_user_role() = 'admin');

CREATE POLICY "Admin can delete notifications"
  ON notifications FOR DELETE
  USING (get_user_role() = 'admin');

-- =============================================
-- STORAGE BUCKET POLICIES (for attachments)
-- =============================================

-- Create storage bucket for attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users can upload attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'attachments' AND
    auth.role() = 'authenticated'
  );

CREATE POLICY "Users can view attachments they have access to"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'attachments' AND
    auth.role() = 'authenticated'
  );

CREATE POLICY "Users can delete their own attachments"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'attachments' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Admin can manage all storage
CREATE POLICY "Admin can manage all attachments"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'attachments' AND
    get_user_role() = 'admin'
  );
