/*
# Create trades table (single-tenant, no auth)

1. New Tables
- `trades`
  - `id` (uuid, primary key)
  - `name` (text, trade name/label)
  - `date_time` (text, ISO datetime string)
  - `type` (text, instrument type e.g. NQ/ES)
  - `result` (text, Win/Loss/BE→Win/BE→Loss)
  - `pnl` (numeric, profit/loss amount)
  - `plan_compliance` (text, Yes/No)
  - `psychology` (text, emotional state)
  - `setup_type` (text, setup category)
  - `confluences` (jsonb, array of confluence tags)
  - `direction` (text, Long/Short)
  - `sl` (numeric, stop loss)
  - `tp` (numeric, take profit)
  - `rr` (numeric, risk-reward ratio)
  - `notes` (text, rich text notes for the trade)
  - `image_url` (text, optional trade image data URL)
  - `created_at` (timestamp)
2. Security
- Enable RLS on `trades`.
- Allow anon + authenticated CRUD (single-tenant, no sign-in).
*/

CREATE TABLE IF NOT EXISTS trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  date_time text NOT NULL,
  type text NOT NULL DEFAULT 'NQ',
  result text NOT NULL DEFAULT 'Win',
  pnl numeric NOT NULL DEFAULT 0,
  plan_compliance text NOT NULL DEFAULT 'Yes',
  psychology text NOT NULL DEFAULT 'Calm / Disciplined',
  setup_type text NOT NULL DEFAULT '',
  confluences jsonb NOT NULL DEFAULT '[]'::jsonb,
  direction text NOT NULL DEFAULT 'Long',
  sl numeric NOT NULL DEFAULT 0,
  tp numeric NOT NULL DEFAULT 0,
  rr numeric NOT NULL DEFAULT 0,
  notes text NOT NULL DEFAULT '',
  image_url text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
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
