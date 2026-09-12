export type Result = 'Win' | 'Loss' | 'BE → Win' | 'BE → Loss';
export type Compliance = 'Yes' | 'No';
export type Psychology = 'Calm / Disciplined' | 'FOMO / Impulsive' | 'Fearful / Hesitant' | 'Greedy / Overconfident' | 'Revenge / Tilted';
export type Direction = 'Long' | 'Short';
export type View = 'table' | 'board';
export type BoardGroup = 'week' | 'day';
export type Page = 'journal' | 'statistics';

export type TradeView = 'full-log' | 'full-gallery' | 'weekly-log' | 'weekly-gallery' | 'loss-log' | 'win-log';

export type Trade = {
  id: string;
  name: string;
  dateTime: string;
  type: string;
  result: Result;
  pnl: number;
  planCompliance: Compliance;
  psychology: Psychology;
  setupType: string;
  confluences: string[];
  direction: Direction;
  sl: number;
  tp: number;
  rr: number;
  notes: string;
  imageUrl: string;
};

export type Analytics = {
  cumulative: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  maxLosses: number;
  grossProfit: number;
  grossLoss: number;
  profitFactor: number;
  winRate: number;
  wins: number;
  totalTrades: number;
  compliance: number;
  expectancy: number;
  avgWin: number;
  avgLoss: number;
  equity: { label: string; value: number }[];
  daily: { label: string; value: number }[];
  bestDay: { key: string; value: number } | null;
  worstDay: { key: string; value: number } | null;
  worstWeek: { key: string; value: number } | null;
  resultBreakdown: { result: Result; trades: number; pnl: number; proportion: number; avgWin: number; avgLoss: number; expectancy: number }[];
  psychologyBreakdown: { psych: Psychology; trades: number; pnl: number; proportion: number; avgWin: number; avgLoss: number }[];
  weekdayBreakdown: { weekday: string; trades: number; pnl: number; winRate: number; avgWin: number; avgLoss: number }[];
  confluenceBreakdown: { confluence: string; trades: number; pnl: number; winRate: number; avgWin: number; avgLoss: number }[];
  complianceBreakdown: { compliance: Compliance; trades: number; pnl: number; winRate: number; avgWin: number; avgLoss: number }[];
};
