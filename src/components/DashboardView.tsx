"use client";

import { useMemo } from "react";
import { Card, Kpi, StatRow, Badge, ProgressBar, Empty } from "@/components/ui";
import { EquityChart, PnlBars, Donut, RHistogram } from "@/components/charts";
import {
  buildEquityCurve,
  closedTradesOf,
  computeSummary,
  dailyStats,
  fmtDuration,
  fmtMoney,
  fmtNum,
  fmtPips,
  groupBy,
  hourOf,
  sessionOf,
  weekdayOf,
  type Trade,
} from "@/lib/stats";

function GroupTable({ title, rows, valueKey }: { title: string; rows: { key: string; trades: number; winRate: number; net: number; avgR: number | null }[]; valueKey?: string }) {
  return (
    <Card title={title}>
      {rows.length === 0 ? (
        <Empty text="داده‌ای نیست" icon="🗂" />
      ) : (
        <div className="overflow-x-auto">
          <table className="jrnl w-full">
            <thead>
              <tr>
                <th>{valueKey ?? "دسته"}</th>
                <th>تعداد</th>
                <th>درصد برد</th>
                <th>سود/ضرر</th>
                <th>میانگین R</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 8).map((r) => (
                <tr key={r.key}>
                  <td className="font-medium text-slate-200">{r.key}</td>
                  <td className="tabular-nums text-slate-300">{r.trades}</td>
                  <td className="w-28">
                    <div className="flex items-center gap-2">
                      <span className="w-10 tabular-nums text-slate-300">{fmtNum(r.winRate, 0)}%</span>
                      <div className="flex-1">
                        <ProgressBar value={r.winRate} tone={r.winRate >= 50 ? "emerald" : "rose"} />
                      </div>
                    </div>
                  </td>
                  <td className={`tabular-nums font-semibold ${r.net >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {fmtMoney(r.net)}
                  </td>
                  <td className="tabular-nums text-slate-300">{r.avgR === null ? "—" : fmtNum(r.avgR, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export function DashboardView({ trades, initialBalance }: { trades: Trade[]; initialBalance: number }) {
  const summary = useMemo(() => computeSummary(trades, initialBalance), [trades, initialBalance]);
  const equity = useMemo(() => buildEquityCurve(trades, initialBalance), [trades, initialBalance]);
  const closed = useMemo(() => closedTradesOf(trades), [trades]);
  const daily = useMemo(() => dailyStats(trades), [trades]);

  const bySymbol = useMemo(() => groupBy(trades, (t) => t.symbol), [trades]);
  const byStrategy = useMemo(() => groupBy(trades, (t) => t.strategy), [trades]);
  const bySession = useMemo(() => groupBy(trades, (t) => sessionOf(t)), [trades]);
  const byWeekday = useMemo(() => groupBy(trades, (t) => weekdayOf(t)), [trades]);
  const byEmotion = useMemo(() => groupBy(trades, (t) => t.emotion), [trades]);
  const byMistake = useMemo(() => groupBy(trades.filter((t) => t.mistake), (t) => t.mistake), [trades]);

  const rValues = closed.map((t) => t.rMultiple).filter((r): r is number => typeof r === "number");
  const dailyBars = daily.slice(-30).map((d) => ({ label: d.date.slice(5), net: d.net }));

  const green = daily.filter((d) => d.net > 0).length;
  const red = daily.filter((d) => d.net < 0).length;

  const insights = useMemo(() => {
    const out: string[] = [];
    if (byWeekday.length > 1) {
      const best = [...byWeekday].sort((a, b) => b.net - a.net)[0];
      const worst = [...byWeekday].sort((a, b) => a.net - b.net)[0];
      out.push(`بهترین روز هفته شما ${best.key} با ${fmtMoney(best.net)} و ضعیف‌ترین روز ${worst.key} با ${fmtMoney(worst.net)} است.`);
    }
    if (bySession.length > 1) {
      const best = [...bySession].sort((a, b) => b.net - a.net)[0];
      out.push(`بیشترین سود در ${best.key} ساخته می‌شود (${fmtMoney(best.net)} از ${best.trades} معامله).`);
    }
    if (bySymbol.length) {
      const bestSym = [...bySymbol].sort((a, b) => b.net - a.net)[0];
      out.push(`نماد برتر شما ${bestSym.key} است؛ درصد برد ${fmtNum(bestSym.winRate, 0)}٪ در ${bestSym.trades} معامله.`);
    }
    if (summary.planFollowRate !== null) {
      out.push(
        summary.planFollowRate >= 70
          ? `در ${fmtNum(summary.planFollowRate, 0)}٪ معاملات پلن خود را رعایت کرده‌اید؛ ادامه دهید.`
          : `فقط در ${fmtNum(summary.planFollowRate, 0)}٪ معاملات پلن رعایت شده؛ این مهم‌ترین نقطه بهبود شماست.`,
      );
    }
    if (summary.profitFactor !== null) {
      out.push(
        summary.profitFactor >= 1.5
          ? `پروفیت فاکتور ${fmtNum(summary.profitFactor, 2)} است که در محدوده سالم قرار دارد.`
          : `پروفیت فاکتور ${fmtNum(summary.profitFactor, 2)} پایین‌تر از حد مطلوب (۱.۵) است.`,
      );
    }
    if (byMistake.length) {
      const top = [...byMistake].sort((a, b) => b.trades - a.trades)[0];
      out.push(`تکرارشده‌ترین خطا: «${top.key}» در ${top.trades} معامله.`);
    }
    return out;
  }, [byWeekday, bySession, bySymbol, byMistake, summary]);

  if (!trades.length) {
    return (
      <Card>
        <Empty text="هنوز معامله‌ای ثبت نشده است. از تب «ثبت معامله» معامله دستی وارد کنید یا اکسپرت متاتریدر را نصب کنید." icon="🧭" />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        <Kpi
          label="سود / ضرر خالص"
          value={fmtMoney(summary.netProfit)}
          tone={summary.netProfit >= 0 ? "good" : "bad"}
          hint={summary.returnPct !== null ? `بازدهی ${fmtNum(summary.returnPct, 1)}٪ از سرمایه اولیه` : undefined}
          icon="💰"
        />
        <Kpi
          label="درصد برد (Win Rate)"
          value={`${fmtNum(summary.winRate, 1)}٪`}
          tone={summary.winRate >= 50 ? "good" : summary.winRate > 0 ? "bad" : "neutral"}
          hint={`${summary.wins} برنده / ${summary.losses} بازنده`}
          icon="🎯"
        />
        <Kpi label="تعداد معاملات" value={summary.totalTrades} hint={`${summary.closedTrades} بسته‌شده • ${summary.openTrades} باز`} icon="📊" />
        <Kpi
          label="پروفیت فاکتور"
          value={summary.profitFactor === null ? "∞" : fmtNum(summary.profitFactor, 2)}
          tone={summary.profitFactor !== null && summary.profitFactor >= 1.5 ? "good" : "bad"}
          hint={`سود کل ${fmtNum(summary.grossProfit, 0)} / ضرر کل ${fmtNum(summary.grossLoss, 0)}`}
          icon="⚖️"
        />
        <Kpi
          label="امید ریاضی هر معامله"
          value={fmtMoney(summary.expectancy)}
          tone={summary.expectancy >= 0 ? "good" : "bad"}
          hint={`میانگین برد ${fmtNum(summary.avgWin, 1)} • میانگین باخت ${fmtNum(summary.avgLoss, 1)}`}
          icon="🧮"
        />
        <Kpi
          label="حداکثر افت سرمایه"
          value={fmtMoney(-summary.maxDrawdown)}
          tone="bad"
          hint={summary.maxDrawdownPct !== null ? `${fmtNum(summary.maxDrawdownPct, 1)}٪ از سقف سرمایه` : undefined}
          icon="📉"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        <Kpi label="میانگین R" value={summary.avgR === null ? "—" : `${fmtNum(summary.avgR, 2)}R`} tone={(summary.avgR ?? 0) >= 0 ? "good" : "bad"} hint={`مجموع ${summary.totalR === null ? "—" : `${fmtNum(summary.totalR, 1)}R`}`} icon="📐" />
        <Kpi label="نسبت برد به باخت" value={summary.payoff === null ? "—" : fmtNum(summary.payoff, 2)} icon="🔁" />
        <Kpi label="بهترین معامله" value={fmtMoney(summary.bestTrade)} tone="good" icon="🏆" />
        <Kpi label="بدترین معامله" value={fmtMoney(summary.worstTrade)} tone="bad" icon="🥶" />
        <Kpi
          label="بیشترین رشته برد / باخت"
          value={`${summary.maxWinStreak} / ${summary.maxLossStreak}`}
          hint={
            summary.currentStreakType === "none"
              ? "—"
              : `رشته فعلی: ${summary.currentStreak} ${summary.currentStreakType === "win" ? "برد" : "باخت"}`
          }
          icon="🔗"
        />
        <Kpi label="میانگین زمان نگهداری" value={fmtDuration(summary.avgHoldMinutes)} icon="⏱" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="منحنی رشد سرمایه (Equity Curve)" subtitle="بر اساس سود/ضرر خالص معاملات بسته‌شده">
          <EquityChart points={equity} />
        </Card>

        <Card title="ترکیب برد و باخت">
          <Donut wins={summary.wins} losses={summary.losses} be={summary.breakEven} centerLabel="درصد برد" centerValue={`${fmtNum(summary.winRate, 0)}٪`} />
          <div className="mt-4 space-y-1">
            <StatRow label="روزهای سبز" value={green} tone="text-emerald-400" />
            <StatRow label="روزهای قرمز" value={red} tone="text-rose-400" />
            <StatRow label="کارمزد و سوآپ پرداختی" value={fmtNum(summary.totalCommission + summary.totalSwap, 2)} />
            <StatRow label="حجم کل معاملات" value={fmtNum(summary.totalVolume, 2)} />
            <StatRow label="سود/ضرر پوزیشن‌های باز" value={fmtMoney(summary.openPnl)} tone={summary.openPnl >= 0 ? "text-emerald-400" : "text-rose-400"} />
            <StatRow label="رعایت پلن معاملاتی" value={summary.planFollowRate === null ? "—" : `${fmtNum(summary.planFollowRate, 0)}٪`} />
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="سود و ضرر روزانه" subtitle="۳۰ روز کاری آخر">
          <PnlBars data={dailyBars} />
        </Card>
        <Card title="توزیع نسبت سود به ریسک (R)" subtitle="هر معامله چند برابر ریسک خود سود یا ضرر داده است">
          {rValues.length ? <RHistogram values={rValues} /> : <Empty text="برای محاسبه R، حد ضرر معاملات را ثبت کنید" icon="📐" />}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <GroupTable title="عملکرد بر اساس نماد" rows={bySymbol} valueKey="نماد" />
        <GroupTable title="عملکرد بر اساس استراتژی" rows={byStrategy} valueKey="استراتژی" />
        <GroupTable title="عملکرد بر اساس سشن بازار" rows={bySession} valueKey="سشن" />
        <GroupTable title="عملکرد بر اساس روز هفته" rows={byWeekday} valueKey="روز" />
        <GroupTable title="عملکرد بر اساس حالت روانی" rows={byEmotion} valueKey="حالت" />
        <GroupTable title="خطاهای تکرارشونده" rows={byMistake} valueKey="خطا" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="تحلیل خودکار ژورنال" subtitle="این نتیجه‌گیری‌ها از داده‌های خودتان استخراج شده است">
          <ul className="space-y-3">
            {insights.map((t, i) => (
              <li key={i} className="flex gap-2 text-xs leading-6 text-slate-300">
                <span className="text-sky-400">◆</span>
                <span>{t}</span>
              </li>
            ))}
            {!insights.length && <p className="text-xs text-slate-500">داده کافی برای تحلیل وجود ندارد.</p>}
          </ul>
        </Card>

        <Card title="آخرین معاملات">
          <div className="overflow-x-auto">
            <table className="jrnl w-full">
              <thead>
                <tr>
                  <th>نماد</th>
                  <th>جهت</th>
                  <th>حجم</th>
                  <th>پیپ</th>
                  <th>R</th>
                  <th>سود/ضرر</th>
                  <th>وضعیت</th>
                </tr>
              </thead>
              <tbody>
                {trades.slice(0, 8).map((t) => (
                  <tr key={t.id}>
                    <td className="font-semibold text-slate-200">{t.symbol}</td>
                    <td>
                      <Badge tone={t.direction === "buy" ? "info" : "warn"}>{t.direction === "buy" ? "خرید" : "فروش"}</Badge>
                    </td>
                    <td className="tabular-nums text-slate-300">{fmtNum(t.volume, 2)}</td>
                    <td className="tabular-nums text-slate-300">{fmtPips(t.pips)}</td>
                    <td className="tabular-nums text-slate-300">{t.rMultiple === null ? "—" : `${fmtNum(t.rMultiple, 2)}R`}</td>
                    <td className={`tabular-nums font-semibold ${t.netProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {fmtMoney(t.netProfit)}
                    </td>
                    <td>
                      {t.status === "open" ? <Badge tone="warn">باز</Badge> : <Badge tone="neutral">بسته</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {trades.some((t) => t.openShotUrl || t.closeShotUrl || t.screenshotUrl) && (
        <Card
          title="اسکرین‌شات‌های خودکار چارت"
          subtitle="تصویر چارت در لحظه باز و بسته شدن معاملات (ثبت خودکار توسط اکسپرت متاتریدر)"
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {trades
              .filter((t) => t.closeShotUrl || t.openShotUrl || t.screenshotUrl)
              .slice(0, 8)
              .flatMap((t) => {
                const items: { url: string; kind: string }[] = [];
                if (t.closeShotUrl) items.push({ url: t.closeShotUrl, kind: "close" });
                else if (t.screenshotUrl) items.push({ url: t.screenshotUrl, kind: "manual" });
                if (t.openShotUrl) items.push({ url: t.openShotUrl, kind: "open" });
                return items.map((it) => ({ trade: t, ...it }));
              })
              .slice(0, 8)
              .map((it) => (
                <a
                  key={`${it.trade.id}-${it.kind}`}
                  href={it.url}
                  target="_blank"
                  rel="noreferrer"
                  className="card group overflow-hidden p-0"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={it.url} alt={`چارت ${it.trade.symbol}`} loading="lazy" className="h-36 w-full bg-slate-950 object-cover" />
                  <div className="flex items-center justify-between p-2 text-[11px]">
                    <span className="font-bold text-slate-200">{it.trade.symbol}</span>
                    <span className={it.trade.netProfit >= 0 ? "text-emerald-400" : "text-rose-400"}>
                      {fmtMoney(it.trade.netProfit)}
                    </span>
                    <Badge tone={it.kind === "open" ? "info" : it.kind === "close" ? "good" : "neutral"}>
                      {it.kind === "open" ? "ورود" : it.kind === "close" ? "خروج" : "دستی"}
                    </Badge>
                  </div>
                </a>
              ))}
          </div>
        </Card>
      )}

      <Card title="عملکرد بر اساس ساعت ورود">
        {(() => {
          const byHour = groupBy(trades, (t) => hourOf(t));
          if (!byHour.length) return <Empty text="داده‌ای نیست" icon="🕐" />;
          const max = Math.max(...byHour.map((h) => Math.abs(h.net)), 1);
          return (
            <div className="flex items-end gap-1 overflow-x-auto pb-1">
              {byHour.map((h) => (
                <div key={h.key} className="flex w-10 shrink-0 flex-col items-center gap-1">
                  <span className="text-[10px] tabular-nums text-slate-400">{fmtNum(h.net, 0)}</span>
                  <div className="flex h-24 w-full items-end">
                    <div
                      className={`w-full rounded-t ${h.net >= 0 ? "bg-emerald-500/70" : "bg-rose-500/70"}`}
                      style={{ height: `${(Math.abs(h.net) / max) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-500">{h.key}</span>
                  <span className="text-[9px] text-slate-600">{h.trades}t</span>
                </div>
              ))}
            </div>
          );
        })()}
      </Card>
    </div>
  );
}
