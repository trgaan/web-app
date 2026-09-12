/*
# Create journal tables for trading app (single-tenant, no auth)

1. New Tables
- `journal_trades` — stores individual trade entries
  - `id` (uuid, primary key, auto-generated)
  - `trade_date` (timestamptz, when the trade occurred)
  - `plan` (boolean, whether plan was followed)
  - `psychology` (text, trader's psychological state)
  - `confluences` (jsonb array of strings, selected confluences)
  - `direction` (text, 'Long' or 'Short')
  - `stop_loss` (numeric, stop loss in points)
  - `take_profit` (numeric, take profit in points)
  - `result` (text, 'Win' | 'Loss' | 'BE → Win' | 'BE → Loss')
  - `pnl` (numeric, profit/loss in dollars)
  - `note_blocks` (jsonb, structured note data including text fields and images)
  - `created_at` (timestamptz, auto-set)

- `journal_confluences` — stores the list of confluence options shown in the trade form
  - `id` (uuid, primary key, auto-generated)
  - `name` (text, unique, the confluence label)
  - `sort_order` (int, display order)

- `journal_settings` — stores app-level settings (single row, id = true)
  - `id` (boolean, primary key, always true)
  - `documentary_cover` (text, base64 image or null)
  - `documentary_position_x` (numeric, 0-100)
  - `documentary_position_y` (numeric, 0-100)
  - `statistics_cover` (text, base64 image or null)
  - `statistics_position_x` (numeric, 0-100)
  - `statistics_position_y` (numeric, 0-100)

2. Security
- Enable RLS on all three tables.
- This is a single-tenant app with no sign-in screen, so all policies use `TO anon, authenticated` with `USING (true)` / `WITH CHECK (true)` because the data is intentionally shared/public.

3. Seed Data
- Seeds `journal_confluences` with the default confluence options used by the app.
- Seeds a single `journal_settings` row with id = true and default values.
*/

-- journal_trades
CREATE TABLE IF NOT EXISTS journal_trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_date timestamptz NOT NULL DEFAULT now(),
  plan boolean NOT NULL DEFAULT true,
  psychology text NOT NULL DEFAULT 'Calm / Disciplined',
  confluences jsonb NOT NULL DEFAULT '[]'::jsonb,
  direction text NOT NULL DEFAULT 'Long',
  stop_loss numeric NOT NULL DEFAULT 0,
  take_profit numeric NOT NULL DEFAULT 0,
  result text NOT NULL DEFAULT 'Win',
  pnl numeric NOT NULL DEFAULT 0,
  note_blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE journal_trades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_journal_trades" ON journal_trades;
CREATE POLICY "anon_select_journal_trades" ON journal_trades FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_journal_trades" ON journal_trades;
CREATE POLICY "anon_insert_journal_trades" ON journal_trades FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_journal_trades" ON journal_trades;
CREATE POLICY "anon_update_journal_trades" ON journal_trades FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_journal_trades" ON journal_trades;
CREATE POLICY "anon_delete_journal_trades" ON journal_trades FOR DELETE
  TO anon, authenticated USING (true);

-- journal_confluences
CREATE TABLE IF NOT EXISTS journal_confluences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  sort_order int NOT NULL DEFAULT 0
);

ALTER TABLE journal_confluences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_journal_confluences" ON journal_confluences;
CREATE POLICY "anon_select_journal_confluences" ON journal_confluences FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_journal_confluences" ON journal_confluences;
CREATE POLICY "anon_insert_journal_confluences" ON journal_confluences FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_journal_confluences" ON journal_confluences;
CREATE POLICY "anon_update_journal_confluences" ON journal_confluences FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_journal_confluences" ON journal_confluences;
CREATE POLICY "anon_delete_journal_confluences" ON journal_confluences FOR DELETE
  TO anon, authenticated USING (true);

-- journal_settings
CREATE TABLE IF NOT EXISTS journal_settings (
  id boolean PRIMARY KEY DEFAULT true,
  documentary_cover text,
  documentary_position_x numeric NOT NULL DEFAULT 50,
  documentary_position_y numeric NOT NULL DEFAULT 50,
  statistics_cover text,
  statistics_position_x numeric NOT NULL DEFAULT 50,
  statistics_position_y numeric NOT NULL DEFAULT 50,
  CONSTRAINT single_row CHECK (id = true)
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

-- Seed default confluences
INSERT INTO journal_confluences (name, sort_order) VALUES
  ('Goldbach Time', 1),
  ('Monc -Weec', 2),
  ('Dailyc', 3),
  ('Quarterc', 4),
  ('Microc', 5),
  ('Hid Monc -Weec', 6),
  ('Hid Dailyc', 7),
  ('Hid Quarterc', 8),
  ('Hid Microc', 9),
  ('Hid Nanoc', 10),
  ('Nanoc', 11),
  ('H1 IMB GB', 12),
  ('M1 IMB GB', 13),
  ('CB MOR', 14),
  ('M1 OB GB', 15),
  ('H1 OB GB', 16),
  ('M15 IMB GB', 17),
  ('M15 OB OB', 18),
  ('M5 IMB GB', 19),
  ('M5 OB GB', 20),
  ('NXOG', 21),
  ('OTE + M1 IMB', 22),
  ('SMTF', 23),
  ('Abo/Bel 1 T.O', 24),
  ('Abo/Bel 2 T.O', 25),
  ('Abo/Bel 2+ T.O', 26),
  ('1st IMB', 27),
  ('Prev 1st IMB', 28),
  ('RTH', 29),
  ('Prev RTH', 30)
ON CONFLICT (name) DO NOTHING;

-- Seed default settings row
INSERT INTO journal_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;