import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Protege todo el panel con Basic Auth (HQ_USER / HQ_PASSWORD).
 * Las rutas /api/hooks/* quedan fuera: las usa n8n y validan
 * su propio token (x-hq-token) dentro del handler.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api/hooks")) return NextResponse.next();

  const user = process.env.HQ_USER;
  const pass = process.env.HQ_PASSWORD;
  if (!user || !pass) return NextResponse.next(); // auth no configurada aún

  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Basic ")) {
    try {
      const [u, p] = atob(auth.slice(6)).split(":");
      if (u === user && p === pass) return NextResponse.next();
    } catch {
      // header malformado → 401
    }
  }

  return new NextResponse("Autenticación requerida", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Respondo HQ"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
