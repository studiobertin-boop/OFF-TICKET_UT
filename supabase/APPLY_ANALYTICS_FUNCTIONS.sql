-- =====================================================
-- APPLY: Dashboard Analytics Functions
-- Applica le funzioni RPC necessarie per la dashboard DM329
-- =====================================================

-- =====================================================
-- PART 1: Create request_completions table if not exists
-- =====================================================

CREATE TABLE IF NOT EXISTS request_completions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL,
  request_type_id UUID NOT NULL,
  request_type_name TEXT NOT NULL,
  status TEXT NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast queries
CREATE INDEX IF NOT EXISTS idx_request_completions_type_date
  ON request_completions(request_type_name, completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_request_completions_status
  ON request_completions(status, completed_at DESC);

-- =====================================================
-- PART 2: Trigger to track completions
-- =====================================================

CREATE OR REPLACE FUNCTION track_request_completion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('COMPLETATA', '7-CHIUSA') AND
     (TG_OP = 'INSERT' OR OLD.status != NEW.status) THEN

    IF NOT EXISTS (
      SELECT 1 FROM request_completions
      WHERE request_id = NEW.id AND status = NEW.status
    ) THEN
      INSERT INTO request_completions (
        request_id,
        request_type_id,
        request_type_name,
        status,
        completed_at
      )
      SELECT
        NEW.id,
        NEW.request_type_id,
        rt.name,
        NEW.status,
        NOW()
      FROM request_types rt
      WHERE rt.id = NEW.request_type_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_track_request_completion ON requests;
CREATE TRIGGER trigger_track_request_completion
  AFTER INSERT OR UPDATE OF status ON requests
  FOR EACH ROW
  EXECUTE FUNCTION track_request_completion();

-- =====================================================
-- PART 3: Function calculate_avg_completion_time
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
    WHERE (p_request_type_name IS NULL OR rt.name = p_request_type_name)
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
-- PART 4: Function get_completion_time_trend
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
    WHERE (p_request_type_name IS NULL OR rt.name = p_request_type_name)
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
-- PART 5: Function get_dm329_transition_times
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
  transition_times AS (
    SELECT
      t.trans_name,
      h1.request_id,
      EXTRACT(EPOCH FROM (h2.created_at - h1.created_at)) / 3600.0 as hours
    FROM transitions t
    INNER JOIN request_history h1 ON h1.status_to = t.from_status
    INNER JOIN request_history h2 ON h2.request_id = h1.request_id
      AND h2.status_to = t.to_status
      AND h2.created_at > h1.created_at
    INNER JOIN requests r ON h1.request_id = r.id
    INNER JOIN request_types rt ON r.request_type_id = rt.id
    WHERE rt.name = 'DM329'
      AND (p_date_from IS NULL OR h1.created_at >= p_date_from)
      AND (p_date_to IS NULL OR h2.created_at <= p_date_to)
      AND NOT EXISTS (
        SELECT 1 FROM request_history h3
        WHERE h3.request_id = h1.request_id
        AND h3.created_at > h1.created_at
        AND h3.created_at < h2.created_at
      )
  )
  SELECT
    trans_name::TEXT as transition_name,
    COALESCE(AVG(hours), 0)::NUMERIC as avg_hours,
    COUNT(DISTINCT request_id)::BIGINT as request_count
  FROM transition_times
  GROUP BY trans_name
  ORDER BY trans_name;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- PART 6: Backfill completion tracking
-- =====================================================

INSERT INTO request_completions (request_id, request_type_id, request_type_name, status, completed_at, created_at)
SELECT DISTINCT ON (r.id, h.status_to)
  r.id,
  r.request_type_id,
  rt.name,
  h.status_to,
  h.created_at,
  h.created_at
FROM requests r
INNER JOIN request_types rt ON r.request_type_id = rt.id
INNER JOIN request_history h ON h.request_id = r.id
WHERE h.status_to IN ('COMPLETATA', '7-CHIUSA')
  AND NOT EXISTS (
    SELECT 1 FROM request_completions rc
    WHERE rc.request_id = r.id AND rc.status = h.status_to
  )
ORDER BY r.id, h.status_to, h.created_at DESC
ON CONFLICT DO NOTHING;

-- =====================================================
-- PART 7: Verify functions were created
-- =====================================================

SELECT
  'FUNZIONI CREATE CON SUCCESSO:' as info,
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
