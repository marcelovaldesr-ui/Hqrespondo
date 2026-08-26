/**
 * La cascada de teléfono, apuntada a los leads de Foco.
 *
 * POR QUÉ EXISTE
 * Medido el 26-ago-2026 sobre la base real: de 41 leads activos, **28 tienen el
 * nombre del que decide y ningún teléfono**. Marcelo estaba por borrarlos como
 * "inútiles sin número" — y son justo lo contrario. El nombre del decisor es el
 * dato caro, el que costó semanas sacar del padrón del SII; el teléfono es lo
 * que esta cascada sabe buscar.
 *
 * Estaban quietos porque el worker de teléfonos solo miraba `empresas_sii`.
 * Nadie los procesaba, y eso se leía como "no sirven".
 *
 * Comparte las tres pasadas con la cascada del SII (`lib/pasosTelefono.ts`).
 * Lo único propio es de dónde se leen los datos y dónde se guarda el hallazgo.
 */

import { db } from "@/lib/db";
import { normalizarTelefono } from "@/lib/actividades";
import { buscarPorPasos, type Guardado, type ModoCascada } from "@/lib/pasosTelefono";
import type { HallazgoTelefono } from "@/lib/agenteTelefono";
import {
  proveedoresYaConsultados,
  type Enriquecedor,
  type ItemCola,
  type SalidaEnriquecimiento,
} from "@/lib/cola";

type LeadFila = {
  id: string;
  empresa: string | null;
  razon_social: string | null;
  contacto: string | null;
  comuna: string | null;
  telefono: string | null;
  web: string | null;
  telefonos: Array<{ valor: string; tipo: string; fuente: string }> | null;
  estado: string | null;
};

export function cascadaLeadFoco(opts: { vivos: Set<string>; modo: ModoCascada }): Enriquecedor {
  const { vivos, modo } = opts;

  return async function enriquecer(item: ItemCola): Promise<SalidaEnriquecimiento> {
    if (item.entidad !== "lead_foco" || item.objetivo !== "telefono_directo") {
      return {
        encontrado: false,
        intentos: [{
          proveedor: "cascada", resultado: "error", encontrado: false,
          error_detalle: `esta cascada no atiende ${item.entidad}/${item.objetivo}`,
        }],
      };
    }

    const { data, error } = await db()
      .from("leads_foco")
      .select("id,empresa,razon_social,contacto,comuna,telefono,web,telefonos,estado")
      .eq("id", item.entidad_id)
      .maybeSingle();
    if (error) throw new Error(`leer leads_foco ${item.entidad_id}: ${error.message}`);
    const l = data as LeadFila | null;

    const sinDato = (motivo: string): SalidaEnriquecimiento => ({
      encontrado: false,
      intentos: [{
        proveedor: "cascada", resultado: "sin_dato", encontrado: false, respuesta: { motivo },
      }],
    });

    if (!l) return sinDato("el lead ya no existe");
    if (l.estado && !["nuevo", "contactando"].includes(l.estado)) {
      return sinDato(`lead en estado ${l.estado}: ya no se trabaja`);
    }
    if (!l.contacto?.trim()) return sinDato("el lead no tiene nombre de persona a quien buscar");
    if (!l.comuna?.trim()) return sinDato("el lead no tiene comuna: sin ella no se puede distinguir de un homónimo");

    // Ya tiene número: no se gasta nada. La cola de llamadas es su lugar, no ésta.
    if (l.telefono?.trim()) {
      return {
        encontrado: true,
        datos: { telefono: l.telefono, nota: "ya tenía número" },
        intentos: [],
      };
    }

    const guardar = async (h: HallazgoTelefono): Promise<Guardado> => {
      const nuevo = normalizarTelefono(h.telefono);
      if (nuevo.length < 8) return "descartado";

      const previos = Array.isArray(l.telefonos) ? l.telefonos : [];
      if (previos.some((t) => normalizarTelefono(t?.valor ?? "") === nuevo)) return "descartado";

      const { data: ok, error: e2 } = await db()
        .from("leads_foco")
        .update({
          telefono: h.telefono,
          telefonos: [
            ...previos,
            { valor: h.telefono, tipo: h.tipo === "movil_personal" ? "movil" : "otro", fuente: "cascada" },
          ].slice(0, 8),
          // De quién es el número solo lo resuelve la llamada. Acá se guarda lo
          // único que se sabe: de dónde salió y con qué confianza.
          senal: `Teléfono hallado por la cascada: ${h.fuente} · confianza ${h.confianza}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", l.id)
        .eq("telefono", "") // no pisar si otra corrida se adelantó
        .select("id");
      if (e2) {
        console.error(`[cascada-foco] no se pudo guardar en ${l.id}:`, e2.message);
        return "error";
      }
      return (ok?.length ?? 0) > 0 ? "guardado" : "descartado";
    };

    return buscarPorPasos(
      {
        etiqueta: l.id.slice(0, 8),
        persona: l.contacto.trim(),
        empresa: (l.empresa || l.razon_social || "").trim(),
        comuna: l.comuna.trim(),
        publico: null, // por definición: si tuviera número, no estaría acá
        web: l.web?.trim() || null,
      },
      { vivos, modo, ya: await proveedoresYaConsultados(item) },
      guardar,
    );
  };
}
