/**
 * Generación de mensajes del agente (email + LinkedIn) con Gemini.
 *
 * Reutiliza la VOZ DE FUNDADOR ya afinada en lib/prospeccionAI.ts
 * (REGLAS_TONO, anclaRubro, PROHIBIDO) para no reinventar el tono ni volver a
 * sonar a plantilla. Aquí solo cambiamos el CANAL (email tiene asunto y cuerpo;
 * LinkedIn tiene tope de 300 caracteres) y el ÁNGULO según el toque.
 *
 * Email: se piden 3 variantes y se elige la mejor con una heurística barata
 * (no otra llamada a la IA). LinkedIn: una sola línea, corta.
 */
import { gemini, geminiJson } from "../gemini";
import { REGLAS_TONO, anclaRubro, type ProspectoMin } from "../prospeccionAI";
import type { Toque } from "./tipos";

const DEMO = process.env.NEXT_PUBLIC_DEMO_LINK || "https://www.respon-do.com";

export interface EmailRedactado {
  asunto: string;
  cuerpo: string;
}

/** Describe la tarea concreta del email según el ángulo del toque. */
function tareaEmail(t: Toque, p: ProspectoMin): string {
  switch (t.angulo) {
    case "caso_exito":
      return `Segundo email (no respondió al primero). Cuenta breve y CREÍBLE cómo un negocio parecido a "${p.nombre}" dejó de perder consultas fuera de horario desde que su WhatsApp responde solo. Sin cifras inventadas ni nombres falsos: habla del cambio ("antes se acumulaban mensajes de la noche, ahora se responden al toque"). Invita a ver la demo → ${DEMO}.`;
    case "pregunta_abierta":
      return `Tercer email. UNA sola pregunta abierta, fácil de contestar, sobre su operación real (ej: cuántos mensajes creen que quedan sin responder un fin de semana). Nada de vender. Que dé pie a que respondan una línea.`;
    case "cierre":
      return `Último email de la secuencia. Cierre honesto y sin culpa: si no es el momento, perfecto; si quieren, la demo sigue en pie → ${DEMO}. Deja la puerta abierta sin insistir. Menciona que el primer mes de servicio va gratis (el setup se cobra normal).`;
    default: // apertura
      return `Primer email en frío a "${p.nombre}". Abre con el dolor del rubro en forma de pregunta sobre su día a día. El objetivo es abrir conversación, no vender. Cierre = invitar a probar la demo como si fueran un cliente → ${DEMO}. Máximo 90 palabras el cuerpo.`;
  }
}

/**
 * Redacta un email: pide 3 variantes a Gemini y elige la mejor.
 * Devuelve {asunto, cuerpo}. Si la IA falla, lanza (el caller decide reintento).
 */
export async function redactarEmail(
  t: Toque,
  p: ProspectoMin,
): Promise<EmailRedactado> {
  const notas = p.notas?.trim()
    ? `Notas reales sobre este prospecto (úsalas para personalizar): ${p.notas.trim()}`
    : "";

  const prompt = `${anclaRubro(p.rubro)}
Negocio: ${p.nombre}${p.comuna ? ` (${p.comuna})` : ""}.
${notas}

${REGLAS_TONO}

CANAL: EMAIL (no WhatsApp). Igual: cero jerga, suena a persona. Asunto corto (máx 6 palabras), en minúscula tipo email real de una persona, SIN clickbait ni signos de exclamación. Cuerpo en 2ª persona, párrafos de 1–2 líneas, con un saludo y una firma simple ("Marcelo, Respondo").

TAREA: ${tareaEmail(t, p)}

Dame 3 variantes con ÁNGULOS DISTINTOS. Responde SOLO JSON válido, sin markdown:
{"variantes":[{"asunto":"...","cuerpo":"..."},{"asunto":"...","cuerpo":"..."},{"asunto":"...","cuerpo":"..."}]}`;

  const out = await geminiJson<{ variantes?: EmailRedactado[] }>(prompt, undefined, {
    temperature: 1.0,
    topP: 0.95,
    maxOutputTokens: 900,
    thinkingConfig: { thinkingBudget: 0 },
  });

  const vs = (out?.variantes ?? []).filter(
    (v) => v?.asunto?.trim() && v?.cuerpo?.trim(),
  );
  if (!vs.length) throw new Error("La IA no devolvió variantes de email");
  return elegirMejorEmail(vs);
}

/**
 * Heurística barata para elegir variante (sin otra llamada a la IA):
 * penaliza jerga prohibida y asuntos largos; premia asunto corto tipo humano
 * y cuerpo en el rango de largo adecuado.
 */
export function elegirMejorEmail(vs: EmailRedactado[]): EmailRedactado {
  const PROHIBIDAS =
    /soluci[oó]n|optimiz|automatiz|inteligencia artificial|\bIA\b|revolucionari|disruptiv|potenciar|aprovech|¿te gustar[ií]a saber m[aá]s\?/i;
  const puntaje = (e: EmailRedactado): number => {
    let s = 0;
    const palabrasAsunto = e.asunto.trim().split(/\s+/).length;
    if (palabrasAsunto <= 6) s += 3;
    if (/^[a-záéíóúñ]/.test(e.asunto.trim())) s += 1; // minúscula = tono humano
    if (e.asunto.includes("!")) s -= 2;
    const largo = e.cuerpo.trim().split(/\s+/).length;
    if (largo >= 40 && largo <= 130) s += 3;
    if (PROHIBIDAS.test(`${e.asunto} ${e.cuerpo}`)) s -= 5;
    if (/\[nombre\]|\[negocio\]/i.test(e.cuerpo)) s -= 5; // placeholder sin rellenar
    return s;
  };
  return [...vs].sort((a, b) => puntaje(b) - puntaje(a))[0];
}

/**
 * Mensaje de LinkedIn. num=conexión → connection request (<300 chars).
 * num=mensaje → mensaje tras aceptar. El humano lo copia y lo envía a mano.
 */
export async function redactarLinkedin(
  t: Toque,
  p: ProspectoMin,
): Promise<string> {
  const esConexion = t.angulo === "conexion_linkedin";
  const limite = esConexion ? 300 : 500;
  const tarea = esConexion
    ? `Escribe un mensaje de SOLICITUD DE CONEXIÓN de LinkedIn para el dueño/encargado de "${p.nombre}". MÁXIMO 280 caracteres (límite duro de LinkedIn). Cálido, específico del rubro, sin vender. Solo abrir la puerta.`
    : `Escribe un mensaje corto de LinkedIn (ya aceptó la conexión) para el dueño de "${p.nombre}". Retoma con algo útil del rubro e invita a ver la demo → ${DEMO}. Máximo 400 caracteres.`;

  const prompt = `${anclaRubro(p.rubro)}
Negocio: ${p.nombre}${p.comuna ? ` (${p.comuna})` : ""}.

${REGLAS_TONO}

CANAL: LinkedIn. Trato profesional pero cercano, 1ª persona (eres Marcelo).
TAREA: ${tarea}

Responde SOLO con el texto del mensaje, sin comillas ni explicación.`;

  const texto = (await gemini(prompt, undefined, {
    temperature: 0.9,
    maxOutputTokens: 300,
    thinkingConfig: { thinkingBudget: 0 },
  })).trim();

  // Salvaguarda dura del límite de caracteres.
  return texto.length > limite ? texto.slice(0, limite - 1).trim() + "…" : texto;
}
