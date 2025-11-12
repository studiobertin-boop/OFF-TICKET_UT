-- =====================================================
-- FIX: Usa workflow_dates per pratiche importate DM329
-- =====================================================

-- PROBLEMA:
-- Le pratiche importate hanno date di cambio stato in workflow_dates,
-- ma le funzioni analytics usano request_history che ha date di importazione.
--
-- SOLUZIONE:
-- - Pratiche con workflow_dates: usa quelle date
-- - Pratiche senza: usa request_history (native app)
-- - Escludi transizioni con date NULL

-- =====================================================
-- FIX 1: get_dm329_transition_times
-- Calcola tempi medi tra stati usando workflow_dates
-- =====================================================

CREATE OR REPLACE FUNCTION get_dm329_transition_times(
  p_date_from TIMESTAMPTZ DEFAULT NULL,
  p_date_to TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  transition_name TEXT,
  avg_hours NUMERIC,
  request_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH transitions AS (
    SELECT
      '1 → 2' as trans_name,
      '1-INCARICO_RICEVUTO' as from_status,
      '2-SCHEDA_DATI_PRONTA' as to_status
    UNION ALL SELECT '2 → 3', '2-SCHEDA_DATI_PRONTA', '3-MAIL_CLIENTE_INVIATA'
    UNION ALL SELECT '3 → 4', '3-MAIL_CLIENTE_INVIATA', '4-DOCUMENTI_PRONTI'
    UNION ALL SELECT '4 → 5', '4-DOCUMENTI_PRONTI', '5-ATTESA_FIRMA'
    UNION ALL SELECT '5 → 6', '5-ATTESA_FIRMA', '6-PRONTA_PER_CIVA'
    UNION ALL SELECT '6 → 7', '6-PRONTA_PER_CIVA', '7-CHIUSA'
  ),
  -- Pratiche IMPORTATE: usa workflow_dates
  imported_transitions AS (
    SELECT
      t.trans_name,
      r.id as request_id,
      -- Data FROM
      (r.custom_fields->'workflow_dates'->>t.from_status)::TIMESTAMPTZ as from_time,
      -- Data TO
      (r.custom_fields->'workflow_dates'->>t.to_status)::TIMESTAMPTZ as to_time,
      EXTRACT(EPOCH FROM (
        (r.custom_fields->'workflow_dates'->>t.to_status)::TIMESTAMPTZ -
        (r.custom_fields->'workflow_dates'->>t.from_status)::TIMESTAMPTZ
      )) / 3600.0 as hours
    FROM transitions t
    CROSS JOIN requests r
    INNER JOIN request_types rt ON r.request_type_id = rt.id
    WHERE rt.name = 'DM329'
      AND r.custom_fields ? 'workflow_dates'
      -- Entrambe le date devono essere presenti e non NULL
      AND r.custom_fields->'workflow_dates'->>t.from_status IS NOT NULL
      AND r.custom_fields->'workflow_dates'->>t.to_status IS NOT NULL
      -- Filtri temporali opzionali
      AND (p_date_from IS NULL OR (r.custom_fields->'workflow_dates'->>t.from_status)::TIMESTAMPTZ >= p_date_from)
      AND (p_date_to IS NULL OR (r.custom_fields->'workflow_dates'->>t.to_status)::TIMESTAMPTZ <= p_date_to)
  ),
  -- Pratiche NATIVE: usa request_history
  native_transitions AS (
    SELECT
      t.trans_name,
      h1.request_id,
      h1.created_at as from_time,
      h2.created_at as to_time,
      EXTRACT(EPOCH FROM (h2.created_at - h1.created_at)) / 3600.0 as hours
    FROM transitions t
    INNER JOIN request_history h1 ON h1.status_to = t.from_status
    INNER JOIN request_history h2 ON h2.request_id = h1.request_id
      AND h2.status_to = t.to_status
      AND h2.created_at > h1.created_at
    INNER JOIN requests r ON h1.request_id = r.id
    INNER JOIN request_types rt ON r.request_type_id = rt.id
    WHERE rt.name = 'DM329'
      AND NOT (r.custom_fields ? 'workflow_dates')  -- SOLO pratiche native
      AND (p_date_from IS NULL OR h1.created_at >= p_date_from)
      AND (p_date_to IS NULL OR h2.created_at <= p_date_to)
      -- Transizione diretta (nessuno stato intermedio)
      AND NOT EXISTS (
        SELECT 1 FROM request_history h3
        WHERE h3.request_id = h1.request_id
        AND h3.created_at > h1.created_at
        AND h3.created_at < h2.created_at
      )
  ),
  -- UNION di entrambe le fonti
  all_transitions AS (
    SELECT * FROM imported_transitions
    UNION ALL
    SELECT * FROM native_transitions
  )
  -- Aggregazione finale
  SELECT
    trans_name::TEXT as transition_name,
    COALESCE(AVG(hours), 0)::NUMERIC as avg_hours,
    COUNT(DISTINCT request_id)::BIGINT as request_count
  FROM all_transitions
  WHERE hours >= 0  -- Sanity check
  GROUP BY trans_name
  ORDER BY trans_name;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- FIX 2: get_completion_time_trend (solo DM329)
-- Usa workflow_dates per data chiusura pratiche importate
-- =====================================================

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
      -- Data completamento: workflow_dates per importate, altrimenti request_completions
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
          -- Pratiche importate: da data incarico a data chiusura in workflow_dates
          EXTRACT(EPOCH FROM (
            (r.custom_fields->'workflow_dates'->>'7-CHIUSA')::TIMESTAMPTZ -
            (r.custom_fields->'workflow_dates'->>'1-INCARICO_RICEVUTO')::TIMESTAMPTZ
          )) / 3600.0
        ELSE
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
      -- Deve essere chiusa (in workflow_dates O in request_completions)
      AND (
        (r.custom_fields ? 'workflow_dates' AND r.custom_fields->'workflow_dates'->>'7-CHIUSA' IS NOT NULL)
        OR rc.id IS NOT NULL
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
  WHERE net_hours >= 0  -- Sanity check
  GROUP BY period_key
  ORDER BY period_key;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- TEST: Verifica funzioni corrette
-- =====================================================

-- Test 1: Transizioni DM329 (dovrebbe usare workflow_dates per importate)
SELECT
  'TEST Transizioni DM329 con workflow_dates:' as test,
  *
FROM get_dm329_transition_times(NULL, NULL);

-- Test 2: Completion time trend DM329
SELECT
  'TEST Completion Time Trend DM329:' as test,
  *
FROM get_completion_time_trend('DM329', NULL, NULL, 'month', false)
ORDER BY period
LIMIT 10;

-- Test 3: Verifica sample pratica importata vs nativa
SELECT
  'SAMPLE Pratica Importata:' as test,
  r.id,
  r.created_at,
  r.custom_fields->'workflow_dates'->>'1-INCARICO_RICEVUTO' as workflow_start,
  r.custom_fields->'workflow_dates'->>'7-CHIUSA' as workflow_end,
  EXTRACT(EPOCH FROM (
    (r.custom_fields->'workflow_dates'->>'7-CHIUSA')::TIMESTAMPTZ -
    (r.custom_fields->'workflow_dates'->>'1-INCARICO_RICEVUTO')::TIMESTAMPTZ
  )) / 3600.0 as hours_from_workflow
FROM requests r
JOIN request_types rt ON r.request_type_id = rt.id
WHERE rt.name = 'DM329'
  AND r.custom_fields ? 'workflow_dates'
  AND r.custom_fields->'workflow_dates'->>'7-CHIUSA' IS NOT NULL
LIMIT 3;

COMMENT ON FUNCTION get_dm329_transition_times IS 'Calcola tempi medi transizioni DM329 usando workflow_dates per pratiche importate e request_history per pratiche native';
COMMENT ON FUNCTION get_completion_time_trend IS 'Calcola trend tempi completamento usando workflow_dates.7-CHIUSA per pratiche importate DM329';
