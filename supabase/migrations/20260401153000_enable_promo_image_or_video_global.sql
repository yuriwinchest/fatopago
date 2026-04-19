ALTER TABLE public.site_media_settings
DROP CONSTRAINT IF EXISTS site_media_settings_media_kind_chk;

ALTER TABLE public.site_media_settings
ADD CONSTRAINT site_media_settings_media_kind_chk
CHECK (media_kind IN ('video', 'image'));

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
    'video/x-m4v',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/avif',
    'image/gif'
  ]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO public.site_media_settings (
  setting_key,
  media_kind,
  source_url,
  storage_path
)
VALUES (
  'promo_video',
  'image',
  '/fotoprinciapl.jpeg',
  NULL
)
ON CONFLICT (setting_key) DO NOTHING;

UPDATE public.site_media_settings
SET
  media_kind = 'image',
  source_url = '/fotoprinciapl.jpeg',
  storage_path = NULL
WHERE setting_key = 'promo_video'
  AND storage_path IS NULL
  AND COALESCE(NULLIF(btrim(source_url), ''), '/vidoes/video01.mp4') IN ('/vidoes/video01.mp4');
