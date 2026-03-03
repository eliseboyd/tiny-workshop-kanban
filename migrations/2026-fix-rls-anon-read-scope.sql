-- Scope "Allow anonymous read" policies to the anon role only
--
-- These policies currently apply to all roles (no TO clause), which means they
-- overlap with "Auth users can view columns/settings" for the authenticated role,
-- triggering multiple_permissive_policies warnings.
-- Restricting them to TO anon removes the overlap while preserving anonymous read access.

DROP POLICY IF EXISTS "Allow anonymous read" ON public.columns;
CREATE POLICY "Allow anonymous read" ON public.columns
  FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "Allow anonymous read" ON public.settings;
CREATE POLICY "Allow anonymous read" ON public.settings
  FOR SELECT
  TO anon
  USING (true);
