-- ====================================================================
-- ANALISI: Struttura workflow_dates nelle richieste DM329
-- ====================================================================

-- 1. Verifica quante richieste DM329 hanno workflow_dates
SELECT
  'CONTEGGIO PRATICHE CON WORKFLOW_DATES:' as info,
  COUNT(*) FILTER (WHERE custom_fields ? 'workflow_dates') as con_workflow_dates,
  COUNT(*) FILTER (WHERE NOT (custom_fields ? 'workflow_dates')) as senza_workflow_dates,
  COUNT(*) as totale
FROM requests r
JOIN request_types rt ON r.request_type_id = rt.id
WHERE rt.name = 'DM329';

-- 2. Esamina la struttura di workflow_dates (primi 5 esempi)
SELECT
  'ESEMPI STRUTTURA WORKFLOW_DATES:' as info,
  r.id as request_id,
  r.status as stato_attuale,
  r.created_at as data_creazione,
  custom_fields->'workflow_dates' as workflow_dates,
  jsonb_pretty(custom_fields->'workflow_dates') as workflow_dates_formatted
FROM requests r
JOIN request_types rt ON r.request_type_id = rt.id
WHERE rt.name = 'DM329'
  AND custom_fields ? 'workflow_dates'
LIMIT 5;

-- 3. Verifica formato delle date in workflow_dates
SELECT
  'FORMATO DATE IN WORKFLOW_DATES:' as info,
  custom_fields->'workflow_dates'->>'1-INCARICO_RICEVUTO' as data_1,
  custom_fields->'workflow_dates'->>'2-SCHEDA_DATI_PRONTA' as data_2,
  custom_fields->'workflow_dates'->>'3-MAIL_CLIENTE_INVIATA' as data_3,
  custom_fields->'workflow_dates'->>'4-DOCUMENTI_PRONTI' as data_4,
  custom_fields->'workflow_dates'->>'5-ATTESA_FIRMA' as data_5,
  custom_fields->'workflow_dates'->>'6-PRONTA_PER_CIVA' as data_6,
  custom_fields->'workflow_dates'->>'7-CHIUSA' as data_7
FROM requests r
JOIN request_types rt ON r.request_type_id = rt.id
WHERE rt.name = 'DM329'
  AND custom_fields ? 'workflow_dates'
LIMIT 3;

-- 4. Test conversione date da workflow_dates a TIMESTAMPTZ
SELECT
  'TEST CONVERSIONE DATE:' as info,
  r.id,
  custom_fields->'workflow_dates'->>'1-INCARICO_RICEVUTO' as data_raw,
  (custom_fields->'workflow_dates'->>'1-INCARICO_RICEVUTO')::TIMESTAMPTZ as data_convertita,
  CASE
    WHEN custom_fields->'workflow_dates'->>'1-INCARICO_RICEVUTO' IS NULL THEN 'NULL'
    WHEN custom_fields->'workflow_dates'->>'1-INCARICO_RICEVUTO' = 'null' THEN 'NULL_STRING'
    ELSE 'VALID'
  END as validita
FROM requests r
JOIN request_types rt ON r.request_type_id = rt.id
WHERE rt.name = 'DM329'
  AND custom_fields ? 'workflow_dates'
LIMIT 5;

-- 5. Confronto date workflow_dates vs request_history
SELECT
  'CONFRONTO WORKFLOW_DATES VS REQUEST_HISTORY:' as info,
  r.id as request_id,
  custom_fields->'workflow_dates'->>'1-INCARICO_RICEVUTO' as workflow_date_1,
  (
    SELECT h.created_at
    FROM request_history h
    WHERE h.request_id = r.id
      AND h.status_to = '1-INCARICO_RICEVUTO'
    ORDER BY h.created_at DESC
    LIMIT 1
  ) as history_date_1,
  custom_fields->'workflow_dates'->>'7-CHIUSA' as workflow_date_7,
  (
    SELECT h.created_at
    FROM request_history h
    WHERE h.request_id = r.id
      AND h.status_to = '7-CHIUSA'
    ORDER BY h.created_at DESC
    LIMIT 1
  ) as history_date_7
FROM requests r
JOIN request_types rt ON r.request_type_id = rt.id
WHERE rt.name = 'DM329'
  AND custom_fields ? 'workflow_dates'
LIMIT 5;

-- 6. Conta stati non-NULL in workflow_dates
SELECT
  'DISTRIBUZIONE STATI IN WORKFLOW_DATES:' as info,
  COUNT(*) FILTER (WHERE custom_fields->'workflow_dates'->>'1-INCARICO_RICEVUTO' IS NOT NULL) as stato_1_count,
  COUNT(*) FILTER (WHERE custom_fields->'workflow_dates'->>'2-SCHEDA_DATI_PRONTA' IS NOT NULL) as stato_2_count,
  COUNT(*) FILTER (WHERE custom_fields->'workflow_dates'->>'3-MAIL_CLIENTE_INVIATA' IS NOT NULL) as stato_3_count,
  COUNT(*) FILTER (WHERE custom_fields->'workflow_dates'->>'4-DOCUMENTI_PRONTI' IS NOT NULL) as stato_4_count,
  COUNT(*) FILTER (WHERE custom_fields->'workflow_dates'->>'5-ATTESA_FIRMA' IS NOT NULL) as stato_5_count,
  COUNT(*) FILTER (WHERE custom_fields->'workflow_dates'->>'6-PRONTA_PER_CIVA' IS NOT NULL) as stato_6_count,
  COUNT(*) FILTER (WHERE custom_fields->'workflow_dates'->>'7-CHIUSA' IS NOT NULL) as stato_7_count
FROM requests r
JOIN request_types rt ON r.request_type_id = rt.id
WHERE rt.name = 'DM329'
  AND custom_fields ? 'workflow_dates';
