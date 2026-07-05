import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { searchPlaces } from "@/lib/places";
import { scoreProspects } from "@/lib/scoring";
import { ESTADO_CONFIG } from "@/lib/types";

/**
 * POST /api/search  { rubro, comuna }
 * Busca en Places API → dedupe contra prospects → scoring Gemini → inserta.
 */
export async function POST(req: Request) {
  try {
    const { rubro, comuna } = await req.json();
    if (!rubro || !comuna) {
      return NextResponse.json(
        { error: "rubro y comuna son obligatorios" },
        { status: 400 },
      );
    }

    const places = await searchPlaces(String(rubro).trim(), String(comuna).trim());
    if (places.length === 0) {
      return NextResponse.json({ nuevos: 0, duplicados: 0 });
    }

    const s = db();
    const { data: existing, error: exErr } = await s
      .from("prospects")
      .select("place_id,telefono");
    if (exErr) throw new Error(exErr.message);

    const conocidos = new Set<string>();
    for (const e of existing ?? []) {
      if (e.place_id) conocidos.add(e.place_id);
      if (e.telefono) conocidos.add(e.telefono);
    }

    const nuevos = places.filter(
      (p) =>
        !conocidos.has(p.place_id) &&
        !(p.telefono && conocidos.has(p.telefono)),
    );

    if (nuevos.length === 0) {
      return NextResponse.json({ nuevos: 0, duplicados: places.length });
    }

    const scored = await scoreProspects(nuevos, rubro, comuna);
    const rows = scored.map((p) => ({
      nombre: p.nombre,
      rubro,
      comuna,
      telefono: p.telefono,
      web: p.web,
      direccion: p.direccion,
      rating: p.rating,
      reviews: p.reviews,
      score: p.score,
      razon_score: p.razon_score,
      mensaje: p.mensaje,
      estado: ESTADO_CONFIG.nuevo.value,
      place_id: p.place_id,
    }));

    const { error } = await s.from("prospects").insert(rows);
    if (error) throw new Error(error.message);

    return NextResponse.json({
      nuevos: rows.length,
      duplicados: places.length - rows.length,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
