-- Migration: Create installers table
-- Description: Creates installers (installatori) table with Italian address fields
--              Simpler than manufacturers - only Italian installers, no foreign option

-- Enable pg_trgm extension for fuzzy search (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ================================================
-- CREATE INSTALLERS TABLE
-- ================================================

CREATE TABLE installers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Basic info
  nome TEXT NOT NULL,

  -- Italian fields (all required for installers)
  partita_iva TEXT NOT NULL,
  via TEXT NOT NULL,
  numero_civico TEXT NOT NULL,
  cap TEXT NOT NULL,
  comune TEXT NOT NULL,
  provincia TEXT NOT NULL,

  -- Metadata
  is_active BOOLEAN NOT NULL DEFAULT true,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),

  -- ================================================
  -- CONSTRAINTS
  -- ================================================

  -- Unicità nome installatore
  CONSTRAINT installers_unique_nome UNIQUE(nome),

  -- P.IVA formato 11 cifre numeriche
  CONSTRAINT installers_partita_iva_format
    CHECK (partita_iva ~ '^[0-9]{11}$'),

  -- CAP formato 5 cifre
  CONSTRAINT installers_cap_format
    CHECK (cap ~ '^[0-9]{5}$'),

  -- Provincia formato 2 lettere maiuscole
  CONSTRAINT installers_provincia_format
    CHECK (provincia ~ '^[A-Z]{2}$'),

  -- Not empty constraints
  CONSTRAINT installers_nome_not_empty
    CHECK (length(trim(nome)) > 0),

  CONSTRAINT installers_partita_iva_not_empty
    CHECK (length(trim(partita_iva)) > 0),

  CONSTRAINT installers_via_not_empty
    CHECK (length(trim(via)) > 0),

  CONSTRAINT installers_numero_civico_not_empty
    CHECK (length(trim(numero_civico)) > 0),

  CONSTRAINT installers_cap_not_empty
    CHECK (length(trim(cap)) > 0),

  CONSTRAINT installers_comune_not_empty
    CHECK (length(trim(comune)) > 0),

  CONSTRAINT installers_provincia_not_empty
    CHECK (length(trim(provincia)) > 0)
);

-- ================================================
-- INDEXES
-- ================================================

-- Trigram index per fuzzy search su nome
CREATE INDEX idx_installers_nome_gin ON installers USING gin (nome gin_trgm_ops);

-- Index su partita_iva per lookup veloci
CREATE INDEX idx_installers_partita_iva ON installers(partita_iva);

-- Partial index per installatori attivi (query più comuni)
CREATE INDEX idx_installers_active ON installers(is_active) WHERE is_active = true;

-- Index per ordinamento per usage_count (installatori più usati)
CREATE INDEX idx_installers_usage_count ON installers(usage_count DESC);

-- Index per created_at
CREATE INDEX idx_installers_created_at ON installers(created_at DESC);

-- ================================================
-- TRIGGERS
-- ================================================

-- Trigger per updated_at automatico
CREATE TRIGGER trigger_installers_updated_at
  BEFORE UPDATE ON installers
  FOR EACH ROW
  EXECUTE FUNCTION update_customers_updated_at(); -- Reuse existing function

-- ================================================
-- ROW LEVEL SECURITY (RLS)
-- ================================================

ALTER TABLE installers ENABLE ROW LEVEL SECURITY;

-- SELECT: Anyone authenticated can view active installers
-- Admin and userdm329 can view all (including inactive)
CREATE POLICY "Anyone can view active installers"
  ON installers
  FOR SELECT
  USING (
    is_active = true
    OR
    get_user_role() IN ('admin', 'userdm329')
  );

-- INSERT: Only admin and userdm329 can create installers
CREATE POLICY "Admin and userdm329 can insert installers"
  ON installers
  FOR INSERT
  WITH CHECK (
    get_user_role() IN ('admin', 'userdm329')
  );

-- UPDATE: Only admin and userdm329 can update installers
CREATE POLICY "Admin and userdm329 can update installers"
  ON installers
  FOR UPDATE
  USING (
    get_user_role() IN ('admin', 'userdm329')
  )
  WITH CHECK (
    get_user_role() IN ('admin', 'userdm329')
  );

-- DELETE: Only admin can delete installers (soft delete via is_active recommended)
CREATE POLICY "Admin can delete installers"
  ON installers
  FOR DELETE
  USING (
    get_user_role() = 'admin'
  );

-- ================================================
-- GRANT PERMISSIONS
-- ================================================

GRANT SELECT ON installers TO authenticated;
GRANT ALL ON installers TO service_role;

-- ================================================
-- COMMENTS
-- ================================================

COMMENT ON TABLE installers IS 'Installers (installatori) master data - Italian companies only';
COMMENT ON COLUMN installers.nome IS 'Installer company name';
COMMENT ON COLUMN installers.partita_iva IS 'Italian VAT number (P.IVA) - 11 digits';
COMMENT ON COLUMN installers.via IS 'Street name';
COMMENT ON COLUMN installers.numero_civico IS 'Street number';
COMMENT ON COLUMN installers.cap IS 'Postal code (CAP) - 5 digits';
COMMENT ON COLUMN installers.comune IS 'Municipality/city name';
COMMENT ON COLUMN installers.provincia IS 'Province code - 2 uppercase letters';
COMMENT ON COLUMN installers.is_active IS 'Soft delete flag - false means installer is hidden';
COMMENT ON COLUMN installers.usage_count IS 'Number of times installer is used in requests';
