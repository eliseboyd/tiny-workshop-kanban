-- Project membership is derived from tags (see 2026-project-groups-as-tag-sets);
-- the per-card pointer is dead.
ALTER TABLE kanban.projects DROP COLUMN IF EXISTS parent_project_id;
