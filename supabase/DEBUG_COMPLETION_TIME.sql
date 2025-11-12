-- ====================================================================
-- DEBUG: Verifica calcolo tempo apertura-chiusura DM329
-- ====================================================================

-- Test 1: Verifica pratiche importate con entrambe le date
SELECT
  'PRATICHE IMPORTATE CON ENTRAMBE LE DATE:' as test,
  COUNT(*) as totale_con_entrambe,
  COUNT(*) FILTER (WHERE r.custom_fields->'workflow_dates'->>'7-CHIUSA' IS NOT NULL) as con_chiusa,
  COUNT(*) FILTER (WHERE r.custom_fields->'workflow_dates'->>'1-INCARICO_RICEVUTO' IS NOT NULL) as con_incarico,
  COUNT(*) FILTER (
    WHERE r.custom_fields->'workflow_dates'->>'7-CHIUSA' IS NOT NULL
      AND r.custom_fields->'workflow_dates'->>'1-INCARICO_RICEVUTO' IS NOT NULL
  ) as con_entrambe
FROM requests r
JOIN request_types rt ON r.request_type_id = rt.id
WHERE rt.name = 'DM329'
  AND r.custom_fields ? 'workflow_dates';

-- Test 2: Calcola tempo medio SOLO per pratiche importate con entrambe le date
SELECT
  'TEMPO MEDIO PRATICHE IMPORTATE (solo con entrambe date):' as test,
  COUNT(*) as pratiche_count,
  AVG(
    EXTRACT(EPOCH FROM (
      (r.custom_fields->'workflow_dates'->>'7-CHIUSA')::TIMESTAMPTZ -
      (r.custom_fields->'workflow_dates'->>'1-INCARICO_RICEVUTO')::TIMESTAMPTZ
    )) / 3600.0
  ) as avg_hours,
  MIN(
    EXTRACT(EPOCH FROM (
      (r.custom_fields->'workflow_dates'->>'7-CHIUSA')::TIMESTAMPTZ -
      (r.custom_fields->'workflow_dates'->>'1-INCARICO_RICEVUTO')::TIMESTAMPTZ
    )) / 3600.0
  ) as min_hours,
  MAX(
    EXTRACT(EPOCH FROM (
      (r.custom_fields->'workflow_dates'->>'7-CHIUSA')::TIMESTAMPTZ -
      (r.custom_fields->'workflow_dates'->>'1-INCARICO_RICEVUTO')::TIMESTAMPTZ
    )) / 3600.0
  ) as max_hours
FROM requests r
JOIN request_types rt ON r.request_type_id = rt.id
WHERE rt.name = 'DM329'
  AND r.custom_fields ? 'workflow_dates'
  AND r.custom_fields->'workflow_dates'->>'7-CHIUSA' IS NOT NULL
  AND r.custom_fields->'workflow_dates'->>'1-INCARICO_RICEVUTO' IS NOT NULL;

-- Test 3: Distribuzione tempi per periodo (come nella funzione)
SELECT
  'DISTRIBUZIONE PER MESE:' as test,
  TO_CHAR(
    (r.custom_fields->'workflow_dates'->>'7-CHIUSA')::TIMESTAMPTZ,
    'YYYY-MM'
  ) as periodo,
  COUNT(*) as pratiche_count,
  AVG(
    EXTRACT(EPOCH FROM (
      (r.custom_fields->'workflow_dates'->>'7-CHIUSA')::TIMESTAMPTZ -
      (r.custom_fields->'workflow_dates'->>'1-INCARICO_RICEVUTO')::TIMESTAMPTZ
    )) / 3600.0
  ) as avg_hours
FROM requests r
JOIN request_types rt ON r.request_type_id = rt.id
WHERE rt.name = 'DM329'
  AND r.custom_fields ? 'workflow_dates'
  AND r.custom_fields->'workflow_dates'->>'7-CHIUSA' IS NOT NULL
  AND r.custom_fields->'workflow_dates'->>'1-INCARICO_RICEVUTO' IS NOT NULL
GROUP BY periodo
ORDER BY periodo
LIMIT 10;

-- Test 4: Sample pratiche con tempi molto alti
SELECT
  'SAMPLE PRATICHE CON TEMPI ALTI (>5000 ore):' as test,
  r.id,
  r.title,
  r.custom_fields->'workflow_dates'->>'1-INCARICO_RICEVUTO' as data_incarico,
  r.custom_fields->'workflow_dates'->>'7-CHIUSA' as data_chiusa,
  EXTRACT(EPOCH FROM (
    (r.custom_fields->'workflow_dates'->>'7-CHIUSA')::TIMESTAMPTZ -
    (r.custom_fields->'workflow_dates'->>'1-INCARICO_RICEVUTO')::TIMESTAMPTZ
  )) / 3600.0 as ore_totali,
  EXTRACT(EPOCH FROM (
    (r.custom_fields->'workflow_dates'->>'7-CHIUSA')::TIMESTAMPTZ -
    (r.custom_fields->'workflow_dates'->>'1-INCARICO_RICEVUTO')::TIMESTAMPTZ
  )) / 3600.0 / 24 as giorni_totali
FROM requests r
JOIN request_types rt ON r.request_type_id = rt.id
WHERE rt.name = 'DM329'
  AND r.custom_fields ? 'workflow_dates'
  AND r.custom_fields->'workflow_dates'->>'7-CHIUSA' IS NOT NULL
  AND r.custom_fields->'workflow_dates'->>'1-INCARICO_RICEVUTO' IS NOT NULL
  AND EXTRACT(EPOCH FROM (
    (r.custom_fields->'workflow_dates'->>'7-CHIUSA')::TIMESTAMPTZ -
    (r.custom_fields->'workflow_dates'->>'1-INCARICO_RICEVUTO')::TIMESTAMPTZ
  )) / 3600.0 > 5000
ORDER BY ore_totali DESC
LIMIT 5;

-- Test 5: Verifica cosa restituisce la funzione corrente
SELECT
  'RISULTATO FUNZIONE CORRENTE:' as test,
  *
FROM get_completion_time_trend('DM329', NULL, NULL, 'month', false)
ORDER BY period DESC
LIMIT 10;
