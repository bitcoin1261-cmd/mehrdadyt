export type Direction = "buy" | "sell";

export interface Trade {
  id: number;
  accountId: number;
  externalId: string | null;
  source: string;
  symbol: string;
  direction: Direction;
  volume: number;
  closedVolume: number;
  openTime: string;
  closeTime: string | null;
  openPrice: number | null;
  closePrice: number | null;
  sl: number | null;
  tp: number | null;
  commission: number;
  swap: number;
  fee: number;
  grossProfit: number;
  netProfit: number;
  pips: number | null;
  riskAmount: number | null;
  rMultiple: number | null;
  status: "open" | "closed";
  strategy: string | null;
  setup: string | null;
  timeframe: string | null;
  session: string | null;
  emotion: string | null;
  rating: number | null;
  followedPlan: boolean | null;
  mistake: string | null;
  notes: string | null;
  tags: string[];
  screenshotUrl: string | null;
  openShotUrl: string | null;
  closeShotUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Account {
  id: number;
  name: string;
  broker: string | null;
  login: string | null;
  currency: string;
  initialBalance: number;
  isDefault: boolean;
}

export interface JournalNote {
  id: number;
  noteDate: string;
  mood: string | null;
  title: string | null;
  body: string | null;
  lesson: string | null;
}

export interface GroupStat {
  key: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  net: number;
  avgR: number | null;
  volume: number;
}

export interface Summary {
  totalTrades: number;
  closedTrades: number;
  openTrades: number;
  wins: number;
  losses: number;
  breakEven: number;
  winRate: number;
  netProfit: number;
  grossProfit: number;
  grossLoss: number;
  profitFactor: number | null;
  expectancy: number;
  avgWin: number;
  avgLoss: number;
  payoff: number | null;
  bestTrade: number;
  worstTrade: number;
  avgR: number | null;
  totalR: number | null;
  avgHoldMinutes: number | null;
  totalVolume: number;
  totalCommission: number;
  totalSwap: number;
  maxDrawdown: number;
  maxDrawdownPct: number | null;
  maxWinStreak: number;
  maxLossStreak: number;
  currentStreak: number;
  currentStreakType: "win" | "loss" | "none";
  returnPct: number | null;
  planFollowRate: number | null;
  openPnl: number;
}

export interface EquityPoint {
  i: number;
  equity: number;
  time: string;
  label: string;
}

export interface DayStat {
  date: string;
  net: number;
  trades: number;
}

const num = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const round = (v: number, d = 2) => {
  if (!Number.isFinite(v)) return 0;
  const p = 10 ** d;
  return Math.round(v * p) / p;
};

export function roundMoney(v: number) {
  return round(v, 2);
}

export function closedTradesOf(trades: Trade[]) {
  return trades
    .filter((t) => t.status === "closed")
    .sort((a, b) => new Date(a.closeTime ?? a.openTime).getTime() - new Date(b.closeTime ?? b.openTime).getTime());
}

export function computeSummary(trades: Trade[], initialBalance = 0): Summary {
  const closed = closedTradesOf(trades);
  const open = trades.filter((t) => t.status === "open");

  const wins = closed.filter((t) => t.netProfit > 0);
  const losses = closed.filter((t) => t.netProfit < 0);
  const breakEven = closed.length - wins.length - losses.length;

  const grossProfit = wins.reduce((s, t) => s + num(t.netProfit), 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + num(t.netProfit), 0));
  const netProfit = grossProfit - grossLoss;

  const avgWin = wins.length ? grossProfit / wins.length : 0;
  const avgLoss = losses.length ? grossLoss / losses.length : 0;
  const expectancy = closed.length ? netProfit / closed.length : 0;

  const rs = closed.map((t) => t.rMultiple).filter((r): r is number => typeof r === "number" && Number.isFinite(r));
  const totalR = rs.length ? rs.reduce((s, r) => s + r, 0) : null;

  const holds = closed
    .filter((t) => t.closeTime)
    .map((t) => (new Date(t.closeTime as string).getTime() - new Date(t.openTime).getTime()) / 60000);

  // equity curve based drawdown
  let equity = initialBalance;
  let peak = initialBalance;
  let maxDrawdown = 0;
  let maxDrawdownPct: number | null = initialBalance > 0 ? 0 : null;
  for (const t of closed) {
    equity += num(t.netProfit);
    if (equity > peak) peak = equity;
    const dd = peak - equity;
    if (dd > maxDrawdown) {
      maxDrawdown = dd;
      if (peak > 0) maxDrawdownPct = (dd / peak) * 100;
    }
  }

  let maxWinStreak = 0;
  let maxLossStreak = 0;
  let curWin = 0;
  let curLoss = 0;
  for (const t of closed) {
    if (t.netProfit > 0) {
      curWin += 1;
      curLoss = 0;
    } else if (t.netProfit < 0) {
      curLoss += 1;
      curWin = 0;
    }
    maxWinStreak = Math.max(maxWinStreak, curWin);
    maxLossStreak = Math.max(maxLossStreak, curLoss);
  }

  let currentStreak = 0;
  let currentStreakType: "win" | "loss" | "none" = "none";
  for (let i = closed.length - 1; i >= 0; i -= 1) {
    const p = closed[i].netProfit;
    if (p === 0) break;
    const type = p > 0 ? "win" : "loss";
    if (currentStreakType === "none") currentStreakType = type;
    if (type !== currentStreakType) break;
    currentStreak += 1;
  }

  const rated = trades.filter((t) => typeof t.followedPlan === "boolean");
  const planFollowRate = rated.length
    ? (rated.filter((t) => t.followedPlan).length / rated.length) * 100
    : null;

  return {
    totalTrades: trades.length,
    closedTrades: closed.length,
    openTrades: open.length,
    wins: wins.length,
    losses: losses.length,
    breakEven,
    winRate: closed.length ? (wins.length / closed.length) * 100 : 0,
    netProfit: round(netProfit, 2),
    grossProfit: round(grossProfit, 2),
    grossLoss: round(grossLoss, 2),
    profitFactor: grossLoss > 0 ? round(grossProfit / grossLoss, 2) : grossProfit > 0 ? null : 0,
    expectancy: round(expectancy, 2),
    avgWin: round(avgWin, 2),
    avgLoss: round(avgLoss, 2),
    payoff: avgLoss > 0 ? round(avgWin / avgLoss, 2) : null,
    bestTrade: closed.length ? round(Math.max(...closed.map((t) => num(t.netProfit))), 2) : 0,
    worstTrade: closed.length ? round(Math.min(...closed.map((t) => num(t.netProfit))), 2) : 0,
    avgR: rs.length ? round(totalR! / rs.length, 2) : null,
    totalR: totalR === null ? null : round(totalR, 2),
    avgHoldMinutes: holds.length ? Math.round(holds.reduce((s, m) => s + m, 0) / holds.length) : null,
    totalVolume: round(trades.reduce((s, t) => s + num(t.volume), 0), 2),
    totalCommission: round(trades.reduce((s, t) => s + num(t.commission), 0), 2),
    totalSwap: round(trades.reduce((s, t) => s + num(t.swap), 0), 2),
    maxDrawdown: round(maxDrawdown, 2),
    maxDrawdownPct: maxDrawdownPct === null ? null : round(maxDrawdownPct, 2),
    maxWinStreak,
    maxLossStreak,
    currentStreak,
    currentStreakType,
    returnPct: initialBalance > 0 ? round((netProfit / initialBalance) * 100, 2) : null,
    planFollowRate: planFollowRate === null ? null : round(planFollowRate, 1),
    openPnl: round(open.reduce((s, t) => s + num(t.netProfit), 0), 2),
  };
}

export function buildEquityCurve(trades: Trade[], initialBalance = 0): EquityPoint[] {
  const closed = closedTradesOf(trades);
  const points: EquityPoint[] = [
    { i: 0, equity: initialBalance, time: closed.length ? closed[0].closeTime ?? closed[0].openTime : new Date().toISOString(), label: "شروع" },
  ];
  let equity = initialBalance;
  closed.forEach((t, idx) => {
    equity += num(t.netProfit);
    points.push({
      i: idx + 1,
      equity: round(equity, 2),
      time: t.closeTime ?? t.openTime,
      label: t.symbol,
    });
  });
  return points;
}

export function dailyStats(trades: Trade[]): DayStat[] {
  const map = new Map<string, DayStat>();
  for (const t of trades) {
    if (t.status !== "closed") continue;
    const d = (t.closeTime ?? t.openTime).slice(0, 10);
    const cur = map.get(d) ?? { date: d, net: 0, trades: 0 };
    cur.net = round(cur.net + num(t.netProfit), 2);
    cur.trades += 1;
    map.set(d, cur);
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function groupBy(trades: Trade[], pick: (t: Trade) => string | null | undefined): GroupStat[] {
  const map = new Map<string, GroupStat & { rSum: number; rCount: number }>();
  for (const t of trades) {
    if (t.status !== "closed") continue;
    const key = (pick(t) ?? "—").toString() || "—";
    const cur =
      map.get(key) ??
      { key, trades: 0, wins: 0, losses: 0, winRate: 0, net: 0, avgR: null, volume: 0, rSum: 0, rCount: 0 };
    cur.trades += 1;
    cur.net = round(cur.net + num(t.netProfit), 2);
    cur.volume = round(cur.volume + num(t.volume), 2);
    if (t.netProfit > 0) cur.wins += 1;
    else if (t.netProfit < 0) cur.losses += 1;
    if (typeof t.rMultiple === "number" && Number.isFinite(t.rMultiple)) {
      cur.rSum += t.rMultiple;
      cur.rCount += 1;
    }
    map.set(key, cur);
  }
  return [...map.values()]
    .map((g) => ({
      key: g.key,
      trades: g.trades,
      wins: g.wins,
      losses: g.losses,
      winRate: g.trades ? round((g.wins / g.trades) * 100, 1) : 0,
      net: g.net,
      avgR: g.rCount ? round(g.rSum / g.rCount, 2) : null,
      volume: g.volume,
    }))
    .sort((a, b) => b.net - a.net);
}

export const WEEKDAYS_FA = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];

/** 0 => شنبه ... 6 => جمعه (JS getDay: 0=Sunday) */
export function faWeekday(date: Date) {
  return (date.getDay() + 1) % 7;
}

export function weekdayOf(t: Trade) {
  const d = new Date(t.closeTime ?? t.openTime);
  return WEEKDAYS_FA[faWeekday(d)];
}

export function hourOf(t: Trade) {
  const d = new Date(t.openTime);
  const h = d.getHours();
  return `${String(h).padStart(2, "0")}:00`;
}

export function sessionOf(t: Trade) {
  const h = new Date(t.openTime).getHours();
  if (t.session) return t.session;
  if (h >= 2 && h < 10) return "سشن لندن";
  if (h >= 10 && h < 19) return "سشن نیویورک";
  if (h >= 19 || h < 2) return "سشن آسیا";
  return "نامشخص";
}

export function detectSession(date: Date) {
  const h = date.getHours();
  if (h >= 2 && h < 10) return "سشن لندن";
  if (h >= 10 && h < 19) return "سشن نیویورک";
  return "سشن آسیا";
}

export function fmtDuration(minutes: number | null) {
  if (minutes === null) return "—";
  if (minutes < 60) return `${Math.round(minutes)} دقیقه`;
  if (minutes < 60 * 24) return `${round(minutes / 60, 1)} ساعت`;
  return `${round(minutes / 1440, 1)} روز`;
}

export function fmtNum(v: number | null | undefined, digits = 2) {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return v.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fmtMoney(v: number | null | undefined, currency = "$") {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  const sign = v > 0 ? "+" : v < 0 ? "-" : "";
  return `${sign}${currency}${Math.abs(v).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function fmtDate(value: string | null | undefined, withTime = true) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  const date = `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())}`;
  return withTime ? `${date} ${p(d.getHours())}:${p(d.getMinutes())}` : date;
}

export function fmtPips(v: number | null | undefined) {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}`;
}
