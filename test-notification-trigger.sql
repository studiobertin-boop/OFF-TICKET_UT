-- Test per verificare se la funzione create_notification supporta email

-- 1. Verifica che la funzione esista
SELECT
  proname as function_name,
  prosrc as function_source
FROM pg_proc
WHERE proname = 'create_notification';

-- 2. Verifica che pg_net sia installato (necessario per chiamate HTTP)
SELECT * FROM pg_extension WHERE extname = 'pg_net';

-- 3. Verifica preferenze email degli utenti di test
SELECT
  u.email,
  u.role,
  unp.in_app,
  unp.email as email_enabled,
  unp.status_transitions
FROM auth.users u
LEFT JOIN user_notification_preferences unp ON u.id = unp.user_id
WHERE u.email IN ('studiobertin@gmail.com', 'frabertin@yahoo.it')
ORDER BY u.email;
