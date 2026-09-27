"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Card, Empty } from "@/components/ui";
import { fmtDate, fmtMoney, fmtNum } from "@/lib/stats";

export interface ShotMeta {
  id: number;
  tradeId: number | null;
  positionId: string | null;
  kind: string;
  symbol: string | null;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  source: string;
  takenAt: string;
  url: string;
  trade?: { id: number; symbol: string | null; direction: string | null; netProfit: number | null; status: string | null } | null;
}

interface Stats {
  total: number;
  openShots: number;
  closeShots: number;
  manual: number;
  orphans: number;
  bytes: number;
}

const kindLabel = (k: string) => (k === "open" ? "لحظه ورود" : k === "close" ? "لحظه خروج" : "دستی");

export function ScreenshotsGallery({ shots, onRefresh }: { shots: ShotMeta[]; onRefresh: () => void }) {
  const [preview, setPreview] = useState<ShotMeta | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  async function remove(id: number) {
    if (!confirm("این تصویر حذف شود؟")) return;
    setBusy(id);
    await fetch(`/api/screenshots/${id}`, { method: "DELETE" });
    setBusy(null);
    setPreview(null);
    onRefresh();
  }

  if (!shots.length) {
    return (
      <Card title="اسکرین‌شات‌های چارت">
        <Empty
          text="هنوز تصویری ثبت نشده است. با نصب اکسپرت، هنگام باز و بسته شدن هر معامله یک عکس از چارت به‌صورت خودکار اینجا ذخیره می‌شود."
          icon="📷"
        />
      </Card>
    );
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {shots.map((s) => {
          const win = (s.trade?.netProfit ?? 0) >= 0;
          return (
            <div key={s.id} className="card overflow-hidden p-0">
              <button type="button" onClick={() => setPreview(s)} className="block w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={s.url}
                  alt={`چارت ${s.symbol ?? ""} - ${kindLabel(s.kind)}`}
                  loading="lazy"
                  className="h-40 w-full bg-slate-950 object-cover"
                />
              </button>
              <div className="space-y-2 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-slate-100">{s.symbol ?? "—"}</span>
                  <Badge tone={s.kind === "open" ? "info" : s.kind === "close" ? "good" : "neutral"}>
                    {kindLabel(s.kind)}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>{fmtDate(s.takenAt, false)}</span>
                  {s.trade && (
                    <span className={`font-bold tabular-nums ${win ? "text-emerald-400" : "text-rose-400"}`}>
                      {fmtMoney(s.trade.netProfit)}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-500">
                  <span>
                    {s.width ? `${s.width}×${s.height}` : `${fmtNum(s.sizeBytes / 1024, 0)} KB`}
                    {s.source !== "mt5" ? ` • ${s.source}` : ""}
                  </span>
                  <div className="flex gap-1">
                    <a className="btn btn-ghost px-2 py-0.5 text-[10px]" href={s.url} target="_blank" rel="noreferrer">
                      بزرگ
                    </a>
                    <button
                      type="button"
                      className="btn btn-danger px-2 py-0.5 text-[10px]"
                      onClick={() => remove(s.id)}
                      disabled={busy === s.id}
                    >
                      حذف
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {preview && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/85 p-4" onClick={() => setPreview(null)}>
          <div className="flex items-center gap-3 text-xs text-slate-200" onClick={(e) => e.stopPropagation()}>
            <Badge tone={preview.kind === "open" ? "info" : "good"}>{kindLabel(preview.kind)}</Badge>
            <span className="font-bold">{preview.symbol}</span>
            <span>{fmtDate(preview.takenAt)}</span>
            {preview.positionId && <span className="text-slate-500">پوزیشن #{preview.positionId}</span>}
            <button type="button" className="btn btn-ghost px-3 py-1" onClick={() => setPreview(null)}>
              بستن ✕
            </button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview.url} alt="اسکرین‌شات چارت" className="max-h-[82vh] max-w-full rounded-xl border border-slate-700 object-contain" />
        </div>
      )}
    </>
  );
}

export function useScreenshots(refreshKey: number) {
  const [shots, setShots] = useState<ShotMeta[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/screenshots");
    const json = (await res.json()) as { screenshots: ShotMeta[]; stats: Stats };
    setShots(json.screenshots ?? []);
    setStats(json.stats ?? null);
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  return { shots, stats };
}
