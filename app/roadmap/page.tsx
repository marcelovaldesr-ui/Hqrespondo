import { unstable_noStore as noStore } from "next/cache";
import { db } from "@/lib/db";
import type { RoadmapItem } from "@/lib/types";
import PageHeader from "@/components/PageHeader";
import RoadmapBoard from "@/components/RoadmapBoard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RoadmapPage() {
  noStore();

  const { data, error } = await db()
    .from("roadmap_items")
    .select("*")
    .order("fecha_limite", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Roadmap" sub="Operación interna" />
      <RoadmapBoard initialItems={(data ?? []) as RoadmapItem[]} />
    </div>
  );
}
