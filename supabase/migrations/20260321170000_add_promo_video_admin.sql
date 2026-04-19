CREATE TABLE IF NOT EXISTS public.site_media_settings (
  setting_key TEXT PRIMARY KEY,
  media_kind TEXT NOT NULL DEFAULT 'video',
  source_url TEXT NOT NULL,
  storage_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT site_media_settings_media_kind_chk
    CHECK (media_kind IN ('video')),
  CONSTRAINT site_media_settings_source_url_chk
    CHECK (char_length(trim(source_url)) > 0)
);

ALTER TABLE public.site_media_settings ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON TABLE public.site_media_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.site_media_settings TO authenticated;

CREATE OR REPLACE FUNCTION public.touch_site_media_settings_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS site_media_settings_touch_updated_at ON public.site_media_settings;
CREATE TRIGGER site_media_settings_touch_updated_at
BEFORE UPDATE ON public.site_media_settings
FOR EACH ROW
EXECUTE FUNCTION public.touch_site_media_settings_updated_at();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'site_media_settings'
      AND policyname = 'Public can read site media settings'
  ) THEN
    CREATE POLICY "Public can read site media settings"
      ON public.site_media_settings
      FOR SELECT
      TO anon, authenticated
      USING (TRUE);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'site_media_settings'
      AND policyname = 'Admin can insert site media settings'
  ) THEN
    CREATE POLICY "Admin can insert site media settings"
      ON public.site_media_settings
      FOR INSERT
      TO authenticated
      WITH CHECK ((auth.jwt()->>'email') = 'fatopago@gmail.com');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'site_media_settings'
      AND policyname = 'Admin can update site media settings'
  ) THEN
    CREATE POLICY "Admin can update site media settings"
      ON public.site_media_settings
      FOR UPDATE
      TO authenticated
      USING ((auth.jwt()->>'email') = 'fatopago@gmail.com')
      WITH CHECK ((auth.jwt()->>'email') = 'fatopago@gmail.com');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'site_media_settings'
      AND policyname = 'Admin can delete site media settings'
  ) THEN
    CREATE POLICY "Admin can delete site media settings"
      ON public.site_media_settings
      FOR DELETE
      TO authenticated
      USING ((auth.jwt()->>'email') = 'fatopago@gmail.com');
  END IF;
END $$;

INSERT INTO public.site_media_settings (
  setting_key,
  media_kind,
  source_url
)
VALUES (
  'promo_video',
  'video',
  '/vidoes/video01.mp4'
)
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'promo-videos',
  'promo-videos',
  TRUE,
  104857600,
  ARRAY[
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/quicktime',
    'video/x-m4v'
  ]
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
      AND policyname = 'Promo videos are public'
  ) THEN
    CREATE POLICY "Promo videos are public"
      ON storage.objects
      FOR SELECT
      USING (bucket_id = 'promo-videos');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Admin can upload promo videos'
  ) THEN
    CREATE POLICY "Admin can upload promo videos"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'promo-videos'
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
      AND policyname = 'Admin can update promo videos'
  ) THEN
    CREATE POLICY "Admin can update promo videos"
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (
        bucket_id = 'promo-videos'
        AND (auth.jwt()->>'email') = 'fatopago@gmail.com'
      )
      WITH CHECK (
        bucket_id = 'promo-videos'
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
      AND policyname = 'Admin can delete promo videos'
  ) THEN
    CREATE POLICY "Admin can delete promo videos"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'promo-videos'
        AND (auth.jwt()->>'email') = 'fatopago@gmail.com'
      );
  END IF;
END $$;
