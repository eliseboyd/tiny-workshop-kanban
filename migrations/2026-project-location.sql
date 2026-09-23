-- A card's location: Merlin's public.locations.key ('home' / 'studio'), or
-- NULL for "anywhere". The board hides cards from other locations while the
-- dashboard switcher says you are somewhere. No cross-schema FK; an unknown
-- key reads as "anywhere".

ALTER TABLE kanban.projects ADD COLUMN IF NOT EXISTS location_key text;
