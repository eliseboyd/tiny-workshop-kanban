-- Per-location dashboard layouts. A widget with a location_key only shows when
-- that location (Merlin's public.locations.key, e.g. 'home' / 'studio') is the
-- current one. NULL = shown everywhere, which is what every existing widget gets.
--
-- No foreign key: locations live in Merlin's schema, and a widget must not
-- vanish because a location was deleted there — the board treats an unknown
-- key as "everywhere".

ALTER TABLE kanban.widgets ADD COLUMN IF NOT EXISTS location_key text;
