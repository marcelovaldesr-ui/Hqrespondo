import { getRevenueStore } from "@/lib/revenue/store";
import PipelineV2 from "@/components/PipelineV2";
import RevenueErrorState from "@/components/RevenueErrorState";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  try {
    const store = getRevenueStore();
    const deals = await store.getDeals();

    return <PipelineV2 initialDeals={deals} />;
  } catch (err: any) {
    console.error("[PipelinePage] Error cargando deals:", err);
    return <RevenueErrorState error={err?.message || "Error al conectar con la base de datos"} route="/pipeline" />;
  }
}
