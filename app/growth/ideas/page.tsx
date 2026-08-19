import PageHeader from "@/components/PageHeader";
import GrowthNav from "@/components/growth/GrowthNav";
import IdeasClient from "@/components/growth/IdeasClient";
import { getIdeas } from "@/lib/growth/store";

export const dynamic = "force-dynamic";

export default async function IdeasPage({
  searchParams,
}: {
  searchParams: { pilar?: string; rubro?: string };
}) {
  const { ideas, dbActiva } = await getIdeas();
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Biblioteca de ideas" sub="Growth Studio" />
      <GrowthNav />
      <IdeasClient
        initial={ideas}
        dbActiva={dbActiva}
        filtroPilar={searchParams.pilar ?? ""}
        filtroRubro={searchParams.rubro ?? ""}
      />
    </div>
  );
}
