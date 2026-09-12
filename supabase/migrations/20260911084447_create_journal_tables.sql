/*
# Create journal_trades, journal_confluences, and journal_settings tables

## Purpose
The running app (App.tsx) reads and writes three tables — journal_trades,
journal_confluences, and journal_settings — but none of them exist in the
database yet. This migration creates all three with the correct columns,
enables RLS, and adds permissive CRUD policies for the anon-key frontend
(no sign-in screen, single-tenant app).

## New Tables

### 1. journal_trades
Stores individual trade journal entries.
- id (uuid, primary key, auto-generated)
- trade_date (timestamptz, not null) — date and time of the trade
- plan (boolean, default true) — whether the trade followed the plan
- psychology (text) — trader's mental state during the trade
- confluences (jsonb, default '[]') — array of confluence names
- direction (text) — 'Long' or 'Short'
- stop_loss (numeric, default 0) — stop loss in points
- take_profit (numeric, default 0) — take profit in points
- result (text) — 'Win', 'Loss', 'BE → Win', or 'BE → Loss'
- pnl (numeric, default 0) — profit/loss in dollars
- note_blocks (jsonb, default '[]') — structured trade notes (text + images)
- created_at (timestamptz, default now())

### 2. journal_confluences
Stores the list of available confluence tags that users can attach to trades.
- id (uuid, primary key, auto-generated)
- name (text, unique, not null) — confluence name
- sort_order (integer, default 0) — display order

### 3. journal_settings
Stores a single row of app-wide settings (cover images, positions).
- id (boolean, primary key, default true) — always true, singleton row
- documentary_cover (text, nullable) — base64 cover image for documentary page
- documentary_position_x (numeric, default 50) — cover image x position
- documentary_position_y (numeric, default 50) — cover image y position
- statistics_cover (text, nullable) — base64 cover image for statistics page
- statistics_position_x (numeric, default 50) — cover image x position
- statistics_position_y (numeric, default 50) — cover image y position

## Security
- RLS enabled on all three tables.
- All policies use TO anon, authenticated (no sign-in screen, single-tenant).
- USING (true) / WITH CHECK (true) is intentional — data is intentionally shared.

## Important Notes
1. The journal_settings table uses a boolean primary key (always true) to
   enforce a singleton row. The app queries with .eq('id', true).
2. confluences column in journal_trades is jsonb to store an array of strings.
3. note_blocks in journal_trades is jsonb to store structured note data.
*/

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
  created_at timestamptz NOT NULL DEFAULT now()
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

CREATE TABLE IF NOT EXISTS journal_confluences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
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

CREATE TABLE IF NOT EXISTS journal_settings (
  id boolean PRIMARY KEY DEFAULT true,
  documentary_cover text,
  documentary_position_x numeric NOT NULL DEFAULT 50,
  documentary_position_y numeric NOT NULL DEFAULT 50,
  statistics_cover text,
  statistics_position_x numeric NOT NULL DEFAULT 50,
  statistics_position_y numeric NOT NULL DEFAULT 50
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

-- Insert default confluences to match the app's hardcoded list
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

-- Insert default settings row
INSERT INTO journal_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;
