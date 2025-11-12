-- APPLY THIS IN SUPABASE SQL EDITOR
-- Fix admin user synchronization issue
-- This ensures that users in auth.users exist in public.users

-- 1. Check current state
SELECT 'Missing users in public.users:' as message;
SELECT
  au.id,
  au.email,
  au.created_at
FROM
  auth.users au
LEFT JOIN
  public.users u ON au.id = u.id
WHERE
  u.id IS NULL;

-- 2. Insert missing users from auth.users to public.users
INSERT INTO public.users (id, email, role, full_name, is_suspended)
SELECT
  au.id,
  au.email,
  'utente' as role,  -- Default role, must be changed by admin
  COALESCE(au.raw_user_meta_data->>'full_name', split_part(au.email, '@', 1)) as full_name,
  false as is_suspended
FROM
  auth.users au
LEFT JOIN
  public.users u ON au.id = u.id
WHERE
  u.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 3. Verify sync
SELECT 'Users synchronized successfully:' as message;
SELECT
  au.id,
  au.email,
  u.role,
  u.full_name,
  CASE WHEN u.id IS NULL THEN 'MISSING' ELSE 'EXISTS' END as status_in_users_table
FROM
  auth.users au
LEFT JOIN
  public.users u ON au.id = u.id
ORDER BY
  status_in_users_table DESC, au.email;

-- 4. IMPORTANT: Update the role for francesco.bertin@officomp.it if needed
-- After running this, go to the UI and manually update the role to 'admin'
-- Or run this query (uncomment if you want to do it now):
-- UPDATE public.users SET role = 'admin', full_name = 'Francesco Bertin' WHERE email = 'francesco.bertin@officomp.it';

SELECT 'IMPORTANT: If francesco.bertin@officomp.it should be admin, update the role manually in the users table!' as reminder;
