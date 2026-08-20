-- Migration: Add telefono column to installers table
-- Description: Adds telefono (phone number) field to installers table
--              Already applied to production DB manually

ALTER TABLE installers
ADD COLUMN IF NOT EXISTS telefono TEXT;

-- Set telefono for OFFICINA DEL COMPRESSORE
UPDATE installers
SET telefono = '0422.959607'
WHERE nome = 'OFFICINA DEL COMPRESSORE S.R.L.';

COMMENT ON COLUMN installers.telefono IS 'Installer phone number';
