-- Fix duplicate and suboptimal RLS policies on projects, columns, settings
--
-- The broad "Allow all for authenticated users" policy on each table:
--   1. Re-evaluates auth.<function>() per row instead of once (auth_rls_initplan warning)
--   2. Overlaps with the specific per-operation policies added later (multiple_permissive_policies warning)
--
-- Dropping the broad policy resolves both warnings. The specific policies
-- (Auth users can view/insert/update/delete + Allow anonymous read) remain and cover all needed access.

DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.projects;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.columns;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.settings;
