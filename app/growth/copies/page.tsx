import PageHeader from "@/components/PageHeader";
import GrowthNav from "@/components/growth/GrowthNav";
import CopiesClient from "@/components/growth/CopiesClient";
import { COPIES } from "@/lib/growth/copies";

export const dynamic = "force-dynamic";

export default function CopiesPage({ searchParams }: { searchParams: { tipo?: string } }) {
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Biblioteca de copies" sub="Piezas reutilizables listas para copiar" />
      <GrowthNav />
      <CopiesClient initial={COPIES} tipoInicial={searchParams.tipo ?? ""} />
    </div>
  );
}
