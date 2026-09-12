/*
# Rebuild schema to match current app code

1. Changes
- DROP and recreate `trades` table with columns matching the frontend Trade type:
  date, time, symbol, direction, setup_type, result, pnl, r_multiple,
  sl_points, tp_points, psychology, plan_compliance (boolean), confluences (jsonb array),
  notes, image_path, user_id, created_at, updated_at
- CREATE `journal_settings` table: theme, documentary_cover, statistics_cover,
  documentary_cover_offset, statistics_cover_offset, labels (jsonb), confluences (jsonb array)
- CREATE storage bucket `trade-images` (public read, authenticated write)
2. Security
- RLS enabled on both tables
- Anon + authenticated CRUD (single-user, no sign-in)
- Storage bucket: public read, authenticated insert/update
3. Notes
- `trades` table had 0 rows, safe to drop and recreate
- `journal_settings` table did not exist
*/

-- Drop old trades table (0 rows, old schema)
DROP TABLE IF EXISTS trades CASCADE;

-- Create trades table matching app code
CREATE TABLE trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  date text NOT NULL,
  time text,
  symbol text NOT NULL DEFAULT '',
  direction text NOT NULL DEFAULT 'long',
  setup_type text NOT NULL DEFAULT '',
  result text NOT NULL DEFAULT 'win',
  pnl numeric NOT NULL DEFAULT 0,
  r_multiple numeric,
  sl_points numeric,
  tp_points numeric,
  psychology text NOT NULL DEFAULT '',
  plan_compliance boolean NOT NULL DEFAULT true,
  confluences jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text NOT NULL DEFAULT '',
  image_path text
);

ALTER TABLE trades ENABLE ROW LEVEL SECURITY;

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

-- Create journal_settings table
CREATE TABLE journal_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text,
  updated_at timestamptz DEFAULT now(),
  theme text NOT NULL DEFAULT 'dark',
  documentary_cover text,
  statistics_cover text,
  documentary_cover_offset integer NOT NULL DEFAULT 50,
  statistics_cover_offset integer NOT NULL DEFAULT 50,
  labels jsonb NOT NULL DEFAULT '{}'::jsonb,
  confluences jsonb NOT NULL DEFAULT '[]'::jsonb
);

ALTER TABLE journal_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_journal_settings" ON journal_settings;
CREATE POLICY "anon_select_journal_settings" ON journal_settings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_journal_settings" ON journal_settings;
CREATE POLICY "anon_insert_journal_settings" ON journal_settings FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_journal_settings" ON journal_settings;
CREATE POLICY "anon_update_journal_settings" ON journal_settings FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_journal_settings" ON journal_settings;
CREATE POLICY "anon_delete_journal_settings" ON journal_settings FOR DELETE
  TO anon, authenticated USING (true);

-- Create storage bucket for trade images
INSERT INTO storage.buckets (id, name, public)
VALUES ('trade-images', 'trade-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: public read, authenticated write
DROP POLICY IF EXISTS "Public read access for trade-images" ON storage.objects;
CREATE POLICY "Public read access for trade-images" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'trade-images');

DROP POLICY IF EXISTS "Authenticated upload for trade-images" ON storage.objects;
CREATE POLICY "Authenticated upload for trade-images" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'trade-images');

DROP POLICY IF EXISTS "Authenticated update for trade-images" ON storage.objects;
CREATE POLICY "Authenticated update for trade-images" ON storage.objects
  FOR UPDATE TO anon, authenticated
  USING (bucket_id = 'trade-images') WITH CHECK (bucket_id = 'trade-images');

DROP POLICY IF EXISTS "Authenticated delete for trade-images" ON storage.objects;
CREATE POLICY "Authenticated delete for trade-images" ON storage.objects
  FOR DELETE TO anon, authenticated
  USING (bucket_id = 'trade-images');