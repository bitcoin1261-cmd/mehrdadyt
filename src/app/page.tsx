"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardView } from "@/components/DashboardView";
import { TradesTable } from "@/components/TradesTable";
import { TradeForm } from "@/components/TradeForm";
import { CalendarView } from "@/components/CalendarView";
import { Mt5Setup } from "@/components/Mt5Setup";
import { ScreenshotsGallery, useScreenshots } from "@/components/ScreenshotsGallery";
import { Card } from "@/components/ui";
import { computeSummary, fmtMoney, fmtNum, type JournalNote, type Trade } from "@/lib/stats";

type Tab = "dashboard" | "trades" | "gallery" | "calendar" | "mt5";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "dashboard", label: "داشبورد آماری", icon: "📊" },
  { key: "trades", label: "معاملات", icon: "📋" },
  { key: "gallery", label: "تصاویر چارت", icon: "📷" },
  { key: "calendar", label: "تقویم و ژورنال روزانه", icon: "🗓" },
  { key: "mt5", label: "اتصال متاتریدر", icon: "🔌" },
];

export default function Home() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [trades, setTrades] = useState<Trade[]>([]);
  const [notes, setNotes] = useState<JournalNote[]>([]);
  const [initialBalance, setInitialBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Trade | null>(null);
  const [filters, setFilters] = useState({
    symbol: "",
    direction: "",
    source: "",
    status: "",
    strategy: "",
    from: "",
    to: "",
    q: "",
  });
  const [refreshKey, setRefreshKey] = useState(0);
  const { shots, stats: shotStats } = useScreenshots(refreshKey);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tradesRes, notesRes, settingsRes] = await Promise.all([
        fetch("/api/trades"),
        fetch("/api/notes"),
        fetch("/api/settings"),
      ]);
      const tradesJson = (await tradesRes.json()) as { trades: Trade[] };
      const notesJson = (await notesRes.json()) as { notes: JournalNote[] };
      const settingsJson = (await settingsRes.json()) as { account: { initialBalance: number } };
      setTrades(tradesJson.trades ?? []);
      setNotes(notesJson.notes ?? []);
      setInitialBalance(settingsJson.account?.initialBalance ?? 0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const refreshAll = useCallback(() => {
    setRefreshKey((k) => k + 1);
    void load();
  }, [load]);

  const symbols = useMemo(() => [...new Set(trades.map((t) => t.symbol))].sort(), [trades]);
  const strategies = useMemo(() => [...new Set(trades.map((t) => t.strategy).filter(Boolean) as string[])].sort(), [trades]);

  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return trades.filter((t) => {
      if (filters.symbol && t.symbol !== filters.symbol) return false;
      if (filters.direction && t.direction !== filters.direction) return false;
      if (filters.source && t.source !== filters.source) return false;
      if (filters.status && t.status !== filters.status) return false;
      if (filters.strategy && t.strategy !== filters.strategy) return false;
      if (filters.from && t.openTime.slice(0, 10) < filters.from) return false;
      if (filters.to && t.openTime.slice(0, 10) > filters.to) return false;
      if (q) {
        const haystack = [t.symbol, t.strategy, t.setup, t.notes, t.session, t.emotion, ...(t.tags ?? [])]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [trades, filters]);

  const headline = useMemo(() => computeSummary(filtered, initialBalance), [filtered, initialBalance]);

  async function deleteTrade(id: number) {
    await fetch(`/api/trades/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <main className="mx-auto max-w-[1500px] px-3 pb-16 pt-5 sm:px-5">
      <header className="card mb-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 to-indigo-500 text-2xl shadow-lg shadow-sky-500/20">
              📈
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-slate-50 sm:text-xl">ژورنال معاملاتی حرفه‌ای</h1>
              <p className="text-[11px] text-slate-400 sm:text-xs">
                ثبت دستی و خودکار معاملات متاتریدر • تحلیل کامل برد و باخت، ریسک و رفتار معامله‌گری
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="hidden gap-3 sm:flex">
              <div className="soft px-3 py-2 text-center">
                <div className="text-[10px] text-slate-400">سود خالص</div>
                <div className={`text-sm font-bold tabular-nums ${headline.netProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {fmtMoney(headline.netProfit)}
                </div>
              </div>
              <div className="soft px-3 py-2 text-center">
                <div className="text-[10px] text-slate-400">درصد برد</div>
                <div className="text-sm font-bold tabular-nums text-sky-300">{fmtNum(headline.winRate, 1)}٪</div>
              </div>
              <div className="soft px-3 py-2 text-center">
                <div className="text-[10px] text-slate-400">معاملات</div>
                <div className="text-sm font-bold tabular-nums text-slate-100">{headline.totalTrades}</div>
              </div>
              <div className="soft px-3 py-2 text-center">
                <div className="text-[10px] text-slate-400">تصاویر چارت</div>
                <div className="text-sm font-bold tabular-nums text-fuchsia-300">📷 {shots.length}</div>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              + ثبت معامله دستی
            </button>
          </div>
        </div>

        <nav className="mt-4 flex flex-wrap gap-2 border-t border-slate-800/70 pt-4">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`btn ${tab === t.key ? "btn-primary" : "btn-ghost"}`}
            >
              <span>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      {tab !== "mt5" && (
        <section className="card mb-4 p-3 sm:p-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
            <select className="field" value={filters.symbol} onChange={(e) => setFilters({ ...filters, symbol: e.target.value })}>
              <option value="">همه نمادها</option>
              {symbols.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select className="field" value={filters.direction} onChange={(e) => setFilters({ ...filters, direction: e.target.value })}>
              <option value="">خرید و فروش</option>
              <option value="buy">فقط خرید</option>
              <option value="sell">فقط فروش</option>
            </select>
            <select className="field" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
              <option value="">همه وضعیت‌ها</option>
              <option value="closed">بسته‌شده</option>
              <option value="open">باز</option>
            </select>
            <select className="field" value={filters.source} onChange={(e) => setFilters({ ...filters, source: e.target.value })}>
              <option value="">همه منابع</option>
              <option value="mt5">ثبت خودکار متاتریدر</option>
              <option value="manual">ثبت دستی</option>
            </select>
            <select className="field" value={filters.strategy} onChange={(e) => setFilters({ ...filters, strategy: e.target.value })}>
              <option value="">همه استراتژی‌ها</option>
              {strategies.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <input
              type="date"
              className="field tabular-nums"
              value={filters.from}
              onChange={(e) => setFilters({ ...filters, from: e.target.value })}
            />
            <input
              type="date"
              className="field tabular-nums"
              value={filters.to}
              onChange={(e) => setFilters({ ...filters, to: e.target.value })}
            />
            <input
              className="field"
              placeholder="جستجو در یادداشت، تگ، ستاپ..."
              value={filters.q}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            />
          </div>
        </section>
      )}

      {loading ? (
        <div className="card p-12 text-center text-sm text-slate-400">در حال بارگذاری ژورنال…</div>
      ) : tab === "dashboard" ? (
        <DashboardView trades={filtered} initialBalance={initialBalance} />
      ) : tab === "trades" ? (
        <TradesTable
          trades={filtered}
          onEdit={(t) => {
            setEditing(t);
            setFormOpen(true);
          }}
          onDelete={deleteTrade}
        />
      ) : tab === "gallery" ? (
        <div className="space-y-4">
          {shotStats && (
            <Card title="آمار تصاویر ثبت‌شده" subtitle="عکس‌ها توسط اکسپرت، در لحظه باز و بسته شدن معامله گرفته می‌شوند">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <div className="soft p-3 text-center">
                  <div className="text-[11px] text-slate-400">کل تصاویر</div>
                  <div className="text-lg font-bold text-slate-100">{shotStats.total}</div>
                </div>
                <div className="soft p-3 text-center">
                  <div className="text-[11px] text-slate-400">لحظه ورود</div>
                  <div className="text-lg font-bold text-sky-300">{shotStats.openShots}</div>
                </div>
                <div className="soft p-3 text-center">
                  <div className="text-[11px] text-slate-400">لحظه خروج</div>
                  <div className="text-lg font-bold text-emerald-400">{shotStats.closeShots}</div>
                </div>
                <div className="soft p-3 text-center">
                  <div className="text-[11px] text-slate-400">دستی</div>
                  <div className="text-lg font-bold text-slate-100">{shotStats.manual}</div>
                </div>
                <div className="soft p-3 text-center">
                  <div className="text-[11px] text-slate-400">بدون اتصال به معامله</div>
                  <div className="text-lg font-bold text-amber-300">{shotStats.orphans}</div>
                </div>
                <div className="soft p-3 text-center">
                  <div className="text-[11px] text-slate-400">حجم کل</div>
                  <div className="text-lg font-bold text-slate-100">{fmtNum(shotStats.bytes / 1024 / 1024, 2)} MB</div>
                </div>
              </div>
            </Card>
          )}
          <ScreenshotsGallery shots={shots} onRefresh={refreshAll} />
        </div>
      ) : tab === "calendar" ? (
        <CalendarView trades={filtered} notes={notes} onRefresh={refreshAll} />
      ) : (
        <Mt5Setup onRefresh={refreshAll} />
      )}

      <TradeForm open={formOpen} initial={editing} onClose={() => setFormOpen(false)} onSaved={load} />

      <footer className="mt-8 text-center text-[11px] leading-6 text-slate-600">
        ساخته‌شده برای معامله‌گران منضبط • همه محاسبات بر اساس سود خالص (با کسر کارمزد و سوآپ) انجام می‌شود
      </footer>
    </main>
  );
}
