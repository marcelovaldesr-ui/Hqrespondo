# GUÍA DE USO — RESPONDO HQ
Cómo operar Respondo con el panel, todos los días. Para los 2 socios.

## La rutina de cada mañana (10 minutos)
1. Abre el **Centro de mando**. Mira la fase, la meta del mes y **las 3 prioridades de hoy** — eso ES tu plan del día.
2. Revisa "Hoy — lo accionable": seguimientos, tareas y deals con fecha de hoy o vencida.
3. Genera el **Brief** (o léelo si llegó por WhatsApp a las 8:00) — cruza todo el sistema y cierra con una recomendación.
4. Ejecuta en orden: prioridad 1 → 2 → 3. Lo demás espera.

## Prospectar
- En **Prospección**, escribe rubro + comuna → "Buscar y Calificar". Places trae hasta 20 negocios, la IA los puntúa (0–100), explica por qué y redacta el primer mensaje. Los duplicados se descartan solos.
- **Interpretar el score:** ≥70 contactar hoy · 40–69 esta semana · <40 baja prioridad o descartar. El botón "Detalle" muestra la razón del score y la acción recomendada.
- **Contactar:** botón WhatsApp (abre wa.me con el mensaje listo — envío manual SIEMPRE, nunca por Cloud API) o "Copiar". Al marcar "Contactado", el follow-up se agenda solo a +3 días.
- **Follow-up:** filtro "⏳ Sin respuesta" → abre "Detalle" → copia el Follow-up 1 o 2 (máx. 3–4 toques, nunca "¿viste mi mensaje?"). Configura `NEXT_PUBLIC_DEMO_LINK` en Vercel para que las plantillas incluyan tu demo.
- Anota TODO en las notas del detalle: quién contesta, objeciones, datos. La memoria comercial vive ahí.

## Pipeline
- Cuando un prospecto responde con interés real → "→ Pipeline" (queda vinculado, sin duplicarse).
- Cada oportunidad debe tener **próxima acción + fecha** (editar tarjeta). Las señales te avisan: rojo = follow-up vencido, ámbar = detenida 5+ días o propuesta sin respuesta, azul = demo sin fecha.
- Después de cada demo: botón **"Propuesta"** en la tarjeta → copia la propuesta de 1 página → revisa los [corchetes] y el precio → envíala por WhatsApp **el mismo día**.
- Al cerrar: mover a "Cliente" **y** crearlo en Clientes & Bots (con plan y mensualidad reales).

## Objetivos
En el dashboard: 5 metas de julio con avance real. Ámbar = atrasado respecto al día del mes → la línea de abajo dice qué hacer. Para cambiar las metas al mes siguiente: editar `METAS_MES` en `lib/objetivos.ts` (commit + deploy).

## Clientes & Bots (desde el primer cliente)
- "+ Cliente" con plan, mensualidad y workflow_id de n8n → se crea solo el checklist de onboarding (7 pasos). Complétenlo marcando quién hizo qué.
- Config bot (tono, horarios, derivación): n8n la lee en vivo — cambiarla aquí cambia el comportamiento del bot sin tocar el workflow.
- Salud: verde operativo · ámbar sin actividad 12h+ · rojo errores 24h (además llega alerta por WhatsApp). Reporte mensual del cliente: /brief → "Generar mensual".

## Finanzas
- **Cobros:** cada inicio de mes → "Generar cobros del mes" (una fila por cliente activo) → marcar pagado cuando pague. Lo pendiente aparece en el dashboard y en el brief.
- **Gastos:** registrar todo (dominio, APIs, marketing…) con categoría. El resumen de arriba te dice margen, punto de equilibrio y **cuántos clientes faltan para cubrir costos**.

## Decisiones y Roadmap
- Cada definición importante (precios, nicho, marca, foco) → registrarla en Decisiones con el porqué. Antes de reabrir una discusión: buscar ahí.
- Roadmap: tareas con fecha límite y área. Las vencidas suben al dashboard y al brief. Estados: Esta semana / En curso / Backlog / Hecho.

## Qué debe mantener actualizado cada socio
Diario: estados de prospectos contactados, notas, próximas acciones, respuestas del pipeline. Semanal: roadmap (viernes, revisión de 30 min), decisiones nuevas, gastos. Mensual: generar cobros, marcar pagados, revisar objetivos y ajustar metas.

## Materiales comerciales integrados (de estrategia-comercial/)
- Precios finales → ya integrados en planes y propuestas.
- Mensajes y follow-ups → botones en el Detalle de cada prospecto.
- Propuesta 1 página → botón en cada tarjeta del pipeline.
- Metas del roadmap 30 días → módulo Objetivos.
- Objeciones y scripts completos → siguen en `estrategia-comercial/OBJECIONES_RESPONDO.md` y `SCRIPTS_DE_VENTA_RESPONDO.md` (leerlos antes de las primeras demos; no se copiaron a la app para no duplicar fuentes).
