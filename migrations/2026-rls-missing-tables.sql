-- Enable RLS on tables missing row level security
-- Run this in the Supabase SQL Editor

-- tags
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users full access to tags"
ON tags
FOR ALL
USING (true)
WITH CHECK (true);

-- project_groups
ALTER TABLE project_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users full access to project_groups"
ON project_groups
FOR ALL
USING (true)
WITH CHECK (true);

-- standalone_plans
ALTER TABLE standalone_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users full access to standalone_plans"
ON standalone_plans
FOR ALL
USING (true)
WITH CHECK (true);

-- quick_add_tokens
ALTER TABLE quick_add_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users full access to quick_add_tokens"
ON quick_add_tokens
FOR ALL
USING (true)
WITH CHECK (true);
