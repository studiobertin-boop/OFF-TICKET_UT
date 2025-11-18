-- ============================================================================
-- FIX RECURSION IN dm329_technical_data RLS POLICIES
-- ============================================================================
-- Problema: Le policy per tecnicoDM329 causano recursione infinita perché
-- fanno JOIN con la tabella requests all'interno della policy stessa
--
-- Soluzione: Sostituire il JOIN con una subquery diretta che evita la recursione
-- usando direttamente la colonna request_id
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Drop existing problematic policies for tecnicoDM329
-- ============================================================================

DROP POLICY IF EXISTS "tecnicoDM329 can view assigned technical data" ON dm329_technical_data;
DROP POLICY IF EXISTS "tecnicoDM329 can update assigned technical data" ON dm329_technical_data;

-- ============================================================================
-- STEP 2: Create new policies without recursion
-- ============================================================================

-- Policy: tecnicoDM329 can view technical data for requests assigned to them
-- FIX: Usa subquery diretta invece di JOIN per evitare recursione
CREATE POLICY "tecnicoDM329 can view assigned technical data"
  ON dm329_technical_data
  FOR SELECT
  TO authenticated
  USING (
    -- Verifica che l'utente sia tecnicoDM329
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'tecnicoDM329'
    )
    AND
    -- Verifica che la richiesta sia assegnata all'utente corrente
    -- Usa subquery diretta senza JOIN per evitare recursione
    dm329_technical_data.request_id IN (
      SELECT id FROM requests
      WHERE assigned_to = auth.uid()
    )
  );

-- Policy: tecnicoDM329 can update technical data for requests assigned to them
-- FIX: Usa subquery diretta invece di JOIN per evitare recursione
CREATE POLICY "tecnicoDM329 can update assigned technical data"
  ON dm329_technical_data
  FOR UPDATE
  TO authenticated
  USING (
    -- Verifica che l'utente sia tecnicoDM329
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'tecnicoDM329'
    )
    AND
    -- Verifica che la richiesta sia assegnata all'utente corrente
    dm329_technical_data.request_id IN (
      SELECT id FROM requests
      WHERE assigned_to = auth.uid()
    )
  )
  WITH CHECK (
    -- Verifica che l'utente sia tecnicoDM329
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'tecnicoDM329'
    )
    AND
    -- Verifica che la richiesta sia assegnata all'utente corrente
    dm329_technical_data.request_id IN (
      SELECT id FROM requests
      WHERE assigned_to = auth.uid()
    )
  );

COMMIT;

-- ============================================================================
-- STEP 3: Verify policies
-- ============================================================================

-- List all policies on dm329_technical_data
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'dm329_technical_data'
ORDER BY policyname;
