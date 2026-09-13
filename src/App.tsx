import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ClipboardEvent, type FormEvent, type PointerEvent, type ReactNode } from 'react';
import { ArrowUpRight, CalendarDays, Check, CheckCircle2, ChevronDown, ImagePlus, Inbox, Moon, Pencil, Plus, Search, Save, Sun, Trash2, Upload, X, XCircle, Archive, ArchiveRestore, SlidersHorizontal, ChevronLeft, ChevronRight, Clock, List } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Result = 'Win' | 'Loss' | 'BE → Win' | 'BE → Loss';
type Psychology = 'Calm / Disciplined' | 'FOMO / Impulsive' | 'Fearful / Hesitant' | 'Revenge / Tilted' | 'Greedy / Overconfident';
type Direction = 'Long' | 'Short';
type NoteBlock = { type: string; value: string };
type NoteField = { text: string; image: string };
type NoteFields = Record<string, NoteField>;
type Trade = { id: string; trade_date: string; plan: boolean; psychology: Psychology; confluences: string[]; direction: Direction; stop_loss: number; take_profit: number; result: Result; pnl: number; note_blocks: NoteBlock[] };
type TradeDraft = Omit<Trade, 'id' | 'stop_loss' | 'take_profit' | 'pnl'> & { stop_loss: number | ''; take_profit: number | ''; pnl: number | '' };
type Settings = { documentary_cover: string | null; documentary_position_x: number; documentary_position_y: number; statistics_cover: string | null; statistics_position_x: number; statistics_position_y: number };
type Metric = { label: string; trades: number; pnl: number; profit: number; loss: number; proportion: number; winRate: number }; 
type PnlExtreme = { worst: number; best: number; worstDaily: number; bestDaily: number; worstWeekly: number; bestWeekly: number };
type ViewTab = 'Full Log' | 'Full Gallery' | 'Weekly Log' | 'Monthly Log' | 'Loss Log' | 'Win Log';

const psychologies: Psychology[] = ['Calm / Disciplined', 'FOMO / Impulsive', 'Fearful / Hesitant', 'Revenge / Tilted', 'Greedy / Overconfident'];
const results: Result[] = ['Win', 'Loss', 'BE → Win', 'BE → Loss'];
const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const defaultSettings: Settings = { documentary_cover: null, documentary_position_x: 50, documentary_position_y: 50, statistics_cover: null, statistics_position_x: 50, statistics_position_y: 50 };
const tabs: ViewTab[] = ['Full Log', 'Full Gallery', 'Weekly Log', 'Monthly Log', 'Loss Log', 'Win Log'];
const statisticModules = ['Cumulative PnL', 'Profit Factor', 'Result', 'Avg RR', 'Psychology', 'Expectancy $USD', 'Plan Compliance Comparison', 'PnL Extremes', 'Calendar', 'Setup Type', 'MCL & Drawdown', 'Trade Distribution', 'Win Rate by Time', 'Total & Avg PnL by Time', 'Confluences'];
const timeSlotLabels = ['9:30 - 10:00', '10:00 - 10:30', '10:30 - 11:00', '11:00 - 11:30', 'Others'];
// Threshold (in $) above which the Max Consecutive Loss & Drawdown card gets a subtle danger pulse.
const DRAWDOWN_DANGER_THRESHOLD = 500;
const noteTemplate: Array<{ key: string; label?: string; title?: string; image?: boolean; accent?: string }> = [
  { key: 'htf', title: 'HTF Scenario [ M15 | H1 ]' },
  { key: 'h1', label: 'H1', image: true }, { key: 'm15', label: 'M15', image: true },
  { key: 'scenario1', label: 'Scenario 1:' }, { key: 'scenario2', label: 'Scenario 2:' },
  { key: 'ltf', title: 'LTF Scenario [ M1 | 15S ]' },
  { key: 'm1', label: 'M1', image: true }, { key: 's15', label: '15s', image: true },
  { key: 'should', title: 'TRADE THAT SHOULD BE DONE', accent: 'gold' },
  { key: 'shouldM1', label: 'M1', image: true }, { key: 'should15', label: '15s', image: true },
  { key: 'mistakes', title: 'Mistakes from Today', accent: 'red' }, { key: 'mistakesText', label: '', image: true },
];
const emptyNoteFields = (): NoteFields => Object.fromEntries(noteTemplate.filter((item) => !item.title).map((item) => [item.key, { text: '', image: '' }]));
const formatMoney = (value: number) => `${value >= 0 ? '+' : '-'}$${Math.abs(value).toFixed(0)}`;
const formatDate = (value: string) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
const formatTime = (value: string) => new Date(value).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
const formatDatetimeLocal = (value: string) => { const date = new Date(value); if (Number.isNaN(date.getTime())) return ''; const pad = (number: number) => String(number).padStart(2, '0'); return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`; };
const resultClass = (result: Result) => result === 'Win' || result === 'BE → Win' ? 'positive' : result === 'Loss' ? 'negative' : 'neutral';
const psychologyClass = (psychology: Psychology) => psychology.startsWith('Calm') ? 'calm' : psychology.startsWith('Greedy') ? 'greedy' : 'heated';
const noteFieldsFromTrade = (trade?: Trade | null): NoteFields => { const first = trade?.note_blocks?.find((block) => block.type === 'note-fields'); if (!first) return emptyNoteFields(); try { return { ...emptyNoteFields(), ...(JSON.parse(first.value) as NoteFields) }; } catch { return emptyNoteFields(); } };
const noteBlocksFromFields = (fields: NoteFields): NoteBlock[] => [{ type: 'note-fields', value: JSON.stringify(fields) }];

/** Tracks whether the referenced element is in the viewport. Fires every time it enters or leaves (not just once), so callers can replay their "fade up" reveal / chart-draw animation on every scroll pass, both on Statistics and Documentary. The first time an element becomes visible it reports `repeat: false` so callers can play a strong entrance animation; every time after that (scrolling back up/down repeatedly) it reports `repeat: true` so callers can switch to a lighter, faster animation and avoid visual fatigue. */
function useReveal<T extends HTMLElement>(threshold = 0.15) {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const hasRevealedOnce = useRef(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => {
      // Toggle both ways: entering replays the animation, leaving resets it so it can replay again.
      if (entry.isIntersecting) {
        if (hasRevealedOnce.current) setRepeat(true);
        hasRevealedOnce.current = true;
      }
      setVisible(entry.isIntersecting);
    }, { threshold, rootMargin: '0px 0px -5% 0px' });
    observer.observe(node);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threshold]);
  return { ref, visible, repeat };
}

/** Generic scroll-reveal wrapper (same "fade up" behavior used on the Statistics cards) so other sections of the app — like the Documentary page — can share the same entrance animation. */
function RevealBox({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  const { ref, visible, repeat } = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className={`reveal-card ${visible ? 'is-visible' : ''} ${repeat ? 'is-repeat' : ''} ${className}`} style={{ transitionDelay: visible && !repeat ? `${delay}ms` : '0ms' }}>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// US Eastern Time / DST engine
// ---------------------------------------------------------------------------
// Rather than relying on a hardcoded UTC offset (which breaks twice a year),
// we compute the US Eastern wall-clock time directly from Intl's IANA tz
// database entry for America/New_York. This automatically observes the
// current US DST rules (2nd Sunday in March -> 1st Sunday in November).
// We still expose the "nth Sunday" math explicitly below so the logic is
// auditable and doesn't depend on Intl's internal DST table matching what
// the spec below says (both should always agree, but this keeps the two
// concerns -- "what time is it in NY" vs "is DST active" -- independently
// verifiable.)

/** Returns the Date (UTC) of the Nth occurrence of `weekday` (0=Sun..6=Sat) in a given month/year. */
function nthWeekdayOfMonth(year: number, monthIndex0: number, weekday: number, n: number): Date {
  const first = new Date(Date.UTC(year, monthIndex0, 1));
  const firstWeekday = first.getUTCDay();
  const offset = (weekday - firstWeekday + 7) % 7;
  const day = 1 + offset + (n - 1) * 7;
  return new Date(Date.UTC(year, monthIndex0, day));
}

/** Second Sunday in March, at 2:00 AM local (DST begins -> clocks spring forward to EDT). */
function dstStartUtc(year: number): Date {
  const d = nthWeekdayOfMonth(year, 2, 0, 2); // March = index 2, Sunday = 0, 2nd occurrence
  return new Date(Date.UTC(year, 2, d.getUTCDate(), 7)); // 2:00 AM EST (UTC-5) = 07:00 UTC
}

/** First Sunday in November, at 2:00 AM local (DST ends -> clocks fall back to EST). */
function dstEndUtc(year: number): Date {
  const d = nthWeekdayOfMonth(year, 10, 0, 1); // November = index 10, Sunday = 0, 1st occurrence
  return new Date(Date.UTC(year, 10, d.getUTCDate(), 6)); // 2:00 AM EDT (UTC-4) = 06:00 UTC
}

/** Whether US Eastern civil time observes DST (EDT, UTC-4) at this instant, vs standard time (EST, UTC-5). */
function isUsEasternDst(utcDate: Date): boolean {
  const year = utcDate.getUTCFullYear();
  const start = dstStartUtc(year);
  const end = dstEndUtc(year);
  return utcDate.getTime() >= start.getTime() && utcDate.getTime() < end.getTime();
}

/** Current US Eastern offset in whole hours (negative), e.g. -4 for EDT, -5 for EST. */
function usEasternOffsetHours(utcDate: Date): number {
  return isUsEasternDst(utcDate) ? -4 : -5;
}

type EasternParts = { year: number; month: number; day: number; hour: number; minute: number; second: number; weekday: number; minutesOfDay: number; isDst: boolean };

/** Derives the exact US Eastern wall-clock date/time by applying the correct DST-aware offset
 * directly to the UTC instant (no reliance on Intl formatting quirks). */
function toEasternParts(date: Date): EasternParts {
  const offset = usEasternOffsetHours(date);
  const shifted = new Date(date.getTime() + offset * 60 * 60 * 1000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
    weekday: shifted.getUTCDay(), // 0=Sun..6=Sat
    minutesOfDay: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
    isDst: offset === -4,
  };
}

function marketStatus(date: Date) {
  const eastern = toEasternParts(date);
  const minutesNow = eastern.minutesOfDay;
  const isWeekday = eastern.weekday !== 0 && eastern.weekday !== 6;
  const openMin = 9 * 60 + 30;
  const closeMin = 16 * 60;
  const isOpen = isWeekday && minutesNow >= openMin && minutesNow < closeMin;

  // Compute remaining seconds until the relevant boundary (open or close), walking forward
  // day-by-day in Eastern civil time until we land on a weekday, so weekends/holidasy-adjacent
  // math never goes negative.
  let daysAhead = 0;
  let targetMin = isOpen ? closeMin : openMin;
  if (!isOpen && minutesNow >= openMin) {
    // Past today's open already (either after close, or before 9:30 doesn't apply here) -> roll to next day's open.
    daysAhead = 1;
  }
  // Advance daysAhead until we land on a weekday (Mon-Fri) for the open case.
  if (!isOpen) {
    let checkWeekday = (eastern.weekday + daysAhead) % 7;
    while (checkWeekday === 0 || checkWeekday === 6) { daysAhead += 1; checkWeekday = (eastern.weekday + daysAhead) % 7; }
  }
  const secondsNow = eastern.minutesOfDay * 60 + eastern.second;
  const targetSeconds = daysAhead * 24 * 60 * 60 + targetMin * 60;
  let diffSeconds = targetSeconds - secondsNow;
  if (diffSeconds < 0) diffSeconds = 0;
  const hours = Math.floor(diffSeconds / 3600);
  const mins = Math.floor((diffSeconds % 3600) / 60);
  return { isOpen, hour: eastern.hour, minute: eastern.minute, hours, mins, isDst: eastern.isDst };
}

function MarketClock() {
  const [now, setNow] = useState(() => new Date());
  const [hover, setHover] = useState(false);
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 15000); return () => clearInterval(timer); }, []);
  const status = marketStatus(now);
  const timeLabel = `${((status.hour % 12) || 12)}:${String(status.minute).padStart(2, '0')}`;
  return (
    <div className="market-clock" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <span className={`market-dot ${status.isOpen ? 'market-dot-open' : 'market-dot-closed'}`} />
      <span className="market-clock-label">{status.isOpen ? 'Market Open' : 'Market Closed'} {timeLabel}</span>
      {hover && (
        <div className="market-tooltip">
          {status.isOpen
            ? `The market is currently live (${status.isDst ? 'EDT' : 'EST'}). It will close in ${status.hours} hours and ${status.mins} minutes.`
            : `Trading session has ended (${status.isDst ? 'EDT' : 'EST'}). The market will open in ${status.hours} hours and ${status.mins} minutes.`}
        </div>
      )}
    </div>
  );
}

function BrandMark({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <line x1="6" y1="18" x2="12" y2="7" stroke="#F0DFCF" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="18" y1="18" x2="12" y2="7" stroke="#F0DFCF" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="6" y1="18" x2="18" y2="18" stroke="#F0DFCF" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="7" r="2.6" fill="#D98B63" />
      <circle cx="6" cy="18" r="2.6" fill="#D98B63" />
      <circle cx="18" cy="18" r="2.6" fill="#D98B63" />
    </svg>
  );
}
function App() {
  const [page, setPage] = useState<'documentary' | 'statistics'>('documentary');
  const [trades, setTrades] = useState<Trade[]>([]); const [confluences, setConfluences] = useState<string[]>([]); const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [loading, setLoading] = useState(true); const [message, setMessage] = useState(''); const [modal, setModal] = useState(false); const [editing, setEditing] = useState<Trade | null>(null); const [light, setLight] = useState(false); const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  useEffect(() => { const savedTheme = localStorage.getItem('tradelog-theme'); if (savedTheme === 'light') setLight(true); const onKey = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key === '1') { event.preventDefault(); setPage('documentary'); } if ((event.metaKey || event.ctrlKey) && event.key === '2') { event.preventDefault(); setPage('statistics'); } }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, []);
  useEffect(() => { document.documentElement.classList.toggle('light-theme', light); document.documentElement.setAttribute('data-theme', light ? 'light' : 'dark'); document.documentElement.style.colorScheme = light ? 'light' : 'dark'; localStorage.setItem('tradelog-theme', light ? 'light' : 'dark'); }, [light]);
  useEffect(() => { const onEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setLightboxImage(null); }; window.addEventListener('keydown', onEscape); return () => window.removeEventListener('keydown', onEscape); }, []);
  useEffect(() => { const load = async () => { if (!supabase) { setLoading(false); setMessage('Your journal is in preview mode. Entries will save when connected.'); return; } const [tradeResponse, confluenceResponse, settingsResponse] = await Promise.all([supabase.from('journal_trades').select('*').order('trade_date', { ascending: false }), supabase.from('journal_confluences').select('name').order('sort_order'), supabase.from('journal_settings').select('*').eq('id', true).maybeSingle()]); if (tradeResponse.error || confluenceResponse.error || settingsResponse.error) setMessage('Some journal data could not be loaded.'); setTrades((tradeResponse.data ?? []) as Trade[]); setConfluences((confluenceResponse.data ?? []).map((item: { name: string }) => item.name)); setSettings((settingsResponse.data ?? defaultSettings) as Settings); setLoading(false); }; void load(); }, []);
  const saveTrade = async (draft: TradeDraft, id?: string) => { if (!supabase) { setMessage('Saving is unavailable in preview mode.'); return; } const payload: Omit<Trade, 'id'> = { ...draft, stop_loss: Number(draft.stop_loss || 0), take_profit: Number(draft.take_profit || 0), pnl: Number(draft.pnl || 0) }; const response = id ? await supabase.from('journal_trades').update(payload).eq('id', id).select().maybeSingle() : await supabase.from('journal_trades').insert(payload).select().maybeSingle(); if (response.error || !response.data) { setMessage('This trade could not be saved.'); return; } setTrades((current) => id ? current.map((item) => item.id === id ? response.data as Trade : item) : [response.data as Trade, ...current]); setModal(false); setEditing(null); setMessage('Trade saved'); };
  const deleteTrade = async (id: string) => { if (supabase) { const response = await supabase.from('journal_trades').delete().eq('id', id); if (response.error) { setMessage('This trade could not be deleted.'); return; } } setTrades((current) => current.filter((item) => item.id !== id)); };
  const updateSettings = async (patch: Partial<Settings>) => { setSettings((current) => ({ ...current, ...patch })); if (supabase) await supabase.from('journal_settings').update(patch).eq('id', true); };
  if (loading) return <div className="loading-screen"><div className="brand-mark"><BrandMark size={20} /></div><strong>Loading journal</strong><span>Preparing your workspace…</span></div>;
  return <div className="app-shell"><header className="global-header"><button className="brand"><span className="logo-mark"><BrandMark size={17} /></span><span>CHRONICLE</span></button><nav className="top-nav"><button className={`nav-pill ${page === 'documentary' ? 'active' : ''}`} onClick={() => setPage('documentary')}>Documentary</button><button className={`nav-pill ${page === 'statistics' ? 'active' : ''}`} onClick={() => setPage('statistics')}>Statistics</button></nav><div className="header-actions"><MarketClock /><button className="theme-toggle" onClick={() => setLight(!light)} aria-label="Toggle theme">{light ? <Moon size={16} /> : <Sun size={16} />}</button></div></header><main className="main-content">{message && <div className="toast" onClick={() => setMessage('')}>{message}<X size={14} /></div>}{page === 'documentary' ? <div className="page-content" key="documentary"><Documentary trades={trades} settings={settings} onSettings={updateSettings} onEdit={(trade) => { setEditing(trade); setModal(true); }} onDelete={deleteTrade} onOpenLightbox={setLightboxImage} onAdd={() => { setEditing(null); setModal(true); }} /></div> : <div className="page-content" key="statistics"><Statistics trades={trades} confluences={confluences} setConfluences={setConfluences} /></div>}</main>{modal && <TradeModal trade={editing} confluences={confluences} onClose={() => { setModal(false); setEditing(null); }} onSave={saveTrade} onOpenLightbox={setLightboxImage} />}{lightboxImage && <Lightbox image={lightboxImage} onClose={() => setLightboxImage(null)} />}</div>;
}

function Cover({ settings, onSettings }: { settings: Settings; onSettings: (patch: Partial<Settings>) => void }) {
  const [menu, setMenu] = useState(false); const [reposition, setReposition] = useState(false); const [dragging, setDragging] = useState(false);
  const upload = (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => onSettings({ documentary_cover: reader.result as string }); reader.readAsDataURL(file); };
  const move = (event: PointerEvent<HTMLDivElement>) => { if (!dragging) return; const rect = event.currentTarget.getBoundingClientRect(); onSettings({ documentary_position_x: Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)), documentary_position_y: Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100)) }); };
  return <div className={`cover-area ${reposition ? 'repositioning' : ''}`} onContextMenu={(event) => { event.preventDefault(); setMenu(true); }} onPointerDown={() => reposition && setDragging(true)} onPointerMove={move} onPointerUp={() => setDragging(false)} style={settings.documentary_cover ? { backgroundImage: `url(${settings.documentary_cover})`, backgroundPosition: `${settings.documentary_position_x}% ${settings.documentary_position_y}%` } : undefined}><div className="cover-shade" />{!settings.documentary_cover && <div className="cover-placeholder"><ImagePlus size={22} /><span>Cover image area</span><small>Right-click to add an image</small></div>}{menu && <div className="cover-menu" onClick={(event) => event.stopPropagation()}><label><Upload size={14} /> Change cover<input type="file" accept="image/*" onChange={(event) => { upload(event); setMenu(false); }} /></label><button onClick={() => { setReposition(!reposition); setMenu(false); }}><span className="move-icon">↕</span> {reposition ? 'Finish repositioning' : 'Reposition image'}</button><button className="danger-text" onClick={() => { onSettings({ documentary_cover: null }); setMenu(false); }}><Trash2 size={14} /> Delete cover</button></div>}{reposition && <div className="reposition-hint">Drag image to reposition</div>}</div>;
}

function Documentary({ trades, settings, onSettings, onEdit, onDelete, onOpenLightbox, onAdd }: { trades: Trade[]; settings: Settings; onSettings: (patch: Partial<Settings>) => void; onEdit: (trade: Trade) => void; onDelete: (id: string) => void; onOpenLightbox: (image: string) => void; onAdd: () => void }) {
  const [tab, setTab] = useState<ViewTab>('Full Log'); const [search, setSearch] = useState('');
  const filtered = useMemo(() => { const query = search.trim().toLowerCase(); const matches = trades.filter((trade) => !query || JSON.stringify(trade).toLowerCase().includes(query)); if (tab === 'Loss Log') return matches.filter((trade) => trade.result === 'Loss' || trade.result === 'BE → Win'); if (tab === 'Win Log') return matches.filter((trade) => trade.result === 'Win' || trade.result === 'BE → Loss'); return matches; }, [trades, search, tab]);
  const sequence = useMemo(() => new Map(trades.slice().sort((a, b) => new Date(a.trade_date).getTime() - new Date(b.trade_date).getTime()).map((trade, index) => [trade.id, index + 1])), [trades]);
  const totalPnl = trades.reduce((sum, trade) => sum + trade.pnl, 0); const wins = trades.filter((trade) => trade.result === 'Win' || trade.result === 'BE → Win'); const losses = trades.filter((trade) => trade.result === 'Loss' || trade.result === 'BE → Loss');
  return <section className="page-section"><Cover settings={settings} onSettings={onSettings} /><div className="metric-strip">
    <RevealBox delay={0}><MetricCard label="Total PnL" value={totalPnl} format={formatMoney} accent={totalPnl >= 0 ? 'green' : 'red'} featured /></RevealBox>
    <RevealBox delay={90}><MetricCard label="Trades Logged" value={trades.length} format={(n) => String(Math.round(n))} /></RevealBox>
    <RevealBox delay={180}><MetricCard label="Avg Win (points)" value={average(wins.map((trade) => trade.take_profit))} format={(n) => n.toFixed(1)} accent="pink" /></RevealBox>
    <RevealBox delay={270}><MetricCard label="Avg Loss (points)" value={average(losses.map((trade) => trade.stop_loss))} format={(n) => n.toFixed(1)} accent="red" /></RevealBox>
  </div><div className="view-toolbar"><div className="view-tabs">{tabs.map((item) => <button className={tab === item ? 'active' : ''} key={item} onClick={() => setTab(item)}>{item}</button>)}</div><div className="view-toolbar-actions"><label className="search-box"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="" /></label><button className="primary-button" onClick={onAdd}><Plus size={15} /> Log a trade</button></div></div><RevealBox><div>{tab === 'Weekly Log' ? <WeeklyLog trades={filtered} sequence={sequence} onEdit={onEdit} onDelete={onDelete} onAdd={onAdd} /> : tab === 'Monthly Log' ? <MonthlyLog trades={filtered} sequence={sequence} onEdit={onEdit} onDelete={onDelete} onAdd={onAdd} /> : tab === 'Full Gallery' ? <Gallery trades={filtered} onOpenLightbox={onOpenLightbox} /> : <TradeTable trades={filtered} sequence={sequence} onEdit={onEdit} onDelete={onDelete} onAdd={onAdd} />}</div></RevealBox></section>;
}
function MetricCard({ label, value, format, accent, featured }: { label: string; value: number; format: (n: number) => string; accent?: string; featured?: boolean }) { return <div className={`metric-card ${featured ? 'metric-featured' : ''}`}><span>{label}</span><strong className={accent ? `${accent}-text` : ''}><CountUp value={value} format={format} /></strong></div>; }
function TradeTable({ trades, sequence, onEdit, onDelete, onAdd }: { trades: Trade[]; sequence?: Map<string, number>; onEdit: (trade: Trade) => void; onDelete: (id: string) => void; onAdd?: () => void }) { return <div className="table-wrap"><table className="trade-table"><thead><tr><th>#</th><th>DATE & TIME</th><th>PLAN COMPLIANCE</th><th>PSYCHOLOGY</th><th>CONFLUENCES</th><th>L/S</th><th>SL (PTS)</th><th>TP (PTS)</th><th>RESULT</th><th>PNL</th><th /></tr></thead><tbody>{trades.length ? trades.map((trade, index) => <tr key={trade.id} onDoubleClick={() => onEdit(trade)} title="Double-click to open" style={{cursor:'pointer'}}><td className="muted mono index-cell"><span>{String(sequence?.get(trade.id) ?? index + 1).padStart(2, '0')}</span><button className="row-open" onClick={(e) => { e.stopPropagation(); onEdit(trade); }}><ArrowUpRight size={11} /> Open</button></td><td><div className="date-cell"><CalendarDays size={14} /><div><strong>{formatDate(trade.trade_date)}</strong><small>{formatTime(trade.trade_date)}</small></div></div></td><td><span className={trade.plan ? 'plan yes' : 'plan no'}>{trade.plan ? <Check size={13} /> : <X size={13} />}{trade.plan ? 'Yes' : 'No'}</span></td><td><span className={`psychology ${psychologyClass(trade.psychology)}`}><i />{trade.psychology}</span></td><td className="confluence-cell">{trade.confluences.length ? trade.confluences.join(', ') : '—'}</td><td><span className={`direction ${trade.direction === 'Long' ? 'long' : 'short'}`}>{trade.direction[0]}</span></td><td className="money">{trade.stop_loss}</td><td className="money">{trade.take_profit}</td><td><span className={`result ${resultClass(trade.result)}`}><i />{trade.result}</span></td><td className={`pnl ${trade.pnl >= 0 ? 'positive-text' : 'negative-text'}`}>{formatMoney(trade.pnl)}</td><td><button className="row-action" onClick={() => onDelete(trade.id)}><Trash2 size={15} /></button></td></tr>) : <tr><td colSpan={11}><div className="empty-state"><Inbox size={27} /><strong>No trades match this view.</strong><span>Log a trade or try a different search.</span>{onAdd && <button className="primary-button empty-cta" onClick={onAdd}><Plus size={15} /> Log your first trade</button>}</div></td></tr>}</tbody></table></div>; }
function Gallery({ trades, onOpenLightbox }: { trades: Trade[]; onOpenLightbox: (image: string) => void }) { const cards = trades.map((trade) => { const firstImage = Object.entries(noteFieldsFromTrade(trade)).find(([, field]) => field.image); return firstImage ? { trade, image: firstImage[1].image } : null; }).filter((card): card is { trade: Trade; image: string } => Boolean(card)); return <div className="gallery-grid">{cards.length ? cards.map((card) => <article className="gallery-card" key={card.trade.id}><img src={card.image} alt="Trade analysis" onClick={() => onOpenLightbox(card.image)} /><footer><span>{new Date(card.trade.trade_date).toLocaleDateString('en-US', { weekday: 'short' })} · {formatDate(card.trade.trade_date)}</span><strong className={card.trade.pnl >= 0 ? 'positive-text' : 'negative-text'}>{card.trade.result} · {formatMoney(card.trade.pnl)}</strong></footer></article>) : <div className="empty-state gallery-empty"><ImagePlus size={27} /><strong>No inline analysis images yet.</strong><span>Paste screenshots into a trade note to see them here.</span></div>}</div>; }
function WeeklyLog({ trades, sequence, onEdit, onDelete, onAdd }: { trades: Trade[]; sequence?: Map<string, number>; onEdit: (trade: Trade) => void; onDelete: (id: string) => void; onAdd?: () => void }) { const weeks = new Map<string, Trade[]>(); trades.forEach((trade) => { const date = new Date(trade.trade_date); const monday = new Date(date); const day = date.getDay() || 7; monday.setDate(date.getDate() - day + 1); const key = monday.toISOString().slice(0, 10); weeks.set(key, [...(weeks.get(key) ?? []), trade]); }); return <div className="week-scroller">{weeks.size ? [...weeks.entries()].map(([week, list]) => <section className="week-block" key={week}><div className="week-heading"><span>WEEK OF {formatDate(week)}</span><strong>{formatMoney(list.reduce((sum, trade) => sum + trade.pnl, 0))}</strong></div><TradeTable trades={list} sequence={sequence} onEdit={onEdit} onDelete={onDelete} onAdd={onAdd} /></section>) : <div className="empty-state"><Inbox size={27} /><strong>No weekly records yet.</strong></div>}</div>; }
function MonthlyLog({ trades, sequence, onEdit, onDelete, onAdd }: { trades: Trade[]; sequence?: Map<string, number>; onEdit: (trade: Trade) => void; onDelete: (id: string) => void; onAdd?: () => void }) { const monthsMap = new Map<string, Trade[]>(); trades.forEach((trade) => { const date = new Date(trade.trade_date); const key = `${date.getFullYear()}-${date.getMonth()}`; monthsMap.set(key, [...(monthsMap.get(key) ?? []), trade]); }); return <div className="week-scroller">{monthsMap.size ? [...monthsMap.entries()].map(([month, list]) => <section className="week-block" key={month}><div className="week-heading"><span>{new Date(list[0].trade_date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase()}</span><strong>{formatMoney(list.reduce((sum, trade) => sum + trade.pnl, 0))}</strong></div><TradeTable trades={list} sequence={sequence} onEdit={onEdit} onDelete={onDelete} onAdd={onAdd} /></section>) : <div className="empty-state"><Inbox size={27} /><strong>No monthly records yet.</strong></div>}</div>; }
function Lightbox({ image, onClose }: { image: string; onClose: () => void }) { return <div className="lightbox" onClick={onClose}><button className="lightbox-close" aria-label="Close"><X size={22} /></button><img src={image} alt="Trade analysis enlarged" onClick={(event) => event.stopPropagation()} /></div>; }

function TradeModal({ trade, confluences, onClose, onSave, onOpenLightbox }: { trade: Trade | null; confluences: string[]; onClose: () => void; onSave: (draft: TradeDraft, id?: string) => void; onOpenLightbox: (image: string) => void }) {
  const [draft, setDraft] = useState<TradeDraft>({ trade_date: trade?.trade_date ?? new Date().toISOString(), plan: trade?.plan ?? true, psychology: trade?.psychology ?? 'Calm / Disciplined', confluences: trade?.confluences ?? [], direction: trade?.direction ?? 'Long', stop_loss: trade?.stop_loss ?? '', take_profit: trade?.take_profit ?? '', result: trade?.result ?? 'Win', pnl: trade?.pnl ?? '', note_blocks: trade?.note_blocks ?? [] });
  const [noteFields, setNoteFields] = useState<NoteFields>(() => noteFieldsFromTrade(trade));
  const update = <K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const updateNote = (key: string, patch: Partial<NoteField>) => setNoteFields((current) => ({ ...current, [key]: { ...(current[key] ?? { text: '', image: '' }), ...patch } }));
  const pasteImage = (key: string, event: ClipboardEvent<HTMLTextAreaElement>) => { const image = [...event.clipboardData.items].find((item) => item.type.startsWith('image/')); if (!image) return; const file = image.getAsFile(); if (!file) return; const reader = new FileReader(); reader.onload = () => updateNote(key, { image: reader.result as string }); reader.readAsDataURL(file); };
  const submit = (event: FormEvent) => { event.preventDefault(); onSave({ ...draft, trade_date: new Date(draft.trade_date).toISOString(), note_blocks: noteBlocksFromFields(noteFields) }, trade?.id); };
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><form className="modal-card trade-form" onSubmit={submit}><div className="modal-header"><div><p className="eyebrow">{trade ? 'EDIT ENTRY' : 'NEW ENTRY'}</p><h2>{trade ? 'Refine the record' : 'Log a trade'}</h2></div><button type="button" className="icon-button" onClick={onClose}><X size={18} /></button></div><div className="form-grid"><label>Date & time<input type="datetime-local" value={formatDatetimeLocal(draft.trade_date)} onChange={(event) => update('trade_date', event.target.value)} /></label><label>Plan<select value={draft.plan ? 'yes' : 'no'} onChange={(event) => update('plan', event.target.value === 'yes')}><option value="yes">Yes</option><option value="no">No</option></select></label><label>Psychology<select value={draft.psychology} onChange={(event) => update('psychology', event.target.value as Psychology)}>{psychologies.map((item) => <option key={item}>{item}</option>)}</select></label><label>Result<select value={draft.result} onChange={(event) => update('result', event.target.value as Result)}>{results.map((item) => <option key={item}>{item}</option>)}</select></label><label>SL (points)<input type="number" min="0" value={draft.stop_loss} onChange={(event) => update('stop_loss', event.target.value === '' ? '' : Number(event.target.value))} /></label><label>TP (points)<input type="number" min="0" value={draft.take_profit} onChange={(event) => update('take_profit', event.target.value === '' ? '' : Number(event.target.value))} /></label><label>PnL ($)<input type="number" value={draft.pnl} onChange={(event) => update('pnl', event.target.value === '' ? '' : Number(event.target.value))} /></label></div><div className="direction-picker"><span>Direction</span><button type="button" className={draft.direction === 'Long' ? 'direction-choice selected long-choice' : 'direction-choice'} onClick={() => update('direction', 'Long')}>L <small>Long</small></button><button type="button" className={draft.direction === 'Short' ? 'direction-choice selected short-choice' : 'direction-choice'} onClick={() => update('direction', 'Short')}>S <small>Short</small></button></div><div className="confluence-picker"><div className="field-title">Confluences <span>Choose all that apply</span></div><div className="check-grid">{confluences.map((item) => <label key={item} className="check-option"><input type="checkbox" checked={draft.confluences.includes(item)} onChange={(event) => update('confluences', event.target.checked ? [...draft.confluences, item] : draft.confluences.filter((value) => value !== item))} /><span>{item}</span></label>)}</div></div><NotesEditor fields={noteFields} updateNote={updateNote} pasteImage={pasteImage} onOpenLightbox={onOpenLightbox} /><div className="modal-footer"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit"><Save size={16} /> Save trade</button></div></form></div>;
}
function NotesEditor({ fields, updateNote, pasteImage, onOpenLightbox }: { fields: NoteFields; updateNote: (key: string, patch: Partial<NoteField>) => void; pasteImage: (key: string, event: ClipboardEvent<HTMLTextAreaElement>) => void; onOpenLightbox: (image: string) => void }) {
  return (
    <div className="notes-editor strict-notes">
      <div className="field-title">Trade notes <span>Paste screenshots directly into their timeframe</span></div>
      {noteTemplate.map((item) =>
        item.title ? (
          <div className={`note-heading ${item.accent ?? ''}`} key={item.key}>{item.title}</div>
        ) : (
          <div className="note-line" key={item.key}>
            <strong>{item.label}</strong>
            <div className="note-box">
              <textarea
                value={fields[item.key]?.text ?? ''}
                onPaste={(event) => pasteImage(item.key, event)}
                onChange={(event) => updateNote(item.key, { text: event.target.value })}
                placeholder="Type or paste an image…"
              />
              {item.image && fields[item.key]?.image && (
                <div className="inline-image-block">
                  <img
                    src={fields[item.key].image}
                    alt={`${item.label} analysis`}
                    onClick={() => onOpenLightbox(fields[item.key].image)}
                    style={{ maxWidth: '100%', height: 'auto', borderRadius: '8px' }}
                  />
                  <button type="button" className="remove-image" onClick={() => updateNote(item.key, { image: '' })}>
                    <X size={13} /> Remove
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      )}
    </div>
  );
}

function Statistics({ trades, confluences, setConfluences }: { trades: Trade[]; confluences: string[]; setConfluences: (values: string[]) => void }) {
  const [editing, setEditing] = useState<string | null>(null); const [newConfluence, setNewConfluence] = useState(''); const [activeSection, setActiveSection] = useState<string>('Trade Distribution'); const totals = useMemo(() => ({ pnl: trades.reduce((sum, trade) => sum + trade.pnl, 0), wins: trades.filter((trade) => trade.result === 'Win').length }), [trades]);
  const [manageOpen, setManageOpen] = useState(false);
  const [archivedConfluences, setArchivedConfluences] = useState<string[]>([]);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const metrics = (items: Array<{ label: string; trade: Trade }>): Metric[] => { const grouped = new Map<string, Trade[]>(); items.forEach(({ label, trade }) => grouped.set(label, [...(grouped.get(label) ?? []), trade])); return [...grouped.entries()].map(([label, list]) => ({ label, trades: list.length, pnl: list.reduce((sum, item) => sum + item.pnl, 0), profit: average(list.filter((item) => item.pnl > 0).map((item) => item.pnl)), loss: average(list.filter((item) => item.pnl < 0).map((item) => item.pnl)), proportion: trades.length ? list.length / trades.length : 0, winRate: list.length ? list.filter((item) => item.result === 'Win' || item.result === 'BE → Win').length / list.length : 0 })); };
  const resultMetrics = metrics(trades.map((trade) => ({ label: trade.result, trade }))); const rrSegments = results.map((label, index) => { const list = trades.filter((trade) => trade.result === label); return { label, value: average(list.map((trade) => trade.stop_loss ? trade.take_profit / trade.stop_loss : 0)), amount: list.length, color: rrSegmentColor(label) }; }); const expectancySegments = ['Win', 'Loss'].map((label) => { const list = trades.filter((trade) => label === 'Win' ? trade.result === 'Win' || trade.result === 'BE → Win' : trade.result === 'Loss' || trade.result === 'BE → Loss'); return { label, value: list.reduce((sum, trade) => sum + trade.pnl, 0), amount: Math.abs(list.reduce((sum, trade) => sum + trade.pnl, 0)), color: label === 'Win' ? '#3B82F6' : '#334155' }; }); const psychMetrics = metrics(trades.map((trade) => ({ label: trade.psychology, trade }))); const planMetrics = metrics(trades.map((trade) => ({ label: trade.plan ? 'Yes' : 'No', trade }))); const directionMetrics = metrics(trades.map((trade) => ({ label: trade.direction, trade })));
  // Weekday aggregation: every trade's logged date (Documentary "trade_date") is converted to its
  // day-of-week label via weekdayLabel(), then trades sharing a label are grouped/aggregated together.
  const dayMetrics = metrics(trades.map((trade) => ({ label: weekdayLabel(trade.trade_date), trade }))).filter((item) => days.includes(item.label));
  const monthMetrics = metrics(trades.map((trade) => ({ label: months[new Date(trade.trade_date).getMonth()], trade }))); const confluenceMetrics = metrics(trades.flatMap((trade) => trade.confluences.map((label) => ({ label, trade }))));
  const activeConfluenceRows = confluences.map((name) => confluenceMetrics.find((row) => row.label === name) ?? blankMetric(name));
  const archivedConfluenceRows = archivedConfluences.map((name) => confluenceMetrics.find((row) => row.label === name) ?? blankMetric(name));
  const addConfluence = async () => { const value = newConfluence.trim(); if (!value || confluences.includes(value)) return; if (supabase) await supabase.from('journal_confluences').insert({ name: value, sort_order: confluences.length + 1 }); setConfluences([...confluences, value]); setNewConfluence(''); }; const rename = async (oldName: string, value: string) => { const next = value.trim(); if (!next || next === oldName) { setEditing(null); return; } if (supabase) await supabase.from('journal_confluences').update({ name: next }).eq('name', oldName); setConfluences(confluences.map((item) => item === oldName ? next : item)); setEditing(null); };
  const archive = async (name: string) => { if (supabase) await supabase.from('journal_confluences').update({ archived: true }).eq('name', name); setConfluences(confluences.filter((item) => item !== name)); setArchivedConfluences((current) => current.includes(name) ? current : [...current, name]); };
  const restore = async (name: string) => { if (supabase) await supabase.from('journal_confluences').update({ archived: false }).eq('name', name); setArchivedConfluences((current) => current.filter((item) => item !== name)); setConfluences((current) => current.includes(name) ? current : [...current, name]); };
  const scrollToSection = (title: string) => { setActiveSection(title); document.getElementById(`stat-${title.replace(/[^a-z0-9]/gi, '')}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
  return <section className="page-section stats-page"><div className="stats-title"><div><p className="eyebrow">PERFORMANCE OVERVIEW</p><h1>Statistics</h1></div><div className="stat-hero-number"><span>NET PNL</span><strong className={totals.pnl >= 0 ? 'green-text' : 'red-text'}><CountUp value={totals.pnl} format={formatMoney} /></strong><small>{totals.wins} pure wins · {trades.length} total trades</small></div></div><nav className="stats-toc"><span className="toc-label">CONTENTS</span><div className="toc-links">{statisticModules.map((title) => <button key={title} className={`toc-link ${activeSection === title ? 'active' : ''}`} onClick={() => scrollToSection(title)}>{title}</button>)}</div></nav><div className="stats-grid">
    <StatCard title="Cumulative PnL" id="stat-CumulativePnL" wide featured index={0}><InteractiveChart trades={trades} /></StatCard>
    <StatCard title="Profit Factor" id="stat-ProfitFactor" index={1}><UnifiedDonut center={profitFactor(trades)} label="Average PF Number" segments={[{ label: 'PF', value: profitFactor(trades), amount: 1, color: '#3B82F6' }]} showCallouts={false} solid /></StatCard>
    <StatCard title="Result" id="stat-Result" featured index={2}><RowCardTable rows={results.map((label) => resultMetrics.find((row) => row.label === label) ?? blankMetric(label))} /></StatCard>
    <StatCard title="Avg RR" id="stat-AvgRR" breakdown index={3}><UnifiedDonut center={average(trades.map((trade) => trade.stop_loss ? trade.take_profit / trade.stop_loss : 0))} label="Average RR" segments={rrSegments} showCallouts={false} /></StatCard>
    <StatCard title="Psychology" id="stat-Psychology" index={0}><RowCardTable rows={psychologies.map((label) => psychMetrics.find((row) => row.label === label) ?? blankMetric(label))} /></StatCard>
    <StatCard title="Expectancy $USD" id="stat-ExpectancyUSD" breakdown index={1}><UnifiedDonut center={totals.pnl} label="Total Expectancy $" segments={expectancySegments} showCallouts={false} /></StatCard>
    <StatCard title="Plan Compliance Comparison" id="stat-PlanComplianceComparison" index={2}><PlanComplianceCards metrics={['Yes', 'No'].map((label) => planMetrics.find((row) => row.label === label) ?? blankMetric(label))} /></StatCard>
    <StatCard title="PnL Extremes" id="stat-PnLExtremes" wide index={3}><ExtremePnLChart trades={trades} /></StatCard>
    <CalendarReportCard trades={trades} dayMetrics={dayMetrics} monthMetrics={monthMetrics} />
    <StatCard title="Max Consecutive Loss & Drawdown" id="stat-MCLDrawdown" index={0}><DrawdownCard streak={maxLossStreak(trades)} drawdown={maxDrawdown(trades)} /></StatCard>
    <StatCard title="Setup Type" id="stat-SetupType" index={1}><SetupTypeCards metrics={['Long', 'Short'].map((label) => directionMetrics.find((row) => row.label === label) ?? blankMetric(label))} /></StatCard>
    <StatCard title="Trade Distribution" id="stat-TradeDistribution" wide index={2}><ScatterChart trades={trades} /></StatCard>
    <StatCard title="Win Rate by Time" id="stat-WinRatebyTime" index={3}><RadarChart trades={trades} /></StatCard>
    <StatCard title="Total & Avg PnL by Time" id="stat-TotalAvgPnLbyTime" index={0}>
      <div className="pnl-time-combo">
        <div className="pnl-time-col">
          <span className="pnl-time-col-label">Total PnL</span>
          <Bars trades={trades} type="pnl" />
        </div>
        <div className="pnl-time-col">
          <span className="pnl-time-col-label">Avg PnL</span>
          <Bars trades={trades} type="avg" />
        </div>
      </div>
    </StatCard>
    <StatCard title="Confluences" id="stat-Confluences" full index={3}>
      <div className="confluence-manage-toolbar">
        <button type="button" className="secondary-button small ghost-toggle" onClick={() => setManageOpen((value) => !value)}>
          <SlidersHorizontal size={13} /> {manageOpen ? 'Hide manage panel' : 'Manage confluences'}
        </button>
      </div>
      {manageOpen && (
        <div className="confluence-manage-panel">
          <div className="manage-row"><input value={newConfluence} onChange={(event) => setNewConfluence(event.target.value)} placeholder="Add confluence" onKeyDown={(event) => event.key === 'Enter' && void addConfluence()} /><button className="secondary-button small" onClick={() => void addConfluence()}><Plus size={14} /> Add</button></div>
          <div className="editable-list">{confluences.map((name) => <div key={name}>{editing === name ? <input autoFocus defaultValue={name} onBlur={(event) => void rename(name, event.target.value)} onKeyDown={(event) => event.key === 'Enter' && void rename(name, event.currentTarget.value)} /> : <span>{name}</span>}<div><button className="row-action" onClick={() => setEditing(name)}><Pencil size={14} /></button><button className="row-action" onClick={() => void archive(name)} title="Archive"><Archive size={14} /></button></div></div>)}{!confluences.length && <div className="editable-list-empty">No active confluences.</div>}</div>
        </div>
      )}
      <MetricsTable rows={activeConfluenceRows} />
      <div className="confluence-archive-toolbar">
        <button type="button" className="secondary-button small ghost-toggle" onClick={() => setArchiveOpen((value) => !value)}>
          <Archive size={13} /> {archiveOpen ? 'Hide archived confluences' : `Show archived confluences (${archivedConfluences.length})`}
        </button>
      </div>
      {archiveOpen && (
        <div className="archived-confluences-block">
          {archivedConfluenceRows.length ? (
            <div className="metrics-table archived-table">
              <div className="metric-head"><span>Category</span><span>Trades</span><span>Total PnL</span><span>Avg Profit ($)</span><span>Avg Loss ($)</span><span>Win Rate</span></div>
              {archivedConfluenceRows.map((row) => (
                <div className="metric-row archived-row" key={row.label}>
                  <span className="metric-cat">
                    <button type="button" className="row-action restore-action" onClick={() => void restore(row.label)} title="Restore">
                      <ArchiveRestore size={13} />
                    </button>
                    {row.label}
                  </span>
                  <span>{row.trades}</span>
                  <span className={`metric-flat-value ${row.pnl >= 0 ? 'green-text' : 'red-text'}`}>{formatMoney(row.pnl)}</span>
                  <span>{row.profit ? formatMoney(row.profit) : '—'}</span>
                  <span>{row.loss ? formatMoney(row.loss) : '—'}</span>
                  <span className="metric-flat-value">{(row.winRate * 100).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="editable-list-empty">No archived confluences.</div>
          )}
        </div>
      )}
    </StatCard>
  </div></section>;
}

function StatCard({ title, id, children, wide = false, full = false, breakdown = false, featured = false, index = 0 }: { title: string; id: string; children: ReactNode; wide?: boolean; full?: boolean; breakdown?: boolean; featured?: boolean; index?: number }) {
  const { ref, visible, repeat } = useReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={`stat-card reveal-card ${visible ? 'is-visible' : ''} ${repeat ? 'is-repeat' : ''} ${wide ? 'wide' : ''} ${full ? 'full' : ''} ${breakdown ? 'breakdown-card' : ''} ${featured ? 'stat-featured' : ''}`}
      id={id}
      style={{ transitionDelay: visible && !repeat ? `${(index % 4) * 90}ms` : '0ms' }}
    >
      <div className="card-title"><strong>{title}</strong><button className="row-action"><ChevronDown size={14} /></button></div>
      {children}
    </div>
  );
}

function MetricsTable({ rows }: { rows: Metric[] }) {
  return (
    <div className="metrics-table">
      <div className="metric-head"><span>Category</span><span>Trades</span><span>Total PnL</span><span>Avg Profit ($)</span><span>Avg Loss ($)</span><span>Win Rate</span></div>
      {rows.map((row) => (
        <div className="metric-row" key={row.label}>
          <span className="metric-cat">{row.label}</span>
          <span>{row.trades}</span>
          <span className={`metric-flat-value ${row.pnl >= 0 ? 'green-text' : 'red-text'}`}>{formatMoney(row.pnl)}</span>
          <span>{row.profit ? formatMoney(row.profit) : '—'}</span>
          <span>{row.loss ? formatMoney(row.loss) : '—'}</span>
          <span className="metric-flat-value">{(row.winRate * 100).toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
}

function PlanComplianceCards({ metrics }: { metrics: Metric[] }) {
  const yes = metrics.find((row) => row.label === 'Yes') ?? blankMetric('Yes');
  const no = metrics.find((row) => row.label === 'No') ?? blankMetric('No');
  return (
    <div className="plan-compliance-wrap">
      <PlanComplianceCard tone="pos" title="Yes" metric={yes} />
      <PlanComplianceCard tone="neg" title="No" metric={no} />
    </div>
  );
}

function PlanComplianceCard({ tone, title, metric }: { tone: 'pos' | 'neg'; title: string; metric: Metric }) {
  return (
    <div className={`plan-card plan-card-${tone}`}>
      <div className="plan-card-header">
        <span className="plan-card-label"><i className={`plan-dot plan-dot-${tone}`} />{title}</span>
        {tone === 'pos' ? <CheckCircle2 size={18} className="plan-icon-pos" /> : <XCircle size={18} className="plan-icon-neg" />}
      </div>
      <div className="plan-card-main">
        <span className="plan-card-metric-label">PNL</span>
        <strong className={`plan-card-metric-value ${tone === 'pos' ? 'green-text' : 'red-text'}`}><CountUp value={metric.pnl} format={formatMoney} /></strong>
      </div>
      <div className="plan-card-divider" />
      <div className="plan-card-grid">
        <div><span>Trades</span><strong>{metric.trades}</strong></div>
        <div><span>Win Rate</span><strong>{(metric.winRate * 100).toFixed(0)}%</strong></div>
        <div><span>Avg Profit</span><strong>{metric.profit ? formatMoney(metric.profit) : '—'}</strong></div>
        <div><span>Avg Loss</span><strong>{metric.loss ? formatMoney(metric.loss) : '—'}</strong></div>
      </div>
    </div>
  );
}

function SetupTypeCards({ metrics }: { metrics: Metric[] }) {
  const long = metrics.find((row) => row.label === 'Long') ?? blankMetric('Long');
  const short = metrics.find((row) => row.label === 'Short') ?? blankMetric('Short');
  return (
    <div className="plan-compliance-wrap">
      <SetupTypeCard tone="pos" title="Long" icon={<ArrowUpRight size={14} />} metric={long} />
      <SetupTypeCard tone="neg" title="Short" icon={<ArrowUpRight size={14} style={{ transform: 'rotate(90deg)' }} />} metric={short} />
    </div>
  );
}

function SetupTypeCard({ tone, title, icon, metric }: { tone: 'pos' | 'neg'; title: string; icon?: ReactNode; metric: Metric }) {
  return (
    <div className={`plan-card plan-card-${tone}`}>
      <div className="plan-card-header">
        <span className="plan-card-label"><i className={`plan-dot plan-dot-${tone}`} />{title}</span>
        {icon}
      </div>
      <div className="plan-card-main">
        <span className="plan-card-metric-label">PNL</span>
        <strong className={`plan-card-metric-value ${metric.pnl >= 0 ? 'green-text' : 'red-text'}`}><CountUp value={metric.pnl} format={formatMoney} /></strong>
      </div>
      <div className="plan-card-divider" />
      <div className="plan-card-grid">
        <div><span>Trades</span><strong>{metric.trades}</strong></div>
        <div><span>Win Rate</span><strong>{(metric.winRate * 100).toFixed(1)}%</strong></div>
        <div><span>Avg Profit</span><strong>{metric.profit ? formatMoney(metric.profit) : '—'}</strong></div>
        <div><span>Avg Loss</span><strong>{metric.loss ? formatMoney(metric.loss) : '—'}</strong></div>
      </div>
    </div>
  );
}

function RowCardTable({ rows }: { rows: Metric[] }) {
  const { ref, visible } = useReveal<HTMLDivElement>();
  const maxWinRate = Math.max(...rows.map((row) => row.winRate), 0.0001);
  return (
    <div className="rowcard-table" ref={ref}>
      <div className="rowcard-head"><span>Category</span><span>Trades</span><span>Total PnL</span><span>Avg Profit</span><span>Avg Loss</span><span>Win Rate</span></div>
      <div className="rowcard-list">
        {rows.map((row) => {
          const winRatePct = Math.min(100, (row.winRate / maxWinRate) * 100);
          return (
            <div className="rowcard-row" key={row.label}>
              <span className="rowcard-cat"><i className={row.pnl >= 0 ? 'dot-positive' : 'dot-negative'} />{row.label}</span>
              <span className="rowcard-num">{row.trades}</span>
              <span className="rowcard-pnl-cell">
                {row.pnl === 0 ? <span className="rowcard-plain">{formatMoney(row.pnl)}</span> : <span className={`rowcard-badge ${row.pnl > 0 ? 'rowcard-badge-pos' : 'rowcard-badge-neg'}`}>{formatMoney(row.pnl)}</span>}
              </span>
              <span className="rowcard-num">{row.profit ? formatMoney(row.profit) : <span className="muted-dash">—</span>}</span>
              <span className="rowcard-num">{row.loss ? formatMoney(row.loss) : <span className="muted-dash">—</span>}</span>
              <span className="rowcard-winrate">
                <span className="rowcard-winrate-bar"><i style={{ width: visible ? `${winRatePct}%` : '0%' }} /></span>
                <span className="rowcard-winrate-value">{(row.winRate * 100).toFixed(1)}%</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DrawdownCard({ streak, drawdown }: { streak: number; drawdown: number }) {
  const danger = drawdown > DRAWDOWN_DANGER_THRESHOLD;
  return (
    <div className={`drawdown-card ${danger ? 'drawdown-danger' : ''}`}>
      <div className="drawdown-block">
        <span className="drawdown-tag">Consecutive Losses</span>
        <strong className="drawdown-value">{streak}</strong>
        <span className="drawdown-label">loss streak</span>
      </div>
      <div className="drawdown-divider" />
      <div className="drawdown-block">
        <span className="drawdown-tag accent">Peak to Trough</span>
        <strong className="drawdown-value red-text">-${drawdown.toFixed(0)}</strong>
        <span className="drawdown-label">max drawdown</span>
      </div>
    </div>
  );
}

function InteractiveChart({ trades }: { trades: Trade[] }) {
  const [zoom, setZoom] = useState(1); const [offset, setOffset] = useState(0); const [dragStart, setDragStart] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null); const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const pathRef = useRef<SVGPolylineElement | null>(null);
  const [pathLength, setPathLength] = useState(0);
  const { ref: wrapRef, visible } = useReveal<HTMLDivElement>();
  const sortedTrades = trades.slice().reverse();
  const values = sortedTrades.reduce<number[]>((acc, trade) => [...acc, (acc.at(-1) ?? 0) + trade.pnl], []);
  const max = Math.max(...values, 1); const min = Math.min(...values, 0);
  const visibleCount = Math.max(2, Math.ceil(values.length / zoom)); const maxOffset = Math.max(values.length - visibleCount, 0);
  const start = Math.min(Math.max(0, offset), maxOffset); const sliced = values.slice(start, start + visibleCount);
  const points = sliced.map((value, index) => ({ x: (index / Math.max(sliced.length - 1, 1)) * 100, y: 93 - ((value - min) / Math.max(max - min, 1)) * 78, value, tradeIndex: start + index }));
  const pointString = points.map((point) => `${point.x},${point.y}`).join(' ');
  useEffect(() => { if (pathRef.current) { try { setPathLength(pathRef.current.getTotalLength()); } catch { setPathLength(0); } } }, [pointString]);
  const wheel = (event: React.WheelEvent<HTMLDivElement>) => { event.preventDefault(); setZoom((value) => Math.max(1, Math.min(Math.max(values.length, 2), value + (event.deltaY < 0 ? .5 : -.5)))); };
  const zoomIn = () => setZoom((v) => Math.max(1, Math.min(Math.max(values.length, 2), v + 0.5)));
  const zoomOut = () => setZoom((v) => Math.max(1, Math.min(Math.max(values.length, 2), v - 0.5)));
  const resetZoom = () => { setZoom(1); setOffset(0); };
  const handleMove = (event: PointerEvent<HTMLDivElement>) => {
    if (dragStart !== null && values.length > visibleCount) { const shift = Math.round((dragStart - event.clientX) / 35); if (shift) { setOffset((value) => Math.max(0, Math.min(maxOffset, value + shift))); setDragStart(event.clientX); } return; }
    if (!svgRef.current || points.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const relX = ((event.clientX - rect.left) / rect.width) * 100;
    let nearest = points[0]; let nearestDist = Infinity;
    points.forEach((point) => { const dist = Math.abs(point.x - relX); if (dist < nearestDist) { nearestDist = dist; nearest = point; } });
    setHoverIndex(nearest.tradeIndex);
    setHoverPos({ x: ((nearest.x / 100) * rect.width), y: ((nearest.y / 100) * rect.height) });
  };
  const hoverTrade = hoverIndex !== null ? sortedTrades[hoverIndex] : null;
  const hoverValue = hoverIndex !== null ? values[hoverIndex] : null;
  const hoverPoint = points.find((p) => p.tradeIndex === hoverIndex);
  return <div className="interactive-chart" ref={wrapRef} onWheel={wheel} onPointerDown={(event) => setDragStart(event.clientX)} onPointerMove={handleMove} onPointerUp={() => setDragStart(null)} onPointerLeave={() => { setDragStart(null); setHoverIndex(null); setHoverPos(null); }}><div className="chart-y-axis"><span>{max.toFixed(0)}</span><span>{((max + min) / 2).toFixed(0)}</span><span>{min.toFixed(0)}</span></div><span className="chart-y-label">PnL ($)</span><svg ref={svgRef} viewBox="0 0 100 100" preserveAspectRatio="none" shapeRendering="geometricPrecision"><defs><linearGradient id="pnl-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#10B981" stopOpacity="0.25" /><stop offset="100%" stopColor="#10B981" stopOpacity="0" /></linearGradient><filter id="pnl-line-glow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="0" stdDeviation="1.1" floodColor="#10B981" floodOpacity="0.55" /></filter></defs><g className="chart-grid">{[18,43,68,93].map((y) => <line key={y} x1="0" x2="100" y1={y} y2={y} vectorEffect="non-scaling-stroke" />)}</g>{(() => { const zy = 93 - ((0 - min) / Math.max(max - min, 1)) * 78; return <line className="chart-zero-line" x1="0" x2="100" y1={zy} y2={zy} vectorEffect="non-scaling-stroke" />; })()}{points.length > 1 && <><polygon points={`0,100 ${pointString} 100,100`} fill="url(#pnl-fill)" /><polyline ref={pathRef} points={pointString} fill="none" stroke="#10B981" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" filter="url(#pnl-line-glow)" className="chart-draw-path" style={{ strokeDasharray: pathLength || undefined, strokeDashoffset: visible ? 0 : pathLength }} /></>}{hoverPoint && <line className="chart-crosshair-line" x1={hoverPoint.x} x2={hoverPoint.x} y1="0" y2="100" vectorEffect="non-scaling-stroke" />}{hoverPoint && <circle className="chart-crosshair-dot" cx={hoverPoint.x} cy={hoverPoint.y} r="1.6" vectorEffect="non-scaling-stroke" />}</svg><div className="chart-zoom-controls"><button className="chart-zoom-btn" onClick={zoomOut} title="Zoom out">−</button><button className="chart-zoom-btn" onClick={resetZoom} title="Reset">⟲</button><button className="chart-zoom-btn" onClick={zoomIn} title="Zoom in">+</button></div><span className="chart-x-label">Date →</span>{!trades.length && <div className="chart-empty">Add trades to see your curve</div>}<input className="chart-brush" type="range" min="0" max={maxOffset} value={Math.min(offset, maxOffset)} onChange={(event) => setOffset(Number(event.target.value))} aria-label="Chart date range" />{hoverTrade && hoverPos && hoverValue !== null && (
    <div className="chart-tooltip" style={{ left: hoverPos.x, top: hoverPos.y }}>
      <div className="tt-date">{new Date(hoverTrade.trade_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, {formatTime(hoverTrade.trade_date)}</div>
      <div className="tt-value">{formatMoney(hoverValue)}</div>
      <div className="tt-label">Cumulative</div>
    </div>
  )}</div>;
}

function rrSegmentColor(label: Result) {
  if (label === 'Win') return '#3B82F6';
  if (label === 'Loss') return '#334155';
  return '#94A3B8';
}

function UnifiedDonut({ center, label, segments, showSubtitle = true, showCallouts = true, solid = false }: { center: number; label: string; segments: Array<{ label: string; value: number; amount: number; color: string }>; showSubtitle?: boolean; showCallouts?: boolean; solid?: boolean }) {
  const { ref, visible } = useReveal<HTMLDivElement>();
  const radius = 88; const stroke = 7; const circumference = 2 * Math.PI * radius; const total = segments.reduce((sum, segment) => sum + Math.abs(segment.amount), 0); let cursor = 0; const decimals = label === 'Average RR' ? 1 : 2;
  // Thin ring: innerRadius ~85% of outer radius means the stroke should be a slim ~7-8 units.
  const gapDegrees = segments.length > 1 ? 2.5 : 0;
  // Outer connector-line callouts (subtle, muted) positioned around the ring by cumulative angle.
  let calloutCursor = 0;
  const calloutData = segments.map((segment) => {
    const share = total ? Math.abs(segment.amount) / total : 1 / Math.max(segments.length, 1);
    const midFraction = calloutCursor + share / 2;
    calloutCursor += share;
    const angleDeg = midFraction * 360 - 90;
    const angleRad = (angleDeg * Math.PI) / 180;
    const percentage = total ? (Math.abs(segment.amount) / total) * 100 : 0;
    return { segment, angleRad, percentage };
  });
  return (
    <div className={`unified-donut ${solid ? 'unified-donut-solid' : ''}`} ref={ref}>
      <svg viewBox="0 0 220 220" role="img" aria-label={`${label}: ${center.toFixed(decimals)}`}>
        <g transform="translate(110 110)">
          <circle className="unified-donut-track" r={radius} fill="none" strokeWidth={stroke} />
          <circle className="unified-donut-hole" r={radius - stroke / 2} />
          <g transform="rotate(-90)">
            {segments.map((segment) => {
              const share = total ? Math.abs(segment.amount) / total : 1 / Math.max(segments.length, 1);
              const gapLength = (gapDegrees / 360) * circumference;
              const length = Math.max(circumference * share - gapLength, 0);
              const dashOffset = -circumference * cursor;
              cursor += share;
              return <circle key={segment.label} className="unified-donut-segment draw-in" r={radius} fill="none" stroke={segment.color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={visible ? `${length} ${circumference - length}` : `0 ${circumference}`} strokeDashoffset={dashOffset} />;
            })}
          </g>
          <text className={`unified-donut-value ${visible ? 'draw-in' : ''}`} textAnchor="middle" y="6">{center.toFixed(decimals)}</text>
          {showSubtitle && <text className="unified-donut-subtitle" textAnchor="middle" y="27">{label}</text>}
          {showCallouts && !solid && visible && calloutData.map(({ segment, angleRad, percentage }) => {
            const innerR = radius + stroke / 2 + 2;
            const bendR = radius + 22;
            const outerR = radius + 40;
            const x1 = Math.cos(angleRad) * innerR, y1 = Math.sin(angleRad) * innerR;
            const x2 = Math.cos(angleRad) * bendR, y2 = Math.sin(angleRad) * bendR;
            const dir = Math.cos(angleRad) >= 0 ? 1 : -1;
            const x3 = x2 + dir * 14, y3 = y2;
            const textX = x3 + dir * 3;
            return (
              <g key={`callout-${segment.label}`} className="donut-callout-group">
                <polyline className="donut-callout-line" points={`${x1},${y1} ${x2},${y2} ${x3},${y3}`} fill="none" />
                <text className="donut-callout-text" x={textX} y={y3} textAnchor={dir > 0 ? 'start' : 'end'} dominantBaseline="middle">
                  {segment.label} {segment.value.toFixed(decimals)} ({percentage.toFixed(1)}%)
                </text>
              </g>
            );
          })}
        </g>
      </svg>
      {!showCallouts && !solid && segments.length > 0 && (
        <div className="donut-legend">
          {segments.map((segment) => {
            const percentage = total ? (Math.abs(segment.amount) / total) * 100 : 0;
            return (
              <div className="donut-legend-row" key={`legend-${segment.label}`}>
                <span className="donut-legend-dot" style={{ background: segment.color }} />
                <span className="donut-legend-label">{segment.label}</span>
                <span className="donut-legend-value">{segment.value.toFixed(decimals)}</span>
                <span className="donut-legend-pct">{percentage.toFixed(1)}%</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Bars({ trades, type }: { trades: Trade[]; type: 'count' | 'winrate' | 'pnl' | 'avg' }) {
  const { ref, visible } = useReveal<HTMLDivElement>();
  const labels = timeSlotLabels;
  const groups = labels.map((label) => { const list = trades.filter((trade) => timeSlot(trade.trade_date) === label); const value = type === 'count' ? list.length : type === 'winrate' ? (list.filter((item) => item.result === 'Win').length / Math.max(list.length, 1)) * 100 : type === 'avg' ? average(list.map((item) => item.pnl)) : list.reduce((sum, item) => sum + item.pnl, 0); return { label, value }; });
  const max = Math.max(...groups.map((item) => Math.abs(item.value)), 1);
  return <div className="bars" ref={ref}>{groups.map((item) => { const intensity = Math.abs(item.value) / max; return <div className="bar-row" key={item.label}><span>{item.label}</span><div><i className="draw-in" style={{ width: visible ? `${intensity * 100}%` : '0%', background: item.value < 0 ? 'var(--red)' : 'var(--green)' }} /></div><strong className={item.value < 0 ? 'bar-neg' : ''}>{type === 'winrate' ? `${item.value.toFixed(0)}%` : type === 'count' ? item.value : formatMoney(item.value)}</strong></div>; })}</div>;
}

// Scatter chart time domain: 9:00 to 12:00 gives comfortable margin around the five labeled
// milestones (9:30 / 10:00 / 10:30 / 11:00 / 11:30) while keeping outlier trades visible at the edges.
const SCATTER_DOMAIN_START_MIN = 9 * 60;
const SCATTER_DOMAIN_END_MIN = 12 * 60;
const scatterMilestones = [
  { label: '9:30', minutes: 9 * 60 + 30 },
  { label: '10:00', minutes: 10 * 60 },
  { label: '10:30', minutes: 10 * 60 + 30 },
  { label: '11:00', minutes: 11 * 60 },
  { label: '11:30', minutes: 11 * 60 + 30 },
].map((m) => ({ ...m, x: ((m.minutes - SCATTER_DOMAIN_START_MIN) / (SCATTER_DOMAIN_END_MIN - SCATTER_DOMAIN_START_MIN)) * 100 }));
const scatterTimeToX = (value: string) => {
  const d = new Date(value);
  const mins = d.getHours() * 60 + d.getMinutes();
  const clamped = Math.max(SCATTER_DOMAIN_START_MIN, Math.min(SCATTER_DOMAIN_END_MIN, mins));
  return ((clamped - SCATTER_DOMAIN_START_MIN) / (SCATTER_DOMAIN_END_MIN - SCATTER_DOMAIN_START_MIN)) * 100;
};

/** "Trade Distribution" scatter plot: each trade plotted by execution time (x) vs PnL amount in dollars (y),
 * on a transparent plot surface that inherits the parent card's background. A low-opacity zero-baseline separates
 * wins (above) from losses (below), and solid, clearly-visible vertical dividers mark the five session milestones
 * (9:30 / 10:00 / 10:30 / 11:00 / 11:30) the x-axis labels sit under, segmenting the chart into time blocks.
 * Dots are rendered as fixed-radius <circle> elements (never stretched) via a non-uniform
 * viewBox-safe transform so they stay mathematically circular regardless of the plot's aspect ratio. */
function ScatterChart({ trades }: { trades: Trade[] }) {
  const { ref, visible } = useReveal<HTMLDivElement>();
  const [hover, setHover] = useState<{ trade: Trade; x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [dims, setDims] = useState({ w: 700, h: 250 });
  useEffect(() => {
    const node = svgRef.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => { const { width, height } = entry.contentRect; if (width && height) setDims({ w: width, h: height }); });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const winValues = trades.filter((t) => t.pnl > 0).map((t) => t.pnl);
  const lossValues = trades.filter((t) => t.pnl < 0).map((t) => Math.abs(t.pnl));
  const maxWin = Math.max(...winValues, 50);
  const maxLoss = Math.max(...lossValues, 50);
  const pnlToY = (pnl: number) => pnl >= 0 ? 50 - (pnl / maxWin) * 46 : 50 + (Math.abs(pnl) / maxLoss) * 46;
  // Fixed pixel radius for perfectly circular dots regardless of the SVG's non-uniform x/y scaling
  // (viewBox is 100x100 mapped onto a wide rectangular box, so a plain r="1.5" in user units renders
  // as an ellipse — we counter-scale using the actual rendered width/height instead).
  const rPx = 5;
  const rxUnits = dims.w ? (rPx / dims.w) * 100 : 1.5;
  const ryUnits = dims.h ? (rPx / dims.h) * 100 : 1.5;
  return (
    <div className="scatter-chart scatter-chart-wide" ref={ref}>
      <div className="scatter-y-axis">
        <span>{`+$${maxWin.toFixed(0)}`}</span>
        <span>$0</span>
        <span>{`-$${maxLoss.toFixed(0)}`}</span>
      </div>
      <div className="scatter-plot-area">
        <svg ref={svgRef} viewBox="0 0 100 100" preserveAspectRatio="none" shapeRendering="geometricPrecision">
          {scatterMilestones.map((m) => (
            <line key={m.label} x1={m.x} x2={m.x} y1="0" y2="100" stroke="#94A3B8" strokeOpacity="0.5" strokeWidth="2.5" className="scatter-divider" vectorEffect="non-scaling-stroke" />
          ))}
          <line x1="0" x2="100" y1="50" y2="50" className="scatter-zero-line" vectorEffect="non-scaling-stroke" />
          {trades.map((trade) => {
            const isWin = trade.pnl > 0;
            const isLoss = trade.pnl < 0;
            const cx = scatterTimeToX(trade.trade_date);
            const cy = pnlToY(trade.pnl);
            return (
              <ellipse
                key={trade.id}
                cx={cx}
                cy={cy}
                rx={rxUnits}
                ry={ryUnits}
                fill={isWin ? '#10B981' : isLoss ? '#EF4444' : '#64748B'}
                stroke="#0d101a"
                strokeWidth="0.45"
                vectorEffect="non-scaling-stroke"
                className="scatter-dot"
                style={{ opacity: visible ? 0.95 : 0 }}
                onMouseEnter={(event) => { const svg = (event.target as SVGElement).ownerSVGElement; if (!svg) return; const rect = svg.getBoundingClientRect(); setHover({ trade, x: (cx / 100) * rect.width, y: (cy / 100) * rect.height }); }}
                onMouseLeave={() => setHover(null)}
              />
            );
          })}
        </svg>
        <div className="scatter-axis-labels">
          {scatterMilestones.map((m) => (
            <span key={m.label} style={{ left: `${m.x}%` }}>{m.label}</span>
          ))}
        </div>
        {!trades.length && <div className="chart-empty">Add trades to see the distribution</div>}
        {hover && (
          <div className="scatter-tooltip" style={{ left: hover.x, top: hover.y }}>
            <div className="tt-date">{formatTime(hover.trade.trade_date)}</div>
            <div className="tt-value" style={{ color: hover.trade.pnl >= 0 ? '#10B981' : '#EF4444' }}>{formatMoney(hover.trade.pnl)}</div>
            <div className="tt-label">{hover.trade.confluences[0] ?? 'No setup tagged'}</div>
          </div>
        )}
      </div>
    </div>
  );
}

/** "Win Rate by Time" radar/spider chart, one axis per session macro window. Click a vertex to pin a callout with the exact win rate for that window. */
function RadarChart({ trades }: { trades: Trade[] }) {
  const labels = timeSlotLabels;
  const { ref, visible } = useReveal<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const values = labels.map((label) => { const list = trades.filter((t) => timeSlot(t.trade_date) === label); return list.length ? (list.filter((t) => t.result === 'Win').length / list.length) * 100 : 0; });
  const cx = 50, cy = 50, R = 38;
  const angle = (i: number) => (Math.PI * 2 * i) / labels.length - Math.PI / 2;
  const pointAt = (i: number, r: number) => ({ x: cx + Math.cos(angle(i)) * r, y: cy + Math.sin(angle(i)) * r });
  const scale = visible ? 1 : 0;
  const polygonPoints = values.map((v, i) => { const p = pointAt(i, (v / 100) * R * scale); return `${p.x},${p.y}`; }).join(' ');
  return (
    <div className="radar-chart" ref={ref}>
      <svg viewBox="0 0 100 100">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <polygon key={f} points={labels.map((_, i) => { const p = pointAt(i, R * f); return `${p.x},${p.y}`; }).join(' ')} fill="none" stroke="#33343a" strokeWidth="0.4" />
        ))}
        {labels.map((_, i) => { const p = pointAt(i, R); return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#33343a" strokeWidth="0.4" />; })}
        <polygon points={polygonPoints} className="radar-polygon" fill="var(--green)" fillOpacity="0.3" stroke="var(--green)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        {values.map((v, i) => { const p = pointAt(i, (v / 100) * R * scale); return (
          <circle key={i} cx={p.x} cy={p.y} r="1.8" fill="var(--green)" className="radar-vertex" onClick={() => setActive(active === i ? null : i)} />
        ); })}
        {labels.map((label, i) => { const p = pointAt(i, R + 11); return <text key={label} x={p.x} y={p.y} fontSize="4.2" fill="#888c94" textAnchor="middle" dominantBaseline="middle">{label}</text>; })}
      </svg>
      {active !== null && (() => { const p = pointAt(active, (values[active] / 100) * R * scale); return (
        <div className="radar-callout" style={{ left: `${p.x}%`, top: `${p.y}%` }}>
          <div className="rc-zone">{labels[active]}</div>
          <div className="rc-rate">Win Rate: {values[active].toFixed(0)}%</div>
        </div>
      ); })()}
    </div>
  );
}

type CalendarView = 'calendar' | 'weekdays' | 'monthly';
const calendarWeekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Combined "Weekdays / Monthly" reporting module. Top-left tab switcher toggles between a
 * heatmap-style Calendar View (default), and the existing Weekdays/Monthly metrics tables.
 * Calendar pagination controls (month/year label + prev/next/today) only render in Calendar View.
 * A left-hand weekly sidebar (W1..W5) shows each week's total PnL and trade count alongside the grid.
 * Rendered as a "wide" stat-card (spans both grid columns), matching the PnL Extremes card's footprint. */
function CalendarReportCard({ trades, dayMetrics, monthMetrics }: { trades: Trade[]; dayMetrics: Metric[]; monthMetrics: Metric[] }) {
  const { ref, visible, repeat } = useReveal<HTMLDivElement>();
  const [view, setView] = useState<CalendarView>('calendar');
  const [cursor, setCursor] = useState<Date>(() => { const latest = trades[0]?.trade_date; const base = latest ? new Date(latest) : new Date(); return new Date(base.getFullYear(), base.getMonth(), 1); });

  const monthLabel = cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const goPrev = () => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1));
  const goNext = () => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1));
  const goToday = () => { const now = new Date(); setCursor(new Date(now.getFullYear(), now.getMonth(), 1)); };

  const dailyTrades = useMemo(() => {
    const map = new Map<number, Trade[]>();
    trades.forEach((trade) => {
      const date = new Date(trade.trade_date);
      if (date.getFullYear() === cursor.getFullYear() && date.getMonth() === cursor.getMonth()) {
        map.set(date.getDate(), [...(map.get(date.getDate()) ?? []), trade]);
      }
    });
    return map;
  }, [trades, cursor]);

  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const firstWeekday = (new Date(cursor.getFullYear(), cursor.getMonth(), 1).getDay() + 6) % 7; // 0 = Monday
  const cells: Array<number | null> = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  // Group the visible month's cells into calendar weeks (rows of 7) so the sidebar can show a
  // per-week PnL + trade-count summary (W1..W5) alongside the grid.
  const weekSummaries = useMemo(() => {
    const weeks: Array<{ pnl: number; trades: number }> = [];
    for (let i = 0; i < cells.length; i += 7) {
      const rowDays = cells.slice(i, i + 7).filter((d): d is number => d !== null);
      let pnl = 0; let count = 0;
      rowDays.forEach((day) => { const list = dailyTrades.get(day) ?? []; count += list.length; pnl += list.reduce((sum, t) => sum + t.pnl, 0); });
      weeks.push({ pnl, trades: count });
    }
    return weeks.slice(0, 5);
  }, [cells, dailyTrades]);

  return (
    <div ref={ref} id="stat-Calendar" className={`stat-card reveal-card calendar-report-card wide ${visible ? 'is-visible' : ''} ${repeat ? 'is-repeat' : ''}`}>
      <div className="calendar-module-header">
        <div className="calendar-view-switch">
          <button className={view === 'calendar' ? 'active' : ''} onClick={() => setView('calendar')}>Calendar View</button>
          <button className={view === 'weekdays' ? 'active' : ''} onClick={() => setView('weekdays')}>Weekdays Report</button>
          <button className={view === 'monthly' ? 'active' : ''} onClick={() => setView('monthly')}>Monthly Report</button>
        </div>
        {view === 'calendar' && (
          <div className="calendar-controls">
            <button className="cal-nav-btn" onClick={goPrev} aria-label="Previous month"><ChevronLeft size={15} /></button>
            <span className="cal-month-label">{monthLabel}</span>
            <button className="cal-nav-btn" onClick={goNext} aria-label="Next month"><ChevronRight size={15} /></button>
            <button className="cal-today-btn" onClick={goToday}>This Month</button>
          </div>
        )}
      </div>
      {view === 'calendar' ? (
        <div className="calendar-body-layout">
          <div className="calendar-week-sidebar">
            {weekSummaries.map((week, index) => (
              <div className="calendar-week-card" key={index}>
                <span className="calendar-week-label">{`W${index + 1}`}</span>
                <strong className={week.pnl >= 0 ? 'green-text' : 'red-text'}>{formatMoney(week.pnl)}</strong>
                <span className="calendar-week-count">{week.trades} {week.trades === 1 ? 'trade' : 'trades'}</span>
              </div>
            ))}
          </div>
          <div className="calendar-grid-wrap">
            <div className="calendar-weekday-row">{calendarWeekdayLabels.map((label) => <span key={label}>{label}</span>)}</div>
            <div className="calendar-days-grid">
              {cells.map((day, index) => {
                if (day === null) return <div className="calendar-cell calendar-cell-empty" key={`empty-${index}`} />;
                const dayTrades = dailyTrades.get(day) ?? [];
                const netPnl = dayTrades.reduce((sum, trade) => sum + trade.pnl, 0);
                const winCount = dayTrades.filter((trade) => trade.result === 'Win' || trade.result === 'BE → Win').length;
                const winRate = dayTrades.length ? (winCount / dayTrades.length) * 100 : 0;
                const state = !dayTrades.length ? 'neutral' : netPnl > 0 ? 'win' : netPnl < 0 ? 'loss' : 'neutral';
                return (
                  <div className={`calendar-cell calendar-cell-${state}`} key={day}>
                    <span className="calendar-date-num">{day}</span>
                    {dayTrades.length > 0 && (
                      <div className="calendar-cell-center">
                        <strong className={netPnl >= 0 ? 'green-text' : 'red-text'}>{formatMoney(netPnl)}</strong>
                        <span>{dayTrades.length} {dayTrades.length === 1 ? 'trade' : 'trades'}</span>
                        <span>{winRate.toFixed(1)}%</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : view === 'weekdays' ? (
        <MetricsTable rows={days.map((label) => dayMetrics.find((row) => row.label === label) ?? blankMetric(label))} />
      ) : (
        <MetricsTable rows={months.map((label) => monthMetrics.find((row) => row.label === label) ?? blankMetric(label))} />
      )}
    </div>
  );
}

function timeSlot(value: string) { const date = new Date(value); const minutes = date.getHours() * 60 + date.getMinutes(); if (minutes >= 570 && minutes < 600) return '9:30 - 10:00'; if (minutes >= 600 && minutes < 630) return '10:00 - 10:30'; if (minutes >= 630 && minutes < 660) return '10:30 - 11:00'; if (minutes >= 660 && minutes < 690) return '11:00 - 11:30'; return 'Others'; }
// Converts a trade's logged date/time into its day-of-week label ('Mon'..'Sun').
// Used by the "Weekdays" statistics table to group and aggregate trades by the day they were logged.
function weekdayLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const jsWeekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']; // Date#getDay(): 0=Sun..6=Sat
  return jsWeekdayLabels[date.getDay()];
}
function CountUp({ value, format }: { value: number; format: (n: number) => string }) { const [display, setDisplay] = useState(0); useEffect(() => { let frame: number; const start = performance.now(); const duration = 800; const animate = (now: number) => { const progress = Math.min((now - start) / duration, 1); const eased = 1 - Math.pow(1 - progress, 3); setDisplay(value * eased); if (progress < 1) frame = requestAnimationFrame(animate); }; frame = requestAnimationFrame(animate); return () => cancelAnimationFrame(frame); }, [value]); return <>{format(display)}</>; }
function average(values: number[]) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0; }
function blankMetric(label: string): Metric { return { label, trades: 0, pnl: 0, profit: 0, loss: 0, proportion: 0, winRate: 0 }; }
function ExtremePnLChart({ trades }: { trades: Trade[] }) {
  const { ref, visible } = useReveal<HTMLDivElement>();
  const ext = pnlExtremes(trades); const rows = [{ label: 'Daily', best: ext.bestDaily, worst: ext.worstDaily }, { label: 'Weekly', best: ext.bestWeekly, worst: ext.worstWeekly }]; const maxAbs = Math.max(...rows.flatMap((r) => [Math.abs(r.best), Math.abs(r.worst)]), 1);
  return <div className="extreme-pnl-chart" ref={ref}><div className="extreme-pnl-header"><span>PERIOD</span><span className="neg-header">WORST ←</span><span className="pos-header">→ BEST</span></div>{rows.map((row) => { const bestPct = visible ? (row.best / maxAbs) * 50 : 0; const worstPct = visible ? (Math.abs(row.worst) / maxAbs) * 50 : 0; return <div className="extreme-pnl-row" key={row.label}><span className="extreme-pnl-row-label">{row.label}</span><div className="extreme-pnl-track"><div className="extreme-pnl-left">{row.worst < 0 ? [<span key="v" className="extreme-pnl-value neg-val">${row.worst.toFixed(0)}</span>, <div key="b" className="extreme-pnl-bar neg draw-in" style={{ width: `${worstPct}%` }} />] : null}</div><div className="extreme-pnl-axis" /><div className="extreme-pnl-right">{row.best > 0 ? [<div key="b" className="extreme-pnl-bar pos draw-in" style={{ width: `${bestPct}%` }} />, <span key="v" className="extreme-pnl-value pos-val">+${row.best.toFixed(0)}</span>] : null}</div></div></div>; })}<div className="extreme-pnl-summary"><span>Best Trade: <strong className="pos-text">+${ext.best.toFixed(0)}</strong></span><span>Worst Trade: <strong className="neg-text">${ext.worst.toFixed(0)}</strong></span></div></div>;
}
function pnlExtremes(trades: Trade[]): PnlExtreme { let best = 0; let worst = 0; trades.forEach((trade) => { best = Math.max(best, trade.pnl); worst = Math.min(worst, trade.pnl); }); const dailyMap = new Map<string, number>(); trades.forEach((trade) => { const key = trade.trade_date.slice(0, 10); dailyMap.set(key, (dailyMap.get(key) ?? 0) + trade.pnl); }); const dailyValues = [...dailyMap.values()]; const bestDaily = dailyValues.length ? Math.max(...dailyValues) : 0; const worstDaily = dailyValues.length ? Math.min(...dailyValues) : 0; const weeklyMap = new Map<string, number>(); trades.forEach((trade) => { const date = new Date(trade.trade_date); const monday = new Date(date); const day = date.getDay() || 7; monday.setDate(date.getDate() - day + 1); const key = monday.toISOString().slice(0, 10); weeklyMap.set(key, (weeklyMap.get(key) ?? 0) + trade.pnl); }); const weeklyValues = [...weeklyMap.values()]; const bestWeekly = weeklyValues.length ? Math.max(...weeklyValues) : 0; const worstWeekly = weeklyValues.length ? Math.min(...weeklyValues) : 0; return { best, worst, bestDaily, worstDaily, bestWeekly, worstWeekly }; }
function profitFactor(trades: Trade[]) { const gains = trades.filter((trade) => trade.pnl > 0).reduce((sum, trade) => sum + trade.pnl, 0); const losses = Math.abs(trades.filter((trade) => trade.pnl < 0).reduce((sum, trade) => sum + trade.pnl, 0)); return losses ? gains / losses : gains; }
function maxLossStreak(trades: Trade[]) { let current = 0; let max = 0; trades.slice().reverse().forEach((trade) => { current = trade.result === 'Loss' ? current + 1 : 0; max = Math.max(max, current); }); return max; }
function maxDrawdown(trades: Trade[]) { let peak = 0; let running = 0; let max = 0; trades.slice().reverse().forEach((trade) => { running += trade.pnl; peak = Math.max(peak, running); max = Math.max(max, peak - running); }); return max; }
export default App;
