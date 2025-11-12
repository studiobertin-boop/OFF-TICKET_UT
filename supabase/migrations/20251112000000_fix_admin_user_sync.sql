-- Fix admin user synchronization issue
-- This migration ensures that users in auth.users exist in public.users

-- 1. Insert missing users from auth.users to public.users
-- This will add any user that exists in auth but not in public.users
-- Default role is 'utente' for safety - admin should manually update roles
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

-- 2. Log the sync operation
DO $$
DECLARE
  missing_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO missing_count
  FROM auth.users au
  LEFT JOIN public.users u ON au.id = u.id
  WHERE u.id IS NULL;

  IF missing_count > 0 THEN
    RAISE NOTICE 'Added % missing user(s) from auth.users to public.users', missing_count;
  ELSE
    RAISE NOTICE 'All auth.users are already synchronized with public.users';
  END IF;
END $$;

-- 3. Create a function to automatically sync new auth users (optional, for future)
-- This function can be triggered on auth.users insert
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.users (id, email, role, full_name, is_suspended)
  VALUES (
    NEW.id,
    NEW.email,
    'utente',  -- Default role
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    false
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Note: The trigger on auth.users can only be created by Supabase admins
-- You may need to create this manually in the Supabase dashboard:
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

COMMENT ON FUNCTION public.handle_new_auth_user() IS
'Automatically creates a corresponding entry in public.users when a new auth user is created. Must be manually triggered via auth.users trigger.';
