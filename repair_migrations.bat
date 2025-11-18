@echo off
echo Repairing migrations...

supabase migration repair --status applied 20251104000001
supabase migration repair --status applied 20251104000002
supabase migration repair --status applied 20251104000003
supabase migration repair --status applied 20251104000004
supabase migration repair --status applied 20251105000000
supabase migration repair --status applied 20251105000001
supabase migration repair --status applied 20251105000002
supabase migration repair --status applied 20251105000003
supabase migration repair --status applied 20251105000004
supabase migration repair --status applied 20251106000000
supabase migration repair --status applied 20251106000001
supabase migration repair --status applied 20251106000002
supabase migration repair --status applied 20251110000000
supabase migration repair --status applied 20251110000001
supabase migration repair --status applied 20251110000002
supabase migration repair --status applied 20251111000000
supabase migration repair --status applied 20251111000001
supabase migration repair --status applied 20251112000000
supabase migration repair --status applied 20251112000001
supabase migration repair --status applied 20251115120000
supabase migration repair --status applied 20251115130000

echo.
echo Migration repair completed!
pause
