/*
# Rebuild Trading Journal Schema

1. Changes
- Drop old `trades` table (0 rows, old schema with name/date_time/type/sl/tp/rr/image_url columns)
- Create new `trades` table matching current app code (user_id, date, time, symbol, direction, setup_type, result, pnl, r_multiple, sl_points, tp_points, psychology, plan_compliance, confluences, notes, image_path)
- Create `journal_settings` table (theme, cover images, editable labels, confluences)
- Create storage bucket `trade-images` with owner-scoped policies
2. Security
- RLS enabled on both tables with owner-scoped CRUD policies
- Storage bucket private, users can only access objects in their own uid folder
3. Notes
- Old table had 0 rows so no data loss
- user_id defaults to auth.uid() so inserts omitting user_id still pass RLS
*/

DROP TABLE IF EXISTS trades CASCADE;

CREATE TABLE trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  date date NOT NULL,
  time time,
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
  confluences text[] NOT NULL DEFAULT '{}',
  notes text NOT NULL DEFAULT '',
  image_path text
);

ALTER TABLE trades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_trades" ON trades;
CREATE POLICY "select_own_trades" ON trades FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_trades" ON trades;
CREATE POLICY "insert_own_trades" ON trades FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_trades" ON trades;
CREATE POLICY "update_own_trades" ON trades FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_trades" ON trades;
CREATE POLICY "delete_own_trades" ON trades FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS trades_user_id_idx ON trades(user_id);
CREATE INDEX IF NOT EXISTS trades_date_idx ON trades(date);

CREATE TABLE IF NOT EXISTS journal_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_at timestamptz DEFAULT now(),
  theme text NOT NULL DEFAULT 'dark',
  documentary_cover text,
  statistics_cover text,
  documentary_cover_offset numeric NOT NULL DEFAULT 50,
  statistics_cover_offset numeric NOT NULL DEFAULT 50,
  labels jsonb NOT NULL DEFAULT '{}'::jsonb,
  confluences text[] NOT NULL DEFAULT ARRAY[
    'Goldbach Time', 'Monc-Weec', 'Hid Monc-Weec', 'Dailyc', 'Hid Dailyc',
    'Quarterc', 'Hid Quarterc', 'Microc', 'Hid Microc', 'Nanoc', 'Hid Nanoc',
    'H1 IMB GB', 'H1 OB GB', 'M15 IMB GB', 'M15 OB OB', 'M5 IMB GB', 'M5 OB GB',
    'M1 IMB GB', 'M1 OB GB', '1st IMB', 'Prev 1st IMB', 'RTH', 'Prev RTH',
    'CB MOR', 'NXOG', 'Abo/Bel 1 T.O', 'Abo/Bel 2 T.O', 'Abo/Bel 2+ T.O',
    'OTE+M1 IMB', 'SMTF'
  ]::text[],
  UNIQUE (user_id)
);

ALTER TABLE journal_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_settings" ON journal_settings;
CREATE POLICY "select_own_settings" ON journal_settings FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_settings" ON journal_settings;
CREATE POLICY "insert_own_settings" ON journal_settings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_settings" ON journal_settings;
CREATE POLICY "update_own_settings" ON journal_settings FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_settings" ON journal_settings;
CREATE POLICY "delete_own_settings" ON journal_settings FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

INSERT INTO storage.buckets (id, name, public)
VALUES ('trade-images', 'trade-images', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "trade_images_select_own" ON storage.objects;
CREATE POLICY "trade_images_select_own" ON storage.objects FOR SELECT
  TO authenticated USING (
    bucket_id = 'trade-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "trade_images_insert_own" ON storage.objects;
CREATE POLICY "trade_images_insert_own" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (
    bucket_id = 'trade-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "trade_images_update_own" ON storage.objects;
CREATE POLICY "trade_images_update_own" ON storage.objects FOR UPDATE
  TO authenticated USING (
    bucket_id = 'trade-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  ) WITH CHECK (
    bucket_id = 'trade-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "trade_images_delete_own" ON storage.objects;
CREATE POLICY "trade_images_delete_own" ON storage.objects FOR DELETE
  TO authenticated USING (
    bucket_id = 'trade-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );