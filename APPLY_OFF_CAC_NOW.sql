-- ============================================
-- APPLY THIS SQL IN SUPABASE SQL EDITOR NOW
-- ============================================
-- This adds the off_cac column to the requests table
-- Required before running the import script

-- Add off_cac column
ALTER TABLE requests
ADD COLUMN IF NOT EXISTS off_cac TEXT CHECK (off_cac IN ('off', 'cac', ''));

-- Add index for filtering
CREATE INDEX IF NOT EXISTS idx_requests_off_cac
ON requests(off_cac)
WHERE off_cac IS NOT NULL AND off_cac != '';

-- Verify column was created
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'requests' AND column_name = 'off_cac';
