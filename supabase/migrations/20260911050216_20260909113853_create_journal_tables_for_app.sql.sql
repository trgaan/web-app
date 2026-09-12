/*
# Create journal_trades, journal_confluences, journal_settings tables

## Purpose
The application code (App.tsx) reads and writes three tables — journal_trades,
journal_confluences, and journal_settings — but these tables do not exist in the
database. The existing `trades` table has a different column shape and cannot be
used without changing the UI code. This migration creates the three tables the
app expects, with the exact column names and types the app uses.

## New Tables

### 1. journal_trades
Stores individual trade journal entries.
- id (uuid, primary key, auto-generated)
- trade_date (timestamptz, not null) — when the trade occurred
- plan (boolean, default true) — whether a trading plan was followed
- psychology (text, default 'Calm / Disciplined') — trader's mental state
- confluences (jsonb, default '[]') — array of confluence label strings
- direction (text, default 'Long') — 'Long' or 'Short'
- stop_loss (numeric, default 0) — stop loss in points
- take_profit (numeric, default 0) — take profit in points
- result (text, default 'Win') — 'Win', 'Loss', 'BE → Win', or 'BE → Loss'
- pnl (numeric, default 0) — profit/loss in dollars
- note_blocks (jsonb, default '[]') — structured notes (array of {type, value})
- created_at (timestamptz, default now())

### 2. journal_confluences
Stores the list of confluence options selectable when logging a trade.
- id (uuid, primary key, auto-generated)
- name (text, not null, unique) — the confluence label
- sort_order (integer, default 0) — display ordering

### 3. journal_settings
A single-row table (id = true) storing app-wide settings.
- id (boolean, primary key, default true) — always true, ensures one row
- documentary_cover (text, nullable) — base64 cover image for documentary page
- documentary_position_x (numeric, default 50) — cover image X position %
- documentary_position_y (numeric, default 50) — cover image Y position %
- statistics_cover (text, nullable) — base64 cover image for statistics page
- statistics_position_x (numeric, default 50) — cover image X position %
- statistics_position_y (numeric, default 50) — cover image Y position %

## Security
- RLS enabled on all three tables.
- Policies allow anon + authenticated full CRUD (single-tenant, no-auth app,
  matching the existing `trades` table pattern).
- USING (true) / WITH CHECK (true) is intentional — the app has no sign-in
  screen and runs entirely as the anon role.

## Notes
1. The existing `trades` table is NOT dropped or modified — it remains for
   any other code paths that may reference it.
2. A default settings row (id = true) is inserted so the app's
   `.eq('id', true).maybeSingle()` query returns data immediately.
3. A few default confluences are seeded so the confluence picker is not empty.
*/

-- ── journal_trades ──
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
CREATE POLICY "anon_select_journal_trades" ON journal_trades
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_journal_trades" ON journal_trades;
CREATE POLICY "anon_insert_journal_trades" ON journal_trades
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_journal_trades" ON journal_trades;
CREATE POLICY "anon_update_journal_trades" ON journal_trades
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_journal_trades" ON journal_trades;
CREATE POLICY "anon_delete_journal_trades" ON journal_trades
  FOR DELETE TO anon, authenticated USING (true);

-- ── journal_confluences ──
CREATE TABLE IF NOT EXISTS journal_confluences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0
);

ALTER TABLE journal_confluences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_journal_confluences" ON journal_confluences;
CREATE POLICY "anon_select_journal_confluences" ON journal_confluences
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_journal_confluences" ON journal_confluences;
CREATE POLICY "anon_insert_journal_confluences" ON journal_confluences
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_journal_confluences" ON journal_confluences;
CREATE POLICY "anon_update_journal_confluences" ON journal_confluences
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_journal_confluences" ON journal_confluences;
CREATE POLICY "anon_delete_journal_confluences" ON journal_confluences
  FOR DELETE TO anon, authenticated USING (true);

-- ── journal_settings ──
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
CREATE POLICY "anon_select_journal_settings" ON journal_settings
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_journal_settings" ON journal_settings;
CREATE POLICY "anon_insert_journal_settings" ON journal_settings
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_journal_settings" ON journal_settings;
CREATE POLICY "anon_update_journal_settings" ON journal_settings
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- Seed the single settings row so the app's maybeSingle() returns data
INSERT INTO journal_settings (id) VALUES (true)
  ON CONFLICT (id) DO NOTHING;

-- Seed a few default confluences so the picker isn't empty
INSERT INTO journal_confluences (name, sort_order) VALUES
  ('Higher High / Higher Low', 1),
  ('Liquidity Sweep', 2),
  ('Order Block', 3),
  ('FVG / Imbalance', 4),
  ('Trend Alignment', 5),
  ('Round Number', 6)
ON CONFLICT (name) DO NOTHING;