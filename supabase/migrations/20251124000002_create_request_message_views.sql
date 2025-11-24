-- =============================================
-- CREATE REQUEST MESSAGE VIEWS TABLE
-- =============================================
-- This migration creates a table to track when users view messages
-- Used to show "new message" indicators in the request list
-- =============================================

-- Create message views table
CREATE TABLE IF NOT EXISTS request_message_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(request_id, user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_request_message_views_request_id ON request_message_views(request_id);
CREATE INDEX IF NOT EXISTS idx_request_message_views_user_id ON request_message_views(user_id);

-- Enable RLS
ALTER TABLE request_message_views ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES FOR REQUEST MESSAGE VIEWS
-- =============================================

-- Users can only view and manage their own view records
CREATE POLICY "Users can view own message views"
  ON request_message_views FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own message views"
  ON request_message_views FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own message views"
  ON request_message_views FOR UPDATE
  USING (user_id = auth.uid());

-- =============================================
-- TRIGGER FOR UPDATED_AT
-- =============================================

CREATE OR REPLACE FUNCTION update_request_message_views_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_request_message_views_updated_at
  BEFORE UPDATE ON request_message_views
  FOR EACH ROW
  EXECUTE FUNCTION update_request_message_views_updated_at();

-- =============================================
-- FUNCTION TO CHECK FOR NEW MESSAGES
-- =============================================

CREATE OR REPLACE FUNCTION has_unread_messages(p_request_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  latest_message_time TIMESTAMP WITH TIME ZONE;
  last_viewed_time TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Get the timestamp of the latest message
  SELECT MAX(created_at) INTO latest_message_time
  FROM request_messages
  WHERE request_id = p_request_id;

  -- If no messages, return false
  IF latest_message_time IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Get the last viewed timestamp for this user
  SELECT last_viewed_at INTO last_viewed_time
  FROM request_message_views
  WHERE request_id = p_request_id AND user_id = p_user_id;

  -- If never viewed, return true (has unread messages)
  IF last_viewed_time IS NULL THEN
    RETURN TRUE;
  END IF;

  -- Return true if there are messages newer than last view
  RETURN latest_message_time > last_viewed_time;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- COMMENTS
-- =============================================

COMMENT ON TABLE request_message_views IS 'Tracks when users last viewed messages for each request';
COMMENT ON COLUMN request_message_views.request_id IS 'Reference to the request';
COMMENT ON COLUMN request_message_views.user_id IS 'User who viewed the messages';
COMMENT ON COLUMN request_message_views.last_viewed_at IS 'Timestamp of when the user last viewed the chat';
COMMENT ON FUNCTION has_unread_messages IS 'Returns true if there are messages newer than the users last view';
