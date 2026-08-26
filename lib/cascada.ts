/**
 * LA CASCADA REAL — Fase 2.
 *
 * Reemplaza a `enriquecerSimulado`. Recibe una fila de la cola y le pregunta a
 * los proveedores, del más barato al más caro, hasta encontrar el teléfono
 * DIRECTO del decisor. Se detiene en el primero que responde.
 *
 * El orden no es una opinión: sale de las tasas de acierto medidas sobre esta
 * misma base.
 *
 *   1. web     — el sitio del negocio, buscando un teléfono pegado al nombre
 *                del decisor. Gratis, 53% de acierto cuando hay sitio.
 *   2. places  — la ficha PROPIA de la persona en Google Maps (un dentista con
 *                consulta particular suele tenerla, separada de la clínica).
 *                Cuesta cupo: 1.000 gratis al mes y después USD 35 por mil.
 *   3. gemini  — búsqueda pública con IA, obligada a citar la página. Sin cita
 *                el resultado se descarta.
 *
 * Por qué Apollo y Lusha NO están acá: los dos parten de una URL de LinkedIn, y
 * `empresas_sii` no tiene ninguna. Medido en la sesión anterior: bajo 12
 * trabajadores, LinkedIn devuelve 0 de 12. Estas 500 empresas están casi todas
 * en esa banda. Apollo y Lusha entran en la cascada del objetivo `linkedin`,
 * cuando exista un perfil que consultar — gastarlos acá sería quemar créditos
 * para recibir "no lo tengo".
 *
 * Tres cosas que esta cascada respeta y que son la razón de ser de la Fase 1:
 *   · el libro mayor — a un proveedor que ya dio respuesta DEFINITIVA sobre
 *     esta empresa no se le vuelve a preguntar;
 *   · el cortacircuitos — un proveedor sin cupo o caído se salta;
 *   · nunca pisa `telefono` (la línea pública). El hallazgo va a
 *     `telefono_directo`, que es otro dato.
 */

import { db } from "@/lib/db";
import { normalizarTelefono } from "@/lib/actividades";
import { type HallazgoTelefono } from "@/lib/agenteTelefono";
import { buscarPorPasos, type ModoCascada } from "@/lib/pasosTelefono";
import { decisorBuscable } from "@/lib/decisorBuscable";
import { promoverAFoco } from "@/lib/promoverDecisor";
import {
  proveedoresYaConsultados,
  type Enriquecedor,
  type ItemCola,
  type SalidaEnriquecimiento,
} from "@/lib/cola";

/**
 * `seco` corre SOLO los pasos gratis (la web). No toca Places ni Gemini, así
 * que no puede gastar un peso ni un crédito. Es el modo para mirar resultados
 * reales antes de soltar la cascada completa.
 */
/** Se reexporta desde donde ahora vive, para no romper a quien ya lo importaba. */
export type { ModoCascada };

type EmpresaFila = {
  rut: string;
  razon_social: string | null;
  comuna: string | null;
  telefono: string | null;
  telefono_directo: string | null;
  decisor_nombre: string | null;
  decisor_confianza: string | null;
  decisor_nombre_completo: string | null;
  prospect_id: string | null;
  n_trabajadores: number | null;
};

// ---------------------------------------------------------------------------
// Leer el sitio del negocio
// ---------------------------------------------------------------------------

/**
 * `empresas_sii` no guarda la web: el padrón del SII no la trae. Cuando la
 * empresa está enlazada a un prospect, ahí sí está —y de paso el teléfono
 * público, que sirve para saber cuál NO es el hallazgo.
 */
async function contextoDelProspect(
  e: EmpresaFila,
): Promise<{ web: string | null; telefono: string | null }> {
  if (!e.prospect_id) return { web: null, telefono: null };
  const { data } = await db()
    .from("prospects")
    .select("web,telefono")
    .eq("id", e.prospect_id)
    .maybeSingle();
  const p = data as { web: string | null; telefono: string | null } | null;
  return { web: p?.web ?? null, telefono: p?.telefono ?? null };
}

// ---------------------------------------------------------------------------
// Guardar el hallazgo
// ---------------------------------------------------------------------------

/**
 * Qué pasó al intentar guardar. Los tres casos son distintos y NO se pueden
 * confundir, porque cada uno se anota diferente en el libro mayor:
 *
 *   guardado   → el proveedor acertó ('exito', definitivo).
 *   descartado → el proveedor contestó, pero era el número que ya teníamos
 *                ('sin_dato', también definitivo: preguntarle de nuevo daría
 *                 lo mismo).
 *   error      → la base falló. Esto NO es una respuesta del proveedor, así
 *                que se anota como 'error' y se vuelve a intentar. Tratarlo
 *                como 'sin_dato' marcaría al proveedor como ya consultado por
 *                una caída pasajera de Supabase, y esa empresa perdería para
 *                siempre su mejor fuente.
 */
type Guardado = "guardado" | "descartado" | "error";

/**
 * Escribe el teléfono directo. Tres candados:
 *   · `.is("telefono_directo", null)` — nunca pisa un hallazgo anterior.
 *   · nunca guarda el mismo número que ya publicaba el negocio. Los ayudantes
 *     de `agenteTelefono` ya filtran eso, pero este dato termina en una lista
 *     de llamadas y un falso "directo" hace perder una llamada de verdad.
 *   · `.select()` para contar filas afectadas: si otra corrida se adelantó, el
 *     update no toca nada y hay que saberlo en vez de cantar victoria.
 */
async function guardarHallazgo(
  e: EmpresaFila,
  h: HallazgoTelefono,
  publico: string | null,
): Promise<Guardado> {
  const nuevo = normalizarTelefono(h.telefono);
  if (nuevo.length < 8) return "descartado";
  for (const conocido of [e.telefono, publico]) {
    if (conocido && normalizarTelefono(conocido) === nuevo) return "descartado";
  }
  // Sin número público NO se puede descartar que el hallazgo sea la misma
  // línea del mesón: `clasificar()` compara contra el conocido, y si no hay
  // conocido, cualquier número pasa como "directo". Medido el 25-ago-2026:
  // 363 de las 500 empresas en cola no tienen teléfono público guardado. Eso
  // queda escrito en el origen para que quien llame lo sepa antes de marcar.
  const control = (e.telefono ?? publico)
    ? ""
    : " · SIN CONTROL: no había número público con qué compararlo, puede ser la recepción";

  // Un FIJO encontrado en la ficha de un profesional es, casi siempre, la
  // línea de su consulta — y esa la contesta la recepcionista igual que
  // cualquier otra. Caso real (25-ago-2026): el público de la Clínica Bellolio
  // era un celular y el "directo" que hallamos, un fijo. Llamarlo `directo` a
  // secas promete más de lo que sabemos. Lo único que resuelve de quién es un
  // número es la llamada, y para eso está el campo "¿quién contestó?".
  const matiz = /^9\d{8}$/.test(nuevo)
    ? ""
    : " · es un FIJO: probablemente la línea de su consulta, confirmar al llamar quién contesta";

  // El nombre completo que regala la fuente vale por sí solo, aunque el
  // teléfono termine descartándose: sirve para pedir por la persona correcta.
  const nombreCompleto =
    h.nombreEnLaFuente && !e.decisor_nombre_completo
      ? { decisor_nombre_completo: h.nombreEnLaFuente, decisor_nombre_completo_origen: h.fuente }
      : {};

  const { data, error } = await db()
    .from("empresas_sii")
    .update({
      telefono_directo: h.telefono,
      telefono_directo_origen: `${h.fuente} · ${h.tipo} · confianza ${h.confianza}${matiz}${control}`,
      ...nombreCompleto,
      updated_at: new Date().toISOString(),
    })
    .eq("rut", e.rut)
    .is("telefono_directo", null)
    .select("rut");
  if (error) {
    console.error(`[cascada] no se pudo guardar el teléfono de ${e.rut}:`, error.message);
    return "error";
  }
  // 0 filas = otra corrida ya le puso un teléfono directo. No es un error, pero
  // tampoco es un acierto de esta corrida.
  if ((data?.length ?? 0) === 0) return "descartado";

  // Y acá se cierra el circuito. Guardar el número en una columna no sirve de
  // nada si nadie lo puede marcar: hasta el 25-ago-2026 `telefono_directo` no
  // aparecía en ninguna pantalla de HQ. Promoverlo a Leads Foco lo pone en una
  // cola de llamadas de verdad, con su procedencia a la vista, y hace que la
  // respuesta de "¿quién contestó?" vuelva a esta misma empresa.
  //
  // Si la promoción falla NO se pierde el hallazgo: el teléfono ya quedó
  // guardado, y /api/cola/promover lo alcanza después.
  try {
    const p = await promoverAFoco(e.rut);
    console.log(`[cascada] ${e.rut} → cola de llamadas: ${p.estado}`);
  } catch (err) {
    console.error(`[cascada] no se pudo promover ${e.rut} a Foco:`, err);
  }
  return "guardado";
}

// ---------------------------------------------------------------------------
// La cascada
// ---------------------------------------------------------------------------

export function cascadaTelefonoDirecto(opts: {
  /** Proveedores que el cortacircuitos declara usables en esta corrida. */
  vivos: Set<string>;
  modo: ModoCascada;
}): Enriquecedor {
  const { vivos, modo } = opts;

  return async function enriquecer(item: ItemCola): Promise<SalidaEnriquecimiento> {
    if (item.entidad !== "empresa_sii" || item.objetivo !== "telefono_directo") {
      // Todavía no hay cascada escrita para esta combinación. Se marca como
      // error (reintentable) y no como 'sin_dato', que sería definitivo.
      return {
        encontrado: false,
        intentos: [{
          proveedor: "cascada",
          resultado: "error",
          encontrado: false,
          error_detalle: `sin cascada para ${item.entidad}/${item.objetivo}`,
        }],
      };
    }

    // ---- 0. la empresa ----
    const { data, error } = await db()
      .from("empresas_sii")
      .select("rut,razon_social,comuna,telefono,telefono_directo,decisor_nombre,decisor_confianza,decisor_nombre_completo,prospect_id,n_trabajadores")
      .eq("rut", item.entidad_id)
      .maybeSingle();
    if (error) throw new Error(`leer empresas_sii ${item.entidad_id}: ${error.message}`);
    const e = data as EmpresaFila | null;
    if (!e) {
      return {
        encontrado: false,
        intentos: [{
          proveedor: "cascada", resultado: "sin_dato", encontrado: false,
          error_detalle: "el RUT ya no está en empresas_sii",
        }],
      };
    }

    // Ya lo tiene (otra corrida lo encontró). No se gasta nada.
    if (e.telefono_directo) {
      return {
        encontrado: true,
        datos: { telefono_directo: e.telefono_directo, nota: "ya estaba guardado" },
        intentos: [],
      };
    }

    // Sin nombre de decisor no hay a quién buscar. Es definitivo mientras no
    // aparezca el nombre: si aparece, se vuelve a encolar y se pregunta de nuevo.
    if (!e.decisor_nombre || !e.comuna) {
      return {
        encontrado: false,
        intentos: [{
          proveedor: "sin_decisor", resultado: "sin_dato", encontrado: false,
          respuesta: { motivo: !e.decisor_nombre ? "sin decisor_nombre" : "sin comuna" },
        }],
      };
    }

    // ---- 0-bis. ¿este decisor se puede buscar? ----
    // Va ANTES de cualquier proveedor, y esa posición es todo el punto: un
    // decisor falso cuesta una búsqueda de Gemini y una de Places, y si por
    // mala suerte alguna "encuentra" algo, ensucia la lista de llamadas con un
    // número que alguien va a marcar. Ver lib/decisorBuscable.ts para los
    // cuatro modos de falla que esto ataja y la medición que los encontró.
    const veredicto = decisorBuscable(e.razon_social, e.decisor_nombre, e.decisor_confianza);
    if (!veredicto.buscable) {
      console.log(`[cascada] ${e.rut} SALTADA · ${e.decisor_nombre} · ${veredicto.motivo}`);
      return {
        encontrado: false,
        intentos: [{
          proveedor: "decisor_no_buscable",
          resultado: "sin_dato",
          encontrado: false,
          respuesta: { decisor: e.decisor_nombre, razon_social: e.razon_social, motivo: veredicto.motivo },
        }],
      };
    }

    const persona = e.decisor_nombre;
    const empresa = e.razon_social ?? "";
    const comuna = e.comuna;
    const ya = await proveedoresYaConsultados(item);

    const ctx = await contextoDelProspect(e);
    const publico = e.telefono ?? ctx.telefono;

    return buscarPorPasos(
      {
        etiqueta: e.rut,
        persona,
        empresa,
        comuna,
        publico,
        web: ctx.web,
      },
      { vivos, modo, ya },
      (h) => guardarHallazgo(e, h, publico),
    );
  };
}
