"use client";

import { useMemo, useState } from "react";
import { Badge, Card, Empty } from "@/components/ui";
import { fmtDate, fmtMoney, fmtNum, fmtPips, type Trade } from "@/lib/stats";

type SortKey = "openTime" | "closeTime" | "netProfit" | "rMultiple" | "pips" | "symbol";

export function TradesTable({
  trades,
  onEdit,
  onDelete,
}: {
  trades: Trade[];
  onEdit: (t: Trade) => void;
  onDelete: (id: number) => void;
}) {
  const [sort, setSort] = useState<SortKey>("openTime");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    const val = (t: Trade) => {
      switch (sort) {
        case "netProfit":
          return t.netProfit;
        case "rMultiple":
          return t.rMultiple ?? -999;
        case "pips":
          return t.pips ?? -9999;
        case "symbol":
          return t.symbol.localeCompare("") === 0 ? 0 : 0;
        case "closeTime":
          return new Date(t.closeTime ?? 0).getTime();
        default:
          return new Date(t.openTime).getTime();
      }
    };
    const copy = [...trades];
    copy.sort((a, b) => (dir === "asc" ? 1 : -1) * ((val(a) as number) - (val(b) as number)));
    if (sort === "symbol") copy.sort((a, b) => (dir === "asc" ? 1 : -1) * a.symbol.localeCompare(b.symbol));
    return copy;
  }, [trades, sort, dir]);

  const head = (key: SortKey, label: string) => (
    <th
      className="cursor-pointer select-none hover:text-sky-300"
      onClick={() => {
        if (sort === key) setDir(dir === "asc" ? "desc" : "asc");
        else {
          setSort(key);
          setDir("desc");
        }
      }}
    >
      {label} {sort === key ? (dir === "asc" ? "▲" : "▼") : ""}
    </th>
  );

  return (
    <Card
      title={`فهرست معاملات (${trades.length})`}
      subtitle="روی هر ردیف کلیک کنید تا جزئیات و یادداشت‌های معامله را ویرایش کنید"
    >
      {sorted.length === 0 ? (
        <Empty text="معامله‌ای با این فیلترها پیدا نشد" icon="🔍" />
      ) : (
        <div className="max-h-[70vh] overflow-auto">
          <table className="jrnl w-full">
            <thead className="sticky top-0 z-10">
              <tr>
                {head("symbol", "نماد")}
                <th>جهت</th>
                <th>حجم</th>
                {head("openTime", "ورود")}
                {head("closeTime", "خروج")}
                <th>قیمت ورود</th>
                <th>قیمت خروج</th>
                <th>SL / TP</th>
                {head("pips", "پیپ")}
                {head("rMultiple", "R")}
                <th>کارمزد</th>
                {head("netProfit", "سود خالص")}
                <th>استراتژی</th>
                <th>سشن</th>
                <th>تصاویر چارت</th>
                <th>منبع</th>
                <th>وضعیت</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sorted.map((t) => (
                <tr
                  key={t.id}
                  className="cursor-pointer transition-colors hover:bg-slate-800/40"
                  onClick={() => onEdit(t)}
                >
                  <td className="font-semibold text-slate-100">{t.symbol}</td>
                  <td>
                    <Badge tone={t.direction === "buy" ? "info" : "warn"}>{t.direction === "buy" ? "خرید" : "فروش"}</Badge>
                  </td>
                  <td className="tabular-nums text-slate-300">{fmtNum(t.volume, 2)}</td>
                  <td className="text-slate-400">{fmtDate(t.openTime)}</td>
                  <td className="text-slate-400">{fmtDate(t.closeTime)}</td>
                  <td className="tabular-nums text-slate-300">{t.openPrice === null ? "—" : fmtNum(t.openPrice, 5)}</td>
                  <td className="tabular-nums text-slate-300">{t.closePrice === null ? "—" : fmtNum(t.closePrice, 5)}</td>
                  <td className="tabular-nums text-[11px] text-slate-500">
                    {t.sl === null ? "—" : fmtNum(t.sl, 3)} / {t.tp === null ? "—" : fmtNum(t.tp, 3)}
                  </td>
                  <td className={`tabular-nums ${(t.pips ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{fmtPips(t.pips)}</td>
                  <td className="tabular-nums text-slate-300">{t.rMultiple === null ? "—" : `${fmtNum(t.rMultiple, 2)}R`}</td>
                  <td className="tabular-nums text-slate-500">{fmtNum(t.commission + t.swap + t.fee, 2)}</td>
                  <td className={`tabular-nums font-bold ${(t.netProfit ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {fmtMoney(t.netProfit)}
                  </td>
                  <td className="text-slate-300">{t.strategy ?? "—"}</td>
                  <td className="text-slate-400">{t.session ?? "—"}</td>
                  <td>
                    <div className="flex items-center gap-1">
                      {t.openShotUrl ? (
                        <a
                          href={t.openShotUrl}
                          target="_blank"
                          rel="noreferrer"
                          title="اسکرین‌شات لحظه ورود"
                          onClick={(e) => e.stopPropagation()}
                          className="btn btn-ghost px-2 py-0.5 text-[10px]"
                        >
                          📷 ورود
                        </a>
                      ) : null}
                      {t.closeShotUrl || t.screenshotUrl ? (
                        <a
                          href={t.closeShotUrl ?? t.screenshotUrl!}
                          target="_blank"
                          rel="noreferrer"
                          title="اسکرین‌شات لحظه خروج"
                          onClick={(e) => e.stopPropagation()}
                          className="btn btn-ghost px-2 py-0.5 text-[10px]"
                        >
                          📸 خروج
                        </a>
                      ) : (
                        <span className="text-[10px] text-slate-600">—</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <Badge tone={t.source === "mt5" ? "good" : "neutral"}>{t.source === "mt5" ? "متاتریدر" : "دستی"}</Badge>
                  </td>
                  <td>{t.status === "open" ? <Badge tone="warn">باز</Badge> : <Badge tone="neutral">بسته</Badge>}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-danger px-2 py-1 text-[11px]"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`معامله ${t.symbol} حذف شود؟`)) onDelete(t.id);
                      }}
                    >
                      حذف
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
