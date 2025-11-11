-- Add new status 'ARCHIVIATA NON FINITA' to dm329_status ENUM
-- This migration adds a new archival status for incomplete DM329 requests

-- Add the new value to the dm329_status ENUM
ALTER TYPE dm329_status ADD VALUE IF NOT EXISTS 'ARCHIVIATA NON FINITA';

-- Comment to document the new status
COMMENT ON TYPE dm329_status IS 'Status values for DM329 request type workflow. ARCHIVIATA NON FINITA represents requests that were archived without completion.';
