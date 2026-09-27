import { eq } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { applyDeal, getActiveToken } from "@/lib/trading";
import type { MtDeal } from "@/lib/trading";

export const dynamic = "force-dynamic";

function extractToken(request: Request, body: Record<string, unknown>) {
  const header = request.headers.get("x-api-key");
  if (header) return header.trim();
  const auth = request.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  const url = new URL(request.url);
  const q = url.searchParams.get("token");
  if (q) return q.trim();
  if (typeof body.token === "string" && body.token) return body.token;
  return null;
}

export async function GET() {
  return Response.json({
    ok: true,
    endpoints: {
      method: "POST",
      path: "/api/mt5",
      headers: { "Content-Type": "application/json", "x-api-key": "<TOKEN>" },
    },
  });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "بدنه درخواست باید JSON معتبر باشد" }, { status: 400 });
  }

  const token = extractToken(request, body);
  if (!token) return Response.json({ error: "توکن API ارسال نشده است" }, { status: 401 });

  const key = await getActiveToken();
  if (token !== key.token) {
    return Response.json({ error: "توکن نامعتبر است" }, { status: 401 });
  }

  if (body.mode === "test" || body.test === true) {
    await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, key.id));
    return Response.json({ ok: true, message: "اتصال متاتریدر با موفقیت برقرار شد" });
  }

  const rawDeals = Array.isArray(body.deals)
    ? (body.deals as Record<string, unknown>[])
    : [body as Record<string, unknown>];

  const results = [];
  for (const raw of rawDeals) {
    // tolerate a few alternative key names coming from custom scripts
    const deal: MtDeal = {
      ticket: (raw.ticket ?? raw.deal ?? raw.dealTicket ?? raw.id ?? Date.now()) as MtDeal["ticket"],
      positionId: (raw.positionId ?? raw.position ?? raw.position_ticket) as MtDeal["positionId"],
      symbol: String(raw.symbol ?? raw.instrument ?? "UNKNOWN"),
      type: (raw.type ?? raw.direction ?? raw.side ?? raw.dealType) as MtDeal["type"],
      volume: Number(raw.volume ?? raw.lots ?? raw.size ?? 0) || 0,
      price: raw.price !== undefined ? Number(raw.price) : undefined,
      entry: (raw.entry ?? raw.dealEntry ?? raw.event ?? (raw.status === "closed" ? "out" : "in")) as MtDeal["entry"],
      profit: Number(raw.profit ?? raw.pnl ?? 0) || 0,
      commission: Number(raw.commission ?? 0) || 0,
      swap: Number(raw.swap ?? 0) || 0,
      fee: Number(raw.fee ?? 0) || 0,
      time: (raw.time ?? raw.timestamp ?? raw.openTime ?? raw.closeTime ?? Math.floor(Date.now() / 1000)) as MtDeal["time"],
      sl: raw.sl !== undefined ? Number(raw.sl) : null,
      tp: raw.tp !== undefined ? Number(raw.tp) : null,
      digits: raw.digits !== undefined ? Number(raw.digits) : null,
      contractSize: raw.contractSize !== undefined ? Number(raw.contractSize) : null,
      comment: (raw.comment ?? null) as MtDeal["comment"],
      magic: (raw.magic ?? null) as MtDeal["magic"],
      accountLogin: (raw.accountLogin ?? raw.login ?? raw.account) as MtDeal["accountLogin"],
      accountName: (raw.accountName ?? raw.accountName) as MtDeal["accountName"],
      accountServer: (raw.accountServer ?? raw.server ?? raw.broker) as MtDeal["accountServer"],
    };
    try {
      results.push(await applyDeal(deal));
    } catch (error) {
      console.error("applyDeal failed", error);
      results.push({ ticket: String(deal.ticket), status: "ignored" });
    }
  }

  await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, key.id));

  return Response.json({
    ok: true,
    processed: results.length,
    created: results.filter((r) => r.status === "created").length,
    updated: results.filter((r) => r.status === "updated").length,
    closed: results.filter((r) => r.status === "closed").length,
    duplicates: results.filter((r) => r.status === "duplicate").length,
    results,
  });
}
