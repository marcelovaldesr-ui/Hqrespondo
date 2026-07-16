/**
 * DIAGNÓSTICO del agente de prospección.
 *
 * Un solo lugar que responde: "¿está todo listo para encender?". Revisa que
 * las variables existan (sin revelar sus valores), que la migración 017 haya
 * corrido (columnas presentes), cuántas leads de oro hay listas, y —si se pide
 * ?ping=1— que cada servicio externo responda de verdad. Nunca lanza.
 */
import { db } from "../db";
import { verificarGmail } from "./email";
import { config } from "./tipos";

interface Check {
  configurado: boolean;
  ok?: boolean;
  detalle?: string;
}

const tiene = (k: string) => Boolean(process.env[k] && process.env[k]!.trim());

// ── Supabase: columnas de la migración 017 + tamaño de la lista de oro ──
async function chequearSupabase(): Promise<Check & { lista_oro?: number; por_estado?: Record<string, number> }> {
  try {
    const cfg = config();
    // Si esta columna no existe, la migración 017 no corrió → error claro.
    const test = await db()
      .from("prospects")
      .select("prospeccion_estado", { count: "exact", head: true });
    if (test.error) {
      return {
        configurado: true,
        ok: false,
        detalle: `Falta migración 017 o error de acceso: ${test.error.message}`,
      };
    }

    const oro = await db()
      .from("prospects")
      .select("id", { count: "exact", head: true })
      .gte("score", cfg.scoreMinimo)
      .not("telefono", "is", null)
      .in("estado", ["nuevo", "contactado"]);

    // Desglose por estado del agente (útil para ver el avance).
    const estados = [
      "pendiente",
      "en_secuencia",
      "no_encontrado",
      "respondio",
      "demo_agendada",
      "descartado_agente",
    ];
    const por_estado: Record<string, number> = {};
    for (const e of estados) {
      const r = await db()
        .from("prospects")
        .select("id", { count: "exact", head: true })
        .eq("prospeccion_estado", e);
      por_estado[e] = r.count ?? 0;
    }

    return {
      configurado: true,
      ok: true,
      lista_oro: oro.count ?? 0,
      por_estado,
      detalle: `Migración 017 OK · ${oro.count ?? 0} leads de oro (score≥${cfg.scoreMinimo}, con teléfono, sin contactar)`,
    };
  } catch (e) {
    return { configurado: true, ok: false, detalle: e instanceof Error ? e.message : String(e) };
  }
}

async function pingSerper(): Promise<Check> {
  const configurado = tiene("SERPER_API_KEY");
  if (!configurado) return { configurado: false };
  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": process.env.SERPER_API_KEY!, "Content-Type": "application/json" },
      body: JSON.stringify({ q: "respondo test", num: 1 }),
    });
    return { configurado, ok: res.ok, detalle: res.ok ? "responde" : `HTTP ${res.status}` };
  } catch (e) {
    return { configurado, ok: false, detalle: e instanceof Error ? e.message : String(e) };
  }
}

async function pingHunter(): Promise<Check> {
  const configurado = tiene("HUNTER_API_KEY");
  if (!configurado) return { configurado: false };
  try {
    const res = await fetch(`https://api.hunter.io/v2/account?api_key=${process.env.HUNTER_API_KEY}`);
    const data = await res.json().catch(() => ({}));
    const restantes = data?.data?.requests?.searches
      ? `${data.data.requests.searches.available - data.data.requests.searches.used} búsquedas libres`
      : undefined;
    return { configurado, ok: res.ok, detalle: res.ok ? restantes ?? "responde" : `HTTP ${res.status}` };
  } catch (e) {
    return { configurado, ok: false, detalle: e instanceof Error ? e.message : String(e) };
  }
}

async function pingTelegram(mostrarChatId: boolean): Promise<Check & { chat_ids?: unknown[] }> {
  const configurado = tiene("TELEGRAM_BOT_TOKEN");
  if (!configurado) return { configurado: false };
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN!;
    const me = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    if (!me.ok) return { configurado, ok: false, detalle: `getMe HTTP ${me.status}` };

    let chat_ids: unknown[] | undefined;
    if (mostrarChatId) {
      // Muestra los chat_id que le han escrito al bot (para copiar a TELEGRAM_CHAT_ID).
      const up = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
      const data = await up.json().catch(() => ({}));
      const set = new Map<number, string>();
      for (const u of data?.result ?? []) {
        const chat = u?.message?.chat;
        if (chat?.id) set.set(chat.id, `${chat.first_name ?? ""} ${chat.username ? "@" + chat.username : ""}`.trim());
      }
      chat_ids = [...set].map(([id, nombre]) => ({ id, nombre }));
    }
    const tieneChatId = tiene("TELEGRAM_CHAT_ID");
    return {
      configurado,
      ok: true,
      detalle: tieneChatId
        ? "bot OK · TELEGRAM_CHAT_ID configurado"
        : "bot OK · falta TELEGRAM_CHAT_ID (escríbele al bot y usa ?chatid=1)",
      chat_ids,
    };
  } catch (e) {
    return { configurado, ok: false, detalle: e instanceof Error ? e.message : String(e) };
  }
}

async function pingGmail(): Promise<Check> {
  const configurado =
    tiene("GMAIL_CLIENT_ID") && tiene("GMAIL_CLIENT_SECRET") && tiene("GMAIL_REFRESH_TOKEN");
  if (!configurado) return { configurado: false, detalle: "faltan credenciales OAuth" };
  const r = await verificarGmail();
  return { configurado, ok: r.ok, detalle: r.ok ? `envía como ${r.email}` : r.error };
}

export interface Diagnostico {
  listo_para_encender: boolean;
  faltantes: string[];
  variables: Record<string, boolean>;
  servicios: Record<string, Check>;
  supabase: Awaited<ReturnType<typeof chequearSupabase>>;
}

/** Corre el diagnóstico completo. ping=true consulta los servicios externos. */
export async function diagnosticar(ping: boolean, mostrarChatId: boolean): Promise<Diagnostico> {
  const requeridas = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "GEMINI_API_KEY",
    "SERPER_API_KEY",
    "HUNTER_API_KEY",
    "GMAIL_CLIENT_ID",
    "GMAIL_CLIENT_SECRET",
    "GMAIL_REFRESH_TOKEN",
    "GMAIL_FROM",
    "TELEGRAM_BOT_TOKEN",
    "TELEGRAM_CHAT_ID",
    "PROS_CRON_SECRET",
    // Vercel Cron manda "Authorization: Bearer CRON_SECRET" SOLO si esta
    // variable existe en Vercel. Sin ella, el cron llega sin credencial y
    // el agente nunca corre solo (401 silencioso).
    "CRON_SECRET",
  ];
  const variables: Record<string, boolean> = {};
  for (const k of requeridas) variables[k] = tiene(k);
  const faltantes = requeridas.filter((k) => !variables[k]);

  const supabase = await chequearSupabase();

  const servicios: Record<string, Check> = {};
  if (ping) {
    const [serper, hunter, gmail, telegram] = await Promise.all([
      pingSerper(),
      pingHunter(),
      pingGmail(),
      pingTelegram(mostrarChatId),
    ]);
    servicios.serper = serper;
    servicios.hunter = hunter;
    servicios.gmail = gmail;
    servicios.telegram = telegram;
  }

  const serviciosOk =
    !ping ||
    (["serper", "hunter", "gmail", "telegram"] as const).every((s) => servicios[s]?.ok);

  return {
    listo_para_encender: faltantes.length === 0 && supabase.ok === true && serviciosOk,
    faltantes,
    variables,
    servicios,
    supabase,
  };
}
