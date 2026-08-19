import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generarVariantes, type TipoMensaje } from "@/lib/prospeccionAI";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const TIPOS = ["primero", "follow1", "reactivacion"] as const;

/**
 * POST /api/prospects/:id/mensaje  { tipo: "primero"|"follow1"|"reactivacion" }
 * Genera 2 variantes del mensaje pedido para ese prospecto, con la voz de
 * fundador y el ancla de su rubro. Liviano: NO reprocesa Google Places.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const tipo = body?.tipo;
    if (!TIPOS.includes(tipo)) {
      return NextResponse.json(
        { error: "tipo debe ser 'primero', 'follow1' o 'reactivacion'" },
        { status: 400 },
      );
    }

    const { data, error } = await db()
      .from("prospects")
      .select("nombre,rubro,comuna,notas")
      .eq("id", params.id)
      .single();
    if (error) throw new Error(error.message);
    if (!data) {
      return NextResponse.json({ error: "Prospecto no encontrado" }, { status: 404 });
    }

    const variantes = await generarVariantes(tipo as TipoMensaje, {
      nombre: data.nombre,
      rubro: data.rubro,
      comuna: data.comuna,
      notas: data.notas,
    });

    return NextResponse.json({ variantes });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
