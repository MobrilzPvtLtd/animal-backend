-- ============================================================
-- MIGRATION 042: ADD REACTION COLUMN TO POST_LIKES & RLS POLICIES
-- ============================================================

ALTER TABLE public.post_likes 
ADD COLUMN IF NOT EXISTS reaction TEXT DEFAULT 'like';

-- Add RLS Policies for post_likes and community_comments
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public select post_likes" ON public.post_likes;
CREATE POLICY "Allow public select post_likes"
  ON public.post_likes FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated write post_likes" ON public.post_likes;
CREATE POLICY "Allow authenticated write post_likes"
  ON public.post_likes FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public select community_comments" ON public.community_comments;
CREATE POLICY "Allow public select community_comments"
  ON public.community_comments FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated write community_comments" ON public.community_comments;
CREATE POLICY "Allow authenticated write community_comments"
  ON public.community_comments FOR ALL TO authenticated USING (true) WITH CHECK (true);
