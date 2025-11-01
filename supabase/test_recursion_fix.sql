-- =============================================
-- DIAGNOSTICA: Test Ricorsione RLS Policies
-- =============================================
-- Questo script ti aiuta a verificare se la ricorsione è stata risolta
--
-- COME USARE:
-- 1. Copia questo SQL nel SQL Editor di Supabase
-- 2. Esegui PRIMA di applicare la fix per vedere l'errore
-- 3. Applica la migration 20250101000002_fix_rls_recursion.sql
-- 4. Esegui di nuovo per verificare che tutto funzioni
-- =============================================

-- =============================================
-- STEP 1: Verifica stato attuale delle policy
-- =============================================
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
WHERE tablename = 'requests'
ORDER BY policyname;

-- =============================================
-- STEP 2: Verifica funzione get_user_role
-- =============================================
SELECT 
  proname AS function_name,
  provolatile AS volatility,
  CASE provolatile
    WHEN 'i' THEN 'IMMUTABLE (cached)'
    WHEN 's' THEN 'STABLE (cached in transaction)'
    WHEN 'v' THEN 'VOLATILE (not cached - SLOW!)'
  END AS volatility_desc,
  prosecdef AS is_security_definer
FROM pg_proc
WHERE proname = 'get_user_role';

-- =============================================
-- STEP 3: Verifica trigger di validazione
-- =============================================
SELECT 
  tgname AS trigger_name,
  tgtype,
  tgenabled,
  proname AS function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgrelid = 'requests'::regclass
  AND tgname LIKE '%validate%';

-- =============================================
-- STEP 4: Test cambio stato (DEVE FUNZIONARE)
-- =============================================
-- Nota: sostituisci 'request-id' con un ID reale dal tuo database

-- Prima, ottieni un ID valido:
DO $$
DECLARE
  test_request_id UUID;
BEGIN
  -- Prendi la prima richiesta disponibile
  SELECT id INTO test_request_id 
  FROM requests 
  LIMIT 1;
  
  IF test_request_id IS NULL THEN
    RAISE NOTICE 'Nessuna richiesta trovata. Crea prima alcune richieste.';
  ELSE
    RAISE NOTICE 'Testing con request ID: %', test_request_id;
    
    -- Test validazione (dovrebbe funzionare)
    DECLARE
      validation_result RECORD;
    BEGIN
      SELECT * INTO validation_result
      FROM validate_status_transition(
        test_request_id,
        'IN_LAVORAZIONE',
        'admin'::user_role,
        NULL
      );
      
      RAISE NOTICE 'Validazione: valid=%, message=%', 
        validation_result.valid, 
        validation_result.message;
    END;
  END IF;
END $$;

-- =============================================
-- STEP 5: Test UPDATE diretto (può causare ricorsione se non fixato)
-- =============================================
-- ATTENZIONE: Questo test può causare errore se la fix non è applicata
-- Se vedi "infinite recursion detected", la fix è necessaria

-- Test 1: Update semplice
DO $$
DECLARE
  test_request_id UUID;
  original_status TEXT;
BEGIN
  -- Prendi una richiesta
  SELECT id, status INTO test_request_id, original_status
  FROM requests 
  WHERE status != 'COMPLETATA'
  LIMIT 1;
  
  IF test_request_id IS NOT NULL THEN
    BEGIN
      -- Prova l'update
      UPDATE requests 
      SET status = original_status  -- Stesso stato, solo per testare
      WHERE id = test_request_id;
      
      RAISE NOTICE 'UPDATE test SUCCESSO - Nessuna ricorsione!';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'UPDATE test FALLITO - Errore: %', SQLERRM;
      IF SQLERRM LIKE '%infinite recursion%' THEN
        RAISE NOTICE 'TROVATO IL BUG: Ricorsione infinita nelle policy RLS!';
        RAISE NOTICE 'SOLUZIONE: Applica migration 20250101000002_fix_rls_recursion.sql';
      END IF;
    END;
  END IF;
END $$;

-- =============================================
-- STEP 6: Report finale
-- =============================================
SELECT 
  'RLS Policy Check' AS test_type,
  COUNT(*) AS total_policies,
  COUNT(*) FILTER (WHERE with_check LIKE '%SELECT%FROM%requests%') AS potentially_recursive
FROM pg_policies
WHERE tablename = 'requests'
  AND cmd = 'UPDATE';

-- =============================================
-- RISULTATI ATTESI
-- =============================================
-- PRIMA della fix:
-- - get_user_role: volatility = 'v' (VOLATILE - slow!)
-- - Nessun trigger validate_utente_request_update
-- - UPDATE test FALLITO con "infinite recursion"
-- - potentially_recursive >= 1
--
-- DOPO la fix:
-- - get_user_role: volatility = 's' (STABLE - cached!)
-- - Trigger validate_utente_request_update presente
-- - UPDATE test SUCCESSO
-- - potentially_recursive = 0

