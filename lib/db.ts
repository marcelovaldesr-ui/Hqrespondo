import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

/**
 * Cliente Supabase de servidor (service_role). Solo usar en server/API.
 *
 * IMPORTANTE: el fetch va con cache: "no-store" para saltarse el Data Cache
 * de Next/Vercel. Sin esto, las páginas server-side quedan congeladas con los
 * datos del momento del deploy: escribes/borras en la base pero la UI sigue
 * mostrando lo viejo (bug real detectado en producción, jul-2026).
 */
export function db(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en las variables de entorno",
    );
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) =>
        fetch(input, { ...init, cache: "no-store" }),
    },
  });
  return cached;
}
