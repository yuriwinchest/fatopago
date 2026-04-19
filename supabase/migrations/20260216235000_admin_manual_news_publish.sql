-- Admin manual news support:
-- 1) priority fields on news_tasks
-- 2) secure RPC to publish manual news tied to active cycle
-- 3) storage bucket/policies for admin image uploads

ALTER TABLE public.news_tasks
  ADD COLUMN IF NOT EXISTS is_admin_post BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS admin_priority INTEGER,
  ADD COLUMN IF NOT EXISTS admin_created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'news_tasks_admin_priority_chk'
  ) THEN
    ALTER TABLE public.news_tasks
      ADD CONSTRAINT news_tasks_admin_priority_chk
      CHECK (admin_priority IS NULL OR (admin_priority BETWEEN 1 AND 20));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS news_tasks_admin_priority_idx
  ON public.news_tasks (is_admin_post DESC, admin_priority ASC, cycle_start_at DESC, created_at DESC);

CREATE OR REPLACE FUNCTION public.admin_create_news_task(
  p_title TEXT,
  p_description TEXT,
  p_full_text TEXT DEFAULT NULL,
  p_source TEXT DEFAULT 'Admin FatoPago',
  p_category TEXT DEFAULT 'Brasil',
  p_link TEXT DEFAULT NULL,
  p_image_url TEXT DEFAULT NULL,
  p_priority INTEGER DEFAULT 1
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_email TEXT;
  v_title TEXT;
  v_description TEXT;
  v_full_text TEXT;
  v_source TEXT;
  v_category TEXT;
  v_link TEXT;
  v_image_url TEXT;
  v_priority INTEGER;
  v_cycle_start TIMESTAMPTZ;
  v_cycle_number INTEGER;
  v_id UUID;
BEGIN
  v_admin_email := COALESCE(auth.jwt()->>'email', '');
  IF v_admin_email <> 'fatopago@gmail.com' THEN
    RAISE EXCEPTION 'Acesso negado: apenas admin pode publicar notícia manual.';
  END IF;

  v_title := LEFT(TRIM(COALESCE(p_title, '')), 220);
  v_description := TRIM(COALESCE(p_description, ''));
  v_full_text := TRIM(COALESCE(NULLIF(p_full_text, ''), v_description));
  v_source := LEFT(TRIM(COALESCE(NULLIF(p_source, ''), 'Admin FatoPago')), 90);
  v_category := LEFT(TRIM(COALESCE(NULLIF(p_category, ''), 'Brasil')), 60);
  v_link := NULLIF(TRIM(COALESCE(p_link, '')), '');
  v_image_url := NULLIF(TRIM(COALESCE(p_image_url, '')), '');
  v_priority := LEAST(GREATEST(COALESCE(p_priority, 1), 1), 20);

  IF LENGTH(v_title) < 6 THEN
    RAISE EXCEPTION 'Título inválido (mínimo 6 caracteres).';
  END IF;

  IF LENGTH(v_description) < 20 THEN
    RAISE EXCEPTION 'Texto inválido (mínimo 20 caracteres).';
  END IF;

  -- Active cycle: latest cycle that already started.
  SELECT nt.cycle_start_at, nt.cycle_number
    INTO v_cycle_start, v_cycle_number
  FROM public.news_tasks nt
  WHERE nt.cycle_start_at IS NOT NULL
    AND nt.cycle_start_at <= NOW()
  ORDER BY nt.cycle_start_at DESC, nt.created_at DESC
  LIMIT 1;

  -- Fallback: latest known cycle (if all are future/pre-created).
  IF v_cycle_start IS NULL THEN
    SELECT nt.cycle_start_at, nt.cycle_number
      INTO v_cycle_start, v_cycle_number
    FROM public.news_tasks nt
    WHERE nt.cycle_start_at IS NOT NULL
    ORDER BY nt.cycle_start_at DESC, nt.created_at DESC
    LIMIT 1;
  END IF;

  -- Last resort.
  IF v_cycle_start IS NULL THEN
    v_cycle_start := date_trunc('day', NOW());
    v_cycle_number := 1;
  END IF;

  INSERT INTO public.news_tasks (
    content,
    cycle_start_at,
    cycle_number,
    is_admin_post,
    admin_priority,
    admin_created_by
  )
  VALUES (
    jsonb_build_object(
      'title', v_title,
      'description', v_description,
      'full_text', v_full_text,
      'source', v_source,
      'category', v_category,
      'difficulty', 'medium',
      'image_url', v_image_url,
      'link', v_link,
      'reward', 0
    ),
    v_cycle_start,
    COALESCE(v_cycle_number, 1),
    TRUE,
    v_priority,
    auth.uid()
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_news_task(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_create_news_task(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER) TO authenticated;

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'news-images',
  'news-images',
  TRUE,
  8388608,
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'News images are public'
  ) THEN
    CREATE POLICY "News images are public"
      ON storage.objects
      FOR SELECT
      USING (bucket_id = 'news-images');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Admin can upload news images'
  ) THEN
    CREATE POLICY "Admin can upload news images"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'news-images'
        AND (auth.jwt()->>'email') = 'fatopago@gmail.com'
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Admin can update news images'
  ) THEN
    CREATE POLICY "Admin can update news images"
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (
        bucket_id = 'news-images'
        AND (auth.jwt()->>'email') = 'fatopago@gmail.com'
      )
      WITH CHECK (
        bucket_id = 'news-images'
        AND (auth.jwt()->>'email') = 'fatopago@gmail.com'
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Admin can delete news images'
  ) THEN
    CREATE POLICY "Admin can delete news images"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'news-images'
        AND (auth.jwt()->>'email') = 'fatopago@gmail.com'
      );
  END IF;
END $$;
