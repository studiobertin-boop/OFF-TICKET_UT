-- ====================================================================
-- TEST: Verifica funzione get_dm329_transition_times
-- ====================================================================

-- Test 1: Chiamata diretta alla funzione (senza filtri)
SELECT
  'TEST 1 - Chiamata diretta (no filtri):' as test,
  *
FROM get_dm329_transition_times(NULL, NULL);

-- Test 2: Verifica che esistano transizioni nel database
SELECT
  'TEST 2 - Conta transizioni dirette per tipo:' as test,
  COUNT(*) as total_transitions,
  COUNT(DISTINCT h1.request_id) as unique_requests
FROM request_history h1
INNER JOIN request_history h2 ON h2.request_id = h1.request_id
  AND h2.created_at > h1.created_at
INNER JOIN requests r ON h1.request_id = r.id
INNER JOIN request_types rt ON r.request_type_id = rt.id
WHERE rt.name = 'DM329'
  AND h1.status_to IN (
    '1-INCARICO_RICEVUTO',
    '2-SCHEDA_DATI_PRONTA',
    '3-MAIL_CLIENTE_INVIATA',
    '4-DOCUMENTI_PRONTI',
    '5-ATTESA_FIRMA',
    '6-PRONTA_PER_CIVA'
  )
  AND NOT EXISTS (
    SELECT 1 FROM request_history h3
    WHERE h3.request_id = h1.request_id
    AND h3.created_at > h1.created_at
    AND h3.created_at < h2.created_at
  );

-- Test 3: Conta transizioni per ciascun tipo specifico
SELECT
  'TEST 3 - Transizioni 1→2:' as test,
  COUNT(*) as count
FROM request_history h1
INNER JOIN request_history h2 ON h2.request_id = h1.request_id
INNER JOIN requests r ON h1.request_id = r.id
INNER JOIN request_types rt ON r.request_type_id = rt.id
WHERE rt.name = 'DM329'
  AND h1.status_to = '1-INCARICO_RICEVUTO'
  AND h2.status_to = '2-SCHEDA_DATI_PRONTA'
  AND h2.created_at > h1.created_at
  AND NOT EXISTS (
    SELECT 1 FROM request_history h3
    WHERE h3.request_id = h1.request_id
    AND h3.created_at > h1.created_at
    AND h3.created_at < h2.created_at
  );

-- Test 4: Esempio di calcolo manuale per transizione 1→2
SELECT
  'TEST 4 - Sample calcolo 1→2 (prime 5):' as test,
  h1.request_id,
  h1.created_at as from_time,
  h2.created_at as to_time,
  EXTRACT(EPOCH FROM (h2.created_at - h1.created_at)) / 3600.0 as hours,
  ROUND(EXTRACT(EPOCH FROM (h2.created_at - h1.created_at)) / 3600.0::numeric, 2) as hours_rounded
FROM request_history h1
INNER JOIN request_history h2 ON h2.request_id = h1.request_id
INNER JOIN requests r ON h1.request_id = r.id
INNER JOIN request_types rt ON r.request_type_id = rt.id
WHERE rt.name = 'DM329'
  AND h1.status_to = '1-INCARICO_RICEVUTO'
  AND h2.status_to = '2-SCHEDA_DATI_PRONTA'
  AND h2.created_at > h1.created_at
  AND NOT EXISTS (
    SELECT 1 FROM request_history h3
    WHERE h3.request_id = h1.request_id
    AND h3.created_at > h1.created_at
    AND h3.created_at < h2.created_at
  )
ORDER BY h1.created_at DESC
LIMIT 5;

-- Test 5: Verifica media manuale per 1→2
SELECT
  'TEST 5 - Media manuale 1→2:' as test,
  COUNT(*) as total_count,
  AVG(EXTRACT(EPOCH FROM (h2.created_at - h1.created_at)) / 3600.0) as avg_hours,
  MIN(EXTRACT(EPOCH FROM (h2.created_at - h1.created_at)) / 3600.0) as min_hours,
  MAX(EXTRACT(EPOCH FROM (h2.created_at - h1.created_at)) / 3600.0) as max_hours
FROM request_history h1
INNER JOIN request_history h2 ON h2.request_id = h1.request_id
INNER JOIN requests r ON h1.request_id = r.id
INNER JOIN request_types rt ON r.request_type_id = rt.id
WHERE rt.name = 'DM329'
  AND h1.status_to = '1-INCARICO_RICEVUTO'
  AND h2.status_to = '2-SCHEDA_DATI_PRONTA'
  AND h2.created_at > h1.created_at
  AND NOT EXISTS (
    SELECT 1 FROM request_history h3
    WHERE h3.request_id = h1.request_id
    AND h3.created_at > h1.created_at
    AND h3.created_at < h2.created_at
  );

-- Test 6: Verifica se la funzione è stata creata correttamente
SELECT
  'TEST 6 - Info funzione:' as test,
  p.proname as function_name,
  pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'get_dm329_transition_times';
