-- Check for users in auth.users but not in public.users
-- Run this in Supabase SQL Editor

SELECT
  au.id,
  au.email,
  au.created_at as auth_created_at,
  CASE WHEN u.id IS NULL THEN 'MISSING' ELSE 'EXISTS' END as status_in_users_table
FROM
  auth.users au
LEFT JOIN
  public.users u ON au.id = u.id
ORDER BY
  status_in_users_table DESC, au.email;

-- Show only missing users
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
