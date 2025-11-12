-- Migration: Create customer_users table
-- Description: Tabella per utenti cliente che accedono al portale per visualizzare lo stato delle pratiche

CREATE TABLE IF NOT EXISTS customer_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  last_login_at TIMESTAMPTZ,

  -- Constraint per validazione email
  CONSTRAINT customer_users_email_check CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Indexes
CREATE INDEX idx_customer_users_customer_id ON customer_users(customer_id);
CREATE INDEX idx_customer_users_email ON customer_users(email);
CREATE INDEX idx_customer_users_active ON customer_users(is_active) WHERE is_active = true;

-- Trigger per aggiornare updated_at
CREATE OR REPLACE FUNCTION update_customer_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_customer_users_updated_at
  BEFORE UPDATE ON customer_users
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_users_updated_at();

-- RLS Policies
ALTER TABLE customer_users ENABLE ROW LEVEL SECURITY;

-- Policy: Customer users possono leggere solo i propri dati
-- Nota: L'autenticazione dei customer_users sarà gestita con sistema custom (non Supabase Auth)
-- quindi usiamo una funzione custom per verificare l'identità
CREATE POLICY "Customer users can view own data"
  ON customer_users
  FOR SELECT
  TO authenticated
  USING (
    -- Admin e userdm329 vedono tutti i customer users
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'userdm329')
    )
    -- Oppure il customer_user vede solo se stesso (implementazione futura con JWT custom)
  );

-- Policy: Solo admin e userdm329 possono creare customer users
CREATE POLICY "Only admin and userdm329 can create customer users"
  ON customer_users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'userdm329')
    )
  );

-- Policy: Solo admin e userdm329 possono modificare customer users
CREATE POLICY "Only admin and userdm329 can update customer users"
  ON customer_users
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'userdm329')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'userdm329')
    )
  );

-- Policy: Solo admin può eliminare customer users
CREATE POLICY "Only admin can delete customer users"
  ON customer_users
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Funzione helper per verificare se un customer_user ha accesso a una richiesta
CREATE OR REPLACE FUNCTION customer_user_has_access_to_request(
  p_customer_user_id UUID,
  p_request_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Verifica che la richiesta appartenga al cliente dell'utente
  RETURN EXISTS (
    SELECT 1
    FROM requests r
    JOIN customer_users cu ON r.customer_id = cu.customer_id
    WHERE r.id = p_request_id
    AND cu.id = p_customer_user_id
    AND cu.is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Commenti
COMMENT ON TABLE customer_users IS 'Utenti cliente per accesso al portale di visualizzazione pratiche';
COMMENT ON COLUMN customer_users.customer_id IS 'Riferimento al cliente (azienda) a cui appartiene l''utente';
COMMENT ON COLUMN customer_users.email IS 'Email univoca per login';
COMMENT ON COLUMN customer_users.password_hash IS 'Hash bcrypt della password';
COMMENT ON COLUMN customer_users.is_active IS 'Indica se l''utente può effettuare il login';
COMMENT ON COLUMN customer_users.last_login_at IS 'Data e ora dell''ultimo accesso';
COMMENT ON FUNCTION customer_user_has_access_to_request IS 'Verifica se un customer_user può accedere a una specifica richiesta';
