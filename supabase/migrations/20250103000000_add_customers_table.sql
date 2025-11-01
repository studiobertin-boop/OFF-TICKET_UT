-- Migration: Add customers table with full-text search and RLS
-- Description: Creates customers table to replace free-text cliente field

-- Enable pg_trgm extension for fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create customers table
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ragione_sociale TEXT NOT NULL,
  external_id TEXT UNIQUE, -- For syncing with external Supabase project
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_by UUID REFERENCES auth.users(id),

  CONSTRAINT ragione_sociale_not_empty CHECK (length(trim(ragione_sociale)) > 0)
);

-- Create indexes for performance
CREATE INDEX idx_customers_ragione_sociale_gin ON customers USING gin (ragione_sociale gin_trgm_ops);
CREATE INDEX idx_customers_external_id ON customers(external_id) WHERE external_id IS NOT NULL;
CREATE INDEX idx_customers_active ON customers(is_active) WHERE is_active = true;
CREATE INDEX idx_customers_created_at ON customers(created_at DESC);

-- Create function for updated_at trigger
CREATE OR REPLACE FUNCTION update_customers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic updated_at
CREATE TRIGGER trigger_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION update_customers_updated_at();

-- Enable Row Level Security
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Everyone can view active customers
CREATE POLICY "Anyone can view active customers"
  ON customers
  FOR SELECT
  USING (
    is_active = true
    OR
    get_user_role() = 'admin'
  );

-- Only admins can insert customers
CREATE POLICY "Admin can insert customers"
  ON customers
  FOR INSERT
  WITH CHECK (get_user_role() = 'admin');

-- Only admins can update customers
CREATE POLICY "Admin can update customers"
  ON customers
  FOR UPDATE
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

-- Only admins can delete customers (soft delete via is_active recommended)
CREATE POLICY "Admin can delete customers"
  ON customers
  FOR DELETE
  USING (get_user_role() = 'admin');

-- Create helper function for fuzzy search
CREATE OR REPLACE FUNCTION search_customers(search_term TEXT, result_limit INT DEFAULT 100)
RETURNS TABLE (
  id UUID,
  ragione_sociale TEXT,
  similarity_score REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.ragione_sociale,
    similarity(c.ragione_sociale, search_term) AS similarity_score
  FROM customers c
  WHERE
    c.is_active = true
    AND (
      c.ragione_sociale ILIKE '%' || search_term || '%'
      OR
      similarity(c.ragione_sociale, search_term) > 0.3
    )
  ORDER BY similarity_score DESC, c.ragione_sociale
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to find potential duplicates
CREATE OR REPLACE FUNCTION find_duplicate_customers(customer_name TEXT, threshold REAL DEFAULT 0.6)
RETURNS TABLE (
  id UUID,
  ragione_sociale TEXT,
  similarity_score REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.ragione_sociale,
    similarity(c.ragione_sociale, customer_name) AS similarity_score
  FROM customers c
  WHERE
    c.is_active = true
    AND similarity(c.ragione_sociale, customer_name) > threshold
    AND c.ragione_sociale != customer_name
  ORDER BY similarity_score DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT SELECT ON customers TO authenticated;
GRANT ALL ON customers TO service_role;

-- Comment table and columns
COMMENT ON TABLE customers IS 'Customer master data for request management';
COMMENT ON COLUMN customers.ragione_sociale IS 'Customer company name (from external database)';
COMMENT ON COLUMN customers.external_id IS 'Reference ID from external Supabase project for sync';
COMMENT ON COLUMN customers.is_active IS 'Soft delete flag - false means customer is hidden';
