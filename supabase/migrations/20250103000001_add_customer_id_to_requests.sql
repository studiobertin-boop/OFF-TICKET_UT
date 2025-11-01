-- Migration: Add customer_id to requests table
-- Description: Links requests to customers table with foreign key

-- Add customer_id column to requests table
ALTER TABLE requests
ADD COLUMN customer_id UUID REFERENCES customers(id) ON DELETE RESTRICT;

-- Create index for performance (join and filter operations)
CREATE INDEX idx_requests_customer_id ON requests(customer_id);

-- Add comment
COMMENT ON COLUMN requests.customer_id IS 'Foreign key to customers table - required for all new requests';

-- Note: NOT NULL constraint will be added after migrating existing data
-- For now, allow NULL to maintain backward compatibility with existing requests

-- Update get_user_role function if it doesn't exist (compatibility check)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_user_role') THEN
    CREATE OR REPLACE FUNCTION get_user_role()
    RETURNS TEXT AS $func$
    BEGIN
      RETURN (
        SELECT role
        FROM users
        WHERE id = auth.uid()
      );
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER;
  END IF;
END $$;
