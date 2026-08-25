import { NextResponse } from "next/server";
import { fichaDesdeElSitio } from "@/lib/leerWeb";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/foco/leer-web  { web: "clinicaaurora.cl" }
 *
 * Lee el sitio y propone los campos del lead. Lo llama el formulario de alta
 * manual cuando alguien pega una URL: en vez de escribir el rubro, la comuna y
 * el teléfono a mano, aparecen sugeridos y se corrigen si hace falta.
 *
 * No guarda nada. Todo lo que devuelve es una propuesta que la persona ve en
 * pantalla y aprueba al apretar "Agregar lead".
 *
 * Va detrás del Basic Auth de HQ como el resto del panel: lo usa una persona
 * logueada, no un cron.
 */
export async function POST(req: Request) {
  try {
    const b = await req.json();
    const web = String(b.web ?? "").trim();
    if (!web || !/[a-z0-9-]+\.[a-z]{2,}/i.test(web)) {
      return NextResponse.json({ error: "Eso no parece una dirección web." }, { status: 400 });
    }
    const r = await fichaDesdeElSitio(web);
    return NextResponse.json(r);
  } catch (e) {
    return NextResponse.json(
      { ok: false, ficha: {}, motivo: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
