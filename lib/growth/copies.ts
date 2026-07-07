import type { CopySnippet, CopyTipo } from "./types";

/**
 * BIBLIOTECA DE COPIES reutilizables.
 * Fuente: OBJECIONES_RESPONDO.md, MENSAJES_PROSPECCION_RESPONDO.md,
 * INSTAGRAM_RESPONDO.md (hooks + datos-ancla) y tono-de-marca.
 * Reglas de tono: dolor y resultado (no tecnología), frases cortas, 2ª persona,
 * 1–2 emojis máx. Prohibido: "revolucionario/disruptivo/solución integral/
 * potenciar/vende 10x". Datos-ancla: 78% compra al primero · <1 min = 8x ·
 * LATAM 2–4 h · −3–5% de cierre por minuto.
 */

let n = 0;
function c(
  tipo: CopyTipo,
  texto: string,
  extra: Partial<CopySnippet> = {},
): CopySnippet {
  n += 1;
  return {
    id: `copy-${String(n).padStart(3, "0")}`,
    tipo,
    texto,
    canal: extra.canal ?? null,
    rubro: extra.rubro ?? null,
    funnel: extra.funnel ?? null,
    objetivo: extra.objetivo ?? null,
    fuente: extra.fuente,
  };
}

export const COPIES: CopySnippet[] = [
  /* ---------------- HOOKS (20) ---------------- */
  c("hook", "El 78% le compra al primero que responde. ¿Ese eres tú?", { funnel: "descubrimiento", fuente: "dato-ancla" }),
  c("hook", "Un cliente que espera 15 minutos ya está hablando con tu competencia.", { funnel: "descubrimiento" }),
  c("hook", "Mientras duermes, tus clientes te escriben. ¿Quién les contesta?", { funnel: "descubrimiento" }),
  c("hook", "La cotización que llega tarde es venta del competidor.", { funnel: "descubrimiento", rubro: "ferreterias" }),
  c("hook", "Le intenté sacar un precio inventado a nuestro bot. No pudo. 😉", { funnel: "consideracion", fuente: "reto-producto" }),
  c("hook", "No pierdes ventas por malas: las pierdes por lentas.", { funnel: "descubrimiento" }),
  c("hook", "Tu WhatsApp a las 2 AM: 12 mensajes, 0 respuestas.", { funnel: "descubrimiento" }),
  c("hook", "Un lead contactado en menos de 5 minutos convierte ~100x más.", { funnel: "descubrimiento", rubro: "inmobiliarias", fuente: "dato-ancla" }),
  c("hook", "¿Cuántas ventas se te van por contestar a las 3 horas?", { funnel: "descubrimiento" }),
  c("hook", "El problema no es recibir pocos mensajes. Es responder tarde.", { funnel: "descubrimiento" }),
  c("hook", "Un bot que te hace apretar '3' para volver al menú no es un asistente.", { funnel: "consideracion", fuente: "mercado-quemado" }),
  c("hook", "Terminas atendiendo el WhatsApp tú mismo, a las 11 de la noche.", { funnel: "descubrimiento" }),
  c("hook", "Responder al tiro no es tener suerte. Es tener un sistema.", { funnel: "consideracion" }),
  c("hook", "Publicamos nuestros precios. Nadie en el rubro lo hace. Por eso lo hacemos.", { funnel: "consideracion", fuente: "transparencia" }),
  c("hook", "Una persona en el WhatsApp: $650.000+ al mes. Un asistente: desde $79.000.", { funnel: "consideracion", fuente: "anclaje" }),
  c("hook", "Tu vendedor perdiendo el día en '¿cuánto vale?' es plata en el suelo.", { funnel: "descubrimiento" }),
  c("hook", "No te dejamos solo: lo implementamos y lo acompañamos nosotros.", { funnel: "consideracion", fuente: "diferenciador" }),
  c("hook", "La IA no reemplaza a tu vendedor. Le saca lo aburrido.", { funnel: "consideracion" }),
  c("hook", "3 errores que arruinan un bot de WhatsApp (y cómo evitarlos).", { funnel: "consideracion" }),
  c("hook", "Cada minuto que tardas en responder, pierdes 3–5% de la venta.", { funnel: "descubrimiento", fuente: "dato-ancla" }),

  /* ---------------- CTAs (20) ---------------- */
  c("cta", "Escríbele a la demo como si fueras cliente 👇", { funnel: "decision" }),
  c("cta", "Trata de sacarle un precio inventado. Te esperamos.", { funnel: "decision" }),
  c("cta", "Agenda una demo de 20 minutos → link", { funnel: "decision", canal: "instagram" }),
  c("cta", "Guarda esto para cuando tu WhatsApp explote.", { funnel: "descubrimiento" }),
  c("cta", "Etiqueta al dueño de negocio que necesita ver esto.", { funnel: "descubrimiento" }),
  c("cta", "¿Tu rubro es este? Escríbenos y te mostramos cómo quedaría.", { funnel: "consideracion" }),
  c("cta", "Postula al Piloto Fundador: quedan pocos cupos.", { funnel: "decision" }),
  c("cta", "Comenta COTIZA y te mandamos la demo al DM. (Mes 2)", { funnel: "decision", canal: "instagram" }),
  c("cta", "Pídele cotizar como si fueras cliente → link demo", { funnel: "decision" }),
  c("cta", "Mándanos tu lista de precios y lo dejamos andando esta semana.", { funnel: "decision" }),
  c("cta", "¿Cuántos mensajes te llegan al día? Cuéntanos y lo dimensionamos.", { funnel: "consideracion" }),
  c("cta", "Sigue la cuenta si vendes por WhatsApp. Esto es para ti.", { funnel: "descubrimiento" }),
  c("cta", "Prueba la demo antes de decidir si vale la pena conversar.", { funnel: "consideracion" }),
  c("cta", "Hablemos 15 minutos. Sin compromiso.", { funnel: "decision" }),
  c("cta", "Mira cómo deriva a un humano cuando no sabe algo.", { funnel: "consideracion" }),
  c("cta", "Escríbenos 'quiero la demo' y te la mandamos.", { funnel: "decision", canal: "whatsapp" }),
  c("cta", "¿Perdiste una venta por contestar tarde esta semana? Conversemos.", { funnel: "decision" }),
  c("cta", "Reserva tu cupo del Piloto Fundador antes de que se acaben.", { funnel: "decision" }),
  c("cta", "Compárte esto con tu socio y lo vemos los tres.", { funnel: "decision" }),
  c("cta", "Deja el 'lo veo después' para después. La demo toma 30 segundos.", { funnel: "decision" }),

  /* ---------------- CAPTIONS (base editable) ---------------- */
  c("caption", "El 78% de la gente le compra al primer negocio que le responde. En Chile y LATAM el promedio para contestar un WhatsApp es de 2 a 4 horas. Ahí se pierden ventas todos los días — no por malas, por lentas. Un asistente de ventas responde al tiro, cotiza con tus precios reales y te guarda el contacto de cada interesado. Pruébalo tú mismo 👇", { canal: "instagram", funnel: "descubrimiento" }),
  c("caption", "\"¿Y si el bot responde cualquier cosa?\" Es LA pregunta. Por eso el asistente solo responde con la información que TÚ nos das. Si no la tiene, no inventa: dice que lo consulta y deriva a tu equipo. Lo probamos contigo antes de encenderlo. Escríbele a la demo y trata de sacarle un precio que no tenga 😉", { canal: "instagram", funnel: "consideracion" }),
  c("caption", "No te dejamos solo. No somos una plataforma donde configuras todo tú y después nadie te contesta. Lo implementamos nosotros, lo probamos contigo hasta que digas 'así hablaría yo', y seguimos ahí después. Con nosotros hablas directo con los fundadores.", { canal: "instagram", funnel: "consideracion" }),
  c("caption", "Ferretería: cotiza todo el día sin frenar el mostrador. Cuando un contratista pide precio y stock un sábado, la cotización que llega tarde es venta del competidor. El asistente cotiza al instante con tu lista real y te avisa quién la pidió para cerrar. Demo con cotización de cemento 👇", { canal: "instagram", rubro: "ferreterias", funnel: "descubrimiento" }),
  c("caption", "Estamos construyendo Respondo entre dos personas, desde Chile. Cada semana aprendemos algo nuevo vendiéndole IA a pymes reales. Hoy te contamos qué funcionó y qué no. Si vas construyendo algo parecido, conversemos 👇", { canal: "instagram", funnel: "descubrimiento", fuente: "founder" }),

  /* ---------------- POSICIONAMIENTO ---------------- */
  c("posicionamiento", "El asistente de ventas inteligente para WhatsApp de las empresas latinoamericanas.", { fuente: "posicionamiento-marca" }),
  c("posicionamiento", "IA para tu WhatsApp: responde, cotiza y agenda — sin perder leads fuera de horario.", {}),
  c("posicionamiento", "Automatiza lo repetitivo. Lo humano lo dejamos humano.", {}),
  c("posicionamiento", "Implementado por nosotros, acompañado por nosotros. No te dejamos solo.", {}),
  c("posicionamiento", "Tu WhatsApp responde al tiro, aunque estés ocupado. Y nunca inventa.", {}),

  /* ---------------- OBJECIONES (respuestas cortas) ---------------- */
  c("objecion", "\"Está caro\" → ¿Cuánto vale una venta promedio tuya? Si se te escapan 2–3 al mes por contestar tarde, esto ya se pagó. Y si el presupuesto no da, partamos con el Inicial y subes cuando el volumen lo pida.", { fuente: "OBJECIONES §1", funnel: "decision" }),
  c("objecion", "\"Ya respondo yo\" → Y lo haces mejor que nadie. La pregunta es: ¿a qué hora dejas de responder? El asistente te cubre las horas en que duermes, atiendes o estás en terreno.", { fuente: "OBJECIONES §2" }),
  c("objecion", "\"No quiero una IA hablando con mis clientes\" → Sano escepticismo. Pruébalo tú mismo: responde con tu información, con buen tono, y cuando algo se sale de libreto deriva a un humano en vez de inventar.", { fuente: "OBJECIONES §4" }),
  c("objecion", "\"¿Y si responde mal?\" → Tres capas: solo responde con tu info; lo probamos contigo antes de encender; y el primer mes lo ajustamos sin costo.", { fuente: "OBJECIONES §5" }),
  c("objecion", "\"¿Puede inventar precios?\" → No, es regla de diseño: cotiza solo con tu lista. Si le preguntan algo que no está, dice que lo confirma con el equipo.", { fuente: "OBJECIONES §6" }),
  c("objecion", "\"Ya tengo WhatsApp Business\" → Perfecto, es la base. Nosotros agregamos que conteste, cotice y registre solo, 24/7. Es la diferencia entre tener el teléfono y tener a alguien contestándolo.", { fuente: "OBJECIONES §7" }),
  c("objecion", "\"Lo veo más adelante\" → ¿Qué cambia de aquí a entonces? Cada mes son consultas que no vuelven. Y el descuento Fundador es para los primeros 5.", { fuente: "OBJECIONES §8", funnel: "decision" }),
  c("objecion", "\"¿Por qué no un chatbot más barato?\" → Esos son menús de botones que configuras tú. Lo nuestro es conversación real con tus precios, implementada por nosotros. No competimos con los de $15.000; competimos con las ventas que pierdes.", { fuente: "OBJECIONES §11" }),

  /* ---------------- PROSPECCIÓN (primer toque) ---------------- */
  c("prospeccion", "Hola [nombre], soy Marcelo de Respondo 👋 Vi [observación real]. Una consulta corta: cuando les escriben por WhatsApp fuera de horario, ¿alcanzan a responder o se quedan consultas en el camino?", { canal: "whatsapp", fuente: "MENSAJES §1", funnel: "descubrimiento" }),
  c("prospeccion", "Hola [nombre]! Vi que les preguntan harto por precios y horas en los comentarios 👀 ¿Eso lo responden ustedes a mano o tienen algo que ayude?", { canal: "instagram", fuente: "MENSAJES §2" }),
  c("prospeccion", "[nombre], te dejo esto por si te sirve verlo en 30 segundos: nuestro asistente funcionando de verdad. Escríbele 'hola' y pregúntale precios como si fueras cliente → [link demo].", { canal: "whatsapp", fuente: "MENSAJES §5 (follow-up 1)", funnel: "consideracion" }),
  c("prospeccion", "Hola [nombre] 👋 Último mensaje, prometido. Un dato y me voy: el 78% le compra al primero que responde, y el promedio en Chile es de 2 a 4 horas. Si quieres ver cuántas ventas se te van por ahí, me escribes. ¡Éxito con [negocio]!", { canal: "whatsapp", fuente: "MENSAJES §6 (follow-up 2)", funnel: "consideracion" }),
  c("prospeccion", "[nombre], gracias por el tiempo de hoy. Te resumo: el asistente respondería 24/7, cotizaría con tu lista y registraría cada interesado. Plan recomendado: [plan] — $[X]/mes + implementación $[Y] (con descuento Fundador te queda en $[Z]). ¿Partimos?", { canal: "whatsapp", fuente: "MENSAJES §7 (post-demo)", funnel: "decision" }),

  /* ---------------- INTROS / CIERRES DE VIDEO ---------------- */
  c("intro_video", "Si vendes por WhatsApp, esto te va a doler un poco: [dato/dolor].", { canal: "instagram" }),
  c("intro_video", "Te apuesto a que ahora mismo tienes mensajes sin responder.", { canal: "instagram" }),
  c("intro_video", "Le pedí a nuestro bot algo imposible. Mira lo que hizo.", { canal: "instagram" }),
  c("cierre_video", "Pruébalo tú mismo, sin hablar con nadie. Link en la bio.", { canal: "instagram" }),
  c("cierre_video", "Y si no es para ti, capaz conoces a alguien que sí lo necesita. Compártelo.", { canal: "instagram" }),

  /* ---------------- LANDING / ANUNCIO / PROPUESTA ---------------- */
  c("landing", "Responde, cotiza y agenda por WhatsApp — 24/7, con tus datos reales. Lo dejamos andando nosotros.", { canal: "web" }),
  c("landing", "Nunca inventa precios. Si no sabe, deriva a tu equipo.", { canal: "web" }),
  c("anuncio", "¿Pierdes ventas por responder tarde? Tu WhatsApp puede responder solo, 24/7. Prueba la demo.", { canal: "instagram", funnel: "descubrimiento" }),
  c("propuesta", "Incluye: implementación completa hecha por nosotros, entrenamiento con tu información, pruebas contigo y primer mes de ajustes sin costo.", { canal: "propuesta", funnel: "decision" }),
  c("propuesta", "Piloto Fundador: descuento en la implementación (mensualidad de lista) a cambio de tu testimonio honesto. Cupos limitados a los primeros 5 clientes.", { canal: "propuesta", funnel: "decision" }),
];

export function copiesPorTipo(tipo: CopyTipo) {
  return COPIES.filter((x) => x.tipo === tipo);
}
