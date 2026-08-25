/**
 * El detector de señales, conectado a la cola de la Fase 1.
 *
 * Reusa toda la maquinaria que ya existe —lotes con SKIP LOCKED, libro mayor,
 * cortacircuitos, reintentos con espera— en vez de armar un camino paralelo.
 * Lo único distinto es el objetivo: `senal` en vez de `telefono_directo`.
 *
 * Corre sobre `leads_foco` y no sobre las 7.312 del SII, y esa decisión es
 * deliberada: una señal solo vale si alguien puede llamar mañana. Detectar que
 * una empresa está contratando recepcionista, cuando no tenemos su teléfono ni
 * el nombre de nadie, es información que no se puede usar.
 */

import { db } from "@/lib/db";
import { buscarSenalContratacion, guardarSenal } from "@/lib/senales";
import type { Enriquecedor, ItemCola, SalidaEnriquecimiento } from "@/lib/cola";

type LeadMinimo = {
  id: string;
  empresa: string | null;
  comuna: string | null;
  industria: string | null;
  estado: string | null;
};

export function detectorDeSenales(opts: { vivos: Set<string> }): Enriquecedor {
  const { vivos } = opts;

  return async function enriquecer(item: ItemCola): Promise<SalidaEnriquecimiento> {
    if (item.entidad !== "lead_foco" || item.objetivo !== "senal") {
      return {
        encontrado: false,
        intentos: [{
          proveedor: "cascada", resultado: "error", encontrado: false,
          error_detalle: `el detector de señales no atiende ${item.entidad}/${item.objetivo}`,
        }],
      };
    }

    if (!vivos.has("gemini")) {
      // Sin el buscador no hay nada que hacer. Se marca como error —no como
      // 'sin_dato'— para que se reintente cuando el proveedor vuelva, en vez de
      // quedar anotado para siempre como "ya se preguntó".
      return {
        encontrado: false,
        intentos: [{
          proveedor: "gemini", resultado: "sin_cupo", encontrado: false,
          error_detalle: "el cortacircuitos tiene a gemini cortado o sin cupo",
        }],
      };
    }

    const { data, error } = await db()
      .from("leads_foco")
      .select("id,empresa,comuna,industria,estado")
      .eq("id", item.entidad_id)
      .maybeSingle();
    if (error) throw new Error(`leer leads_foco ${item.entidad_id}: ${error.message}`);
    const lead = data as LeadMinimo | null;

    if (!lead) {
      return {
        encontrado: false,
        intentos: [{ proveedor: "cascada", resultado: "sin_dato", encontrado: false,
          respuesta: { motivo: "el lead ya no existe" } }],
      };
    }
    if (!lead.empresa) {
      return {
        encontrado: false,
        intentos: [{ proveedor: "cascada", resultado: "sin_dato", encontrado: false,
          respuesta: { motivo: "el lead no tiene nombre de empresa que buscar" } }],
      };
    }
    // Un lead cerrado no necesita señal: nadie lo va a llamar.
    if (lead.estado && !["nuevo", "contactando"].includes(lead.estado)) {
      return {
        encontrado: false,
        intentos: [{ proveedor: "cascada", resultado: "sin_dato", encontrado: false,
          respuesta: { motivo: `lead en estado ${lead.estado}: ya no se trabaja` } }],
      };
    }

    const t0 = Date.now();
    try {
      const r = await buscarSenalContratacion({
        empresa: lead.empresa,
        comuna: lead.comuna,
        industria: lead.industria,
      });
      const senal = r.senal;
      const ms = Date.now() - t0;

      if (!senal) {
        // El motivo va al libro mayor. Es lo que permite responder, con datos,
        // si el detector no encuentra nada porque no hay avisos o porque un
        // filtro está de más.
        console.log(`[senal] ${lead.empresa} → ${r.motivo}`);
        return {
          encontrado: false,
          intentos: [{
            proveedor: "gemini",
            resultado: r.motivo === "error en la busqueda" ? "error" : "sin_dato",
            encontrado: false, ms, costo_creditos: 1,
            error_detalle: r.motivo === "error en la busqueda" ? String(r.crudo?.error ?? "") : undefined,
            respuesta: {
              consulta: `${lead.empresa} · ${lead.comuna ?? ""}`,
              motivo: r.motivo,
              contesto_el_modelo: r.crudo,
            },
          }],
        };
      }

      const nueva = await guardarSenal(lead.id, senal);
      console.log(
        `[senal] ${lead.empresa} → ${senal.detalle} (${senal.confianza})${nueva ? "" : " · ya estaba"}`,
      );

      return {
        encontrado: true,
        datos: { ...senal, nueva },
        intentos: [{
          proveedor: "gemini", resultado: "exito", encontrado: true, ms,
          costo_creditos: 1, respuesta: senal,
        }],
      };
    } catch (e) {
      return {
        encontrado: false,
        intentos: [{
          proveedor: "gemini", resultado: "error", encontrado: false, ms: Date.now() - t0,
          error_detalle: e instanceof Error ? e.message : String(e),
        }],
      };
    }
  };
}
