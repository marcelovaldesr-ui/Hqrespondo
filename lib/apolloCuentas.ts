/**
 * Cuentas de Apollo configuradas.
 *
 * Marcelo confirmó con Apollo y con TGP (20-ago-2026) que tener hasta DOS
 * cuentas es aceptable para ellos; de la tercera en adelante corresponde
 * pagar plan. Sobre esa confirmación se apoya este archivo. Si Apollo dijera
 * lo contrario, se desactiva borrando una variable de entorno — no hay nada
 * más que desarmar.
 *
 * Dos cosas que conviene tener claras antes de usarlo:
 *
 *  1. Las dos cuentas consultan LA MISMA base de datos de Apollo. Una segunda
 *     cuenta NO aporta más cobertura: aporta más créditos. Por eso el salto a
 *     la cuenta 2 ocurre SOLO cuando la 1 se quedó sin créditos o sin permiso
 *     — nunca cuando la persona simplemente no está en la base, porque en la
 *     cuenta 2 tampoco va a estar y sería gastar una llamada al vacío.
 *
 *  2. Nada acá esconde nada. Cada resultado deja registrado con qué cuenta se
 *     obtuvo, y el consumo queda visible en el panel de cada cuenta.
 */

export interface CuentaApollo {
  /** Etiqueta legible para mostrar en pantalla y en la bitácora. */
  nombre: string;
  key: string;
}

export const APOLLO_BASE = "https://api.apollo.io/api/v1";

/** Las cuentas realmente configuradas, en orden de uso. */
export function cuentasApollo(): CuentaApollo[] {
  const cuentas: CuentaApollo[] = [];
  const k1 = process.env.APOLLO_API_KEY?.trim();
  const k2 = process.env.APOLLO_API_KEY_2?.trim();
  if (k1) cuentas.push({ nombre: process.env.APOLLO_CUENTA_1_NOMBRE?.trim() || "Apollo cuenta 1", key: k1 });
  if (k2) cuentas.push({ nombre: process.env.APOLLO_CUENTA_2_NOMBRE?.trim() || "Apollo cuenta 2", key: k2 });
  return cuentas;
}

/**
 * Errores por los que SÍ vale la pena probar con la otra cuenta: son de cupo
 * o de permiso, no de datos. Cualquier otro error se propaga tal cual.
 */
export function esFaltaDeCupo(status: number, cuerpo: string): boolean {
  if (status === 402 || status === 429) return true;
  if (status === 401 || status === 403) {
    return /credit|quota|limit|plan|upgrade|insufficient/i.test(cuerpo);
  }
  return false;
}

export interface EstadoCuenta {
  nombre: string;
  configurada: boolean;
  responde: boolean;
  mensaje: string;
}

/**
 * Verifica cada cuenta contra el endpoint de salud de Apollo
 * (GET /auth/health). No consume créditos: sirve para confirmar que la llave
 * está viva antes de gastar en una consulta real.
 */
export async function verificarCuentasApollo(): Promise<EstadoCuenta[]> {
  const cuentas = cuentasApollo();
  if (!cuentas.length) {
    return [{ nombre: "Apollo", configurada: false, responde: false, mensaje: "sin APOLLO_API_KEY configurada" }];
  }
  return Promise.all(
    cuentas.map(async (c) => {
      try {
        const res = await fetch(`${APOLLO_BASE}/auth/health`, {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
            "x-api-key": c.key,
          },
        });
        const cuerpo = await res.text();
        if (!res.ok) {
          return {
            nombre: c.nombre, configurada: true, responde: false,
            mensaje: `Apollo respondió ${res.status}: ${cuerpo.slice(0, 120)}`,
          };
        }
        const d = JSON.parse(cuerpo || "{}");
        const ok = d?.healthy === true && d?.is_logged_in === true;
        // OJO: una llave inválida NO devuelve 401. Apollo responde 200 con
        // {"healthy":true,"is_logged_in":false} — comprobado el 20-ago-2026.
        // Mirar solo el código HTTP daría por buena cualquier llave escrita
        // mal, y el error recién aparecería al gastar un crédito.
        if (!ok && d?.is_logged_in === false) {
          return {
            nombre: c.nombre, configurada: true, responde: false,
            mensaje: "la llave no es válida o fue revocada (Apollo responde is_logged_in: false)",
          };
        }
        return {
          nombre: c.nombre, configurada: true, responde: ok,
          mensaje: ok ? "la llave responde y está autenticada" : `respuesta inesperada: ${cuerpo.slice(0, 120)}`,
        };
      } catch (e: any) {
        return { nombre: c.nombre, configurada: true, responde: false, mensaje: `no se pudo contactar: ${e?.message ?? e}` };
      }
    }),
  );
}

/**
 * URL pública del webhook donde Apollo deja los teléfonos.
 *
 * Apollo no devuelve el teléfono en la respuesta de `people/match`: lo
 * verifica de forma asíncrona y lo POSTea a esta dirección. Sin webhook no
 * hay teléfono por Apollo, por mucho crédito que quede.
 *
 * Se arma sola en Vercel con VERCEL_URL; se puede fijar a mano con
 * APOLLO_WEBHOOK_URL si el dominio es otro. El token viaja en la query
 * porque Apollo no permite mandar headers propios al webhook.
 */
export function urlWebhookApollo(): string | null {
  const token = process.env.HQ_API_TOKEN?.trim();
  if (!token) return null;
  const explicita = process.env.APOLLO_WEBHOOK_URL?.trim();
  const base =
    explicita ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    process.env.HQ_BASE_URL?.trim() ||
    "";
  if (!base) return null;
  const raiz = base.replace(/\/+$/, "");
  return `${raiz}/api/hooks/apollo-telefono?token=${encodeURIComponent(token)}`;
}
