import { unstable_noStore as noStore } from "next/cache";
import { db } from "@/lib/db";
import type { Gasto } from "@/lib/types";
import PageHeader from "@/components/PageHeader";
import Finanzas from "@/components/Finanzas";

export const dynamic = "force-dynamic";

export default async function FinanzasPage() {
  noStore();
  const { data, error } = await db()
    .from("gastos")
    .select("*")
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw new Error(error.message);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Finanzas" sub="Cobros y gastos" />
      <Finanzas gastosIniciales={(data ?? []) as Gasto[]} />
    </div>
  );
}
