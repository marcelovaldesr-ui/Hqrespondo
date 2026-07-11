> Este archivo es un PROMPT para pegar en otra sesión de Claude Code, trabajando directamente en el repo `respondo-hq`. No es documentación de referencia — está escrito en segunda persona para que Claude lo ejecute.

---

# Objetivo

Trabajas en `respondo-hq`, el sistema interno de Respondo (empresa chilena que implementa asistentes de ventas con IA en WhatsApp para pymes). La sección **Prospección** (`app/prospeccion`, `components/ProspectSearch.tsx`, `components/ProspectTable.tsx`) busca negocios por rubro+comuna (Google Places), les asigna un score con Gemini y genera automáticamente el primer mensaje de contacto. También recomienda follow-ups según el estado del prospecto.

**El problema que hay que resolver:** los mensajes que el sistema genera y recomienda hoy suenan genéricos, de IA, de plantilla masiva — no como algo que un socio fundador le escribiría a un negocio real. Marcelo (fundador, no programador) lo notó al leerlos como si fuera el dueño del negocio que los recibe. Tu tarea es diagnosticar por qué pasa esto en el código actual y arreglarlo — no es un problema de "escribir mejores textos a mano", es un problema de cómo está diseñado el motor que los genera.

No estás partiendo de cero: hay material humano ya bien escrito en el propio repo que el motor de generación no está aprovechando (ver diagnóstico abajo). La solución es en gran parte de **ingeniería de prompt y de reutilización de contenido ya bueno**, no de reinventar el tono.

---

# Diagnóstico concreto (ya investigado, no lo repitas)

## 1. El primer mensaje se genera con muy poca señal real

`lib/scoring.ts` le pide a Gemini, por cada negocio encontrado en Google Places, un mensaje de máx. 55 palabras con esta instrucción:

> "Estructura: saludo con nombre del negocio → **un dato concreto del negocio (rating, rubro, etc.)** → qué hace Respondo en una frase → pregunta simple para abrir conversación."

El único "dato concreto" disponible es `rating` y `reviews` (viene de `lib/places.ts` / Google Places Text Search) — no hay observación real del negocio (qué venden, qué preguntan sus clientes, cómo es su Instagram). Resultado típico:

> "Hola Ferretería Don Pedro, vi que tienen una excelente reputación con 4.6 estrellas y 45 reseñas. En Respondo ayudamos a negocios como el tuyo a automatizar la atención al cliente por WhatsApp con inteligencia artificial. ¿Te gustaría conocer más sobre nuestra solución?"

Esto es exactamente lo que un dueño de pyme reconoce al segundo como mensaje masivo: abre citando una métrica que no dice nada personal ("vi tu rating" no es una observación, es un dato de base de datos), usa "negocios como el tuyo" (genérico), "automatizar la atención al cliente con inteligencia artificial" (jerga técnica, nadie habla así de su propio dolor), y cierra con "¿te gustaría conocer más sobre nuestra solución?" — un CTA débil que no abre conversación, solo pide permiso para vender.

## 2. Los follow-ups son 100% estáticos — la misma frase para los 100 prospectos del mes

`lib/mensajes.ts` (`PLANTILLAS`) tiene 5 mensajes fijos (follow-up 1, follow-up 2, respondió→demo, post-demo, reactivación). La función `genera(p)` casi no usa `p` (el prospecto): solo inserta `p.nombre` en 2 de los 5. Rubro, comuna, notas del diagnóstico — nada de eso entra al mensaje. Si el negocio A y el negocio B están ambos en estado "contactado", reciben literalmente el mismo texto, palabra por palabra. Eso es "genérico" en el sentido más literal.

## 3. Bug de precio: un template ofrece algo que ya no existe

`lib/mensajes.ts`, plantilla `postdemo`:

```
Plan recomendado: [plan] — $[X]/mes + implementación $[Y] (con el descuento Fundador te queda en $[Z]). ...
```

La oferta "descuento Fundador" **ya no es la oferta vigente** — Respondo ofrece "primer mes de servicio gratis, setup sin descuento" (confirmado en `estrategia-comercial/OFERTA_LANZAMIENTO_RESPONDO.md` y `MENSAJES_PROSPECCION_RESPONDO.md`, que dice explícito: "ya no se ofrece piloto gratis 14 días ni Piloto Fundador"). Si este template se usa tal cual con un cliente real, se le promete algo que no corresponde. Corregir.

## 4. La solución ya existe en el repo y no se está usando donde más falta

`lib/growth/industries.ts` (campo `mensaje_prospeccion` por rubro, ~15 rubros) tiene mensajes de prospección **genuinamente buenos**, ya escritos con la voz correcta. Ejemplos reales del archivo:

> "Cuando un contratista les pide precio y stock un sábado o después de las 7, ¿quién le responde? Armamos asistentes que cotizan al instante con la lista real del negocio — pídele cotizar cemento en la demo → [link]"

> "Vi que les preguntan harto por precios y stock en los comentarios. ¿Eso lo responden a mano? Un asistente que responde precio, talla, stock y despacho desde tu catálogo, 24/7. Pruébalo como cliente → [link]"

Notas por qué estos SÍ funcionan: abren con el dolor específico del rubro (no con una métrica de Google), hacen una pregunta real que cualquier dueño se puede contestar a sí mismo, no dicen "inteligencia artificial" ni "solución", y el CTA es "pruébalo" (acción concreta), no "¿te gustaría saber más?" (pedir permiso).

`ProspectTable.tsx` ya conecta cada prospecto a su rubro (`matchRubroSlug` + `rubroPorSlug`) y muestra un botón "Copiar mensaje del rubro" — pero es un botón **aparte**, no se usa como base/estilo para el mensaje que Gemini genera en `scoring.ts`. El motor de IA está reinventando la rueda con peor material cuando ya hay ejemplos excelentes a un import de distancia.

## 5. No hay variación ni forma de regenerar

El mensaje se genera una sola vez, en el batch de búsqueda (`/api/search`), y queda fijo en `p.mensaje`. No hay botón para pedir "otra versión" si no convence, ni se generan 2-3 variantes para elegir.

---

# La prueba de aceptación (úsala en cada mensaje que quede en el sistema)

Antes de dar por bueno cualquier mensaje generado o plantilla, léelo poniéndote en el lugar del dueño de un negocio real que lo recibe sin avisar, en su WhatsApp personal. Pregúntate:

1. ¿Suena a que alguien miró mi negocio 5 segundos, o a que me copiaron y pegaron algo?
2. ¿Menciona mi rating/reseñas como si fuera un dato personal? (si sí, falla — eso es "vi tu ficha de Google", no "te conozco")
3. ¿Usa palabras como "solución", "automatizar", "inteligencia artificial", "optimizar", "revolucionario", "potenciar"? (si sí, falla — nadie habla así de su propio problema)
4. ¿La pregunta del final es algo que puedo responder con un sí/no rápido sobre MI día a día, o es un "¿quieres saber más?" genérico?
5. ¿Si lo comparo con el mensaje que le llegó a otro negocio del mismo rubro, es literalmente el mismo texto?

Si falla en 2 o más, no está listo.

---

# Tareas (en orden de impacto)

## 1. Arreglar el bug de precio (rápido, hazlo primero)
En `lib/mensajes.ts`, plantilla `postdemo`: quitar la mención a "descuento Fundador" y alinear con la oferta real de "primer mes de servicio gratis, setup completo" (revisar `estrategia-comercial/OFERTA_LANZAMIENTO_RESPONDO.md` para la redacción exacta vigente).

## 2. Reescribir el prompt de Gemini en `lib/scoring.ts`
- Prohibir explícitamente citar rating/reviews como "observación" en el mensaje (pueden influir en el score, no en el texto).
- Inyectar como contexto el `mensaje_prospeccion` del rubro correspondiente (`lib/growth/industries.ts`, vía `matchRubroSlug`) como **ejemplo de tono a imitar**, no para copiar textual — dile a Gemini que ese es el estilo correcto: dolor específico del rubro en forma de pregunta, sin jerga técnica, sin "solución".
- Agregar una lista explícita de palabras/frases prohibidas (ver `estrategia-comercial/MENSAJES_PROSPECCION_RESPONDO.md`, sección "Reglas de tono": prohibido "revolucionario", "disruptivo", "solución integral", "potenciar", motivacionales vacíos; máx. 1-2 emojis; frases cortas, una idea por línea).
- Pide 2 variantes por prospecto en vez de una sola (dos ángulos distintos de la misma pregunta), y muéstralas ambas en `ProspectTable.tsx` para que se elija o edite antes de copiar — no para generar más volumen, para dar opción cuando una no convenza.
- Si el negocio no tiene rubro reconocido en `industries.ts`, usar como referencia los ejemplos genéricos de `estrategia-comercial/MENSAJES_PROSPECCION_RESPONDO.md` (mensajes 1-4, WhatsApp/IG/correo/LinkedIn) en vez de generar sin ancla.

## 3. Personalizar los follow-ups de `lib/mensajes.ts`
Decide entre dos caminos (evalúa cuál es más simple de mantener siendo 2 personas, sin programador):
- **A. Generación con Gemini igual que el primer mensaje**, usando `p.rubro`, `p.notas` (lo que el fundador anotó tras hablar con el prospecto) y el estado — mismo patrón que `scoreProspects`, pero para un solo prospecto a demanda (botón "Regenerar" en `ProspectTable.tsx`, llamando a una nueva ruta API).
- **B. Mantener plantillas de texto pero con más variables reales** (rubro, dolor capturado en notas) en vez de solo el nombre, aceptando que va a sonar menos "vivo" que la opción A.

Recomendación: A para los mensajes que más se repiten (follow-up 1, reactivación) porque son los que más se nota si están duplicados palabra por palabra entre prospectos; B está bien para el mensaje post-demo (ya tiene mucha variable numérica que sí debe ser exacta: plan, precio, fecha — no conviene que la IA la invente).

## 4. Botón de "generar otra versión" en `ProspectTable.tsx`
Para cualquier mensaje (primero o follow-up), agregar la opción de pedir una variante nueva sin tener que rehacer toda la búsqueda del rubro completo. Debe llamar a una ruta API liviana (reutiliza `lib/gemini.ts`), no reprocesar Google Places.

## 5. Revisión final con la prueba de aceptación
Genera mensajes de prueba para al menos 3 rubros distintos (uno con `mensaje_prospeccion` en `industries.ts`, uno sin), pásalos por los 5 criterios de la sección anterior, y muestra el antes/después en tu respuesta final.

---

# Material de referencia que YA existe — léelo antes de escribir nada

- `estrategia-comercial/MENSAJES_PROSPECCION_RESPONDO.md` — mensajes por canal y por rubro, reglas de tono y de operación (fuente de verdad del estilo correcto).
- `estrategia-comercial/OBJECIONES_RESPONDO.md` — para entender qué preocupa a un dueño de pyme real, útil para calibrar qué preguntas de apertura funcionan.
- `estrategia-comercial/OFERTA_LANZAMIENTO_RESPONDO.md` — oferta vigente exacta ("primer mes gratis"), para no volver a meter una oferta vieja en un template.
- `lib/growth/industries.ts` — los `mensaje_prospeccion` por rubro ya bien escritos, úsalos como ancla de estilo.
- `lib/types.ts` — estructura de `Prospect` (qué campos reales hay disponibles para personalizar: `notas`, `rubro`, `comuna`, `estado`, etc.).

---

# Restricciones — no te vayas de tema

- No cambies la arquitectura (Next.js + Supabase + Gemini vía `lib/gemini.ts`). El objetivo es mejorar QUÉ se genera, no CÓMO está construido el sistema.
- No agregues herramientas nuevas (nada de servicios externos de copywriting IA, nada de nuevas dependencias pesadas). Gemini ya está integrado y alcanza.
- Marcelo no programa — tú implementas. Deja el código simple de mantener y explica en tu respuesta final, en lenguaje no técnico, qué cambió y por qué ahora los mensajes se sienten distintos.
- No toques el resto de RespondoHQ (Pipeline, Finanzas, Brief, Growth) salvo lo estrictamente necesario para conectar `industries.ts` a `scoring.ts`.
- Prueba que la app sigue compilando (`npm run build` o el chequeo que use el proyecto) antes de dar por terminada la tarea.
