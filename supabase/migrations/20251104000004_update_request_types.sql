-- Migration: Update request types configuration
-- Date: 2025-11-04
-- Description:
--   1. Make 'lista_apparecchi' field optional in 'ANALISI – DS500 CONSUMI' form
--   2. Deactivate 'Supporto IT' and 'Richiesta Manutenzione' request types

-- =============================================================================
-- 1. Update ANALISI – DS500 CONSUMI: Make lista_apparecchi optional
-- =============================================================================
UPDATE request_types
SET fields_schema = jsonb_set(
  fields_schema,
  '{3,required}',
  'false'::jsonb
)
WHERE name = 'ANALISI – DS500 CONSUMI'
  AND fields_schema->3->>'name' = 'lista_apparecchi';

-- =============================================================================
-- 2. Deactivate 'Supporto IT' request type
-- =============================================================================
UPDATE request_types
SET is_active = false
WHERE name = 'Supporto IT';

-- =============================================================================
-- 3. Deactivate 'Richiesta Manutenzione' request type
-- =============================================================================
UPDATE request_types
SET is_active = false
WHERE name = 'Richiesta Manutenzione';
