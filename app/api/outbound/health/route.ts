import { NextResponse } from "next/server";
import { verificarAutorizacionOutbound } from "@/lib/outbound/auth";
import { getOutboundStore } from "@/lib/outbound/runtimeStore";
import { chequearSaludDnsDominio } from "@/lib/outbound/dnsHealth";
import { obtenerConfigSeguridad } from "@/lib/outbound/guardrails";
import { estadoConfiguracionOAuth, verificarSaludWatchMailbox } from "@/lib/outbound/gmail";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 45;

/**
 * GET /api/outbound/health
 * Retorna el estado consolidado de salud de respon.do (SPF, DKIM, DMARC, MX),
 * estado de senders, métricas de hoy y kill switch.
 */
export async function GET(req: Request) {
  if (!verificarAutorizacionOutbound(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const store = getOutboundStore();
    const config = obtenerConfigSeguridad();

    const dominio = await store.getDomain("respon.do");
    const senders = await store.getSenders();
    const dnsHealth = await chequearSaludDnsDominio({ dominio: "respon.do" });
    const watches = await Promise.all(
      senders.map((sender) => verificarSaludWatchMailbox({ senderEmail: sender.email, store })),
    );

    // Actualizar estados DNS en el store
    if (dominio) {
      await store.updateDomain("respon.do", {
        spf_status: dnsHealth.spf.estado,
        dkim_status: dnsHealth.dkim.estado,
        dmarc_status: dnsHealth.dmarc.estado,
        mx_status: dnsHealth.mx.estado,
        last_dns_check: dnsHealth.timestamp,
      });
    }

    return NextResponse.json({
      ok: true,
      config: {
        outbound_enabled: config.outboundEnabled,
        dry_run: config.dryRun,
      },
      dominio,
      senders: senders.map((s) => ({
        id: s.id,
        name: s.name,
        email: s.email,
        type: s.type,
        active: s.active,
        cold_outreach_enabled: s.cold_outreach_enabled,
        sent_today: s.sent_today,
        new_leads_today: s.new_leads_today,
        new_leads_daily_limit: s.new_leads_daily_limit,
        total_messages_daily_limit: s.total_messages_daily_limit,
        health_status: s.health_status,
        oauth_configured: estadoConfiguracionOAuth(s.email).configured,
        watch: watches.find((watch) => watch.mailboxEmail === s.email) ?? null,
      })),
      dns: dnsHealth,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
