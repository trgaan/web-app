/*
# Create trading journal tables

## Overview
Creates the core database tables for a multi-user trading journal app:
- `trades` — stores individual trade records
- `journal_settings` — stores per-user settings (theme, covers, labels, confluences)

## New Tables

### trades
- `id` (uuid, primary key, auto-generated)
- `user_id` (uuid, not null, defaults to auth.uid(), references auth.users)
- `date` (date, not null) — trade date
- `time` (time, nullable) — trade time
- `symbol` (text, default '') — trading symbol
- `direction` (text, not null, default 'long') — 'long' or 'short'
- `setup_type` (text, default '') — setup type category
- `result` (text, not null, default 'win') — 'win', 'loss', 'breakeven', 'be_win', 'be_loss'
- `pnl` (numeric, default 0) — profit/loss amount
- `r_multiple` (numeric, nullable) — reward-to-risk multiple
- `sl_points` (numeric, nullable) — stop loss in points
- `tp_points` (numeric, nullable) — take profit in points
- `psychology` (text, default '') — psychological state
- `plan_compliance` (boolean, default true) — followed trading plan?
- `confluences` (text[], default '{}') — array of confluence factors
- `notes` (text, default '') — trade notes/analysis
- `image_path` (text, nullable) — path to image in storage bucket
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())

### journal_settings
- `id` (uuid, primary key, auto-generated)
- `user_id` (uuid, not null, defaults to auth.uid(), references auth.users)
- `theme` (text, default 'dark') — 'dark' or 'light'
- `documentary_cover` (text, nullable) — storage path for documentary cover image
- `statistics_cover` (text, nullable) — storage path for statistics cover image
- `documentary_cover_offset` (integer, default 50) — vertical offset percentage
- `statistics_cover_offset` (integer, default 50) — vertical offset percentage
- `labels` (jsonb, default '{}') — custom label overrides
- `confluences` (text[], default '{}') — available confluence options
- `updated_at` (timestamptz, default now())

## Security
- RLS enabled on both tables
- Owner-scoped CRUD policies (TO authenticated, auth.uid() = user_id)
*/

-- Create trades table
CREATE TABLE IF NOT EXISTS trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  time time,
  symbol text NOT NULL DEFAULT '',
  direction text NOT NULL DEFAULT 'long' CHECK (direction IN ('long', 'short')),
  setup_type text NOT NULL DEFAULT '',
  result text NOT NULL DEFAULT 'win' CHECK (result IN ('win', 'loss', 'breakeven', 'be_win', 'be_loss')),
  pnl numeric NOT NULL DEFAULT 0,
  r_multiple numeric,
  sl_points numeric,
  tp_points numeric,
  psychology text NOT NULL DEFAULT '',
  plan_compliance boolean NOT NULL DEFAULT true,
  confluences text[] NOT NULL DEFAULT '{}',
  notes text NOT NULL DEFAULT '',
  image_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
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

-- Create journal_settings table
CREATE TABLE IF NOT EXISTS journal_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  theme text NOT NULL DEFAULT 'dark' CHECK (theme IN ('dark', 'light')),
  documentary_cover text,
  statistics_cover text,
  documentary_cover_offset integer NOT NULL DEFAULT 50,
  statistics_cover_offset integer NOT NULL DEFAULT 50,
  labels jsonb NOT NULL DEFAULT '{}',
  confluences text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
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

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trades_updated_at ON trades;
CREATE TRIGGER trades_updated_at BEFORE UPDATE ON trades
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS journal_settings_updated_at ON journal_settings;
CREATE TRIGGER journal_settings_updated_at BEFORE UPDATE ON journal_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_trades_user_date ON trades (user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_journal_settings_user ON journal_settings (user_id);
