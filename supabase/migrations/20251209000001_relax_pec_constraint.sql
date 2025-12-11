-- Migration: Relax PEC constraint to accept more common domains
-- Description: Updates PEC validation to accept .pec.it, .legalmail.it, and other common PEC domains like arubapec.it

-- Drop existing PEC constraint
ALTER TABLE customers DROP CONSTRAINT IF EXISTS pec_format;

-- Add relaxed PEC constraint that accepts common Italian PEC domains
ALTER TABLE customers
  ADD CONSTRAINT pec_format
  CHECK (
    pec IS NULL OR
    pec ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.(pec\.it|legalmail\.it|arubapec\.it|postacert\.it|sicurezzapostale\.it|cert\.agenziaentrate\.it)$'
  );

COMMENT ON CONSTRAINT pec_format ON customers IS 'PEC must be a valid email with common Italian certified email domains';
