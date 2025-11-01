-- Diagnostica per il sistema di ticketing
-- Eseguire questo script nel SQL Editor di Supabase per verificare la configurazione

-- 1. Verifica utenti esistenti e loro ruoli
SELECT 
  id,
  email,
  role,
  full_name,
  created_at
FROM users
ORDER BY role, email;

-- 2. Verifica che la funzione get_user_role esista e funzioni
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname = 'get_user_role';

-- 3. Verifica che la funzione validate_status_transition esista
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname = 'validate_status_transition';

-- 4. Verifica le RLS policies sulla tabella requests
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'requests'
ORDER BY policyname;

-- 5. Verifica che RLS sia abilitata
SELECT 
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('users', 'requests', 'request_history', 'request_types')
ORDER BY tablename;

-- 6. Test della funzione get_user_role (richede di essere autenticati)
-- Questa query mostrera il ruolo dell'utente corrente
SELECT get_user_role() as current_user_role;

-- 7. Verifica richieste esistenti con i loro stati
SELECT 
  r.id,
  r.title,
  r.status,
  rt.name as request_type,
  u_created.full_name as created_by_name,
  u_assigned.full_name as assigned_to_name
FROM requests r
JOIN request_types rt ON r.request_type_id = rt.id
LEFT JOIN users u_created ON r.created_by = u_created.id
LEFT JOIN users u_assigned ON r.assigned_to = u_assigned.id
ORDER BY r.created_at DESC
LIMIT 10;

-- 8. Verifica auth.users vs public.users
SELECT 
  au.id,
  au.email,
  au.created_at as auth_created_at,
  pu.email as public_email,
  pu.role,
  pu.full_name
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
ORDER BY au.created_at DESC;

