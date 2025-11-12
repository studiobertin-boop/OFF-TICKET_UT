-- =====================================================
-- FIX: Correzione rigorosa completion time DM329
-- =====================================================

-- PROBLEMA:
-- La funzione include pratiche importate senza entrambe le date,
-- causando calcoli errati con created_at
--
-- SOLUZIONE:
-- Per pratiche importate: RICHIEDI entrambe le date (1-INCARICO + 7-CHIUSA)
-- Escludi pratiche con una sola data

CREATE OR REPLACE FUNCTION get_completion_time_trend(
  p_request_type_name TEXT DEFAULT NULL,
  p_date_from TIMESTAMPTZ DEFAULT NULL,
  p_date_to TIMESTAMPTZ DEFAULT NULL,
  p_interval TEXT DEFAULT 'month',
  p_exclude_blocked_time BOOLEAN DEFAULT TRUE
)
RETURNS TABLE (
  period TEXT,
  avg_hours NUMERIC,
  request_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH request_times AS (
    SELECT
      r.id,
      r.created_at,
      -- Data completamento
      CASE
        WHEN r.custom_fields ? 'workflow_dates'
          AND r.custom_fields->'workflow_dates'->>'7-CHIUSA' IS NOT NULL
        THEN (r.custom_fields->'workflow_dates'->>'7-CHIUSA')::TIMESTAMPTZ
        ELSE rc.completed_at
      END as completed_at,
      -- Calcolo ore nette
      CASE
        WHEN r.custom_fields ? 'workflow_dates'
          AND r.custom_fields->'workflow_dates'->>'7-CHIUSA' IS NOT NULL
          AND r.custom_fields->'workflow_dates'->>'1-INCARICO_RICEVUTO' IS NOT NULL
        THEN
          -- Pratiche importate: SOLO se hanno ENTRAMBE le date
          EXTRACT(EPOCH FROM (
            (r.custom_fields->'workflow_dates'->>'7-CHIUSA')::TIMESTAMPTZ -
            (r.custom_fields->'workflow_dates'->>'1-INCARICO_RICEVUTO')::TIMESTAMPTZ
          )) / 3600.0
        WHEN NOT (r.custom_fields ? 'workflow_dates')
        THEN
          -- Pratiche native: da created_at a completed_at, meno tempo bloccato
          EXTRACT(EPOCH FROM (rc.completed_at - r.created_at)) / 3600.0 -
          CASE
            WHEN p_exclude_blocked_time THEN
              COALESCE((
                SELECT SUM(
                  EXTRACT(EPOCH FROM (
                    COALESCE(rb.unblocked_at, rc.completed_at) - rb.blocked_at
                  )) / 3600.0
                )
                FROM request_blocks rb
                WHERE rb.request_id = r.id
                AND rb.blocked_at < rc.completed_at
              ), 0)
            ELSE 0
          END
        ELSE
          -- Pratiche importate senza entrambe le date: ESCLUDI (ritorna NULL)
          NULL
      END as net_hours,
      -- Periodo per aggregazione
      CASE p_interval
        WHEN 'day' THEN TO_CHAR(
          CASE
            WHEN r.custom_fields ? 'workflow_dates'
              AND r.custom_fields->'workflow_dates'->>'7-CHIUSA' IS NOT NULL
            THEN (r.custom_fields->'workflow_dates'->>'7-CHIUSA')::TIMESTAMPTZ
            ELSE rc.completed_at
          END, 'YYYY-MM-DD')
        WHEN 'week' THEN TO_CHAR(DATE_TRUNC('week',
          CASE
            WHEN r.custom_fields ? 'workflow_dates'
              AND r.custom_fields->'workflow_dates'->>'7-CHIUSA' IS NOT NULL
            THEN (r.custom_fields->'workflow_dates'->>'7-CHIUSA')::TIMESTAMPTZ
            ELSE rc.completed_at
          END), 'YYYY-MM-DD')
        WHEN 'month' THEN TO_CHAR(DATE_TRUNC('month',
          CASE
            WHEN r.custom_fields ? 'workflow_dates'
              AND r.custom_fields->'workflow_dates'->>'7-CHIUSA' IS NOT NULL
            THEN (r.custom_fields->'workflow_dates'->>'7-CHIUSA')::TIMESTAMPTZ
            ELSE rc.completed_at
          END), 'YYYY-MM')
        WHEN 'year' THEN TO_CHAR(DATE_TRUNC('year',
          CASE
            WHEN r.custom_fields ? 'workflow_dates'
              AND r.custom_fields->'workflow_dates'->>'7-CHIUSA' IS NOT NULL
            THEN (r.custom_fields->'workflow_dates'->>'7-CHIUSA')::TIMESTAMPTZ
            ELSE rc.completed_at
          END), 'YYYY')
        ELSE TO_CHAR(DATE_TRUNC('month',
          CASE
            WHEN r.custom_fields ? 'workflow_dates'
              AND r.custom_fields->'workflow_dates'->>'7-CHIUSA' IS NOT NULL
            THEN (r.custom_fields->'workflow_dates'->>'7-CHIUSA')::TIMESTAMPTZ
            ELSE rc.completed_at
          END), 'YYYY-MM')
      END as period_key
    FROM requests r
    INNER JOIN request_types rt ON r.request_type_id = rt.id
    LEFT JOIN request_completions rc ON r.id = rc.request_id AND rc.status = '7-CHIUSA'
    WHERE
      -- Filtro tipo richiesta
      CASE
        WHEN p_request_type_name IS NULL THEN rt.name != 'DM329'
        ELSE rt.name = p_request_type_name
      END
      -- Deve essere chiusa
      AND (
        -- Pratiche importate: ENTRAMBE le date devono essere presenti
        (r.custom_fields ? 'workflow_dates'
         AND r.custom_fields->'workflow_dates'->>'7-CHIUSA' IS NOT NULL
         AND r.custom_fields->'workflow_dates'->>'1-INCARICO_RICEVUTO' IS NOT NULL)
        -- Pratiche native: deve avere completamento
        OR (NOT (r.custom_fields ? 'workflow_dates') AND rc.id IS NOT NULL)
      )
      -- Filtri temporali
      AND (p_date_from IS NULL OR r.created_at >= p_date_from)
      AND (p_date_to IS NULL OR
        CASE
          WHEN r.custom_fields ? 'workflow_dates'
            AND r.custom_fields->'workflow_dates'->>'7-CHIUSA' IS NOT NULL
          THEN (r.custom_fields->'workflow_dates'->>'7-CHIUSA')::TIMESTAMPTZ
          ELSE rc.completed_at
        END <= p_date_to
      )
  )
  SELECT
    period_key::TEXT as period,
    COALESCE(AVG(net_hours), 0)::NUMERIC as avg_hours,
    COUNT(*)::BIGINT as request_count
  FROM request_times
  WHERE net_hours >= 0  -- Sanity check: escludi valori negativi
    AND net_hours IS NOT NULL  -- Escludi pratiche senza entrambe le date
  GROUP BY period_key
  ORDER BY period_key;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- TEST: Verifica funzione corretta
-- =====================================================

-- Test 1: Verifica che ora usi solo pratiche con entrambe le date
SELECT
  'TEST 1 - Completion Time Trend DM329 (corretto):' as test,
  period,
  avg_hours,
  ROUND(avg_hours / 24::numeric, 1) as avg_days,
  request_count
FROM get_completion_time_trend('DM329', NULL, NULL, 'month', false)
ORDER BY period DESC
LIMIT 10;

-- Test 2: Confronto con calcolo manuale
SELECT
  'TEST 2 - Calcolo Manuale (dovrebbe corrispondere):' as test,
  TO_CHAR(
    (r.custom_fields->'workflow_dates'->>'7-CHIUSA')::TIMESTAMPTZ,
    'YYYY-MM'
  ) as periodo,
  AVG(
    EXTRACT(EPOCH FROM (
      (r.custom_fields->'workflow_dates'->>'7-CHIUSA')::TIMESTAMPTZ -
      (r.custom_fields->'workflow_dates'->>'1-INCARICO_RICEVUTO')::TIMESTAMPTZ
    )) / 3600.0
  ) as avg_hours,
  ROUND(
    AVG(
      EXTRACT(EPOCH FROM (
        (r.custom_fields->'workflow_dates'->>'7-CHIUSA')::TIMESTAMPTZ -
        (r.custom_fields->'workflow_dates'->>'1-INCARICO_RICEVUTO')::TIMESTAMPTZ
      )) / 3600.0
    ) / 24::numeric,
    1
  ) as avg_days,
  COUNT(*) as pratiche_count
FROM requests r
JOIN request_types rt ON r.request_type_id = rt.id
WHERE rt.name = 'DM329'
  AND r.custom_fields ? 'workflow_dates'
  AND r.custom_fields->'workflow_dates'->>'7-CHIUSA' IS NOT NULL
  AND r.custom_fields->'workflow_dates'->>'1-INCARICO_RICEVUTO' IS NOT NULL
GROUP BY periodo
ORDER BY periodo DESC
LIMIT 10;

-- Test 3: Media globale
SELECT
  'TEST 3 - Media Globale (dovrebbe essere ~172 giorni):' as test,
  AVG(
    EXTRACT(EPOCH FROM (
      (r.custom_fields->'workflow_dates'->>'7-CHIUSA')::TIMESTAMPTZ -
      (r.custom_fields->'workflow_dates'->>'1-INCARICO_RICEVUTO')::TIMESTAMPTZ
    )) / 3600.0
  ) as avg_hours,
  ROUND(
    AVG(
      EXTRACT(EPOCH FROM (
        (r.custom_fields->'workflow_dates'->>'7-CHIUSA')::TIMESTAMPTZ -
        (r.custom_fields->'workflow_dates'->>'1-INCARICO_RICEVUTO')::TIMESTAMPTZ
      )) / 3600.0
    ) / 24::numeric,
    1
  ) as avg_days,
  COUNT(*) as total_pratiche
FROM requests r
JOIN request_types rt ON r.request_type_id = rt.id
WHERE rt.name = 'DM329'
  AND r.custom_fields ? 'workflow_dates'
  AND r.custom_fields->'workflow_dates'->>'7-CHIUSA' IS NOT NULL
  AND r.custom_fields->'workflow_dates'->>'1-INCARICO_RICEVUTO' IS NOT NULL;

COMMENT ON FUNCTION get_completion_time_trend IS 'Calcola trend tempi completamento. Per DM329 importate usa workflow_dates.7-CHIUSA e workflow_dates.1-INCARICO_RICEVUTO (ENTRAMBE obbligatorie)';
