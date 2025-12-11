-- ================================================
-- MIGRATION: Manufacturers Completeness Function
-- ================================================
-- Crea funzione per verificare completezza dati costruttore
-- Logica discriminata: controlla campi italiani O paese
-- ================================================

CREATE OR REPLACE FUNCTION check_manufacturer_completeness(
  manufacturer_id_param UUID
)
RETURNS JSONB AS $$
DECLARE
  manufacturer_record RECORD;
  missing_fields TEXT[] := ARRAY[]::TEXT[];
  is_complete BOOLEAN := true;
BEGIN
  -- Recupera il record del costruttore
  SELECT * INTO manufacturer_record
  FROM manufacturers
  WHERE id = manufacturer_id_param;

  -- Se non trovato, ritorna errore
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'error', 'Manufacturer not found',
      'is_complete', false,
      'missing_fields', ARRAY[]::TEXT[]
    );
  END IF;

  -- Verifica campi base sempre obbligatori
  IF manufacturer_record.nome IS NULL OR length(trim(manufacturer_record.nome)) = 0 THEN
    missing_fields := array_append(missing_fields, 'nome');
    is_complete := false;
  END IF;

  -- Logica discriminata basata su is_estero
  IF manufacturer_record.is_estero = false THEN
    -- ================================================
    -- COSTRUTTORE ITALIANO
    -- ================================================
    -- Verifica Partita IVA
    IF manufacturer_record.partita_iva IS NULL OR length(trim(manufacturer_record.partita_iva)) = 0 THEN
      missing_fields := array_append(missing_fields, 'partita_iva');
      is_complete := false;
    END IF;

    -- Verifica Telefono
    IF manufacturer_record.telefono IS NULL OR length(trim(manufacturer_record.telefono)) = 0 THEN
      missing_fields := array_append(missing_fields, 'telefono');
      is_complete := false;
    END IF;

    -- Verifica Via
    IF manufacturer_record.via IS NULL OR length(trim(manufacturer_record.via)) = 0 THEN
      missing_fields := array_append(missing_fields, 'via');
      is_complete := false;
    END IF;

    -- Verifica Numero Civico
    IF manufacturer_record.numero_civico IS NULL OR length(trim(manufacturer_record.numero_civico)) = 0 THEN
      missing_fields := array_append(missing_fields, 'numero_civico');
      is_complete := false;
    END IF;

    -- Verifica CAP
    IF manufacturer_record.cap IS NULL OR length(trim(manufacturer_record.cap)) = 0 THEN
      missing_fields := array_append(missing_fields, 'cap');
      is_complete := false;
    END IF;

    -- Verifica Comune
    IF manufacturer_record.comune IS NULL OR length(trim(manufacturer_record.comune)) = 0 THEN
      missing_fields := array_append(missing_fields, 'comune');
      is_complete := false;
    END IF;

    -- Verifica Provincia
    IF manufacturer_record.provincia IS NULL OR length(trim(manufacturer_record.provincia)) = 0 THEN
      missing_fields := array_append(missing_fields, 'provincia');
      is_complete := false;
    END IF;

  ELSE
    -- ================================================
    -- COSTRUTTORE ESTERO
    -- ================================================
    -- Verifica solo Paese
    IF manufacturer_record.paese IS NULL OR length(trim(manufacturer_record.paese)) = 0 THEN
      missing_fields := array_append(missing_fields, 'paese');
      is_complete := false;
    END IF;
  END IF;

  -- Ritorna risultato
  RETURN jsonb_build_object(
    'is_complete', is_complete,
    'missing_fields', missing_fields,
    'is_estero', manufacturer_record.is_estero
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================
-- PERMISSIONS
-- ================================================

-- Permetti a tutti gli utenti autenticati di chiamare la funzione
GRANT EXECUTE ON FUNCTION check_manufacturer_completeness(UUID) TO authenticated;

-- ================================================
-- COMMENTS
-- ================================================

COMMENT ON FUNCTION check_manufacturer_completeness(UUID) IS
'Verifica completezza dati costruttore con logica discriminata:
- Costruttori italiani (is_estero=false): richiede P.IVA, telefono, indirizzo completo
- Costruttori esteri (is_estero=true): richiede solo paese
Ritorna JSONB con is_complete (boolean) e missing_fields (array)';

-- ================================================
-- EXAMPLE USAGE
-- ================================================

-- SELECT check_manufacturer_completeness('uuid-del-costruttore');
-- Ritorna: {"is_complete": false, "missing_fields": ["partita_iva", "telefono"], "is_estero": false}
