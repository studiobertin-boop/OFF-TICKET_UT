-- Migration: Relax customer constraints (creation form)
-- Date: 2026-07-03
-- Description:
--   Solo `ragione_sociale` è obbligatoria. Tutti gli altri campi sono facoltativi.
--   - telefono: nessun vincolo di formato
--   - pec: facoltativa; se presente deve essere un'email valida (@ + dominio con punto),
--          nessun vincolo sui domini certificati (.pec.it, .legalmail.it, ...)
--   - cap: facoltativo; se presente deve essere di 5 cifre (tollera stringa vuota)
-- Idempotente: usa DROP CONSTRAINT IF EXISTS prima di ricreare.

-- ============================================================================
-- TELEFONO: rimuovi ogni vincolo
-- ============================================================================
ALTER TABLE customers DROP CONSTRAINT IF EXISTS telefono_not_empty;
ALTER TABLE customers DROP CONSTRAINT IF EXISTS telefono_format;

-- ============================================================================
-- PEC: facoltativa, solo formato email valido
-- ============================================================================
ALTER TABLE customers DROP CONSTRAINT IF EXISTS pec_not_empty;
ALTER TABLE customers DROP CONSTRAINT IF EXISTS pec_format;

ALTER TABLE customers
  ADD CONSTRAINT pec_format
  CHECK (
    pec IS NULL OR
    pec ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  );

COMMENT ON CONSTRAINT pec_format ON customers IS
'PEC facoltativa. Se presente, deve essere un''email valida (@ + dominio con punto).';

-- ============================================================================
-- CAP: facoltativo, 5 cifre quando presente (tollera stringa vuota)
-- ============================================================================
ALTER TABLE customers DROP CONSTRAINT IF EXISTS cap_format;

ALTER TABLE customers
  ADD CONSTRAINT cap_format
  CHECK (
    cap IS NULL OR
    cap = '' OR
    cap ~ '^[0-9]{5}$'
  );

COMMENT ON CONSTRAINT cap_format ON customers IS
'CAP facoltativo. Se presente, deve essere di 5 cifre.';
