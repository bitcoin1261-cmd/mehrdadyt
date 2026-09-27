"use client";

import { useEffect, useMemo, useState } from "react";
import { Field, Modal } from "@/components/ui";
import type { Trade } from "@/lib/stats";

const SESSIONS = ["سشن آسیا", "سشن لندن", "سشن نیویورک", "سشن لندن/نیویورک"];
const TIMEFRAMES = ["M1", "M5", "M15", "M30", "H1", "H4", "D1", "W1"];
const EMOTIONS = ["آرام و منضبط", "اعتماد به نفس بالا", "طمع", "ترس از ضرر", "خستگی", "عجله", "انتقام‌گیری", "بی‌تفاوتی"];
const MISTAKES = [
  "بدون خطا - مطابق پلن",
  "ورود بدون تاییدیه",
  "جابجایی حد ضرر",
  "حجم بیشتر از حد مجاز",
  "خروج زودتر از پلن",
  "معامله خارج از پلن",
  "معامله در زمان خبر",
];

function pipGuess(symbol: string) {
  const s = symbol.toUpperCase();
  if (/XAU|GOLD/.test(s)) return 0.1;
  if (/XAG|SILVER/.test(s)) return 0.01;
  if (/BTC|ETH|XRP|SOL|DOGE|ADA|LTC|BNB|LINK|DOT|AVAX/.test(s)) return 1;
  if (/US30|NAS|SPX|US500|DAX|GER|FTSE|NIKKEI|USTEC|DJ/.test(s)) return 1;
  if (/OIL|WTI|BRENT|NGAS|XBR|XTI/.test(s)) return 0.01;
  if (/JPY/.test(s)) return 0.01;
  return 0.0001;
}

function quoteRateGuess(symbol: string) {
  return /JPY/.test(symbol.toUpperCase()) ? 0.0065 : 1;
}

function contractGuess(symbol: string) {
  const s = symbol.toUpperCase();
  if (/XAU|GOLD/.test(s)) return 100;
  if (/XAG|SILVER/.test(s)) return 5000;
  if (/BTC|ETH|XRP|SOL|DOGE|ADA|LTC|BNB|LINK|DOT|AVAX/.test(s)) return 1;
  if (/US30|NAS|SPX|US500|DAX|GER|FTSE|NIKKEI|USTEC|DJ|OIL|WTI|BRENT|NGAS|XBR|XTI/.test(s)) return 1;
  return 100000;
}

const toInput = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

const fromInput = (v: string) => (v ? new Date(v).toISOString() : null);

interface FormState {
  symbol: string;
  direction: "buy" | "sell";
  volume: string;
  openPrice: string;
  closePrice: string;
  openTime: string;
  closeTime: string;
  sl: string;
  tp: string;
  grossProfit: string;
  commission: string;
  swap: string;
  fee: string;
  riskAmount: string;
  strategy: string;
  setup: string;
  timeframe: string;
  session: string;
  emotion: string;
  rating: string;
  followedPlan: boolean;
  mistake: string;
  tags: string;
  notes: string;
  screenshotUrl: string;
}

const empty: FormState = {
  symbol: "EURUSD",
  direction: "buy",
  volume: "0.1",
  openPrice: "",
  closePrice: "",
  openTime: toInput(new Date().toISOString()),
  closeTime: "",
  sl: "",
  tp: "",
  grossProfit: "",
  commission: "",
  swap: "",
  fee: "",
  riskAmount: "",
  strategy: "",
  setup: "",
  timeframe: "H1",
  session: "",
  emotion: "",
  rating: "3",
  followedPlan: true,
  mistake: "بدون خطا - مطابق پلن",
  tags: "",
  notes: "",
  screenshotUrl: "",
};

function ShotPreview({ label, url }: { label: string; url: string | null }) {
  if (!url) return null;
  return (
    <div className="mt-3">
      <div className="mb-1 text-[11px] text-slate-400">{label}</div>
      <a href={url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-slate-700">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={label} className="h-36 w-full bg-slate-950 object-cover" />
      </a>
    </div>
  );
}

function UploadBox({
  tradeId,
  currentUrl,
  onUploaded,
  onSaved,
}: {
  tradeId?: number;
  currentUrl: string;
  onUploaded: (url: string) => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((j: { token: string }) => setToken(j.token))
      .catch(() => setToken(null));
  }, []);

  async function upload(file: File) {
    if (!tradeId) {
      setMsg("برای پیوست تصویر، ابتدا معامله را ذخیره کنید");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", "manual");
      fd.append("source", "manual");
      fd.append("tradeId", String(tradeId));
      if (token) fd.append("token", token);
      const res = await fetch("/api/screenshots", { method: "POST", body: fd });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error ?? "آپلود ناموفق بود");
      onUploaded(json.url);
      setMsg("تصویر آپلود شد ✓");
      onSaved();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "خطای آپلود");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-dashed border-slate-700 p-3">
      <label className="flex cursor-pointer flex-col items-center gap-1 text-center">
        <span className="text-lg">📤</span>
        <span className="text-[11px] text-slate-300">پیوست تصویر چارت (PNG / JPG)</span>
        <span className="text-[10px] text-slate-500">تصویر در ژورنال ذخیره و به همین معامله متصل می‌شود</span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
        />
      </label>
      {busy && <p className="mt-2 text-center text-[11px] text-sky-300">در حال آپلود…</p>}
      {msg && <p className="mt-2 text-center text-[11px] text-slate-400">{msg}</p>}
      {!busy && currentUrl && msg !== "تصویر آپلود شد ✓" && (
        <p className="mt-2 text-center text-[10px] text-emerald-400">تصویر فعلی ثبت شده است ✓</p>
      )}
    </div>
  );
}

export function TradeForm({
  open,
  initial,
  onClose,
  onSaved,
}: {
  open: boolean;
  initial: Trade | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState<FormState>(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (initial) {
      setF({
        symbol: initial.symbol,
        direction: initial.direction,
        volume: String(initial.volume ?? ""),
        openPrice: initial.openPrice === null ? "" : String(initial.openPrice),
        closePrice: initial.closePrice === null ? "" : String(initial.closePrice),
        openTime: toInput(initial.openTime),
        closeTime: toInput(initial.closeTime),
        sl: initial.sl === null ? "" : String(initial.sl),
        tp: initial.tp === null ? "" : String(initial.tp),
        grossProfit: initial.grossProfit ? String(initial.grossProfit) : "",
        commission: initial.commission ? String(initial.commission) : "",
        swap: initial.swap ? String(initial.swap) : "",
        fee: initial.fee ? String(initial.fee) : "",
        riskAmount: initial.riskAmount === null ? "" : String(initial.riskAmount),
        strategy: initial.strategy ?? "",
        setup: initial.setup ?? "",
        timeframe: initial.timeframe ?? "",
        session: initial.session ?? "",
        emotion: initial.emotion ?? "",
        rating: initial.rating === null ? "3" : String(initial.rating),
        followedPlan: initial.followedPlan ?? true,
        mistake: initial.mistake ?? "",
        tags: (initial.tags ?? []).join(", "),
        notes: initial.notes ?? "",
        screenshotUrl: initial.screenshotUrl ?? "",
      });
    } else {
      setF({ ...empty, openTime: toInput(new Date().toISOString()) });
    }
  }, [open, initial]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setF((prev) => ({ ...prev, [key]: value }));

  const preview = useMemo(() => {
    const op = Number(f.openPrice);
    const cp = Number(f.closePrice);
    const vol = Number(f.volume);
    const pip = pipGuess(f.symbol);
    const contract = contractGuess(f.symbol);
    if (!op || !cp || !vol) return null;
    const diff = f.direction === "sell" ? op - cp : cp - op;
    const valuePerLot = contract * quoteRateGuess(f.symbol);
    const gross = f.grossProfit === "" ? diff * vol * valuePerLot : Number(f.grossProfit);
    const net = gross + Number(f.commission || 0) + Number(f.swap || 0) + Number(f.fee || 0);
    const slv = Number(f.sl);
    const risk = f.riskAmount !== "" ? Number(f.riskAmount) : slv ? Math.abs(op - slv) * vol * valuePerLot : 0;
    return {
      pips: Math.round((diff / pip) * 10) / 10,
      net: Math.round(net * 100) / 100,
      r: risk > 0 ? Math.round((net / risk) * 100) / 100 : null,
    };
  }, [f]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        symbol: f.symbol,
        direction: f.direction,
        volume: f.volume,
        openPrice: f.openPrice,
        closePrice: f.closePrice,
        openTime: fromInput(f.openTime),
        closeTime: fromInput(f.closeTime),
        sl: f.sl,
        tp: f.tp,
        grossProfit: f.grossProfit,
        commission: f.commission,
        swap: f.swap,
        fee: f.fee,
        riskAmount: f.riskAmount,
        strategy: f.strategy,
        setup: f.setup,
        timeframe: f.timeframe,
        session: f.session,
        emotion: f.emotion,
        rating: f.rating,
        followedPlan: f.followedPlan,
        mistake: f.mistake === "بدون خطا - مطابق پلن" ? null : f.mistake,
        tags: f.tags,
        notes: f.notes,
        screenshotUrl: f.screenshotUrl,
      };
      const res = await fetch(initial ? `/api/trades/${initial.id}` : "/api/trades", {
        method: initial ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "خطا در ذخیره‌سازی");
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطای نامشخص");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={initial ? `ویرایش معامله ${initial.symbol}` : "ثبت معامله دستی"} wide>
      <form onSubmit={submit} className="space-y-5">
        <fieldset className="soft p-4">
          <legend className="px-2 text-xs font-semibold text-sky-300">اطلاعات معامله</legend>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="نماد *">
              <input className="field" value={f.symbol} onChange={(e) => set("symbol", e.target.value.toUpperCase())} required />
            </Field>
            <Field label="جهت *">
              <select className="field" value={f.direction} onChange={(e) => set("direction", e.target.value as "buy" | "sell")}>
                <option value="buy">خرید (Buy)</option>
                <option value="sell">فروش (Sell)</option>
              </select>
            </Field>
            <Field label="حجم (لات) *">
              <input className="field tabular-nums" value={f.volume} onChange={(e) => set("volume", e.target.value)} required />
            </Field>
            <Field label="تایم فریم">
              <select className="field" value={f.timeframe} onChange={(e) => set("timeframe", e.target.value)}>
                <option value="">—</option>
                {TIMEFRAMES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="قیمت ورود">
              <input className="field tabular-nums" value={f.openPrice} onChange={(e) => set("openPrice", e.target.value)} />
            </Field>
            <Field label="قیمت خروج" hint="خالی بگذارید = پوزیشن باز">
              <input className="field tabular-nums" value={f.closePrice} onChange={(e) => set("closePrice", e.target.value)} />
            </Field>
            <Field label="زمان ورود *">
              <input
                type="datetime-local"
                className="field tabular-nums"
                value={f.openTime}
                onChange={(e) => set("openTime", e.target.value)}
                required
              />
            </Field>
            <Field label="زمان خروج">
              <input
                type="datetime-local"
                className="field tabular-nums"
                value={f.closeTime}
                onChange={(e) => set("closeTime", e.target.value)}
              />
            </Field>
            <Field label="حد ضرر (SL)">
              <input className="field tabular-nums" value={f.sl} onChange={(e) => set("sl", e.target.value)} />
            </Field>
            <Field label="حد سود (TP)">
              <input className="field tabular-nums" value={f.tp} onChange={(e) => set("tp", e.target.value)} />
            </Field>
            <Field label="سود ناخالص" hint="خالی = محاسبه خودکار از قیمت‌ها">
              <input className="field tabular-nums" value={f.grossProfit} onChange={(e) => set("grossProfit", e.target.value)} />
            </Field>
            <Field label="ریسک (اختیاری)" hint="برای محاسبه دقیق R">
              <input className="field tabular-nums" value={f.riskAmount} onChange={(e) => set("riskAmount", e.target.value)} />
            </Field>
          </div>
        </fieldset>

        <fieldset className="soft p-4">
          <legend className="px-2 text-xs font-semibold text-emerald-300">هزینه‌ها</legend>
          <div className="grid grid-cols-3 gap-3">
            <Field label="کارمزد">
              <input className="field tabular-nums" value={f.commission} onChange={(e) => set("commission", e.target.value)} placeholder="مثلا -7" />
            </Field>
            <Field label="سوآپ">
              <input className="field tabular-nums" value={f.swap} onChange={(e) => set("swap", e.target.value)} />
            </Field>
            <Field label="کارمزد دیگر">
              <input className="field tabular-nums" value={f.fee} onChange={(e) => set("fee", e.target.value)} />
            </Field>
          </div>
        </fieldset>

        <fieldset className="soft p-4">
          <legend className="px-2 text-xs font-semibold text-fuchsia-300">ژورنال و روانشناسی</legend>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="استراتژی">
              <input className="field" value={f.strategy} onChange={(e) => set("strategy", e.target.value)} placeholder="Price Action" />
            </Field>
            <Field label="ستاپ">
              <input className="field" value={f.setup} onChange={(e) => set("setup", e.target.value)} placeholder="شکست ساختاری" />
            </Field>
            <Field label="سشن">
              <select className="field" value={f.session} onChange={(e) => set("session", e.target.value)}>
                <option value="">خودکار</option>
                {SESSIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="حالت روانی">
              <select className="field" value={f.emotion} onChange={(e) => set("emotion", e.target.value)}>
                <option value="">—</option>
                {EMOTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="امتیاز اجرا (۱-۵)">
              <input type="range" min={1} max={5} value={f.rating} onChange={(e) => set("rating", e.target.value)} className="w-full accent-sky-400" />
              <span className="text-[11px] text-slate-400">{f.rating} از ۵</span>
            </Field>
            <Field label="خطای این معامله">
              <select className="field" value={f.mistake} onChange={(e) => set("mistake", e.target.value)}>
                <option value="">—</option>
                {MISTAKES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="تگ‌ها" hint="با کاما جدا کنید">
              <input className="field" value={f.tags} onChange={(e) => set("tags", e.target.value)} placeholder="پلن, تاییدیه" />
            </Field>
            <Field label="لینک تصویر چارت">
              <input className="field" value={f.screenshotUrl} onChange={(e) => set("screenshotUrl", e.target.value)} placeholder="https://..." />
            </Field>
          </div>
        </fieldset>

        <div className="soft p-4">
          <legend className="mb-3 text-xs font-semibold text-amber-300">تصاویر چارت</legend>
          <ShotPreview label="تصویر لحظه ورود (ثبت خودکار اکسپرت)" url={initial?.openShotUrl ?? null} />
          <ShotPreview label="تصویر لحظه خروج (ثبت خودکار اکسپرت)" url={initial?.closeShotUrl ?? null} />
          <UploadBox
            tradeId={initial?.id}
            currentUrl={f.screenshotUrl}
            onUploaded={(url) => set("screenshotUrl", url)}
            onSaved={onSaved}
          />
        </div>

        <fieldset className="soft p-4">
          <legend className="px-2 text-xs font-semibold text-sky-300">یادداشت</legend>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={f.followedPlan}
                onChange={(e) => set("followedPlan", e.target.checked)}
                className="h-4 w-4 accent-emerald-400"
              />
              پلن معاملاتی خود را رعایت کردم
            </label>
          </div>
          <Field label="یادداشت معامله" className="mt-3">
            <textarea
              className="field min-h-24"
              value={f.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="چرا وارد شدم؟ چه چیزی درست/غلط شد؟ چه چیزی یاد گرفتم؟"
            />
          </Field>
        </fieldset>

        {preview && (
          <div className="soft grid grid-cols-3 gap-3 p-4 text-center">
            <div>
              <div className="text-[11px] text-slate-400">سود خالص محاسبه‌شده</div>
              <div className={`text-lg font-bold tabular-nums ${preview.net >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {preview.net}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400">پیپ</div>
              <div className="text-lg font-bold tabular-nums text-slate-200">{preview.pips}</div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400">نسبت R</div>
              <div className="text-lg font-bold tabular-nums text-sky-300">{preview.r === null ? "—" : `${preview.r}R`}</div>
            </div>
          </div>
        )}

        {error && <p className="rounded-lg bg-rose-500/10 p-3 text-xs text-rose-300">{error}</p>}

        <div className="flex items-center justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            انصراف
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "در حال ذخیره..." : initial ? "ذخیره تغییرات" : "ثبت معامله"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
