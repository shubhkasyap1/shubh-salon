-- Create storage buckets for images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('saloon-images', 'saloon-images', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('barber-avatars', 'barber-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for saloon images
CREATE POLICY "Anyone can view saloon images"
ON storage.objects FOR SELECT
USING (bucket_id = 'saloon-images');

CREATE POLICY "Owners can upload saloon images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'saloon-images' AND auth.role() = 'authenticated');

CREATE POLICY "Owners can update saloon images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'saloon-images' AND auth.role() = 'authenticated');

CREATE POLICY "Owners can delete saloon images"
ON storage.objects FOR DELETE
USING (bucket_id = 'saloon-images' AND auth.role() = 'authenticated');

-- Storage policies for barber avatars
CREATE POLICY "Anyone can view barber avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'barber-avatars');

CREATE POLICY "Owners can upload barber avatars"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'barber-avatars' AND auth.role() = 'authenticated');

CREATE POLICY "Owners can update barber avatars"
ON storage.objects FOR UPDATE
USING (bucket_id = 'barber-avatars' AND auth.role() = 'authenticated');

CREATE POLICY "Owners can delete barber avatars"
ON storage.objects FOR DELETE
USING (bucket_id = 'barber-avatars' AND auth.role() = 'authenticated');