-- ====================================================================
-- OPZIONE 1: Se francesco.bertin@officomp.it NON esiste in auth.users
-- Devi prima crearlo manualmente in Supabase Dashboard > Authentication
-- ====================================================================

-- Dopo aver creato l'utente in Authentication, esegui questo:

-- STEP 1: Trova l'ID dell'utente appena creato
SELECT
  'ID utente francesco.bertin@officomp.it:' as info,
  au.id,
  au.email,
  au.created_at
FROM auth.users au
WHERE au.email = 'francesco.bertin@officomp.it';

-- STEP 2: Inserisci in public.users (sostituisci 'USER_ID_QUI' con l'ID trovato sopra)
-- NOTA: Se l'ID non viene trovato, l'utente NON esiste in auth.users
-- In quel caso, devi PRIMA crearlo in Supabase Dashboard > Authentication

-- Esegui questo SOLO dopo aver ottenuto l'ID dallo STEP 1:
/*
INSERT INTO public.users (id, email, role, full_name, is_suspended)
VALUES (
  'INSERISCI_ID_QUI',  -- Sostituisci con l'ID trovato nello STEP 1
  'francesco.bertin@officomp.it',
  'admin',
  'Francesco Bertin',
  false
)
ON CONFLICT (id) DO UPDATE SET
  role = 'admin',
  full_name = 'Francesco Bertin',
  is_suspended = false;
*/

-- ====================================================================
-- OPZIONE 2: Se vuoi RINOMINARE un utente esistente
-- ====================================================================

-- Ad esempio, se vuoi rinominare frabertin@yahoo.it → francesco.bertin@officomp.it
-- ATTENZIONE: Questo aggiorna SOLO public.users, non auth.users
-- Per cambiare l'email in auth.users devi farlo da Supabase Dashboard

/*
UPDATE public.users
SET
  email = 'francesco.bertin@officomp.it',
  role = 'admin',
  full_name = 'Francesco Bertin'
WHERE email = 'frabertin@yahoo.it';
*/

-- ====================================================================
-- OPZIONE 3: Se vuoi che frabertin@yahoo.it diventi admin
-- ====================================================================

/*
UPDATE public.users
SET
  role = 'admin',
  full_name = 'Francesco Bertin'
WHERE email = 'frabertin@yahoo.it';
*/

-- ====================================================================
-- VERIFICA FINALE
-- ====================================================================
SELECT
  'VERIFICA ADMIN DOPO MODIFICHE:' as info,
  u.email,
  u.role,
  u.full_name,
  u.id
FROM public.users u
WHERE u.role = 'admin'
ORDER BY u.email;
