/*
# Create Trading Journal core tables

1. New Tables
- `journal_trades`: single-tenant trade journal entries with setup, psychology, result, PnL, and inline note blocks.
- `journal_confluences`: editable confluence options used by new trades and statistics.
- `journal_settings`: single-row visual settings for independent Documentary and Statistics covers.

2. Security
- Row level security is enabled on all three tables.
- Because this app has no sign-in screen, anon and authenticated roles receive separate CRUD policies for the intentionally shared single-tenant journal.

3. Important Notes
- Trade note content is stored as JSON so text, section headers, and images remain in their original inline order.
- Cover positions are stored independently per page and are never tied to trade rows.
*/

CREATE TABLE IF NOT EXISTS journal_trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_date timestamptz NOT NULL,
  plan boolean NOT NULL DEFAULT false,
  psychology text NOT NULL,
  confluences text[] NOT NULL DEFAULT '{}',
  direction text NOT NULL CHECK (direction IN ('Long', 'Short')),
  stop_loss numeric NOT NULL DEFAULT 0,
  take_profit numeric NOT NULL DEFAULT 0,
  result text NOT NULL CHECK (result IN ('Win', 'Loss', 'BE → Win', 'BE → Loss')),
  pnl numeric NOT NULL DEFAULT 0,
  note_blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS journal_confluences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS journal_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  documentary_cover text,
  documentary_position_x numeric NOT NULL DEFAULT 50,
  documentary_position_y numeric NOT NULL DEFAULT 50,
  statistics_cover text,
  statistics_position_x numeric NOT NULL DEFAULT 50,
  statistics_position_y numeric NOT NULL DEFAULT 50,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE journal_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_confluences ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon read journal trades" ON journal_trades;
CREATE POLICY "anon read journal trades" ON journal_trades FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon add journal trades" ON journal_trades;
CREATE POLICY "anon add journal trades" ON journal_trades FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon edit journal trades" ON journal_trades;
CREATE POLICY "anon edit journal trades" ON journal_trades FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon delete journal trades" ON journal_trades;
CREATE POLICY "anon delete journal trades" ON journal_trades FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon read confluences" ON journal_confluences;
CREATE POLICY "anon read confluences" ON journal_confluences FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon add confluences" ON journal_confluences;
CREATE POLICY "anon add confluences" ON journal_confluences FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon edit confluences" ON journal_confluences;
CREATE POLICY "anon edit confluences" ON journal_confluences FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon delete confluences" ON journal_confluences;
CREATE POLICY "anon delete confluences" ON journal_confluences FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon read journal settings" ON journal_settings;
CREATE POLICY "anon read journal settings" ON journal_settings FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon add journal settings" ON journal_settings;
CREATE POLICY "anon add journal settings" ON journal_settings FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon edit journal settings" ON journal_settings;
CREATE POLICY "anon edit journal settings" ON journal_settings FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon delete journal settings" ON journal_settings;
CREATE POLICY "anon delete journal settings" ON journal_settings FOR DELETE TO anon, authenticated USING (true);

INSERT INTO journal_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

INSERT INTO journal_confluences (name, sort_order) VALUES
('Goldbach Time', 1), ('Monc-Weec', 2), ('Hid Monc-Weec', 3), ('Dailyc', 4), ('Hid Dailyc', 5), ('Quarterc', 6), ('Hid Quarterc', 7), ('Microc', 8), ('Hid Microc', 9), ('Nanoc', 10), ('Hid Nanoc', 11), ('H1 IMB GB', 12), ('H1 OB GB', 13), ('M15 IMB GB', 14), ('M15 OB OB', 15), ('M5 IMB GB', 16), ('M5 OB GB', 17), ('M1 IMB GB', 18), ('M1 OB GB', 19), ('1st IMB', 20), ('Prev 1st IMB', 21), ('RTH', 22), ('Prev RTH', 23), ('CB MOR', 24), ('NXOG', 25), ('Abo/Bel 1 T.O', 26), ('Abo/Bel 2 T.O', 27), ('Abo/Bel 2+ T.O', 28), ('OTE+M1 IMB', 29), ('SMTF', 30)
ON CONFLICT (name) DO NOTHING;
