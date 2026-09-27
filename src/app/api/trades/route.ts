import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { trades } from "@/db/schema";
import { serializeTrade, ensureDefaultAccount, ensureSymbol } from "@/lib/trading";
import { buildTradeValues } from "@/lib/trade-input";

export const dynamic = "force-dynamic";

export async function GET() {
  const account = await ensureDefaultAccount();
  const rows = await db.select().from(trades).orderBy(desc(trades.openTime));
  return Response.json({ trades: rows.map(serializeTrade), defaultAccountId: account.id });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    if (!body.symbol || !body.direction) {
      return Response.json({ error: "نماد و جهت معامله الزامی است" }, { status: 400 });
    }
    if (!body.openTime) {
      return Response.json({ error: "زمان ورود الزامی است" }, { status: 400 });
    }

    const account = await ensureDefaultAccount();
    await ensureSymbol(String(body.symbol));

    const values = await buildTradeValues(body);
    const accountId = Number(body.accountId) || account.id;

    const [row] = await db
      .insert(trades)
      .values({ ...(values as typeof trades.$inferInsert), accountId, source: "manual" })
      .returning();

    return Response.json({ trade: serializeTrade(row) }, { status: 201 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "ثبت معامله ناموفق بود" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("all") === "true") {
    await db.delete(trades).where(eq(trades.source, "manual"));
    return Response.json({ ok: true });
  }
  return Response.json({ error: "پارامتر نامعتبر" }, { status: 400 });
}
