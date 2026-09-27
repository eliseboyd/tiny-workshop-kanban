-- Archived ideas and projects: set when archived from the project modal, NULL
-- otherwise. Archived rows drop off the board and the Ideas grid and are listed
-- in the Archived section of the Ideas tab. Clearing it restores the row to
-- where it was (is_idea / status are left untouched).

ALTER TABLE kanban.projects ADD COLUMN IF NOT EXISTS archived_at timestamptz;
