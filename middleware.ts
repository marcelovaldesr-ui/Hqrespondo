import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Protege todo el panel con Basic Auth.
 * Soporta hasta 2 credenciales (HQ_USER/HQ_PASSWORD y HQ_USER_2/HQ_PASSWORD_2)
 * para que cada socio tenga la suya. El usuario autenticado se pasa a las
 * APIs en el header interno x-hq-user (se sobrescribe siempre: no es spoofeable).
 *
 * Las rutas /api/hooks/* quedan fuera: las usa n8n y validan
 * su propio token (x-hq-token) dentro del handler.
 *
 * Las rutas /api/prospeccion/* también quedan fuera: las llama Vercel Cron
 * (que NO manda Basic Auth — sin esta excepción el agente muere en 401
 * silencioso) y todas validan su propio secreto adentro (lib/prospeccion/auth).
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/api/hooks") ||
    pathname.startsWith("/api/prospeccion")
  )
    return NextResponse.next();

  const cuentas = [
    { user: process.env.HQ_USER, pass: process.env.HQ_PASSWORD },
    { user: process.env.HQ_USER_2, pass: process.env.HQ_PASSWORD_2 },
  ].filter((c) => c.user && c.pass);

  if (cuentas.length === 0) return NextResponse.next(); // auth no configurada aún

  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Basic ")) {
    try {
      const [u, p] = atob(auth.slice(6)).split(":");
      const match = cuentas.find((c) => c.user === u && c.pass === p);
      if (match) {
        const headers = new Headers(req.headers);
        headers.set("x-hq-user", match.user!);
        return NextResponse.next({ request: { headers } });
      }
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
