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
 * El redirect de "/" → "/dashboard" se hace ACÁ y no en app/page.tsx.
 * Motivo (bug real, 14-ago-2026): app/page.tsx era un `redirect("/dashboard")`
 * que Next prerenderizaba como artefacto estático. Servido desde el caché de
 * Vercel (x-vercel-cache: HIT) llegaba como 307 SIN header `Location`, así que
 * el navegador se quedaba sin destino y la home aparecía en blanco. Todas las
 * demás rutas respondían 200: solo la puerta de entrada estaba rota.
 * Resolviéndolo en el middleware el 307 se emite en cada request, con Location,
 * y nunca queda cacheado como archivo estático.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/api/hooks") ||
    pathname.startsWith("/api/prospeccion")
  )
    return NextResponse.next();

  const alDashboard = () =>
    NextResponse.redirect(new URL("/dashboard", req.url));

  const cuentas = leerCuentas();

  // auth no configurada aún (dev local)
  if (cuentas.length === 0) {
    return pathname === "/" ? alDashboard() : NextResponse.next();
  }

  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Basic ")) {
    try {
      // Basic Auth manda "usuario:clave" en base64. La clave puede contener
      // ":" (un generador de contraseñas lo produce), así que se corta en el
      // PRIMER ":" y el resto es la clave entera. Con split(":") a secas, una
      // clave con dos puntos nunca calzaba y el usuario quedaba fuera sin
      // ninguna pista de por qué.
      const cred = decodificar(auth.slice(6));
      const corte = cred.indexOf(":");
      const u = corte === -1 ? cred : cred.slice(0, corte);
      const p = corte === -1 ? "" : cred.slice(corte + 1);
      const match = cuentas.find(
        (c) => igualdadConstante(c.user!, u) && igualdadConstante(c.pass!, p),
      );
      if (match) {
        // Recién después de validar credenciales: un visitante sin auth
        // sigue viendo 401 en "/" y no descubre que existe /dashboard.
        if (pathname === "/") return alDashboard();
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

/** Lee las cuentas desde el entorno. Ver el comentario de arriba. */
function leerCuentas(): { user: string; pass: string }[] {
  const out: { user: string; pass: string }[] = [];

  const agregar = (u?: string | null, p?: string | null) => {
    const user = (u ?? "").trim();
    const pass = p ?? "";
    if (!user || !pass) return;
    if (out.some((c) => c.user === user)) return; // primero gana
    out.push({ user, pass });
  };

  agregar(process.env.HQ_USER, process.env.HQ_PASSWORD);
  for (let i = 2; i <= 8; i++) {
    agregar(process.env[`HQ_USER_${i}`], process.env[`HQ_PASSWORD_${i}`]);
  }

  // HQ_USERS = "tomas:clave1,vale:clave2"
  for (const par of (process.env.HQ_USERS ?? "").split(",")) {
    const t = par.trim();
    if (!t) continue;
    const corte = t.indexOf(":");
    if (corte <= 0) continue;
    agregar(t.slice(0, corte), t.slice(corte + 1));
  }

  return out;
}

/** Decodifica base64 respetando UTF-8: una ñ o una tilde en la clave
 *  rompía el atob crudo y devolvía bytes distintos a los guardados. */
function decodificar(b64: string): string {
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/**
 * Comparación en tiempo constante.
 * `a === b` corta apenas encuentra el primer carácter distinto, así que el
 * tiempo de respuesta filtra cuántos caracteres del principio son correctos.
 * Es un ataque real y evitarlo cuesta cinco líneas.
 */
function igualdadConstante(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let dif = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) dif |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return dif === 0;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
