import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { screenshots, trades } from "@/db/schema";

export const MAX_SCREENSHOT_BYTES = 8 * 1024 * 1024; // 8MB
export const ALLOWED_MIME = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"];

export interface ScreenshotMeta {
  id: number;
  tradeId: number | null;
  positionId: string | null;
  dealTicket: string | null;
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
  /** اطلاعات معامله مرتبط برای نمایش در گالری */
  trade?: {
    id: number;
    symbol: string | null;
    direction: string | null;
    netProfit: number | null;
    status: string | null;
  } | null;
}

function nullableStr(v: unknown) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

export function normalizeKind(v: unknown) {
  const s = (v ?? "open").toString().toLowerCase();
  if (s.startsWith("c") || s.includes("out")) return "close";
  if (s.includes("manual") || s.includes("user")) return "manual";
  return "open";
}

export function normalizeMime(v: unknown, filename: string) {
  const s = (v ?? "").toString().toLowerCase().trim();
  if (ALLOWED_MIME.includes(s)) return s === "image/jpg" ? "image/jpeg" : s;
  const lower = filename.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/png";
}

/**
 * ذخیره تصویر و اتصال آن به معامله مربوطه (بر اساس شناسه پوزیشن متاتریدر)
 */
export async function saveScreenshot(input: {
  buffer: Buffer;
  positionId: string | null;
  dealTicket: string | null;
  kind: string;
  symbol: string | null;
  filename: string;
  mimeType: string;
  width?: number | null;
  height?: number | null;
  source?: string;
  tradeId?: number | null;
}): Promise<{ id: number; url: string; tradeId: number | null; duplicate: boolean; status: string }> {
  const kind = normalizeKind(input.kind);
  const dealTicket = nullableStr(input.dealTicket);

  const dedupeKey = dealTicket ?? `${nullableStr(input.positionId) ?? "na"}:${kind}:${input.filename}`;
  const existing = await db
    .select({ id: screenshots.id, tradeId: screenshots.tradeId })
    .from(screenshots)
    .where(eq(screenshots.dealTicket, dedupeKey))
    .limit(1);

  // پیدا کردن معامله مرتبط
  let tradeId = input.tradeId ?? null;
  let linkedStatus = "orphan";
  const positionId = nullableStr(input.positionId);

  if (!tradeId && positionId) {
    const found = await db
      .select({ id: trades.id, status: trades.status })
      .from(trades)
      .where(and(eq(trades.source, "mt5"), eq(trades.externalId, positionId)))
      .limit(1);
    if (found.length) {
      tradeId = found[0].id;
      linkedStatus = found[0].status;
    }
  } else if (tradeId) {
    const found = await db.select({ status: trades.status }).from(trades).where(eq(trades.id, tradeId)).limit(1);
    linkedStatus = found.length ? found[0].status : "orphan";
  }

  if (existing.length) {
    // به‌روزرسانی لینک در صورت ایجاد معامله بعد از آپلود تصویر
    if (tradeId && existing[0].tradeId !== tradeId) {
      await db.update(screenshots).set({ tradeId }).where(eq(screenshots.id, existing[0].id));
    }
    if (tradeId) await applyToTrade(tradeId, kind, existing[0].id);
    return {
      id: existing[0].id,
      url: `/api/screenshots/${existing[0].id}`,
      tradeId,
      duplicate: true,
      status: linkedStatus,
    };
  }

  const [row] = await db
    .insert(screenshots)
    .values({
      tradeId,
      positionId,
      dealTicket: dedupeKey,
      kind,
      symbol: nullableStr(input.symbol),
      filename: input.filename || `chart-${Date.now()}.png`,
      mimeType: normalizeMime(input.mimeType, input.filename ?? ""),
      sizeBytes: input.buffer.byteLength,
      width: input.width ?? null,
      height: input.height ?? null,
      data: input.buffer,
      source: input.source ?? "mt5",
    })
    .returning({ id: screenshots.id });

  if (tradeId) await applyToTrade(tradeId, kind, row.id);

  return { id: row.id, url: `/api/screenshots/${row.id}`, tradeId, duplicate: false, status: linkedStatus };
}

async function applyToTrade(tradeId: number, kind: string, shotId: number) {
  const url = `/api/screenshots/${shotId}`;
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (kind === "close") {
    patch.closeShotUrl = url;
    patch.screenshotUrl = url;
  } else if (kind === "open") {
    patch.openShotUrl = url;
  } else {
    patch.screenshotUrl = url;
  }
  await db.update(trades).set(patch).where(eq(trades.id, tradeId));
}

export async function listScreenshots(limit = 60) {
  const rows = await db
    .select({
      id: screenshots.id,
      tradeId: screenshots.tradeId,
      positionId: screenshots.positionId,
      dealTicket: screenshots.dealTicket,
      kind: screenshots.kind,
      symbol: screenshots.symbol,
      filename: screenshots.filename,
      mimeType: screenshots.mimeType,
      sizeBytes: screenshots.sizeBytes,
      width: screenshots.width,
      height: screenshots.height,
      source: screenshots.source,
      takenAt: screenshots.takenAt,
      tradeSymbol: trades.symbol,
      tradeDirection: trades.direction,
      tradeNet: trades.netProfit,
      tradeStatus: trades.status,
    })
    .from(screenshots)
    .leftJoin(trades, eq(screenshots.tradeId, trades.id))
    .orderBy(desc(screenshots.takenAt), desc(screenshots.id))
    .limit(limit);

  return rows.map<ScreenshotMeta>((r) => ({
    id: r.id,
    tradeId: r.tradeId,
    positionId: r.positionId,
    dealTicket: r.dealTicket,
    kind: r.kind,
    symbol: r.tradeSymbol ?? r.symbol,
    filename: r.filename,
    mimeType: r.mimeType,
    sizeBytes: r.sizeBytes,
    width: r.width,
    height: r.height,
    source: r.source,
    takenAt: (r.takenAt instanceof Date ? r.takenAt : new Date(r.takenAt)).toISOString(),
    url: `/api/screenshots/${r.id}`,
    trade: r.tradeId
      ? {
          id: r.tradeId,
          symbol: r.tradeSymbol,
          direction: r.tradeDirection,
          netProfit: r.tradeNet,
          status: r.tradeStatus,
        }
      : null,
  }));
}

export async function screenshotStats() {
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      openShots: sql<number>`count(*) filter (where kind = 'open')::int`,
      closeShots: sql<number>`count(*) filter (where kind = 'close')::int`,
      manual: sql<number>`count(*) filter (where kind = 'manual')::int`,
      orphans: sql<number>`count(*) filter (where trade_id is null)::int`,
      bytes: sql<number>`coalesce(sum(size_bytes), 0)::bigint`,
    })
    .from(screenshots);
  return {
    total: Number(row?.total ?? 0),
    openShots: Number(row?.openShots ?? 0),
    closeShots: Number(row?.closeShots ?? 0),
    manual: Number(row?.manual ?? 0),
    orphans: Number(row?.orphans ?? 0),
    bytes: Number(row?.bytes ?? 0),
  };
}

/** معاملاتی که تصویر ندارند (برای هشدار) */
export async function tradesWithoutShots(limit = 20) {
  const rows = await db
    .select({ id: trades.id, symbol: trades.symbol, status: trades.status, externalId: trades.externalId })
    .from(trades)
    .where(and(eq(trades.source, "mt5"), isNull(trades.closeShotUrl), eq(trades.status, "closed")))
    .orderBy(desc(trades.closeTime))
    .limit(limit);
  return rows;
}
