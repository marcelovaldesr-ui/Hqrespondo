import { NextResponse } from "next/server";
import { readJson, syncAuthorized } from "@/lib/growthOs/store";

export const dynamic = "force-dynamic";

/** GET — {ruta: sha1} de lo ya subido. Solo tools/hq_sync.py (header x-growth-os-token). */
export async function GET(req: Request) {
  if (!syncAuthorized(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const manifest = (await readJson<Record<string, string>>("state/manifest.json")) ?? {};
  return NextResponse.json({ manifest }, { headers: { "Cache-Control": "no-store" } });
}
