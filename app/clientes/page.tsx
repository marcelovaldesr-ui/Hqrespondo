import { db } from "@/lib/db";
import { hora } from "@/lib/format";
import type { Client, ClientStats, UptimeBucket } from "@/lib/types";
import PageHeader from "@/components/PageHeader";
import Clients from "@/components/Clients";

export const dynamic = "force-dynamic";

const HORAS_UPTIME = 16;

interface Ev {
  client_id: string | null;
  tipo: string;
  detalle: string | null;
  created_at: string;
}

function uptimeBuckets(eventos: Ev[], clientId: string): UptimeBucket[] {
  const now = Date.now();
  const buckets: UptimeBucket[] = Array.from({ length: HORAS_UPTIME }, () => ({
    n: 0,
    err: false,
  }));
  for (const e of eventos) {
    if (e.client_id !== clientId) continue;
    const idx =
      HORAS_UPTIME -
      1 -
      Math.floor((now - new Date(e.created_at).getTime()) / 3600000);
    if (idx < 0 || idx >= HORAS_UPTIME) continue;
    if (e.tipo === "error") buckets[idx].err = true;
    else buckets[idx].n++;
  }
  return buckets;
}

export default async function ClientesPage() {
  const s = db();
  const hoy = new Date().toISOString().slice(0, 10);
  const hace24 = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const inicioMes = `${hoy.slice(0, 7)}-01`;

  const [cliRes, evRes, mesRes] = await Promise.all([
    s.from("clients").select("*").order("created_at", { ascending: true }),
    s
      .from("bot_events")
      .select("client_id,tipo,detalle,created_at")
      .gte("created_at", hace24)
      .order("created_at", { ascending: false }),
    s
      .from("bot_events")
      .select("client_id,costo_clp")
      .gte("created_at", `${inicioMes}T00:00:00`),
  ]);

  const clients = (cliRes.data ?? []) as Client[];
  const eventos = (evRes.data ?? []) as Ev[];
  const eventosMes = (mesRes.data ?? []) as {
    client_id: string | null;
    costo_clp: number | null;
  }[];

  const stats: ClientStats[] = clients.map((c) => {
    const propios = eventos.filter((e) => e.client_id === c.id);
    return {
      ...c,
      ultimo_evento: propios[0]?.created_at ?? null,
      errores_24h: propios.filter((e) => e.tipo === "error").length,
      mensajes_hoy: propios.filter(
        (e) => e.tipo === "mensaje" && e.created_at >= `${hoy}T00:00:00`,
      ).length,
      costo_mes: eventosMes
        .filter((e) => e.client_id === c.id)
        .reduce((a, e) => a + (Number(e.costo_clp) || 0), 0),
      uptime: uptimeBuckets(eventos, c.id),
    };
  });

  const nombrePorId = new Map(clients.map((c) => [c.id, c.nombre]));
  const alertas = eventos
    .filter((e) => e.tipo === "error")
    .slice(0, 2)
    .map((e) => ({
      cliente: e.client_id
        ? nombrePorId.get(e.client_id) ?? "desconocido"
        : "desconocido",
      detalle: e.detalle,
      hora: hora(e.created_at),
    }));

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Clientes & Bots" sub="Operación" />

      {alertas.length > 0 && (
        <div className="mb-4 flex flex-col gap-2">
          {alertas.map((a, i) => (
            <div
              key={i}
              className="panel flex items-center gap-3 border-danger/30 bg-danger/[0.06] px-4 py-3 text-[12px] text-ink-soft"
            >
              <span className="led led-glow-red bg-danger" />
              <span className="truncate">
                <span className="font-medium text-danger">{a.cliente}</span>:{" "}
                {a.detalle ?? "error"} · alerta enviada a tu WhatsApp{" "}
                <span className="font-mono text-danger">{a.hora}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      <Clients clients={stats} />
    </div>
  );
}
