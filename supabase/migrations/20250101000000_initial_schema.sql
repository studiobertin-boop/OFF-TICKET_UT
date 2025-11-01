-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create ENUM types
CREATE TYPE user_role AS ENUM ('admin', 'tecnico', 'utente');

CREATE TYPE request_status AS ENUM (
  'APERTA',
  'ASSEGNATA',
  'IN_LAVORAZIONE',
  'INFO_NECESSARIE',
  'INFO_TRASMESSE',
  'COMPLETATA',
  'SOSPESA',
  'ABORTITA'
);

CREATE TYPE dm329_status AS ENUM (
  '1-INCARICO_RICEVUTO',
  '2-SCHEDA_DATI_PRONTA',
  '3-MAIL_CLIENTE_INVIATA',
  '4-DOCUMENTI_PRONTI',
  '5-ATTESA_FIRMA',
  '6-PRONTA_PER_CIVA',
  '7-CHIUSA'
);

-- =============================================
-- USERS TABLE
-- =============================================
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  role user_role NOT NULL DEFAULT 'utente',
  full_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for faster role-based queries
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_email ON users(email);

-- =============================================
-- REQUEST_TYPES TABLE
-- =============================================
CREATE TABLE request_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  fields_schema JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_fields_schema CHECK (jsonb_typeof(fields_schema) = 'array')
);

-- Index for active request types
CREATE INDEX idx_request_types_active ON request_types(is_active) WHERE is_active = true;

-- =============================================
-- REQUESTS TABLE
-- =============================================
CREATE TABLE requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_type_id UUID NOT NULL REFERENCES request_types(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_custom_fields CHECK (jsonb_typeof(custom_fields) = 'object')
);

-- Indexes for performance
CREATE INDEX idx_requests_type ON requests(request_type_id);
CREATE INDEX idx_requests_status ON requests(status);
CREATE INDEX idx_requests_assigned ON requests(assigned_to);
CREATE INDEX idx_requests_creator ON requests(created_by);
CREATE INDEX idx_requests_created_at ON requests(created_at DESC);

-- =============================================
-- REQUEST_HISTORY TABLE
-- =============================================
CREATE TABLE request_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  status_from TEXT,
  status_to TEXT NOT NULL,
  changed_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for request history queries
CREATE INDEX idx_request_history_request ON request_history(request_id, created_at DESC);
CREATE INDEX idx_request_history_user ON request_history(changed_by);

-- =============================================
-- ATTACHMENTS TABLE
-- =============================================
CREATE TABLE attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT positive_file_size CHECK (file_size > 0),
  CONSTRAINT max_file_size CHECK (file_size <= 10485760) -- 10MB max
);

-- Index for request attachments
CREATE INDEX idx_attachments_request ON attachments(request_id);
CREATE INDEX idx_attachments_uploader ON attachments(uploaded_by);

-- =============================================
-- NOTIFICATIONS TABLE
-- =============================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_id UUID REFERENCES requests(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for notifications
CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(user_id, read) WHERE read = false;
CREATE INDEX idx_notifications_request ON notifications(request_id);

-- =============================================
-- TRIGGERS FOR UPDATED_AT
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_request_types_updated_at
  BEFORE UPDATE ON request_types
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_requests_updated_at
  BEFORE UPDATE ON requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- AUTO-CREATE USER PROFILE ON SIGNUP
-- =============================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, role, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    'utente',
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- =============================================
-- STATUS TRANSITION VALIDATION FUNCTION
-- =============================================
CREATE OR REPLACE FUNCTION validate_status_transition(
  p_request_id UUID,
  p_new_status TEXT,
  p_user_role user_role,
  p_request_type_name TEXT DEFAULT NULL
)
RETURNS TABLE(valid BOOLEAN, message TEXT) AS $$
DECLARE
  v_current_status TEXT;
  v_request_type TEXT;
BEGIN
  -- Get current status and request type
  SELECT r.status, rt.name
  INTO v_current_status, v_request_type
  FROM requests r
  JOIN request_types rt ON r.request_type_id = rt.id
  WHERE r.id = p_request_id;

  -- If request not found
  IF v_current_status IS NULL THEN
    RETURN QUERY SELECT false, 'Richiesta non trovata';
    RETURN;
  END IF;

  -- Admin can set any status
  IF p_user_role = 'admin' THEN
    RETURN QUERY SELECT true, 'Transizione permessa (Admin)';
    RETURN;
  END IF;

  -- Check if it's a DM329 request (special workflow)
  IF v_request_type = 'DM329' THEN
    -- DM329 workflow: sequential states
    CASE
      WHEN v_current_status = '1-INCARICO_RICEVUTO' AND p_new_status = '2-SCHEDA_DATI_PRONTA' THEN
        RETURN QUERY SELECT true, 'Transizione valida';
      WHEN v_current_status = '2-SCHEDA_DATI_PRONTA' AND p_new_status = '3-MAIL_CLIENTE_INVIATA' THEN
        RETURN QUERY SELECT true, 'Transizione valida';
      WHEN v_current_status = '3-MAIL_CLIENTE_INVIATA' AND p_new_status = '4-DOCUMENTI_PRONTI' THEN
        RETURN QUERY SELECT true, 'Transizione valida';
      WHEN v_current_status = '4-DOCUMENTI_PRONTI' AND p_new_status = '5-ATTESA_FIRMA' THEN
        RETURN QUERY SELECT true, 'Transizione valida';
      WHEN v_current_status = '5-ATTESA_FIRMA' AND p_new_status = '6-PRONTA_PER_CIVA' THEN
        RETURN QUERY SELECT true, 'Transizione valida';
      WHEN v_current_status = '6-PRONTA_PER_CIVA' AND p_new_status = '7-CHIUSA' THEN
        RETURN QUERY SELECT true, 'Transizione valida';
      ELSE
        RETURN QUERY SELECT false, 'Transizione non permessa per workflow DM329';
    END CASE;
    RETURN;
  END IF;

  -- Standard workflow for other request types
  CASE
    -- From APERTA
    WHEN v_current_status = 'APERTA' AND p_new_status IN ('ASSEGNATA', 'ABORTITA') THEN
      RETURN QUERY SELECT true, 'Transizione valida';

    -- From ASSEGNATA
    WHEN v_current_status = 'ASSEGNATA' AND p_new_status IN ('IN_LAVORAZIONE', 'APERTA') THEN
      RETURN QUERY SELECT true, 'Transizione valida';

    -- From IN_LAVORAZIONE
    WHEN v_current_status = 'IN_LAVORAZIONE' AND p_new_status IN ('INFO_NECESSARIE', 'COMPLETATA', 'SOSPESA') THEN
      RETURN QUERY SELECT true, 'Transizione valida';

    -- From INFO_NECESSARIE
    WHEN v_current_status = 'INFO_NECESSARIE' AND p_new_status IN ('INFO_TRASMESSE', 'IN_LAVORAZIONE') THEN
      RETURN QUERY SELECT true, 'Transizione valida';

    -- From INFO_TRASMESSE
    WHEN v_current_status = 'INFO_TRASMESSE' AND p_new_status IN ('IN_LAVORAZIONE', 'INFO_NECESSARIE') THEN
      RETURN QUERY SELECT true, 'Transizione valida';

    -- From SOSPESA
    WHEN v_current_status = 'SOSPESA' AND p_new_status IN ('IN_LAVORAZIONE', 'ABORTITA') THEN
      RETURN QUERY SELECT true, 'Transizione valida';

    -- From COMPLETATA or ABORTITA (only admin can reopen, but we already checked admin above)
    WHEN v_current_status IN ('COMPLETATA', 'ABORTITA') THEN
      RETURN QUERY SELECT false, 'Le richieste chiuse possono essere riaperte solo dagli amministratori';

    -- Invalid transition
    ELSE
      RETURN QUERY SELECT false, 'Transizione non permessa: da ' || v_current_status || ' a ' || p_new_status;
  END CASE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION validate_status_transition IS 'Validates status transitions based on user role and request type workflow';
