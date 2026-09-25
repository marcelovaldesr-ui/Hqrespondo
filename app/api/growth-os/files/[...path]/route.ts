import { NextResponse } from "next/server";
import { safePath, storage } from "@/lib/growthOs/store";

export const dynamic = "force-dynamic";

/**
 * GET /api/growth-os/files/<ruta> — imágenes del Growth OS (bucket privado).
 * Redirige a una URL firmada de 1 hora. Los PNG de renders se guardan como vista JPG
 * (misma ruta, extensión .jpg) para que carguen rápido en el celular.
 */
export async function GET(_req: Request, { params }: { params: { path: string[] } }) {
  const rel = safePath(params.path.map(decodeURIComponent).join("/"));
  if (!rel) return NextResponse.json({ error: "ruta inválida" }, { status: 400 });
  const key = "files/" + rel.replace(/\.png$/i, ".jpg");
  const { data, error } = await storage().createSignedUrl(key, 3600);
  if (error || !data?.signedUrl) return NextResponse.json({ error: "no encontrado" }, { status: 404 });
  return NextResponse.redirect(data.signedUrl, { status: 302, headers: { "Cache-Control": "private, max-age=3000" } });
}
