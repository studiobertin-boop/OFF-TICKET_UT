-- Script per verificare quali migration sono state realmente applicate al DB remoto
-- Esegui questo script nel SQL Editor di Supabase Dashboard

SELECT
  'deletion_archives table' as oggetto,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'deletion_archives'
  ) THEN '✅ PRESENTE' ELSE '❌ ASSENTE' END as stato
UNION ALL
SELECT
  'user_notification_preferences table',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_notification_preferences'
  ) THEN '✅ PRESENTE' ELSE '❌ ASSENTE' END
UNION ALL
SELECT
  'notifications.status_from column',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'status_from'
  ) THEN '✅ PRESENTE' ELSE '❌ ASSENTE' END
UNION ALL
SELECT
  'notifications.event_type column',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'event_type'
  ) THEN '✅ PRESENTE' ELSE '❌ ASSENTE' END
UNION ALL
SELECT
  'request_completions table',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'request_completions'
  ) THEN '✅ PRESENTE' ELSE '❌ ASSENTE' END
UNION ALL
SELECT
  'requests.is_hidden column',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'requests' AND column_name = 'is_hidden'
  ) THEN '✅ PRESENTE' ELSE '❌ ASSENTE' END
UNION ALL
SELECT
  'dm329_technical_data.off_cac column',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'dm329_technical_data' AND column_name = 'off_cac'
  ) THEN '✅ PRESENTE' ELSE '❌ ASSENTE' END
UNION ALL
SELECT
  'dm329_technical_data.alert_3m column',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'dm329_technical_data' AND column_name = 'alert_3m'
  ) THEN '✅ PRESENTE' ELSE '❌ ASSENTE' END
UNION ALL
SELECT
  'dm329_technical_data.alert_15d column',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'dm329_technical_data' AND column_name = 'alert_15d'
  ) THEN '✅ PRESENTE' ELSE '❌ ASSENTE' END
UNION ALL
SELECT
  'validate_status_transition function',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'public' AND routine_name = 'validate_status_transition'
  ) THEN '✅ PRESENTE' ELSE '❌ ASSENTE' END
UNION ALL
SELECT
  'get_notification_recipients function',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'public' AND routine_name = 'get_notification_recipients'
  ) THEN '✅ PRESENTE' ELSE '❌ ASSENTE' END
UNION ALL
SELECT
  'send_email_notification function',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'public' AND routine_name = 'send_email_notification'
  ) THEN '✅ PRESENTE' ELSE '❌ ASSENTE' END
ORDER BY oggetto;
