import { NextResponse } from "next/server";
import { aiCarrusel, aiGuion } from "@/lib/growth/aiGenerate";
import {
  generarCarrusel,
  generarGuion,
  type CarouselInput,
  type ScriptInput,
} from "@/lib/growth/generators";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * POST /api/growth/generate
 * Body: { tipo: "carrusel"|"guion", tema, pilar, rubro, objetivo, nivelVenta, nSlides?, duracion?, cta? }
 * Devuelve { item, fuente: "ia"|"plantilla", nota? }. NUNCA rompe: si la IA
 * (Gemini) falla o no hay GEMINI_API_KEY, cae a los generadores por plantilla.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const tipo = body?.tipo;
    const pilar = body?.pilar ?? "problema";
    const nivelVenta = body?.nivelVenta ?? "medio";
    const rubro = body?.rubro ?? null;
    const objetivo = body?.objetivo ?? undefined;
    const tema =
      (body?.tema && String(body.tema).trim()) || "Pierdes ventas por responder tarde";

    if (tipo === "carrusel") {
      const input: CarouselInput = {
        tema,
        pilar,
        rubro,
        objetivo,
        nivelVenta,
        nSlides: body?.nSlides,
        cta: body?.cta,
      };
      try {
        const item = await aiCarrusel(input);
        return NextResponse.json({ item, fuente: "ia" });
      } catch (e: any) {
        return NextResponse.json({
          item: generarCarrusel(input),
          fuente: "plantilla",
          nota: e?.message ?? String(e),
        });
      }
    }

    if (tipo === "guion") {
      const input: ScriptInput = {
        tema,
        pilar,
        rubro,
        objetivo,
        nivelVenta,
        duracion: body?.duracion,
      };
      try {
        const item = await aiGuion(input);
        return NextResponse.json({ item, fuente: "ia" });
      } catch (e: any) {
        return NextResponse.json({
          item: generarGuion(input),
          fuente: "plantilla",
          nota: e?.message ?? String(e),
        });
      }
    }

    return NextResponse.json(
      { error: "tipo debe ser 'carrusel' o 'guion'" },
      { status: 400 },
    );
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
