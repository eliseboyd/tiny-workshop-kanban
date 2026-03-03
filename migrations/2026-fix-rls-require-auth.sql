-- Overhaul all RLS policies to properly require authentication
--
-- Problems fixed:
--   1. rls_policy_always_true  — USING/WITH CHECK (true) on write operations
--      does not verify the user is logged in; replaced with auth.uid() IS NOT NULL
--   2. anonymous read policies dropped — the app requires login, no public access
--   3. (select auth.uid()) wrapper prevents per-row re-evaluation (auth_rls_initplan)
--   4. TO authenticated scoping prevents policy overlap across roles

-- ── columns ──────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Allow anonymous read"          ON public.columns;
DROP POLICY IF EXISTS "Auth users can view columns"   ON public.columns;
DROP POLICY IF EXISTS "Auth users can insert columns" ON public.columns;
DROP POLICY IF EXISTS "Auth users can update columns" ON public.columns;
DROP POLICY IF EXISTS "Auth users can delete columns" ON public.columns;

CREATE POLICY "Auth users can view columns" ON public.columns
  FOR SELECT TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Auth users can insert columns" ON public.columns
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Auth users can update columns" ON public.columns
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Auth users can delete columns" ON public.columns
  FOR DELETE TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

-- ── projects ─────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Auth users can view projects"   ON public.projects;
DROP POLICY IF EXISTS "Auth users can insert projects" ON public.projects;
DROP POLICY IF EXISTS "Auth users can update projects" ON public.projects;
DROP POLICY IF EXISTS "Auth users can delete projects" ON public.projects;

CREATE POLICY "Auth users can view projects" ON public.projects
  FOR SELECT TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Auth users can insert projects" ON public.projects
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Auth users can update projects" ON public.projects
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Auth users can delete projects" ON public.projects
  FOR DELETE TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

-- ── settings ─────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Allow anonymous read"           ON public.settings;
DROP POLICY IF EXISTS "Auth users can view settings"   ON public.settings;
DROP POLICY IF EXISTS "Auth users can insert settings" ON public.settings;
DROP POLICY IF EXISTS "Auth users can update settings" ON public.settings;

CREATE POLICY "Auth users can view settings" ON public.settings
  FOR SELECT TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Auth users can insert settings" ON public.settings
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Auth users can update settings" ON public.settings
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- ── project_groups ───────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Allow authenticated users full access to project_groups" ON public.project_groups;

CREATE POLICY "Allow authenticated users full access to project_groups" ON public.project_groups
  FOR ALL TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- ── quick_add_tokens ─────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Allow authenticated users full access to quick_add_tokens" ON public.quick_add_tokens;

CREATE POLICY "Allow authenticated users full access to quick_add_tokens" ON public.quick_add_tokens
  FOR ALL TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- ── standalone_plans ─────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Allow authenticated users full access to standalone_plans" ON public.standalone_plans;

CREATE POLICY "Allow authenticated users full access to standalone_plans" ON public.standalone_plans
  FOR ALL TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- ── tags ─────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Allow authenticated users full access to tags" ON public.tags;

CREATE POLICY "Allow authenticated users full access to tags" ON public.tags
  FOR ALL TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- ── widgets ──────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Allow authenticated users full access to widgets" ON public.widgets;

CREATE POLICY "Allow authenticated users full access to widgets" ON public.widgets
  FOR ALL TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);
