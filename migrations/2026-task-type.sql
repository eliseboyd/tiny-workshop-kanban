-- Add is_task field to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_task BOOLEAN DEFAULT FALSE;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_projects_is_task ON projects(is_task);

