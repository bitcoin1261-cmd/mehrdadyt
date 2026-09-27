import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts } from "@/db/schema";
import { ensureDefaultAccount } from "@/lib/trading";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureDefaultAccount();
  const rows = await db.select().from(accounts).orderBy(asc(accounts.id));
  return Response.json({ accounts: rows });
}

export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const name = String(body.name ?? "").trim();
  if (!name) return Response.json({ error: "نام حساب الزامی است" }, { status: 400 });
  const [row] = await db
    .insert(accounts)
    .values({
      name,
      broker: body.broker ? String(body.broker) : null,
      login: body.login ? String(body.login) : null,
      currency: String(body.currency ?? "USD"),
      initialBalance: Number(body.initialBalance) || 0,
    })
    .returning();
  return Response.json({ account: row }, { status: 201 });
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const id = Number(body.id);
  if (!Number.isFinite(id)) return Response.json({ error: "شناسه نامعتبر" }, { status: 400 });
  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) patch.name = String(body.name);
  if (body.broker !== undefined) patch.broker = body.broker ? String(body.broker) : null;
  if (body.login !== undefined) patch.login = body.login ? String(body.login) : null;
  if (body.currency !== undefined) patch.currency = String(body.currency);
  if (body.initialBalance !== undefined) patch.initialBalance = Number(body.initialBalance) || 0;
  const [row] = await db.update(accounts).set(patch).where(eq(accounts.id, id)).returning();
  return Response.json({ account: row });
}
