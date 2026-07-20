
-- 1. Salon slug
ALTER TABLE public.saloons ADD COLUMN IF NOT EXISTS slug text;

CREATE OR REPLACE FUNCTION public.slugify(_input text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT trim(both '-' from regexp_replace(lower(coalesce(_input,'')), '[^a-z0-9]+', '-', 'g'));
$$;

-- Backfill unique slugs
DO $$
DECLARE r RECORD; base text; candidate text; n int;
BEGIN
  FOR r IN SELECT id, name FROM public.saloons WHERE slug IS NULL OR slug = '' LOOP
    base := public.slugify(r.name);
    IF base = '' THEN base := 'saloon'; END IF;
    candidate := base; n := 1;
    WHILE EXISTS (SELECT 1 FROM public.saloons WHERE slug = candidate AND id <> r.id) LOOP
      n := n + 1;
      candidate := base || '-' || n;
    END LOOP;
    UPDATE public.saloons SET slug = candidate WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE public.saloons ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS saloons_slug_key ON public.saloons(slug);

-- 2. WhatsApp phone on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whatsapp_phone text;

-- 3. KYC submissions
CREATE TABLE IF NOT EXISTS public.saloon_kyc_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  saloon_id uuid NOT NULL REFERENCES public.saloons(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  legal_name text NOT NULL,
  pan_number text,
  gst_number text,
  aadhaar_number text,
  document_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.saloon_kyc_submissions TO authenticated;
GRANT ALL ON public.saloon_kyc_submissions TO service_role;
ALTER TABLE public.saloon_kyc_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners see their own kyc submissions"
  ON public.saloon_kyc_submissions FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owners create own kyc submissions"
  ON public.saloon_kyc_submissions FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Admins update kyc submissions"
  ON public.saloon_kyc_submissions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 4. KYC review history
CREATE TABLE IF NOT EXISTS public.saloon_kyc_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.saloon_kyc_submissions(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL,
  previous_status text,
  new_status text NOT NULL,
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.saloon_kyc_reviews TO authenticated;
GRANT ALL ON public.saloon_kyc_reviews TO service_role;
ALTER TABLE public.saloon_kyc_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners see reviews of their submissions"
  ON public.saloon_kyc_reviews FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.saloon_kyc_submissions s
      WHERE s.id = submission_id AND s.owner_id = auth.uid()
    )
  );

CREATE POLICY "Admins insert kyc reviews"
  ON public.saloon_kyc_reviews FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND reviewer_id = auth.uid());

CREATE TRIGGER update_kyc_submissions_updated_at BEFORE UPDATE ON public.saloon_kyc_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
