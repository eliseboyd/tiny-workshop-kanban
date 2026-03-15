-- Add image_styles table for AI cover image style library

CREATE TABLE IF NOT EXISTS public.image_styles (
  id          text        PRIMARY KEY,
  name        text        NOT NULL,
  prompt_override text   NOT NULL DEFAULT '',
  reference_images text[] DEFAULT '{}',
  position    integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.image_styles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view image_styles" ON public.image_styles
  FOR SELECT TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Auth users can insert image_styles" ON public.image_styles
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Auth users can update image_styles" ON public.image_styles
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Auth users can delete image_styles" ON public.image_styles
  FOR DELETE TO authenticated
  USING ((select auth.uid()) IS NOT NULL);
