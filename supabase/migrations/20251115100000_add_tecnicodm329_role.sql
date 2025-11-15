-- Migration: Add tecnicoDM329 role
-- Description: Creates new role for DM329 technical staff who can only access assigned sheets
-- Date: 2025-11-15

-- Add new role to user_role enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'tecnicoDM329';

-- Note: RLS policies will be added in subsequent migrations for:
-- 1. dm329_technical_data table (tecnicoDM329 can view/edit only assigned sheets)
-- 2. requests table (tecnicoDM329 can view only assigned DM329 requests)
