-- Script completo di verifica per TUTTE le 21 migration "non applicate"
-- Esegui nel SQL Editor di Supabase Dashboard

SELECT
  '20251104000001' as migration,
  'deletion_archives table' as verifica,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'deletion_archives'
  ) THEN '✅' ELSE '❌' END as stato
UNION ALL
SELECT '20251104000002', 'status ENUM without INFO_NECESSARIE/INFO_TRASMESSE',
  CASE WHEN NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'request_status' AND e.enumlabel IN ('INFO_NECESSARIE', 'INFO_TRASMESSE')
  ) THEN '✅' ELSE '❌' END
UNION ALL
SELECT '20251104000003', 'deletion_archives RLS policies',
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'deletion_archives'
  ) THEN '✅' ELSE '❌' END
UNION ALL
SELECT '20251104000004', 'request_types updated',
  '⚠️ Da verificare manualmente' -- Modifica dati, non struttura
UNION ALL
SELECT '20251105000000', 'userdm329 INSERT policy on requests',
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'requests' AND policyname LIKE '%userdm329%insert%'
  ) THEN '✅' ELSE '❌' END
UNION ALL
SELECT '20251105000001', 'userdm329 can change any status',
  '⚠️ Verifica validate_status_transition function'
UNION ALL
SELECT '20251105000002', 'userdm329 history policies',
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'request_history' AND policyname LIKE '%userdm329%'
  ) THEN '✅' ELSE '❌' END
UNION ALL
SELECT '20251105000003', 'user_notification_preferences table',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'user_notification_preferences'
  ) THEN '✅' ELSE '❌' END
UNION ALL
SELECT '20251105000004', 'notification messages updated',
  '⚠️ Da verificare trigger/function'
UNION ALL
SELECT '20251106000000', 'request_completions table',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'request_completions'
  ) THEN '✅' ELSE '❌' END
UNION ALL
SELECT '20251106000001', 'send_email_notification function',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.routines WHERE routine_name = 'send_email_notification'
  ) THEN '✅' ELSE '❌' END
UNION ALL
SELECT '20251106000002', 'email notification fixes',
  '⚠️ Fix su function send_email_notification'
UNION ALL
SELECT '20251110000000', 'ARCHIVIATA status in ENUM',
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'request_status' AND e.enumlabel = 'ARCHIVIATA'
  ) THEN '✅' ELSE '❌' END
UNION ALL
SELECT '20251110000001', 'validate_status_transition with ARCHIVIATA',
  '⚠️ Verifica function validate_status_transition'
UNION ALL
SELECT '20251110000002', 'dm329_technical_data.off_cac column',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dm329_technical_data' AND column_name = 'off_cac'
  ) THEN '✅' ELSE '❌' END
UNION ALL
SELECT '20251111000000', 'dm329_technical_data.off_cac in schema',
  '⚠️ Duplicato di 20251110000002?'
UNION ALL
SELECT '20251111000001', 'dm329_technical_data.alert_3m/alert_15d columns',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dm329_technical_data' AND column_name = 'alert_3m'
  ) THEN '✅' ELSE '❌' END
UNION ALL
SELECT '20251112000000', 'fix_admin_user_sync',
  '⚠️ Fix function, da verificare'
UNION ALL
SELECT '20251112000001', 'get_recent_activity function',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.routines WHERE routine_name = 'get_recent_activity'
  ) THEN '✅' ELSE '❌' END
UNION ALL
SELECT '20251115120000', 'dm329_technical_data RLS recursion fix',
  '⚠️ Fix policies RLS'
UNION ALL
SELECT '20251115130000', 'dm329_technical_data.address_id column',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dm329_technical_data' AND column_name = 'address_id'
  ) THEN '✅' ELSE '❌' END
ORDER BY migration;
