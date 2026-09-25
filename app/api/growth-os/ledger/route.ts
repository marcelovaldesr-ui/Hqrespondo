import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { ensureBucket, storage, validateEntry } from "@/lib/growthOs/store";

export const dynamic = "force-dynamic";

/**
 * POST /api/growth-os/ledger — guarda UNA decisión del Owner (aprobar, pedir cambios, decisión,
 * material, pedido de pieza). Append-only. No publica nada ni toca Instagram: Claude la importa
 * con tools/hq_sync.py y la aplica con tools/apply_owner_decisions.py (mismo motor que el artefacto).
 */
export async function POST(req: Request) {
  try {
    const len = Number(req.headers.get("content-length") ?? "0");
    if (len > 20000) return NextResponse.json({ error: "tamaño inválido" }, { status: 400 });
    const entry = validateEntry(await req.json());
    const id = "hq-" + randomBytes(6).toString("hex");
    const user = (req.headers.get("x-hq-user") ?? "owner").slice(0, 20);
    const full = { ...entry, id, via: "ui-hq", by: user, received_at: new Date().toISOString() };
    await ensureBucket();
    const { error } = await storage().upload(`ledger/${full.received_at.replace(/[:.]/g, "-")}_${id}.json`, JSON.stringify(full), {
      contentType: "application/json",
      upsert: false,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true, entry: full });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "No se pudo guardar" }, { status: 400 });
  }
}
