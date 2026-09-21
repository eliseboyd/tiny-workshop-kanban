-- Persist collapsed board columns across browsers/sessions (was localStorage).
ALTER TABLE kanban.settings
ADD COLUMN IF NOT EXISTS hidden_columns TEXT[] DEFAULT '{}';
