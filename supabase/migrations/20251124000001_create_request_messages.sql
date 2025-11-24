-- =============================================
-- CREATE REQUEST MESSAGES TABLE
-- =============================================
-- This migration creates a chat/messaging system for requests
-- All users who can view a request can also view and post messages
-- =============================================

-- Create messages table
CREATE TABLE IF NOT EXISTS request_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_request_messages_request_id ON request_messages(request_id);
CREATE INDEX IF NOT EXISTS idx_request_messages_created_at ON request_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_request_messages_user_id ON request_messages(user_id);

-- Enable RLS
ALTER TABLE request_messages ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES FOR REQUEST MESSAGES
-- =============================================

-- Admin: full access to all messages
CREATE POLICY "Admin can view all messages"
  ON request_messages FOR SELECT
  USING (get_user_role() = 'admin');

CREATE POLICY "Admin can insert messages"
  ON request_messages FOR INSERT
  WITH CHECK (get_user_role() = 'admin');

CREATE POLICY "Admin can delete messages"
  ON request_messages FOR DELETE
  USING (get_user_role() = 'admin');

-- Tecnico/TecnicoDM329: can view/insert messages for assigned requests
CREATE POLICY "Tecnico can view messages for assigned requests"
  ON request_messages FOR SELECT
  USING (
    get_user_role() IN ('tecnico', 'tecnicoDM329') AND
    EXISTS (
      SELECT 1 FROM requests
      WHERE requests.id = request_messages.request_id
      AND requests.assigned_to = auth.uid()
    )
  );

CREATE POLICY "Tecnico can insert messages for assigned requests"
  ON request_messages FOR INSERT
  WITH CHECK (
    get_user_role() IN ('tecnico', 'tecnicoDM329') AND
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM requests
      WHERE requests.id = request_messages.request_id
      AND requests.assigned_to = auth.uid()
    )
  );

-- Utente/UserDM329: can view/insert messages for own requests
CREATE POLICY "Utente can view messages for own requests"
  ON request_messages FOR SELECT
  USING (
    get_user_role() IN ('utente', 'userdm329') AND
    EXISTS (
      SELECT 1 FROM requests
      WHERE requests.id = request_messages.request_id
      AND requests.created_by = auth.uid()
    )
  );

CREATE POLICY "Utente can insert messages for own requests"
  ON request_messages FOR INSERT
  WITH CHECK (
    get_user_role() IN ('utente', 'userdm329') AND
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM requests
      WHERE requests.id = request_messages.request_id
      AND requests.created_by = auth.uid()
    )
  );

-- Users can only delete their own messages
CREATE POLICY "Users can delete own messages"
  ON request_messages FOR DELETE
  USING (user_id = auth.uid());

-- =============================================
-- TRIGGER FOR UPDATED_AT
-- =============================================

CREATE OR REPLACE FUNCTION update_request_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_request_messages_updated_at
  BEFORE UPDATE ON request_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_request_messages_updated_at();

-- =============================================
-- COMMENTS
-- =============================================

COMMENT ON TABLE request_messages IS 'Chat messages for requests - visible to all users who can view the request';
COMMENT ON COLUMN request_messages.request_id IS 'Reference to the request this message belongs to';
COMMENT ON COLUMN request_messages.user_id IS 'User who posted the message';
COMMENT ON COLUMN request_messages.message IS 'The message text content';
