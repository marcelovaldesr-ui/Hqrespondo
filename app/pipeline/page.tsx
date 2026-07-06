import { db } from "@/lib/db";
import type { Deal } from "@/lib/types";
import PageHeader from "@/components/PageHeader";
import Kanban from "@/components/Kanban";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const { data } = await db()
    .from("deals")
    .select("*")
    .order("created_at", { ascending: true });

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Pipeline" sub="Ventas" />
      <Kanban deals={(data ?? []) as Deal[]} />
    </div>
  );
}
