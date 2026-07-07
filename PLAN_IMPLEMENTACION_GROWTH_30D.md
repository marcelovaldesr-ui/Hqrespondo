# PLAN DE IMPLEMENTACIÓN — GROWTH STUDIO (próximos 30 días)
**Fecha:** 6-jul-2026 · Investigado sobre el código real de RespondHQ (Next 14.2 App Router + Supabase service_role, patrón página server + componente cliente + API, tokens de marca).
Ordenado **de menor a mayor utilidad para partir** (vender / conseguir clientes): lo último es lo que más mueve la aguja. Nota: el esfuerzo es trabajo mío (Claude); lo evalúo por complejidad y riesgo de romper algo, no por horas tuyas.

Hallazgos base de la investigación:
- `prospects.rubro` es **texto libre** (lo que se escribe al buscar en Places, ej. "clínica dental"). Para cruzarlo con los rubros de Growth hace falta un mapeo por palabras clave → slug.
- `lib/mensajes.ts` (`plantillasPara(p)`) es el patrón a imitar: helper puro renderizado en el detalle del prospecto (`ProspectTable.tsx`, fila expandida, columna izquierda).
- El header `x-hq-user` es opcional y hoy no lo manda ningún componente → los POST desde UI funcionan sin él.
- Cupos Piloto Fundador = `5 − nº de clientes` (`PILOTO_FUNDADOR_DCTO` tiene 5 entradas; tabla `clients`).
- Ideas y Calendario de Growth ya son cards responsive; el cuello de botella mobile real es la tabla de prospectos (fuera del alcance de Growth).

---

## 1. Vista mobile pulida (menor utilidad para partir)
**Qué desbloquea:** comodidad para revisar Growth desde el celular. No mueve ventas por sí solo.
**Cómo se implementa:**
- `components/growth/CalendarClient.tsx`: las filas de pieza (`flex items-center`) se ven apretadas <380px. Cambiar a `flex-col` bajo `sm:` y ocultar la meta secundaria (`canal · pilar`) en móvil (`hidden sm:inline`, ya usado en otras vistas).
- `components/growth/IdeasClient.tsx`: la barra de filtros (varios `select`) se amontona; envolver en un contenedor con `overflow-x-auto` o pasar a `grid grid-cols-2 gap-2` bajo `sm:`. Las cards ya son `md:grid-cols-2` (ok).
- Sin migración, sin API. Solo clases Tailwind.
**Migración:** no. **Esfuerzo:** bajo. **Riesgo:** muy bajo (solo CSS).

## 2. Contador real de cupos del Piloto Fundador
**Qué desbloquea:** urgencia honesta y automática ("quedan X de 5") en el panel y para copiar a stories/destacadas. Refuerza el cierre, no genera demanda nueva.
**Cómo se implementa:**
- En `app/growth/page.tsx` (server), agregar al `Promise.all` una consulta `db().from("clients").select("id", { count: "exact", head: true })` → `cupos = Math.max(0, 5 - count)`.
- Mostrar un chip en el panel ("Piloto Fundador: quedan X de 5 cupos") y, opcional, pasar `cupos` a la página de Destacadas para reemplazar el placeholder `[X]`.
- Fuente de verdad del total: `PILOTO_FUNDADOR_DCTO.length` (=5) en `lib/types.ts`.
**Migración:** no. **Esfuerzo:** bajo. **Riesgo:** bajo (una consulta más, ya hay patrón en el dashboard).

## 3. Completar los 7 rubros secundarios
**Qué desbloquea:** contenido a fondo para rubros fuera de los 5 ICP, a medida que aparezcan en prospección. Útil, pero los 5 ICP ya cubren el ataque inicial, así que no bloquea partir.
**Cómo se implementa:**
- Es **contenido, no código**: enriquecer en `lib/growth/industries.ts` los rubros con `prioridad_comercial` media/baja (constructoras, servicios técnicos, veterinarias, tiendas, agenda/reservas, educación, distribuidoras) al mismo nivel que los ICP: más ideas de post/carrusel/reel y objeciones reales.
- Idealmente se hace **cuando un rubro secundario dé 2–3 respuestas** en prospección (regla del ICP: duplicar donde hay tracción), no antes.
**Migración:** no. **Esfuerzo:** medio (redacción). **Riesgo:** nulo (solo datos seed).

## 4. Marcar idea "útil para prospección" + filtro
**Qué desbloquea:** poder etiquetar qué piezas sirven para calentar/seguir leads y filtrarlas rápido. Prepara el terreno para la mejora #6.
**Cómo se implementa (2 caminos, elijo el simple):**
- **Camino simple (recomendado, sin migración):** no agregar columna. Definir "útil para prospección" como una **regla derivada**: ideas con `funnel ∈ {consideracion, decision}` y (rubro asignado **o** pilar ∈ {problema, objeciones, demo, venta}). Agregar en `IdeasClient.tsx` un filtro rápido "Para prospección" que aplique esa regla, y en el panel el link ya existente `/growth/ideas?pilar=objeciones` se amplía.
- **Camino explícito (si se quiere marcar a mano):** migración `010` additiva → `growth_ideas.util_prospeccion boolean default false`; checkbox en la card (solo ideas de BD, las seed quedan por regla). Mismo patrón defensivo que la 009.
**Migración:** opcional (solo camino explícito). **Esfuerzo:** bajo-medio. **Riesgo:** bajo.

## 5. Botón "idea → tarea de roadmap"
**Qué desbloquea:** cerrar el loop estrategia→ejecución sin salir de Growth: una idea buena se convierte en tarea con fecha y aparece en el Roadmap y en "Hoy — lo accionable" del dashboard.
**Cómo se implementa:**
- Reutiliza la API existente `POST /api/roadmap` (acepta `{ tarea, estado, area, fecha_limite, notas }`; `x-hq-user` opcional).
- En `components/growth/IdeasClient.tsx`, botón "→ Roadmap" por idea que haga `fetch("/api/roadmap", { method:"POST", body: { tarea: idea.titulo, area: "Contenido", estado: "Esta semana", notas: idea.descripcion } })`.
- Feedback inline ("Agregada al roadmap ✓"). Sin duplicar módulos ni tablas.
- Detalle: `roadmap_items.area` es texto libre → usar "Contenido" para agrupar. Cero cambios de esquema.
**Migración:** no. **Esfuerzo:** bajo (una API ya existe). **Riesgo:** bajo.

## 6. Contenido recomendado por rubro en la ficha del prospecto (mayor utilidad para partir)
**Qué desbloquea:** LO que conecta el contenido con vender. Al abrir un prospecto de, por ej., ferretería, el equipo ve al tiro la fórmula "sin", 2–3 piezas y los copies de ese rubro para mandar junto al mensaje. Convierte a Growth Studio en apoyo directo de la prospección.
**Cómo se implementa:**
1. **Mapeo de rubro (lo nuevo):** `lib/growth/match.ts` con `matchRubroSlug(freeText): slug | null` por palabras clave:
   - ferreterias ← ferret, materiales, construcción, eléctric, sanitari
   - inmobiliarias ← corredor, inmobil, propiedad, arriendo, corretaje
   - clinicas ← clínic, médic, dental, kinesi, psicol, nutri, salud
   - estetica ← estétic, belleza, peluquer, barber, uñas, depilación, spa
   - talleres ← taller, mecánic, automotriz, desabolladura, vulcaniz
   - (y los secundarios: veterinaria, tienda, distribuidora, etc.)
   - Sin match → `null` (no se muestra el bloque, degrada silencioso).
2. **Helper de contenido:** `contenidoParaProspecto(rubro)` que use el slug para traer de `industries.ts`/`copies.ts`: `formula_sin`, 2–3 `ideas_reel`/`ideas_post`, `mensaje_prospeccion` y el link `/growth/rubros#slug`.
3. **Render:** en `components/ProspectTable.tsx`, en la fila expandida (columna izquierda, junto a "Follow-ups sugeridos"), un bloque nuevo "Contenido para este rubro" con botones de copiar (mismo patrón `copiarTexto`).
- Es puro cliente + datos seed; no toca la base ni la landing.
**Migración:** no. **Esfuerzo:** medio (el mapeo + el bloque). **Riesgo:** bajo (aditivo en una vista existente; si no hay match, no aparece nada).

---

## Orden recomendado de ejecución (para partir)
Aunque arriba van de menor a mayor **utilidad**, para implementar conviene el orden inverso por impacto, haciendo primero lo que más ayuda a vender y es de bajo riesgo:

1. **#6 Contenido por rubro en la ficha del prospecto** — máximo impacto comercial, riesgo bajo.
2. **#5 Idea → roadmap** — cierra el loop, API ya existe.
3. **#4 Filtro "para prospección" (camino simple)** — complementa #6.
4. **#2 Cupos Piloto Fundador** — urgencia honesta, barato.
5. **#1 Mobile pulido** — comodidad.
6. **#3 Rubros secundarios** — cuando la prospección muestre tracción en ellos.

## Nota estratégica
Nada de esto bloquea salir a vender el lunes. Si el tiempo es escaso, con **#6 + #5** ya tienes Growth Studio conectado a la operación comercial; el resto es pulido. Todo es aditivo, sin migraciones obligatorias (solo el camino explícito de #4 pediría una 010, opcional) y sin tocar la landing pública ni romper el deploy en Vercel.
