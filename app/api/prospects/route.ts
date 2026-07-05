import { unstable_noStore as noStore } from "next/cache";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { Prospect } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET() {
  try {
    noStore();

    const { data, error } = await db()
      .from("prospects")
      .select("*")
      .order("score", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    return NextResponse.json(
      { prospects: (data ?? []) as Prospect[] },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
