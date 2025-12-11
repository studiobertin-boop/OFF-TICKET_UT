-- Migration: Seed initial installer data
-- Description: Populates installers table with OFFICINA DEL COMPRESSORE S.R.L.

-- ================================================
-- INSERT INITIAL INSTALLER
-- ================================================

INSERT INTO installers (
  nome,
  partita_iva,
  via,
  numero_civico,
  cap,
  comune,
  provincia,
  is_active,
  usage_count
) VALUES (
  'OFFICINA DEL COMPRESSORE S.R.L.',
  '03166570261',
  'Via G. Di Vittorio',
  '11',
  '31038',
  'Paese',
  'TV',
  true,
  0
)
ON CONFLICT (nome) DO NOTHING;

-- ================================================
-- VERIFICATION
-- ================================================

-- Verify the installer was inserted
DO $$
DECLARE
  installer_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO installer_count
  FROM installers
  WHERE nome = 'OFFICINA DEL COMPRESSORE S.R.L.';

  IF installer_count > 0 THEN
    RAISE NOTICE 'Initial installer created successfully: OFFICINA DEL COMPRESSORE S.R.L.';
  ELSE
    RAISE WARNING 'Initial installer not found after insert';
  END IF;
END $$;
