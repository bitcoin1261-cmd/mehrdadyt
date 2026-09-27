import { db } from "@/db";
import { getActiveToken } from "@/lib/trading";
import {
  ALLOWED_MIME,
  MAX_SCREENSHOT_BYTES,
  listScreenshots,
  normalizeKind,
  normalizeMime,
  saveScreenshot,
  screenshotStats,
} from "@/lib/screenshots";

export const dynamic = "force-dynamic";

function tokenFrom(request: Request, form: FormData | null) {
  const header = request.headers.get("x-api-key");
  if (header) return header.trim();
  const auth = request.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  const url = new URL(request.url);
  const q = url.searchParams.get("token");
  if (q) return q.trim();
  if (form) {
    const t = form.get("token");
    if (typeof t === "string" && t.trim()) return t.trim();
  }
  return null;
}

export async function GET() {
  const [items, stats] = await Promise.all([listScreenshots(60), screenshotStats()]);
  return Response.json({ screenshots: items, stats });
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "درخواست باید multipart/form-data باشد" }, { status: 400 });
  }

  const token = tokenFrom(request, form);
  if (!token) return Response.json({ error: "توکن API ارسال نشده است" }, { status: 401 });
  const key = await getActiveToken();
  if (token !== key.token) return Response.json({ error: "توکن نامعتبر است" }, { status: 401 });

  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "فایلی با نام file ارسال نشده است" }, { status: 400 });
  }
  if (file.size === 0) return Response.json({ error: "فایل خالی است" }, { status: 400 });
  if (file.size > MAX_SCREENSHOT_BYTES) {
    return Response.json({ error: "حجم فایل بیش از ۸ مگابایت است" }, { status: 413 });
  }

  const mime = normalizeMime(form.get("mimeType"), file.name || "chart.png");
  if (!ALLOWED_MIME.includes(mime)) {
    return Response.json({ error: "فقط تصویر PNG، JPG، WEBP یا GIF پذیرفته می‌شود" }, { status: 415 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const widthRaw = form.get("width");
  const heightRaw = form.get("height");

  try {
    const result = await saveScreenshot({
      buffer,
      positionId: form.get("positionId") ? String(form.get("positionId")) : null,
      dealTicket: form.get("dealTicket") ? String(form.get("dealTicket")) : null,
      kind: normalizeKind(form.get("kind")),
      symbol: form.get("symbol") ? String(form.get("symbol")).toUpperCase() : null,
      filename: file.name || `chart-${Date.now()}.png`,
      mimeType: mime,
      width: widthRaw ? Number(widthRaw) || null : null,
      height: heightRaw ? Number(heightRaw) || null : null,
      source: form.get("source") ? String(form.get("source")) : "mt5",
    });

    return Response.json({
      ok: true,
      id: result.id,
      url: result.url,
      tradeId: result.tradeId,
      duplicate: result.duplicate,
      linked: result.tradeId !== null,
      tradeStatus: result.status,
    });
  } catch (error) {
    console.error("screenshot upload failed", error);
    return Response.json({ error: "ذخیره تصویر ناموفق بود" }, { status: 500 });
  }
}
