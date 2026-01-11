-- Add 'active-projects' to widgets type constraint

DO $$ 
BEGIN
  -- Drop the old constraint
  ALTER TABLE widgets DROP CONSTRAINT IF EXISTS widgets_type_check;
  
  -- Add the new constraint with active-projects type
  ALTER TABLE widgets ADD CONSTRAINT widgets_type_check 
    CHECK (type IN ('todo-list', 'materials-shopping', 'project-todos', 'day-plan', 'active-projects'));
    
EXCEPTION 
  WHEN others THEN
    RAISE NOTICE 'Could not update widget type constraint: %', SQLERRM;
END $$;

