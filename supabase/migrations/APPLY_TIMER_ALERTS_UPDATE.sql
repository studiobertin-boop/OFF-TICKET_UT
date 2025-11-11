-- Manual script to refresh timer alerts for DM329 requests
-- Run this periodically (e.g., daily) or after migration to update timer alert flags

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
