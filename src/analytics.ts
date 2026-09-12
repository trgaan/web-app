import type { Analytics, Trade, Result, Psychology, Compliance } from './types';

export function calculateAnalytics(trades: Trade[]): Analytics {
  const chronological = [...trades].sort((a, b) => a.dateTime.localeCompare(b.dateTime));
  let running = 0;
  let peak = 0;
  let maxDrawdown = 0;
  let maxDrawdownPct = 0;
  let currentLosses = 0;
  let maxLosses = 0;
  const equity = chronological.map((trade) => {
    running += trade.pnl;
    peak = Math.max(peak, running);
    const dd = running - peak;
    maxDrawdown = Math.min(maxDrawdown, dd);
    if (peak > 0) maxDrawdownPct = Math.min(maxDrawdownPct, dd / peak);
    const isLoss = trade.result === 'Loss' || trade.pnl < 0;
    currentLosses = isLoss ? currentLosses + 1 : 0;
    maxLosses = Math.max(maxLosses, currentLosses);
    return { label: fmtDate(trade.dateTime), value: running };
  });

  const grossProfit = trades.filter((t) => t.pnl > 0).reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(trades.filter((t) => t.pnl < 0).reduce((s, t) => s + t.pnl, 0));
  const wins = trades.filter((t) => t.result === 'Win').length;
  const totalTrades = trades.length;
  const winRate = totalTrades ? (wins / totalTrades) * 100 : 0;
  const compliance = totalTrades ? (trades.filter((t) => t.planCompliance === 'Yes').length / totalTrades) * 100 : 0;
  const winPnls = trades.filter((t) => t.pnl > 0).map((t) => t.pnl);
  const lossPnls = trades.filter((t) => t.pnl < 0).map((t) => t.pnl);
  const avgWin = winPnls.length ? winPnls.reduce((s, v) => s + v, 0) / winPnls.length : 0;
  const avgLoss = lossPnls.length ? lossPnls.reduce((s, v) => s + v, 0) / lossPnls.length : 0;
  const expectancy = totalTrades ? running / totalTrades : 0;

  const dayKey = (d: string) => d.slice(0, 10);
  const weekKey = (d: string) => {
    const date = new Date(d);
    const day = date.getDay();
    const monday = new Date(date);
    monday.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
    return monday.toISOString().slice(0, 10);
  };

  const bucket = (keyFn: (t: Trade) => string) =>
    Array.from(trades.reduce((m, t) => m.set(keyFn(t), (m.get(keyFn(t)) || 0) + t.pnl), new Map<string, number>()))
      .map(([key, value]) => ({ key, value }))
      .sort((a, b) => a.key.localeCompare(b.key));

  const days = bucket((t) => dayKey(t.dateTime));
  const weeks = bucket((t) => weekKey(t.dateTime));
  const bestDay = days.length ? days.reduce((b, c) => (c.value > b.value ? c : b)) : null;
  const worstDay = days.length ? days.reduce((w, c) => (c.value < w.value ? c : w)) : null;
  const worstWeek = weeks.length ? weeks.reduce((w, c) => (c.value < w.value ? c : w)) : null;

  const results: Result[] = ['Win', 'Loss', 'BE → Win', 'BE → Loss'];
  const resultBreakdown = results.map((r) => {
    const subset = trades.filter((t) => t.result === r);
    const tCount = subset.length;
    const pnl = subset.reduce((s, t) => s + t.pnl, 0);
    const w = subset.filter((t) => t.pnl > 0).map((t) => t.pnl);
    const l = subset.filter((t) => t.pnl < 0).map((t) => t.pnl);
    return {
      result: r,
      trades: tCount,
      pnl,
      proportion: totalTrades ? (tCount / totalTrades) * 100 : 0,
      avgWin: w.length ? w.reduce((s, v) => s + v, 0) / w.length : 0,
      avgLoss: l.length ? l.reduce((s, v) => s + v, 0) / l.length : 0,
      expectancy: tCount ? pnl / tCount : 0,
    };
  });

  const psychs: Psychology[] = ['Calm / Disciplined', 'FOMO / Impulsive', 'Fearful / Hesitant', 'Greedy / Overconfident', 'Revenge / Tilted'];
  const psychologyBreakdown = psychs.map((p) => {
    const subset = trades.filter((t) => t.psychology === p);
    const tCount = subset.length;
    const pnl = subset.reduce((s, t) => s + t.pnl, 0);
    const w = subset.filter((t) => t.pnl > 0).map((t) => t.pnl);
    const l = subset.filter((t) => t.pnl < 0).map((t) => t.pnl);
    return {
      psych: p,
      trades: tCount,
      pnl,
      proportion: totalTrades ? (tCount / totalTrades) * 100 : 0,
      avgWin: w.length ? w.reduce((s, v) => s + v, 0) / w.length : 0,
      avgLoss: l.length ? l.reduce((s, v) => s + v, 0) / l.length : 0,
    };
  });

  const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const weekdayBreakdown = weekdayNames.map((wd, idx) => {
    const subset = trades.filter((t) => new Date(t.dateTime).getDay() === idx);
    const tCount = subset.length;
    const pnl = subset.reduce((s, t) => s + t.pnl, 0);
    const wCount = subset.filter((t) => t.result === 'Win').length;
    const w = subset.filter((t) => t.pnl > 0).map((t) => t.pnl);
    const l = subset.filter((t) => t.pnl < 0).map((t) => t.pnl);
    return {
      weekday: wd,
      trades: tCount,
      pnl,
      winRate: tCount ? (wCount / tCount) * 100 : 0,
      avgWin: w.length ? w.reduce((s, v) => s + v, 0) / w.length : 0,
      avgLoss: l.length ? l.reduce((s, v) => s + v, 0) / l.length : 0,
    };
  }).filter((wd) => wd.trades > 0);

  const allConfluences = new Set<string>();
  trades.forEach((t) => t.confluences.forEach((c) => allConfluences.add(c)));
  const confluenceBreakdown = Array.from(allConfluences).map((c) => {
    const subset = trades.filter((t) => t.confluences.includes(c));
    const tCount = subset.length;
    const pnl = subset.reduce((s, t) => s + t.pnl, 0);
    const wCount = subset.filter((t) => t.result === 'Win').length;
    const w = subset.filter((t) => t.pnl > 0).map((t) => t.pnl);
    const l = subset.filter((t) => t.pnl < 0).map((t) => t.pnl);
    return {
      confluence: c,
      trades: tCount,
      pnl,
      winRate: tCount ? (wCount / tCount) * 100 : 0,
      avgWin: w.length ? w.reduce((s, v) => s + v, 0) / w.length : 0,
      avgLoss: l.length ? l.reduce((s, v) => s + v, 0) / l.length : 0,
    };
  }).sort((a, b) => b.trades - a.trades);

  const compliances: Compliance[] = ['Yes', 'No'];
  const complianceBreakdown = compliances.map((c) => {
    const subset = trades.filter((t) => t.planCompliance === c);
    const tCount = subset.length;
    const pnl = subset.reduce((s, t) => s + t.pnl, 0);
    const wCount = subset.filter((t) => t.result === 'Win').length;
    const w = subset.filter((t) => t.pnl > 0).map((t) => t.pnl);
    const l = subset.filter((t) => t.pnl < 0).map((t) => t.pnl);
    return {
      compliance: c,
      trades: tCount,
      pnl,
      winRate: tCount ? (wCount / tCount) * 100 : 0,
      avgWin: w.length ? w.reduce((s, v) => s + v, 0) / w.length : 0,
      avgLoss: l.length ? l.reduce((s, v) => s + v, 0) / l.length : 0,
    };
  });

  return {
    cumulative: running,
    maxDrawdown,
    maxDrawdownPct: maxDrawdownPct * 100,
    maxLosses,
    grossProfit,
    grossLoss,
    profitFactor: grossLoss ? grossProfit / grossLoss : grossProfit ? grossProfit : 0,
    winRate,
    wins,
    totalTrades,
    compliance,
    expectancy,
    avgWin,
    avgLoss,
    equity,
    daily: days.map(({ key, value }) => ({ label: shortDay(key), value })),
    bestDay: bestDay ? { key: bestDay.key, value: bestDay.value } : null,
    worstDay: worstDay ? { key: worstDay.key, value: worstDay.value } : null,
    worstWeek: worstWeek ? { key: worstWeek.key, value: worstWeek.value } : null,
    resultBreakdown,
    psychologyBreakdown,
    weekdayBreakdown,
    confluenceBreakdown,
    complianceBreakdown,
  };
}

function fmtDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
}
function shortDay(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function formatCurrency(value: number, compact = false) {
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  if (compact && abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}k`;
  return `${sign}$${abs.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}
export function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
}
export function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
export function dayKey(value: string) { return value.slice(0, 10); }
export function weekKey(value: string) {
  const date = new Date(value);
  const day = date.getDay();
  const monday = new Date(date);
  monday.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  return monday.toISOString().slice(0, 10);
}
export function shortDayLabel(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
export function resultTone(result: Result) {
  return result === 'Win' || result === 'BE → Win' ? 'positive' : result === 'Loss' ? 'negative' : 'neutral';
}
