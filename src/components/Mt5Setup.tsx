"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Card, Field, StatRow } from "@/components/ui";

interface Settings {
  token: string;
  baseUrl: string;
  webhookUrl: string;
  lastUsedAt: string | null;
  account: { id: number; name: string; initialBalance: number };
}

function Copy({ text, label = "کپی" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-ghost px-2 py-1 text-[11px]"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          const el = document.createElement("textarea");
          el.value = text;
          document.body.appendChild(el);
          el.select();
          document.execCommand("copy");
          document.body.removeChild(el);
        }
        setDone(true);
        setTimeout(() => setDone(false), 1600);
      }}
    >
      {done ? "کپی شد ✓" : label}
    </button>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre
      dir="ltr"
      className="max-h-80 overflow-auto rounded-xl border border-slate-800 bg-[#070c17] p-4 text-left text-[11px] leading-5 text-slate-300"
    >
      {children}
    </pre>
  );
}

interface ShotStats {
  total: number;
  openShots: number;
  closeShots: number;
  manual: number;
  orphans: number;
  bytes: number;
}

export function Mt5Setup({ onRefresh }: { onRefresh: () => void }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [shotStats, setShotStats] = useState<ShotStats | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [balance, setBalance] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/settings");
    const json = (await res.json()) as Settings;
    setSettings(json);
    setBalance(String(json.account.initialBalance));
    const shotsRes = await fetch("/api/screenshots");
    const shotsJson = (await shotsRes.json()) as { stats: ShotStats };
    setShotStats(shotsJson.stats ?? null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function testConnection() {
    if (!settings) return;
    setBusy("test");
    setTestResult(null);
    try {
      const res = await fetch("/api/mt5", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": settings.token },
        body: JSON.stringify({ mode: "test" }),
      });
      const json = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      setTestResult(res.ok ? "✅ اتصال و توکن سالم است. " + (json.message ?? "") : "❌ " + (json.error ?? "خطا"));
    } catch {
      setTestResult("❌ خطای شبکه");
    } finally {
      setBusy(null);
    }
  }

  async function rotate() {
    if (!confirm("توکن جدید ساخته شود؟ اتصال‌های قبلی متاتریدر کار نخواهند کرد.")) return;
    setBusy("rotate");
    await fetch("/api/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "rotate" }),
    });
    await load();
    setBusy(null);
  }

  async function saveBalance() {
    setBusy("balance");
    await fetch("/api/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "balance", initialBalance: Number(balance) || 0 }),
    });
    setBusy(null);
    onRefresh();
  }

  async function seed() {
    if (!confirm("۶۰ معامله نمونه برای نمایش آمار درج شود؟")) return;
    setBusy("seed");
    await fetch("/api/seed", { method: "POST" });
    setBusy(null);
    onRefresh();
  }

  async function wipe() {
    if (!confirm("همه معاملات و دیل‌های ثبت‌شده حذف شوند؟ این عمل بازگشت‌پذیر نیست.")) return;
    setBusy("wipe");
    await fetch("/api/seed", { method: "DELETE" });
    setBusy(null);
    onRefresh();
  }

  if (!settings) return <Card>در حال بارگذاری تنظیمات…</Card>;

  const eaInputs = `input string InpApiUrl   = "${settings.webhookUrl}";
input string InpApiToken = "${settings.token}";`;

  const curlShot = `curl -X POST ${settings.webhookUrl.replace("/api/mt5", "/api/screenshots")} \\
  -H "x-api-key: ${settings.token}" \\
  -F "kind=close" \\
  -F "positionId=501234500" \\
  -F "dealTicket=501234567" \\
  -F "file=@chart.png"`;

  const sampleJson = `{
  "ticket": 501234567,
  "positionId": 501234500,
  "symbol": "XAUUSD",
  "type": "buy",            // buy | sell
  "entry": "in",            // in = باز شدن | out = بسته شدن | inout
  "volume": 0.20,
  "price": 2365.40,
  "profit": 0,
  "commission": -1.40,
  "swap": 0,
  "time": 1735689600,        // unix seconds
  "sl": 2358.00,
  "tp": 2378.00,
  "digits": 2,
  "contractSize": 100,
  "accountLogin": "1234567",
  "accountName": "My Account",
  "accountServer": "Broker-Demo"
}`;

  return (
    <div className="space-y-4">
      <Card
        title="اتصال خودکار متاتریدر به ژورنال"
        subtitle="با نصب اکسپرت، هر معامله به محض باز شدن و بسته شدن به‌صورت خودکار ثبت می‌شود"
        action={<Badge tone={settings.lastUsedAt ? "good" : "warn"}>{settings.lastUsedAt ? "متصل و فعال" : "هنوز اتصالی ثبت نشده"}</Badge>}
      >
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="soft p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">آدرس وب‌هوک (Webhook URL)</span>
              <Copy text={settings.webhookUrl} />
            </div>
            <code dir="ltr" className="block break-all rounded-lg bg-[#070c17] p-3 text-left text-[11px] text-sky-300">
              {settings.webhookUrl}
            </code>
          </div>
          <div className="soft p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">توکن API</span>
              <Copy text={settings.token} />
            </div>
            <code dir="ltr" className="block break-all rounded-lg bg-[#070c17] p-3 text-left text-[11px] text-emerald-300">
              {settings.token}
            </code>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-primary" onClick={testConnection} disabled={busy === "test"}>
            {busy === "test" ? "در حال بررسی..." : "تست اتصال و توکن"}
          </button>
          <button type="button" className="btn btn-ghost" onClick={rotate} disabled={busy === "rotate"}>
            ساخت توکن جدید
          </button>
          <a className="btn btn-ghost" href="/api/export" target="_blank" rel="noreferrer">
            خروجی CSV
          </a>
          <button type="button" className="btn btn-ghost" onClick={seed} disabled={busy === "seed"}>
            درج ۶۰ معامله نمونه
          </button>
          <button type="button" className="btn btn-danger" onClick={wipe} disabled={busy === "wipe"}>
            پاک کردن همه معاملات
          </button>
        </div>
        {testResult && <p className="mt-3 rounded-lg bg-slate-800/60 p-3 text-xs text-slate-200">{testResult}</p>}
      </Card>

      <Card
        title="اسکرین‌شات خودکار چارت"
        subtitle="هر معامله با دو عکس ثبت می‌شود: یک عکس در لحظه ورود و یک عکس در لحظه خروج"
        action={<Badge tone={shotStats && shotStats.total > 0 ? "good" : "warn"}>{shotStats ? `${shotStats.total} تصویر` : "بدون تصویر"}</Badge>}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="soft p-3 text-center">
            <div className="text-[11px] text-slate-400">عکس‌های ورود</div>
            <div className="text-lg font-bold text-sky-300">{shotStats?.openShots ?? 0}</div>
          </div>
          <div className="soft p-3 text-center">
            <div className="text-[11px] text-slate-400">عکس‌های خروج</div>
            <div className="text-lg font-bold text-emerald-400">{shotStats?.closeShots ?? 0}</div>
          </div>
          <div className="soft p-3 text-center">
            <div className="text-[11px] text-slate-400">آپلود دستی</div>
            <div className="text-lg font-bold text-slate-100">{shotStats?.manual ?? 0}</div>
          </div>
          <div className="soft p-3 text-center">
            <div className="text-[11px] text-slate-400">حجم مصرفی</div>
            <div className="text-lg font-bold text-slate-100">{((shotStats?.bytes ?? 0) / 1024 / 1024).toFixed(2)} MB</div>
          </div>
        </div>
        <ul className="mt-4 space-y-2 text-[11px] leading-6 text-slate-300">
          <li>◆ اکسپرت با <code dir="ltr">ChartScreenShot</code> از چارت همان نماد عکاسی می‌کند (اندازه پیش‌فرض ۱۶۰۰×۹۰۰) و بلافاصله با درخواست <code dir="ltr">multipart/form-data</code> به سرور ارسال می‌کند.</li>
          <li>◆ تصاویر در دیتابیس ذخیره و به‌صورت خودکار به معامله مربوطه متصل می‌شوند: <code dir="ltr">openShotUrl</code> برای ورود و <code dir="ltr">closeShotUrl</code> برای خروج.</li>
          <li>◆ جلوگیری از تکرار بر اساس شماره دیل انجام می‌شود؛ اگر اکسپرت چند بار عکس یک معامله را بفرستد، فقط یک نسخه ذخیره می‌شود.</li>
          <li>◆ برای دیدن گالری کامل به تب «تصاویر چارت» بروید. در تب معاملات هم دکمه‌های «📷 ورود» و «📸 خروج» کنار هر ردیف وجود دارد.</li>
          <li>◆ اگر فایل <code dir="ltr">JournalConnector.mq4</code> را استفاده می‌کنید، عکاسی با <code dir="ltr">WindowScreenShot</code> انجام می‌شود و از چارت فعال تصویر گرفته می‌شود.</li>
        </ul>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="نصب در متاتریدر ۵ (۵ مرحله)">
          <ol className="space-y-3 text-xs leading-6 text-slate-300">
            <li>
              <b className="text-sky-300">۱.</b> فایل{" "}
              <a className="text-sky-400 underline" href="/JournalConnector.mq5" download>
                JournalConnector.mq5
              </a>{" "}
              را دانلود کنید.
            </li>
            <li>
              <b className="text-sky-300">۲.</b> در متاتریدر: <code dir="ltr">File → Open Data Folder → MQL5 → Experts</code> و فایل را
              آنجا کپی کنید، سپس در MetaEditor آن را کامپایل کنید (F7).
            </li>
            <li>
              <b className="text-sky-300">۳.</b> در متاتریدر:{" "}
              <code dir="ltr">Tools → Options → Expert Advisors</code> گزینه{" "}
              <code dir="ltr">Allow WebRequest for listed URL</code> را فعال و آدرس{" "}
              <code dir="ltr" className="text-emerald-300">
                {settings.baseUrl}
              </code>{" "}
              را به لیست اضافه کنید.
            </li>
            <li>
              <b className="text-sky-300">۴.</b> اکسپرت را روی یک چارت بیندازید و در تنظیمات ورودی، دو مقدار زیر را جای‌گذاری کنید:
              <div className="mt-2">
                <Code>{eaInputs}</Code>
              </div>
              <div className="mt-2">
                <Copy text={eaInputs} label="کپی تنظیمات اکسپرت" />
              </div>
            </li>
            <li>
              <b className="text-sky-300">۵.</b> دکمه <b>Algo Trading</b> را روشن کنید. از این لحظه هر معامله‌ای که باز یا بسته شود،
              بلافاصله در ژورنال ظاهر می‌شود.
            </li>
          </ol>
        </Card>

        <Card title="متاتریدر ۴ و نکات مهم">
          <div className="space-y-3 text-xs leading-6 text-slate-300">
            <p>
              برای MT4 فایل{" "}
              <a className="text-sky-400 underline" href="/JournalConnector.mq4" download>
                JournalConnector.mq4
              </a>{" "}
              را در مسیر <code dir="ltr">MQL4 → Experts</code> کپی و کامپایل کنید. این نسخه سفارش‌ها را اسکن می‌کند و باز/بسته شدن را
              ارسال می‌کند.
            </p>
            <p className="rounded-lg bg-amber-500/10 p-3 text-amber-200">
              ⚠️ متاتریدر فقط می‌تواند به آدرس‌های اینترنتی دسترسی داشته باشد. اگر ژورنال روی سیستم شخصی شما اجرا می‌شود، باید آدرس
              را با ابزارهایی مثل Cloudflare Tunnel یا ngrok عمومی کنید و همان آدرس را در لیست WebRequest ثبت کنید.
            </p>
            <p>
              اکسپرت هر ۳۰ ثانیه تاریخچه معاملات را نیز همگام‌سازی می‌کند؛ بنابراین حتی اگر متاتریدر بسته می‌شد یا اینترنت قطع می‌شد،
              هیچ معامله‌ای از دست نمی‌رود (دی‌دوپلیکیت بر اساس شماره دیل انجام می‌شود).
            </p>
            <p className="rounded-lg bg-sky-500/10 p-3 text-sky-200">
              📷 اسکرین‌شات‌ها فقط برای معاملات جدید گرفته می‌شوند (نه همگام‌سازی تاریخچه)، چون چارت در لحظه معامله قدیمی وضعیت امروز
              را نشان می‌دهد. در صورت قطع موقت اینترنت، اکسپرت فایل عکس را نگه می‌دارد و در تلاش بعدی ارسال می‌کند.
            </p>
          </div>
          <div className="mt-4 space-y-1">
            <StatRow label="آخرین اتصال موفق" value={settings.lastUsedAt ? new Date(settings.lastUsedAt).toLocaleString("fa-IR") : "—"} />
            <StatRow label="حساب فعال" value={settings.account.name} />
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="ساختار JSON وب‌هوک" subtitle="اگر می‌خواهید اسکریپت شخصی خودتان را بنویسید">
          <Code>{sampleJson}</Code>
          <p className="mt-3 text-[11px] leading-6 text-slate-400">
            درخواست باید با متد <code dir="ltr">POST</code> و هدر <code dir="ltr">x-api-key: TOKEN</code> به آدرس وب‌هوک ارسال شود.
            ارسال دسته‌ای هم پشتیبانی می‌شود: <code dir="ltr">{`{"deals":[ {...}, {...} ]}`}</code>
          </p>
          <div className="mt-4">
            <p className="mb-2 text-[11px] text-slate-400">نمونه آپلود اسکرین‌شات با curl:</p>
            <Code>{curlShot}</Code>
          </div>
        </Card>

        <Card title="تنظیمات ژورنال">
          <div className="space-y-4">
            <Field label="موجودی اولیه حساب (برای محاسبه بازدهی و افت سرمایه)" hint="واحد دلار">
              <div className="flex gap-2">
                <input className="field tabular-nums" value={balance} onChange={(e) => setBalance(e.target.value)} />
                <button type="button" className="btn btn-primary" onClick={saveBalance} disabled={busy === "balance"}>
                  ذخیره
                </button>
              </div>
            </Field>
            <div className="soft p-4 text-[11px] leading-6 text-slate-400">
              <p className="mb-2 font-semibold text-slate-200">این اعداد به‌صورت خودکار محاسبه می‌شوند:</p>
              <ul className="list-inside list-disc space-y-1">
                <li>سود خالص = سود ناخالص + کارمزد + سوآپ + سایر هزینه‌ها</li>
                <li>تعداد پیپ بر اساس نوع نماد (طلا ۰.۱ / ین ۰.۰۱ / فارکس ۰.۰۰۰۱ / ایندکس ۱)</li>
                <li>نسبت R = سود خالص ÷ فاصله قیمت ورود تا حد ضرر</li>
                <li>درصد برد، پروفیت فاکتور، امید ریاضی، حداکثر افت سرمایه و رشته‌های برد/باخت</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
