/*
# Create trade-images storage bucket

## Overview
Creates a private storage bucket for trade screenshots and cover photos.
Owner-scoped policies ensure users can only access their own uploaded files.

## Storage
- Bucket: `trade-images` (private)
- Policies: owner-scoped CRUD using owner = auth.uid()

## Security
- SELECT, INSERT, UPDATE, DELETE policies scoped to authenticated users
- Owner column is uuid type, matches auth.uid() directly
*/

-- Create storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('trade-images', 'trade-images', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: owner-scoped
DROP POLICY IF EXISTS "select_own_images" ON storage.objects;
CREATE POLICY "select_own_images" ON storage.objects FOR SELECT
  TO authenticated USING (bucket_id = 'trade-images' AND owner = auth.uid());

DROP POLICY IF EXISTS "insert_own_images" ON storage.objects;
CREATE POLICY "insert_own_images" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'trade-images' AND owner = auth.uid());

DROP POLICY IF EXISTS "update_own_images" ON storage.objects;
CREATE POLICY "update_own_images" ON storage.objects FOR UPDATE
  TO authenticated USING (bucket_id = 'trade-images' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'trade-images' AND owner = auth.uid());

DROP POLICY IF EXISTS "delete_own_images" ON storage.objects;
CREATE POLICY "delete_own_images" ON storage.objects FOR DELETE
  TO authenticated USING (bucket_id = 'trade-images' AND owner = auth.uid());
