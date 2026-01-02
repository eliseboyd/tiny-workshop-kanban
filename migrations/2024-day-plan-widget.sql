-- Add day-plan widget type
-- Update the CHECK constraint to include 'day-plan'

-- First check if there are any existing widgets with unexpected types
DO $$ 
BEGIN
  -- Drop the old constraint if it exists
  ALTER TABLE widgets DROP CONSTRAINT IF EXISTS widgets_type_check;
  
  -- Add the new constraint with all known types
  ALTER TABLE widgets ADD CONSTRAINT widgets_type_check 
    CHECK (type IN ('todo-list', 'materials-shopping', 'project-todos', 'day-plan'));
    
EXCEPTION 
  WHEN check_violation THEN
    -- If there are widgets with other types, just log it and continue without the constraint
    RAISE NOTICE 'Some widgets have types not in the constraint. Constraint not added.';
END $$;

