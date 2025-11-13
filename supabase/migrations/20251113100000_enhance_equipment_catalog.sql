-- Migration: Enhance equipment_catalog con tipo_apparecchiatura e supporto filtri cascata
-- Descrizione: Aggiunge enum per tipologie strutturate, campo user_defined, indici per performance

-- 1. Crea ENUM per tipologie apparecchiature
CREATE TYPE equipment_catalog_type AS ENUM (
  'Serbatoi',
  'Compressori',
  'Disoleatori',
  'Essiccatori',
  'Scambiatori',
  'Filtri',
  'Separatori',
  'Valvole di sicurezza',
  'Altro'
);

-- 2. Aggiungi colonne alla tabella equipment_catalog
ALTER TABLE equipment_catalog
ADD COLUMN IF NOT EXISTS tipo_apparecchiatura equipment_catalog_type,
ADD COLUMN IF NOT EXISTS is_user_defined BOOLEAN DEFAULT false NOT NULL,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- 3. Crea indici per performance filtri cascata
CREATE INDEX IF NOT EXISTS idx_equipment_tipo_marca
ON equipment_catalog(tipo_apparecchiatura, marca)
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_equipment_tipo_marca_modello
ON equipment_catalog(tipo_apparecchiatura, marca, modello)
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_equipment_user_defined
ON equipment_catalog(is_user_defined, created_at DESC);

-- 4. Funzione per ottenere marche filtrate per tipo
CREATE OR REPLACE FUNCTION get_marche_by_tipo(tipo equipment_catalog_type)
RETURNS TABLE(marca TEXT, count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ec.marca, COUNT(*)::BIGINT as count
  FROM equipment_catalog ec
  WHERE ec.tipo_apparecchiatura = tipo
    AND ec.is_active = true
    AND ec.marca IS NOT NULL
    AND ec.marca != ''
  GROUP BY ec.marca
  ORDER BY count DESC, ec.marca ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Funzione per ottenere modelli filtrati per tipo + marca
CREATE OR REPLACE FUNCTION get_modelli_by_tipo_marca(
  tipo equipment_catalog_type,
  marca_filter TEXT
)
RETURNS TABLE(modello TEXT, usage_count INTEGER) AS $$
BEGIN
  RETURN QUERY
  SELECT ec.modello, ec.usage_count
  FROM equipment_catalog ec
  WHERE ec.tipo_apparecchiatura = tipo
    AND ec.marca = marca_filter
    AND ec.is_active = true
    AND ec.modello IS NOT NULL
    AND ec.modello != ''
  ORDER BY ec.usage_count DESC, ec.modello ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Funzione per aggiungere apparecchiatura al catalogo
CREATE OR REPLACE FUNCTION add_equipment_to_catalog(
  p_tipo equipment_catalog_type,
  p_marca TEXT,
  p_modello TEXT,
  p_user_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_equipment_id UUID;
  v_existing_id UUID;
BEGIN
  -- Verifica se esiste già
  SELECT id INTO v_existing_id
  FROM equipment_catalog
  WHERE tipo_apparecchiatura = p_tipo
    AND marca = p_marca
    AND modello = p_modello;

  IF v_existing_id IS NOT NULL THEN
    -- Se esiste già, incrementa usage_count
    UPDATE equipment_catalog
    SET usage_count = usage_count + 1,
        updated_at = NOW()
    WHERE id = v_existing_id;

    RETURN v_existing_id;
  ELSE
    -- Altrimenti inserisci nuovo
    INSERT INTO equipment_catalog (
      tipo,
      tipo_apparecchiatura,
      marca,
      modello,
      is_active,
      is_user_defined,
      usage_count,
      created_by
    ) VALUES (
      p_tipo::TEXT, -- Legacy field
      p_tipo,
      p_marca,
      p_modello,
      true,
      true, -- Marcato come aggiunto dall'utente
      1,
      p_user_id
    )
    RETURNING id INTO v_equipment_id;

    RETURN v_equipment_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Aggiorna funzione fuzzy search per supportare tipo_apparecchiatura
CREATE OR REPLACE FUNCTION search_equipment_fuzzy(
  search_term TEXT,
  equipment_type_filter equipment_catalog_type DEFAULT NULL,
  limit_results INTEGER DEFAULT 10
)
RETURNS TABLE(
  id UUID,
  tipo TEXT,
  tipo_apparecchiatura equipment_catalog_type,
  marca TEXT,
  modello TEXT,
  similarity_score REAL,
  usage_count INTEGER,
  last_used TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ec.id,
    ec.tipo,
    ec.tipo_apparecchiatura,
    ec.marca,
    ec.modello,
    GREATEST(
      similarity(ec.marca, search_term),
      similarity(ec.modello, search_term),
      similarity(ec.marca || ' ' || ec.modello, search_term)
    ) as similarity_score,
    ec.usage_count,
    ec.updated_at as last_used
  FROM equipment_catalog ec
  WHERE ec.is_active = true
    AND (equipment_type_filter IS NULL OR ec.tipo_apparecchiatura = equipment_type_filter)
    AND (
      ec.marca % search_term OR
      ec.modello % search_term OR
      (ec.marca || ' ' || ec.modello) % search_term
    )
  ORDER BY
    similarity_score DESC,
    ec.usage_count DESC,
    ec.updated_at DESC
  LIMIT limit_results;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Grant permessi
GRANT EXECUTE ON FUNCTION get_marche_by_tipo(equipment_catalog_type) TO authenticated;
GRANT EXECUTE ON FUNCTION get_modelli_by_tipo_marca(equipment_catalog_type, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION add_equipment_to_catalog(equipment_catalog_type, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION search_equipment_fuzzy(TEXT, equipment_catalog_type, INTEGER) TO authenticated;

-- 9. Commenti
COMMENT ON COLUMN equipment_catalog.tipo_apparecchiatura IS 'Tipologia strutturata per filtri cascata';
COMMENT ON COLUMN equipment_catalog.is_user_defined IS 'true se aggiunto manualmente dall''utente, false se da import iniziale';
COMMENT ON FUNCTION get_marche_by_tipo IS 'Restituisce marche uniche per una tipologia, ordinate per usage_count';
COMMENT ON FUNCTION get_modelli_by_tipo_marca IS 'Restituisce modelli per tipo+marca, ordinati per popolarità';
COMMENT ON FUNCTION add_equipment_to_catalog IS 'Aggiunge nuova associazione al catalogo o incrementa usage_count se esiste';
