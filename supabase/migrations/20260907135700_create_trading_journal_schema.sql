/*
# Trading Journal — Private Schema

1. New Tables
- `trades`: one row per logged trade, owner-scoped.
  - id (uuid pk), user_id (uuid, defaults to auth.uid(), fk auth.users), created_at, updated_at
  - date (date), time (time, nullable), symbol (text), direction (text: long/short), setup_type (text), result (text: win/loss/breakeven)
  - pnl (numeric, signed), r_multiple (numeric, nullable), sl_points (numeric, nullable), tp_points (numeric, nullable)
  - psychology (text), plan_compliance (boolean), confluences (text[]), notes (text), image_path (text, nullable)
- `journal_settings`: one row per user, stores theme, cover images, and editable labels.
  - id (uuid pk), user_id (uuid unique, defaults to auth.uid(), fk auth.users), updated_at
  - theme (text: dark/light, default 'dark')
  - documentary_cover (text, nullable), statistics_cover (text, nullable)
  - documentary_cover_offset (numeric, default 50), statistics_cover_offset (numeric, default 50)
  - labels (jsonb, default '{}') — stores editable section titles, descriptions, chart labels, table labels, category names
2. Security
- Enable RLS on both tables.
- Owner-scoped CRUD: each authenticated user can only access rows they own.
- user_id defaults to auth.uid() so inserts that omit it still satisfy WITH CHECK.
3. Storage
- Create private bucket `trade-images` for trade screenshots and cover photos.
- Storage policies: users can CRUD only objects inside their own uid folder.
*/

CREATE TABLE IF NOT EXISTS trades (
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