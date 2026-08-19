import { db } from "@/lib/db";
import { CONECTADOS, type Resultado } from "@/lib/actividades";

/**
 * Métricas propias (Fases 2 y 3 de la auditoría).
 *
 * Principio de diseño: NO comparar contra benchmarks públicos. El reply rate
 * "de la industria" va de 0,45% (Belkins, 7,5M emails) a 8,3% (Woodpecker,
 * 20M+), con incentivos opuestos. La única vara válida es la serie propia.
 *
 * Corolario: cada número acá viene con su `n`. Un porcentaje sin denominador
 * en un equipo de 3 personas es una invitación a concluir de más.
 */

/** Bajo esta cantidad de casos, un porcentaje no significa nada. */
export const N_MINIMO_CONFIABLE = 25;

/**
 * Y bajo esta cantidad de ÉXITOS tampoco, aunque el n sea grande.
 *
 * Con 161 prospectos trabajados y solo 4 que avanzaron, una tasa de 4,7% vs
 * 0% no distingue una señal real del ruido: mover un solo caso cambia el
 * veredicto. Chequear únicamente el n es la trampa clásica — el denominador
 * puede ser enorme y el numerador seguir siendo un puñado.
 */
export const EXITOS_MINIMOS = 10;

// ------------------------------------------------------- CALIBRACIÓN DEL SCORE

export interface TramoScore {
  desde: number;
  hasta: number;
  n: number;
  avanzaron: number;
  tasa: number;
}

export interface Calibracion {
  tramos: TramoScore[];
  /** Cuántos prospectos avanzaron en total. Es el numerador real. */
  exitos: number;
  /** Cuántos casos de éxito faltan para poder concluir. */
  faltanExitos: number;
  /** Diferencia entre el tramo más alto y el más bajo con n suficiente.
   *  Si es ~0, el score no separa nada y es un adorno. */
  separacion: number | null;
  suficiente: boolean;
  total: number;
}

/**
 * ¿El score predice algo?
 *
 * Se agrupan los prospectos por tramo de score y se mide qué porcentaje
 * avanzó (respondió o entró al pipeline). Si la curva sale plana, el scoring
 * no aporta y estamos priorizando al azar con pasos extra. Si sale monótona,
 * es una ventaja real y medible.
 *
 * Es la pregunta que casi ningún equipo chico se hace, y la que decide si
 * vale la pena seguir invirtiendo en el scoring.
 */
export async function calibracionScore(): Promise<Calibracion> {
  const { data, error } = await db()
    .from("prospects")
    .select("score,estado,intentos_llamada");
  if (error) throw new Error(error.message);

  const filas = (data ?? []) as {
    score: number;
    estado: string;
    intentos_llamada: number | null;
  }[];

  // Solo cuentan los que efectivamente se trabajaron: incluir prospectos
  // nunca tocados mide nuestra disciplina, no la calidad del score.
  const trabajados = filas.filter(
    (f) => (f.intentos_llamada ?? 0) > 0 || f.estado !== "nuevo",
  );

  const CORTES = [
    [90, 100],
    [80, 89],
    [70, 79],
    [60, 69],
    [0, 59],
  ] as const;

  const tramos: TramoScore[] = CORTES.map(([desde, hasta]) => {
    const dentro = trabajados.filter((f) => f.score >= desde && f.score <= hasta);
    const avanzaron = dentro.filter((f) =>
      ["respondio", "en_pipeline", "cliente"].includes(f.estado),
    ).length;
    return {
      desde,
      hasta,
      n: dentro.length,
      avanzaron,
      tasa: dentro.length ? avanzaron / dentro.length : 0,
    };
  });

  const validos = tramos.filter((t) => t.n >= N_MINIMO_CONFIABLE);
  const exitosTotales = tramos.reduce((a, t) => a + t.avanzaron, 0);
  const separacion =
    validos.length >= 2
      ? Math.max(...validos.map((t) => t.tasa)) - Math.min(...validos.map((t) => t.tasa))
      : null;

  return {
    tramos,
    separacion,
    // Hacen falta las DOS condiciones: tramos con volumen Y suficientes
    // casos de éxito. Con pocos éxitos el veredicto se da vuelta solo.
    suficiente: validos.length >= 2 && exitosTotales >= EXITOS_MINIMOS,
    exitos: exitosTotales,
    faltanExitos: Math.max(0, EXITOS_MINIMOS - exitosTotales),
    total: trabajados.length,
  };
}

// ------------------------------------------------------------------- EMBUDO

export interface PasoEmbudo {
  paso: string;
  n: number;
  /** El cero es por falta de registro, no una medición. */
  sinDato?: boolean;
  /** Conversión desde el paso anterior. */
  tasa: number | null;
  confiable: boolean;
}

/** Embudo con tasas PROPIAS. Cada paso lleva su n y si es confiable. */
export async function embudoPropio(): Promise<PasoEmbudo[]> {
  const { data, error } = await db()
    .from("prospects")
    .select("estado,intentos_llamada");
  if (error) throw new Error(error.message);
  const filas = (data ?? []) as { estado: string; intentos_llamada: number | null }[];

  let acts: { prospect_id: string | null; resultado: string }[] = [];
  try {
    const r = await db().from("actividades").select("prospect_id,resultado");
    if (!r.error) acts = (r.data ?? []) as typeof acts;
  } catch {
    /* la bitácora es nueva: sin ella se usan solo los estados */
  }
  const conectadosIds = new Set(
    acts
      .filter((a) => a.prospect_id && CONECTADOS.includes(a.resultado as Resultado))
      .map((a) => a.prospect_id as string),
  );

  const captados = filas.length;
  const tocados = filas.filter((f) => (f.intentos_llamada ?? 0) > 0).length;
  const conectados = conectadosIds.size;
  const respondieron = filas.filter((f) =>
    ["respondio", "en_pipeline", "cliente"].includes(f.estado),
  ).length;
  const enPipeline = filas.filter((f) =>
    ["en_pipeline", "cliente"].includes(f.estado),
  ).length;
  const clientes = filas.filter((f) => f.estado === "cliente").length;

  // Si la bitácora está recién creada, "conectados" es 0 por falta de
  // registro, no porque nadie haya conectado. Mostrarlo como 0% haría que
  // el embudo "suba" en el paso siguiente, que es absurdo.
  const sinBitacora = acts.length === 0;

  const crudo: [string, number][] = [
    ["Captados", captados],
    ["Tocados", tocados],
    ["Conectados", conectados],
    ["Respondieron", respondieron],
    ["En pipeline", enPipeline],
    ["Clientes", clientes],
  ];

  return crudo.map(([paso, n], i) => {
    const prev = i === 0 ? null : crudo[i - 1][1];
    const sinDato = sinBitacora && paso === "Conectados";
    return {
      paso,
      n,
      sinDato,
      // Tras un paso sin dato, la conversión del siguiente sería contra un
      // cero falso: se omite en vez de inventar un porcentaje.
      tasa: sinDato || (i > 0 && sinBitacora && crudo[i - 1][0] === "Conectados")
        ? null
        : prev && prev > 0
          ? n / prev
          : null,
      confiable: (prev ?? 0) >= N_MINIMO_CONFIABLE,
    };
  });
}

// ------------------------------------------------- CAPACIDAD INVERSA

export interface Capacidad {
  clientesMeta: number;
  pasos: { paso: string; necesarios: number; tasaUsada: number; propia: boolean }[];
  algunaEstimada: boolean;
}

/**
 * Planificación inversa: para N clientes, ¿cuántos prospectos hacen falta?
 *
 * Reemplaza el forecasting probabilístico de Outreach/Gong a una milésima del
 * esfuerzo y con mejor precisión a este volumen: con pocos deals la varianza
 * de la muestra se come cualquier modelo.
 *
 * Cuando una tasa propia no tiene casos suficientes se usa un supuesto
 * conservador y se MARCA como estimado. Nunca se presenta una suposición como
 * dato medido.
 */
export async function capacidadInversa(clientesMeta = 5): Promise<Capacidad> {
  const embudo = await embudoPropio();
  // Supuestos de respaldo, deliberadamente pesimistas.
  const RESPALDO: Record<string, number> = {
    Tocados: 0.9,
    Conectados: 0.25,
    Respondieron: 0.15,
    "En pipeline": 0.3,
    Clientes: 0.25,
  };

  const orden = ["Clientes", "En pipeline", "Respondieron", "Conectados", "Tocados", "Captados"];
  const tasaDe = (paso: string) => {
    const p = embudo.find((e) => e.paso === paso);
    const propia = !!p && p.tasa !== null && p.confiable && p.tasa > 0;
    return {
      tasa: propia ? (p!.tasa as number) : (RESPALDO[paso] ?? 0.2),
      propia,
    };
  };

  const pasos: Capacidad["pasos"] = [];
  let necesarios = clientesMeta;
  let algunaEstimada = false;

  for (let i = 0; i < orden.length - 1; i++) {
    const paso = orden[i];
    const { tasa, propia } = tasaDe(paso);
    if (!propia) algunaEstimada = true;
    pasos.push({ paso, necesarios: Math.ceil(necesarios), tasaUsada: tasa, propia });
    necesarios = necesarios / tasa;
  }
  pasos.push({ paso: "Captados", necesarios: Math.ceil(necesarios), tasaUsada: 1, propia: true });

  return { clientesMeta, pasos: pasos.reverse(), algunaEstimada };
}

// ------------------------------------------------------------------ MARCADOR

import { EQUIPO } from "@/lib/equipo";

export interface FilaMarcador {
  persona: string;
  llamadas: number;
  contestaron: number;
  /** contestaron / llamadas, null si no hay llamadas. */
  tasa: number | null;
  reuniones: number;
}

export interface Marcador {
  desde: string;
  filas: FilaMarcador[];
  /** Llamadas viejas sin persona registrada (antes del selector de actor). */
  sinPersona: number;
}

/**
 * Marcador de llamadas por persona: "Amaro hizo 100 llamadas, contestaron 30,
 * agendó 3". Sale ENTERO de la bitácora — los dos motores escriben ahí — así
 * que un número de esta tabla y uno del embudo nunca pueden discrepar.
 *
 * "Reuniones" cuenta los resultados `interesado`: es donde caen el "Éxito" de
 * Leads Foco y el "Interesado" de Llamadas del día. Es la moneda de avance de
 * los dos motores, no una métrica nueva.
 */
export async function marcadorLlamadas(dias = 7): Promise<Marcador> {
  const desde = new Date(Date.now() - dias * 86400_000).toISOString();
  const { data, error } = await db()
    .from("actividades")
    .select("actor,resultado")
    .eq("canal", "llamada")
    .gte("created_at", desde);
  if (error) throw new Error(error.message);

  const filasRaw = (data ?? []) as { actor: string; resultado: Resultado }[];
  const por = new Map<string, FilaMarcador>();
  for (const s of EQUIPO) {
    por.set(s.nombre, { persona: s.nombre, llamadas: 0, contestaron: 0, tasa: null, reuniones: 0 });
  }
  let sinPersona = 0;
  for (const a of filasRaw) {
    const actor = (a.actor ?? "").trim();
    const fila = por.get(actor);
    if (!fila) {
      // Actor vacío o un nombre que no está en el equipo: se cuenta aparte en
      // vez de perderse, para que el total siempre cuadre con la bitácora.
      sinPersona++;
      continue;
    }
    fila.llamadas++;
    if (CONECTADOS.includes(a.resultado)) fila.contestaron++;
    if (a.resultado === "interesado") fila.reuniones++;
  }
  for (const f of por.values()) f.tasa = f.llamadas ? f.contestaron / f.llamadas : null;

  return {
    desde,
    // El que más llama arriba. Amaro debería vivir ahí.
    filas: [...por.values()].sort((a, b) => b.llamadas - a.llamadas),
    sinPersona,
  };
}

// -------------------------------------------------------------- SALUD BASE

import { ENCAJE_RANK } from "@/lib/encaje";

export interface SaludBase {
  llamadas: {
    total: number;
    elegibles: number;      // nuevos, score>=70, <4 intentos: la cola viva
    quemados: number;       // 4 intentos sin contacto: se retiraron solos
    descartados: number;
    sinTelefono: number;
    dormidos: number;       // elegibles que nadie toca hace 14+ días
  };
  foco: {
    total: number;
    trabajables: number;    // teléfono + persona + encaje
    porInvestigar: number;  // encajan, falta el dato
    retirados: number;
    noEncajan: number;
  };
  suprimidos: number;
}

/**
 * Salud de la base — la foto honesta del activo comercial.
 *
 * La base de datos ES un activo que se deprecia: los números se queman, los
 * leads se duermen y las tandas se agotan. Este panel existe para que eso se
 * vea venir con semanas de anticipación, no cuando la cola amanece vacía.
 * Cada número trae al lado la acción que lo mueve.
 */
export async function saludBase(): Promise<SaludBase> {
  const s = db();
  const hace14d = new Date(Date.now() - 14 * 86400_000).toISOString();

  const [pros, foco, sup] = await Promise.all([
    s.from("prospects").select("estado,score,telefono,intentos_llamada,ultimo_intento_llamada"),
    s.from("leads_foco").select("estado,telefono,contacto,encaje,nota"),
    s.from("supresiones").select("id", { count: "exact", head: true }),
  ]);

  const P = (pros.data ?? []) as {
    estado: string; score: number | null; telefono: string | null;
    intentos_llamada: number | null; ultimo_intento_llamada: string | null;
  }[];
  const F = (foco.data ?? []) as {
    estado: string; telefono: string; contacto: string; encaje: keyof typeof ENCAJE_RANK; nota: string;
  }[];

  const elegible = (p: (typeof P)[number]) =>
    p.estado === "nuevo" && (p.score ?? 0) >= 70 && !!p.telefono?.trim() && (p.intentos_llamada ?? 0) < 4;

  const activo = (f: (typeof F)[number]) => ["nuevo", "contactando"].includes(f.estado);

  return {
    llamadas: {
      total: P.length,
      elegibles: P.filter(elegible).length,
      quemados: P.filter((p) => p.estado === "nuevo" && (p.intentos_llamada ?? 0) >= 4).length,
      descartados: P.filter((p) => p.estado === "descartado").length,
      sinTelefono: P.filter((p) => !p.telefono?.trim()).length,
      dormidos: P.filter(
        (p) => elegible(p) && (!p.ultimo_intento_llamada || p.ultimo_intento_llamada < hace14d),
      ).length,
    },
    foco: {
      total: F.length,
      trabajables: F.filter(
        (f) => activo(f) && f.telefono.trim() && f.contacto.trim() && ENCAJE_RANK[f.encaje] >= 3,
      ).length,
      porInvestigar: F.filter(
        (f) => activo(f) && ENCAJE_RANK[f.encaje] >= 2 && !(f.telefono.trim() && f.contacto.trim()),
      ).length,
      retirados: F.filter((f) => f.estado === "descartado" && f.nota.includes("Retirado:")).length,
      noEncajan: F.filter((f) => ENCAJE_RANK[f.encaje] < 2).length,
    },
    suprimidos: sup.count ?? 0,
  };
}
