/**
 * La cola de enriquecimiento y su libro mayor.  (Fase 1)
 *
 * Este archivo es la única puerta de entrada a las tres tablas de la migración
 * 028. Nadie más debería hacer `db().from("cola_enriquecimiento")` a mano: la
 * lógica de reintentos, de cupo y de "a este proveedor ya se le preguntó" vive
 * acá y en las funciones de Postgres, no repartida por la app.
 *
 * En esta fase el enriquecedor es de mentira: escribe en consola y devuelve un
 * resultado simulado. Toda la mecánica alrededor —tomar el lote, no pisarse con
 * otro worker, anotar en el libro mayor, cerrar la fila, respetar el tiempo de
 * Vercel— es de verdad y es la que se va a probar. En la Fase 2 se reemplaza
 * `enriquecerSimulado` por la cascada real y no cambia nada más.
 */

import { db } from "@/lib/db";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type Entidad = "prospect" | "lead_foco" | "empresa_sii";
export type Objetivo = "telefono_directo" | "email" | "decisor" | "linkedin";
export type EstadoItem =
  | "pendiente"
  | "procesando"
  | "completado"
  | "fallido"
  | "agotado";

export type ResultadoIntento =
  | "exito"
  | "sin_dato"
  | "error"
  | "sin_cupo"
  | "rate_limit"
  | "bloqueado";

export type ItemCola = {
  id: number;
  prospect_id: string | null;
  lead_foco_id: string | null;
  empresa_rut: string | null;
  entidad: Entidad;
  entidad_id: string;
  objetivo: Objetivo;
  estado: EstadoItem;
  prioridad: number;
  intentos: number;
  max_intentos: number;
  proximo_intento_at: string;
  lote_id: string | null;
  tomado_at: string | null;
  ultimo_error: string | null;
  resultado: Record<string, unknown> | null;
};

/** Lo que devuelve un enriquecedor: qué se encontró y a quién se le preguntó. */
export type SalidaEnriquecimiento = {
  encontrado: boolean;
  datos?: Record<string, unknown>;
  intentos: Array<{
    proveedor: string;
    resultado: ResultadoIntento;
    encontrado: boolean;
    costo_creditos?: number;
    ms?: number;
    respuesta?: unknown;
    error_detalle?: string;
  }>;
};

export type Enriquecedor = (item: ItemCola) => Promise<SalidaEnriquecimiento>;

// ---------------------------------------------------------------------------
// Presupuesto de tiempo
// ---------------------------------------------------------------------------

/**
 * Vercel corta la función sin avisar al llegar al límite. Si eso pasa a mitad
 * del lote, las filas quedan en 'procesando' y solo las rescata
 * `recuperar_cola_colgada` en la corrida siguiente: se pierde una vuelta
 * completa. Es más barato parar solos con margen y dejar el resto pendiente.
 */
const MARGEN_MS = 15_000;

// ---------------------------------------------------------------------------
// Encolar
// ---------------------------------------------------------------------------

export type PorEncolar = {
  entidad: Entidad;
  id: string;                 // uuid del prospect/lead, o RUT de la empresa
  objetivo?: Objetivo;
  prioridad?: number;
};

/**
 * Mete trabajo en la cola. Los duplicados se ignoran en silencio.
 *
 * Va por la función `encolar_items` y no por `.upsert()` del cliente de
 * Supabase por una razón concreta: el índice que impide duplicados es PARCIAL
 * (solo cubre las filas vivas), y Postgres únicamente reconoce un índice
 * parcial en `ON CONFLICT` si se le repite su misma cláusula WHERE. El cliente
 * no sabe mandar esa cláusula, así que un upsert acá reventaría con
 * "no unique or exclusion constraint matching the ON CONFLICT specification".
 */
export async function encolar(items: PorEncolar[]): Promise<number> {
  if (!items.length) return 0;

  let insertadas = 0;
  // De a 1.000: el JSON viaja como un solo parámetro y no conviene mandar
  // payloads enormes por PostgREST.
  for (let i = 0; i < items.length; i += 1000) {
    const trozo = items.slice(i, i + 1000).map((x) => ({
      entidad: x.entidad,
      id: x.id,
      objetivo: x.objetivo ?? "telefono_directo",
      prioridad: x.prioridad ?? 0,
    }));
    const { data, error } = await db().rpc("encolar_items", { p_items: trozo });
    if (error) throw new Error(`encolar_items: ${error.message}`);
    insertadas += (data as number) ?? 0;
  }
  return insertadas;
}

// ---------------------------------------------------------------------------
// Tomar / cerrar / rescatar  (todo vía funciones de Postgres)
// ---------------------------------------------------------------------------

/** Devuelve al estado 'pendiente' las filas que un worker muerto dejó tomadas. */
export async function recuperarColgadas(minutos = 15): Promise<number> {
  const { data, error } = await db().rpc("recuperar_cola_colgada", {
    p_minutos: minutos,
  });
  if (error) throw new Error(`recuperar_cola_colgada: ${error.message}`);
  return (data as number) ?? 0;
}

/**
 * Toma hasta `n` filas y las marca 'procesando' en una sola transacción.
 * Dos workers simultáneos NO se llevan las mismas filas (SKIP LOCKED).
 */
export async function tomarLote(n = 25, objetivo?: Objetivo): Promise<ItemCola[]> {
  const { data, error } = await db().rpc("obtener_lote_cola", {
    p_lote: n,
    p_objetivo: objetivo ?? null,
  });
  if (error) throw new Error(`obtener_lote_cola: ${error.message}`);
  return (data as ItemCola[]) ?? [];
}

export async function cerrarItem(
  id: number,
  estado: "completado" | "fallido",
  resultado?: Record<string, unknown> | null,
  error?: string | null,
): Promise<void> {
  const { error: e } = await db().rpc("cerrar_item_cola", {
    p_id: id,
    p_estado: estado,
    p_resultado: resultado ?? null,
    p_error: error ?? null,
  });
  if (e) throw new Error(`cerrar_item_cola: ${e.message}`);
}

// ---------------------------------------------------------------------------
// Libro mayor
// ---------------------------------------------------------------------------

/** Un payload gigante en JSONB no aporta nada y hace pesada la tabla. */
function recortar(v: unknown, maxBytes = 8_000): unknown {
  if (v === undefined || v === null) return null;
  try {
    const s = JSON.stringify(v);
    if (s.length <= maxBytes) return v;
    return { _recortado: true, _bytes: s.length, muestra: s.slice(0, maxBytes) };
  } catch {
    return { _recortado: true, _error: "no serializable" };
  }
}

/**
 * Anota en el libro mayor. Nunca lanza: si el registro falla, el trabajo real
 * ya se hizo y perder la anotación no puede tumbar la corrida — pero sí queda
 * en el log del worker.
 *
 * El choque contra `enriq_intentos_definitivo_idx` (código 23505) es esperado y
 * se ignora: significa que ese proveedor ya había dado una respuesta definitiva
 * sobre esta entidad. Es la señal de que hay que revisar por qué se le volvió a
 * preguntar, no un error que deba detener nada.
 */
export async function registrarIntento(item: ItemCola, intento: {
  proveedor: string;
  resultado: ResultadoIntento;
  encontrado: boolean;
  costo_creditos?: number;
  ms?: number;
  respuesta?: unknown;
  error_detalle?: string;
}): Promise<void> {
  const { error } = await db().from("enriquecimiento_intentos").insert({
    cola_id: item.id,
    entidad: item.entidad,
    entidad_id: item.entidad_id,
    proveedor: intento.proveedor,
    objetivo: item.objetivo,
    resultado: intento.resultado,
    encontrado: intento.encontrado,
    costo_creditos: intento.costo_creditos ?? 0,
    ms: intento.ms ?? null,
    respuesta: recortar(intento.respuesta),
    error_detalle: intento.error_detalle ?? null,
  });
  if (error && error.code !== "23505") {
    console.error(`[cola] no se pudo anotar el intento (${intento.proveedor}):`, error.message);
  }
}

/**
 * Qué proveedores ya respondieron algo DEFINITIVO sobre esta entidad. La
 * cascada de la Fase 2 usa esto para saltárselos y no pagar dos veces por la
 * misma respuesta.
 */
export async function proveedoresYaConsultados(
  item: Pick<ItemCola, "entidad" | "entidad_id" | "objetivo">,
): Promise<Set<string>> {
  const { data, error } = await db()
    .from("enriquecimiento_intentos")
    .select("proveedor")
    .eq("entidad", item.entidad)
    .eq("entidad_id", item.entidad_id)
    .eq("objetivo", item.objetivo)
    .in("resultado", ["exito", "sin_dato"]);
  if (error) {
    console.error("[cola] no se pudo leer el libro mayor:", error.message);
    return new Set();
  }
  return new Set((data ?? []).map((r: { proveedor: string }) => r.proveedor));
}

// ---------------------------------------------------------------------------
// Cortacircuitos
// ---------------------------------------------------------------------------

export type ProveedorEstado = {
  proveedor: string;
  estado: "ok" | "probando" | "cortado";
  habilitado: boolean;
  fallos_consecutivos: number;
  fallos_umbral: number;
  cortado_hasta: string | null;
  cupo_mensual: number | null;
  cupo_usado_mes: number;
  cupo_diario: number | null;
  cupo_usado_dia: number;
};

/**
 * Los proveedores que se pueden usar ahora mismo. Se lee UNA vez por corrida,
 * no una vez por lead: son 8 filas y no cambian a mitad de lote.
 */
export async function proveedoresDisponibles(): Promise<Set<string>> {
  const { data, error } = await db()
    .from("proveedor_estado")
    .select("proveedor,estado,habilitado,cortado_hasta,cupo_mensual,cupo_usado_mes,cupo_diario,cupo_usado_dia");
  if (error) {
    console.error("[cola] no se pudo leer proveedor_estado:", error.message);
    return new Set();
  }
  const ahora = Date.now();
  const vivos = (data as ProveedorEstado[]).filter((p) => {
    if (!p.habilitado) return false;
    if (p.estado === "cortado" && p.cortado_hasta && Date.parse(p.cortado_hasta) > ahora) return false;
    if (p.cupo_mensual !== null && p.cupo_usado_mes >= p.cupo_mensual) return false;
    if (p.cupo_diario !== null && p.cupo_usado_dia >= p.cupo_diario) return false;
    return true;
  });
  return new Set(vivos.map((p) => p.proveedor));
}

/**
 * Suma el consumo y mueve el cortacircuitos. Un éxito reinicia el contador de
 * fallos; cinco fallos seguidos cortan el proveedor por 30 minutos.
 *
 * Se hace en dos pasos (leer y escribir) en vez de un UPDATE atómico porque el
 * worker es de un solo hilo por lote y una carrera acá, en el peor caso, deja
 * el contador de fallos corto por uno. No vale una función más para eso.
 */
export async function anotarUsoProveedor(
  proveedor: string,
  ok: boolean,
  detalleError?: string,
): Promise<void> {
  const cli = db();
  const { data, error } = await cli
    .from("proveedor_estado")
    .select("*")
    .eq("proveedor", proveedor)
    .maybeSingle();
  if (error || !data) return;
  const p = data as ProveedorEstado & { dia_actual: string; mes_actual: string };

  const hoy = new Date().toISOString().slice(0, 10);
  const mes = hoy.slice(0, 8) + "01";
  const mismoDia = p.dia_actual === hoy;
  const mismoMes = p.mes_actual === mes;

  const fallos = ok ? 0 : p.fallos_consecutivos + 1;
  const corta = fallos >= p.fallos_umbral;

  const patch: Record<string, unknown> = {
    cupo_usado_dia: (mismoDia ? p.cupo_usado_dia : 0) + 1,
    dia_actual: hoy,
    cupo_usado_mes: (mismoMes ? p.cupo_usado_mes : 0) + 1,
    mes_actual: mes,
    fallos_consecutivos: fallos,
    estado: corta ? "cortado" : ok ? "ok" : p.estado === "cortado" ? "probando" : p.estado,
    cortado_hasta: corta ? new Date(Date.now() + 30 * 60_000).toISOString() : null,
    ultimo_error: ok ? null : (detalleError ?? "sin detalle"),
  };
  if (ok) patch.ultimo_ok_at = new Date().toISOString();

  const { error: e2 } = await cli.from("proveedor_estado").update(patch).eq("proveedor", proveedor);
  if (e2) console.error(`[cola] no se pudo actualizar ${proveedor}:`, e2.message);
  if (corta) console.warn(`[cola] CORTADO ${proveedor}: ${fallos} fallos seguidos. Vuelve en 30 min.`);
}

// ---------------------------------------------------------------------------
// El enriquecedor de mentira (Fase 1)
// ---------------------------------------------------------------------------

/**
 * No llama a nadie ni gasta un peso. Existe para probar que la tubería completa
 * funciona antes de conectarle proveedores que cobran.
 *
 * Devuelve "encontrado" en dos de cada tres filas, decidido por el id (no al
 * azar), para que dos corridas seguidas sobre la misma cola den lo mismo y se
 * pueda comparar.
 */
export const enriquecerSimulado: Enriquecedor = async (item) => {
  const t0 = Date.now();
  const encontrado = item.id % 3 !== 0;

  console.log(
    `[cola:simulado] #${item.id} ${item.entidad}=${item.entidad_id} objetivo=${item.objetivo} ` +
      `intento=${item.intentos}/${item.max_intentos} -> ${encontrado ? "ENCONTRADO" : "sin dato"}`,
  );

  return {
    encontrado,
    datos: encontrado
      ? { simulado: true, telefono_directo: "+56 9 0000 0000", origen: "simulado" }
      : undefined,
    intentos: [
      {
        proveedor: "web",
        resultado: encontrado ? "exito" : "sin_dato",
        encontrado,
        costo_creditos: 0,
        ms: Date.now() - t0,
        respuesta: { simulado: true, nota: "Fase 1: no se llamó a ningún proveedor real" },
      },
    ],
  };
};

// ---------------------------------------------------------------------------
// El worker
// ---------------------------------------------------------------------------

export type ResumenCorrida = {
  lote: number;
  completados: number;
  encontrados: number;
  fallidos: number;
  rescatadas: number;
  proveedores_disponibles: string[];
  corto_por_tiempo: boolean;
  ms: number;
};

/**
 * Una corrida del worker. El orden importa:
 *
 *   1. Rescatar lo que quedó colgado de la corrida anterior. Va PRIMERO, si no
 *      esas filas nunca vuelven a entrar al lote.
 *   2. Leer qué proveedores están vivos (una sola vez).
 *   3. Tomar el lote — acá es donde SKIP LOCKED impide el trabajo duplicado.
 *   4. Procesar de a uno, anotando cada intento en el libro mayor y cerrando la
 *      fila enseguida. Cerrar al final sería más rápido pero, si Vercel corta a
 *      mitad, se pierde todo el lote en vez de la fila en curso.
 */
export async function correrWorker(opts?: {
  lote?: number;
  objetivo?: Objetivo;
  limiteMs?: number;
  enriquecedor?: Enriquecedor;
}): Promise<ResumenCorrida> {
  const t0 = Date.now();
  const lote = opts?.lote ?? 25;
  const limiteMs = opts?.limiteMs ?? 240_000;
  const enriquecer = opts?.enriquecedor ?? enriquecerSimulado;

  const rescatadas = await recuperarColgadas(15);
  if (rescatadas) console.log(`[cola] ${rescatadas} filas colgadas devueltas a la cola`);

  const disponibles = await proveedoresDisponibles();
  const items = await tomarLote(lote, opts?.objetivo);
  console.log(`[cola] lote de ${items.length} (pedidas ${lote}) · proveedores vivos: ${[...disponibles].join(", ") || "ninguno"}`);

  let completados = 0, encontrados = 0, fallidos = 0, cortoPorTiempo = false;

  for (const item of items) {
    if (Date.now() - t0 > limiteMs - MARGEN_MS) {
      // Se acabó el tiempo. Lo que queda del lote se devuelve a la cola para la
      // corrida siguiente en vez de arriesgar un corte de Vercel a mitad.
      cortoPorTiempo = true;
      await cerrarItem(item.id, "fallido", null, "sin tiempo en esta corrida");
      continue;
    }

    try {
      const salida = await enriquecer(item);

      for (const intento of salida.intentos) {
        await registrarIntento(item, intento);
        await anotarUsoProveedor(
          intento.proveedor,
          intento.resultado === "exito" || intento.resultado === "sin_dato",
          intento.error_detalle,
        );
      }

      await cerrarItem(item.id, "completado", {
        encontrado: salida.encontrado,
        datos: salida.datos ?? null,
        proveedores: salida.intentos.map((i) => i.proveedor),
      });

      completados++;
      if (salida.encontrado) encontrados++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[cola] #${item.id} falló:`, msg);
      await registrarIntento(item, {
        proveedor: "worker",
        resultado: "error",
        encontrado: false,
        error_detalle: msg,
      });
      await cerrarItem(item.id, "fallido", null, msg);
      fallidos++;
    }
  }

  const resumen: ResumenCorrida = {
    lote: items.length,
    completados,
    encontrados,
    fallidos,
    rescatadas,
    proveedores_disponibles: [...disponibles],
    corto_por_tiempo: cortoPorTiempo,
    ms: Date.now() - t0,
  };
  console.log("[cola] corrida terminada:", JSON.stringify(resumen));
  return resumen;
}
