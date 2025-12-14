-- Migration for filtering features
-- Run this in Supabase SQL Editor

-- Add parent_project_id to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS parent_project_id text;

-- Create tags table if it doesn't exist
CREATE TABLE IF NOT EXISTS tags (
  name text PRIMARY KEY,
  color text NOT NULL DEFAULT '#64748b',
  emoji text,
  icon text
);

-- If tags table already exists, add columns
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'tags') THEN
    ALTER TABLE tags ADD COLUMN IF NOT EXISTS emoji text;
    ALTER TABLE tags ADD COLUMN IF NOT EXISTS icon text;
  END IF;
END $$;

-- Create project_groups table
CREATE TABLE IF NOT EXISTS project_groups (
  id text PRIMARY KEY,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#64748b',
  emoji text,
  icon text,
  created_at timestamp NOT NULL DEFAULT NOW()
);

-- Add filter preferences to settings table
ALTER TABLE settings ADD COLUMN IF NOT EXISTS visible_projects text[] DEFAULT '{}';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS visible_tags text[] DEFAULT '{}';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS hidden_projects text[] DEFAULT '{}';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS hidden_tags text[] DEFAULT '{}';

