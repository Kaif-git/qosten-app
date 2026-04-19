-- Create Storage Bucket "question-images" if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('question-images', 'question-images', true)
ON CONFLICT (id) DO NOTHING;

-- Policy for Public Access (View)
-- This allows anyone to view the images
CREATE POLICY "Public Access" ON storage.objects
  FOR SELECT USING (bucket_id = 'question-images');

-- Policy for Authenticated Users (Upload)
-- This allows logged-in users to upload images
CREATE POLICY "Authenticated Users Upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'question-images' AND auth.role() = 'authenticated');

-- Policy for Anon Users (Upload)
-- This is necessary to support the Developer Bypass mode which doesn't use Supabase Auth
CREATE POLICY "Anon Users Upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'question-images' AND auth.role() = 'anon');

-- Policy for Authenticated Users (Update)
CREATE POLICY "Authenticated Users Update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'question-images' AND auth.role() = 'authenticated');

-- Policy for Anon Users (Update)
CREATE POLICY "Anon Users Update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'question-images' AND auth.role() = 'anon');

-- Policy for Authenticated Users (Delete)
CREATE POLICY "Authenticated Users Delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'question-images' AND auth.role() = 'authenticated');

-- Policy for Anon Users (Delete)
CREATE POLICY "Anon Users Delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'question-images' AND auth.role() = 'anon');
