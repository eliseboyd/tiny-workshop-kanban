-- Create standalone_plans table for plans that can exist without being attached to a project
CREATE TABLE IF NOT EXISTS standalone_plans (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  size INTEGER NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create index for filtering by project
CREATE INDEX IF NOT EXISTS idx_standalone_plans_project_id ON standalone_plans(project_id);

-- Create index for sorting by date
CREATE INDEX IF NOT EXISTS idx_standalone_plans_created_at ON standalone_plans(created_at DESC);

