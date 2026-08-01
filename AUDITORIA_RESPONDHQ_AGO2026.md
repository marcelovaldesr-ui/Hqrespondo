# AUDITORÍA — RESPONDO HQ (1 de agosto de 2026)
Auditoría de código + arquitectura, hecha para responder una pregunta concreta: **¿HQ sigue sirviendo como centro de mando interno ahora que existe el Portal, o quedó pensado para una empresa que ya no somos?**

Comparado contra: código real de `respondo-hq/` (commit `78c5227`), código real de `respondo-portal/`, y la memoria del proyecto (specialmente `tino-codigo-endpoint-jul2026`, `portal-cliente-respondo-jul2026`, `decision-agenda-first-jul2026`, `analisis-7-competidores-jul2026`, `precios-interinos-landing-jul2026`).

---

## 0. El hallazgo central

HQ se construyó (y su última iteración grande fue el 6-jul) sobre un supuesto que ya no es cierto: **"Respondo vende un bot por WhatsApp, montado en n8n, uno por cliente."** Desde entonces pasaron tres cosas que HQ no absorbió:

1. **21-jul: se abandonó n8n.** El cerebro de los bots (Tino y el resto) ahora corre como código dentro de `respondo-portal` (`app/api/whatsapp/webhook-evolution`, `lib/responderBot.ts`), no como workflows de n8n. La carpeta `n8n/` de HQ y el flujo "workflow_id → eventos → salud del bot" describen un mundo que ya no existe.
2. **20-jul en adelante: nació el Portal** (`respondo-portal/`), un producto Next.js separado con su **propia base Supabase** (esquema `ed_`), donde el cliente final ve a sus empleados IA: Inicio, Conversaciones, Agenda, Embudo, Analítica, Insights, WhatsApp, Información. Es, en los hechos, un centro de mando — pero **del cliente**, no de ustedes.
3. **31-jul: agenda/reservas** se convirtió en producto (migraciones 220/221, Google Calendar, cron con latido) y **25/30-jul: nace un producto vertical nuevo** ("Respondo para Clínicas", planes Consulta/Clínica/Multi-sede + Implementación) que reemplaza — no complementa — la estructura de precios que hoy vive hardcodeada en HQ.

**Consecuencia directa:** el módulo más visible de HQ para "ver cómo van los clientes" — **Clientes & Bots** — no puede mostrar nada real aunque llegue el primer cliente hoy, porque los bots ya no reportan por el camino que ese módulo escucha. Es el mismo hallazgo que la auditoría del 6-jul hizo con los precios ("cada deal nace con precios que ya no rigen"), pero ahora es arquitectónico, no solo de datos.

Esto no es un problema de "hay que agregar features". Es que **HQ y el Portal crecieron como dos sistemas de verdad que no se hablan**, y HQ se quedó describiendo al Portal viejo (el que no existía).

---

## 1. Quién es quién (aclarar antes de tocar nada)

| | **Respondo HQ** (`respondo-hq/`) | **Respondo Portal** (`respondo-portal/`) |
|---|---|---|
| Para quién | Marcelo y José (uso interno) | El cliente final (dueño de la pyme) |
| Qué responde | "¿Cómo va el negocio de Respondo?" (prospección, pipeline, plata, roadmap) | "¿Cómo está trabajando mi empleado IA?" |
| Base de datos | Supabase propia de HQ (`prospects`, `deals`, `clients`, `bot_events`…) | Supabase del motor, esquema `ed_` (`ed_clientes`, `ed_mensajes`, `ed_citas`, `ed_chat_estado`…) |
| Login | Basic Auth (2 socios) | Magic link por cliente, RLS + filtro por `cliente_id` |
| Estado | Estable desde 6-jul, con módulos nuevos (Llamadas, Prospección IA) agregados después sin retocar el resto | En desarrollo activo, 16 migraciones desde el 20-jul |

**No hay que fusionarlos.** El Portal es y debe seguir siendo la herramienta del cliente. Pero HQ **debería ser el único lugar donde ustedes ven el agregado de todos los clientes del Portal** — hoy no lo es, porque no lee de ahí. Esa es la brecha a cerrar.

---

## 2. Módulo por módulo

| Módulo | Ruta | Estado real | Por qué |
|---|---|---|---|
| **Centro de mando** | `/dashboard` | 🟡 Vigente, pero con datos congelados | Fase de la misión y "3 prioridades" funcionan bien. Pero `lib/objetivos.ts` tiene metas de **julio** hardcodeadas (100 contactados, 5 demos, 2 clientes) y no se recalculan solas — en agosto el dashboard va a mostrar avance sobre metas vencidas sin decirlo. |
| **Llamadas del día** | `/llamadas` | 🟢 Vigente, el módulo mejor construido de todos | Se agregó después del 6-jul (11–19 jul), bien pensado (dedupe por dominio, reintentos, exportable). No depende de nada obsoleto. Sin acción. |
| **Prospección** | `/prospeccion` | 🟢 Vigente | Búsqueda Places + scoring Gemini + agente multicanal (email/LinkedIn semi-auto, `docs/AGENTE_PROSPECCION.md`) siguen alineados con cómo venden hoy. Sin acción mayor. |
| **Pipeline** | `/pipeline` | 🔴 Obsoleto en el dato más importante: **el precio** | `lib/types.ts` trae 3 planes fijos (Básico/Pro/Empresa, `esencial/cotizador/pro`) con **setup de Básico en $150.000**, pero lo que rige hoy en la web es **$99.990** (decisión 6-jul). Y ninguno de los dos refleja la propuesta de precios del vertical Clínicas ($150k/$250k/$400k + $390k implementación) que está en discusión activa y de la que depende que Tomás salga a vender. Cada deal que se cree hoy en Pipeline nace con precios de un mundo anterior — por segunda vez (la auditoría del 6-jul ya encontró exactamente este bug una vez). |
| **Clientes & Bots** | `/clientes` | 🔴 **Obsoleto de raíz** | Depende 100% de eventos que **nadie envía**: el texto del propio módulo dice *"El estado se alimenta de los eventos que envía n8n a `/api/hooks/bot-events`… asigna el workflow id a cada cliente"* — pero desde el 21-jul los bots no corren en n8n, corren en `respondo-portal`. Aunque agreguen un cliente hoy con nombre y plan, el módulo se queda ciego: salud, uptime, mensajes/día y costo van a estar siempre en cero, porque miden el sistema equivocado. Ver sección 4. |
| **Growth Studio** | `/growth` | 🟢 Vigente, aislado | Genera contenido comercial (IG, battlecards, calendario) para promocionar Respondo, no depende del Portal ni de n8n. Revisar solo que los battlecards/copies no citen los precios viejos de julio. |
| **Finanzas** | `/finanzas` | 🟡 Correcto en lo que mide, pero mide poco | Cobros y gastos son reales. Pero el MRR sale de `clients.mensualidad` — la misma tabla vacía/desconectada de Clientes & Bots. Si el primer cliente entra por el Portal (que es como están operando ahora, ver Impresora Color y Barbería Nogal), Finanzas no se entera solo. |
| **Brief del Día** | `/brief` | 🟡 Bien diseñado, alimentado con datos parciales | Lee roadmap, cobros, gastos y objetivos de HQ — todos correctos — pero nunca lee nada del Portal (agenda del día, mensajes atendidos, errores reales de bots). El brief diario no puede avisar "el bot de tal cliente lleva 3h sin responder" porque no mira donde eso ocurre. |
| **Roadmap** | `/roadmap` | 🟢 Vigente, maduro | Sin cambios necesarios. |
| **Decisiones** | `/decisiones` | 🟢 Vigente, mínimo pero funcional | Sin cambios necesarios. Sí serviría registrar ahí la decisión de precios del vertical Clínicas en cuanto se cierre — hoy vive solo en memoria de proyecto. |

---

## 3. Lo que encontré de paso (no es el foco, pero importa)

- **Hay cambios sin commitear en el repo ahora mismo**: `git status` muestra modificados (sin push) `.env.example`, `.github/workflows/agente-prospeccion.yml`, `.gitignore` y varios `.md` de documentación (`AUDITORIA_REAL_RESPONDHQ.md`, `MAPA_FUNCIONAL_RESPONDHQ.md`, etc.). No son cambios de esta sesión — probablemente quedaron pendientes de una edición anterior. Vale la pena revisar `git diff` y decidir si se comitean o se descartan antes de seguir editando encima.
- **`lib/objetivos.ts`** son constantes de código que hay que editar a mano cada mes (documentado como decisión deliberada) — si no se actualizaron en agosto, el dashboard y el brief están felicitando o alarmando sobre metas de julio.
- **Impresora Color** (el piloto interno) tiene su **propio CRM aparte** (`gestion-carpeta/impresora-color`, otra Supabase). Ni HQ ni el Portal lo ven. Es la prueba en miniatura de que "cada negocio con su isla de datos" ya está pasando — HQ debería ser el lugar que junta las islas, no una isla más.

---

## 4. Por qué "Clientes & Bots" no se arregla parcheando

El módulo asume una arquitectura (n8n → webhook con token → tabla `bot_events` en la Supabase de HQ) que technically sigue funcionando — el endpoint no está roto — pero **no la usa nadie**, porque el motor real de los bots vive en otra app con otra base de datos (`ed_` en la Supabase del Portal). Hay tres caminos, de menor a mayor esfuerzo:

1. **Puente por hook (rápido, 1-2 días):** agregar al Portal una llamada a `POST /api/hooks/bot-events` de HQ cada vez que pasa algo relevante (mensaje atendido, error, cita agendada, handoff a humano) — mismo contrato que ya existe, solo cambia quién lo llama (el Portal en vez de n8n). Mínimo cambio en HQ; el Portal gana una responsabilidad nueva.
2. **Lectura directa (medio, 3-5 días):** HQ consulta con `service_role` la Supabase del Portal (otro proyecto, otra key) y arma la vista de salud/uptime/costo desde `ed_mensajes`, `ed_citas`, `ed_chat_estado`, `ed_latidos` — sin que el Portal tenga que avisar nada. Más fiel a lo que realmente pasa (incluye agenda, no solo mensajes), pero exige mantener dos esquemas de datos sincronizados en la cabeza.
3. **Rediseño (el correcto a mediano plazo):** `/clientes` deja de ser "salud de bot" (concepto de cuando solo existía Tino por WhatsApp) y pasa a ser **"Salud de cuenta"**: agenda del día (citas, no-shows), conversaciones atendidas vs. derivadas, canal conectado (Evolution/QR vs. WhatsApp Cloud oficial — hoy conviven las dos opciones A/B), cobro al día, y el mismo `workflow_id` legacy queda deprecado. Esto es lo que de verdad responde "¿cómo van mis clientes reales hoy?".

**Recomendación:** opción 1 ahora (barata, no bloquea nada), camino a la 3 cuando haya 2-3 clientes reales en el Portal — no antes, porque diseñar la vista sin datos reales es adivinar.

---

## 5. Precios: el mismo bug, la segunda vez

La auditoría del 6-jul encontró y corrigió precios obsoletos en `lib/types.ts`. Un mes después, **volvió a pasar**, y esta vez el motivo es peor: no es que se les olvidó actualizar el código, es que **el precio de Respondo cambió de forma (de "planes fijos" a "vertical con implementación aparte") y el código no tiene dónde poner eso.**

- Código hoy: `esencial/cotizador/pro` con setup **$150.000/$290.000/$590.000** — el primero ya no coincide ni con la propuesta vieja vigente ($99.990).
- Web/decisión 6-jul: Básico $99.990+$24.990 · Pro $290.000+$39.990 · Empresa $590.000+$69.990.
- Propuesta en curso (25→30-jul, valida mercado según análisis de 7 competidores): Consulta $150.000/mes · Clínica $250.000/mes · Multi-sede $400.000/mes · **Implementación $390.000 aparte, nunca gratis**. Esta es la que bloquea que Tomás salga a vender.

**Recomendación concreta:** no vuelvan a hardcodear precios en `lib/types.ts`. Aunque sean solo 2 socios, cada vez que el precio se decide en una reunión y no en el código, hay una ventana donde Pipeline miente. Alternativas, de más simple a más robusta:
- Un único archivo `PRECIOS_VIGENTES` con fecha de última revisión visible en el dashboard ("precios actualizados: DD-MM"), para que salte a la vista cuando está viejo.
- Tabla `planes` en Supabase editable desde un panel simple — deja de requerir un deploy para cambiar un precio.
- Ya que viene un cambio de **estructura** (no solo de monto) por el vertical Clínicas, este es el momento de decidir si `Deal.plan` sigue siendo un enum cerrado de 3 valores o pasa a ser más flexible (nombre + mensual + qué incluye), porque la estructura Consulta/Clínica/Multi-sede/Implementación no calza en el modelo actual.

---

## 6. Funcionalidades nuevas a agregar (lo que antes no existía y hoy sí debería)

1. **Salud de cuentas reales** (sección 4, opción 1 primero) — sin esto, HQ no puede decir "hoy pasó algo con un cliente" ni el brief diario puede avisarlo.
2. **Snapshot de agenda cross-cliente**: citas de hoy, no-shows, ocupación — la agenda es producto desde el 31-jul y hoy no aparece en ningún lugar de HQ (ni dashboard ni brief). Si el vertical Clínicas se paga en parte por "recuperación de inasistencias", HQ debería poder mostrar esa métrica agregada como prueba de valor.
3. **Estado de canal por cliente**: Evolution/QR (no oficial, riesgo de baneo) vs. WhatsApp Cloud oficial (Embedded Signup, que Meta deprecia v2 el 15-oct-2026) — hoy solo vive en la memoria del proyecto, y es información operativa que debería estar a la vista antes de prometerle un canal a un cliente nuevo.
4. **Registrar el vertical Clínicas como decisión** en `/decisiones` en cuanto se cierre, y una vez cerrado, actualizar Pipeline/Growth Studio a la vez (para que un deal y un mensaje de prospección no queden hablando de precios distintos entre sí).
5. **Refrescar objetivos del mes sin editar código a mano** — aunque sea solo mover la fecha de corte y las 5 metas a una tabla chica, evita el olvido mensual.
6. **Considerar si Impresora Color entra a HQ o queda fuera a propósito** — hoy es una isla no documentada como decisión; mejor decidirlo explícitamente que dejarlo flotando.

---

## 7. Lo que NO tocaría

- Prospección, Llamadas del día, Growth Studio, Roadmap, Decisiones — están vigentes y bien resueltos para lo que Respondo hace hoy.
- Auth, `lib/db.ts`, dedupe de búsqueda, migraciones aplicadas (002-017) — sin riesgo, sin necesidad.
- El Portal mismo — está fuera del alcance de esta auditoría (es otro repo con su propio ciclo); esta auditoría solo mira cómo HQ debería enterarse de lo que pasa ahí.

---

## 8. Plan de acción sugerido (orden de impacto)

| # | Acción | Esfuerzo | Por qué primero |
|---|---|---|---|
| 1 | Revisar y comitear/descartar los cambios pendientes en el repo (sección 3) | 15 min | Evita perder o pisar trabajo antes de tocar nada más |
| 2 | Corregir el setup de Básico a $99.990 en `lib/types.ts` (mientras se cierra el precio nuevo) | 15 min | Mismo bug que ya costó dinero real una vez |
| 3 | Puente Portal → `bot-events` (opción 1, sección 4) | 1-2 días | Es lo único que hace que "Clientes & Bots" vuelva a decir la verdad |
| 4 | Cerrar y registrar el precio del vertical Clínicas en `/decisiones`, luego reflejarlo en Pipeline y Growth Studio | depende del equipo, no de código | Bloquea la salida a vender de Tomás — es lo más urgente del negocio, no solo del código |
| 5 | Mover objetivos de julio → agosto en `lib/objetivos.ts` (o a tabla) | 30 min – medio día según ruta | El dashboard/brief están midiendo contra metas vencidas ahora mismo |
| 6 | Snapshot de agenda + canal por cliente en `/clientes` | 3-5 días | Recién tiene sentido con clientes reales en el Portal; no antes |
| 7 | Rediseño completo de "Salud de cuenta" (opción 3, sección 4) | 1-2 semanas | Con 2-3 clientes reales, no antes — diseñarlo sin datos es adivinar |

---

## 9. Para revisar tú primero
1. Los cambios sin commitear (`git status` / `git diff`) — decidir si se guardan.
2. `lib/types.ts` línea de `PLAN_PRECIOS` — confirmar cuál es el número correcto hoy mismo (¿$99.990 o el vertical nuevo ya está listo para reemplazarlo?).
3. `lib/objetivos.ts` — las metas siguen fechadas julio.
4. Decidir la ruta del puente Portal→HQ (opción 1 de la sección 4) para que deje de estar ciego con el primer cliente real.

Si quieres, puedo partir por los puntos 1-2-5 del plan de acción ahora mismo (son mecánicos y de bajo riesgo), y dejar el puente Portal→HQ (punto 3) como siguiente sesión con más tiempo de por medio.
