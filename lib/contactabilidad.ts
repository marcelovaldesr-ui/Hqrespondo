/**
 * CONTACTABILIDAD — ¿si marco este número, termino hablando con alguien que
 * pueda decidir o influir una reunión?
 *
 * POR QUÉ NO ES UN SCORE DE "PROVEEDOR = PUNTOS"
 * La tentación es escribir `google: +20, apollo: +10`. Eso no predice nada:
 * inventa una jerarquía de marcas y la congela. Acá el puntaje sale de dos
 * preguntas independientes que se multiplican, porque fallar en cualquiera de
 * las dos arruina la llamada igual:
 *
 *   1. ¿VA A CONTESTAR ALGUIEN?  → depende de si el número es verificable:
 *      ¿podemos señalar el lugar donde el propio negocio lo publicó?
 *   2. ¿ESE ALGUIEN SIRVE?       → depende de si es la línea del que manda o
 *      el mesón, y de si sabemos por quién preguntar.
 *
 * UNA ADVERTENCIA QUE ME IMPORTA DEJAR ESCRITA
 * El 4-sep medimos las llamadas reales: los números de Apollo dieron 67% de
 * contacto con el decisor (sobre 6 llamadas) y los de origen no registrado
 * dieron 0% (sobre 7). Con esos tamaños de muestra NO se puede concluir nada,
 * y sería deshonesto codificar "Apollo es bueno" o "Apollo es malo".
 *
 * Por eso el puntaje base sale de la VERIFICABILIDAD —que es un argumento, no
 * una medición— y se corrige con los resultados reales de las llamadas en
 * cuanto haya volumen suficiente (`ajustarPorHistorial`). Mientras no lo haya,
 * manda el argumento. Cuando lo haya, mandan los datos.
 */

import {
  corroborado,
  esMovil,
  metodosDistintos,
  type ContactoConEvidencia,
  type TipoContacto,
} from "@/lib/contactos";

/* ═══════════════ 1. ¿VA A CONTESTAR ALGUIEN? ═══════════════ */

/**
 * Prior por verificabilidad. La escala no es de marcas, es de "qué tan
 * directamente puedo comprobar que este número es de este negocio HOY".
 *
 * `whatsapp_publicado` va arriba porque es la declaración más explícita que
 * existe: el negocio puso un enlace en su propio sitio que dice "escríbeme
 * acá". Y en una pyme chilena ese WhatsApp lo lee el dueño.
 *
 * `afirmado_por_base` va abajo no por desconfianza de una marca, sino porque
 * es lo único de la lista que NO se puede ir a comprobar: no hay una página
 * donde el negocio lo haya publicado.
 */
const PRIOR_CONTESTA: Record<TipoContacto, number> = {
  whatsapp_publicado: 0.80,
  ficha_google: 0.70,
  telefono_publicado: 0.70,
  telefono_en_texto: 0.45,
  afirmado_por_base: 0.40,
  email: 0,
};

/** Meses desde que se vio la evidencia más reciente. */
function mesesDesde(iso: string | undefined): number {
  if (!iso) return 99;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return 99;
  return (Date.now() - t) / (1000 * 60 * 60 * 24 * 30.4);
}

export type EstadoLinea = "activo" | "alcanzable" | "inactivo" | "desconocido";

/** Corrección medida por tipo de contacto, calculada con llamadas reales. */
export type TipoContactoAjuste = Partial<Record<TipoContacto, number>>;

export interface ContextoEvaluacion {
  /** Resultado de validar la línea contra la red (Twilio Lookup). */
  estadoLinea?: EstadoLinea;
  /** ¿Alguien ya llamó a este número y dijo que estaba equivocado? */
  marcadoComoMalo?: boolean;
  /** Corrección medida por tipo de contacto. Ver `ajustarPorHistorial`. */
  ajustes?: Partial<Record<TipoContacto, number>>;
}

/* ═══════════════ 2. ¿ESE ALGUIEN SIRVE? ═══════════════ */

/**
 * Cargos que pueden decidir o empujar una reunión en una pyme. El orden
 * importa: se usa para elegir por quién pedir cuando hay varias personas.
 */
export const CARGOS_UTILES: { patron: RegExp; peso: number; etiqueta: string }[] = [
  { patron: /due[nñ]|propietari|founder|fundador|socio/i, peso: 1.0, etiqueta: "dueño" },
  { patron: /gerente general|general manager|ceo|director ejecutivo/i, peso: 0.95, etiqueta: "gerencia general" },
  { patron: /gerente comercial|jefe de venta|jefa de venta|director comercial|head of sales/i, peso: 0.9, etiqueta: "comercial" },
  { patron: /administrador|administradora|jefe de sucursal|jefa de sucursal/i, peso: 0.8, etiqueta: "administración" },
  { patron: /gerente de operacion|jefe de operacion/i, peso: 0.75, etiqueta: "operaciones" },
  { patron: /marketing/i, peso: 0.6, etiqueta: "marketing" },
  { patron: /encargad[oa] de atencion|jefe de atencion|servicio al cliente/i, peso: 0.55, etiqueta: "atención" },
  { patron: /recepcion|secretari|asistente/i, peso: 0.15, etiqueta: "recepción" },
];

export function pesoDelCargo(cargo: string | undefined | null): { peso: number; etiqueta: string } {
  const c = (cargo ?? "").trim();
  if (!c) return { peso: 0, etiqueta: "" };
  for (const r of CARGOS_UTILES) if (r.patron.test(c)) return { peso: r.peso, etiqueta: r.etiqueta };
  return { peso: 0.4, etiqueta: "otro cargo" };
}

export interface Evaluacion {
  /** 0-100. Probabilidad estimada de terminar hablando con quien decide. */
  puntos: number;
  /** Las razones, en castellano, para mostrarlas al vendedor. */
  porQue: string[];
  /** Lo que hay que saber antes de marcar. */
  advertencia?: string;
}

export function evaluarContacto(
  c: ContactoConEvidencia,
  ctx: ContextoEvaluacion = {},
): Evaluacion {
  const porQue: string[] = [];
  if (c.tipo === "email") return { puntos: 0, porQue: ["es un correo, no un teléfono"] };

  // ── Cortes duros. Un número que ya se comprobó malo no se muestra más,
  //    por muy buena que sea su procedencia. Es la lección de la tanda de
  //    llamadas del 4-sep: el sistema seguía ofreciendo lo que ya había fallado.
  if (ctx.marcadoComoMalo) {
    return { puntos: 0, porQue: ["alguien ya llamó y dijo que el número está equivocado"], advertencia: "no volver a marcar" };
  }
  if (ctx.estadoLinea === "inactivo") {
    return { puntos: 0, porQue: ["la red dice que la línea no está asignada a nadie"], advertencia: "no volver a marcar" };
  }

  // ── 1. ¿Contesta alguien?
  let contesta = PRIOR_CONTESTA[c.tipo] ?? 0.3;
  porQue.push(ETIQUETA_TIPO[c.tipo]);

  const ajuste = ctx.ajustes?.[c.tipo];
  if (typeof ajuste === "number") {
    contesta = Math.max(0.05, Math.min(0.95, contesta * ajuste));
    porQue.push(`corregido con el resultado real de las llamadas (×${ajuste.toFixed(2)})`);
  }

  if (corroborado(c)) {
    contesta = Math.min(0.95, contesta * 1.25);
    porQue.push(`lo confirman ${metodosDistintos(c)} fuentes independientes`);
  }

  const meses = Math.min(...c.evidencias.map((e) => mesesDesde(e.cuando)));
  if (meses > 12) {
    contesta *= 0.7;
    porQue.push("el dato tiene más de un año");
  } else if (meses > 6) {
    contesta *= 0.85;
    porQue.push("el dato tiene más de seis meses");
  }

  if (ctx.estadoLinea === "alcanzable") {
    contesta = Math.min(0.97, contesta * 1.2);
    porQue.push("la red confirma que el teléfono está encendido ahora");
  } else if (ctx.estadoLinea === "activo") {
    contesta = Math.min(0.95, contesta * 1.1);
    porQue.push("la red confirma que la línea está activa");
  }

  // ── 2. ¿Sirve quien contesta?
  const movil = esMovil(c);
  const { peso: pesoCargo, etiqueta: etiquetaCargo } = pesoDelCargo(c.cargo);
  const conNombre = Boolean((c.persona ?? "").trim());

  let sirve: number;
  let advertencia: string | undefined;

  if (movil) {
    // En una pyme chilena el móvil publicado del negocio lo contesta quien
    // manda: es el mismo número con el que atiende clientes.
    sirve = 0.8;
    porQue.push("es un móvil: en una pyme lo contesta el dueño o quien atiende");
    if (conNombre) { sirve = 0.9; porQue.push(`sabemos por quién preguntar: ${c.persona}`); }
    if (pesoCargo >= 0.8) { sirve = Math.min(0.95, sirve + 0.05); porQue.push(`y su cargo decide (${etiquetaCargo})`); }
  } else {
    sirve = 0.3;
    advertencia = "Es un fijo: lo más probable es que conteste el mesón.";
    porQue.push("es un fijo: probablemente el mesón");
    if (conNombre) {
      sirve = 0.55;
      porQue.push(`pero sabemos por quién pedir: ${c.persona}`);
      advertencia = `Es un fijo. Pide por ${c.persona}${etiquetaCargo ? ` (${etiquetaCargo})` : ""} de entrada.`;
    }
    if (pesoCargo > 0 && pesoCargo < 0.3) {
      sirve *= 0.6;
      porQue.push("y el cargo que tenemos es de recepción");
    }
  }

  return { puntos: Math.round(contesta * sirve * 100), porQue, advertencia };
}

const ETIQUETA_TIPO: Record<TipoContacto, string> = {
  whatsapp_publicado: "el negocio publica este número como su WhatsApp",
  ficha_google: "es el teléfono de su Ficha de Empresa de Google",
  telefono_publicado: "está publicado en su propio sitio para que lo llamen",
  telefono_en_texto: "aparece escrito en su sitio, sin marcar como contacto",
  afirmado_por_base: "lo afirma una base externa; no hay dónde comprobarlo",
  email: "correo",
};

/* ═══════════════ 3. CÓMO SE CORRIGE CON LA REALIDAD ═══════════════ */

/**
 * Convierte el resultado real de las llamadas en un multiplicador por tipo.
 *
 * Regla explícita: por debajo de `minimo` llamadas NO se corrige nada. Es la
 * diferencia entre aprender y sobreajustar. Con 6 llamadas cualquier tasa es
 * ruido, y dejar que el ruido reordene la cola de mañana es peor que no
 * corregir.
 *
 * `base` es la tasa contra la que se compara: si un tipo conecta el doble que
 * el promedio, su multiplicador es 2 (topado).
 */
export function ajustarPorHistorial(
  historial: Partial<Record<TipoContacto, { llamadas: number; llegoAlDecisor: number }>>,
  minimo = 20,
): Partial<Record<TipoContacto, number>> {
  const entradas = Object.entries(historial) as [TipoContacto, { llamadas: number; llegoAlDecisor: number }][];
  const total = entradas.reduce((a, [, v]) => a + v.llamadas, 0);
  const aciertos = entradas.reduce((a, [, v]) => a + v.llegoAlDecisor, 0);
  if (total < minimo || aciertos === 0) return {};
  const base = aciertos / total;

  const out: Partial<Record<TipoContacto, number>> = {};
  for (const [tipo, v] of entradas) {
    if (v.llamadas < minimo) continue; // este tipo todavía no tiene volumen propio
    const tasa = v.llegoAlDecisor / v.llamadas;
    out[tipo] = Math.max(0.4, Math.min(2, tasa / base));
  }
  return out;
}

/* ═══════════════ 4. EL CAMINO HACIA EL DECISOR ═══════════════ */

/**
 * Un teléfono no es un plan. El vendedor necesita saber qué hacer si ese
 * número no contesta, y con qué frase abrir en cada caso.
 *
 * Esto arma la escalera completa —de lo mejor a lo peor— para que Tomás no
 * tenga que decidir nada en el momento: baja un escalón y sigue.
 */
export type Via =
  | "whatsapp" | "movil" | "fijo_con_nombre" | "fijo_con_cargo"
  | "email" | "linkedin" | "formulario";

export interface Paso {
  via: Via;
  valor: string;
  /** Qué decir. Literal, para leerlo en voz alta. */
  guion: string;
  puntos: number;
  porQue: string[];
  advertencia?: string;
}

export interface EntradaPlan {
  contactos: ContactoConEvidencia[];
  decisor?: { nombre?: string | null; cargo?: string | null } | null;
  linkedin?: string | null;
  web?: string | null;
  empresa: string;
  /** Estado de línea por clave de teléfono, si se validó. */
  lineas?: Record<string, EstadoLinea>;
  malos?: Set<string>;
  ajustes?: Partial<Record<TipoContacto, number>>;
}

/** El cargo por el que conviene pedir cuando no tenemos un nombre. */
export function cargoObjetivo(rubro: string | null | undefined): string {
  const r = (rubro ?? "").toLowerCase();
  if (/clinic|dental|medic|salud|kinesiolog|estetic/.test(r)) return "el administrador o la jefa de la clínica";
  if (/gimnasio|padel|cancha|deportiv/.test(r)) return "el administrador del recinto";
  if (/taller|automotriz|repuesto|moto/.test(r)) return "el jefe de taller o el dueño";
  if (/colegio|jardin|instituto|academia/.test(r)) return "el encargado de admisión";
  if (/inmobiliar|corretaje|propiedad/.test(r)) return "el jefe comercial";
  if (/hotel|cabana|restaurant|turismo/.test(r)) return "el administrador";
  return "el dueño o el encargado comercial";
}

export function armarPlan(e: EntradaPlan, rubro?: string | null): Paso[] {
  const nombre = (e.decisor?.nombre ?? "").trim();
  const cargo = (e.decisor?.cargo ?? "").trim();
  const { etiqueta } = pesoDelCargo(cargo);
  const pasos: Paso[] = [];

  const telefonos = e.contactos.filter((c) => c.tipo !== "email");
  const evaluados = telefonos
    .map((c) => {
      const ev = evaluarContacto(c, {
        estadoLinea: e.lineas?.[c.clave],
        marcadoComoMalo: e.malos?.has(c.clave),
        ajustes: e.ajustes,
      });
      return { c, ev };
    })
    .filter((x) => x.ev.puntos > 0)
    .sort((a, b) => b.ev.puntos - a.ev.puntos);

  for (const { c, ev } of evaluados) {
    const esWa = c.tipo === "whatsapp_publicado";
    const movil = esMovil(c);
    const quien = c.persona || nombre;

    let via: Via;
    let guion: string;
    if (esWa && movil) {
      via = "whatsapp";
      // Se llama, no se manda WhatsApp en frío: mandar mensaje sin permiso
      // previo viola la política de Meta y el riesgo cae sobre la cuenta del
      // cliente. El WhatsApp queda para DESPUÉS de que él lo pida.
      guion = quien
        ? `Llamar. «Hola, ¿hablo con ${quien}?» — es el número que publican como WhatsApp, así que lo lleva quien atiende.`
        : `Llamar. «Hola, ¿con quién tengo el gusto? Los vi en su sitio…» — es el número que publican como WhatsApp.`;
    } else if (movil) {
      via = "movil";
      guion = quien
        ? `Llamar. «Hola, ¿hablo con ${quien}?»`
        : `Llamar. «Hola, ¿con el encargado de ${e.empresa}?»`;
    } else if (quien) {
      via = "fijo_con_nombre";
      // Se usa el cargo TAL COMO viene, no mi etiqueta interna: «Dra. Paz Ríos,
      // dueño» suena mal y delata que lo armó una máquina. Y si el cargo no
      // aporta, el nombre solo basta.
      // "con Lucas Oberst, de gerente comercial" está mal dicho. El "de" solo
      // funciona con un área ("de ventas"), no con un cargo ("gerente
      // comercial"). El vendedor lee esto en voz alta: si suena raro, se nota.
      const esArea = /^(ventas|comercial|administraci[oó]n|operaciones|marketing|finanzas|recursos humanos)$/i.test(cargo.trim());
      const deArea = !cargo || /due[nñ]|propietari|socio/i.test(cargo)
        ? ""
        : esArea ? `, de ${cargo.toLowerCase()}` : `, ${cargo.toLowerCase()}`;
      guion = `Llamar y pedir por nombre: «Hola, ¿podría comunicarme con ${quien}${deArea}?»`;
    } else {
      via = "fijo_con_cargo";
      guion = `Llamar y pedir por cargo: «Hola, ¿podría comunicarme con ${cargoObjetivo(rubro)}?»`;
    }
    pasos.push({ via, valor: c.valor, guion, puntos: ev.puntos, porQue: ev.porQue, advertencia: ev.advertencia });
  }

  const correo = e.contactos.find((c) => c.tipo === "email");
  if (correo) {
    pasos.push({
      via: "email",
      valor: correo.valor,
      guion: nombre
        ? `Correo a ${nombre}, asunto corto y una sola pregunta.`
        : `Correo al buzón general. Pedir que lo deriven a ${cargoObjetivo(rubro)}.`,
      puntos: 15,
      porQue: ["hay correo publicado"],
    });
  }
  if (e.linkedin) {
    pasos.push({ via: "linkedin", valor: e.linkedin, guion: "Mensaje por LinkedIn, sin pitch: una pregunta.", puntos: 10, porQue: ["hay perfil de LinkedIn"] });
  }
  if (e.web) {
    pasos.push({ via: "formulario", valor: e.web, guion: "Último recurso: el formulario de su web.", puntos: 5, porQue: ["tiene sitio con formulario"] });
  }
  return pasos;
}

/* ═══════════════ 5. EN QUÉ MONTÓN VA ESTE LEAD ═══════════════ */

export const ESTADOS_LEAD = [
  "excelente", "buena", "via_central", "mejor_por_escrito", "insuficiente", "no_usar",
] as const;
export type EstadoLead = (typeof ESTADOS_LEAD)[number];

export const ESTADO_LEAD_LABEL: Record<EstadoLead, string> = {
  excelente: "Excelente para llamar",
  buena: "Buena probabilidad",
  via_central: "Contactable vía central",
  mejor_por_escrito: "Mejor por correo o LinkedIn",
  insuficiente: "Información insuficiente",
  no_usar: "No usar",
};

/** Verde/ámbar/gris/rojo. El vendedor trabaja de arriba hacia abajo. */
export const ESTADO_LEAD_TONO: Record<EstadoLead, "ok" | "warn" | "mut" | "danger"> = {
  excelente: "ok", buena: "ok", via_central: "warn",
  mejor_por_escrito: "mut", insuficiente: "mut", no_usar: "danger",
};

/**
 * El montón sale del MEJOR camino disponible, no del promedio. A un vendedor
 * no le sirve el promedio: le sirve saber si tiene UNA buena puerta.
 */
export function estadoDelLead(pasos: Paso[], suprimido = false): EstadoLead {
  if (suprimido) return "no_usar";
  const llamables = pasos.filter((p) => p.via !== "email" && p.via !== "linkedin" && p.via !== "formulario");
  const mejor = llamables[0];
  const puntos = mejor?.puntos ?? 0;
  if (puntos >= 60) return "excelente";
  if (puntos >= 40) return "buena";
  if (puntos >= 20) {
    // El nombre del montón describe el CAMINO, no solo la nota. Un móvil de 38
    // puntos no es "contactable vía central": no hay ninguna central de por
    // medio. Decirlo mal hace que el vendedor prepare la llamada equivocada.
    const porCentral = mejor?.via === "fijo_con_nombre" || mejor?.via === "fijo_con_cargo";
    return porCentral ? "via_central" : "buena";
  }
  if (pasos.some((p) => p.via === "email" || p.via === "linkedin")) return "mejor_por_escrito";
  return "insuficiente";
}
