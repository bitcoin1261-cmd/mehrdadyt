import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, apiKeys, mtDeals, symbols, trades } from "@/db/schema";
import { detectSession } from "@/lib/stats";
import type { Trade } from "@/lib/stats";

export type TradeRow = typeof trades.$inferSelect;
export type TradeInsert = typeof trades.$inferInsert;

/* ------------------------------------------------------------------ */
/* symbol meta helpers                                                 */
/* ------------------------------------------------------------------ */

export function guessPipSize(symbol: string, digits?: number | null) {
  const s = symbol.toUpperCase();
  if (/XAU|GOLD/.test(s)) return 0.1;
  if (/XAG|SILVER/.test(s)) return 0.01;
  if (/BTC|ETH|XRP|DOGE|LTC|SOL|ADA|BNB|LINK|DOT|AVAX/.test(s)) return 1;
  if (/US30|NAS100|NASDAQ|SPX|US500|DAX|GER40|FTSE|NIKKEI|DJ30|USTEC/.test(s)) return 1;
  if (/OIL|WTI|BRENT|NGAS|XBR|XTI/.test(s)) return 0.01;
  if (/JPY/.test(s)) return 0.01;
  if (digits === 2) return 1;
  if (digits === 3) return 0.01;
  return 0.0001;
}

export function guessContractSize(symbol: string) {
  const s = symbol.toUpperCase();
  if (/XAU|GOLD/.test(s)) return 100;
  if (/XAG|SILVER/.test(s)) return 5000;
  if (/BTC|ETH|XRP|DOGE|LTC|SOL|ADA|BNB|LINK|DOT|AVAX/.test(s)) return 1;
  if (/US30|NAS100|NASDAQ|SPX|US500|DAX|GER40|FTSE|NIKKEI|DJ30|USTEC|OIL|WTI|BRENT|NGAS|XBR|XTI/.test(s)) return 1;
  return 100000;
}

/**
 * ضریب تبدیل ارز پایانی (quote) نماد به دلار حساب.
 * مثال: در USDJPY سود بر حسب ین است، پس باید در دلار تبدیل شود (~1/155).
 */
export function guessQuoteRate(symbol: string) {
  const s = symbol.toUpperCase();
  if (/JPY$/.test(s) || /JPY/.test(s)) return 0.0065;
  return 1;
}

export function guessCategory(symbol: string) {
  const s = symbol.toUpperCase();
  if (/XAU|GOLD|XAG|SILVER/.test(s)) return "metals";
  if (/BTC|ETH|XRP|DOGE|LTC|SOL|ADA|BNB|LINK|DOT|AVAX/.test(s)) return "crypto";
  if (/US30|NAS100|NASDAQ|SPX|US500|DAX|GER40|FTSE|NIKKEI|DJ30|USTEC/.test(s)) return "indices";
  if (/OIL|WTI|BRENT|NGAS|XBR|XTI/.test(s)) return "energy";
  return "forex";
}

export async function ensureSymbol(name: string, meta?: { digits?: number | null; contractSize?: number | null }) {
  const symbol = (name || "UNKNOWN").trim().toUpperCase();
  const existing = await db.select().from(symbols).where(eq(symbols.name, symbol)).limit(1);
  if (existing.length) return existing[0];
  const row = {
    name: symbol,
    digits: meta?.digits ?? (/JPY/.test(symbol) ? 3 : 5),
    pipSize: guessPipSize(symbol, meta?.digits ?? null),
    contractSize: meta?.contractSize ?? guessContractSize(symbol),
    quoteRate: guessQuoteRate(symbol),
    category: guessCategory(symbol),
  };
  const inserted = await db.insert(symbols).values(row).onConflictDoNothing().returning();
  if (inserted.length) return inserted[0];
  const again = await db.select().from(symbols).where(eq(symbols.name, symbol)).limit(1);
  return again[0];
}

export async function getSymbolMeta(name: string) {
  const symbol = (name || "UNKNOWN").trim().toUpperCase();
  const rows = await db.select().from(symbols).where(eq(symbols.name, symbol)).limit(1);
  if (rows.length) return rows[0];
  return {
    id: 0,
    name: symbol,
    digits: 5,
    pipSize: guessPipSize(symbol),
    contractSize: guessContractSize(symbol),
    quoteRate: guessQuoteRate(symbol),
    category: guessCategory(symbol),
    createdAt: new Date(),
  };
}

/** ارزش دلاری یک واحد حرکت قیمت برای هر لات */
export function valuePerUnit(meta: { contractSize: number; quoteRate: number }) {
  return meta.contractSize * (meta.quoteRate || 1);
}

/* ------------------------------------------------------------------ */
/* derived metrics                                                     */
/* ------------------------------------------------------------------ */

export function deriveMetrics(
  t: {
    symbol: string;
    direction: string;
    openPrice: number | null;
    closePrice: number | null;
    sl: number | null;
    tp: number | null;
    volume: number;
    grossProfit: number;
    commission: number;
    swap: number;
    fee: number;
    status: string;
  },
  pipSize: number,
  valuePerLot: number,
) {
  const netProfit = (t.grossProfit ?? 0) + (t.commission ?? 0) + (t.swap ?? 0) + (t.fee ?? 0);

  let pips: number | null = null;
  if (t.openPrice && t.closePrice && pipSize > 0) {
    const diff = t.direction === "sell" ? t.openPrice - t.closePrice : t.closePrice - t.openPrice;
    pips = Math.round((diff / pipSize) * 10) / 10;
  }

  let riskAmount: number | null = null;
  if (t.openPrice && t.sl && t.volume > 0) {
    riskAmount = Math.abs(t.openPrice - t.sl) * t.volume * valuePerLot;
  }

  const rMultiple = riskAmount && riskAmount > 0 ? Math.round((netProfit / riskAmount) * 100) / 100 : null;

  return {
    netProfit: Math.round(netProfit * 100) / 100,
    pips,
    riskAmount: riskAmount === null ? null : Math.round(riskAmount * 100) / 100,
    rMultiple,
  };
}

/* ------------------------------------------------------------------ */
/* accounts + api key                                                  */
/* ------------------------------------------------------------------ */

export async function ensureDefaultAccount() {
  const existing = await db.select().from(accounts).orderBy(accounts.id).limit(1);
  if (existing.length) return existing[0];
  const inserted = await db
    .insert(accounts)
    .values({ name: "حساب پیش‌فرض", currency: "USD", initialBalance: 10000, isDefault: true })
    .returning();
  return inserted[0];
}

export async function ensureAccountForLogin(
  login: string | number | null | undefined,
  name?: string | null,
  broker?: string | null,
) {
  if (!login) return ensureDefaultAccount();
  const found = await db.select().from(accounts).where(eq(accounts.login, String(login))).limit(1);
  if (found.length) return found[0];
  const anyAccount = await db.select().from(accounts).orderBy(accounts.id).limit(1);
  if (anyAccount.length && !anyAccount[0].login) {
    const updated = await db
      .update(accounts)
      .set({ login: String(login), name: name ?? anyAccount[0].name, broker: broker ?? anyAccount[0].broker })
      .where(eq(accounts.id, anyAccount[0].id))
      .returning();
    return updated[0];
  }
  const inserted = await db
    .insert(accounts)
    .values({
      name: name ?? `حساب ${login}`,
      login: String(login),
      broker: broker ?? null,
      currency: "USD",
      initialBalance: 0,
      isDefault: anyAccount.length === 0,
    })
    .returning();
  return inserted[0];
}

const TOKEN_PREFIX = "tj_";

export function newToken() {
  const bytes = new Uint8Array(24);
  globalThis.crypto.getRandomValues(bytes);
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return TOKEN_PREFIX + hex;
}

export async function getActiveToken() {
  const rows = await db.select().from(apiKeys).where(eq(apiKeys.isActive, true)).orderBy(apiKeys.id).limit(1);
  if (rows.length) return rows[0];
  const inserted = await db.insert(apiKeys).values({ token: newToken() }).returning();
  return inserted[0];
}

export async function rotateToken() {
  const current = await getActiveToken();
  await db.update(apiKeys).set({ isActive: false }).where(eq(apiKeys.id, current.id));
  const inserted = await db.insert(apiKeys).values({ token: newToken() }).returning();
  return inserted[0];
}

/* ------------------------------------------------------------------ */
/* serialization                                                       */
/* ------------------------------------------------------------------ */

export function serializeTrade(t: TradeRow): Trade {
  return {
    id: t.id,
    accountId: t.accountId,
    externalId: t.externalId,
    source: t.source,
    symbol: t.symbol,
    direction: t.direction === "sell" ? "sell" : "buy",
    volume: t.volume,
    closedVolume: t.closedVolume,
    openTime: (t.openTime instanceof Date ? t.openTime : new Date(t.openTime)).toISOString(),
    closeTime: t.closeTime ? (t.closeTime instanceof Date ? t.closeTime : new Date(t.closeTime)).toISOString() : null,
    openPrice: t.openPrice,
    closePrice: t.closePrice,
    sl: t.sl,
    tp: t.tp,
    commission: t.commission,
    swap: t.swap,
    fee: t.fee,
    grossProfit: t.grossProfit,
    netProfit: t.netProfit,
    pips: t.pips,
    riskAmount: t.riskAmount,
    rMultiple: t.rMultiple,
    status: t.status === "closed" ? "closed" : "open",
    strategy: t.strategy,
    setup: t.setup,
    timeframe: t.timeframe,
    session: t.session,
    emotion: t.emotion,
    rating: t.rating,
    followedPlan: t.followedPlan,
    mistake: t.mistake,
    notes: t.notes,
    tags: Array.isArray(t.tags) ? t.tags : [],
    screenshotUrl: t.screenshotUrl,
    openShotUrl: t.openShotUrl,
    closeShotUrl: t.closeShotUrl,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/* MT5 deal ingestion                                                  */
/* ------------------------------------------------------------------ */

export interface MtDeal {
  ticket: string | number;
  positionId?: string | number | null;
  symbol: string;
  type?: string;
  direction?: string;
  volume?: number;
  price?: number;
  entry?: string;
  profit?: number;
  commission?: number;
  swap?: number;
  fee?: number;
  time?: number | string;
  sl?: number | null;
  tp?: number | null;
  digits?: number | null;
  contractSize?: number | null;
  comment?: string | null;
  magic?: number | null;
  accountLogin?: string | number | null;
  accountName?: string | null;
  accountServer?: string | null;
  balance?: number | null;
}

export interface DealResult {
  ticket: string;
  status: "created" | "updated" | "closed" | "duplicate" | "ignored";
  tradeId?: number;
}

function toDate(value: number | string | undefined, fallback?: Date): Date {
  if (value === undefined || value === null) return fallback ?? new Date();
  if (typeof value === "number") {
    // seconds or milliseconds
    return new Date(value > 1e12 ? value : value * 1000);
  }
  const asNum = Number(value);
  if (!Number.isNaN(asNum) && value !== "" && /^[0-9]+$/.test(value)) {
    return new Date(asNum > 1e12 ? asNum : asNum * 1000);
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? fallback ?? new Date() : d;
}

function normDirection(v: string | undefined) {
  const s = (v ?? "").toLowerCase();
  if (s.includes("sell") || s === "1" || s === "1.0") return "sell";
  return "buy";
}

function normEntry(v: string | undefined) {
  const s = (v ?? "").toLowerCase();
  if (s.includes("inout")) return "inout";
  if (s.includes("out_by")) return "out_by";
  if (s.includes("out")) return "out";
  return "in";
}

export async function applyDeal(deal: MtDeal): Promise<DealResult> {
  const ticket = String(deal.ticket ?? "");
  if (!ticket) return { ticket, status: "ignored" };
  const symbol = (deal.symbol || "UNKNOWN").toUpperCase();
  const positionId = deal.positionId != null && deal.positionId !== "" ? String(deal.positionId) : ticket;
  const entry = normEntry(deal.entry);
  const direction = normDirection(deal.type ?? deal.direction);
  const volume = Number(deal.volume ?? 0) || 0;
  const price = deal.price != null ? Number(deal.price) : null;
  const when = toDate(deal.time);

  const dup = await db.select({ id: mtDeals.id }).from(mtDeals).where(eq(mtDeals.dealTicket, ticket)).limit(1);
  if (dup.length) return { ticket, status: "duplicate" };

  const account = await ensureAccountForLogin(deal.accountLogin, deal.accountName, deal.accountServer);
  const meta = await ensureSymbol(symbol, { digits: deal.digits ?? null, contractSize: deal.contractSize ?? null });

  const existing = await db
    .select()
    .from(trades)
    .where(and(eq(trades.source, "mt5"), eq(trades.externalId, positionId)))
    .limit(1);

  let result: DealResult = { ticket, status: "ignored" };

  const openCommission = Number(deal.commission ?? 0) || 0;
  const openSwap = Number(deal.swap ?? 0) || 0;
  const openFee = Number(deal.fee ?? 0) || 0;

  if (entry === "in" || entry === "inout") {
    if (existing.length) {
      // اضافه شدن به پوزیشن باز (میانگین‌گیری) -> تجمیع حجم و هزینه‌ها
      const cur = existing[0];
      const totalVolume = Math.round(((cur.volume ?? 0) + volume) * 1e8) / 1e8;
      const totalCommission = (cur.commission ?? 0) + openCommission;
      const totalSwap = (cur.swap ?? 0) + openSwap;
      const totalFee = (cur.fee ?? 0) + openFee;
      const meta2 = await getSymbolMeta(symbol);
      const derived = deriveMetrics(
        {
          symbol,
          direction: cur.direction,
          openPrice: cur.openPrice,
          closePrice: cur.closePrice,
          sl: deal.sl ?? cur.sl,
          tp: deal.tp ?? cur.tp,
          volume: totalVolume,
          grossProfit: cur.grossProfit ?? 0,
          commission: totalCommission,
          swap: totalSwap,
          fee: totalFee,
          status: cur.status ?? "open",
        },
        meta2.pipSize,
        valuePerUnit(meta2),
      );
      const [row] = await db
        .update(trades)
        .set({
          volume: totalVolume,
          commission: totalCommission,
          swap: totalSwap,
          fee: totalFee,
          sl: deal.sl ?? cur.sl,
          tp: deal.tp ?? cur.tp,
          status: cur.status,
          updatedAt: new Date(),
          ...derived,
        })
        .where(eq(trades.id, cur.id))
        .returning();
      result = { ticket, status: "updated", tradeId: row.id };
    } else {
      const base = {
        accountId: account.id,
        externalId: positionId,
        source: "mt5",
        symbol,
        direction,
        volume,
        openTime: when,
        openPrice: price,
        sl: deal.sl ?? null,
        tp: deal.tp ?? null,
        session: detectSession(when),
        status: "open",
        closedVolume: 0,
        commission: openCommission,
        swap: openSwap,
        fee: openFee,
        notes: deal.comment ?? null,
        updatedAt: new Date(),
      };
      const [row] = await db.insert(trades).values(base).returning();
      result = { ticket, status: "created", tradeId: row.id };
    }
  } else {
    // closing (or partially closing) deal
    const grossProfit = Number(deal.profit ?? 0) || 0;
    const commission = Number(deal.commission ?? 0) || 0;
    const swap = Number(deal.swap ?? 0) || 0;
    const fee = Number(deal.fee ?? 0) || 0;

    if (existing.length) {
      const cur = existing[0];
      const prevClosed = cur.closedVolume ?? 0;
      const closedVolume = Math.round((prevClosed + volume) * 1e8) / 1e8;
      const totalGross = (cur.grossProfit ?? 0) + grossProfit;
      const totalCommission = (cur.commission ?? 0) + commission;
      const totalSwap = (cur.swap ?? 0) + swap;
      const totalFee = (cur.fee ?? 0) + fee;
      const isClosed = closedVolume >= (cur.volume ?? 0) - 1e-8;
      // میانگین وزنی قیمت خروج (برای محاسبه دقیق پیپ در بسته شدن تدریجی)
      const avgClose =
        price !== null && cur.closePrice !== null && prevClosed > 0
          ? (cur.closePrice * prevClosed + price * volume) / (prevClosed + volume || 1)
          : price !== null
            ? price
            : cur.closePrice;
      const derived = deriveMetrics(
        {
          symbol,
          direction: cur.direction,
          openPrice: cur.openPrice,
          closePrice: avgClose,
          sl: cur.sl,
          tp: cur.tp,
          volume: cur.volume,
          grossProfit: totalGross,
          commission: totalCommission,
          swap: totalSwap,
          fee: totalFee,
          status: isClosed ? "closed" : "open",
        },
        meta.pipSize,
        valuePerUnit(meta),
      );
      const [row] = await db
        .update(trades)
        .set({
          closedVolume,
          grossProfit: totalGross,
          commission: totalCommission,
          swap: totalSwap,
          fee: totalFee,
          closePrice: Math.round((avgClose ?? 0) * 1e8) / 1e8,
          closeTime: when,
          status: isClosed ? "closed" : "open",
          updatedAt: new Date(),
          ...derived,
        })
        .where(eq(trades.id, cur.id))
        .returning();
      result = { ticket, status: isClosed ? "closed" : "updated", tradeId: row.id };
    } else {
      // position was opened before the connector was installed
      const totalCommission = commission;
      const derived = deriveMetrics(
        {
          symbol,
          direction,
          openPrice: price,
          closePrice: price,
          sl: deal.sl ?? null,
          tp: deal.tp ?? null,
          volume,
          grossProfit,
          commission: totalCommission,
          swap,
          fee,
          status: "closed",
        },
        meta.pipSize,
        valuePerUnit(meta),
      );
      const [row] = await db
        .insert(trades)
        .values({
          accountId: account.id,
          externalId: positionId,
          source: "mt5",
          symbol,
          direction,
          volume,
          closedVolume: volume,
          openTime: when,
          closeTime: when,
          openPrice: price,
          closePrice: price,
          sl: deal.sl ?? null,
          tp: deal.tp ?? null,
          grossProfit,
          commission: totalCommission,
          swap,
          fee,
          status: "closed",
          session: detectSession(when),
          notes: deal.comment ?? null,
          updatedAt: new Date(),
          ...derived,
        })
        .returning();
      result = { ticket, status: "closed", tradeId: row.id };
    }
  }

  await db.insert(mtDeals).values({
    dealTicket: ticket,
    positionId,
    accountId: account.id,
    accountLogin: deal.accountLogin != null ? String(deal.accountLogin) : null,
    symbol,
    direction,
    volume,
    price,
    profit: Number(deal.profit ?? 0) || 0,
    entry,
    eventTime: when,
    payload: deal,
  });

  return result;
}
