import { storage } from "@/lib/growthOs/store";

export const dynamic = "force-dynamic";

/**
 * GET /api/growth-os/app — la interfaz del Growth OS (HTML autocontenido). Se guarda en el bucket y la
 * actualiza tools/hq_sync.py, así los cambios de interfaz llegan sin redeploy del HQ.
 */
export async function GET() {
  const { data, error } = await storage().download("app/index.html");
  if (error || !data) {
    return new Response(
      "<!doctype html><meta charset=utf-8><body style=\"font:15px system-ui;padding:24px;color:#384456\">" +
        "<b>Growth OS todavía no está sincronizado.</b><p>En la carpeta respondo-growth-os: <code>python tools/hq_sync.py</code></p></body>",
      { status: 404, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
    );
  }
  return new Response(await data.text(), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Frame-Options": "SAMEORIGIN",
      "Content-Security-Policy": "frame-ancestors 'self'",
    },
  });
}
