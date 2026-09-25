import { NextResponse } from "next/server";
import { ensureBucket, safePath, storage, syncAuthorized } from "@/lib/growthOs/store";

export const dynamic = "force-dynamic";

const ALLOWED = /^(app\/index\.html|state\/(growth-state|manifest)\.json|files\/.+\.(jpg|jpeg|png|webp))$/i;

/**
 * POST {paths: string[]} → URLs firmadas de subida (upsert) para que tools/hq_sync.py suba directo a
 * Supabase Storage sin pasar los archivos por la función (límite de 4,5 MB). Máx. 100 por llamada.
 * Nunca firma rutas de ledger/: las decisiones del Owner solo se escriben desde la interfaz.
 */
export async function POST(req: Request) {
  if (!syncAuthorized(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const paths: unknown = body?.paths;
  if (!Array.isArray(paths) || paths.length === 0 || paths.length > 100) {
    return NextResponse.json({ error: "paths: lista de 1 a 100 rutas" }, { status: 400 });
  }
  await ensureBucket();
  const out: { path: string; signedUrl?: string; error?: string }[] = [];
  for (const raw of paths) {
    const p = typeof raw === "string" ? safePath(raw) : null;
    if (!p || !ALLOWED.test(p)) {
      out.push({ path: String(raw), error: "ruta no permitida" });
      continue;
    }
    const { data, error } = await storage().createSignedUploadUrl(p, { upsert: true });
    out.push(error || !data ? { path: p, error: error?.message ?? "sin URL" } : { path: p, signedUrl: data.signedUrl });
  }
  return NextResponse.json({ uploads: out });
}
