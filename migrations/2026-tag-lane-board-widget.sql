-- Add 'tag-lane-board' dashboard widget type

DO $$
BEGIN
  ALTER TABLE widgets DROP CONSTRAINT IF EXISTS widgets_type_check;

  ALTER TABLE widgets ADD CONSTRAINT widgets_type_check
    CHECK (type IN (
      'todo-list',
      'materials-shopping',
      'project-todos',
      'day-plan',
      'active-projects',
      'tag-lane-board'
    ));

EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'Could not update widget type constraint: %', SQLERRM;
END $$;
