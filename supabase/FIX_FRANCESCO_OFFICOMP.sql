-- ====================================================================
-- FIX per francesco.bertin@officomp.it (con UNA sola C)
-- ====================================================================

-- STEP 1: Verifica se esiste in public.users
SELECT
  'Verifica francesco.bertin@officomp.it in public.users:' as info,
  u.*
FROM public.users u
WHERE u.email = 'francesco.bertin@officomp.it';

-- STEP 2: Trova l'ID in auth.users
SELECT
  'ID in auth.users:' as info,
  au.id,
  au.email,
  au.created_at
FROM auth.users au
WHERE au.email = 'francesco.bertin@officomp.it';

-- STEP 3: Inserisci/Aggiorna in public.users
-- Usa l'ID trovato nella query precedente: 97dfd621-6905-46a8-9c97-a8326827d238
INSERT INTO public.users (id, email, role, full_name, is_suspended)
VALUES (
  '97dfd621-6905-46a8-9c97-a8326827d238',
  'francesco.bertin@officomp.it',
  'admin',
  'Francesco Bertin',
  false
)
ON CONFLICT (id) DO UPDATE SET
  email = 'francesco.bertin@officomp.it',
  role = 'admin',
  full_name = 'Francesco Bertin',
  is_suspended = false;

-- STEP 4: Verifica finale
SELECT
  'VERIFICA FINALE - Francesco Bertin:' as info,
  u.email,
  u.role,
  u.full_name,
  u.is_suspended,
  u.id
FROM public.users u
WHERE u.email = 'francesco.bertin@officomp.it';

-- STEP 5: Mostra tutti gli admin
SELECT
  'TUTTI GLI ADMIN:' as info,
  u.email,
  u.role,
  u.full_name
FROM public.users u
WHERE u.role = 'admin'
ORDER BY u.email;
