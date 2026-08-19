import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * POST /api/prospects/llamada — registra el RESULTADO de una llamada.
 *
 * body: {
 *   id: string,                 // prospecto llamado
 *   ids_grupo?: string[],       // sucursales agrupadas (se marcan todas)
 *   resultado: "no_contesto" | "recado" | "numero_malo"
 *            | "interesado" | "seguimiento" | "no_interesa",
 *   dueno?: string,             // nombre del dueño si se consiguió
 *   contacto?: string,          // celular o correo directo si se consiguió
 *   nota?: string
 * }
 *
 * Efectos:
 *  - Siempre: intentos_llamada+1, ultimo_intento_llamada=now, línea en notas.
 *  - no_contesto / recado → sigue 'nuevo' (vuelve a la lista MAÑANA).
 *  - numero_malo / no_interesa → 'descartado'.
 *  - interesado → 'respondio' (queda arriba en Prospección para agendar).
 *  - seguimiento → 'contactado' + proxima_accion en 2 días.
 *  - dueno/contacto → se guardan en contacto_nombre / contacto_celular|email.
 */

const RESULTADOS = {
  no_contesto: { estado: null, etiqueta: "no contestó" },
  recado: { estado: null, etiqueta: "dejé recado" },
  numero_malo: { estado: "descartado", etiqueta: "número malo" },
  interesado: { estado: "respondio", etiqueta: "CONTESTÓ — interesado" },
  seguimiento: { estado: "contactado", etiqueta: "contestó — pidió seguimiento" },
  no_interesa: { estado: "descartado", etiqueta: "contestó — no le interesa" },
} as const;

type Resultado = keyof typeof RESULTADOS;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const id = String(body.id ?? "");
    const resultado = String(body.resultado ?? "") as Resultado;
    if (!id || !(resultado in RESULTADOS)) {
      return NextResponse.json({ error: "id o resultado inválido" }, { status: 400 });
    }
    const ids: string[] = Array.isArray(body.ids_grupo) && body.ids_grupo.length
      ? body.ids_grupo.map(String)
      : [id];

    const s = db();
    const { data: filas, error } = await s
      .from("prospects")
      .select("id,notas,intentos_llamada")
      .in("id", ids);
    if (error) throw new Error(error.message);

    const cfg = RESULTADOS[resultado];
    const ahora = new Date();
    const fecha = ahora.toLocaleDateString("es-CL", {
      day: "2-digit", month: "short", timeZone: "America/Santiago",
    });
    const hora = ahora.toLocaleTimeString("es-CL", {
      hour: "2-digit", minute: "2-digit", timeZone: "America/Santiago",
    });

    const dueno = String(body.dueno ?? "").trim();
    const contacto = String(body.contacto ?? "").trim();
    const nota = String(body.nota ?? "").trim();

    const linea =
      `[${fecha} ${hora} · llamada] ${cfg.etiqueta}` +
      (dueno ? ` · dueño: ${dueno}` : "") +
      (contacto ? ` · contacto: ${contacto}` : "") +
      (nota ? ` · ${nota}` : "");

    for (const p of filas ?? []) {
      const update: Record<string, unknown> = {
        intentos_llamada: (p.intentos_llamada ?? 0) + 1,
        ultimo_intento_llamada: ahora.toISOString(),
        notas: p.notas ? `${p.notas}\n${linea}` : linea,
        updated_at: ahora.toISOString(),
      };
      if (cfg.estado) update.estado = cfg.estado;
      if (resultado === "seguimiento") {
        const en2d = new Date(ahora.getTime() + 2 * 86400_000);
        update.proxima_accion = en2d.toISOString().slice(0, 10);
      }
      if (dueno) update.contacto_nombre = dueno;
      if (contacto) {
        if (contacto.includes("@")) update.contacto_email = contacto.toLowerCase();
        else update.contacto_celular = contacto;
      }
      const { error: upErr } = await s.from("prospects").update(update).eq("id", p.id);
      if (upErr) throw new Error(upErr.message);
    }

    return NextResponse.json({ ok: true, actualizados: filas?.length ?? 0 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
