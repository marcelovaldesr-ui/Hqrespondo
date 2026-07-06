import { unstable_noStore as noStore } from "next/cache";
import { db } from "@/lib/db";
import type { Gasto } from "@/lib/types";
import PageHeader from "@/components/PageHeader";
import Finanzas from "@/components/Finanzas";

export const dynamic = "force-dynamic";

export default async function FinanzasPage() {
  noStore();
  const s = db();
  const [gastosRes, clientesRes] = await Promise.all([
    s
      .from("gastos")
      .select("*")
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(300),
    s.from("clients").select("mensualidad,activo"),
  ]);
  if (gastosRes.error) throw new Error(gastosRes.error.message);

  const activos = (
    (clientesRes.data ?? []) as { mensualidad: number; activo: boolean }[]
  ).filter((c) => c.activo);
  const mrrActual = activos.reduce((a, c) => a + (c.mensualidad || 0), 0);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Finanzas" sub="Control del negocio" />
      <Finanzas
        gastosIniciales={(gastosRes.data ?? []) as Gasto[]}
        mrrActual={mrrActual}
        clientesActivos={activos.length}
      />
    </div>
  );
}
