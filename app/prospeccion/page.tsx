import { unstable_noStore as noStore } from "next/cache";
import { db } from "@/lib/db";
import type { Prospect } from "@/lib/types";
import ProspectionClient from "@/components/ProspectionClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function ProspeccionPage() {
  noStore();

  const { data, error } = await db()
    .from("prospects")
    .select("*")
    .order("score", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const prospects = (data ?? []) as Prospect[];

  return <ProspectionClient initialProspects={prospects} />;
}
