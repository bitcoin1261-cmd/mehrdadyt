import { eq } from "drizzle-orm";
import { db } from "@/db";
import { trades } from "@/db/schema";
import { serializeTrade, ensureSymbol } from "@/lib/trading";
import { buildTradeValues } from "@/lib/trade-input";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const tradeId = Number(id);
    if (!Number.isFinite(tradeId)) return Response.json({ error: "شناسه نامعتبر" }, { status: 400 });

    const body = (await request.json()) as Record<string, unknown>;
    const existing = await db.select().from(trades).where(eq(trades.id, tradeId)).limit(1);
    if (!existing.length) return Response.json({ error: "معامله یافت نشد" }, { status: 404 });

    if (body.symbol) await ensureSymbol(String(body.symbol));
    const values = await buildTradeValues(body, existing[0]);

    const [row] = await db
      .update(trades)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(trades.id, tradeId))
      .returning();

    return Response.json({ trade: serializeTrade(row) });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "ویرایش معامله ناموفق بود" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const tradeId = Number(id);
    if (!Number.isFinite(tradeId)) return Response.json({ error: "شناسه نامعتبر" }, { status: 400 });
    await db.delete(trades).where(eq(trades.id, tradeId));
    return Response.json({ ok: true });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "حذف معامله ناموفق بود" }, { status: 500 });
  }
}
