-- Dashboard Widgets Migration
-- Adds a widgets table for storing configurable dashboard widgets

CREATE TABLE IF NOT EXISTS widgets (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('todo-list', 'materials-shopping', 'project-todos')),
  title TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for position-based ordering
CREATE INDEX IF NOT EXISTS idx_widgets_position ON widgets(position);

-- Enable RLS
ALTER TABLE widgets ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users (same as other tables)
CREATE POLICY "Allow authenticated users full access to widgets"
ON widgets
FOR ALL
USING (true)
WITH CHECK (true);

