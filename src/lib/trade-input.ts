import { deriveMetrics, getSymbolMeta, valuePerUnit } from "@/lib/trading";
import type { TradeInsert } from "@/lib/trading";
import { detectSession } from "@/lib/stats";

type Body = Record<string, unknown>;

export function n(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const x = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
  return Number.isFinite(x) ? x : null;
}

export function s(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const str = String(v).trim();
  return str === "" ? null : str;
}

export function d(v: unknown): Date | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return v;
  const asNum = Number(v);
  if (!Number.isNaN(asNum) && /^[0-9]+$/.test(String(v))) {
    return new Date(asNum > 1e12 ? asNum : asNum * 1000);
  }
  const parsed = new Date(String(v));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function tags(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (typeof v === "string" && v.trim()) return v.split(",").map((x) => x.trim()).filter(Boolean);
  return [];
}

/**
 * Builds the column values for a manual trade create/update.
 * Recalculates net profit / pips / R multiple from the raw numbers.
 */
export async function buildTradeValues(body: Body, existing?: Partial<TradeInsert>): Promise<Partial<TradeInsert>> {
  const symbolRaw = s(body.symbol) ?? existing?.symbol ?? "UNKNOWN";
  const symbol = symbolRaw.toUpperCase();
  const meta = await getSymbolMeta(symbol);

  const direction = (s(body.direction) ?? existing?.direction ?? "buy") === "sell" ? "sell" : "buy";
  const volume = n(body.volume) ?? existing?.volume ?? 0;
  const openPrice = body.openPrice !== undefined ? n(body.openPrice) : (existing?.openPrice ?? null);
  const closePrice = body.closePrice !== undefined ? n(body.closePrice) : (existing?.closePrice ?? null);
  const sl = body.sl !== undefined ? n(body.sl) : (existing?.sl ?? null);
  const tp = body.tp !== undefined ? n(body.tp) : (existing?.tp ?? null);
  const openTime = d(body.openTime) ?? existing?.openTime ?? new Date();
  const closeTimeRaw = body.closeTime !== undefined ? d(body.closeTime) : (existing?.closeTime ?? null);
  const closeTime = closeTimeRaw ?? (closePrice !== null ? openTime : null);

  const commission = n(body.commission) ?? existing?.commission ?? 0;
  const swap = n(body.swap) ?? existing?.swap ?? 0;
  const fee = n(body.fee) ?? existing?.fee ?? 0;

  let grossProfit = body.grossProfit !== undefined ? n(body.grossProfit) : (existing?.grossProfit ?? null);
  if (closePrice !== null && openPrice !== null && (grossProfit === null || grossProfit === 0)) {
    const diff = direction === "sell" ? openPrice - closePrice : closePrice - openPrice;
    grossProfit = diff * volume * valuePerUnit(meta);
  }
  grossProfit = Math.round((grossProfit ?? 0) * 100) / 100;

  const status = closePrice !== null && closeTime !== null ? "closed" : "open";

  const derived = deriveMetrics(
    { symbol, direction, openPrice, closePrice, sl, tp, volume, grossProfit, commission, swap, fee, status },
    meta.pipSize,
    valuePerUnit(meta),
  );

  const manualRisk = n(body.riskAmount);
  const riskAmount = manualRisk ?? derived.riskAmount ?? existing?.riskAmount ?? null;
  const rMultiple =
    riskAmount && riskAmount > 0 ? Math.round((derived.netProfit / riskAmount) * 100) / 100 : (existing?.rMultiple ?? null);

  const values: Partial<TradeInsert> = {
    symbol,
    direction,
    volume,
    openPrice,
    closePrice,
    sl,
    tp,
    openTime,
    closeTime,
    commission,
    swap,
    fee,
    grossProfit,
    status,
    closedVolume: status === "closed" ? volume : (existing?.closedVolume ?? 0),
    netProfit: derived.netProfit,
    pips: derived.pips,
    riskAmount,
    rMultiple,
  } as Partial<TradeInsert>;

  const session = s(body.session);
  if (session !== null) values.session = session;
  else if (!existing?.session) values.session = detectSession(openTime);

  const strategy = s(body.strategy);
  if (strategy !== null) values.strategy = strategy;
  const setup = s(body.setup);
  if (setup !== null) values.setup = setup;
  const timeframe = s(body.timeframe);
  if (timeframe !== null) values.timeframe = timeframe;
  const emotion = s(body.emotion);
  if (emotion !== null) values.emotion = emotion;
  const mistake = s(body.mistake);
  if (mistake !== null) values.mistake = mistake;
  const notes = s(body.notes);
  if (notes !== null) values.notes = notes;
  const screenshotUrl = s(body.screenshotUrl);
  if (screenshotUrl !== null) values.screenshotUrl = screenshotUrl;

  if (body.rating !== undefined) values.rating = n(body.rating);
  if (body.followedPlan !== undefined) values.followedPlan = Boolean(body.followedPlan);
  if (body.tags !== undefined) values.tags = tags(body.tags);

  return values;
}
