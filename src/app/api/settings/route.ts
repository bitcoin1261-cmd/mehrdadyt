import { db } from "@/db";
import { getActiveToken, rotateToken, ensureDefaultAccount } from "@/lib/trading";
import { accounts } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const key = await getActiveToken();
  const account = await ensureDefaultAccount();
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host;
  const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  return Response.json({
    token: key.token,
    createdAt: key.createdAt,
    lastUsedAt: key.lastUsedAt,
    baseUrl: `${proto}://${host}`,
    webhookUrl: `${proto}://${host}/api/mt5`,
    account: { id: account.id, name: account.name, initialBalance: account.initialBalance },
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  if (body.action === "rotate") {
    const key = await rotateToken();
    return Response.json({ token: key.token });
  }
  if (body.action === "balance" && Number.isFinite(Number(body.initialBalance))) {
    const account = await ensureDefaultAccount();
    const [row] = await db
      .update(accounts)
      .set({ initialBalance: Number(body.initialBalance) })
      .where(eq(accounts.id, account.id))
      .returning();
    return Response.json({ account: row });
  }
  return Response.json({ error: "عملیات نامعتبر" }, { status: 400 });
}
