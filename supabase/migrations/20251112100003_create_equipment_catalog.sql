-- Migration: Create equipment_catalog table
-- Description: Catalogo normalizzato di apparecchiature (tipo-marca-modello) per matching OCR

-- Abilita estensione pg_trgm per ricerca fuzzy
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS equipment_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identificatori apparecchiatura
  tipo TEXT NOT NULL, -- Es: "Compressore", "Essiccatore", "Serbatoio"
  marca TEXT NOT NULL, -- Es: "Atlas Copco", "Kaeser", "Ingersoll Rand"
  modello TEXT NOT NULL, -- Es: "GA 30", "BSD 72"

  -- Campo normalizzato per ricerca fuzzy (generato automaticamente)
  normalized_name TEXT GENERATED ALWAYS AS (
    lower(
      regexp_replace(
        tipo || ' ' || marca || ' ' || modello,
        '[^a-z0-9 ]',
        '',
        'gi'
      )
    )
  ) STORED,

  -- Varianti e alias comuni (per migliorare matching OCR)
  aliases TEXT[], -- Es: ["GA30", "GA-30", "GA 30 VSD"]

  -- Specifiche tecniche pre-note (opzionale, per pre-popolare campi)
  specs JSONB DEFAULT '{}'::jsonb,
  -- Esempio specs:
  -- {
  --   "potenza_kw": 30,
  --   "portata_m3_min": 5.5,
  --   "pressione_bar": 8,
  --   "anno_tipico": 2015
  -- }

  -- Metadata
  is_active BOOLEAN DEFAULT true NOT NULL,
  usage_count INTEGER DEFAULT 0 NOT NULL, -- Conta quante volte è stato matchato (per statistiche)
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,

  -- Constraint univocità
  CONSTRAINT equipment_catalog_unique_combo UNIQUE(tipo, marca, modello)
);

-- Indexes per performance
CREATE INDEX idx_equipment_catalog_tipo ON equipment_catalog(tipo);
CREATE INDEX idx_equipment_catalog_marca ON equipment_catalog(marca);
CREATE INDEX idx_equipment_catalog_modello ON equipment_catalog(modello);
CREATE INDEX idx_equipment_catalog_active ON equipment_catalog(is_active) WHERE is_active = true;

-- Index trigram per ricerca fuzzy su normalized_name
CREATE INDEX idx_equipment_catalog_normalized_trgm
  ON equipment_catalog USING gin(normalized_name gin_trgm_ops);

-- Index trigram per ricerca fuzzy su marca e modello
CREATE INDEX idx_equipment_catalog_marca_trgm
  ON equipment_catalog USING gin(marca gin_trgm_ops);
CREATE INDEX idx_equipment_catalog_modello_trgm
  ON equipment_catalog USING gin(modello gin_trgm_ops);

-- Index GIN per array aliases
CREATE INDEX idx_equipment_catalog_aliases ON equipment_catalog USING gin(aliases);

-- Index GIN per specs JSONB
CREATE INDEX idx_equipment_catalog_specs ON equipment_catalog USING gin(specs);

-- Trigger per aggiornare updated_at
CREATE OR REPLACE FUNCTION update_equipment_catalog_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_equipment_catalog_updated_at
  BEFORE UPDATE ON equipment_catalog
  FOR EACH ROW
  EXECUTE FUNCTION update_equipment_catalog_updated_at();

-- RLS Policies
ALTER TABLE equipment_catalog ENABLE ROW LEVEL SECURITY;

-- Policy: Tutti gli utenti autenticati possono leggere il catalogo
CREATE POLICY "Equipment catalog is viewable by authenticated users"
  ON equipment_catalog
  FOR SELECT
  TO authenticated
  USING (is_active = true OR EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  ));

-- Policy: Solo admin e userdm329 possono aggiungere apparecchiature
CREATE POLICY "Only admin and userdm329 can create equipment"
  ON equipment_catalog
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'userdm329')
    )
  );

-- Policy: Solo admin e userdm329 possono modificare apparecchiature
CREATE POLICY "Only admin and userdm329 can update equipment"
  ON equipment_catalog
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

-- Policy: Solo admin può eliminare apparecchiature
CREATE POLICY "Only admin can delete equipment"
  ON equipment_catalog
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Funzione per ricerca fuzzy di apparecchiature
CREATE OR REPLACE FUNCTION search_equipment_fuzzy(
  search_text TEXT,
  similarity_threshold REAL DEFAULT 0.3,
  max_results INT DEFAULT 10
)
RETURNS TABLE(
  id UUID,
  tipo TEXT,
  marca TEXT,
  modello TEXT,
  similarity_score REAL,
  specs JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ec.id,
    ec.tipo,
    ec.marca,
    ec.modello,
    similarity(ec.normalized_name, lower(search_text)) as sim_score,
    ec.specs
  FROM equipment_catalog ec
  WHERE
    ec.is_active = true
    AND (
      ec.normalized_name % lower(search_text) -- Operatore % usa trigram
      OR lower(search_text) ILIKE '%' || lower(ec.marca) || '%'
      OR lower(search_text) ILIKE '%' || lower(ec.modello) || '%'
      OR ec.aliases && ARRAY[lower(search_text)] -- Controlla aliases
    )
  ORDER BY sim_score DESC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Funzione per incrementare usage_count
CREATE OR REPLACE FUNCTION increment_equipment_usage(equipment_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE equipment_catalog
  SET usage_count = usage_count + 1
  WHERE id = equipment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Inserisci alcuni dati di esempio per testing
INSERT INTO equipment_catalog (tipo, marca, modello, aliases, specs) VALUES
  ('Compressore', 'Atlas Copco', 'GA 30', ARRAY['GA30', 'GA-30'], '{"potenza_kw": 30, "portata_m3_min": 5.5}'),
  ('Compressore', 'Kaeser', 'BSD 72', ARRAY['BSD72', 'BSD-72'], '{"potenza_kw": 55, "portata_m3_min": 10.2}'),
  ('Essiccatore', 'Atlas Copco', 'FX 12', ARRAY['FX12', 'FX-12'], '{"portata_m3_min": 2.0}'),
  ('Serbatoio', 'Kaeser', 'KB 500', ARRAY['KB500', 'KB-500'], '{"volume_litri": 500, "pressione_max_bar": 11}'),
  ('Compressore', 'Ingersoll Rand', 'UP6-15', ARRAY['UP615', 'UP6 15'], '{"potenza_kw": 15, "portata_m3_min": 2.8}')
ON CONFLICT (tipo, marca, modello) DO NOTHING;

-- Commenti
COMMENT ON TABLE equipment_catalog IS 'Catalogo normalizzato apparecchiature per matching OCR e validazione dati';
COMMENT ON COLUMN equipment_catalog.normalized_name IS 'Nome normalizzato generato automaticamente per ricerca fuzzy';
COMMENT ON COLUMN equipment_catalog.aliases IS 'Array di varianti/alias comuni per migliorare matching OCR';
COMMENT ON COLUMN equipment_catalog.specs IS 'Specifiche tecniche note in formato JSONB per pre-popolamento campi';
COMMENT ON COLUMN equipment_catalog.usage_count IS 'Numero di volte che questa apparecchiatura è stata matchata (statistiche)';
COMMENT ON FUNCTION search_equipment_fuzzy IS 'Ricerca fuzzy apparecchiature con similarity score (per OCR matching)';
COMMENT ON FUNCTION increment_equipment_usage IS 'Incrementa contatore utilizzo apparecchiatura';
