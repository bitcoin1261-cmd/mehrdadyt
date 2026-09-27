import { desc } from "drizzle-orm";
import { db } from "@/db";
import { trades } from "@/db/schema";

export const dynamic = "force-dynamic";

const cols = [
  "id",
  "symbol",
  "direction",
  "volume",
  "openTime",
  "closeTime",
  "openPrice",
  "closePrice",
  "sl",
  "tp",
  "commission",
  "swap",
  "grossProfit",
  "netProfit",
  "pips",
  "rMultiple",
  "status",
  "source",
  "strategy",
  "setup",
  "timeframe",
  "session",
  "emotion",
  "rating",
  "followedPlan",
  "mistake",
  "tags",
  "notes",
];

function cell(value: unknown) {
  if (value === null || value === undefined) return "";
  const str = value instanceof Date ? value.toISOString() : String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export async function GET() {
  const rows = await db.select().from(trades).orderBy(desc(trades.openTime));
  const lines = [cols.join(",")];
  for (const r of rows) {
    const record: Record<string, unknown> = { ...r, tags: Array.isArray(r.tags) ? r.tags.join("|") : "" };
    lines.push(cols.map((c) => cell(record[c])).join(","));
  }
  return new Response("\uFEFF" + lines.join("\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="trading-journal-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
