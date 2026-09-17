import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Protege todo el panel con Basic Auth.
 *
 * CÓMO SE AGREGAN USUARIOS (sin tocar este archivo nunca más):
 *
 *   Opción A — una variable por persona, hasta 8:
 *     HQ_USER / HQ_PASSWORD          (la de siempre)
 *     HQ_USER_2 / HQ_PASSWORD_2
 *     HQ_USER_3 / HQ_PASSWORD_3      ← nuevo
 *     ... hasta HQ_USER_8
 *
 *   Opción B — todos juntos en una sola variable:
 *     HQ_USERS = "tomas:CLAVE1,vale:CLAVE2"
 *
 * Las dos se pueden mezclar. Antes esto estaba hardcodeado a 2 personas y
 * sumar una tercera obligaba a editar código y desplegar.
 *
 * El usuario autenticado se pasa a las APIs en el header interno x-hq-user
 * (se sobrescribe siempre: no es spoofeable).
 *
 * Las rutas /api/hooks/* quedan fuera: las usa n8n y validan
 * su propio token (x-hq-token) dentro del handler.
 *
 * Las rutas /api/prospeccion/* también quedan fuera: las llama Vercel Cron
 * (que NO manda Basic Auth — sin esta excepción el agente muere en 401
 * silencioso) y todas validan su propio secreto adentro (lib/prospeccion/auth).
 *
 * Las rutas /api/cola/* quedan fuera por lo mismo: las llama GitHub Actions con
 * curl, que tampoco manda Basic Auth, y validan el mismo secreto adentro
 * (PROS_CRON_SECRET, vía lib/prospeccion/auth). Sin esta línea el worker de la
 * cola moría en el mismo 401 silencioso que describe el párrafo de arriba.
 *
 * El redirect de "/" → "/dashboard" se hace ACÁ y no en app/page.tsx.
 * Motivo (bug real, 14-ago-2026): app/page.tsx era un `redirect("/dashboard")`
 * que Next prerenderizaba como artefacto estático. Servido desde el caché de
 * Vercel (x-vercel-cache: HIT) llegaba como 307 SIN header `Location`, así que
 * el navegador se quedaba sin destino y la home aparecía en blanco. Todas las
 * demás rutas respondían 200: solo la puerta de entrada estaba rota.
 * Resolviéndolo en el middleware el 307 se emite en cada request, con Location,
 * y nunca queda cacheado como archivo estático.
 */
import { evaluarAutenticacionHq } from "@/lib/auth/hqAuth";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/api/hooks") ||
    pathname.startsWith("/api/prospeccion") ||
    pathname.startsWith("/api/cola")
  )
    return NextResponse.next();

  const alDashboard = () =>
    NextResponse.redirect(new URL("/dashboard", req.url));

  const authEval = evaluarAutenticacionHq({
    pathname,
    authHeader: req.headers.get("authorization"),
  });

  if (authEval.allowed) {
    if (authEval.redirectToDashboard) {
      return alDashboard();
    }
    const headers = new Headers(req.headers);
    if (authEval.user) {
      headers.set("x-hq-user", authEval.user);
    }
    return NextResponse.next({ request: { headers } });
  }

  if (authEval.status === 500) {
    return new NextResponse(
      JSON.stringify({
        error: "AUTH_CONFIG_ERROR",
        message: authEval.error,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  return new NextResponse("Autenticación requerida", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Respondo HQ"' },
  });
}



export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
