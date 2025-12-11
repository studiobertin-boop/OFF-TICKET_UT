-- ================================================
-- MIGRATION: Create Manufacturers Table
-- ================================================
-- Crea tabella manufacturers per normalizzare il campo marca
-- degli equipment, con gestione costruttori italiani e esteri
-- ================================================

-- Create manufacturers table
CREATE TABLE manufacturers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Nome costruttore (ex campo marca)
  nome TEXT NOT NULL,

  -- Flag per costruttori esteri
  is_estero BOOLEAN NOT NULL DEFAULT false,

  -- Campi per costruttori italiani
  partita_iva TEXT,
  telefono TEXT,
  via TEXT,
  numero_civico TEXT,
  cap TEXT,
  comune TEXT,
  provincia TEXT,

  -- Campo per costruttori esteri
  paese TEXT,

  -- Metadata
  is_active BOOLEAN NOT NULL DEFAULT true,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),

  -- ================================================
  -- CONSTRAINTS
  -- ================================================

  -- Unicità nome costruttore
  CONSTRAINT manufacturers_unique_nome UNIQUE(nome),

  -- P.IVA obbligatoria per costruttori italiani
  CONSTRAINT manufacturers_partita_iva_required_if_italian
    CHECK (
      is_estero = true OR
      (is_estero = false AND partita_iva IS NOT NULL AND length(trim(partita_iva)) > 0)
    ),

  -- P.IVA formato 11 cifre numeriche
  CONSTRAINT manufacturers_partita_iva_format
    CHECK (partita_iva IS NULL OR partita_iva ~ '^[0-9]{11}$'),

  -- Telefono obbligatorio per costruttori italiani
  CONSTRAINT manufacturers_telefono_required_if_italian
    CHECK (
      is_estero = true OR
      (is_estero = false AND telefono IS NOT NULL AND length(trim(telefono)) > 0)
    ),

  -- Via obbligatoria per costruttori italiani
  CONSTRAINT manufacturers_via_required_if_italian
    CHECK (
      is_estero = true OR
      (is_estero = false AND via IS NOT NULL AND length(trim(via)) > 0)
    ),

  -- Numero civico obbligatorio per costruttori italiani
  CONSTRAINT manufacturers_numero_civico_required_if_italian
    CHECK (
      is_estero = true OR
      (is_estero = false AND numero_civico IS NOT NULL AND length(trim(numero_civico)) > 0)
    ),

  -- CAP obbligatorio per costruttori italiani
  CONSTRAINT manufacturers_cap_required_if_italian
    CHECK (
      is_estero = true OR
      (is_estero = false AND cap IS NOT NULL AND length(trim(cap)) > 0)
    ),

  -- CAP formato 5 cifre
  CONSTRAINT manufacturers_cap_format
    CHECK (cap IS NULL OR cap ~ '^[0-9]{5}$'),

  -- Comune obbligatorio per costruttori italiani
  CONSTRAINT manufacturers_comune_required_if_italian
    CHECK (
      is_estero = true OR
      (is_estero = false AND comune IS NOT NULL AND length(trim(comune)) > 0)
    ),

  -- Provincia obbligatoria per costruttori italiani
  CONSTRAINT manufacturers_provincia_required_if_italian
    CHECK (
      is_estero = true OR
      (is_estero = false AND provincia IS NOT NULL AND length(trim(provincia)) > 0)
    ),

  -- Provincia formato 2 lettere maiuscole
  CONSTRAINT manufacturers_provincia_format
    CHECK (provincia IS NULL OR provincia ~ '^[A-Z]{2}$'),

  -- Paese obbligatorio per costruttori esteri
  CONSTRAINT manufacturers_paese_required_if_foreign
    CHECK (
      is_estero = false OR
      (is_estero = true AND paese IS NOT NULL AND length(trim(paese)) > 0)
    )
);

-- ================================================
-- INDEXES
-- ================================================

-- Index per ricerca full-text con trigram
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX manufacturers_nome_trgm_idx ON manufacturers USING gin (nome gin_trgm_ops);

-- Index per filtrare per stato attivo
CREATE INDEX manufacturers_is_active_idx ON manufacturers (is_active);

-- Index per ordinamento per popolarità
CREATE INDEX manufacturers_usage_count_idx ON manufacturers (usage_count DESC);

-- Index per tipo costruttore (italiano/estero)
CREATE INDEX manufacturers_is_estero_idx ON manufacturers (is_estero);

-- ================================================
-- TRIGGERS
-- ================================================

-- Trigger per aggiornare updated_at automaticamente
CREATE OR REPLACE FUNCTION update_manufacturers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER manufacturers_updated_at_trigger
  BEFORE UPDATE ON manufacturers
  FOR EACH ROW
  EXECUTE FUNCTION update_manufacturers_updated_at();

-- ================================================
-- RLS POLICIES
-- ================================================

-- Enable RLS
ALTER TABLE manufacturers ENABLE ROW LEVEL SECURITY;

-- Policy: Tutti gli utenti autenticati possono leggere
CREATE POLICY "Authenticated users can read manufacturers"
  ON manufacturers
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Solo admin e userdm329 possono inserire
CREATE POLICY "Admin and userdm329 can insert manufacturers"
  ON manufacturers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM users WHERE role = 'admin'
      UNION
      SELECT id FROM auth.users WHERE email = 'davide.mastrilli@studiobertin.eu'
    )
  );

-- Policy: Solo admin e userdm329 possono aggiornare
CREATE POLICY "Admin and userdm329 can update manufacturers"
  ON manufacturers
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM users WHERE role = 'admin'
      UNION
      SELECT id FROM auth.users WHERE email = 'davide.mastrilli@studiobertin.eu'
    )
  );

-- Policy: Solo admin e userdm329 possono cancellare (soft delete)
CREATE POLICY "Admin and userdm329 can delete manufacturers"
  ON manufacturers
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM users WHERE role = 'admin'
      UNION
      SELECT id FROM auth.users WHERE email = 'davide.mastrilli@studiobertin.eu'
    )
  );

-- ================================================
-- COMMENTS
-- ================================================

COMMENT ON TABLE manufacturers IS 'Tabella costruttori/marche apparecchiature con dati completi per costruttori italiani ed esteri';
COMMENT ON COLUMN manufacturers.nome IS 'Nome costruttore (ex campo marca)';
COMMENT ON COLUMN manufacturers.is_estero IS 'Flag per distinguere costruttori italiani (false) da esteri (true)';
COMMENT ON COLUMN manufacturers.partita_iva IS 'Partita IVA italiana (11 cifre) - obbligatorio per costruttori italiani';
COMMENT ON COLUMN manufacturers.paese IS 'Nome paese - obbligatorio per costruttori esteri';
COMMENT ON COLUMN manufacturers.usage_count IS 'Contatore utilizzi nelle apparecchiature per ordinamento per popolarità';
