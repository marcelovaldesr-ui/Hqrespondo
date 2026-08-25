/**
 * DETECTOR DE SEÑALES DE INTENCIÓN — Fase 3.
 *
 * Busca un hecho público, fechado y citable que diga que esta empresa tiene
 * AHORA el problema que Respondo resuelve. La señal que importa de verdad:
 *
 *     una clínica publicando un aviso para contratar recepcionista.
 *
 * Eso es un negocio diciendo en voz alta que no da abasto contestando, y que
 * está por gastar un sueldo en resolverlo. Llamarlo esta semana no es lo mismo
 * que llamarlo en tres meses, y esta es la única pieza del sistema que hace
 * que esa diferencia se note en la cola del día.
 *
 * CÓMO BUSCA, Y POR QUÉ ASÍ
 * Con `google_search` de Gemini, obligado a citar. No se scrapea ningún portal
 * de empleo: además de que sus términos lo prohíben, un scraper se rompe cada
 * vez que cambian el HTML y hay que mantenerlo. Una búsqueda con cita entrega
 * lo mismo —el aviso y su URL— sin nada de eso.
 *
 * LOS TRES FILTROS QUE EVITAN INVENTOS
 * El riesgo real acá no es no encontrar nada: es encontrar el aviso de OTRA
 * empresa con nombre parecido y llamar diciendo "supe que están contratando".
 * Eso quema el lead y deja mal parado a quien llama. Por eso:
 *   1. sin URL citada, se descarta;
 *   2. el nombre de la empresa en el aviso tiene que calzar con el nuestro
 *      —se verifica en código, no se le cree al modelo—;
 *   3. el cargo tiene que ser de atención de público, no cualquier vacante.
 *      Una clínica buscando un dentista no dice nada sobre su teléfono.
 */

import { db } from "@/lib/db";
import { geminiJsonConFuentes } from "@/lib/gemini";

/** Cuánto vale cada tipo de señal antes de mentir. */
export const DIAS_VIGENCIA: Record<string, number> = {
  contratando_atencion: 30, // a los 45 ya contrataron
  queja_no_contestan: 90,
  nueva_sucursal: 120,
  cambio_agenda: 180,
  otro: 30,
};

export type TipoSenal = keyof typeof DIAS_VIGENCIA;

export type Senal = {
  tipo: TipoSenal;
  detalle: string;
  evidencia_url: string;
  confianza: "alta" | "media" | "baja";
};

const sinAcento = (s: string) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();

/**
 * Palabras que NO sirven para decidir si dos nombres son la misma empresa:
 * formas legales, conectores y palabras de rubro.
 *
 * La lista salió de medir contra 13 pares reales. Tres lecciones que costaron
 * un falso positivo cada una:
 *   · los PLURALES son otra palabra ("MEDICO" estaba, "MEDICOS" no, y por eso
 *     "Servicios Médicos Madrid" calzó con "Servicios Médicos Del Sur");
 *   · las palabras de rubro no son solo las de salud: "RENTAL" hizo calzar
 *     "Rental Patagonia" con "Rental Andes";
 *   · el largo mínimo es 3 y no 4, porque "Clínica Neo" existe y NEO es su
 *     única palabra distintiva.
 */
const RELLENO = new Set(
  `LIMITADA LTDA SPA SPAS S.A SA EIRL E.I.R.L SOCIEDAD SOC COMPANIA COMPAÑIA CIA
   Y E O DE DEL LA EL LOS LAS UN UNA CON POR PARA SUS
   CENTRO CENTROS CLINICA CLINICAS CLINICO CLINICOS MEDICA MEDICAS MEDICO MEDICOS
   DENTAL DENTALES ODONTOLOGIA ODONTOLOGICA ODONTOLOGICO ODONTOLOGICAS
   SERVICIO SERVICIOS PROFESIONAL PROFESIONALES INTEGRAL INTEGRALES GENERAL GENERALES
   CONSULTA CONSULTAS CONSULTORIO CONSULTORIOS POLICLINICO LABORATORIO LABORATORIOS
   ESTETICA ESTETICO KINESIOLOGIA VETERINARIA VETERINARIO PELUQUERIA BARBERIA
   SALUD BIENESTAR ATENCION IMAGENES SONRISA SONRISAS
   RENTAL RENT CAR AUTOS AUTOMOTORA ARRIENDO ARRIENDOS TRANSPORTE TRANSPORTES
   COMERCIAL COMERCIALIZADORA DISTRIBUIDORA IMPORTADORA EXPORTADORA INVERSIONES
   GRUPO HOLDING EMPRESA EMPRESAS CHILE CHILENA CHILENO`.split(/\s+/),
);

/**
 * ¿El aviso es de ESTA empresa? Se compara en código y no se le cree al modelo.
 *
 * La regla: al menos una palabra DISTINTIVA del nombre —descartando forma legal
 * y palabras de rubro— tiene que aparecer en el nombre del aviso. Sin esto,
 * "Clínica Dental Aurora" calzaría con cualquier "Clínica Dental" del país, que
 * es exactamente el error que arruina una llamada.
 */
export function mismaEmpresa(nuestro: string, enElAviso: string): boolean {
  const distintivas = (n: string) =>
    sinAcento(n).split(/[^A-ZÑ0-9]+/).filter((w) => w.length >= 3 && !RELLENO.has(w));

  const a = distintivas(nuestro);
  const b = new Set(distintivas(enElAviso));
  if (!a.length || !b.size) return false;
  return a.some((w) => b.has(w));
}

/** Cargos que hablan del teléfono. Un dentista no dice nada sobre la atención. */
const CARGO_DE_ATENCION =
  /recepcion|secretari|telefonist|call ?center|contact ?center|asistente (?:administrativ|dental|de atenci)|atencion (?:al |de )?(?:cliente|publico|paciente)|agendamiento|agenda de hora|ejecutiv[oa] (?:de )?(?:atencion|servicio)|anfitrion|admision/i;

type RespuestaIA = {
  encontrado?: boolean;
  empresa_en_el_aviso?: string;
  cargo?: string;
  donde?: string;
  publicado?: string;
  resumen?: string;
};

/**
 * Qué pasó al buscar. El `motivo` NO es decorativo: es la única forma de saber
 * si el detector no encuentra nada porque no hay avisos, o porque los filtros
 * están rechazando avisos buenos.
 *
 * Nació de una corrida real (25-ago-2026): 10 de 10 empresas sin señal, y el
 * libro mayor anotaba lo mismo en los dos casos. Sin poder distinguirlos no se
 * puede decidir si la fase sirve o si hay que aflojar un filtro — así que se
 * estaba midiendo nada.
 */
export type ResultadoBusqueda = {
  senal: Senal | null;
  motivo:
    | "encontrada"
    | "la busqueda no encontro ningun aviso"
    | "el aviso no trae URL citable"
    | "el cargo no es de atencion de publico"
    | "el aviso es de otra empresa con nombre parecido"
    | "error en la busqueda";
  /** Lo que contestó el modelo, para poder revisar los rechazos a mano. */
  crudo?: Record<string, unknown>;
};

/**
 * Busca si la empresa está contratando a alguien para atender público.
 * `senal: null` es la respuesta correcta la mayoría de las veces y no un fallo;
 * el `motivo` dice cuál de las cuatro razones fue.
 */
export async function buscarSenalContratacion(entrada: {
  empresa: string;
  comuna?: string | null;
  industria?: string | null;
}): Promise<ResultadoBusqueda> {
  const prompt = `Averigua si esta empresa chilena publicó recientemente un aviso de trabajo para un cargo de ATENCIÓN DE PÚBLICO.

Empresa: ${entrada.empresa}
${entrada.comuna ? `Comuna: ${entrada.comuna}` : ""}
${entrada.industria ? `Rubro: ${entrada.industria}` : ""}

Cargos que cuentan: recepcionista, secretaria, telefonista, asistente administrativa,
asistente dental, atención al cliente, agendamiento de horas, admisión, ejecutivo de atención.
Cargos que NO cuentan: dentista, médico, kinesiólogo, vendedor terreno, contador, bodeguero,
o cualquier puesto que no atienda el teléfono ni el mesón.

Reglas que no puedes romper:
- Usa google_search. NO respondas de memoria.
- Solo sirve un aviso real que puedas citar con su URL (portal de empleo, la web de la
  empresa, su LinkedIn o Instagram).
- Copia el nombre de la empresa EXACTAMENTE como aparece en el aviso, aunque no calce
  con el que te di. No lo corrijas ni lo completes.
- Si el aviso tiene más de 60 días, responde encontrado:false.
- Si no encuentras un aviso concreto, responde encontrado:false. NO adivines.

Empieza tu respuesta directamente con la llave de apertura. Nada de texto antes ni después.

{"encontrado":true|false,"empresa_en_el_aviso":"...","cargo":"...","donde":"qué portal o página","publicado":"fecha o 'reciente'","resumen":"una línea, máximo 15 palabras"}`;

  try {
    const { data, fuentes } = await geminiJsonConFuentes<RespuestaIA>(
      prompt,
      [{ google_search: {} }],
      // 1.500 y no 700: con la búsqueda activada el modelo suele escribir
      // preámbulo antes del JSON y se cortaba a mitad, dejando un JSON sin
      // cerrar. Dos de las 19 primeras corridas murieron así (25-ago-2026).
      // El JSON que se pide es corto; el margen es para el relato de más.
      { temperature: 0, maxOutputTokens: 1500 },
    );

    const crudo: Record<string, unknown> = { ...data, fuentes: fuentes.slice(0, 3) };

    if (!data?.encontrado) {
      return { senal: null, motivo: "la busqueda no encontro ningun aviso", crudo };
    }

    // Filtro 1 — sin URL citada no hay señal.
    const url = fuentes[0]?.url;
    if (!url) return { senal: null, motivo: "el aviso no trae URL citable", crudo };

    // Filtro 2 — el cargo tiene que atender público.
    const cargo = String(data.cargo ?? "");
    if (!CARGO_DE_ATENCION.test(sinAcento(cargo).toLowerCase()) && !CARGO_DE_ATENCION.test(cargo)) {
      return { senal: null, motivo: "el cargo no es de atencion de publico", crudo };
    }

    // Filtro 3 — el aviso tiene que ser de ESTA empresa. Acá no se le cree al
    // modelo: se compara el nombre que él mismo copió del aviso.
    const enAviso = String(data.empresa_en_el_aviso ?? "");
    const calza = mismaEmpresa(entrada.empresa, enAviso);
    if (!calza) {
      return { senal: null, motivo: "el aviso es de otra empresa con nombre parecido", crudo };
    }

    // Un nombre que calza entero da más confianza que uno que calza en una
    // palabra. Sin fecha explícita, la confianza baja: puede ser un aviso viejo.
    const exacto = sinAcento(enAviso).includes(sinAcento(entrada.empresa).slice(0, 12));
    const conFecha = !!data.publicado && !/reciente/i.test(String(data.publicado));

    return {
      senal: {
        tipo: "contratando_atencion",
        detalle: `Busca ${cargo.toLowerCase()}${data.publicado ? ` (${data.publicado})` : ""}${
          data.donde ? ` · ${data.donde}` : ""
        }`,
        evidencia_url: url,
        confianza: exacto && conFecha ? "alta" : exacto || conFecha ? "media" : "baja",
      },
      motivo: "encontrada",
      crudo,
    };
  } catch (e) {
    return {
      senal: null,
      motivo: "error en la busqueda",
      crudo: { error: e instanceof Error ? e.message : String(e) },
    };
  }
}

/**
 * Guarda la señal y deja la copia que la cola del día necesita para ordenar.
 *
 * Devuelve `false` cuando la señal ya estaba anotada (misma URL, mismo tipo,
 * mismo lead), que no es un error: es el detector encontrando otra vez el mismo
 * aviso, y significa que sigue publicado.
 */
export async function guardarSenal(leadId: string, s: Senal): Promise<boolean> {
  const dias = DIAS_VIGENCIA[s.tipo] ?? 30;
  const vigenteHasta = new Date(Date.now() + dias * 86_400_000).toISOString();
  const cli = db();

  const { error } = await cli.from("senales").insert({
    lead_foco_id: leadId,
    tipo: s.tipo,
    detalle: s.detalle.slice(0, 400),
    evidencia_url: s.evidencia_url.slice(0, 1000),
    fuente: "busqueda_publica",
    vigente_hasta: vigenteHasta,
    confianza: s.confianza,
  });
  if (error) {
    if (error.code === "23505") return false; // ya estaba
    throw new Error(`guardar señal: ${error.message}`);
  }

  const { error: e2 } = await cli
    .from("leads_foco")
    .update({
      senal_reciente: s.detalle.slice(0, 400),
      senal_reciente_url: s.evidencia_url.slice(0, 1000),
      senal_reciente_at: new Date().toISOString(),
      senal_vigente_hasta: vigenteHasta,
      updated_at: new Date().toISOString(),
    })
    .eq("id", leadId);
  if (e2) console.error("[senales] no se pudo copiar la señal al lead:", e2.message);

  return true;
}

/**
 * Borra la copia de las señales que caducaron.
 *
 * Es tan importante como detectarlas: una señal vencida ordena la cola con
 * información falsa, y llamar diciendo "supe que están buscando recepcionista"
 * seis semanas después de que contrataron es peor que no llamar.
 */
export async function limpiarSenalesVencidas(): Promise<number> {
  const { data, error } = await db()
    .from("leads_foco")
    .update({
      senal_reciente: null,
      senal_reciente_url: null,
      senal_reciente_at: null,
      senal_vigente_hasta: null,
    })
    .not("senal_vigente_hasta", "is", null)
    .lt("senal_vigente_hasta", new Date().toISOString())
    .select("id");
  if (error) {
    console.error("[senales] no se pudieron limpiar las vencidas:", error.message);
    return 0;
  }
  return data?.length ?? 0;
}
