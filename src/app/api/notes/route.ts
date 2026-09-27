import { desc } from "drizzle-orm";
import { db } from "@/db";
import { journalNotes } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db.select().from(journalNotes).orderBy(desc(journalNotes.noteDate)).limit(120);
  return Response.json({ notes: rows });
}

export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const noteDate = String(body.noteDate ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(noteDate)) {
    return Response.json({ error: "تاریخ نامعتبر است" }, { status: 400 });
  }
  const values = {
    noteDate,
    mood: body.mood ? String(body.mood) : null,
    title: body.title ? String(body.title) : null,
    body: body.body ? String(body.body) : null,
    lesson: body.lesson ? String(body.lesson) : null,
    updatedAt: new Date(),
  };
  const [row] = await db
    .insert(journalNotes)
    .values(values)
    .onConflictDoUpdate({ target: journalNotes.noteDate, set: values })
    .returning();
  return Response.json({ note: row }, { status: 201 });
}
