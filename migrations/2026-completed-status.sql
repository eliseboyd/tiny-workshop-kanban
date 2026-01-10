-- Add is_completed field to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_completed BOOLEAN DEFAULT FALSE;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_projects_is_completed ON projects(is_completed);

-- Optionally: Set existing projects in "done" columns as completed
-- UPDATE projects SET is_completed = TRUE 
-- WHERE LOWER(status) IN ('done', 'completed', 'complete');

