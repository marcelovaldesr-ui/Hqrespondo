import { unstable_noStore as noStore } from "next/cache";
import { db } from "@/lib/db";
import type { Decision } from "@/lib/types";
import PageHeader from "@/components/PageHeader";
import Decisiones from "@/components/Decisiones";

export const dynamic = "force-dynamic";

export default async function DecisionesPage() {
  noStore();
  const { data, error } = await db()
    .from("decisiones")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Decisiones" sub="Registro del equipo" />
      <Decisiones initial={(data ?? []) as Decision[]} />
    </div>
  );
}
