"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, Card, Empty, Field, StatRow } from "@/components/ui";
import {
  closedTradesOf,
  computeSummary,
  fmtDate,
  fmtMoney,
  fmtNum,
  fmtPips,
  WEEKDAYS_FA,
  faWeekday,
  type JournalNote,
  type Trade,
} from "@/lib/stats";

const MONTHS_FA = [
  "ژانویه",
  "فوریه",
  "مارس",
  "آپریل",
  "مه",
  "ژوئن",
  "جولای",
  "اوت",
  "سپتامبر",
  "اکتبر",
  "نوامبر",
  "دسامبر",
];

const MOODS = ["😀 عالی", "🙂 خوب", "😐 معمولی", "😕 بد", "😫 افتضاح"];

export function CalendarView({
  trades,
  notes,
  onRefresh,
}: {
  trades: Trade[];
  notes: JournalNote[];
  onRefresh: () => void;
}) {
  const today = new Date();
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [selected, setSelected] = useState<string>(() => {
    const p = (n: number) => String(n).padStart(2, "0");
    return `${today.getFullYear()}-${p(today.getMonth() + 1)}-${p(today.getDate())}`;
  });
  const [noteForm, setNoteForm] = useState({ mood: "", title: "", body: "", lesson: "" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const byDay = useMemo(() => {
    const map = new Map<string, { net: number; trades: Trade[] }>();
    for (const t of trades) {
      if (t.status !== "closed") continue;
      const key = (t.closeTime ?? t.openTime).slice(0, 10);
      const cur = map.get(key) ?? { net: 0, trades: [] };
      cur.net += t.netProfit;
      cur.trades.push(t);
      map.set(key, cur);
    }
    return map;
  }, [trades]);

  const monthTrades = useMemo(
    () =>
      trades.filter((t) => {
        const key = (t.closeTime ?? t.openTime).slice(0, 7);
        return key === `${cursor.y}-${String(cursor.m + 1).padStart(2, "0")}`;
      }),
    [trades, cursor],
  );

  const monthSummary = useMemo(() => computeSummary(monthTrades), [monthTrades]);

  const cells = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1);
    const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
    const offset = faWeekday(first);
    const arr: (string | null)[] = Array.from({ length: offset }, () => null);
    for (let d = 1; d <= daysInMonth; d += 1) {
      arr.push(`${cursor.y}-${String(cursor.m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    }
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [cursor]);

  const selectedNote = notes.find((n) => n.noteDate === selected);
  const selectedTrades = byDay.get(selected)?.trades ?? [];

  useEffect(() => {
    setNoteForm({
      mood: selectedNote?.mood ?? "",
      title: selectedNote?.title ?? "",
      body: selectedNote?.body ?? "",
      lesson: selectedNote?.lesson ?? "",
    });
    setSaved(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, selectedNote?.id]);

  const maxAbs = Math.max(...[...byDay.values()].map((v) => Math.abs(v.net)), 1);

  async function saveNote() {
    setSaving(true);
    try {
      await fetch("/api/notes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ noteDate: selected, ...noteForm }),
      });
      setSaved(true);
      onRefresh();
    } finally {
      setSaving(false);
    }
  }

  const move = (delta: number) => {
    const d = new Date(cursor.y, cursor.m + delta, 1);
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
  };

  return (
    <div className="space-y-4">
      <Card
        title={`تقویم معاملاتی — ${MONTHS_FA[cursor.m]} ${cursor.y}`}
        subtitle="سود و ضرر خالص هر روز، بر اساس زمان بسته شدن معامله"
        action={
          <div className="flex items-center gap-2">
            <button type="button" className="btn btn-ghost px-3 py-1" onClick={() => move(-1)}>
              ماه قبل ›
            </button>
            <button
              type="button"
              className="btn btn-ghost px-3 py-1"
              onClick={() => setCursor({ y: today.getFullYear(), m: today.getMonth() })}
            >
              امروز
            </button>
            <button type="button" className="btn btn-ghost px-3 py-1" onClick={() => move(1)}>
              ‹ ماه بعد
            </button>
          </div>
        }
      >
        <div className="mb-4 grid grid-cols-3 gap-3 text-center">
          <div className="soft p-3">
            <div className="text-[11px] text-slate-400">سود / ضرر این ماه</div>
            <div className={`text-lg font-bold tabular-nums ${monthSummary.netProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {fmtMoney(monthSummary.netProfit)}
            </div>
          </div>
          <div className="soft p-3">
            <div className="text-[11px] text-slate-400">تعداد معاملات</div>
            <div className="text-lg font-bold tabular-nums text-slate-100">{monthSummary.totalTrades}</div>
          </div>
          <div className="soft p-3">
            <div className="text-[11px] text-slate-400">درصد برد ماه</div>
            <div className="text-lg font-bold tabular-nums text-sky-300">{fmtNum(monthSummary.winRate, 0)}٪</div>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-slate-400">
          {WEEKDAYS_FA.map((w) => (
            <div key={w} className="py-1">
              {w}
            </div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((key, i) => {
            if (!key) return <div key={`e${i}`} className="aspect-square rounded-lg bg-slate-900/30" />;
            const day = byDay.get(key);
            const net = day?.net ?? 0;
            const intensity = day ? Math.min(0.75, 0.18 + Math.abs(net) / maxAbs * 0.6) : 0;
            const isSel = key === selected;
            return (
              <button
                type="button"
                key={key}
                onClick={() => setSelected(key)}
                className={`relative flex aspect-square flex-col items-center justify-center rounded-lg border p-1 text-center transition-all ${
                  isSel ? "border-sky-400 ring-2 ring-sky-400/40" : "border-slate-800 hover:border-slate-600"
                }`}
                style={{
                  background: day
                    ? net >= 0
                      ? `rgba(16,185,129,${intensity})`
                      : `rgba(244,63,94,${intensity})`
                    : "rgba(15,22,39,0.6)",
                }}
              >
                <span className="text-xs font-semibold text-slate-200">{Number(key.slice(8))}</span>
                {day && (
                  <>
                    <span className={`text-[10px] font-bold tabular-nums ${net >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                      {Math.round(net)}
                    </span>
                    <span className="text-[9px] text-slate-400">{day.trades.length} معامله</span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={`معاملات ${selected}`} subtitle={`${selectedTrades.length} معامله بسته‌شده در این روز`}>
          {selectedTrades.length === 0 ? (
            <Empty text="در این روز معامله‌ای بسته نشده است" icon="🗓" />
          ) : (
            <table className="jrnl w-full">
              <thead>
                <tr>
                  <th>نماد</th>
                  <th>جهت</th>
                  <th>حجم</th>
                  <th>پیپ</th>
                  <th>سود/ضرر</th>
                </tr>
              </thead>
              <tbody>
                {closedTradesOf(selectedTrades).map((t) => (
                  <tr key={t.id}>
                    <td className="font-semibold text-slate-200">{t.symbol}</td>
                    <td>
                      <Badge tone={t.direction === "buy" ? "info" : "warn"}>{t.direction === "buy" ? "خرید" : "فروش"}</Badge>
                    </td>
                    <td className="tabular-nums text-slate-300">{fmtNum(t.volume, 2)}</td>
                    <td className="tabular-nums text-slate-300">{fmtPips(t.pips)}</td>
                    <td className={`tabular-nums font-bold ${t.netProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {fmtMoney(t.netProfit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="یادداشت روزانه ژورنال" subtitle="روانشناسی، درس‌ها و برنامه فردا را همین‌جا بنویسید">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="حالت روز">
                <select className="field" value={noteForm.mood} onChange={(e) => setNoteForm({ ...noteForm, mood: e.target.value })}>
                  <option value="">—</option>
                  {MOODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="عنوان">
                <input className="field" value={noteForm.title} onChange={(e) => setNoteForm({ ...noteForm, title: e.target.value })} placeholder="مرور روز" />
              </Field>
            </div>
            <Field label="شرح روز معاملاتی">
              <textarea className="field min-h-24" value={noteForm.body} onChange={(e) => setNoteForm({ ...noteForm, body: e.target.value })} />
            </Field>
            <Field label="درس امروز / اقدام اصلاحی">
              <textarea className="field min-h-16" value={noteForm.lesson} onChange={(e) => setNoteForm({ ...noteForm, lesson: e.target.value })} />
            </Field>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-emerald-400">{saved ? "ذخیره شد ✓" : ""}</span>
              <button type="button" className="btn btn-primary" onClick={saveNote} disabled={saving}>
                {saving ? "در حال ذخیره..." : "ذخیره یادداشت"}
              </button>
            </div>
          </div>
        </Card>
      </div>

      <Card title="یادداشت‌های اخیر">
        {notes.length === 0 ? (
          <Empty text="هنوز یادداشتی ثبت نشده است" icon="📝" />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {notes.slice(0, 6).map((n) => (
              <div key={n.id} className="soft p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-sky-300">{fmtDate(`${n.noteDate}T00:00:00`, false)}</span>
                  {n.mood && <Badge tone="info">{n.mood}</Badge>}
                </div>
                {n.title && <div className="mt-2 text-sm font-semibold text-slate-200">{n.title}</div>}
                {n.body && <p className="mt-1 text-xs leading-6 text-slate-400">{n.body}</p>}
                {n.lesson && (
                  <div className="mt-2 rounded-lg bg-amber-500/10 p-2 text-[11px] leading-5 text-amber-200">💡 {n.lesson}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="خلاصه کلی دوره">
        <div className="grid gap-x-8 sm:grid-cols-2">
          <StatRow label="مجموع معاملات ثبت‌شده" value={trades.length} />
          <StatRow label="معاملات باز" value={trades.filter((t) => t.status === "open").length} />
          <StatRow label="سود خالص" value={fmtMoney(computeSummary(trades).netProfit)} tone="text-emerald-400" />
          <StatRow label="میانگین سود هر معامله" value={fmtMoney(computeSummary(trades).expectancy)} />
        </div>
      </Card>
    </div>
  );
}
