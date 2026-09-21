import { unstable_noStore as noStore } from "next/cache";
import OutboundDashboard from "@/components/OutboundDashboard";
import { getOutboundStore } from "@/lib/outbound/runtimeStore";
import { chequearSaludDnsDominio } from "@/lib/outbound/dnsHealth";
import { obtenerConfigSeguridad } from "@/lib/outbound/guardrails";
import { estadoConfiguracionOAuth } from "@/lib/outbound/gmail";
import type { OutboundStore } from "@/lib/outbound/store";
import { OUTBOUND_DOMAIN } from "@/lib/outbound/config";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function OutboundPage() {
  noStore();

  const config = obtenerConfigSeguridad();
  let store: OutboundStore;
  try {
    store = getOutboundStore();

  const [dominio, senders, companies, contacts, outbox, replies, suppressions, mailboxWatches, dnsHealth] =
    await Promise.all([
      store.getDomain(OUTBOUND_DOMAIN),
      store.getSenders(),
      store.listCompanies(100),
      store.listContacts(100),
      store.listOutbox({ limit: 100 }),
      store.listReplies(50),
      store.listSuppressions(),
      store.listMailboxWatches(),
      chequearSaludDnsDominio({ dominio: OUTBOUND_DOMAIN }).catch(() => null),
    ]);

  return (
    <OutboundDashboard
      initialData={{
        config: {
          outboundEnabled: config.outboundEnabled,
          dryRun: config.dryRun,
        },
        domainName: OUTBOUND_DOMAIN,
        dominio,
        senders,
        companies,
        contacts,
        outbox,
        replies,
        suppressions,
        mailboxWatches,
        oauthConfigured: Object.fromEntries(
          senders.map((sender) => [sender.email, estadoConfiguracionOAuth(sender.email).configured]),
        ),
        dnsHealth,
      }}
    />
  );
  } catch (error) {
    return (
      <div className="p-6 sm:p-8">
        <div className="max-w-3xl rounded-xl border border-amber-500/30 bg-amber-500/10 p-6">
          <h1 className="text-xl font-semibold text-ink">Outbound V1 · configuración pendiente</h1>
          <p className="mt-3 text-sm text-ink-dim">
            El panel está desplegado, pero la capa persistente de Outbound aún no está disponible.
            Aplique las migraciones 041, 042 y 045 en ese orden y vuelva a cargar esta página.
          </p>
          <p className="mt-3 font-mono text-xs text-amber-200">
            {error instanceof Error ? error.message : "No fue posible consultar Supabase."}
          </p>
        </div>
      </div>
    );
  }
}
