-- Migration: Remove file fields from request types
-- Date: 2026-01-29
-- Description: Removes non-functional 'file' type fields from request type schemas.
--              Files should be attached using the dedicated Attachments section instead.

-- Remove file_attachment field from all request types that have it
UPDATE request_types
SET fields_schema = (
  SELECT jsonb_agg(field)
  FROM jsonb_array_elements(fields_schema) AS field
  WHERE field->>'type' != 'file'
)
WHERE fields_schema @> '[{"type": "file"}]';

-- Note: This removes all fields with type='file' from the fields_schema JSONB array.
-- Existing data in custom_fields.file_attachment will remain but won't be displayed
-- since the field is no longer in the schema.
-- Users should use the Attachments section to upload files.
