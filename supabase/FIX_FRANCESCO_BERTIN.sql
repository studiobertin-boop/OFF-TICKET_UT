-- ====================================================================
-- STEP 1: Verifica quali utenti esistono in auth.users
-- ====================================================================
SELECT
  'UTENTI IN AUTH.USERS:' as info,
  au.email,
  au.id,
  au.created_at
FROM auth.users au
ORDER BY au.email;

-- ====================================================================
-- STEP 2: Verifica quali utenti esistono in public.users
-- ====================================================================
SELECT
  'UTENTI IN PUBLIC.USERS:' as info,
  u.email,
  u.id,
  u.role,
  u.full_name
FROM public.users u
ORDER BY u.email;

-- ====================================================================
-- STEP 3: Trova utenti MANCANTI in public.users
-- ====================================================================
SELECT
  'UTENTI MANCANTI IN PUBLIC.USERS:' as info,
  au.email,
  au.id
FROM auth.users au
LEFT JOIN public.users u ON au.id = u.id
WHERE u.id IS NULL;

-- ====================================================================
-- STEP 4: SINCRONIZZA tutti gli utenti mancanti
-- ====================================================================
-- Questo inserisce TUTTI gli utenti che sono in auth.users
-- ma non in public.users, con ruolo default 'utente'
INSERT INTO public.users (id, email, role, full_name, is_suspended)
SELECT
  au.id,
  au.email,
  'utente' as role,
  COALESCE(
    au.raw_user_meta_data->>'full_name',
    split_part(au.email, '@', 1)
  ) as full_name,
  false as is_suspended
FROM auth.users au
LEFT JOIN public.users u ON au.id = u.id
WHERE u.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- ====================================================================
-- STEP 5: AGGIORNA francesco.bertin@officomp.it come ADMIN
-- ====================================================================
UPDATE public.users
SET
  role = 'admin',
  full_name = 'Francesco Bertin'
WHERE email = 'francesco.bertin@officomp.it';

-- ====================================================================
-- STEP 6: VERIFICA FINALE
-- ====================================================================
SELECT
  'VERIFICA FINALE - TUTTI GLI UTENTI:' as info,
  u.email,
  u.role,
  u.full_name,
  u.is_suspended
FROM public.users u
ORDER BY u.role, u.email;

-- ====================================================================
-- STEP 7: CONTROLLA francesco.bertin@officomp.it
-- ====================================================================
SELECT
  'FRANCESCO BERTIN DETAILS:' as info,
  u.*
FROM public.users u
WHERE email = 'francesco.bertin@officomp.it';
