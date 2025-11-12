-- ====================================================================
-- TROVA TUTTI GLI ADMIN
-- ====================================================================
SELECT
  'TUTTI GLI UTENTI ADMIN:' as info,
  u.email,
  u.full_name,
  u.role,
  u.id
FROM public.users u
WHERE u.role = 'admin'
ORDER BY u.email;

-- ====================================================================
-- CERCA francesco.bertin in TUTTE le varianti
-- ====================================================================
SELECT
  'CERCO "francesco" o "bertin" in auth.users:' as info,
  au.email,
  au.id,
  au.created_at
FROM auth.users au
WHERE
  au.email ILIKE '%francesco%'
  OR au.email ILIKE '%bertin%'
ORDER BY au.email;

SELECT
  'CERCO "francesco" o "bertin" in public.users:' as info,
  u.email,
  u.full_name,
  u.role,
  u.id
FROM public.users u
WHERE
  u.email ILIKE '%francesco%'
  OR u.email ILIKE '%bertin%'
  OR u.full_name ILIKE '%francesco%'
  OR u.full_name ILIKE '%bertin%'
ORDER BY u.email;

-- ====================================================================
-- MOSTRA TUTTI gli utenti di auth.users
-- ====================================================================
SELECT
  'TUTTI GLI UTENTI IN auth.users:' as info,
  au.email,
  au.id,
  au.created_at
FROM auth.users au
ORDER BY au.email;

-- ====================================================================
-- CONFRONTO: chi è in auth ma non in public?
-- ====================================================================
SELECT
  'UTENTI IN AUTH.USERS MA NON IN PUBLIC.USERS:' as info,
  au.email,
  au.id
FROM auth.users au
LEFT JOIN public.users u ON au.id = u.id
WHERE u.id IS NULL;
