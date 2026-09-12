/*
# Remove auth requirement — switch to single-user anon access

1. Changes
- trades.user_id: drop NOT NULL, drop DEFAULT auth.uid()
- journal_settings.user_id: drop NOT NULL, drop DEFAULT auth.uid(), drop UNIQUE constraint
- RLS policies: replace authenticated-only with anon+authenticated (public/shared)
- Storage policies: allow anon access without folder ownership check
2. Security
- This is a single-user private app with no sign-in, so anon access is intentional
*/

ALTER TABLE trades ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE trades ALTER COLUMN user_id DROP DEFAULT;

ALTER TABLE journal_settings ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE journal_settings ALTER COLUMN user_id DROP DEFAULT;
ALTER TABLE journal_settings DROP CONSTRAINT IF EXISTS journal_settings_user_id_key;

DROP POLICY IF EXISTS "select_own_trades" ON trades;
DROP POLICY IF EXISTS "insert_own_trades" ON trades;
DROP POLICY IF EXISTS "update_own_trades" ON trades;
DROP POLICY IF EXISTS "delete_own_trades" ON trades;

DROP POLICY IF EXISTS "anon_select_trades" ON trades;
CREATE POLICY "anon_select_trades" ON trades FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_trades" ON trades;
CREATE POLICY "anon_insert_trades" ON trades FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_trades" ON trades;
CREATE POLICY "anon_update_trades" ON trades FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_trades" ON trades;
CREATE POLICY "anon_delete_trades" ON trades FOR DELETE
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "select_own_settings" ON journal_settings;
DROP POLICY IF EXISTS "insert_own_settings" ON journal_settings;
DROP POLICY IF EXISTS "update_own_settings" ON journal_settings;
DROP POLICY IF EXISTS "delete_own_settings" ON journal_settings;

DROP POLICY IF EXISTS "anon_select_settings" ON journal_settings;
CREATE POLICY "anon_select_settings" ON journal_settings FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_settings" ON journal_settings;
CREATE POLICY "anon_insert_settings" ON journal_settings FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_settings" ON journal_settings;
CREATE POLICY "anon_update_settings" ON journal_settings FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_settings" ON journal_settings;
CREATE POLICY "anon_delete_settings" ON journal_settings FOR DELETE
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "trade_images_select_own" ON storage.objects;
DROP POLICY IF EXISTS "trade_images_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "trade_images_update_own" ON storage.objects;
DROP POLICY IF EXISTS "trade_images_delete_own" ON storage.objects;

DROP POLICY IF EXISTS "trade_images_select" ON storage.objects;
CREATE POLICY "trade_images_select" ON storage.objects FOR SELECT
  TO anon, authenticated USING (bucket_id = 'trade-images');
DROP POLICY IF EXISTS "trade_images_insert" ON storage.objects;
CREATE POLICY "trade_images_insert" ON storage.objects FOR INSERT
  TO anon, authenticated WITH CHECK (bucket_id = 'trade-images');
DROP POLICY IF EXISTS "trade_images_update" ON storage.objects;
CREATE POLICY "trade_images_update" ON storage.objects FOR UPDATE
  TO anon, authenticated USING (bucket_id = 'trade-images') WITH CHECK (bucket_id = 'trade-images');
DROP POLICY IF EXISTS "trade_images_delete" ON storage.objects;
CREATE POLICY "trade_images_delete" ON storage.objects FOR DELETE
  TO anon, authenticated USING (bucket_id = 'trade-images');