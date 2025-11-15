-- Migration: Create dm329_technical_data_shared_users table
-- Description: Allow sharing technical data sheets with multiple userDM329 users
-- Date: 2025-11-15

-- Create table for shared users
CREATE TABLE dm329_technical_data_shared_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  technical_data_id UUID NOT NULL REFERENCES dm329_technical_data(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shared_by UUID NOT NULL REFERENCES users(id),
  shared_at TIMESTAMPTZ DEFAULT now() NOT NULL,

  -- Constraint: a user can be shared only once per technical data sheet
  CONSTRAINT unique_share UNIQUE (technical_data_id, user_id)
);

-- Create indexes for better query performance
CREATE INDEX idx_shared_users_technical_data
  ON dm329_technical_data_shared_users(technical_data_id);

CREATE INDEX idx_shared_users_user
  ON dm329_technical_data_shared_users(user_id);

CREATE INDEX idx_shared_users_shared_by
  ON dm329_technical_data_shared_users(shared_by);

-- Add comments
COMMENT ON TABLE dm329_technical_data_shared_users IS 'Tabella per la condivisione di schede dati DM329 con utenti userDM329';
COMMENT ON COLUMN dm329_technical_data_shared_users.technical_data_id IS 'ID della scheda dati condivisa';
COMMENT ON COLUMN dm329_technical_data_shared_users.user_id IS 'ID dell utente con cui è stata condivisa la scheda';
COMMENT ON COLUMN dm329_technical_data_shared_users.shared_by IS 'ID dell utente che ha condiviso la scheda';
COMMENT ON COLUMN dm329_technical_data_shared_users.shared_at IS 'Data e ora della condivisione';
