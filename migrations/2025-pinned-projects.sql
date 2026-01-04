-- Add pinned field to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS pinned BOOLEAN DEFAULT FALSE;

-- Create index for better query performance when sorting by pinned
CREATE INDEX IF NOT EXISTS idx_projects_pinned ON projects(pinned);

