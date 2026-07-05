import { NextResponse } from "next/server";
import { generarBrief } from "@/lib/brief";

export const maxDuration = 60;

/** POST /api/brief/generate — botón "Generar ahora" del panel */
export async function POST() {
  try {
    const contenido = await generarBrief();
    return NextResponse.json({ ok: true, contenido });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
