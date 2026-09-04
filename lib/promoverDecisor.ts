/**
 * Promover una empresa con teléfono directo a un lead de Leads Foco.
 *
 * Por qué acá y no una pantalla nueva: `leads_foco` ya modela exactamente esto
 * —una PERSONA con su número dentro de una empresa— y trae hecha la cola de
 * llamadas, las disposiciones cerradas, la bitácora, la supresión y la creación
 * del deal cuando se agenda. Construir una segunda pantalla de llamadas sería
 * duplicar todo eso y garantizar que las dos midan distinto.
 *
 * El hilo de vuelta es `empresas_sii.lead_foco_id`, que existe sin usarse desde
 * la migración 025. Con él, cuando alguien registra el resultado de la llamada,
 * el veredicto vuelve a la empresa de origen y por fin se puede responder la
 * pregunta que justifica toda la cascada: de los teléfonos que encontramos,
 * ¿cuántos eran de verdad del que decide?
 */

import { db } from "@/lib/db";
import { evaluarEncaje } from "@/lib/encaje";
import { insertarLead } from "@/lib/insertarLeads";
import { normalizarTelefono } from "@/lib/actividades";

/** La lista donde caen. Separada para poder medirla aparte del resto de Foco. */
export const LISTA_DECISORES = "decisores";

type EmpresaPromovible = {
  rut: string;
  razon_social: string | null;
  categoria: string | null;
  actividad_sii: string | null;
  comuna: string | null;
  region: string | null;
  n_trabajadores: number | null;
  telefono_directo: string | null;
  telefono_directo_origen: string | null;
  decisor_nombre: string | null;
  decisor_nombre_completo: string | null;
  decisor_cargo: string | null;
  lead_foco_id: string | null;
};

const CAMPOS =
  "rut,razon_social,categoria,actividad_sii,comuna,region,n_trabajadores," +
  "telefono_directo,telefono_directo_origen,decisor_nombre,decisor_nombre_completo," +
  "decisor_cargo,lead_foco_id";

export type ResultadoPromocion =
  | { estado: "promovido"; lead_id: string }
  | { estado: "ya_estaba"; lead_id: string }
  | { estado: "omitido"; motivo: string };

/**
 * Promueve UNA empresa. Idempotente: si ya tiene `lead_foco_id`, no hace nada.
 * Nunca lanza por un caso que simplemente no aplica — devuelve el motivo.
 */
export async function promoverAFoco(rut: string): Promise<ResultadoPromocion> {
  const s = db();

  const { data, error } = await s
    .from("empresas_sii")
    .select(CAMPOS)
    .eq("rut", rut)
    .maybeSingle();
  if (error) throw new Error(`leer empresas_sii ${rut}: ${error.message}`);
  const e = data as EmpresaPromovible | null;
  if (!e) return { estado: "omitido", motivo: "el RUT no está en empresas_sii" };
  if (e.lead_foco_id) return { estado: "ya_estaba", lead_id: e.lead_foco_id };
  if (!e.telefono_directo) return { estado: "omitido", motivo: "todavía no tiene teléfono directo" };

  // El nombre completo que regaló Maps gana: es con el que hay que preguntar
  // por la persona al llamar.
  const contacto = (e.decisor_nombre_completo || e.decisor_nombre || "").trim();
  if (!contacto) return { estado: "omitido", motivo: "sin nombre de decisor con quién preguntar" };

  const empresa = (e.razon_social || "").trim();
  if (!empresa) return { estado: "omitido", motivo: "sin razón social" };

  // Un número suprimido no entra a ninguna cola de llamadas, venga de donde
  // venga. La oposición del titular pesa más que un hallazgo nuestro.
  const tel = normalizarTelefono(e.telefono_directo);
  if (tel) {
    const { data: sup } = await s.from("supresiones").select("valor").eq("valor", tel).limit(1);
    if (sup?.length) return { estado: "omitido", motivo: "el número está en la lista de no contactar" };
  }

  const industria = (e.actividad_sii || e.categoria || "").trim();
  const encaje = evaluarEncaje({
    empresa,
    razon_social: empresa,
    industria,
    n_empleados: e.n_trabajadores ?? undefined,
  } as Parameters<typeof evaluarEncaje>[0]);

  const fila = {
    empresa,
    razon_social: empresa,
    rut: e.rut,
    contacto,
    cargo: (e.decisor_cargo || "").trim(),
    telefono: e.telefono_directo,
    industria,
    comuna: (e.comuna || "").trim(),
    region: (e.region || "").trim(),
    n_empleados: e.n_trabajadores,
    lista: LISTA_DECISORES,
    estado: "nuevo",
    // La procedencia del número viaja con el lead: quien llame tiene que poder
    // ver de dónde salió y, si dice "es un FIJO", saberlo antes de marcar.
    senal: e.telefono_directo_origen || "teléfono directo hallado por la cascada",
    fuente_url: "cascada de enriquecimiento",
    // El origen queda marcado como SII a propósito, aunque el número lo haya
    // encontrado la web o Places: lo que se está midiendo es el CAMINO
    // completo, y este camino empieza en el padrón del SII.
    origen_telefono: "cascada (SII)",
    confianza: "media",
    creado_por: "cascada de enriquecimiento",
    encaje: encaje.nivel,
    encaje_motivo: encaje.motivo,
  };

  const { data: creado, error: e2 } = await insertarLead<{ id: string }>(fila, "id");

  if (e2) {
    // 23505 = ya existe un lead con (lista, empresa, contacto). Pasa si alguien
    // lo cargó a mano antes. Se enlaza al que hay en vez de fallar.
    if (e2.code === "23505") {
      const { data: existente } = await s
        .from("leads_foco")
        .select("id")
        .eq("lista", LISTA_DECISORES)
        .ilike("empresa", empresa)
        .ilike("contacto", contacto)
        .limit(1);
      const id = existente?.[0]?.id;
      if (id) {
        await s.from("empresas_sii").update({ lead_foco_id: id }).eq("rut", e.rut);
        return { estado: "ya_estaba", lead_id: id };
      }
    }
    throw new Error(`crear lead de ${e.rut}: ${e2.message}`);
  }

  const leadId = (creado as { id: string }).id;
  await s.from("empresas_sii").update({ lead_foco_id: leadId }).eq("rut", e.rut);
  return { estado: "promovido", lead_id: leadId };
}

/**
 * Promueve todas las que tienen teléfono directo y todavía no están enlazadas.
 * Sirve de recuperación: si la promoción automática falló en una corrida, esto
 * la alcanza después sin duplicar nada.
 */
export async function promoverPendientes(limite = 200): Promise<{
  revisadas: number; promovidos: number; ya_estaban: number; omitidos: string[];
}> {
  const { data, error } = await db()
    .from("empresas_sii")
    .select("rut")
    .not("telefono_directo", "is", null)
    .is("lead_foco_id", null)
    .limit(Math.min(Math.max(limite, 1), 1000));
  if (error) throw new Error(error.message);

  const ruts = (data ?? []).map((r: { rut: string }) => r.rut);
  let promovidos = 0, yaEstaban = 0;
  const omitidos: string[] = [];

  for (const rut of ruts) {
    try {
      const r = await promoverAFoco(rut);
      if (r.estado === "promovido") promovidos++;
      else if (r.estado === "ya_estaba") yaEstaban++;
      else omitidos.push(`${rut}: ${r.motivo}`);
    } catch (e) {
      omitidos.push(`${rut}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { revisadas: ruts.length, promovidos, ya_estaban: yaEstaban, omitidos };
}
