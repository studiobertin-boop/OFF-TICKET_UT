-- Migration: Numeric client codes on customers.identificativo
-- Date: 2026-07-04
-- Description:
--   Reconvert customers.identificativo from the CLI-XXXX text format to a canonical
--   zero-padded NUMERIC client code (min 3 digits: 001-999, natural 4+ from 1000).
--   - Preserve the real-world numbering (001-584 maintained in the Excel master).
--   - Auto-assign the next code ONLY to app-UI ("managed") creates, via the 'AUTO'
--     sentinel; bulk MAGO anagrafica / sync inserts (identificativo NULL) get no code.
--   - Add a derived STORED integer column for numeric uniqueness + ordering, and as the
--     integer base for the future practice-code scheme (CLIENTE<SALA?>_<progressivo>-<anno>).
--
-- Rationale: identificativo stays TEXT (the whole FE/scripts treat it as a string and the
-- zero-padding is a display requirement); codice_cliente_num is a pure function of it, not a
-- competing identifier. A fixed sequence (not MAX+1) sidesteps the CLI-9999 test row and is
-- concurrency-safe.

-- ============================================================================
-- STEP 1: Drop the old CLI-XXXX format constraint
-- ============================================================================

ALTER TABLE customers DROP CONSTRAINT IF EXISTS identificativo_format;

-- ============================================================================
-- STEP 2: Neutralize known test rows BEFORE conversion
-- (so they neither pollute the numeric space nor the next-code counter)
-- ============================================================================

--   CLI-9999 = 'CLIENTE TEST', CLI-0003 = 'pippo',
--   CLI-0010 = '000 cliente prova', CLI-0011 = '002 test'
UPDATE customers
SET identificativo = NULL
WHERE identificativo IN ('CLI-9999', 'CLI-0003', 'CLI-0010', 'CLI-0011');

-- ============================================================================
-- STEP 3: Convert remaining CLI-XXXX -> canonical numeric (min 3 digits)
-- ============================================================================

--   'CLI-0521' -> '521', 'CLI-0090' -> '090'
UPDATE customers
SET identificativo = LPAD((substring(identificativo FROM 5))::int::text, 3, '0')
WHERE identificativo ~ '^CLI-[0-9]{4}$';

-- ============================================================================
-- STEP 4: Derived integer column (numeric uniqueness / ordering / future base)
-- ============================================================================

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS codice_cliente_num integer
  GENERATED ALWAYS AS (NULLIF(identificativo, '')::integer) STORED;

CREATE UNIQUE INDEX IF NOT EXISTS ux_customers_codice_num
  ON customers (codice_cliente_num);  -- NULLs are distinct -> the ~22k code-less rows are fine

-- ============================================================================
-- STEP 5: New canonical numeric CHECK
-- ============================================================================

--   Accept NULL / '' (no code), '0NN' (000-099 padded to 3), or >=100 without leading zero.
--   Forbids sub-3-digit ('5') and over-padding ('0585') -> 1:1 text<->int mapping.
ALTER TABLE customers
  ADD CONSTRAINT identificativo_format
  CHECK (
    identificativo IS NULL
    OR identificativo = ''
    OR identificativo ~ '^(0[0-9]{2}|[1-9][0-9]{2,})$'
  );

COMMENT ON CONSTRAINT identificativo_format ON customers IS
  'Client code: NULL, empty, or canonical zero-padded numeric (min 3 digits, 4+ from 1000).';

-- ============================================================================
-- STEP 6: Reset the sequence so the next managed code is 585
-- ============================================================================

SELECT setval('customer_identificativo_seq', 584, true);  -- next nextval() = 585

-- ============================================================================
-- STEP 7: Rewrite the allocation trigger (sentinel-gated, managed-only)
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_customer_identificativo()
RETURNS TRIGGER AS $$
BEGIN
  -- Only the app-UI managed create path sends 'AUTO'. NULL/'' or an explicit code
  -- are left untouched, so bulk MAGO anagrafica / sync inserts get no code.
  IF NEW.identificativo = 'AUTO' THEN
    NEW.identificativo := LPAD(nextval('customer_identificativo_seq')::text, 3, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger binding unchanged (trigger_generate_customer_identificativo BEFORE INSERT).

-- ============================================================================
-- STEP 8: Refresh column documentation
-- ============================================================================

COMMENT ON COLUMN customers.identificativo IS
  'Client code: canonical zero-padded numeric (min 3 digits, 001-999, 4+ from 1000). Auto-assigned to app-UI (managed) creates only, via the AUTO sentinel.';
COMMENT ON COLUMN customers.codice_cliente_num IS
  'Derived integer form of identificativo (numeric uniqueness/sorting; integer base for the future practice-code scheme).';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
