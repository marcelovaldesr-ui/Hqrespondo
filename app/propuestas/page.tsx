import { getRevenueStore } from "@/lib/revenue/store";
import ProposalsTracker from "@/components/ProposalsTracker";
import RevenueErrorState from "@/components/RevenueErrorState";

export const dynamic = "force-dynamic";

export default async function PropuestasPage() {
  try {
    const store = getRevenueStore();
    const [proposals, deals] = await Promise.all([
      store.getProposals(),
      store.getDeals(),
    ]);

    return <ProposalsTracker initialProposals={proposals} deals={deals} />;
  } catch (err: any) {
    console.error("[PropuestasPage] Error cargando propuestas:", err);
    return <RevenueErrorState error={err?.message || "Error al conectar con la base de datos"} route="/propuestas" />;
  }
}
