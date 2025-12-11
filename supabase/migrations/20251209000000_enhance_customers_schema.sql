-- Migration: Enhance customers table with complete address and contact info
-- Description: Adds mandatory fields (telefono, PEC, descrizione_attivita, identificativo, address)
--              and implements auto-generation for identificativo with validation constraints

-- ============================================================================
-- STEP 1: Rename existing column for consistency
-- ============================================================================

-- Rename 'citta' to 'comune' for terminology consistency
ALTER TABLE customers RENAME COLUMN citta TO comune;

-- ============================================================================
-- STEP 2: Add new columns
-- ============================================================================

ALTER TABLE customers
  -- Identificativo auto-generated (unique, modifiable)
  ADD COLUMN identificativo TEXT UNIQUE,

  -- Contact information
  ADD COLUMN telefono TEXT,
  ADD COLUMN pec TEXT,

  -- Business description
  ADD COLUMN descrizione_attivita TEXT,

  -- Complete address (numero_civico is new, others already exist)
  ADD COLUMN numero_civico TEXT;

-- Note: via, cap, comune (ex-citta), provincia already exist but are currently nullable

-- ============================================================================
-- STEP 3: Create sequence for identificativo auto-generation
-- ============================================================================

CREATE SEQUENCE IF NOT EXISTS customer_identificativo_seq START 1;

-- ============================================================================
-- STEP 4: Clean existing data before adding constraints
-- ============================================================================

-- Clean CAP: remove non-digits, pad to 5 digits, or set NULL if invalid
UPDATE customers
SET cap =
  CASE
    WHEN cap IS NULL THEN NULL
    WHEN regexp_replace(cap, '[^0-9]', '', 'g') = '' THEN NULL
    WHEN length(regexp_replace(cap, '[^0-9]', '', 'g')) <= 5 THEN
      LPAD(regexp_replace(cap, '[^0-9]', '', 'g'), 5, '0')
    ELSE NULL
  END
WHERE cap IS NOT NULL
  AND (cap !~ '^[0-9]{5}$' OR length(cap) != 5);

-- Clean Provincia: uppercase and trim, set NULL if not exactly 2 letters
UPDATE customers
SET provincia =
  CASE
    WHEN provincia IS NULL THEN NULL
    -- Remove all non-letter characters, uppercase, then validate length
    WHEN length(regexp_replace(upper(trim(provincia)), '[^A-Z]', '', 'g')) = 2 THEN
      regexp_replace(upper(trim(provincia)), '[^A-Z]', '', 'g')
    ELSE NULL
  END
WHERE provincia IS NOT NULL;

-- Clean Via: set NULL if empty or only whitespace
UPDATE customers
SET via = NULL
WHERE via IS NOT NULL
  AND length(trim(via)) = 0;

-- Clean Numero Civico: set NULL if empty or only whitespace
UPDATE customers
SET numero_civico = NULL
WHERE numero_civico IS NOT NULL
  AND length(trim(numero_civico)) = 0;

-- Clean Comune: set NULL if empty or only whitespace
UPDATE customers
SET comune = NULL
WHERE comune IS NOT NULL
  AND length(trim(comune)) = 0;

-- Clean Telefono: set NULL if empty or only whitespace
UPDATE customers
SET telefono = NULL
WHERE telefono IS NOT NULL
  AND length(trim(telefono)) = 0;

-- Clean PEC: set NULL if empty or only whitespace
UPDATE customers
SET pec = NULL
WHERE pec IS NOT NULL
  AND length(trim(pec)) = 0;

-- Clean Descrizione Attivita: set NULL if empty or only whitespace
UPDATE customers
SET descrizione_attivita = NULL
WHERE descrizione_attivita IS NOT NULL
  AND length(trim(descrizione_attivita)) = 0;

-- ============================================================================
-- STEP 5: Add validation constraints
-- ============================================================================

-- Identificativo format: CLI-XXXX (4 digits)
ALTER TABLE customers
  ADD CONSTRAINT identificativo_format
  CHECK (identificativo IS NULL OR identificativo ~ '^CLI-[0-9]{4}$');

-- Telefono: Italian phone format (permissive: +39, 0039, or direct)
ALTER TABLE customers
  ADD CONSTRAINT telefono_not_empty
  CHECK (telefono IS NULL OR length(trim(telefono)) > 0);

ALTER TABLE customers
  ADD CONSTRAINT telefono_format
  CHECK (telefono IS NULL OR telefono ~ '^(\+39|0039)?[\s\-\(\)]?[0-9]{2,4}[\s\-\(\)]?[0-9]{6,9}$');

-- PEC: valid email ending with .pec.it or .legalmail.it
ALTER TABLE customers
  ADD CONSTRAINT pec_not_empty
  CHECK (pec IS NULL OR length(trim(pec)) > 0);

ALTER TABLE customers
  ADD CONSTRAINT pec_format
  CHECK (pec IS NULL OR pec ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.(pec\.it|legalmail\.it)$');

-- CAP: exactly 5 digits
ALTER TABLE customers
  ADD CONSTRAINT cap_format
  CHECK (cap IS NULL OR cap ~ '^[0-9]{5}$');

-- Provincia: exactly 2 uppercase letters
ALTER TABLE customers
  ADD CONSTRAINT provincia_format
  CHECK (provincia IS NULL OR provincia ~ '^[A-Z]{2}$');

-- Descrizione attivita: not empty if present
ALTER TABLE customers
  ADD CONSTRAINT descrizione_attivita_not_empty
  CHECK (descrizione_attivita IS NULL OR length(trim(descrizione_attivita)) > 0);

-- Via: not empty if present
ALTER TABLE customers
  ADD CONSTRAINT via_not_empty
  CHECK (via IS NULL OR length(trim(via)) > 0);

-- Numero civico: not empty if present
ALTER TABLE customers
  ADD CONSTRAINT numero_civico_not_empty
  CHECK (numero_civico IS NULL OR length(trim(numero_civico)) > 0);

-- Comune: not empty if present
ALTER TABLE customers
  ADD CONSTRAINT comune_not_empty
  CHECK (comune IS NULL OR length(trim(comune)) > 0);

-- ============================================================================
-- STEP 6: Create trigger for auto-generation of identificativo
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_customer_identificativo()
RETURNS TRIGGER AS $$
BEGIN
  -- Only generate if identificativo is NULL
  IF NEW.identificativo IS NULL THEN
    NEW.identificativo := 'CLI-' || LPAD(nextval('customer_identificativo_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_customer_identificativo
  BEFORE INSERT ON customers
  FOR EACH ROW
  EXECUTE FUNCTION generate_customer_identificativo();

-- ============================================================================
-- STEP 7: Initialize sequence with existing max identificativo (if any)
-- ============================================================================

-- Set sequence to max existing identificativo to avoid duplicates
-- Only set if there are existing identificativos, otherwise leave at default (1)
DO $$
DECLARE
  max_id INTEGER;
BEGIN
  SELECT MAX(CAST(SUBSTRING(identificativo FROM 5) AS INTEGER))
  INTO max_id
  FROM customers
  WHERE identificativo IS NOT NULL AND identificativo ~ '^CLI-[0-9]{4}$';

  IF max_id IS NOT NULL THEN
    PERFORM setval('customer_identificativo_seq', max_id);
  END IF;
END $$;

-- ============================================================================
-- STEP 8: Create indexes for performance
-- ============================================================================

-- Identificativo is already indexed via UNIQUE constraint

-- Partial indexes for optional fields
CREATE INDEX idx_customers_telefono ON customers(telefono) WHERE telefono IS NOT NULL;
CREATE INDEX idx_customers_pec ON customers(pec) WHERE pec IS NOT NULL;
CREATE INDEX idx_customers_comune ON customers(comune) WHERE comune IS NOT NULL;

-- ============================================================================
-- STEP 9: Update RLS policies for DM329 users
-- ============================================================================

-- Drop existing update policy
DROP POLICY IF EXISTS "Admin can update customers" ON customers;

-- Create new policy allowing admin AND userdm329 to update
CREATE POLICY "Admin and DM329 users can update customers"
  ON customers
  FOR UPDATE
  USING (get_user_role() IN ('admin', 'userdm329'))
  WITH CHECK (get_user_role() IN ('admin', 'userdm329'));

-- ============================================================================
-- STEP 10: Create helper function to check customer completeness
-- ============================================================================

CREATE OR REPLACE FUNCTION is_customer_complete(customer_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  customer_record RECORD;
BEGIN
  -- Fetch customer record
  SELECT * INTO customer_record
  FROM customers
  WHERE id = customer_id;

  -- If not found, return false
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Check all required fields are populated
  RETURN (
    customer_record.ragione_sociale IS NOT NULL
    AND length(trim(customer_record.ragione_sociale)) > 0
    AND customer_record.identificativo IS NOT NULL
    AND length(trim(customer_record.identificativo)) > 0
    AND customer_record.telefono IS NOT NULL
    AND length(trim(customer_record.telefono)) > 0
    AND customer_record.pec IS NOT NULL
    AND length(trim(customer_record.pec)) > 0
    AND customer_record.descrizione_attivita IS NOT NULL
    AND length(trim(customer_record.descrizione_attivita)) > 0
    AND customer_record.via IS NOT NULL
    AND length(trim(customer_record.via)) > 0
    AND customer_record.numero_civico IS NOT NULL
    AND length(trim(customer_record.numero_civico)) > 0
    AND customer_record.cap IS NOT NULL
    AND length(trim(customer_record.cap)) > 0
    AND customer_record.comune IS NOT NULL
    AND length(trim(customer_record.comune)) > 0
    AND customer_record.provincia IS NOT NULL
    AND length(trim(customer_record.provincia)) > 0
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION is_customer_complete(UUID) TO authenticated;

-- ============================================================================
-- STEP 11: Add column comments for documentation
-- ============================================================================

COMMENT ON COLUMN customers.identificativo IS 'Auto-generated unique identifier (format: CLI-XXXX), modifiable after creation';
COMMENT ON COLUMN customers.telefono IS 'Customer phone number (Italian format: +39 XXX XXXXXXX or similar)';
COMMENT ON COLUMN customers.pec IS 'Certified email address (PEC), must end with .pec.it or .legalmail.it';
COMMENT ON COLUMN customers.descrizione_attivita IS 'Description of customer business activity';
COMMENT ON COLUMN customers.numero_civico IS 'Street number for legal address';
COMMENT ON COLUMN customers.comune IS 'Municipality/city name (renamed from citta for consistency)';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Summary:
-- ✓ Renamed 'citta' → 'comune'
-- ✓ Added: identificativo, telefono, pec, descrizione_attivita, numero_civico
-- ✓ Created sequence and trigger for identificativo auto-generation
-- ✓ Added validation constraints (format checks only if NOT NULL for backward compatibility)
-- ✓ Created indexes for performance
-- ✓ Updated RLS policy to allow userdm329 role to update customers
-- ✓ Created is_customer_complete() helper function
-- ✓ Added documentation comments
