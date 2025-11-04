-- Add is_hidden column to requests table for soft delete functionality
-- This allows admin to hide requests from normal view while keeping them in database

ALTER TABLE requests
ADD COLUMN is_hidden BOOLEAN NOT NULL DEFAULT false;

-- Create index for performance when filtering hidden/visible requests
CREATE INDEX idx_requests_hidden ON requests(is_hidden);

-- Create composite index for common queries (type + hidden status)
CREATE INDEX idx_requests_type_hidden ON requests(request_type_id, is_hidden);

-- Add comment for documentation
COMMENT ON COLUMN requests.is_hidden IS 'Soft delete flag - when true, request is hidden from normal view (admin only can see/restore)';
