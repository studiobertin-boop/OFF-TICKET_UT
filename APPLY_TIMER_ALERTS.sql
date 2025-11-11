-- ============================================================
-- TIMER ALERTS MIGRATION FOR DM329 REQUESTS
-- ============================================================
-- Instructions: Copy and paste this entire script into Supabase SQL Editor
-- and execute it to add timer alert functionality to DM329 requests

-- Add has_timer_alert field to requests table
ALTER TABLE requests
ADD COLUMN IF NOT EXISTS has_timer_alert BOOLEAN DEFAULT false;

-- Create index for filtering timer alerts
CREATE INDEX IF NOT EXISTS idx_requests_timer_alert ON requests(has_timer_alert) WHERE has_timer_alert = true;

COMMENT ON COLUMN requests.has_timer_alert IS 'TRUE if DM329 request exceeded time threshold in current state';

-- Function to calculate timer alerts for DM329 requests
-- Thresholds:
--   1-INCARICO_RICEVUTO: 30 days
--   3-MAIL_CLIENTE_INVIATA: 15 days
--   4-DOCUMENTI_PRONTI: 15 days
--   5-ATTESA_FIRMA: 10 days
--   6-PRONTA_PER_CIVA: 7 days
CREATE OR REPLACE FUNCTION calculate_dm329_timer_alerts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  dm329_type_id UUID;
  state_threshold INTEGER;
  days_in_state INTEGER;
  rec RECORD;
BEGIN
  -- Get DM329 request_type_id
  SELECT id INTO dm329_type_id
  FROM request_types
  WHERE name = 'DM329'
  LIMIT 1;

  IF dm329_type_id IS NULL THEN
    RAISE NOTICE 'DM329 request type not found';
    RETURN;
  END IF;

  -- Reset all timer alerts first
  UPDATE requests
  SET has_timer_alert = false
  WHERE request_type_id = dm329_type_id;

  -- Process each DM329 request in monitored states
  FOR rec IN
    SELECT
      r.id,
      r.status,
      COALESCE(
        (SELECT created_at
         FROM request_history
         WHERE request_id = r.id
           AND status_to = r.status
         ORDER BY created_at DESC
         LIMIT 1),
        r.created_at
      ) AS status_started_at
    FROM requests r
    WHERE r.request_type_id = dm329_type_id
      AND r.status IN (
        '1-INCARICO_RICEVUTO',
        '3-MAIL_CLIENTE_INVIATA',
        '4-DOCUMENTI_PRONTI',
        '5-ATTESA_FIRMA',
        '6-PRONTA_PER_CIVA'
      )
      AND r.status != '7-CHIUSA'
      AND r.status != 'ARCHIVIATA NON FINITA'
  LOOP
    -- Determine threshold based on status
    state_threshold := CASE rec.status
      WHEN '1-INCARICO_RICEVUTO' THEN 30
      WHEN '3-MAIL_CLIENTE_INVIATA' THEN 15
      WHEN '4-DOCUMENTI_PRONTI' THEN 15
      WHEN '5-ATTESA_FIRMA' THEN 10
      WHEN '6-PRONTA_PER_CIVA' THEN 7
      ELSE NULL
    END;

    IF state_threshold IS NULL THEN
      CONTINUE;
    END IF;

    -- Calculate days in current state
    days_in_state := EXTRACT(DAY FROM (NOW() - rec.status_started_at));

    -- Set alert if threshold exceeded
    IF days_in_state >= state_threshold THEN
      UPDATE requests
      SET has_timer_alert = true
      WHERE id = rec.id;
    END IF;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION calculate_dm329_timer_alerts IS 'Updates has_timer_alert flag for DM329 requests exceeding state time thresholds';

-- Trigger to update timer alert on status change
CREATE OR REPLACE FUNCTION update_timer_alert_on_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  dm329_type_id UUID;
BEGIN
  -- Get DM329 request_type_id
  SELECT id INTO dm329_type_id
  FROM request_types
  WHERE name = 'DM329'
  LIMIT 1;

  -- Only process DM329 requests
  IF NEW.request_type_id != dm329_type_id THEN
    RETURN NEW;
  END IF;

  -- Reset timer alert on status change
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.has_timer_alert := false;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for status changes
DROP TRIGGER IF EXISTS trigger_update_timer_alert ON requests;
CREATE TRIGGER trigger_update_timer_alert
  BEFORE UPDATE ON requests
  FOR EACH ROW
  EXECUTE FUNCTION update_timer_alert_on_status_change();

COMMENT ON TRIGGER trigger_update_timer_alert ON requests IS 'Resets has_timer_alert when request status changes';

-- Initial calculation of timer alerts
SELECT calculate_dm329_timer_alerts();

-- Verify results
SELECT
  id,
  title,
  status,
  has_timer_alert,
  created_at,
  updated_at
FROM requests
WHERE request_type_id = (SELECT id FROM request_types WHERE name = 'DM329' LIMIT 1)
  AND has_timer_alert = true
ORDER BY created_at ASC;
