/*
# Add editable confluences and expanded result categories

1. Modified Tables
- `trades.result`: existing text values remain valid; the app now supports `win`, `loss`, `breakeven`, `be_win`, and `be_loss`.
- `journal_settings.confluences`: new text array storing each user's editable confluence choices.

2. Data Preservation
- Existing trade rows are not deleted or rewritten.
- Existing `breakeven` values remain available so users can manually reclassify them later.
- Existing journal settings, covers, themes, and labels remain unchanged.

3. Security
- `journal_settings` already has owner-scoped RLS policies; the new column inherits the existing row protection.

4. Important Notes
- New users receive the provided default confluence list.
- Existing users receive the same list only when their settings do not already contain confluences.
*/

ALTER TABLE journal_settings
  ADD COLUMN IF NOT EXISTS confluences text[] NOT NULL DEFAULT ARRAY[
    'Goldbach Time', 'Monc-Weec', 'Hid Monc-Weec', 'Dailyc', 'Hid Dailyc',
    'Quarterc', 'Hid Quarterc', 'Microc', 'Hid Microc', 'Nanoc', 'Hid Nanoc',
    'H1 IMB GB', 'H1 OB GB', 'M15 IMB GB', 'M15 OB OB', 'M5 IMB GB', 'M5 OB GB',
    'M1 IMB GB', 'M1 OB GB', '1st IMB', 'Prev 1st IMB', 'RTH', 'Prev RTH',
    'CB MOR', 'NXOG', 'Abo/Bel 1 T.O', 'Abo/Bel 2 T.O', 'Abo/Bel 2+ T.O',
    'OTE+M1 IMB', 'SMTF'
  ]::text[];

UPDATE journal_settings
SET confluences = ARRAY[
  'Goldbach Time', 'Monc-Weec', 'Hid Monc-Weec', 'Dailyc', 'Hid Dailyc',
  'Quarterc', 'Hid Quarterc', 'Microc', 'Hid Microc', 'Nanoc', 'Hid Nanoc',
  'H1 IMB GB', 'H1 OB GB', 'M15 IMB GB', 'M15 OB OB', 'M5 IMB GB', 'M5 OB GB',
  'M1 IMB GB', 'M1 OB GB', '1st IMB', 'Prev 1st IMB', 'RTH', 'Prev RTH',
  'CB MOR', 'NXOG', 'Abo/Bel 1 T.O', 'Abo/Bel 2 T.O', 'Abo/Bel 2+ T.O',
  'OTE+M1 IMB', 'SMTF'
]::text[]
WHERE confluences IS NULL OR cardinality(confluences) = 0;