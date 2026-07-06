import { clp } from "./format";
import { PLAN_LABEL, PLAN_LIMITES, PLAN_PRECIOS, type Deal } from "./types";

/**
 * Propuesta de 1 página en texto plano, lista para pegar en WhatsApp o
 * email — estructura del paquete comercial (DEMO_COMERCIAL, jul-2026).
 * NO inventa: usa los valores del deal; si están en 0 usa los de lista y
 * lo marca. Los campos que requieren juicio humano quedan como [rellenar].
 */
export function generarPropuesta(d: Deal): string {
  const lista = PLAN_PRECIOS[d.plan];
  const mensual = d.valor_mensual > 0 ? d.valor_mensual : lista.mensual;
  const setup = d.valor_setup > 0 ? d.valor_setup : lista.setup;
  const usaLista = d.valor_mensual <= 0 || d.valor_setup <= 0;

  return `PROPUESTA — ${d.nombre_negocio}
Respondo · Asistentes de ventas con IA para WhatsApp
${new Date().toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" })}

EL PROBLEMA
${d.rubro ? `En ${d.rubro}, las` : "Las"} consultas por WhatsApp que se responden tarde son ventas que se van al competidor — sobre todo fuera de horario y fines de semana. [Ajustar con lo conversado en la demo: volumen de consultas, quién responde hoy, horario ciego.]

LA SOLUCIÓN
Un asistente con IA en el WhatsApp de ${d.nombre_negocio} que:
- Responde consultas al instante, 24/7, con la información real del negocio.
- Cotiza con tu lista de precios (nunca inventa: si no sabe, deriva a tu equipo).
- Registra el contacto de cada interesado para que ninguna oportunidad se pierda.
- Agenda o deriva a una persona cuando corresponde.
La implementación completa la hacemos nosotros — tú no configuras nada.

PLAN RECOMENDADO: ${PLAN_LABEL[d.plan].toUpperCase()}
- Mensualidad: ${clp(mensual)} /mes (hasta ${PLAN_LIMITES[d.plan].toLocaleString("es-CL")} conversaciones/mes)${usaLista ? "  ← precio de lista, REVISAR ANTES DE ENVIAR" : ""}
- Implementación (una vez): ${clp(setup)}${usaLista ? "  ← precio de lista, REVISAR ANTES DE ENVIAR" : ""}
- [Si aplica Piloto Fundador: descuento en el setup a cambio de testimonio — indicar % y fecha de término]

GARANTÍA
Si en los primeros 30 días el asistente no cumple lo acordado en el alcance, lo ajustamos sin costo; si aun así no funciona, te devolvemos la mensualidad del primer mes. (El setup corresponde a trabajo ejecutado y no se devuelve.)

PRÓXIMO PASO
Me mandas tu lista de precios y preguntas frecuentes esta semana → lo tienes funcionando antes de [fecha]. ¿Partimos?

Marcelo Valdés — Respondo`;
}
