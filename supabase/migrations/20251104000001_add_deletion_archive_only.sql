-- Migration: Add deletion archive system (standalone)
-- Date: 2025-11-04
-- Description: Adds ONLY deletion_archives table and storage bucket
-- This migration is safe to run on existing databases

-- =====================================================
-- PART 1: Create deletion_archives table (if not exists)
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'deletion_archives') THEN
    CREATE TABLE deletion_archives (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size BIGINT,
      deleted_count INTEGER NOT NULL,
      deleted_by UUID NOT NULL REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT valid_deleted_count CHECK (deleted_count > 0)
    );

    COMMENT ON TABLE deletion_archives IS 'Stores metadata about bulk deletion PDF archives';
    COMMENT ON COLUMN deletion_archives.file_name IS 'PDF filename';
    COMMENT ON COLUMN deletion_archives.file_path IS 'Path in Supabase Storage';
    COMMENT ON COLUMN deletion_archives.deleted_count IS 'Number of requests deleted in this archive';
    COMMENT ON COLUMN deletion_archives.deleted_by IS 'Admin user who performed the deletion';
  END IF;
END $$;

-- =====================================================
-- PART 2: Create storage bucket for deletion archives
-- =====================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('deletion-archives', 'deletion-archives', false)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- PART 3: RLS policies for deletion_archives table
-- =====================================================

ALTER TABLE deletion_archives ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admin can view all deletion archives" ON deletion_archives;
DROP POLICY IF EXISTS "Admin can create deletion archives" ON deletion_archives;

-- Admin can view all archives
CREATE POLICY "Admin can view all deletion archives"
  ON deletion_archives FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Admin can create archives
CREATE POLICY "Admin can create deletion archives"
  ON deletion_archives FOR INSERT
  WITH CHECK (
    deleted_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- =====================================================
-- PART 4: Storage policies for deletion-archives bucket
-- =====================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admin can upload deletion archive PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Admin can view deletion archive PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Admin can delete deletion archive PDFs" ON storage.objects;

-- Admin can upload PDFs
CREATE POLICY "Admin can upload deletion archive PDFs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'deletion-archives' AND
    (storage.foldername(name))[1] = auth.uid()::TEXT AND
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Admin can view all PDFs
CREATE POLICY "Admin can view deletion archive PDFs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'deletion-archives' AND
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Admin can delete PDFs (if needed for cleanup)
CREATE POLICY "Admin can delete deletion archive PDFs"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'deletion-archives' AND
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- =====================================================
-- PART 5: Update RLS policies for requests DELETE
-- =====================================================

-- Drop existing delete policy if any
DROP POLICY IF EXISTS "Admin can delete completed requests" ON requests;

-- Only admin can delete requests, and only if COMPLETATA or 7-CHIUSA
CREATE POLICY "Admin can delete completed requests"
  ON requests FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    ) AND
    (status = 'COMPLETATA' OR status = '7-CHIUSA')
  );

COMMENT ON POLICY "Admin can delete completed requests" ON requests IS 'Admin can only delete completed (COMPLETATA) or closed (7-CHIUSA) requests';

-- =====================================================
-- PART 6: Indexes for performance
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_deletion_archives_created_at ON deletion_archives(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deletion_archives_deleted_by ON deletion_archives(deleted_by);
CREATE INDEX IF NOT EXISTS idx_requests_deletable ON requests(status) WHERE status IN ('COMPLETATA', '7-CHIUSA');
