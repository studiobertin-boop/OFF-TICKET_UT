-- ====================================================================
-- DEBUG: Verifica Analytics DM329
-- ====================================================================

-- 1. Verifica esistenza funzioni RPC
SELECT
  'FUNZIONI RPC ESISTENTI:' as info,
  p.proname as function_name
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN (
    'get_dm329_transition_times',
    'get_completion_time_trend',
    'calculate_avg_completion_time'
  )
ORDER BY p.proname;

-- 2. Verifica dati nella tabella request_history per DM329
SELECT
  'DATI REQUEST_HISTORY PER DM329:' as info,
  COUNT(*) as total_history_records,
  COUNT(DISTINCT request_id) as unique_requests
FROM request_history rh
WHERE EXISTS (
  SELECT 1
  FROM requests r
  JOIN request_types rt ON r.request_type_id = rt.id
  WHERE r.id = rh.request_id
    AND rt.name = 'DM329'
);

-- 3. Verifica distribuzione transizioni per DM329
SELECT
  'DISTRIBUZIONE TRANSIZIONI DM329:' as info,
  status_to,
  COUNT(*) as count
FROM request_history rh
WHERE EXISTS (
  SELECT 1
  FROM requests r
  JOIN request_types rt ON r.request_type_id = rt.id
  WHERE r.id = rh.request_id
    AND rt.name = 'DM329'
)
GROUP BY status_to
ORDER BY status_to;

-- 4. Test diretto funzione get_dm329_transition_times (senza filtri)
SELECT
  'TEST get_dm329_transition_times():' as info,
  *
FROM get_dm329_transition_times(NULL, NULL);

-- 5. Test funzione get_completion_time_trend per DM329 (ultimi 12 mesi)
SELECT
  'TEST get_completion_time_trend DM329:' as info,
  *
FROM get_completion_time_trend(
  'DM329',
  NOW() - INTERVAL '12 months',
  NOW(),
  'month',
  false
);

-- 6. Verifica coppie di transizioni dirette (per debug)
SELECT
  'COPPIE TRANSIZIONI DIRETTE 1→2:' as info,
  COUNT(*) as count
FROM request_history h1
INNER JOIN request_history h2 ON h2.request_id = h1.request_id
  AND h2.created_at > h1.created_at
INNER JOIN requests r ON h1.request_id = r.id
INNER JOIN request_types rt ON r.request_type_id = rt.id
WHERE rt.name = 'DM329'
  AND h1.status_to = '1-INCARICO_RICEVUTO'
  AND h2.status_to = '2-SCHEDA_DATI_PRONTA'
  AND NOT EXISTS (
    SELECT 1 FROM request_history h3
    WHERE h3.request_id = h1.request_id
    AND h3.created_at > h1.created_at
    AND h3.created_at < h2.created_at
  );

-- 7. Verifica sample di transizioni con tempi
SELECT
  'SAMPLE TRANSIZIONI CON TEMPI:' as info,
  h1.request_id,
  h1.status_to as from_status,
  h2.status_to as to_status,
  h1.created_at as from_time,
  h2.created_at as to_time,
  EXTRACT(EPOCH FROM (h2.created_at - h1.created_at)) / 3600.0 as hours
FROM request_history h1
INNER JOIN request_history h2 ON h2.request_id = h1.request_id
  AND h2.created_at > h1.created_at
INNER JOIN requests r ON h1.request_id = r.id
INNER JOIN request_types rt ON r.request_type_id = rt.id
WHERE rt.name = 'DM329'
  AND h1.status_to = '1-INCARICO_RICEVUTO'
  AND h2.status_to = '2-SCHEDA_DATI_PRONTA'
  AND NOT EXISTS (
    SELECT 1 FROM request_history h3
    WHERE h3.request_id = h1.request_id
    AND h3.created_at > h1.created_at
    AND h3.created_at < h2.created_at
  )
LIMIT 5;

-- 8. Conta richieste DM329 per stato
SELECT
  'RICHIESTE DM329 PER STATO ATTUALE:' as info,
  status,
  COUNT(*) as count
FROM requests r
JOIN request_types rt ON r.request_type_id = rt.id
WHERE rt.name = 'DM329'
GROUP BY status
ORDER BY status;
