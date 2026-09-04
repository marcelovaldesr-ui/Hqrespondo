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

import { pareceNombreDePersona, podarNombre } from "@/lib/nombrePersona";
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
  afirmado_por_base: 0.32,
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

/**
 * Las TRES dimensiones, conservadas por separado.
 *
 * POR QUÉ NO UN SOLO NÚMERO — Marcelo, 4-sep-2026:
 * "Un WhatsApp publicado puede tener contactabilidad excelente + acceso al
 * decisor desconocido. Eso sigue siendo muchísimo mejor que un número muerto,
 * pero HQ debe comunicarlo correctamente."
 *
 * Tenía razón y yo lo estaba escondiendo. La versión anterior afirmaba que un
 * móvil publicado "lo contesta el dueño" y le ponía 0,8. Eso no es un dato: es
 * una suposición sobre un número que perfectamente puede ser el de la
 * recepcionista, la community manager o el turno de reservas.
 *
 * Ahora son tres preguntas distintas que no se pueden responder una con otra:
 *
 *   · CONFIANZA  — ¿estamos seguros de que este número es de esta empresa?
 *     Es la que manda sobre todas: si el dato no es de ellos, nada más importa.
 *   · ALCANCE    — si marco, ¿va a contestar alguien?
 *   · CERCANÍA   — quien conteste, ¿decide, o me puede pasar con quien decide?
 *
 * El puntaje agregado sigue existiendo para ordenar, pero las tres viajan
 * enteras hasta la ficha para que el vendedor vea DÓNDE está la debilidad.
 */
export interface Evaluacion {
  /** 0-100 agregado. Solo para ordenar; no reemplaza a las tres de abajo. */
  puntos: number;
  /** ¿Es de esta empresa? 0-100. */
  confianza: number;
  /** ¿Contestará alguien? 0-100. */
  alcance: number;
  /** ¿Quien conteste sirve? 0-100. */
  cercaniaDecisor: number;
  /** false = no sabemos quién atiende ese número. Se dice, no se disimula. */
  autoridadConocida: boolean;
  porQue: string[];
  advertencia?: string;
}

export function evaluarContacto(
  c: ContactoConEvidencia,
  ctx: ContextoEvaluacion = {},
): Evaluacion {
  const porQue: string[] = [];
  const cero = (motivo: string, aviso?: string): Evaluacion => ({
    puntos: 0, confianza: 0, alcance: 0, cercaniaDecisor: 0,
    autoridadConocida: false, porQue: [motivo], advertencia: aviso,
  });

  if (c.tipo === "email") return cero("es un correo, no un teléfono");

  // ── Cortes duros. Un número que ya se comprobó malo no se muestra más, por
  //    muy buena que sea su procedencia.
  if (ctx.marcadoComoMalo) return cero("alguien ya llamó y dijo que el número está equivocado", "no volver a marcar");
  if (ctx.estadoLinea === "inactivo") return cero("la red dice que la línea no está asignada a nadie", "no volver a marcar");

  /* ── DIMENSIÓN 1 · CONFIANZA: ¿es de esta empresa? ────────────────────── */
  let confianza = PRIOR_CONTESTA[c.tipo] ?? 0.3;
  porQue.push(ETIQUETA_TIPO[c.tipo]);

  const ajuste = ctx.ajustes?.[c.tipo];
  if (typeof ajuste === "number") {
    confianza = Math.max(0.05, Math.min(0.95, confianza * ajuste));
    porQue.push(`corregido con el resultado real de las llamadas (×${ajuste.toFixed(2)})`);
  }
  if (corroborado(c)) {
    confianza = Math.min(0.95, confianza * 1.25);
    porQue.push(`lo confirman ${metodosDistintos(c)} fuentes independientes`);
  }
  const meses = Math.min(...c.evidencias.map((e) => mesesDesde(e.cuando)));
  if (meses > 12) { confianza *= 0.7; porQue.push("el dato tiene más de un año"); }
  else if (meses > 6) { confianza *= 0.85; porQue.push("el dato tiene más de seis meses"); }

  /* ── DIMENSIÓN 2 · ALCANCE: ¿contestará alguien? ──────────────────────── */
  // Un número publicado por el negocio para recibir clientes se contesta: de
  // ahí le llega la venta. Uno que solo afirma una base, no se sabe.
  const PUBLICADO = c.tipo === "whatsapp_publicado" || c.tipo === "telefono_publicado" || c.tipo === "ficha_google";
  let alcance = PUBLICADO ? 0.85 : c.tipo === "telefono_en_texto" ? 0.6 : 0.5;
  if (ctx.estadoLinea === "alcanzable") { alcance = Math.min(0.97, alcance * 1.15); porQue.push("la red confirma que el teléfono está encendido ahora"); }
  else if (ctx.estadoLinea === "activo") { alcance = Math.min(0.95, alcance * 1.08); porQue.push("la red confirma que la línea está activa"); }

  /* ── DIMENSIÓN 3 · CERCANÍA AL DECISOR ───────────────────────────────── */
  const movil = esMovil(c);
  const { peso: pesoCargo, etiqueta: etiquetaCargo } = pesoDelCargo(c.cargo);
  const conNombre = Boolean((c.persona ?? "").trim());
  let cercania: number;
  let autoridadConocida = false;
  let advertencia: string | undefined;

  if (conNombre) {
    // Sabemos a quién pertenece. Acá sí se puede afirmar algo.
    autoridadConocida = true;
    cercania = movil ? 0.88 : 0.55;
    porQue.push(`sabemos de quién es: ${c.persona}`);
    if (pesoCargo >= 0.8) { cercania = Math.min(0.95, cercania + 0.05); porQue.push(`y su cargo decide (${etiquetaCargo})`); }
    else if (pesoCargo > 0 && pesoCargo < 0.3) { cercania *= 0.5; porQue.push("pero el cargo que tenemos es de recepción"); }
    if (!movil) advertencia = `Es un fijo. Pide por ${c.persona}${etiquetaCargo ? ` (${etiquetaCargo})` : ""} de entrada.`;
  } else if (movil && PUBLICADO) {
    // El caso que estaba mal contado. Alcance altísimo, autoridad DESCONOCIDA:
    // ese WhatsApp puede llevarlo el dueño, la recepción, ventas o quien
    // gestiona las redes. En una pyme suele estar a un paso del que manda,
    // pero eso es una probabilidad, no un hecho.
    cercania = 0.6;
    porQue.push("es el móvil que el negocio publica para sus clientes");
    advertencia = "No sabemos quién atiende ese número: puede ser el dueño o quien lleva las redes. Pregunta por el encargado apenas contesten.";
  } else if (movil) {
    cercania = 0.55;
    porQue.push("es un móvil, pero no sabemos de quién");
  } else {
    cercania = 0.28;
    porQue.push("es un fijo y no sabemos por quién preguntar");
    advertencia = "Es un fijo sin nombre: lo más probable es que conteste el mesón.";
  }

  const puntos = Math.round(confianza * alcance * cercania * 100);
  return {
    puntos,
    confianza: Math.round(confianza * 100),
    alcance: Math.round(alcance * 100),
    cercaniaDecisor: Math.round(cercania * 100),
    autoridadConocida,
    porQue,
    advertencia,
  };
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
  /**
   * ¿Se puede señalar el lugar donde este número está publicado?
   * false = lo afirma una base externa y no hay dónde ir a comprobarlo. Es la
   * diferencia que la corrida del 4-sep dejó a la vista: leads sin sitio web
   * salían como "Buena probabilidad" apoyados solo en un número que nadie
   * verificó — justo la categoría que ya había fallado en las llamadas.
   */
  verificable: boolean;
  /** Las tres dimensiones, para que la ficha muestre dónde está la debilidad. */
  confianza?: number;
  alcance?: number;
  cercaniaDecisor?: number;
  /** false = no sabemos quién atiende ese número. */
  autoridadConocida?: boolean;
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

/**
 * ¿Se le puede decir "¿hablo con X?" a esto?
 *
 * La corrida real del 4-sep sobre 20 leads devolvió estos guiones:
 *   «Hola, ¿hablo con CECINAS SAN ANDRES 💪💪💪💪?»
 *   «Hola, ¿hablo con V?»
 *   «Hola, ¿hablo con Go Models Chile 💛🖤?»
 *
 * El campo `contacto` de la base no siempre trae una persona: a veces trae el
 * nombre del negocio copiado de Instagram, con emojis, o una inicial suelta.
 * Un guion así no es un detalle feo — hace quedar en ridículo al vendedor en
 * el primer segundo de la llamada, que es justo donde se juega todo.
 *
 * `pareceNombreDePersona` ya existía en el proyecto y sirve exacto: pide entre
 * dos y cuatro palabras, todas de letras, ninguna de rubro ni de relleno web.
 */
function nombreUsable(bruto: string | null | undefined, empresa?: string): string {
  const n = podarNombre((bruto ?? "").trim());
  if (!n || !pareceNombreDePersona(n)) return "";

  // Si el "nombre" es en realidad el nombre del negocio, no es una persona.
  //
  // La corrida sobre 50 leads reales del 4-sep lo dejó a la vista:
  //   «Hola, ¿hablo con Grupo Isan?»
  //   «Hola, ¿hablo con Furiosos Bikes?»
  //   «Hola, ¿hablo con Casa Tarjetas Lua?»
  // Los tres pasan el filtro de "parece nombre de persona" —dos palabras, solo
  // letras— porque no hay forma de saberlo mirando el texto solo. Pero sí
  // mirándolo AL LADO del nombre de la empresa: si la mitad o más de sus
  // palabras están en el nombre del negocio, es el negocio.
  if (empresa) {
    const norm = (x: string) =>
      x.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
       .split(/[^a-z0-9]+/).filter((w) => w.length > 2);
    const delNegocio = new Set(norm(empresa));
    const toks = norm(n);
    if (toks.length) {
      const comunes = toks.filter((t) => delNegocio.has(t)).length;
      if (comunes / toks.length >= 0.5) return "";
    }
  }
  // "JAIME PEREZ" en mayúsculas se lee como un grito. Se pasa a capitalización
  // normal, respetando las partículas.
  return n
    .toLocaleLowerCase("es-CL")
    .split(/\s+/)
    .map((w) => (["de", "del", "la", "las", "los", "y"].includes(w) ? w : w.charAt(0).toLocaleUpperCase("es-CL") + w.slice(1)))
    .join(" ");
}

export function armarPlan(e: EntradaPlan, rubro?: string | null): Paso[] {
  const nombre = nombreUsable(e.decisor?.nombre, e.empresa);
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
    const quien = nombreUsable(c.persona, e.empresa) || nombre;

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
    const verificable = c.evidencias.some(
      (x) => x.metodo !== "base_externa" && x.metodo !== "a_mano",
    );
    pasos.push({
      via, valor: c.valor, guion, puntos: ev.puntos, porQue: ev.porQue,
      advertencia: ev.advertencia, verificable,
      confianza: ev.confianza, alcance: ev.alcance,
      cercaniaDecisor: ev.cercaniaDecisor, autoridadConocida: ev.autoridadConocida,
    });
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
      verificable: true,
    });
  }
  if (e.linkedin) {
    pasos.push({ via: "linkedin", valor: e.linkedin, guion: "Mensaje por LinkedIn, sin pitch: una pregunta.", puntos: 10, porQue: ["hay perfil de LinkedIn"], verificable: true });
  }
  if (e.web) {
    pasos.push({ via: "formulario", valor: e.web, guion: "Último recurso: el formulario de su web.", puntos: 5, porQue: ["tiene sitio con formulario"], verificable: true });
  }
  // Se ordena TODO por puntaje, no primero los teléfonos y después lo escrito.
  // Si el mejor teléfono da 14 puntos y hay un correo publicado que da 15, el
  // correo va primero — y así el rótulo del lead ("Mejor por correo") deja de
  // contradecir al primer paso de su propio plan, que es lo que pasaba con
  // Instituto Médico Schilkrut en la corrida del 4-sep.
  return pasos.sort((a, b) => b.puntos - a.puntos);
}

/* ═══════════════ 5. EN QUÉ MONTÓN VA ESTE LEAD ═══════════════ */

export const ESTADOS_LEAD = [
  "excelente", "buena", "sin_verificar", "via_central", "mejor_por_escrito", "insuficiente", "no_usar",
] as const;
export type EstadoLead = (typeof ESTADOS_LEAD)[number];

export const ESTADO_LEAD_LABEL: Record<EstadoLead, string> = {
  excelente: "Excelente para llamar",
  buena: "Buena probabilidad",
  sin_verificar: "Número sin verificar",
  via_central: "Contactable vía central",
  mejor_por_escrito: "Mejor por correo o LinkedIn",
  insuficiente: "Información insuficiente",
  no_usar: "No usar",
};

/** Verde/ámbar/gris/rojo. El vendedor trabaja de arriba hacia abajo. */
export const ESTADO_LEAD_TONO: Record<EstadoLead, "ok" | "warn" | "mut" | "danger"> = {
  excelente: "ok", buena: "ok", sin_verificar: "warn", via_central: "warn",
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

  // Un número que nadie verificó no puede presentarse como "buena
  // probabilidad", por muy móvil que sea y por mucho nombre que traiga al
  // lado. Es exactamente lo que ya falló: de 13 llamadas a móviles, 9 no
  // hablaron con nadie. Decirle al vendedor lo que de verdad tenemos —un
  // número sin respaldo— es lo que le permite decidir si lo marca ahora o lo
  // deja para el final del día.
  if (mejor && !mejor.verificable) return "sin_verificar";

  // Los umbrales bajaron respecto de la versión anterior porque el puntaje
  // ahora es el producto de TRES dimensiones y no de dos: los mismos leads dan
  // números más bajos sin haber empeorado. Se recalibró contra la corrida real
  // sobre los 50 leads del 4-sep para que los montones sigan significando lo
  // mismo.
  if (puntos >= 45) return "excelente";
  if (puntos >= 28) return "buena";
  if (puntos >= 15) {
    // El nombre del montón describe el CAMINO, no solo la nota. Un móvil de 38
    // puntos no es "contactable vía central": no hay ninguna central de por
    // medio. Decirlo mal hace que el vendedor prepare la llamada equivocada.
    const porCentral = mejor?.via === "fijo_con_nombre" || mejor?.via === "fijo_con_cargo";
    return porCentral ? "via_central" : "buena";
  }
  if (pasos.some((p) => p.via === "email" || p.via === "linkedin")) return "mejor_por_escrito";
  return "insuficiente";
}

/* ═══════════════ 6. PRIORIDAD COMERCIAL — los dos motores juntos ═══════════ */

/**
 * A quién debe llamar Tomás PRIMERO.
 *
 * POR QUÉ NO ES NINGUNO DE LOS DOS SOLO — Marcelo, 4-sep-2026:
 * "Un excelente contacto de una empresa que nunca compraría Respondo NO debe
 * superar a una empresa de nuestro ICP simplemente porque tenga mejores datos."
 *
 * Y al revés tampoco: una empresa perfecta a la que no hay forma de llegar no
 * merece el primer lugar de la lista de hoy — merece la cola de investigación.
 *
 * POR QUÉ SE MULTIPLICA Y NO SE PROMEDIA
 * Porque las dos son necesarias. Un promedio deja que una tape a la otra: una
 * empresa con oportunidad 95 y contactabilidad 10 promedia 52 y se cuela
 * arriba, cuando en la práctica el vendedor no va a poder hablar con nadie.
 * Multiplicando, el que falla en cualquiera de las dos cae — que es lo que
 * pasa de verdad.
 *
 * La raíz cuadrada al final es cosmética: devuelve el resultado a una escala
 * de 0-100 legible, sin cambiar el orden.
 */
export function prioridadComercial(
  oportunidad: number,   // 0-100 · lib/oportunidad.ts
  contactabilidad: number, // 0-100 · el mejor paso del plan
): number {
  const o = Math.max(0, Math.min(100, oportunidad)) / 100;
  const c = Math.max(0, Math.min(100, contactabilidad)) / 100;
  return Math.round(Math.sqrt(o * c) * 100);
}

/**
 * Lo que el vendedor tiene que entender en un segundo: ¿esto merece mi tiempo
 * AHORA, o es trabajo de escritorio?
 *
 * "Vale la pena investigar" es una respuesta legítima y hasta ahora no
 * existía: el lead con buen fit y sin camino de contacto se mezclaba con los
 * llamables y le gastaba el turno a Tomás.
 */
export type Veredicto = "llamar_ahora" | "llamar_despues" | "investigar" | "no_ahora";

export const VEREDICTO_LABEL: Record<Veredicto, string> = {
  llamar_ahora: "Llamar ahora",
  llamar_despues: "Llamar después",
  investigar: "Falta cómo contactarlo",
  no_ahora: "No vale el tiempo ahora",
};

export const VEREDICTO_TONO: Record<Veredicto, "ok" | "warn" | "mut" | "danger"> = {
  llamar_ahora: "ok", llamar_despues: "warn", investigar: "mut", no_ahora: "danger",
};

export function veredictoDelLead(opts: {
  oportunidad: number;
  nivelOportunidad: "alta" | "media" | "baja" | "no_ahora";
  contactabilidad: number;
}): Veredicto {
  // El fit manda primero: si la empresa no nos sirve, da lo mismo lo bien
  // contactable que sea. Es el principio que Marcelo puso arriba de todo.
  if (opts.nivelOportunidad === "no_ahora") return "no_ahora";

  // "Investigar" quiere decir UNA cosa: no hay por dónde entrar. Buen fit y
  // ningún camino no es un fracaso, es trabajo de escritorio.
  //
  // CORRECCIÓN 4-sep-2026, salida de la corrida real sobre 50 leads.
  // Antes esta rama también se disparaba cuando la prioridad quedaba baja
  // AUNQUE hubiera un teléfono. Sotos aparecía con «Falta cómo contactarlo»
  // y su número móvil impreso justo al lado. Además de leerse como un error
  // de la herramienta, mandaba a la cola de escritorio a ocho empresas de
  // buen encaje cuya única tarea pendiente era marcar un número.
  //
  // Un número sin verificar no es "falta de camino": es un camino barato.
  // Probarlo CUESTA dos minutos y ES la investigación. Va a "llamar después",
  // detrás de los verificados, con su etiqueta de SIN VERIFICAR a la vista.
  const sinCamino = opts.contactabilidad <= 0;
  if (sinCamino) return opts.nivelOportunidad === "alta" ? "investigar" : "no_ahora";

  const p = prioridadComercial(opts.oportunidad, opts.contactabilidad);
  if (p >= 55) return "llamar_ahora";
  if (p >= 35) return "llamar_despues";
  // Hay camino y el fit es bueno: se llama, aunque sea al final de la lista.
  // Lo que NO se hace es fingir que no hay nada que probar.
  return opts.nivelOportunidad === "alta" ? "llamar_despues" : "no_ahora";
}
