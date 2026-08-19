import PageHeader from "@/components/PageHeader";
import GrowthNav from "@/components/growth/GrowthNav";
import GeneratorClient from "@/components/growth/GeneratorClient";

export const dynamic = "force-dynamic";

export default function GeneradorPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Generador" sub="De la estrategia a la pieza publicable" />
      <GrowthNav />
      <GeneratorClient />
    </div>
  );
}
