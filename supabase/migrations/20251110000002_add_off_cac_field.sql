-- Add off_cac field to requests table for DM329 categorization
-- Values: 'off' (OFFICOMP) or 'cac' (CAC)

ALTER TABLE requests
ADD COLUMN off_cac TEXT CHECK (off_cac IN ('off', 'cac', ''));

-- Add index for filtering by off_cac
CREATE INDEX idx_requests_off_cac ON requests(off_cac) WHERE off_cac IS NOT NULL AND off_cac != '';

COMMENT ON COLUMN requests.off_cac IS 'DM329 category: "off" for OFFICOMP, "cac" for CAC';
