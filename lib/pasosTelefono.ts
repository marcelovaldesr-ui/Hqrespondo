/**
 * Las tres pasadas que buscan el teléfono de una persona.
 *
 * Vive aparte porque el procedimiento es el mismo venga de donde venga el
 * sujeto: una empresa del padrón del SII o un lead cargado a mano en Foco. Lo
 * único que cambia es de dónde se leen los datos y dónde se guarda el hallazgo,
 * y eso lo pone cada llamador.
 *
 * El orden es el que se midió y no una opinión:
 *   1. web     — gratis. Busca un teléfono pegado al nombre en el sitio.
 *   2. places  — la ficha PROPIA de la persona en Maps. Gasta cupo (1.000/mes).
 *   3. gemini  — búsqueda pública obligada a citar. La más cara y la que más
 *                se equivoca, así que va última y solo si las otras fallaron.
 *
 * Se detiene en la primera que acierta.
 */

import { textoDeLaWeb } from "@/lib/leerWeb";
import {
  telefonoCercaDelNombre,
  telefonoPorMapsDeLaPersona,
  telefonoPorBusquedaPublica,
  type HallazgoTelefono,
} from "@/lib/agenteTelefono";
import type { SalidaEnriquecimiento } from "@/lib/cola";

export type ModoCascada = "real" | "seco";

/** A quién se busca, sin importar en qué tabla vive. */
export type Sujeto = {
  /** Para los logs: RUT, id, lo que identifique. */
  etiqueta: string;
  persona: string;
  empresa: string;
  comuna: string;
  /** El número que el negocio ya publica, para saber cuál NO es el hallazgo. */
  publico: string | null;
  web: string | null;
};

/** Qué pasó al intentar guardar. Cada caso se anota distinto en el libro mayor. */
export type Guardado = "guardado" | "descartado" | "error";

export async function buscarPorPasos(
  s: Sujeto,
  opts: {
    vivos: Set<string>;
    modo: ModoCascada;
    /** Proveedores que ya dieron respuesta definitiva sobre este sujeto. */
    ya: Set<string>;
  },
  guardar: (h: HallazgoTelefono) => Promise<Guardado>,
): Promise<SalidaEnriquecimiento> {
  const { vivos, modo, ya } = opts;
  const intentos: SalidaEnriquecimiento["intentos"] = [];
  const traza: string[] = [];

  /** Cierra la cascada con un hallazgo: lo guarda y arma la salida. */
  const conHallazgo = async (
    proveedor: string, h: HallazgoTelefono, ms: number,
  ): Promise<SalidaEnriquecimiento> => {
    const g = await guardar(h);
    const ok = g === "guardado";
    intentos.push({
      proveedor,
      resultado: g === "guardado" ? "exito" : g === "descartado" ? "sin_dato" : "error",
      encontrado: ok,
      ms,
      respuesta: { ...h, guardado: g },
      ...(g === "error" ? { error_detalle: "falló el guardado" } : {}),
    });
    traza.push(`${proveedor} → ${ok ? h.telefono : `${h.telefono} ${g}`}`);
    console.log(`[cascada] ${s.etiqueta} ${s.persona} · ${traza.join(" | ")}`);
    return {
      encontrado: ok,
      datos: ok ? { telefono_directo: h.telefono, tipo: h.tipo, fuente: h.fuente } : undefined,
      intentos,
    };
  };

  // ---- 1. web (gratis) ----
  if (!ya.has("web") && vivos.has("web")) {
    const t0 = Date.now();
    const texto = s.web ? await textoDeLaWeb(s.web) : null;
    if (texto) {
      const h = telefonoCercaDelNombre(texto, s.persona, s.publico);
      if (h) return conHallazgo("web", h, Date.now() - t0);
      intentos.push({
        proveedor: "web", resultado: "sin_dato", encontrado: false, ms: Date.now() - t0,
        respuesta: { url: s.web, largo_texto: texto.length },
      });
      traza.push("web → no hay teléfono junto a su nombre");
    } else {
      // Sin sitio que leer NO se anota nada: anotar 'sin_dato' sería decir "a la
      // web ya se le preguntó", y el día que aparezca el sitio la cascada se lo
      // saltaría para siempre.
      traza.push(s.web ? "web → no se pudo abrir" : "web → no hay sitio conocido");
    }
  }

  // ---- 2. Places: la ficha propia de la persona (gasta cupo) ----
  if (modo === "real" && !ya.has("places") && vivos.has("places")) {
    const t0 = Date.now();
    try {
      const h = await telefonoPorMapsDeLaPersona(s.persona, s.comuna, s.publico);
      if (h) return conHallazgo("places", h, Date.now() - t0);
      intentos.push({
        proveedor: "places", resultado: "sin_dato", encontrado: false, ms: Date.now() - t0,
        costo_creditos: 1,
        respuesta: { consulta: `${s.persona}, ${s.comuna}, Chile` },
      });
      traza.push("places → la persona no tiene ficha propia");
    } catch (err) {
      intentos.push({
        proveedor: "places", resultado: "error", encontrado: false, ms: Date.now() - t0,
        error_detalle: err instanceof Error ? err.message : String(err),
      });
      traza.push("places → error");
    }
  } else if (modo === "real" && !vivos.has("places")) {
    traza.push("places → saltado (sin cupo o cortado)");
  }

  // ---- 3. búsqueda pública con IA ----
  if (modo === "real" && !ya.has("gemini") && vivos.has("gemini")) {
    const t0 = Date.now();
    try {
      const h = await telefonoPorBusquedaPublica(s.persona, s.empresa, s.comuna, s.publico);
      if (h) return conHallazgo("gemini", h, Date.now() - t0);
      intentos.push({
        proveedor: "gemini", resultado: "sin_dato", encontrado: false, ms: Date.now() - t0,
        costo_creditos: 1,
        respuesta: { consulta: `${s.persona} · ${s.empresa} · ${s.comuna}` },
      });
      traza.push("gemini → nada citable");
    } catch (err) {
      intentos.push({
        proveedor: "gemini", resultado: "error", encontrado: false, ms: Date.now() - t0,
        error_detalle: err instanceof Error ? err.message : String(err),
      });
      traza.push("gemini → error");
    }
  }

  console.log(`[cascada] ${s.etiqueta} ${s.persona} · ${traza.join(" | ") || "nada que hacer"}`);
  return { encontrado: false, datos: { traza }, intentos };
}
