-- =====================================================
-- FIX: Correzione filtro DM329 nelle funzioni analytics
-- =====================================================

-- PROBLEMA:
-- Le funzioni analytics stavano includendo TUTTE le richieste (anche DM329)
-- quando p_request_type_name = NULL, invece di ESCLUDERE DM329.
--
-- SOLUZIONE:
-- - NULL = ESCLUDI DM329 (solo richieste generali)
-- - 'DM329' = SOLO DM329

-- =====================================================
-- FIX 1: calculate_avg_completion_time
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_avg_completion_time(
  p_request_type_name TEXT DEFAULT NULL,
  p_date_from TIMESTAMPTZ DEFAULT NULL,
  p_date_to TIMESTAMPTZ DEFAULT NULL,
  p_exclude_blocked_time BOOLEAN DEFAULT TRUE
)
RETURNS NUMERIC AS $$
DECLARE
  v_avg_hours NUMERIC;
BEGIN
  WITH request_times AS (
    SELECT
      r.id,
      r.created_at,
      rc.completed_at,
      EXTRACT(EPOCH FROM (rc.completed_at - r.created_at)) / 3600.0 as total_hours,
      CASE
        WHEN p_exclude_blocked_time THEN
          COALESCE((
            SELECT SUM(
              EXTRACT(EPOCH FROM (
                COALESCE(rb.unblocked_at, NOW()) - rb.blocked_at
              )) / 3600.0
            )
            FROM request_blocks rb
            WHERE rb.request_id = r.id
            AND rb.blocked_at < rc.completed_at
          ), 0)
        ELSE 0
      END as blocked_hours
    FROM requests r
    INNER JOIN request_completions rc ON r.id = rc.request_id
    INNER JOIN request_types rt ON r.request_type_id = rt.id
    WHERE
      -- FIX: Logica corretta per filtrare DM329
      CASE
        WHEN p_request_type_name IS NULL THEN rt.name != 'DM329'  -- Dashboard generale: ESCLUDI DM329
        ELSE rt.name = p_request_type_name                        -- Dashboard specifica: SOLO quel tipo
      END
      AND (p_date_from IS NULL OR r.created_at >= p_date_from)
      AND (p_date_to IS NULL OR rc.completed_at <= p_date_to)
      AND rc.status IN ('COMPLETATA', '7-CHIUSA')
  )
  SELECT COALESCE(AVG(total_hours - blocked_hours), 0) INTO v_avg_hours
  FROM request_times
  WHERE total_hours >= blocked_hours;

  RETURN v_avg_hours;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- FIX 2: get_completion_time_trend
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
      rc.completed_at,
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
      END as net_hours,
      CASE p_interval
        WHEN 'day' THEN TO_CHAR(rc.completed_at, 'YYYY-MM-DD')
        WHEN 'week' THEN TO_CHAR(DATE_TRUNC('week', rc.completed_at), 'YYYY-MM-DD')
        WHEN 'month' THEN TO_CHAR(DATE_TRUNC('month', rc.completed_at), 'YYYY-MM')
        WHEN 'year' THEN TO_CHAR(DATE_TRUNC('year', rc.completed_at), 'YYYY')
        ELSE TO_CHAR(DATE_TRUNC('month', rc.completed_at), 'YYYY-MM')
      END as period_key
    FROM requests r
    INNER JOIN request_completions rc ON r.id = rc.request_id
    INNER JOIN request_types rt ON r.request_type_id = rt.id
    WHERE
      -- FIX: Logica corretta per filtrare DM329
      CASE
        WHEN p_request_type_name IS NULL THEN rt.name != 'DM329'  -- Dashboard generale: ESCLUDI DM329
        ELSE rt.name = p_request_type_name                        -- Dashboard specifica: SOLO quel tipo
      END
      AND (p_date_from IS NULL OR r.created_at >= p_date_from)
      AND (p_date_to IS NULL OR rc.completed_at <= p_date_to)
      AND rc.status IN ('COMPLETATA', '7-CHIUSA')
  )
  SELECT
    period_key::TEXT as period,
    COALESCE(AVG(net_hours), 0)::NUMERIC as avg_hours,
    COUNT(*)::BIGINT as request_count
  FROM request_times
  WHERE net_hours >= 0
  GROUP BY period_key
  ORDER BY period_key;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- VERIFICA: Testa le funzioni corrette
-- =====================================================

-- Test 1: Dashboard generale (dovrebbe ESCLUDERE DM329)
SELECT
  'TEST Dashboard Generale (escludi DM329):' as test,
  *
FROM get_completion_time_trend(NULL, NULL, NULL, 'month', true)
LIMIT 5;

-- Test 2: Dashboard DM329 (dovrebbe includere SOLO DM329)
SELECT
  'TEST Dashboard DM329 (solo DM329):' as test,
  *
FROM get_completion_time_trend('DM329', NULL, NULL, 'month', false)
LIMIT 5;

-- Test 3: Calcolo avg completion time generale
SELECT
  'TEST Avg Completion Time Generale:' as test,
  calculate_avg_completion_time(NULL, NULL, NULL, true) as avg_hours;

-- Test 4: Calcolo avg completion time DM329
SELECT
  'TEST Avg Completion Time DM329:' as test,
  calculate_avg_completion_time('DM329', NULL, NULL, false) as avg_hours;
