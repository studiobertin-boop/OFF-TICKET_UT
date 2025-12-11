-- Migration: Create installer completeness check function
-- Description: Database function to verify installer data completeness

-- ================================================
-- INSTALLER COMPLETENESS CHECK FUNCTION
-- ================================================

CREATE OR REPLACE FUNCTION check_installer_completeness(
  installer_id_param UUID
)
RETURNS JSONB AS $$
DECLARE
  installer_record RECORD;
  missing_fields TEXT[] := ARRAY[]::TEXT[];
  is_complete BOOLEAN := true;
BEGIN
  -- Fetch installer record
  SELECT * INTO installer_record
  FROM installers
  WHERE id = installer_id_param;

  -- If installer not found, return error
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'error', 'Installatore non trovato',
      'is_complete', false,
      'missing_fields', ARRAY[]::TEXT[]
    );
  END IF;

  -- Check nome
  IF installer_record.nome IS NULL OR length(trim(installer_record.nome)) = 0 THEN
    missing_fields := array_append(missing_fields, 'nome');
    is_complete := false;
  END IF;

  -- Check partita_iva
  IF installer_record.partita_iva IS NULL OR length(trim(installer_record.partita_iva)) = 0 THEN
    missing_fields := array_append(missing_fields, 'partita_iva');
    is_complete := false;
  END IF;

  -- Check via
  IF installer_record.via IS NULL OR length(trim(installer_record.via)) = 0 THEN
    missing_fields := array_append(missing_fields, 'via');
    is_complete := false;
  END IF;

  -- Check numero_civico
  IF installer_record.numero_civico IS NULL OR length(trim(installer_record.numero_civico)) = 0 THEN
    missing_fields := array_append(missing_fields, 'numero_civico');
    is_complete := false;
  END IF;

  -- Check cap
  IF installer_record.cap IS NULL OR length(trim(installer_record.cap)) = 0 THEN
    missing_fields := array_append(missing_fields, 'cap');
    is_complete := false;
  END IF;

  -- Check comune
  IF installer_record.comune IS NULL OR length(trim(installer_record.comune)) = 0 THEN
    missing_fields := array_append(missing_fields, 'comune');
    is_complete := false;
  END IF;

  -- Check provincia
  IF installer_record.provincia IS NULL OR length(trim(installer_record.provincia)) = 0 THEN
    missing_fields := array_append(missing_fields, 'provincia');
    is_complete := false;
  END IF;

  -- Return result
  RETURN jsonb_build_object(
    'is_complete', is_complete,
    'missing_fields', missing_fields
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION check_installer_completeness(UUID) TO authenticated;

-- Comment
COMMENT ON FUNCTION check_installer_completeness IS 'Checks if an installer has all required fields populated';
