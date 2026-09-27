import { promises as fsPromises } from "node:fs";
import { join } from "node:path";
import { db } from "@/db";
import { screenshots, trades } from "@/db/schema";

const { readFile } = fsPromises;
import { asc, desc, eq } from "drizzle-orm";
import { ensureDefaultAccount, ensureSymbol, deriveMetrics, getSymbolMeta, valuePerUnit } from "@/lib/trading";
import { saveScreenshot } from "@/lib/screenshots";
import { detectSession } from "@/lib/stats";

export const dynamic = "force-dynamic";

const SETUPS = [
  { strategy: "Price Action", setup: "شکست ساختاری", timeframe: "M15" },
  { strategy: "Supply & Demand", setup: "بازگشت به منطقه", timeframe: "H1" },
  { strategy: "Trend Following", setup: "پولبک میانگین", timeframe: "H4" },
  { strategy: "Breakout", setup: "شکست سطح روزانه", timeframe: "M30" },
  { strategy: "Reversal", setup: "واگرایی RSI", timeframe: "H1" },
];
const EMOTIONS = ["آرام و منضبط", "خستگی", "طمع", "ترس از ضرر", "اعتماد به نفس بالا", "بی‌تفاوتی"];
const MISTAKES = [null, null, null, "جابجایی حد ضرر", "ورود زودتر از زمان", "حجم بیشتر از حد مجاز", "خروج زودتر از_plan"];

function pick<T>(arr: T[], i: number) {
  return arr[i % arr.length];
}

export async function POST() {
  const account = await ensureDefaultAccount();

  const symbolsList = ["EURUSD", "GBPUSD", "XAUUSD", "USDJPY", "BTCUSD"];
  for (const s of symbolsList) await ensureSymbol(s);

  // تصویر نمونه چارت برای نمایش گالری اسکرین‌شات‌های خودکار
  const demoShotPath = join(process.cwd(), "public", "demo-chart.png");
  let demoShot: Buffer | null = null;
  try {
    demoShot = await readFile(demoShotPath);
  } catch {
    demoShot = null;
  }

  const rows: (typeof trades.$inferInsert)[] = [];
  const now = Date.now();

  for (let i = 0; i < 60; i += 1) {
    const symbol = pick(symbolsList, i * 7 + 1);
    const meta = await getSymbolMeta(symbol);
    const direction = i % 3 === 0 ? "sell" : "buy";
    const volume = [0.1, 0.2, 0.3, 0.5, 1][i % 5];
    const openPrice =
      symbol === "XAUUSD" ? 2320 + (i % 12) * 4 : symbol === "BTCUSD" ? 62000 + (i % 9) * 350 : symbol === "USDJPY" ? 155.2 + (i % 7) * 0.4 : 1.08 + (i % 11) * 0.005;
    const win = (i * 13) % 10 < 6; // ~60% win rate
    const rMultipleTarget = win ? [1, 1.5, 2, 2.5, 3][(i * 3) % 5] : -1;
    const movePips = win ? 20 + ((i * 7) % 40) : -(12 + ((i * 5) % 18));
    const closePrice = openPrice + (direction === "sell" ? -1 : 1) * movePips * meta.pipSize;
    const sl = openPrice - (direction === "sell" ? -1 : 1) * 25 * meta.pipSize;
    const tp = openPrice + (direction === "sell" ? -1 : 1) * 60 * meta.pipSize;

    const grossProfit = (closePrice - openPrice) * (direction === "sell" ? -1 : 1) * volume * valuePerUnit(meta);
    const commission = -(volume * 7);
    const swap = i % 4 === 0 ? -1.2 : 0;

    const openTime = new Date(now - (60 - i) * 7.5 * 3600 * 1000);
    const holdMinutes = 20 + ((i * 17) % 400);
    const closeTime = new Date(openTime.getTime() + holdMinutes * 60000);
    const setup = pick(SETUPS, i);

    const derived = deriveMetrics(
      {
        symbol,
        direction,
        openPrice,
        closePrice,
        sl,
        tp,
        volume,
        grossProfit,
        commission,
        swap,
        fee: 0,
        status: "closed",
      },
      meta.pipSize,
      valuePerUnit(meta),
    );

    rows.push({
      accountId: account.id,
      source: i % 4 === 0 ? "mt5" : "manual",
      externalId: `demo-${i}`,
      symbol,
      direction,
      volume,
      closedVolume: volume,
      openTime,
      closeTime,
      openPrice,
      closePrice,
      sl,
      tp,
      commission,
      swap,
      fee: 0,
      grossProfit,
      status: "closed",
      strategy: setup.strategy,
      setup: setup.setup,
      timeframe: setup.timeframe,
      session: detectSession(openTime),
      emotion: pick(EMOTIONS, i),
      rating: (i % 5) + 1,
      followedPlan: i % 7 !== 0,
      mistake: pick(MISTAKES, i),
      notes: win ? "ستاپ مطابق پلن اجرا شد." : "ورود قبل از تاییدیه، ضرر قابل پیشگیری.",
      tags: win ? ["پلن", "تاییدیه"] : ["بدون تاییدیه", "شتاب‌زده"],
      ...derived,
    });
    void rMultipleTarget;
  }

  await db.insert(trades).values(rows).onConflictDoNothing();

  // one open position
  const metaGold = await getSymbolMeta("XAUUSD");
  const openPrice = 2365.4;
  const sl = 2360;
  const derived = deriveMetrics(
    { symbol: "XAUUSD", direction: "buy", openPrice, closePrice: null, sl, tp: 2378, volume: 0.2, grossProfit: 0, commission: -1.4, swap: 0, fee: 0, status: "open" },
    metaGold.pipSize,
    valuePerUnit(metaGold),
  );
  await db.insert(trades).values({
    accountId: account.id,
    source: "mt5",
    externalId: "demo-open-1",
    symbol: "XAUUSD",
    direction: "buy",
    volume: 0.2,
    closedVolume: 0,
    openTime: new Date(now - 3 * 3600 * 1000),
    openPrice,
    sl,
    tp: 2378,
    commission: -1.4,
    status: "open",
    strategy: "Price Action",
    setup: "شکست ساختاری",
    timeframe: "M15",
      session: "سشن نیویورک",
      ...derived,
    })
    .onConflictDoNothing();

  // اتصال تصویر نمونه چارت به آخرین معاملات متاتریدر (شبیه‌سازی اسکرین‌شات خودکار)
  if (demoShot) {
    const mt5Trades = await db
      .select({ id: trades.id, symbol: trades.symbol, externalId: trades.externalId, status: trades.status })
      .from(trades)
      .where(eq(trades.source, "mt5"))
      .orderBy(desc(trades.closeTime))
      .limit(6);

    for (const t of mt5Trades) {
      for (const kind of ["open", "close"] as const) {
        if (kind === "close" && t.status !== "closed") continue;
        await saveScreenshot({
          buffer: demoShot,
          positionId: t.externalId,
          dealTicket: `demo-${t.externalId}-${kind}`,
          kind,
          symbol: t.symbol,
          filename: `${kind}_${t.symbol}_${t.externalId}.png`,
          mimeType: "image/png",
          width: 1600,
          height: 900,
          source: "demo",
          tradeId: t.id,
        });
      }
    }
  }

  return Response.json({ ok: true, inserted: rows.length + 1 });
}

export async function DELETE() {
  await db.delete(screenshots);
  await db.delete(trades);
  return Response.json({ ok: true });
}
