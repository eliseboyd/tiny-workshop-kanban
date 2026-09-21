-- Projects become named collections of tags; membership is derived from a
-- card's tags rather than stored on the card. projects.parent_project_id is
-- left in place but no longer read or written.
ALTER TABLE kanban.project_groups
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS match_mode TEXT NOT NULL DEFAULT 'any'
    CHECK (match_mode IN ('any', 'all'));

-- Backfill each existing group with the tags its cards already carry.
UPDATE kanban.project_groups g
SET tags = COALESCE((
  SELECT array_agg(DISTINCT t)
  FROM kanban.projects p, unnest(COALESCE(p.tags, '{}')) t
  WHERE p.parent_project_id = g.id
), '{}');
