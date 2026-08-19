import PageHeader from "@/components/PageHeader";
import GrowthNav from "@/components/growth/GrowthNav";
import CalendarClient from "@/components/growth/CalendarClient";
import { getCalendar } from "@/lib/growth/store";

export const dynamic = "force-dynamic";

export default async function CalendarioPage() {
  const { items, dbActiva } = await getCalendar();
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Calendario de contenido" sub="Growth Studio" />
      <GrowthNav />
      <CalendarClient initial={items} dbActiva={dbActiva} />
    </div>
  );
}
