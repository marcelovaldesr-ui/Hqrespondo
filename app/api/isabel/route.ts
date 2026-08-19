import { NextResponse } from "next/server";
import { responderIsabel, type MensajeIsabel } from "@/lib/isabel";

export const maxDuration = 60;

/**
 * /api/isabel — un solo POST: la conversación entra, la respuesta sale.
 * Sin estado en el servidor a propósito: la historia vive en el navegador de
 * cada uno (Isabel es una colega de trabajo, no un registro legal), y así no
 * hay tabla nueva, ni migración, ni conversaciones de socios mezcladas.
 */
export async function POST(req: Request) {
  try {
    const b = await req.json();
    const historia = (Array.isArray(b.mensajes) ? b.mensajes : []) as MensajeIsabel[];
    const valida = historia.every(
      (m) => (m?.de === "yo" || m?.de === "isabel") && typeof m?.texto === "string",
    );
    if (!historia.length || !valida) {
      return NextResponse.json({ error: "mensajes inválidos" }, { status: 400 });
    }
    if (historia[historia.length - 1].de !== "yo") {
      return NextResponse.json({ error: "el último mensaje debe ser tuyo" }, { status: 400 });
    }
    const texto = await responderIsabel(historia, typeof b.actor === "string" ? b.actor : undefined);
    return NextResponse.json({ texto });
  } catch (e: any) {
    console.error("[isabel]", e?.message ?? e);
    return NextResponse.json(
      { error: "Isabel no pudo responder (¿modelo saturado?). Intenta de nuevo en unos segundos." },
      { status: 502 },
    );
  }
}
