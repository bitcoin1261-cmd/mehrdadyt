import { eq } from "drizzle-orm";
import { db } from "@/db";
import { screenshots } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const shotId = Number(id.replace(/[^0-9]/g, ""));
  if (!Number.isFinite(shotId) || shotId <= 0) {
    return new Response("invalid id", { status: 400 });
  }

  const rows = await db
    .select({ data: screenshots.data, mimeType: screenshots.mimeType, filename: screenshots.filename })
    .from(screenshots)
    .where(eq(screenshots.id, shotId))
    .limit(1);

  if (!rows.length) return new Response("not found", { status: 404 });

  const buf = rows[0].data;
  return new Response(new Uint8Array(buf), {
    headers: {
      "content-type": rows[0].mimeType || "image/png",
      "content-length": String(buf.byteLength),
      "cache-control": "public, max-age=31536000, immutable",
      "content-disposition": `inline; filename="${rows[0].filename.replace(/"/g, "")}"`,
    },
  });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const shotId = Number(id.replace(/[^0-9]/g, ""));
  if (!Number.isFinite(shotId) || shotId <= 0) {
    return Response.json({ error: "شناسه نامعتبر" }, { status: 400 });
  }
  await db.delete(screenshots).where(eq(screenshots.id, shotId));
  return Response.json({ ok: true });
}
