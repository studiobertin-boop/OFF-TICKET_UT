-- =====================================================
-- DIAGNOSTICA: Verifica Stato Notifiche Email
-- =====================================================
-- Esegui questo script nel SQL Editor di Supabase Dashboard
-- per capire se le notifiche email sono configurate correttamente
-- =====================================================

-- 1. Verifica che pg_net sia installato
SELECT
  'pg_net extension' as check_name,
  CASE
    WHEN COUNT(*) > 0 THEN '✅ Installato'
    ELSE '❌ MANCANTE - Eseguire: CREATE EXTENSION pg_net;'
  END as status
FROM pg_extension
WHERE extname = 'pg_net';

-- 2. Verifica che la funzione create_notification supporti email
SELECT
  'create_notification function' as check_name,
  CASE
    WHEN prosrc::text LIKE '%pg_net%' OR prosrc::text LIKE '%http_post%' THEN '✅ Ha supporto email'
    ELSE '❌ NON ha supporto email - Applicare migration 20251106000002_fix_email_notifications.sql'
  END as status
FROM pg_proc
WHERE proname = 'create_notification';

-- 3. Verifica che il trigger esista
SELECT
  'trigger_notify_request_status_change' as check_name,
  CASE
    WHEN COUNT(*) > 0 THEN '✅ Trigger configurato'
    ELSE '❌ Trigger mancante'
  END as status
FROM pg_trigger
WHERE tgname = 'trigger_notify_request_status_change';

-- 4. Verifica preferenze email utenti di test
SELECT
  '=== PREFERENZE UTENTI ===' as section,
  '' as data;

SELECT
  au.email as user_email,
  u.role as user_role,
  COALESCE(unp.in_app::text, 'NULL') as in_app_enabled,
  COALESCE(unp.email::text, 'NULL') as email_enabled,
  CASE
    WHEN unp.email = true THEN '✅ Email abilitate'
    WHEN unp.email = false THEN '⚠️  Email disabilitate'
    ELSE '❌ Preferenze non trovate'
  END as status,
  unp.status_transitions as transitions
FROM auth.users au
LEFT JOIN users u ON u.id = au.id
LEFT JOIN user_notification_preferences unp ON au.id = unp.user_id
WHERE au.email IN ('studiobertin@gmail.com', 'frabertin@yahoo.it')
ORDER BY au.email;

-- 5. Verifica ultime notifiche create
SELECT
  '=== ULTIME NOTIFICHE ===' as section,
  '' as data;

SELECT
  n.created_at,
  au.email as user_email,
  n.event_type,
  n.message,
  n.type,
  r.title as request_title
FROM notifications n
JOIN auth.users au ON n.user_id = au.id
LEFT JOIN requests r ON n.request_id = r.id
WHERE au.email IN ('studiobertin@gmail.com', 'frabertin@yahoo.it')
ORDER BY n.created_at DESC
LIMIT 10;

-- 6. Test query per vedere se http_post funzionerebbe
SELECT
  '=== TEST pg_net ===' as section,
  '' as data;

SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_proc WHERE proname = 'http_post' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'net')
    ) THEN '✅ Funzione net.http_post disponibile'
    ELSE '❌ Funzione net.http_post NON disponibile'
  END as status;

-- =====================================================
-- INTERPRETAZIONE RISULTATI
-- =====================================================
--
-- Se vedi:
-- 1. ✅ per pg_net → OK
-- 2. ❌ per create_notification → PROBLEMA: Funzione non aggiornata
-- 3. ⚠️ o ❌ per preferenze utenti → PROBLEMA: Email non abilitate
-- 4. Nessuna notifica recente → PROBLEMA: Trigger non funziona o eventi non creati
--
-- SOLUZIONI:
-- - Se create_notification non ha supporto email: Esegui MANUAL_APPLY_EMAIL_FUNCTION.sql
-- - Se email disabilitate: Attiva toggle nelle Impostazioni Notifiche dell'app
-- - Se pg_net mancante: Esegui CREATE EXTENSION pg_net; (richiede permessi superuser)
-- =====================================================
