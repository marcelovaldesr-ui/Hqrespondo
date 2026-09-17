/**
 * RESPONDO HQ — Autenticación Fail-Closed
 *
 * Regla de Oro:
 * 1. En producción (NODE_ENV=production): si faltan credenciales (HQ_USER/HQ_PASSWORD o HQ_USERS),
 *    DENEGAR ACCESO INMEDIATAMENTE (fail-closed, 500 / 401). Jamás permitir acceso libre.
 * 2. En desarrollo/test: el bypass requiere opt-in EXPLÍCITO vía HQ_DEV_AUTH_BYPASS="true".
 *    Si no está presente o es false, denegar con 401.
 */

export interface HqAccount {
  user: string;
  pass: string;
}

export interface AuthEvaluation {
  allowed: boolean;
  status: number;
  user?: string;
  error?: string;
  redirectToDashboard?: boolean;
}

export function leerCuentasHq(env: Record<string, string | undefined> = process.env): HqAccount[] {
  const out: HqAccount[] = [];

  const agregar = (u?: string | null, p?: string | null) => {
    const user = (u ?? "").trim();
    const pass = p ?? "";
    if (!user || !pass) return;
    if (out.some((c) => c.user === user)) return; // primero gana
    out.push({ user, pass });
  };

  agregar(env.HQ_USER, env.HQ_PASSWORD);
  for (let i = 2; i <= 8; i++) {
    agregar(env[`HQ_USER_${i}`], env[`HQ_PASSWORD_${i}`]);
  }

  // HQ_USERS = "tomas:clave1,vale:clave2"
  for (const par of (env.HQ_USERS ?? "").split(",")) {
    const t = par.trim();
    if (!t) continue;
    const corte = t.indexOf(":");
    if (corte <= 0) continue;
    agregar(t.slice(0, corte), t.slice(corte + 1));
  }

  return out;
}

/** Decodifica base64 respetando UTF-8 */
export function decodificarBase64(b64: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(b64, "base64").toString("utf-8");
  }
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Comparación en tiempo constante para mitigar timing attacks */
export function igualdadConstante(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let dif = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) dif |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return dif === 0;
}

export function evaluarAutenticacionHq(options: {
  pathname: string;
  authHeader: string | null;
  env?: Record<string, string | undefined>;
}): AuthEvaluation {
  const env = options.env ?? process.env;
  const pathname = options.pathname;
  const auth = options.authHeader;

  const cuentas = leerCuentasHq(env);
  const isProduction = env.NODE_ENV === "production";
  const devBypass = env.HQ_DEV_AUTH_BYPASS === "true";

  // 1. SIN CUENTAS CONFIGURADAS
  if (cuentas.length === 0) {
    if (isProduction) {
      return {
        allowed: false,
        status: 500,
        error: "CRITICAL_AUTH_CONFIG_MISSING: En producción se exige configurar credenciales de acceso (HQ_USER/HQ_PASSWORD o HQ_USERS). Acceso denegado (fail-closed).",
      };
    }

    if (devBypass) {
      return {
        allowed: true,
        status: 200,
        user: "dev_bypass_user",
        redirectToDashboard: pathname === "/",
      };
    }

    return {
      allowed: false,
      status: 401,
      error: "AUTH_CREDENTIALS_MISSING: Sin cuentas configuradas. Para desarrollo local sin clave configure HQ_DEV_AUTH_BYPASS=true.",
    };
  }

  // 2. CON CUENTAS: VALIDAR BASIC AUTH
  if (auth?.startsWith("Basic ")) {
    try {
      const cred = decodificarBase64(auth.slice(6));
      const corte = cred.indexOf(":");
      const u = corte === -1 ? cred : cred.slice(0, corte);
      const p = corte === -1 ? "" : cred.slice(corte + 1);

      const match = cuentas.find(
        (c) => igualdadConstante(c.user, u) && igualdadConstante(c.pass, p)
      );

      if (match) {
        return {
          allowed: true,
          status: 200,
          user: match.user,
          redirectToDashboard: pathname === "/",
        };
      }
    } catch {
      // Base64 malformado o error de decodificación
    }
  }

  return {
    allowed: false,
    status: 401,
    error: "INVALID_CREDENTIALS",
  };
}
