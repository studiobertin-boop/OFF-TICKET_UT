-- Migration: Aggiunta campo is_suspended e policies per userdm329
-- Data: 2025-01-01
-- Parte 2: Campo is_suspended e policies (dopo che enum è stato committato)

-- Aggiungere campo is_suspended alla tabella users
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT FALSE;

-- Creare indice per query su utenti sospesi
CREATE INDEX IF NOT EXISTS idx_users_is_suspended ON users(is_suspended);

-- Funzione helper per verificare se un utente è sospeso
CREATE OR REPLACE FUNCTION is_user_suspended(user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT COALESCE(is_suspended, FALSE) FROM users WHERE id = user_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- Aggiornare RLS policies per requests per includere userdm329
-- userdm329 può vedere solo richieste di tipo DM329

-- Prima rimuoviamo le vecchie policies per requests se esistono
DROP POLICY IF EXISTS "userdm329 can view DM329 requests" ON requests;
DROP POLICY IF EXISTS "userdm329 can update DM329 requests" ON requests;

-- Policy per userdm329: SELECT solo richieste DM329
CREATE POLICY "userdm329 can view DM329 requests"
  ON requests FOR SELECT
  USING (
    get_user_role() = 'userdm329' AND
    request_type_id IN (
      SELECT id FROM request_types WHERE name = 'DM329'
    )
  );

-- Policy per userdm329: UPDATE solo richieste DM329
CREATE POLICY "userdm329 can update DM329 requests"
  ON requests FOR UPDATE
  USING (
    get_user_role() = 'userdm329' AND
    request_type_id IN (
      SELECT id FROM request_types WHERE name = 'DM329'
    )
  )
  WITH CHECK (
    get_user_role() = 'userdm329' AND
    request_type_id IN (
      SELECT id FROM request_types WHERE name = 'DM329'
    )
  );

-- Commenti
COMMENT ON COLUMN users.is_suspended IS 'Flag che indica se l utente è sospeso e non può accedere al sistema';
COMMENT ON FUNCTION is_user_suspended IS 'Verifica se un utente è sospeso';
