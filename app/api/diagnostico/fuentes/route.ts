import { NextResponse } from "next/server";
import { verificarCuentasApollo } from "@/lib/apolloCuentas";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 20;

/**
 * GET /api/diagnostico/fuentes
 *
 * Dice si cada proveedor de datos está configurado y si su llave responde.
 * Existe porque las llaves viven en Vercel y no en el repo: sin esto, la
 * única forma de saber si una llave sirve era gastar un crédito en una
 * consulta real y ver si fallaba.
 *
 * NUNCA devuelve el valor de una llave, ni completo ni parcial. Solo dice si
 * está puesta y si el proveedor la reconoce.
 */
export async function GET() {
  const fuentes: {
    proveedor: string;
    cuenta: string;
    configurada: boolean;
    responde: boolean | null;
    creditos: string | null;
    mensaje: string;
  }[] = [];

  // --- Apollo: tiene endpoint de salud gratis y documentado.
  for (const c of await verificarCuentasApollo()) {
    fuentes.push({
      proveedor: "Apollo",
      cuenta: c.nombre,
      configurada: c.configurada,
      responde: c.configurada ? c.responde : null,
      creditos: null,
      mensaje: c.mensaje,
    });
  }
  if (!process.env.APOLLO_API_KEY_2?.trim()) {
    fuentes.push({
      proveedor: "Apollo",
      cuenta: "Apollo cuenta 2",
      configurada: false,
      responde: null,
      creditos: null,
      mensaje: "sin APOLLO_API_KEY_2 configurada",
    });
  }

  // --- Hunter: GET /v2/account es gratis y devuelve el saldo real.
  const hunterKey = process.env.HUNTER_API_KEY?.trim();
  if (!hunterKey) {
    fuentes.push({ proveedor: "Hunter", cuenta: "Hunter", configurada: false, responde: null, creditos: null, mensaje: "sin HUNTER_API_KEY configurada" });
  } else {
    try {
      const r = await fetch(`https://api.hunter.io/v2/account?api_key=${encodeURIComponent(hunterKey)}`);
      const d = await r.json().catch(() => null);
      const req = d?.data?.requests?.searches;
      fuentes.push({
        proveedor: "Hunter",
        cuenta: d?.data?.email ? `Hunter (${d.data.email})` : "Hunter",
        configurada: true,
        responde: r.ok,
        creditos: req ? `${req.used} usados de ${req.available}` : null,
        mensaje: r.ok ? `plan ${d?.data?.plan_name ?? "desconocido"}` : `Hunter respondió ${r.status}`,
      });
    } catch (e: any) {
      fuentes.push({ proveedor: "Hunter", cuenta: "Hunter", configurada: true, responde: false, creditos: null, mensaje: `no se pudo contactar: ${e?.message ?? e}` });
    }
  }

  // --- Lusha: no expone un chequeo gratuito documentado. Se informa si está
  //     puesta; confirmar que sirve exige gastar un crédito en una consulta.
  const lusha = !!process.env.LUSHA_API_KEY?.trim();
  fuentes.push({
    proveedor: "Lusha",
    cuenta: "Lusha",
    configurada: lusha,
    responde: null,
    creditos: null,
    mensaje: lusha
      ? "llave puesta — Lusha no tiene chequeo gratuito, se confirma en la primera consulta real"
      : "sin LUSHA_API_KEY configurada",
  });

  return NextResponse.json(
    { fuentes, revisado: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
