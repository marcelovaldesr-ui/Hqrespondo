import { NextResponse } from "next/server";
import { verificarUsuarioHq } from "@/lib/outbound/auth";
import { getOutboundStore } from "@/lib/outbound/runtimeStore";

export const dynamic = "force-dynamic";

/**
 * POST /api/outbound/review
 * Gestión de revisión humana de borradores (Review Mode):
 * - approve: Aprueba el ítem y lo pasa a 'approved' para ser programado.
 * - reject: Cancela el ítem.
 * - edit: Modifica asunto y cuerpo y lo aprueba.
 * - approve_batch: Aprueba un arreglo de IDs.
 */
export async function POST(req: Request) {
  const approvedBy = verificarUsuarioHq(req);
  if (!approvedBy) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const action = body.action as "approve" | "reject" | "edit" | "approve_batch";
    const store = getOutboundStore();

    if (action === "approve_batch") {
      const ids: string[] = body.outboxIds ?? [];
      let aprobados = 0;
      for (const id of ids) {
        const item = await store.getOutboxItemById(id);
        if (item && item.estado === "pending_review") {
          await store.approveOutboxItem(id, approvedBy);
          await store.logEvent({
            outbox_id: id,
            contact_id: item.contact_id,
            tipo: "review_approved",
            metadata: { accion: "aprobado_en_lote", approved_by: approvedBy },
          });
          aprobados++;
        }
      }
      return NextResponse.json({ ok: true, aprobados });
    }

    const outboxId = body.outboxId;
    if (!outboxId) {
      return NextResponse.json({ error: "Falta outboxId" }, { status: 400 });
    }

    const item = await store.getOutboxItemById(outboxId);
    if (!item) {
      return NextResponse.json({ error: "Ítem outbox no encontrado" }, { status: 404 });
    }

    if (action === "approve") {
      await store.approveOutboxItem(outboxId, approvedBy);
      await store.logEvent({
        outbox_id: outboxId,
        contact_id: item.contact_id,
        tipo: "review_approved",
        metadata: { accion: "aprobado_sin_cambios", approved_by: approvedBy },
      });
      return NextResponse.json({ ok: true, estado: "approved" });
    }

    if (action === "reject") {
      await store.updateOutboxItem(outboxId, {
        estado: "cancelled",
        error_message: body.motivo || "Rechazado por revisión humana",
      });
      return NextResponse.json({ ok: true, estado: "cancelled" });
    }

    if (action === "edit") {
      const updates: Record<string, unknown> = {};
      if (body.subject) updates.subject = body.subject;
      if (body.body_text) updates.body_text = body.body_text;

      if (Object.keys(updates).length > 0) {
        await store.updateOutboxItem(outboxId, updates);
      }
      await store.approveOutboxItem(outboxId, approvedBy);
      await store.logEvent({
        outbox_id: outboxId,
        contact_id: item.contact_id,
        tipo: "review_approved",
        metadata: { accion: "editado_y_aprobado", approved_by: approvedBy },
      });
      return NextResponse.json({ ok: true, estado: "approved" });
    }

    return NextResponse.json({ error: "Acción no soportada" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
