import { getRevenueStore } from "@/lib/revenue/store";
import MeetingsModule from "@/components/MeetingsModule";
import RevenueErrorState from "@/components/RevenueErrorState";

export const dynamic = "force-dynamic";

export default async function ReunionesPage() {
  try {
    const store = getRevenueStore();
    const [meetings, deals] = await Promise.all([
      store.getMeetings(),
      store.getDeals(),
    ]);

    return <MeetingsModule initialMeetings={meetings} deals={deals} />;
  } catch (err: any) {
    console.error("[ReunionesPage] Error cargando datos:", err);
    return <RevenueErrorState error={err?.message || "Error al conectar con la base de datos"} route="/reuniones" />;
  }
}
