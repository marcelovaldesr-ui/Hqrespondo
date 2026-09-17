import { getRevenueStore } from "@/lib/revenue/store";
import PilotsDashboard from "@/components/PilotsDashboard";
import RevenueErrorState from "@/components/RevenueErrorState";

export const dynamic = "force-dynamic";

export default async function PilotosPage() {
  try {
    const store = getRevenueStore();
    const [pilots, deals] = await Promise.all([
      store.getPilots(),
      store.getDeals(),
    ]);

    return <PilotsDashboard initialPilots={pilots} deals={deals} />;
  } catch (err: any) {
    console.error("[PilotosPage] Error cargando pilotos:", err);
    return <RevenueErrorState error={err?.message || "Error al conectar con la base de datos"} route="/pilotos" />;
  }
}
