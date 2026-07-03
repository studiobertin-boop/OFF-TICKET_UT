-- Migration: Fix customer validation constraints
-- Date: 2026-01-05
-- Description:
--   1. Fix identificativo_format to allow empty strings (for auto-generation)
--   2. Fix pec_format to accept all valid PEC domains (not just .pec.it and .legalmail.it)

-- ============================================================================
-- DIAGNOSTIC: Check which PEC values would fail the new constraint
-- ============================================================================
-- Run this query manually to see problematic values:
-- SELECT id, ragione_sociale, pec
-- FROM customers
-- WHERE pec IS NOT NULL
--   AND pec !~* '^[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+\.)?(pec\.it|legalmail\.it|arubapec\.it|postacert\.it|sicurezzapostale\.it|cert\.agenziaentrate\.it)$';

-- ============================================================================
-- 1. Fix identificativo constraint
-- ============================================================================

-- Drop old constraint
ALTER TABLE customers
DROP CONSTRAINT IF EXISTS identificativo_format;

-- Add new constraint that allows NULL, empty string, or valid CLI-XXXX format
ALTER TABLE customers
ADD CONSTRAINT identificativo_format
CHECK (
  identificativo IS NULL OR
  identificativo = '' OR
  identificativo ~ '^CLI-[0-9]{4}$'
);

COMMENT ON CONSTRAINT identificativo_format ON customers IS
'Identificativo must be NULL, empty string (auto-generated), or CLI-XXXX format';

-- ============================================================================
-- 2. Fix PEC constraint (more permissive to accept existing data)
-- ============================================================================

-- Drop old constraint
ALTER TABLE customers
DROP CONSTRAINT IF EXISTS pec_format;

-- Add new constraint that accepts:
-- - Common PEC domains (with or without subdomain)
-- - Any other email format (to avoid blocking existing valid PEC addresses)
ALTER TABLE customers
ADD CONSTRAINT pec_format
CHECK (
  pec IS NULL OR
  -- Must be a valid email format (basic check)
  pec ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
);

COMMENT ON CONSTRAINT pec_format ON customers IS
'PEC must be a valid email format. Accepts any valid email to support various PEC providers.';
