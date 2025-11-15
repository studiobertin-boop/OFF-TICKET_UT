-- Migration: Create feature_flags table
-- Description: Tabella per gestire feature flags dell'applicazione

CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_name TEXT UNIQUE NOT NULL,
  is_enabled BOOLEAN DEFAULT false NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Index per ricerche veloci per nome
CREATE INDEX idx_feature_flags_name ON feature_flags(flag_name);

-- Trigger per aggiornare updated_at
CREATE OR REPLACE FUNCTION update_feature_flags_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_feature_flags_updated_at
  BEFORE UPDATE ON feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION update_feature_flags_updated_at();

-- RLS Policies
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

-- Policy: Tutti possono leggere i feature flags
CREATE POLICY "Feature flags are viewable by authenticated users"
  ON feature_flags
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Solo admin possono modificare i feature flags
CREATE POLICY "Feature flags are editable by admins only"
  ON feature_flags
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Inserisci flag per DM329 full workflow (disabilitato di default)
INSERT INTO feature_flags (flag_name, is_enabled, description)
VALUES (
  'dm329_full_workflow',
  false,
  'Abilita gestione completa pratiche DM329: scheda dati tecnici, OCR targhette, portale cliente'
);

-- Commento
COMMENT ON TABLE feature_flags IS 'Feature flags per abilitare/disabilitare funzionalità dell''applicazione';
COMMENT ON COLUMN feature_flags.flag_name IS 'Nome univoco del feature flag';
COMMENT ON COLUMN feature_flags.is_enabled IS 'Indica se la funzionalità è abilitata';
COMMENT ON COLUMN feature_flags.description IS 'Descrizione della funzionalità controllata dal flag';
