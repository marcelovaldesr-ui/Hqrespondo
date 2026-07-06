# AUDITORÍA REAL — RESPONDO HQ
**Fecha:** 6 de julio de 2026 · Auditoría de código completa antes de implementar mejoras.

## 1. Ubicación y stack

- **Ubicación:** `ChatBot Ventas/respondo-hq/` (workspace Respondo, sincronizado por OneDrive — ojo con locks de git).
- **Stack real:** Next.js 14.2 (App Router, TypeScript), Tailwind CSS 3.4, Supabase (Postgres, `@supabase/supabase-js` con service_role key solo en servidor), Gemini API (scoring + briefs), Google Places API New (búsqueda de prospectos), WhatsApp Cloud API (alertas al fundador, NO outreach).
- **Ejecución:** `npm run dev` · **Build:** `npm run build` · **Deploy:** Vercel (auto desde git).
- **Persistencia:** 100% Supabase con RLS activado sin policies (bloquea anon; el panel usa service_role en servidor). No hay localStorage ni mocks — todos los datos son reales.
- **Auth:** Basic Auth vía `middleware.ts`, soporta 2 credenciales (una por socio); el usuario autenticado viaja en header interno `x-hq-user` (no spoofeable, el middleware lo sobrescribe). `/api/hooks/*` queda fuera y valida token propio `x-hq-token`.

## 2. Módulos que existen realmente

| Módulo | Ruta | Estado |
|---|---|---|
| Centro de operaciones | `/dashboard` | Completo y conectado (MRR, pipeline, calientes, seguimientos, tareas del día, feed de eventos) |
| Prospección | `/prospeccion` | Completo: búsqueda Places → dedupe → scoring Gemini → tabla con filtros, estados, wa.me con mensaje, CSV es-CL, borrado |
| Pipeline | `/pipeline` | Completo: kanban 5 etapas, crear/editar/mover/eliminar, MRR proyectado/cerrado |
| Clientes & Bots | `/clientes` | Completo y sofisticado: salud (verde/ámbar/rojo ya existe), uptime 16h, costo mes, margen, onboarding checklist (7 pasos auto), config bot (tono/horarios/derivación, la lee n8n), reporte mensual de cliente |
| Brief del día | `/brief` | Completo: generación Gemini con fallback sin IA, historial, reportes mensuales |
| Roadmap | `/roadmap` | Completo: tablero + timeline por semana, atrasadas, áreas, quién creó/actualizó |
| Decisiones | `/decisiones` | Funcional pero mínimo: título/detalle/autor/fecha. Sin búsqueda, impacto ni estado |
| Finanzas | `/finanzas` | Funcional: cobros por mes (generación automática desde clientes activos), gastos por categoría. Sin punto de equilibrio, margen ni alertas |
| Objetivos | — | **No existe** |
| War Room / Mission Control | — | No existe como vista; el dashboard cumple parcialmente |

## 3. Endpoints reales

- `POST /api/search` — Places + scoring + insert con dedupe (place_id y teléfono).
- `GET/DELETE /api/prospects`, `PATCH/DELETE /api/prospects/:id` (campos whitelisted).
- `POST /api/deals` (desde prospecto → marca `en_pipeline`, o manual), `PATCH/DELETE /api/deals/:id`.
- `GET/POST /api/clients`, `PATCH/DELETE /api/clients/:id`, `GET/PUT .../config`, `GET/POST/PATCH .../onboarding`.
- `GET/POST /api/cobros` (+`PATCH /api/cobros/:id`), `GET/POST /api/gastos` (+DELETE), decisiones y roadmap CRUD.
- `POST /api/brief/generate`, `POST /api/brief/monthly`.
- **Hooks n8n** (protegidos con `HQ_API_TOKEN`): `POST /api/hooks/bot-events` (mensaje/error/heartbeat; error → alerta WhatsApp), `GET /api/hooks/bot-config` (n8n lee config del bot), `POST /api/hooks/brief` (cron 8:00 → brief a WhatsApp).
- Workflows n8n de ejemplo en `n8n/`: brief_diario, registro_mensajes, alerta_errores.

## 4. Qué está completo / incompleto / desconectado / duplicado

**Completo:** flujo prospección→pipeline (sin pérdida de datos, con dedupe), scoring con razón + mensaje, cobros/gastos, onboarding, config bot, brief con fallback, seguridad básica.

**Incompleto:**
- **Precios en `lib/types.ts` OBSOLETOS**: `PLAN_PRECIOS` usa la tabla interina descartada ($24.990/$39.990/$69.990) que el paquete comercial jul-2026 reemplazó por la estructura final (Inicial $79.000+$290.000 · Crecimiento $149.000+$490.000 · Pro $279.000+$890.000). **Todo deal nuevo se crea con precios que ya no rigen** — el hallazgo comercial más grave de la auditoría.
- `razon_score` existe pero casi no se ve (solo tooltip en la barra) — scoring no explicable en la práctica.
- Pipeline: existe `fecha_proxima` en la base y no se puede editar desde el kanban; no hay señal de oportunidad detenida (aunque `updated_at` está disponible y el brief sí la usa).
- Prospección: sin filtro "calientes sin contactar" / "contactados sin respuesta"; `proxima_accion` y `notas` no editables desde la tabla; sin mensajes de follow-up (solo primer toque).
- Brief: no lee roadmap, finanzas ni objetivos; si no hay datos dice poco en vez de sugerir acciones.
- Finanzas: no muestra MRR ni punto de equilibrio ni "clientes que faltan para cubrir gastos".
- Decisiones: sin búsqueda ni clasificación por impacto.
- Eventos de bot: solo 3 tipos (mensaje/error/heartbeat); faltan los eventos comerciales (lead_captured, quote_generated, meeting_booked, human_handoff).

**Desconectado:** los entregables de `estrategia-comercial/` (mensajes, follow-ups, objeciones, precios finales, roadmap 30 días, metas) no viven en RespondHQ — se ejecuta la estrategia fuera de la herramienta.

**Duplicado / simplificable:** nada grave. Deal etapa "cliente" no crea el cliente en Clientes & Bots (solo un aviso de texto) — aceptable, se documenta como mejora futura para no duplicar registros por accidente.

**Solo mock/demo:** nada. No hay datos falsos en el código.

## 5. Documentos estratégicos encontrados y cómo alimentan RespondHQ

En `ChatBot Ventas/estrategia-comercial/` (11 archivos, jul-2026): PLANES_Y_PRECIOS (estructura final + Piloto Fundador), MENSAJES_PROSPECCION (primer toque, follow-up 1 y 2, reactivación, post-demo, por rubro), OBJECIONES, SCRIPTS_DE_VENTA, ROADMAP_COMERCIAL_30_DIAS (metas: 100 prospectos, 10+ respuestas, 5+ demos, 4+ propuestas, 2–3 cierres al 2-ago), ICP, DEMO_COMERCIAL, OFERTA_LANZAMIENTO. Integración implementada: precios finales → `lib/types.ts`; mensajes → `lib/mensajes.ts` (follow-ups desde prospectos); metas → `lib/objetivos.ts` (progreso en dashboard); propuesta 1 página → `lib/propuesta.ts` (desde el pipeline).

## 6. Riesgos detectados

**Técnicos:** carpeta en OneDrive (locks de `.git/index.lock` ya ocurrieron; archivos pueden quedar cloud-only) · dependencia de tier gratis de Gemini (mitigada con fallback a 2.5-flash y fallback sin IA) · `tsconfig.tsbuildinfo` y `.next/` versionados o presentes en la carpeta (ruido) · sin tests (aceptable a esta escala).

**Seguridad:** razonable para un panel interno de 2 personas. Basic Auth sin rate-limit (riesgo bajo con contraseñas fuertes) · service_role solo en servidor ✓ · hooks con token ✓ · si `HQ_USER/PASSWORD` no están seteados el panel queda abierto (documentado, verificar en Vercel) · la API key de Gemini viaja en query string (patrón oficial de Google, pero queda en logs — riesgo bajo).

**Datos:** sin backups configurados más allá de los de Supabase free tier · borrado masivo de prospectos bien protegido (doble confirm + header) · `clients` sin `updated_at`.

## 7. Qué NO tocar

- `middleware.ts` (auth funciona, patrón correcto).
- `lib/db.ts` (el `cache: no-store` arregló un bug real de producción — no revertir).
- Lógica de dedupe en `/api/search`.
- Clientes & Bots: salud, uptime, onboarding y config bot — ya están bien resueltos.
- RoadmapBoard (tablero+timeline maduro).
- La landing pública (`web-respondo/`) — fuera de alcance.
- Migraciones 002–007 ya aplicadas.

## 8. Cambios de mayor impacto para los founders (orden)

1. **Corregir precios a la estructura final** — cada propuesta que salga de HQ con precios viejos cuesta plata real.
2. Dashboard → Mission Control con fase, meta del mes, 3 prioridades y objetivos (metas del roadmap comercial 30 días).
3. Follow-ups y filtros comerciales en prospección (la tabla pasa de lista a bandeja de trabajo).
4. Señales de pipeline detenido + propuesta de 1 página generable.
5. Brief conectado a roadmap/finanzas/objetivos con sugerencias cuando no hay datos.
6. Finanzas con punto de equilibrio y alertas.
7. Eventos de bot comerciales (lead/cotización/agenda/derivación) para cuando entre el primer cliente.
