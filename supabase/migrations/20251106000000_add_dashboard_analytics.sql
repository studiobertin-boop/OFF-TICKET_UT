-- Migration: Advanced Dashboard Analytics
-- Description: Add views and functions for dashboard analytics with persistent completion tracking
-- Date: 2025-11-06

-- =====================================================
-- PART 1: Create materialized view for completed requests
-- This tracks all requests that have been COMPLETATA or 7-CHIUSA
-- even if they are later deleted
-- =====================================================

-- First, create a table to store completion events
CREATE TABLE IF NOT EXISTS request_completions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL,
  request_type_id UUID NOT NULL,
  request_type_name TEXT NOT NULL,
  status TEXT NOT NULL, -- COMPLETATA or 7-CHIUSA
  completed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast queries
CREATE INDEX IF NOT EXISTS idx_request_completions_type_date
  ON request_completions(request_type_name, completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_request_completions_status
  ON request_completions(status, completed_at DESC);

-- Trigger function to track completions
CREATE OR REPLACE FUNCTION track_request_completion()
RETURNS TRIGGER AS $$
BEGIN
  -- Track when a request transitions to COMPLETATA or 7-CHIUSA
  IF NEW.status IN ('COMPLETATA', '7-CHIUSA') AND
     (TG_OP = 'INSERT' OR OLD.status != NEW.status) THEN

    -- Check if this completion is already tracked
    IF NOT EXISTS (
      SELECT 1 FROM request_completions
      WHERE request_id = NEW.id AND status = NEW.status
    ) THEN
      -- Get request type name
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

-- Create trigger on requests table
DROP TRIGGER IF EXISTS trigger_track_request_completion ON requests;
CREATE TRIGGER trigger_track_request_completion
  AFTER INSERT OR UPDATE OF status ON requests
  FOR EACH ROW
  EXECUTE FUNCTION track_request_completion();

-- =====================================================
-- PART 2: Function to calculate time between status transitions
-- Returns average time in hours between two statuses
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_avg_time_between_statuses(
  p_status_from TEXT,
  p_status_to TEXT,
  p_request_type_name TEXT DEFAULT NULL,
  p_date_from TIMESTAMPTZ DEFAULT NULL,
  p_date_to TIMESTAMPTZ DEFAULT NULL
)
RETURNS NUMERIC AS $$
DECLARE
  v_avg_hours NUMERIC;
BEGIN
  -- Calculate average time by joining history records
  WITH status_transitions AS (
    SELECT
      h1.request_id,
      h1.created_at as from_time,
      h2.created_at as to_time,
      EXTRACT(EPOCH FROM (h2.created_at - h1.created_at)) / 3600.0 as hours
    FROM request_history h1
    INNER JOIN request_history h2
      ON h1.request_id = h2.request_id
      AND h2.created_at > h1.created_at
    INNER JOIN requests r ON h1.request_id = r.id
    WHERE h1.status_to = p_status_from
      AND h2.status_to = p_status_to
      -- Filter by request type if specified
      AND (p_request_type_name IS NULL OR EXISTS (
        SELECT 1 FROM request_types rt
        WHERE rt.id = r.request_type_id
        AND rt.name = p_request_type_name
      ))
      -- Filter by date range if specified
      AND (p_date_from IS NULL OR h1.created_at >= p_date_from)
      AND (p_date_to IS NULL OR h2.created_at <= p_date_to)
      -- Ensure this is the immediate next transition
      AND NOT EXISTS (
        SELECT 1 FROM request_history h3
        WHERE h3.request_id = h1.request_id
        AND h3.created_at > h1.created_at
        AND h3.created_at < h2.created_at
      )
  )
  SELECT COALESCE(AVG(hours), 0) INTO v_avg_hours
  FROM status_transitions;

  RETURN v_avg_hours;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- PART 3: Function to calculate time from creation to completion
-- Excludes time spent in blocked state
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
      -- Calculate total time
      EXTRACT(EPOCH FROM (rc.completed_at - r.created_at)) / 3600.0 as total_hours,
      -- Calculate blocked time if requested
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
  WHERE total_hours >= blocked_hours; -- Safety check

  RETURN v_avg_hours;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- PART 4: Function to get completion time trend over time
-- Returns time series data for completion time trends
-- =====================================================

CREATE OR REPLACE FUNCTION get_completion_time_trend(
  p_request_type_name TEXT DEFAULT NULL,
  p_date_from TIMESTAMPTZ DEFAULT NULL,
  p_date_to TIMESTAMPTZ DEFAULT NULL,
  p_interval TEXT DEFAULT 'month', -- day, week, month, year
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
      -- Calculate net time
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
      -- Group by period
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
  WHERE net_hours >= 0 -- Safety check
  GROUP BY period_key
  ORDER BY period_key;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- PART 5: Function to get DM329 status transition times
-- Returns average time for each status transition in DM329 workflow
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
      -- Ensure immediate transition
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
-- PART 6: Backfill completion tracking for existing data
-- =====================================================

-- Insert existing completed/closed requests into tracking table
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
-- PART 7: Add comments for documentation
-- =====================================================

COMMENT ON TABLE request_completions IS 'Persistent tracking of completed/closed requests, survives deletion';
COMMENT ON FUNCTION calculate_avg_time_between_statuses IS 'Calculate average time between two status transitions';
COMMENT ON FUNCTION calculate_avg_completion_time IS 'Calculate average time from creation to completion, optionally excluding blocked time';
COMMENT ON FUNCTION get_completion_time_trend IS 'Get time series of completion times over specified interval';
COMMENT ON FUNCTION get_dm329_transition_times IS 'Get average times for each DM329 status transition';
